import {
    CodeAnalyzer,
    CodeAnalyzerConfig,
    EventType,
    LogEvent,
    RuleSelection,
    RunOptions,
    RunResults,
    SeverityLevel
} from "../src";
import {StubEngine1, StubEngine2, StubEnginePlugin} from "./stubs";
import {getMessage} from "../src/messages";
import {toAbsolutePath} from "../src/utils";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import * as engApi from "@salesforce/code-analyzer-engine-api"

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
        codeAnalyzer.run(selection, {
            filesToInclude: ['src']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            filesToInclude: [path.resolve('src')]
        };
        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: expectedEngineRunOptions
        }]);
        expect(stubEngine2.runRulesCallHistory).toEqual([]);
    });

    it("When zero rules are selected, then all engines should be skipped and returned results contain no violations", () => {
        selection = codeAnalyzer.selectRules('doesNotExist');
        const results: RunResults = codeAnalyzer.run(selection, {
            filesToInclude: ['src']
        });
        expect(stubEngine1.runRulesCallHistory).toEqual([]);
        expect(stubEngine2.runRulesCallHistory).toEqual([]);
        expect(results.getTotalViolationCount()).toEqual(0);
        expect(results.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(0);
        expect(results.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(0);
        expect(results.getViolationCountOfSeverity(SeverityLevel.Moderate)).toEqual(0);
        expect(results.getViolationCountOfSeverity(SeverityLevel.Low)).toEqual(0);
        expect(results.getViolationCountOfSeverity(SeverityLevel.Info)).toEqual(0);
        expect(results.getAllViolations()).toEqual([]);
        expect(results.getViolationsFromEngine('stubEngine1')).toEqual([]);
        expect(results.getViolationsFromEngine('stubEngine2')).toEqual([]);
    });

    // When no rules are selected for an engine then that engine isn't called

    // Test when method name has invalid characters in it
});