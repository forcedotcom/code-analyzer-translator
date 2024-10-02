import * as fsp from 'node:fs/promises';
import path from 'node:path';
import {FlowTestRuleDescriptor, RunTimeFlowTestCommandWrapper} from "../../src/python/FlowTestCommandWrapper";
import {PythonCommandExecutor} from '../../src/python/PythonCommandExecutor';

describe('FlowTestCommandWrapper implementations', () => {
    describe('RunTimeFlowTestCommandWrapper', () => {
        describe('#getFlowTestRuleDescriptions()', () => {
            afterEach(() => {
                jest.restoreAllMocks();
            })
            it('Returns valid, well-formed rule descriptions', async () => {
                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper('python3');

                const rules: FlowTestRuleDescriptor[] = await wrapper.getFlowTestRuleDescriptions();

                const expectedRules: FlowTestRuleDescriptor[] = JSON.parse(await fsp.readFile(
                    path.join(__dirname, '..', 'test-data', 'goldfiles', 'FlowTestCommandWrapper.test.ts', 'catalog.goldfile.json'),
                    {encoding: 'utf-8'}
                )) as FlowTestRuleDescriptor[];

                expect(rules).toEqual(expectedRules);
            // For the sake of CI/CD, set the timeout to a truly absurd value.
            }, 60000);

            it('When output is unparseable, an informative error is thrown', async () => {
                jest.spyOn(PythonCommandExecutor.prototype, 'exec').mockImplementation(async (_args, processStdout) => {
                    processStdout!('This will not parse as valid JSON');
                });

                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper('python3');

                await expect(wrapper.getFlowTestRuleDescriptions())
                    .rejects
                    .toThrow('Could not parse rule descriptions from FlowTest output: This will not parse as valid JSON');
            // For the sake of CI/CD, set the timeout to a truly absurd value.
            }, 30000);
        });
    });
});