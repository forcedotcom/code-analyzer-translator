import path from 'node:path';
import {PythonCommandExecutor} from './PythonCommandExecutor';


export interface FlowTestCommandWrapper {
    getFlowTestHelpText(): Promise<string>;
}

const PATH_TO_PIPX_PYZ = path.join(__dirname, '..', '..', 'pipx.pyz');
const PATH_TO_FLOWTEST_ROOT = path.join(__dirname, '..', '..', 'FlowTest');

export class RunTimeFlowTestCommandWrapper implements FlowTestCommandWrapper {
    private readonly pythonCommandExecutor: PythonCommandExecutor;

    public constructor(pythonCommand: string) {
        this.pythonCommandExecutor = new PythonCommandExecutor(pythonCommand);
    }

    public async getFlowTestHelpText(): Promise<string> {
        const pythonArgs: string[] = [
            PATH_TO_PIPX_PYZ,
            'run',
            '--no-cache',
            '--spec',
            PATH_TO_FLOWTEST_ROOT,
            '--',
            'flowtest',
            '-h'
        ];

        let stdout: string = '';
        const processStdout = (stdoutMsg: string) => {
            stdout += stdoutMsg;
        }
        await this.pythonCommandExecutor.exec(pythonArgs, processStdout);
        return stdout;
    }
}