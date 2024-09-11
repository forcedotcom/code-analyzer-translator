import {ChildProcessWithoutNullStreams, spawn} from 'node:child_process';
import {getMessage} from '../messages';


export class PythonCommandExecutor {
    private readonly pythonCommand: string;

    public constructor(pythonCommand: string) {
        this.pythonCommand = pythonCommand;
    }

    public async wherePython(processStdOut: (stdout: string) => void): Promise<void> {
        return new Promise<void>((res, rej) => {
            const stderrMessages: string[] = [];
            const pythonProcess: ChildProcessWithoutNullStreams = spawn('which', ['python3']);

            pythonProcess.stdout.on('data', (data: Buffer) => {
                const msg: string = data.toString().trim();
                if (msg.length > 0) {
                    msg.split("\n").map(line => processStdOut(line));
                }
            });
            pythonProcess.stderr.on('data', (data: Buffer) => {
                stderrMessages.push(`${data.toString().trim()}`);
            });
            pythonProcess.on('close', (code: number) => {
                if (code === 0) {
                    res();
                } else {
                    rej(stderrMessages.join('\n'));
                }
            });
        });
    }

    public async exec(pythonCmdArgs: string[], pythonPaths: string[], processStdOut: (stdout: string) => void): Promise<void> {
        return new Promise<void>((res, rej) => {
            const stderrMessages: string[] = [];
            const allPythonPaths: string = [
                (process.env.PYTHONPATH ?? ''),
                ...pythonPaths
            ].join(':');
            console.log(allPythonPaths);
            const pythonProcess: ChildProcessWithoutNullStreams = spawn(this.pythonCommand, pythonCmdArgs, {
                env: {
                    PYTHONPATH: allPythonPaths
                }
            });

            pythonProcess.stdout.on('data', (data: Buffer) => {
                const msg: string = data.toString().trim();
                if (msg.length > 0) {
                    msg.split("\n").map(line => processStdOut(line));
                }
            });
            pythonProcess.stderr.on('data', (data: Buffer) => {
                stderrMessages.push(`${data.toString().trim()}`);
            });
            pythonProcess.on('close', (code: number) => {
                if (code === 0) {
                    res();
                } else {
                    const commandWithArgs: string = [this.pythonCommand, ...pythonCmdArgs].join(' ');
                    const indentedStdErr: string = indent(stderrMessages.join('\n'), '    | ');
                    rej(new Error(getMessage('PythonCommandError', commandWithArgs, code, indentedStdErr)));
                }
            });
        });
    }
}

export function indent(text: string, indentation: string = '    '): string {
    return text.replace(/^.+/gm, m => m.length > 0 ? `${indentation}${m}` : m);
}