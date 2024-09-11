import {FlowTestWrapper} from '../../src/python/FlowTestWrapper';

describe('FlowTestWrapper', () => {


    describe('runFlowTestHelpCommand', () => {

        it('Works', async () => {
            const wrapper = new FlowTestWrapper('/Library/Frameworks/Python.framework/Versions/3.12/bin/python3');

            const s: string = await wrapper.wherePython();
            const s2 = await wrapper.runPythonVersion();
            const s3 = await wrapper.runPythonInfoScript();
            const s4 = await wrapper.runFlowTestHelpCommand();

            console.log(s);
            console.log(s2);
            console.log(s3);
            console.log(s4);
            expect(s).toContain('3.12');
            expect(s2).toContain('Python 3.12.4');
            expect(s4).toContain('usage: flowtest');
        });
    });
});