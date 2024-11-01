import * as tmp from "tmp";
import {promisify} from "node:util";
import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import {getMessage} from "./messages";
import path from "node:path";
import {Workspace} from "@salesforce/code-analyzer-engine-api";
import {extensionToLanguageId, LanguageId} from "./constants";

tmp.setGracefulCleanup();
const tmpDirAsync = promisify((options: tmp.DirOptions, cb: tmp.DirCallback) => tmp.dir(options, cb));

/**
 * Creates a temporary directory that eventually cleans up after itself
 * @param parentTempDir - if supplied, then a temporary folder is placed directly underneath this parent folder.
 */
export async function createTempDir(parentTempDir?: string) : Promise<string> {
    return tmpDirAsync({dir: parentTempDir, keep: false, unsafeCleanup: true});
}

type ProcessStdOutFcn = (stdOutMsg: string) => void;
const NO_OP = () => {};

export class JavaCommandExecutor {
    private readonly javaCommand: string;

    constructor(javaCommand: string = 'java') {
        this.javaCommand = javaCommand;
    }

    async exec(javaCmdArgs: string[], javaClassPaths: string[] = [], processStdOut: ProcessStdOutFcn = NO_OP): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const stderrMessages: string[] = [];
            const allJavaArgs: string[] = javaClassPaths.length == 0 ? javaCmdArgs :
                ['-cp', javaClassPaths.join(path.delimiter), ... javaCmdArgs];
            const javaProcess: ChildProcessWithoutNullStreams = spawn('java', allJavaArgs);

            javaProcess.stdout.on('data', (data: Buffer) => {
                const msg: string = data.toString().trim();
                if(msg.length > 0) { // Not sure why stdout spits out empty lines, but we ignore them nonetheless
                    try {
                        msg.split("\n").map(line => processStdOut(line));
                    } catch (err) {
                        reject(err);
                    }
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

// noinspection JSMismatchedCollectionQueryUpdate (IntelliJ is confused about how I am setting the private values, suppressing warnings)
export class WorkspaceLiaison {
    private readonly workspace?: Workspace;
    private readonly selectedLanguages: LanguageId[];

    private relevantLanguages?: LanguageId[];
    private relevantFiles?: string[];

    constructor(workspace: Workspace | undefined, selectedLanguages: LanguageId[]) {
        this.workspace = workspace;
        this.selectedLanguages = selectedLanguages;
    }

    getWorkspace(): Workspace | undefined {
        return this.workspace;
    }

    async getRelevantFiles(): Promise<string[]> {
        if (this.relevantFiles === undefined) {
            await this.processWorkspace();
        }
        return this.relevantFiles!;
    }

    async getRelevantLanguages(): Promise<LanguageId[]> {
        if (this.relevantLanguages === undefined) {
            await this.processWorkspace();
        }
        return this.relevantLanguages!;
    }

    private async processWorkspace(): Promise<void> {
        this.relevantFiles = [];
        if (!this.workspace) {
            this.relevantLanguages = [... this.selectedLanguages].sort();
            return;
        }

        const relevantLanguagesSet: Set<LanguageId> = new Set();
        for (const file of await this.workspace.getExpandedFiles()) {
            const fileExt: string = path.extname(file).toLowerCase();
            const lang: LanguageId | undefined = extensionToLanguageId[fileExt];
            if (lang && this.selectedLanguages.includes(lang)) {
                this.relevantFiles.push(file);
                relevantLanguagesSet.add(lang);
            }
        }
        this.relevantLanguages = [...relevantLanguagesSet].sort();
    }
}

export function indent(value: string, indentation = '    '): string {
    return indentation + value.replaceAll('\n', `\n${indentation}`);
}