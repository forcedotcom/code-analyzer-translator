import * as tmp from "tmp";
import {promisify} from "node:util";
import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import {getMessage} from "./messages";
import path from "node:path";

tmp.setGracefulCleanup();
const tmpDirAsync = promisify((options: tmp.DirOptions, cb: tmp.DirCallback) => tmp.dir(options, cb));

/**
 * Creates a temporary directory that eventually cleans up after itself
 * @param parentTempDir - if supplied, then a temporary folder is placed directly underneath this parent folder.
 */
export async function createTempDir(parentTempDir?: string) : Promise<string> {
    return tmpDirAsync({dir: parentTempDir, keep: false, unsafeCleanup: true});
}


export class JavaCommandExecutor {
    private readonly javaCommand: string;
    private readonly stdoutCallback: (stdOutMsg: string) => void;

    constructor(javaCommand: string = 'java', stdoutCallback: (stdOutMsg: string) => void = (_m: string) => {}) {
        this.javaCommand = javaCommand;
        this.stdoutCallback = stdoutCallback;
    }

    async exec(javaCmdArgs: string[], javaClassPaths: string[] = []): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const stderrMessages: string[] = [];
            const allJavaArgs: string[] = javaClassPaths.length == 0 ? javaCmdArgs :
                ['-cp', javaClassPaths.join(path.delimiter), ... javaCmdArgs];
            const javaProcess: ChildProcessWithoutNullStreams = spawn('java', allJavaArgs);

            javaProcess.stdout.on('data', (data: Buffer) => {
                const msg: string = data.toString().trim();
                if(msg.length > 0) { // Not sure why stdout spits out empty lines, but we ignore them nonetheless
                    this.stdoutCallback(msg);
                }
            });
            javaProcess.stderr.on('data', (data: Buffer) => {
                stderrMessages.push(`${data.toString().trim()}`);
            });

            javaProcess.on('close', (code: number) => {
                if (code === 0) {
                    resolve();
                } else {
                    const javaCommandWithArgs: string = [this.javaCommand, ...allJavaArgs].join(' ');
                    const indentedStdErr: string = indent(stderrMessages.join('\n'), '    | ');
                    reject(new Error(getMessage('JavaCommandError', javaCommandWithArgs, code, indentedStdErr)));
                }
            });
        });
    }
}

export function indent(value: string, indentation = '    '): string {
    return indentation + value.replaceAll('\n', `\n${indentation}`);
}