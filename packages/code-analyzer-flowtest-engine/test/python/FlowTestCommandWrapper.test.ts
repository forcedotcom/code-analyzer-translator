import fs from 'node:fs/promises';
import path from 'node:path';
import {FlowTestExecutionResult, RunTimeFlowTestCommandWrapper} from "../../src/python/FlowTestCommandWrapper";
import {PythonCommandExecutor} from '../../src/python/PythonCommandExecutor';

const PYTHON_COMMAND = 'python3';
const PATH_TO_GOLDFILES = path.join(__dirname, '..', 'test-data', 'goldfiles', 'FlowTestCommandWrapper.test.ts');
const PATH_TO_WORKSPACES = path.join(__dirname, '..', 'test-data', 'example-workspaces');

describe('FlowTestCommandWrapper implementations', () => {
    describe('RunTimeFlowTestCommandWrapper', () => {
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
                    // The `counter` property is irrelevant to us, and causes problems across platforms. So delete it.
                    for (const queryName of Object.keys(results.results)) {
                        for (const queryResults of results.results[queryName]) {
                            delete (queryResults as any).counter;
                        }
                    }
                }, 30000);

                it('Correctly reads and parses results', async () => {
                    const goldfileName: string = 'results.goldfile.json';
                    const goldFileContents: string = (await fs.readFile(path.join(PATH_TO_GOLDFILES, goldfileName), {encoding: 'utf-8'}))
                        .replaceAll('"__PATH_TO_SUBFLOW_TEST1__"', JSON.stringify(path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows', 'subflow_test1.flow-meta.xml')))
                        .replaceAll('"__PATH_TO_INNER_SUBFLOW_EXAMPLE__"', JSON.stringify(path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows', 'inner_subflow_example.flow-meta.xml')))
                        .replaceAll('"__PATH_TO_EXAMPLE1__"', JSON.stringify(path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows', 'example1.flow-meta.xml')))
                        .replaceAll('"__PATH_TO_EXAMPLE2__"', JSON.stringify(path.join(PATH_TO_WORKSPACES, 'contains-multiple-flows', 'example2.flow-meta.xml')));

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
                    expect(completionPercentages).toEqual([0, 25, 50, 75]);
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