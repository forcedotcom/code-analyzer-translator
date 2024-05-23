import {
    CodeAnalyzer,
    CodeAnalyzerConfig, CodeLocation,
    EventType,
    LogEvent,
    RuleSelection,
    RunOptions,
    RunResults,
    SeverityLevel,
    Violation
} from "../src";
import {StubEngine1, StubEngine2, StubEnginePlugin} from "./stubs";
import {getMessage} from "../src/messages";
import {toAbsolutePath} from "../src/utils";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import * as engApi from "@salesforce/code-analyzer-engine-api"

const SAMPLE_RUN_OPTIONS: RunOptions = {
    filesToInclude: ['test']
};
const SAMPLE_STUB1RULEA_VIOLATION: engApi.Violation = {
    ruleName: 'stub1RuleA',
    message: 'SomeViolationMessage1',
    codeLocations: [
        {
            file: 'test/config.test.ts',
            startLine: 3,
            startColumn: 6,
            endLine: 11,
            endColumn: 8
        }
    ],
    primaryLocationIndex: 0
}
const SAMPLE_STUB1RULEC_VIOLATION: engApi.Violation = {
    ruleName: 'stub1RuleC',
    message: 'SomeViolationMessage2',
    codeLocations: [
        {
            file: 'test/run.test.ts',
            startLine: 21,
            startColumn: 7,
            endLine: 25,
            endColumn: 4
        }
    ],
    primaryLocationIndex: 0
};
const SAMPLE_STUB2RULEC_VIOLATION: engApi.Violation = {
    ruleName: 'stub2RuleC',
    message: 'SomeViolationMessage3',
    codeLocations: [
        {
            file: 'test/stubs.ts',
            startLine: 4,
            startColumn: 13
        },
        {
            file: 'test/test-helpers.ts',
            startLine: 9,
            startColumn: 1
        },
        {
            file: 'test/stubs.ts',
            startLine: 76,
            startColumn: 8
        }
    ],
    primaryLocationIndex: 2
};


