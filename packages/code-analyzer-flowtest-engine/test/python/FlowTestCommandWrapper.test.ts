import fs from 'node:fs';
import path from 'node:path';
import {FlowTestExecutionResult, RunTimeFlowTestCommandWrapper} from "../../src/python/FlowTestCommandWrapper";
import {PythonCommandExecutor} from '../../src/python/PythonCommandExecutor';
import os from "node:os";

const PYTHON_COMMAND = 'python3';
const PATH_TO_GOLDFILES = path.join(__dirname, '..', 'test-data', 'goldfiles', 'FlowTestCommandWrapper.test.ts');
const PATH_TO_MULTIPLE_FLOWS_WORKSPACE = path.resolve(__dirname, '..', 'test-data', 'example workspaces', 'contains-multiple-flows');
const PATH_TO_EXAMPLE1: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example1_containsWithoutSharingViolations.flow-meta.xml');
const PATH_TO_EXAMPLE2: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example2_containsWithSharingViolations.flow');

describe('FlowTestCommandWrapper implementations', () => {
    describe('RunTimeFlowTestCommandWrapper', () => {
        let tempLogFile: string;

        beforeAll(async() => {
            const tempFolder: string = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'engine-test'));
            tempLogFile = path.join(tempFolder, "flowtest_logfile.log");
        })

        describe('#runFlowTestRules()', () => {

            describe('Successful execution', () => {
                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PYTHON_COMMAND);
                let results: FlowTestExecutionResult;
                const completionPercentages: number[] = [];
                const statusProcessorFunction = (completionPercentage: number) => {
                    completionPercentages.push(completionPercentage);
                };

                beforeAll(async () => {
                    results = await wrapper.runFlowTestRules([PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2], tempLogFile, statusProcessorFunction);
                    // The `counter` property is irrelevant to us, and causes problems across platforms. So delete it.
                    for (const queryName of Object.keys(results.results)) {
                        for (const queryResults of results.results[queryName]) {
                            delete queryResults.counter;
                        }
                    }
                });

                it('Correctly reads and parses results', async () => {
                    const goldfileName: string = 'results.goldfile.json';
                    const goldFileContents: string = (await fs.promises.readFile(path.join(PATH_TO_GOLDFILES, goldfileName), {encoding: 'utf-8'}))
                        .replaceAll('"__PATH_TO_EXAMPLE1__"', JSON.stringify(PATH_TO_EXAMPLE1))
                        .replaceAll('"__PATH_TO_EXAMPLE2__"', JSON.stringify(PATH_TO_EXAMPLE2));

                    const expectedResults: FlowTestExecutionResult = JSON.parse(goldFileContents) as FlowTestExecutionResult;

                    // When a Jest equality check fails, the expected and actual objects are logged in their entirety.
                    // Since the results objects are so big here, we'll compare their sub-objects one-at-a-time to keep
                    // failure messages somewhat readable.
                    const expectedKeys: string[] = Object.keys(expectedResults.results);
                    expect(Object.keys(results.results)).toHaveLength(expectedKeys.length);
                    for (let i = 0; i < expectedKeys.length; i++) {
                        const key = expectedKeys[i];
                        const expectedValue = expectedResults.results[key];
                        expect(key in results.results).toEqual(true);
                        expect(results.results[key]).toHaveLength(expectedValue.length);
                        expect(results.results[key]).toEqual(expectedValue);
                    }


                });

                it('Correctly parses status updates from stdout', () => {
                    expect(completionPercentages).toEqual([0, 50]);
                });

                it('Generates no local log file', async () => {
                    const logFileMatcher = /\.flowtest_log_.+\.log/;
                    const logFiles = (await fs.promises.readdir('.')).filter(f => f.match(logFileMatcher));
                    expect(logFiles).toHaveLength(0);
                });

                it('Generates log file in designated location', async() => {
                    const contents: string = await fs.promises.readFile(tempLogFile, 'utf-8');
                    expect(contents.length).toBeGreaterThan(0);
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
                    jest.spyOn(fs.promises, 'readFile').mockImplementation(async (_file) => {
                        return fakeResults;
                    });

                    const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PYTHON_COMMAND);
                    await expect(wrapper.runFlowTestRules([PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2], tempLogFile, (_num: number) => {}))
                        .rejects
                        .toThrow(expectedMessage);
                });
            });
        });
    });
});