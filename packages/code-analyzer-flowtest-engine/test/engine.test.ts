import fs from 'node:fs/promises';
import path from 'node:path';
import {EngineRunResults, RuleDescription, SeverityLevel, Workspace} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "../src/engine";
import {FlowTestCommandWrapper, FlowTestExecutionResult, RunTimeFlowTestCommandWrapper} from "../src/python/FlowTestCommandWrapper";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

const PATH_TO_WORKSPACE = path.resolve(__dirname, 'test-data', 'example-workspaces', 'contains-multiple-flows');
const PATH_TO_SAMPLE_RESULTS = path.resolve(__dirname, 'test-data', 'sample-flowtest-results', 'engine.test.ts');
const PATH_TO_GOLDFILES = path.resolve(__dirname, 'test-data', 'goldfiles', 'engine.test.ts');

describe('Tests for the FlowTestEngine', () => {
    it('getName() returns correct name', () => {
        const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper());
        expect(engine.getName()).toEqual('flowtest');
    });

    describe('End-to-End tests', () => {
        const runTimeWrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper('python3');
        const engine: FlowTestEngine = new FlowTestEngine(runTimeWrapper);
        const workspace: Workspace = new Workspace([PATH_TO_WORKSPACE]);

        it('Engine can describe rules, run them, and convert the results into standard format', async () => {
            // Part 1: Describing production rules.
            const ruleDescriptors: RuleDescription[] = await engine.describeRules({workspace});
            // No need to do in-depth examination of the rules, since other tests already do that. Just make sure we got
            // the right number of rules.
            expect(ruleDescriptors).toHaveLength(2);

            // Part 2: Running production rules.
            const results: EngineRunResults = await engine.runRules(ruleDescriptors.map(r => r.name), {workspace});
            // No need to do in-depth examination of the results, since other tests already do that. Just make sure we
            // got the right number of violations.
            expect(results.violations).toHaveLength(22);
        }, 60000);
    });

    describe('Unit tests', () => {
        describe('#describeRules()', () => {
            describe('Rule description parsing', () => {
                it('Consolidates well-formed FlowTest rule descriptors into Code Analyzer rule descriptors', async () => {
                    // Construct the engine, injecting a Stub wrapper to replace the real one.
                    const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper());

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules({});

                    expect(ruleDescriptors).toHaveLength(2);
                    expect(ruleDescriptors[0]).toEqual({
                        name: 'PreventPassingUserDataIntoElementWithoutSharing',
                        severityLevel: SeverityLevel.High,
                        tags: ['Recommended', 'Security'],
                        description: 'Avoid passing user data into flow elements in run mode: Without Sharing',
                        resourceUrls: []
                    });
                    expect(ruleDescriptors[1]).toEqual({
                        name: 'PreventPassingUserDataIntoElementWithSharing',
                        severityLevel: SeverityLevel.Low,
                        tags: ['Recommended', 'Security'],
                        description: 'Avoid passing user data into flow elements in run mode: With Sharing',
                        resourceUrls: []
                    });
                });
            });

            describe('Workspace processing', () => {
                it.each([
                    {desc: 'is undefined', workspace: undefined},
                    {
                        desc: 'contains .flow-meta.xml files',
                        workspace: new Workspace([path.resolve(__dirname, 'test-data', 'example-workspaces', 'contains-metadata-flow-file')])
                    },
                    {
                        desc: 'contains .flow files',
                        workspace: new Workspace([path.resolve(__dirname, 'test-data', 'example-workspaces', 'contains-package-flow-file')])
                    }
                ])('When workspace $desc, rules are returned', async ({workspace}) => {
                    // Construct the engine, injecting a Stub wrapper to replace the real one.
                    const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper());

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules({workspace});

                    expect(ruleDescriptors).toHaveLength(2);
                });

                it('When workspace contains no flow files, no rules are returned', async () => {
                    const workspace = new Workspace([path.resolve(__dirname, 'test-data', 'example-workspaces', 'contains-no-flow-files')]);
                    // Construct the engine, injecting a Stub wrapper to replace the real one.
                    const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper());

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules({workspace});

                    expect(ruleDescriptors).toHaveLength(0);
                });
            });
        });

        describe('#runRules', () => {

            const PATH_TO_SUBFLOW_TEST1: string = path.join(PATH_TO_WORKSPACE, 'subflow_test1.flow-meta.xml');
            const PATH_TO_INNER_SUBFLOW_EXAMPLE: string = path.join(PATH_TO_WORKSPACE, 'inner_subflow_example.flow-meta.xml');
            const PATH_TO_EXAMPLE1: string = path.join(PATH_TO_WORKSPACE, 'example1.flow-meta.xml');
            const PATH_TO_EXAMPLE2: string = path.join(PATH_TO_WORKSPACE, 'example2.flow-meta.xml');

            afterEach(() => {
                jest.restoreAllMocks();
            })

            async function readAndParseInputFile(inputFile: string): Promise<FlowTestExecutionResult> {
                const inputFileContents: string = (await fs.readFile(inputFile, {encoding: 'utf-8'}))
                    .replaceAll('"__PATH_TO_SUBFLOW_TEST1__"', JSON.stringify(PATH_TO_SUBFLOW_TEST1))
                    .replaceAll('"__PATH_TO_INNER_SUBFLOW_EXAMPLE__"', JSON.stringify(PATH_TO_INNER_SUBFLOW_EXAMPLE))
                    .replaceAll('"__PATH_TO_EXAMPLE1__"', JSON.stringify(PATH_TO_EXAMPLE1))
                    .replaceAll('"__PATH_TO_EXAMPLE2__"', JSON.stringify(PATH_TO_EXAMPLE2));

                return JSON.parse(inputFileContents) as FlowTestExecutionResult;
            }

            async function readAndParseGoldfile(goldfile: string): Promise<EngineRunResults> {
                const goldfileContents: string = (await fs.readFile(goldfile, {encoding: 'utf-8'}))
                    .replaceAll('"__PATH_TO_SUBFLOW_TEST1__"', JSON.stringify(PATH_TO_SUBFLOW_TEST1))
                    .replaceAll('"__PATH_TO_INNER_SUBFLOW_EXAMPLE__"', JSON.stringify(PATH_TO_INNER_SUBFLOW_EXAMPLE))
                    .replaceAll('"__PATH_TO_EXAMPLE1__"', JSON.stringify(PATH_TO_EXAMPLE1))
                    .replaceAll('"__PATH_TO_EXAMPLE2__"', JSON.stringify(PATH_TO_EXAMPLE2));

                return JSON.parse(goldfileContents) as EngineRunResults;
            }

            it.each([
                {case: 'Empty results', inputFile: 'empty-results.json', goldfile: 'empty-results.goldfile.json'},
                {
                    case: 'Non-empty results',
                    inputFile: 'non-empty-results.json',
                    goldfile: 'non-empty-results.goldfile.json'
                }
            ])('Converts FlowTest format to Code Analyzer format. Case: $case', async ({inputFile, goldfile}) => {
                // ==== SETUP ====
                const fakeFlowTestResults: FlowTestExecutionResult = await readAndParseInputFile(path.join(PATH_TO_SAMPLE_RESULTS, inputFile));

                // Instantiate the engine with a stubbed wrapper that will return the desired FlowTestExecutionResult.
                const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper(fakeFlowTestResults));

                // ==== TESTED BEHAVIOR ====
                // Specify every rule
                const desiredRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];
                // Specify every file in the workspace
                const workspaceFiles = [PATH_TO_SUBFLOW_TEST1, PATH_TO_INNER_SUBFLOW_EXAMPLE, PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2];
                const engineResults: EngineRunResults = await engine.runRules(desiredRuleNames, {
                    workspace: new Workspace(workspaceFiles)
                });

                // ==== ASSERTIONS ====
                const expectedResults: EngineRunResults = await readAndParseGoldfile(path.join(PATH_TO_GOLDFILES, goldfile));
                expect(engineResults).toEqual(expectedResults);
            });

            it('If Workspace has no root, throws an error', async () => {
                // ==== SETUP ====
                // Stub out the Workspace's getRoot method so it returns null.
                jest.spyOn(Workspace.prototype, 'getWorkspaceRoot').mockImplementation(() => {
                    return null;
                });

                // Instantiate an engine that will return no results.
                const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper({results: {}}));

                // ==== TESTED BEHAVIOR ====
                // Specify a rule. It doesn't matter which one.
                const desiredRuleNames: string[] = ['fakerule-thisshouldnotmatter'];
                // Specify files. It doesn't matter which.
                const workspaceFiles: string[] = [PATH_TO_EXAMPLE1];
                await expect(engine.runRules(desiredRuleNames, {
                    workspace: new Workspace(workspaceFiles)
                }))
                    // Expect the error message to mention the lack of a root directory
                    .rejects.toThrow('has no identifiable root directory');
            });

            it('Filters out results for unrequested rules', async () => {
                // ==== SETUP ====
                const fakeFlowTestResults: FlowTestExecutionResult = await readAndParseInputFile(path.join(PATH_TO_SAMPLE_RESULTS, 'non-empty-results.json'));

                // Instantiate the engine with a stubbed wrapper that will return the desired FlowTestExecutionResult.
                const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper(fakeFlowTestResults));

                // ==== TESTED BEHAVIOR ====
                // Specify only one of the rules, creating a scenario where the FlowTest result includes violations of rules
                // that weren't requested.
                const desiredRuleNames: string[] = ['PreventPassingUserDataIntoElementWithoutSharing'];
                // Specify every file in the workspace
                const workspaceFiles = [PATH_TO_SUBFLOW_TEST1, PATH_TO_INNER_SUBFLOW_EXAMPLE, PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2];
                const engineResults: EngineRunResults = await engine.runRules(desiredRuleNames, {
                    workspace: new Workspace(workspaceFiles)
                });

                // ==== ASSERTIONS ====
                const expectedResults: EngineRunResults = await readAndParseGoldfile(path.join(PATH_TO_GOLDFILES, 'filtered-by-rules.goldfile.json'));
                expect(engineResults).toEqual(expectedResults);
            });

            it('Filters out results for files outside of workspace', async () => {
                // ==== SETUP ====
                const fakeFlowTestResults: FlowTestExecutionResult = await readAndParseInputFile(path.join(PATH_TO_SAMPLE_RESULTS, 'non-empty-results.json'));

                // Instantiate the engine with a stubbed wrapper that will return the desired FlowTestExecutionResult.
                const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper(fakeFlowTestResults));

                // ==== TESTED BEHAVIOR ====
                // Specify all rules
                const desiredRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];
                // Specify only one of the files in the workspace, creating a scenario where the FlowTest result includes
                // violations from files that weren't requested
                const workspaceFiles = [PATH_TO_EXAMPLE2];
                const engineResults: EngineRunResults = await engine.runRules(desiredRuleNames, {
                    workspace: new Workspace(workspaceFiles)
                });

                // ==== ASSERTIONS ====
                const expectedResults: EngineRunResults = await readAndParseGoldfile(path.join(PATH_TO_GOLDFILES, 'filtered-by-workspace.goldfile.json'));
                expect(engineResults).toEqual(expectedResults);
            });
        });

        describe('#getEngineVersion', () => {
            it('Returns something resembling a Semantic Version', async () => {
                const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper());
                const version: string = await engine.getEngineVersion();

                expect(version).toMatch(/\d+\.\d+\.\d+.*/);
            });
        });
    });
});

class StubCommandWrapper implements FlowTestCommandWrapper {
    private readonly results: FlowTestExecutionResult;

    public constructor(results: FlowTestExecutionResult = {results: {}}) {
        this.results = results;
    }

    public runFlowTestRules(_dir: string, _fn: (percent: number) => void ): Promise<FlowTestExecutionResult> {
        return Promise.resolve(this.results);
    }
}