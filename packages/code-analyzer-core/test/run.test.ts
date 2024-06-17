import {
    CodeAnalyzer,
    CodeAnalyzerConfig,
    CodeLocation,
    EngineRunResults,
    EngineLogEvent,
    EngineProgressEvent,
    EngineResultsEvent,
    EventType,
    LogEvent,
    LogLevel,
    RuleSelection,
    RunOptions,
    RunResults,
    SeverityLevel,
    Violation,
    RuleType
} from "../src";
import * as stubs from "./stubs";
import {getMessage} from "../src/messages";
import {toAbsolutePath} from "../src/utils";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot, FixedClock} from "./test-helpers";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {UnexpectedEngineErrorRule} from "../src/rules";
import {UndefinedCodeLocation} from "../src/results";

const SAMPLE_RUN_OPTIONS: RunOptions = {
    workspaceFiles: ['test']
};

describe("Tests for the run method of CodeAnalyzer", () => {
    changeWorkingDirectoryToPackageRoot();

    let sampleTimestamp: Date;
    let codeAnalyzer: CodeAnalyzer;
    let stubEngine1: stubs.StubEngine1;
    let stubEngine2: stubs.StubEngine2;
    let logEvents: LogEvent[];
    let selection: RuleSelection;
    const expectedStubEngine1RuleNames: string[] = ['stub1RuleA', 'stub1RuleB', 'stub1RuleC'];
    const expectedStubEngine2RuleNames: string[] = ['stub2RuleA', 'stub2RuleC'];

    beforeEach(async () => {
        logEvents = [];
        sampleTimestamp = new Date();
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        codeAnalyzer.setClock(new FixedClock(sampleTimestamp));
        const stubPlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubPlugin);
        stubEngine1 = stubPlugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        stubEngine2 = stubPlugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2;
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        selection = codeAnalyzer.selectRules();
    })

    it("When run options contains file that does not exist, then error", () => {
        const runOptions: RunOptions = {
            workspaceFiles: ['does/not/exist.cls']
        };
        expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('FileOrFolderDoesNotExist', toAbsolutePath('does/not/exist.cls')));
    });

    it("When run options contains a path start point (without method) with a file that does not exist, then error", () => {
        const runOptions: RunOptions = {
            workspaceFiles: [path.resolve(__dirname)],
            pathStartPoints: [path.resolve(__dirname, 'doesNotExist.xml')],
        };
        expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('FileOrFolderDoesNotExist', path.resolve(__dirname, 'doesNotExist.xml')));
    });

    it("When run options contains a path start point (with method) with a file that does not exist, then error", () => {
        const badPathStartPoint: string = path.resolve(__dirname, 'doesNotExist.xml#someMethod');
        const runOptions: RunOptions = {
            workspaceFiles: [path.resolve(__dirname)],
            pathStartPoints: [path.resolve(__dirname, 'run.test.ts'), badPathStartPoint]
        };
        expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('PathStartPointFileDoesNotExist', badPathStartPoint, path.resolve(__dirname, 'doesNotExist.xml')));
    });

    it("When path starting point is a folder with methods specified, then error", () => {
        const badPathStartPoint: string = "test/test-data#method1;method2";
        const runOptions: RunOptions = {
            workspaceFiles: [path.resolve(__dirname)],
            pathStartPoints: [badPathStartPoint],
        };
        expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('PathStartPointWithMethodMustNotBeFolder', badPathStartPoint, path.resolve('test', 'test-data')));
    });

    it("When path starting point has too many hashtags specified, then error", () => {
        const badPathStartPoint: string = "test/test-helpers.ts#method1#method2";
        const runOptions: RunOptions = {
            workspaceFiles: ['test'],
            pathStartPoints: [badPathStartPoint],
        };
        expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('InvalidPathStartPoint', badPathStartPoint));
    });

    it("When specifying a path starting point that has an invalid character in its method name, then error", () => {
        const badPathStartPoint: string = "test/test-helpers.ts#someMethod,oopsCommaIsInvalidHere";
        const runOptions: RunOptions = {
            workspaceFiles: ['test'],
            pathStartPoints: [badPathStartPoint],
        };
        expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('InvalidPathStartPoint', badPathStartPoint));
    });

    it("When files to include is an empty array, then error", () => {
        const runOptions: RunOptions = {
            workspaceFiles: []
        };
        expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('AtLeastOneFileOrFolderMustBeIncluded'));
    });

    it("When path start point does not live under one of the specified paths, then error", () => {
        const badPathStartPoint: string = "test/test-helpers.ts#someMethod";
        const runOptions: RunOptions = {
            workspaceFiles: ['src', 'package.json'],
            pathStartPoints: [badPathStartPoint],
        };
        expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('PathStartPointMustBeInsideWorkspace', path.resolve('test', 'test-helpers.ts'),
                JSON.stringify([path.resolve('package.json'), path.resolve('src')])));
    });

    it("When including a relative file and a folder then they both are passed each engine as absolute paths", async () => {
        await codeAnalyzer.run(selection, {
            workspaceFiles: ['src', 'test/run.test.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            workspaceFiles: [path.resolve('src'), path.resolve('test', 'run.test.ts')]
        };
        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
        expect(stubEngine2.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine2RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
    });

    it("When including a parent folder and child paths under that folder, then the redundant children are removed", async () => {
        await codeAnalyzer.run(selection, {
            workspaceFiles: ['test/test-data', 'test', 'test/run.test.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            workspaceFiles: [path.resolve('test')]
        };
        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
        expect(stubEngine2.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine2RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
    });

    it("When specifying path start points as an empty array, then no path start points are passed to engines", async () => {
        await codeAnalyzer.run(selection, {
            workspaceFiles: ['src'],
            pathStartPoints: []
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            workspaceFiles: [path.resolve('src')]
        };
        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
        expect(stubEngine2.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine2RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
    });

    it("When specifying path start points as files and subfolders, then they are passed to each engine successfully", async () => {
        await codeAnalyzer.run(selection, {
            workspaceFiles: ['test'],
            pathStartPoints: ['test/test-data', 'test/run.test.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            workspaceFiles: [path.resolve('test')],
            pathStartPoints: [
                { file: path.resolve("test", "test-data") },
                { file: path.resolve("test", "run.test.ts")}
            ]
        };
        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
        expect(stubEngine2.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine2RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
    });

    it("When specifying path start points individual methods, then they are passed to each engine successfully", async () => {
        await codeAnalyzer.run(selection, {
            workspaceFiles: ['test', 'src/utils.ts', 'src/index.ts'],
            pathStartPoints: ['test/run.test.ts#someMethod','test/stubs.ts#method1;method2;method3','src/utils.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            workspaceFiles: [path.resolve("src", "index.ts"), path.resolve("src", "utils.ts"), path.resolve('test')],
            pathStartPoints: [
                {
                    file: path.resolve("test", "run.test.ts"),
                    methodName: 'someMethod'
                },
                {
                    file: path.resolve("test", "stubs.ts"),
                    methodName: 'method1'
                },
                {
                    file: path.resolve("test", "stubs.ts"),
                    methodName: 'method2'
                },
                {
                    file: path.resolve("test", "stubs.ts"),
                    methodName: 'method3'
                },
                {
                    file: path.resolve("src", "utils.ts")
                }
            ]
        };
        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
        expect(stubEngine2.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine2RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
    });

    it("When no rules are selected for an engine, then when running, that engine is skipped", () => {
        selection = codeAnalyzer.selectRules('stubEngine1:Recommended');
        codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        const expectedEngineRunOptions: engApi.RunOptions = {
            workspaceFiles: [path.resolve('test')]
        };
        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
        expect(stubEngine2.runRulesCallHistory).toEqual([]);
    });

    it("When zero rules are selected, then all engines should be skipped and returned results contain no violations", async () => {
        selection = codeAnalyzer.selectRules('doesNotExist');
        const results: RunResults = await codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        expect(stubEngine1.runRulesCallHistory).toEqual([]);
        expect(stubEngine2.runRulesCallHistory).toEqual([]);
        expect(results.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(results.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(results.getViolations()).toEqual([]);
        expect(results.getEngineNames()).toEqual([]);
    });

    it("When an engine did not run, then attempting to get that engine's run results gives an error", async () => {
        selection = codeAnalyzer.selectRules('stubEngine2');
        const results: RunResults = await codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        expect(results.getEngineNames()).toEqual(['stubEngine2']);
        expect(() => results.getEngineRunResults('stubEngine1')).toThrow(
            getMessage('EngineRunResultsMissing', 'stubEngine1'));
        expect(results.getEngineRunResults('stubEngine2')).toBeDefined();
    });

    it("When no zero violations occurred, then results have no violations for the engines that ran", async () => {
        const overallResults: RunResults = await codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        expect(overallResults.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(overallResults.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(overallResults.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(overallResults.getViolations()).toEqual([]);

        const stubEngine1Results = overallResults.getEngineRunResults('stubEngine1');
        expect(stubEngine1Results.getEngineName()).toEqual('stubEngine1');
        expect(stubEngine1Results.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(stubEngine1Results.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(stubEngine1Results.getViolations()).toEqual([]);

        const stubEngine2Results = overallResults.getEngineRunResults('stubEngine2');
        expect(stubEngine2Results.getEngineName()).toEqual('stubEngine2');
        expect(stubEngine2Results.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(stubEngine2Results.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(stubEngine2Results.getViolations()).toEqual([]);
    });

    it("When an engines return violations, then they are correctly included in the run results", async () => {
        stubEngine1.resultsToReturn = {
            violations: [stubs.getSampleViolationForStub1RuleA(), stubs.getSampleViolationForStub1RuleC()]
        };
        stubEngine2.resultsToReturn = {
            violations: [stubs.getSampleViolationForStub2RuleC()]
        };
        const overallResults: RunResults = await codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        expect(overallResults.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(overallResults.getViolationCount()).toEqual(3);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(0);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Moderate)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Low)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Info)).toEqual(0);

        const engine1Results = overallResults.getEngineRunResults('stubEngine1');
        expect(engine1Results.getEngineName()).toEqual('stubEngine1');
        expect(engine1Results.getViolationCount()).toEqual(2);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(0);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(0);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.Moderate)).toEqual(1);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.Low)).toEqual(1);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.Info)).toEqual(0);
        const engine1Violations: Violation[] = engine1Results.getViolations();
        expect(engine1Violations).toHaveLength(2);
        expect(engine1Violations[0].getRule()).toEqual(selection.getRule('stubEngine1', 'stub1RuleA'));
        expect(engine1Violations[0].getMessage()).toEqual('SomeViolationMessage1');
        const engine1Violation1CodeLocations: CodeLocation[] = engine1Violations[0].getCodeLocations();
        expect(engine1Violation1CodeLocations).toHaveLength(1);
        assertCodeLocation(engine1Violation1CodeLocations[0], path.resolve('test', 'config.test.ts'), 3, 6, 11, 8);
        expect(engine1Violations[0].getPrimaryLocationIndex()).toEqual(0);
        expect(engine1Violations[0].getResourceUrls()).toEqual(["https://example.com/stub1RuleA"]);
        expect(engine1Violations[1].getRule()).toEqual(selection.getRule('stubEngine1', 'stub1RuleC'));
        expect(engine1Violations[1].getMessage()).toEqual('SomeViolationMessage2');
        const engine1Violation2CodeLocations: CodeLocation[] = engine1Violations[1].getCodeLocations();
        expect(engine1Violation2CodeLocations).toHaveLength(1);
        assertCodeLocation(engine1Violation2CodeLocations[0], path.resolve('test', 'run.test.ts'), 21, 7, 25, 4);
        expect(engine1Violations[1].getPrimaryLocationIndex()).toEqual(0);
        expect(engine1Violations[1].getResourceUrls()).toEqual([
            "https://example.com/stub1RuleC",
            "https://example.com/aViolationSpecificUrl1",
            "https://example.com/violationSpecificUrl2"
        ]);

        const engine2Results = overallResults.getEngineRunResults('stubEngine2');
        expect(engine2Results.getEngineName()).toEqual('stubEngine2');
        expect(engine2Results.getViolationCount()).toEqual(1);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(0);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(1);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.Moderate)).toEqual(0);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.Low)).toEqual(0);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.Info)).toEqual(0);
        const engine2Violations: Violation[] = engine2Results.getViolations();
        expect(engine2Violations).toHaveLength(1);
        expect(engine2Violations[0].getRule()).toEqual(selection.getRule('stubEngine2', 'stub2RuleC'));
        expect(engine2Violations[0].getMessage()).toEqual('SomeViolationMessage3');
        const engine2Violation1CodeLocations: CodeLocation[] = engine2Violations[0].getCodeLocations();
        expect(engine2Violation1CodeLocations).toHaveLength(3);
        assertCodeLocation(engine2Violation1CodeLocations[0], path.resolve('test', 'stubs.ts'), 4, 13);
        assertCodeLocation(engine2Violation1CodeLocations[1], path.resolve('test', 'test-helpers.ts'), 9, 1);
        assertCodeLocation(engine2Violation1CodeLocations[2], path.resolve('test', 'stubs.ts'), 76, 8);
        expect(engine2Violations[0].getPrimaryLocationIndex()).toEqual(2);
        expect(engine2Violations[0].getResourceUrls()).toEqual([]);

        expect(overallResults.getViolations()).toEqual([...engine1Violations,...engine2Violations]);
    });

    it("When an engine returns a violation for a rule that was not actually selected, then an error is thrown", () => {
        stubEngine1.resultsToReturn = {
            violations: [stubs.getSampleViolationForStub1RuleC()]
        };
        selection = codeAnalyzer.selectRules('stub1RuleA');
        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationForUnselectedRule', 'stubEngine1', 'stub1RuleC'));
    });

    it("When an engine returns a violation that has a primary location index that is too large, then an error is thrown", () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleC();
        badViolation.primaryLocationIndex = 1;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };
        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine1', 'stub1RuleC', 1, 1));
    });

    it("When an engine returns a violation that has a primary location index that is negative, then an error is thrown", () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub2RuleC();
        badViolation.primaryLocationIndex = -2;
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine2', 'stub2RuleC', -2, 3));
    });

    it("When an engine returns a violation that has a primary location index that is not an integer, then an error is thrown", () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleC();
        badViolation.primaryLocationIndex = 0.5;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };
        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine1', 'stub1RuleC', 0.5, 1));
    });

    it("When an engine returns a code location file that does not exist, then an error is thrown", () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub2RuleC();
        badViolation.codeLocations[1].file = 'test/doesNotExist';
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationFileThatDoesNotExist',
                'stubEngine2', 'stub2RuleC', path.resolve('test', 'doesNotExist')));
    });

    it("When an engine returns a code location file that is a folder, then an error is thrown", () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub2RuleC();
        badViolation.codeLocations[1].file = 'test/test-data';
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationFileAsFolder',
                'stubEngine2', 'stub2RuleC', path.resolve('test', 'test-data')));
    });


    function testInvalidLineOrColumnScenario(startLine: number, startColumn: number, endLine: number, endColumn: number, expectedBadField: string, expectedBadValue: number): void {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleA();
        badViolation.codeLocations[0].startLine = startLine;
        badViolation.codeLocations[0].startColumn = startColumn;
        badViolation.codeLocations[0].endLine = endLine;
        badViolation.codeLocations[0].endColumn = endColumn;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };

        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                'stubEngine1', 'stub1RuleA', expectedBadField, expectedBadValue));
    }
    it("When an engine returns a code location that has an invalid line or column, then an error is thrown", () => {
        testInvalidLineOrColumnScenario(-1, 2, 3, 4, 'startLine', -1);
        testInvalidLineOrColumnScenario(1.5, 2, 3, 4, 'startLine', 1.5);
        testInvalidLineOrColumnScenario(1, 0, 3, 4, 'startColumn', 0);
        testInvalidLineOrColumnScenario(1, 3.124, 3, 4, 'startColumn', 3.124);
        testInvalidLineOrColumnScenario(1, 2, -1.2, 4, 'endLine', -1.2);
        testInvalidLineOrColumnScenario(1, 2, 3, 0, 'endColumn', 0);
    });

    it("When an engine returns a code location with a endLine before a startLine, then an error is thrown", () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleA();
        badViolation.codeLocations[0].startLine = 4;
        badViolation.codeLocations[0].endLine = 2;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };

        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationWithEndLineBeforeStartLine',
                'stubEngine1', 'stub1RuleA', 2, 4));
    });

    it("When an engine returns a code location with equal startLine and endLine with an endColumn before a startColumn, then an error is thrown", () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleA();
        badViolation.codeLocations[0].startLine = 4;
        badViolation.codeLocations[0].startColumn = 5;
        badViolation.codeLocations[0].endLine = 4;
        badViolation.codeLocations[0].endColumn = 2;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };

        expect(codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationWithEndColumnBeforeStartColumnOnSameLine',
                'stubEngine1', 'stub1RuleA', 2, 5));
    });

    it("When an engine returns a code location with an endColumn but no endLine, then the endColumn is simply not used", async () => {
        const malformedViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleA();
        malformedViolation.codeLocations[0].startLine = 4;
        malformedViolation.codeLocations[0].startColumn = 5;
        malformedViolation.codeLocations[0].endLine = undefined;
        malformedViolation.codeLocations[0].endColumn = 4;
        stubEngine1.resultsToReturn = {
            violations: [malformedViolation]
        };
        const overallResults: RunResults = await codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        const violations: Violation[] = overallResults.getViolations();
        expect(violations).toHaveLength(1);
        expect(violations[0].getCodeLocations()[0].getStartLine()).toEqual(4);
        expect(violations[0].getCodeLocations()[0].getStartColumn()).toEqual(5);
        expect(violations[0].getCodeLocations()[0].getEndLine()).toBeUndefined();
        expect(violations[0].getCodeLocations()[0].getEndColumn()).toBeUndefined();
    });

    it("When an engine throws an exception when running, then a result is returned with a Critical violation of type UnexpectedError", async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        await codeAnalyzer.addEnginePlugin(new stubs.ThrowingEnginePlugin());
        selection = codeAnalyzer.selectRules();
        const overallResults: RunResults = await codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        expect(overallResults.getRunDirectory()).toEqual(process.cwd() + path.sep);
        expect(overallResults.getViolationCount()).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(0);
        expect(overallResults.getEngineNames()).toEqual(['throwingEngine']);
        const violations: Violation[] = overallResults.getViolations();
        expect(violations).toHaveLength(1);
        const engineRunResults: EngineRunResults = overallResults.getEngineRunResults('throwingEngine');
        expect(engineRunResults.getViolations()).toEqual(violations);
        expect(violations[0].getRule()).toEqual(new UnexpectedEngineErrorRule('throwingEngine'));
        expect(violations[0].getRule().getDescription()).toEqual(getMessage('UnexpectedEngineErrorRuleDescription', 'throwingEngine'));
        expect(violations[0].getRule().getEngineName()).toEqual('throwingEngine');
        expect(violations[0].getRule().getName()).toEqual('UnexpectedEngineError');
        expect(violations[0].getRule().getResourceUrls()).toEqual([]);
        expect(violations[0].getRule().getSeverityLevel()).toEqual(SeverityLevel.Critical);
        expect(violations[0].getRule().getTags()).toEqual([]);
        expect(violations[0].getRule().getType()).toEqual(RuleType.UnexpectedError);
        expect(violations[0].getPrimaryLocationIndex()).toEqual(0);
        expect(violations[0].getCodeLocations()).toEqual([UndefinedCodeLocation.INSTANCE]);
        expect(violations[0].getMessage()).toEqual(getMessage('UnexpectedEngineErrorViolationMessage',
            'throwingEngine', 'SomeErrorMessageFromThrowingEngine'));
    });

    it("When running engines, then events are wired up and emitted correctly from the engines", async () => {
        const engineLogEvents: EngineLogEvent[] = [];
        const engineProgressEvents: EngineProgressEvent[] = [];
        const engineResultsEvents: EngineResultsEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineLogEvent, (event: EngineLogEvent) => engineLogEvents.push(event));
        codeAnalyzer.onEvent(EventType.EngineProgressEvent, (event: EngineProgressEvent) => engineProgressEvents.push(event));
        codeAnalyzer.onEvent(EventType.EngineResultsEvent, (event: EngineResultsEvent) => engineResultsEvents.push(event));
        const runResults: RunResults = await codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        expect(engineLogEvents).toHaveLength(2);
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine1",
            logLevel: LogLevel.Fine,
            message: "someMiscFineMessageFromStubEngine1"
        });
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine2",
            logLevel: LogLevel.Info,
            message: "someMiscInfoMessageFromStubEngine2"
        });

        expect(engineProgressEvents).toHaveLength(9);
        let i = 0; // Using this to ensure the order of events
        for (const expectedPercentComplete of [0, 0, 50, 100, 100]) { // Core and stubEngine1 both give us 0 and 100
            expect(engineProgressEvents[i++]).toEqual({
                type: EventType.EngineProgressEvent,
                timestamp: sampleTimestamp,
                engineName: "stubEngine1",
                percentComplete: expectedPercentComplete
            });
        }
        for (const expectedPercentComplete of [0, 5, 63, 100]) { // Only Core gives us 0 and 100
            expect(engineProgressEvents[i++]).toEqual({
                type: EventType.EngineProgressEvent,
                timestamp: sampleTimestamp,
                engineName: "stubEngine2",
                percentComplete: expectedPercentComplete
            });
        }

        expect(engineResultsEvents).toHaveLength(2);
        expect(engineResultsEvents).toContainEqual({
            type: EventType.EngineResultsEvent,
            timestamp: sampleTimestamp,
            results: runResults.getEngineRunResults("stubEngine1")
        })
        expect(engineResultsEvents).toContainEqual({
            type: EventType.EngineResultsEvent,
            timestamp: sampleTimestamp,
            results: runResults.getEngineRunResults("stubEngine2")
        })
    });
});

function getAllSeverityLevels(): SeverityLevel[] {
    return Object.values(SeverityLevel)
        .filter((value) => typeof value === 'number') as SeverityLevel[];
}

function assertCodeLocation(codeLocation: CodeLocation, file: string, startLine: number, startColumn: number, endLine?: number, endColumn?: number): void {
    expect(codeLocation.getFile()).toEqual(file);
    expect(codeLocation.getStartLine()).toEqual(startLine);
    expect(codeLocation.getStartColumn()).toEqual(startColumn);
    expect(codeLocation.getEndLine()).toEqual(endLine);
    expect(codeLocation.getEndColumn()).toEqual(endColumn);
}