describe("Tests for the run method of CodeAnalyzer", () => {
    changeWorkingDirectoryToPackageRoot();

    let codeAnalyzer: CodeAnalyzer;
    let stubEngine1: StubEngine1;
    let stubEngine2: StubEngine2;
    let logEvents: LogEvent[];
    let selection: RuleSelection;
    const expectedStubEngine1RuleNames: string[] = ['stub1RuleA', 'stub1RuleB', 'stub1RuleC'];
    const expectedStubEngine2RuleNames: string[] = ['stub2RuleA', 'stub2RuleC'];

    beforeEach(() => {
        logEvents = [];
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        const stubPlugin: StubEnginePlugin = new StubEnginePlugin();
        codeAnalyzer.addEnginePlugin(stubPlugin);
        stubEngine1 = stubPlugin.getCreatedEngine('stubEngine1') as StubEngine1;
        stubEngine2 = stubPlugin.getCreatedEngine('stubEngine2') as StubEngine2;
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        selection = codeAnalyzer.selectRules();
    })

    it("When run options contains file that does not exist, then error", () => {
        const runOptions: RunOptions = {
            filesToInclude: ['does/not/exist.cls']
        };
        expect(() => codeAnalyzer.run(selection, runOptions)).toThrow(
            getMessage('FileOrFolderDoesNotExist', toAbsolutePath('does/not/exist.cls')));
    });

    it("When run options contains entrypoint (without method) with a file that does not exist, then error", () => {
        const runOptions: RunOptions = {
            filesToInclude: [path.resolve(__dirname)],
            entryPoints: [path.resolve(__dirname, 'doesNotExist.xml')],
        };
        expect(() => codeAnalyzer.run(selection, runOptions)).toThrow(
            getMessage('FileOrFolderDoesNotExist', path.resolve(__dirname, 'doesNotExist.xml')));
    });

    it("When run options contains entrypoint (with method) with a file that does not exist, then error", () => {
        const badEntryPoint: string = path.resolve(__dirname, 'doesNotExist.xml#someMethod');
        const runOptions: RunOptions = {
            filesToInclude: [path.resolve(__dirname)],
            entryPoints: [path.resolve(__dirname, 'run.test.ts'), badEntryPoint]
        };
        expect(() => codeAnalyzer.run(selection, runOptions)).toThrow(
            getMessage('EntryPointFileDoesNotExist', badEntryPoint, path.resolve(__dirname, 'doesNotExist.xml')));
    });

    it("When entry point is a folder with methods specified, then error", () => {
        const badEntryPoint: string = "test/test-data#method1;method2";
        const runOptions: RunOptions = {
            filesToInclude: [path.resolve(__dirname)],
            entryPoints: [badEntryPoint],
        };
        expect(() => codeAnalyzer.run(selection, runOptions)).toThrow(
            getMessage('EntryPointWithMethodMustNotBeFolder', badEntryPoint, path.resolve('test', 'test-data')));
    });

    it("When entry point has too many hashtags specified, then error", () => {
        const badEntryPoint: string = "test/test-helpers.ts#method1#method2";
        const runOptions: RunOptions = {
            filesToInclude: ['test'],
            entryPoints: [badEntryPoint],
        };
        expect(() => codeAnalyzer.run(selection, runOptions)).toThrow(
            getMessage('InvalidEntryPoint', badEntryPoint));
    });

    it("When specifying an entry point that has an invalid character in its method name, then error", () => {
        const badEntryPoint: string = "test/test-helpers.ts#someMethod,oopsCommaIsInvalidHere";
        const runOptions: RunOptions = {
            filesToInclude: ['test'],
            entryPoints: [badEntryPoint],
        };
        expect(() => codeAnalyzer.run(selection, runOptions)).toThrow(
            getMessage('InvalidEntryPoint', badEntryPoint));
    });

    it("When files to include is an empty array, then error", () => {
        const runOptions: RunOptions = {
            filesToInclude: []
        };
        expect(() => codeAnalyzer.run(selection, runOptions)).toThrow(
            getMessage('AtLeastOneFileOrFolderMustBeIncluded'));
    });

    it("When entry point does not live under one of the specified paths, then error", () => {
        const badEntryPoint: string = "test/test-helpers.ts#someMethod";
        const runOptions: RunOptions = {
            filesToInclude: ['src', 'package.json'],
            entryPoints: [badEntryPoint],
        };
        expect(() => codeAnalyzer.run(selection, runOptions)).toThrow(
            getMessage('EntryPointMustBeUnderFilesToInclude', path.resolve('test', 'test-helpers.ts'),
                JSON.stringify([path.resolve('src'), path.resolve('package.json')])));
    });

    it("When including a relative file and a folder then they both are passed each engine as absolute paths", () => {
        codeAnalyzer.run(selection, {
            filesToInclude: ['src', 'test/run.test.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            filesToInclude: [path.resolve('src'), path.resolve('test', 'run.test.ts')]
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

    it("When specifying entry points as an empty array, then no entry points are passed to engines", () => {
        codeAnalyzer.run(selection, {
            filesToInclude: ['src'],
            entryPoints: []
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            filesToInclude: [path.resolve('src')]
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

    it("When specifying entry points as files and subfolders, then they are passed to each engine successfully", () => {
        codeAnalyzer.run(selection, {
            filesToInclude: ['test'],
            entryPoints: ['test/test-data', 'test/run.test.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            filesToInclude: [path.resolve('test')],
            entryPoints: [
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

    it("When specifying entry points individual methods, then they are passed to each engine successfully", () => {
        codeAnalyzer.run(selection, {
            filesToInclude: ['test', 'src/utils.ts', 'src/index.ts'],
            entryPoints: ['test/run.test.ts#someMethod','test/stubs.ts#method1;method2;method3','src/utils.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            filesToInclude: [path.resolve('test'), path.resolve("src", "utils.ts"), path.resolve("src", "index.ts")],
            entryPoints: [
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
        selection = codeAnalyzer.selectRules('stubEngine1:default');
        codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        const expectedEngineRunOptions: engApi.RunOptions = {
            filesToInclude: [path.resolve('test')]
        };
        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
        expect(stubEngine2.runRulesCallHistory).toEqual([]);
    });

    it("When zero rules are selected, then all engines should be skipped and returned results contain no violations", () => {
        selection = codeAnalyzer.selectRules('doesNotExist');
        const results: RunResults = codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        expect(stubEngine1.runRulesCallHistory).toEqual([]);
        expect(stubEngine2.runRulesCallHistory).toEqual([]);
        expect(results.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(results.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(results.getViolations()).toEqual([]);
        expect(results.getEngineNames()).toEqual([]);
    });

    it("When an engine did not run, then attempting to get that engine's run results gives an error", () => {
        selection = codeAnalyzer.selectRules('stubEngine2');
        const results: RunResults = codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        expect(results.getEngineNames()).toEqual(['stubEngine2']);
        expect(() => results.getEngineRunResults('stubEngine1')).toThrow(
            getMessage('EngineRunResultsMissing', 'stubEngine1'));
        expect(results.getEngineRunResults('stubEngine2')).toBeDefined();
    });

    it("When no zero violations occurred, then results have no violations for the engines that ran", () => {
        const overallResults: RunResults = codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

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

    it("When an engines return violations, then they are correctly included in the run results", () => {
        stubEngine1.resultsToReturn = {
            violations: [SAMPLE_STUB1RULEA_VIOLATION, SAMPLE_STUB1RULEC_VIOLATION]
        };
        stubEngine2.resultsToReturn = {
            violations: [SAMPLE_STUB2RULEC_VIOLATION]
        };
        const overallResults: RunResults = codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

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
        expect(engine1Violations[1].getRule()).toEqual(selection.getRule('stubEngine1', 'stub1RuleC'));
        expect(engine1Violations[1].getMessage()).toEqual('SomeViolationMessage2');
        const engine1Violation2CodeLocations: CodeLocation[] = engine1Violations[1].getCodeLocations();
        expect(engine1Violation2CodeLocations).toHaveLength(1);
        assertCodeLocation(engine1Violation2CodeLocations[0], path.resolve('test', 'run.test.ts'), 21, 7, 25, 4);
        expect(engine1Violations[1].getPrimaryLocationIndex()).toEqual(0);

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

        expect(overallResults.getViolations()).toEqual([...engine1Violations,...engine2Violations]);
    });

    it("When an engine returns a violation for a rule that was not actually selected, then an error is thrown", () => {
        stubEngine1.resultsToReturn = {
            violations: [SAMPLE_STUB1RULEC_VIOLATION]
        };
        selection = codeAnalyzer.selectRules('stub1RuleA');
        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
            getMessage('EngineReturnedViolationForUnselectedRule', 'stubEngine1', 'stub1RuleC'));
    });

    it("When an engine returns a violation that has a primary location index that is too large, then an error is thrown", () => {
        const badViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB1RULEC_VIOLATION);
        badViolation.primaryLocationIndex = 1;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };
        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine1', 'stub1RuleC', 1, 1));
    });

    it("When an engine returns a violation that has a primary location index that is negative, then an error is thrown", () => {
        const badViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB2RULEC_VIOLATION);
        badViolation.primaryLocationIndex = -2;
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine2', 'stub2RuleC', -2, 3));
    });

    it("When an engine returns a violation that has a primary location index that is not an integer, then an error is thrown", () => {
        const badViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB1RULEC_VIOLATION);
        badViolation.primaryLocationIndex = 0.5;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };
        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine1', 'stub1RuleC', 0.5, 1));
    });

    it("When an engine returns a code location file that does not exist, then an error is thrown", () => {
        const badViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB2RULEC_VIOLATION);
        badViolation.codeLocations[1].file = 'test/doesNotExist';
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationFileThatDoesNotExist',
                'stubEngine2', 'stub2RuleC', path.resolve('test', 'doesNotExist')));
    });

    it("When an engine returns a code location file that is a folder, then an error is thrown", () => {
        const badViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB2RULEC_VIOLATION);
        badViolation.codeLocations[1].file = 'test/test-data';
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationFileAsFolder',
                'stubEngine2', 'stub2RuleC', path.resolve('test', 'test-data')));
    });


    function testInvalidLineOrColumnScenario(startLine: number, startColumn: number, endLine: number, endColumn: number, expectedBadField: string, expectedBadValue: number): void {
        const badViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB1RULEA_VIOLATION);
        badViolation.codeLocations[0].startLine = startLine;
        badViolation.codeLocations[0].startColumn = startColumn;
        badViolation.codeLocations[0].endLine = endLine;
        badViolation.codeLocations[0].endColumn = endColumn;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };

        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
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
        const badViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB1RULEA_VIOLATION);
        badViolation.codeLocations[0].startLine = 4;
        badViolation.codeLocations[0].endLine = 2;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };

        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationWithEndLineBeforeStartLine',
                'stubEngine1', 'stub1RuleA', 2, 4));
    });

    it("When an engine returns a code location with equal startLine and endLine with an endColumn before a startColumn, then an error is thrown", () => {
        const badViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB1RULEA_VIOLATION);
        badViolation.codeLocations[0].startLine = 4;
        badViolation.codeLocations[0].startColumn = 5;
        badViolation.codeLocations[0].endLine = 4;
        badViolation.codeLocations[0].endColumn = 2;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };

        expect(() => codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS)).toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationWithEndColumnBeforeStartColumnOnSameLine',
                'stubEngine1', 'stub1RuleA', 2, 5));
    });

    it("When an engine returns a code location with an endColumn but no endLine, then the endColumn is simply not used", () => {
        const malformedViolation: engApi.Violation = deepCopyOfViolation(SAMPLE_STUB1RULEA_VIOLATION);
        malformedViolation.codeLocations[0].startLine = 4;
        malformedViolation.codeLocations[0].startColumn = 5;
        malformedViolation.codeLocations[0].endLine = undefined;
        malformedViolation.codeLocations[0].endColumn = 4;
        stubEngine1.resultsToReturn = {
            violations: [malformedViolation]
        };
        const overallResults: RunResults = codeAnalyzer.run(selection, SAMPLE_RUN_OPTIONS);

        const violations: Violation[] = overallResults.getViolations();
        expect(violations).toHaveLength(1);
        expect(violations[0].getCodeLocations()[0].getStartLine()).toEqual(4);
        expect(violations[0].getCodeLocations()[0].getStartColumn()).toEqual(5);
        expect(violations[0].getCodeLocations()[0].getEndLine()).toBeUndefined();
        expect(violations[0].getCodeLocations()[0].getEndColumn()).toBeUndefined();
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

function deepCopyOfViolation(violation: engApi.Violation): engApi.Violation {
    return {
        ...violation,
        codeLocations: violation.codeLocations.map(deepCopyOfCodeLocation)
    };
}

function deepCopyOfCodeLocation(codeLocation: engApi.CodeLocation): engApi.CodeLocation {
    return {
        ...codeLocation
    };
}
