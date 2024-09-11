import path from 'node:path';
import {PythonCommandExecutor} from "./PythonCommandExecutor";

const PATH_TO_MODULE = path.resolve(__dirname, '..', '..', 'flowtest');
const PATH_TO_LIB = path.resolve(__dirname, '..', '..', 'flowtest', 'lib');


export class FlowTestWrapper {
    private pythonExecutor: PythonCommandExecutor;

    public constructor(pythonCommand: string) {
        this.pythonExecutor = new PythonCommandExecutor(pythonCommand);
    }

    public async wherePython(): Promise<string> {
        let res: string = '';

        await this.pythonExecutor.wherePython((stdout) => {
            res += stdout;
        });

        return res;
    }

    public async runPythonVersion(): Promise<string> {
        const pythonPaths = [PATH_TO_MODULE, PATH_TO_LIB];

        const args: string[] = ['--version'];

        let res = '';

        await this.pythonExecutor.exec(args, pythonPaths, (stdout) => {
            res += stdout;
        });

        return res;
    }

    public async runPythonInfoScript(): Promise<string> {
        const pythonPaths = [PATH_TO_MODULE, PATH_TO_LIB];
        const args: string[] = [path.resolve(__dirname, '..', '..', 'pyinfo.py')];

        let res = '';

        await this.pythonExecutor.exec(args, pythonPaths, (stdout) => {
            res += stdout;
        });

        return res;
    }

    public async runFlowTestHelpCommand(): Promise<string> {
        const pythonPaths = [PATH_TO_MODULE, PATH_TO_LIB];

        const args: string[] = ['-m', 'flowtest', '-h'];

        let res = '';

        await this.pythonExecutor.exec(args, pythonPaths, (stdout) => {
            res += stdout;
        });

        return res;
    }
}