import fs from 'node:fs/promises';
import path from 'node:path';
import {FlowTestExecutionResult, FlowTestRuleDescriptor, RunTimeFlowTestCommandWrapper} from "../../src/python/FlowTestCommandWrapper";
import {PythonCommandExecutor} from '../../src/python/PythonCommandExecutor';

const PYTHON_COMMAND = 'python3';
const PATH_TO_GOLDFILES = path.join(__dirname, '..', 'test-data', 'goldfiles', 'FlowTestCommandWrapper.test.ts');
const PATH_TO_WORKSPACES = path.join(__dirname, '..', 'test-data', 'example-workspaces');

describe('FlowTestCommandWrapper implementations', () => {
    describe('RunTimeFlowTestCommandWrapper', () => {
        describe('#getFlowTestRuleDescriptions()', () => {
            afterEach(() => {
                jest.restoreAllMocks();
            })
            it('Returns valid, well-formed rule descriptions', async () => {
                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PYTHON_COMMAND);

                const rules: FlowTestRuleDescriptor[] = await wrapper.getFlowTestRuleDescriptions();

                const expectedRules: FlowTestRuleDescriptor[] = JSON.parse(await fs.readFile(
                    path.join(PATH_TO_GOLDFILES, 'catalog.goldfile.json'),
                    {encoding: 'utf-8'}
                )) as FlowTestRuleDescriptor[];

                expect(rules).toEqual(expectedRules);
            // For the sake of CI/CD, set the timeout to a truly absurd value.
            }, 60000);

            it('When output is unparseable, an informative error is thrown', async () => {
                jest.spyOn(PythonCommandExecutor.prototype, 'exec').mockImplementation(async (_args, processStdout) => {
                    processStdout!('This will not parse as valid JSON');
                });

                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PYTHON_COMMAND);

                await expect(wrapper.getFlowTestRuleDescriptions())
                    .rejects
                    .toThrow('Could not parse rule descriptions from FlowTest output: This will not parse as valid JSON');
            // For the sake of CI/CD, set the timeout to a truly absurd value.
            }, 30000);
        });

        describe('#runFlowTestRules()', () => {

            describe('Successful execution', () => {
                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PYTHON_COMMAND);
                let results: FlowTestExecutionResult;
                const completionPercentages: number[] = [];
                const statusProcessorFunction = (completionPercentage: number) => {
                    completionPercentages.push(completionPercentage);
                };

                beforeAll(async () => {
                    results = await wrapper.runFlowTestRules(path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows'), statusProcessorFunction);
                }, 30000);

                it('Correctly reads and parses results', async () => {
                    const goldFileContents: string = (await fs.readFile(path.join(PATH_TO_GOLDFILES, 'results.goldfile.json'), {encoding: 'utf-8'}))
                        .replaceAll('__PATH_TO_SUBFLOW_TEST1__', path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows', 'subflow_test1.flow-meta.xml'))
                        .replaceAll('__PATH_TO_INNER_SUBFLOW_EXAMPLE__', path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows', 'inner_subflow_example.flow-meta.xml'))
                        .replaceAll('__PATH_TO_EXAMPLE__', path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows', 'example.flow-meta.xml'));

                    const expectedResults: FlowTestExecutionResult = JSON.parse(goldFileContents) as FlowTestExecutionResult;

                    // When a Jest equality check fails, the expected and actual objects are logged in their entirety.
                    // Since the results objects are so big here, we'll compare their sub-objects one-at-a-time to keep
                    // failure messages somewhat readable.
                    const expectedKeys: string[] = Object.keys(expectedResults.results);
                    expect(Object.keys(results.results)).toHaveLength(expectedKeys.length);
                    for (let i = 0; i < expectedKeys.length; i++) {
                        const key = expectedKeys[i];
                        const expectedValue = expectedResults.results[key];
                        expect(results.results[key]).toHaveLength(expectedValue.length);
                        expect(results.results[key]).toEqual(expectedValue);
                    }
                });

                it('Correctly parses status updates from stdout', () => {
                    expect(completionPercentages).toEqual([0, 33.3, 66.7]);
                });
            });

            describe('Failure Modes', () => {
                afterEach(() => {
                    jest.restoreAllMocks();
                });

                it.each([
                    {problem: 'an unparseable JSON', fakeResults: '{asdfasdfe,;]eawe}', expectedMessage: 'Results file contents are not a valid JSON'},
                    {problem: 'a malformed JSON', fakeResults: '{"undesiredProperty": "beep"}', expectedMessage: 'Could not parse results from '}
                ])('When execution produces $problem, an informative error is thrown', async ({fakeResults, expectedMessage}) => {
                    // Stub out the underlying Exec method to fake a success without actually invoking FlowTest, since
                    // we don't care about the actual results.
                    jest.spyOn(PythonCommandExecutor.prototype, 'exec').mockImplementation(async (_args, _processStdout) => {
                        return Promise.resolve();
                    });

                    // Stub out the underlying ReadFile method to return the specified invalid results
                    jest.spyOn(fs, 'readFile').mockImplementation(async (_file) => {
                        return fakeResults;
                    });

                    const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PYTHON_COMMAND);
                    await expect(wrapper.runFlowTestRules(path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows'), (_num) => {}))
                        .rejects
                        .toThrow(expectedMessage);
                });
            });
        });
    });
});