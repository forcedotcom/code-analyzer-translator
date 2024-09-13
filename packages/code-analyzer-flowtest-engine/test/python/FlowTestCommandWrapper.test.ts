import {sync} from 'which';
import {RunTimeFlowTestCommandWrapper} from "../../src/python/FlowTestCommandWrapper";

const PATH_TO_PYTHON_EXE: string = sync('python3');

describe('FlowTestCommandWrapper implementations', () => {
    describe('RunTimeFlowTestCommandWrapper', () => {
        // TODO: This is a temporary test serving as a proof-of-concept for bundling and invoking the FlowTest engine.
        //       Once the FlowTest engine's API has stabilized, this test should be removed and replaced with ones that
        //       interface with that API.
        it('Help text is properly retrieved', async () => {
            const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PATH_TO_PYTHON_EXE);

            const helpText: string = await wrapper.getFlowTestHelpText();

            expect(helpText).toContain('usage: flowtest');
        // For the sake of CI/CD, set the timeout to a truly absurd value.
        }, 30000);
    });
});