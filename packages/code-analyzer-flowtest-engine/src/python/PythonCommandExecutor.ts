import {ChildProcessWithoutNullStreams, spawn} from 'node:child_process';
import {getMessage} from "../messages";
import * as fs from 'node:fs';
import path from 'node:path';

type ProcessStdOutFn = (stdoutMsg: string) => void;
const NO_OP = () => {};

export class PythonCommandExecutor {
    private readonly pythonCommand: string;

    public constructor(pythonCommand: string) {
        this.pythonCommand = pythonCommand;
    }

    public async exec(pythonCmdArgs: string[], processStdout: ProcessStdOutFn = NO_OP): Promise<void> {
        return new Promise<void>((res, rej) => {
            const stderrMessages: string[] = [];

            const pythonProcess: ChildProcessWithoutNullStreams = spawn(this.pythonCommand, pythonCmdArgs);

            pythonProcess.stdout.on('data', (data: Buffer) => {
                const msg: string = data.toString().trim();
                if(msg.length > 0) { // Not sure why stdout spits out empty lines, but we ignore them nonetheless
                    msg.split("\n").map(line => processStdout(line));
                }
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                stderrMessages.push(`${data.toString().trim()}`);
            });

            pythonProcess.on('close', (code: number) => {
                if (code === 0) {
                    res();
                } else {
                    console.log(`stderr length is ${stderrMessages.length}`);
                    console.log(`msg1 is ${stderrMessages[0]}`);
                    const pythonCommandWithArgs: string = [this.pythonCommand, ...pythonCmdArgs].join(' ');
                    const joinedStderr = stderrMessages.join('\n');
                    const stderrBytes = new TextEncoder().encode(joinedStderr);
                    const stderrBytesArray: number[] = [];
                    for (const b of stderrBytes) {
                        stderrBytesArray.push(b);
                    }
                    fs.writeFileSync(path.join(__dirname, '..', '..', '..', '..', 'stderr-bytes.txt'), JSON.stringify(stderrBytesArray, null, 4));
                    const indentedStdErr: string = indent(stderrMessages.join('\n'), '    | ');
                    rej(new Error(getMessage('PythonCommandError', pythonCommandWithArgs, code, indentedStdErr)));
                }
            });
        });
    }
}

function indent(text: string, indentation: string): string {
    return text.replace(/^.?/gm, m => {
        console.log(`match is "${m}"`)
        return `${indentation}${m}`
    });
}