import * as tmp from "tmp";
import {promisify} from "node:util";
import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import {getMessage} from "./messages";
import path from "node:path";
import {Workspace} from "@salesforce/code-analyzer-engine-api";
import {Language} from "./constants";

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
    private readonly selectedLanguages: Set<Language>;
    private readonly extensionToLanguageMap: Map<string, Language>;

    private relevantLanguageToFilesMap?: Map<Language, string[]>;

    constructor(workspace: Workspace | undefined, selectedLanguages: Language[], extensionToLanguageMap: Map<string, Language>) {
        this.workspace = workspace;
        this.selectedLanguages = new Set(selectedLanguages);
        this.extensionToLanguageMap = extensionToLanguageMap;
    }

    getWorkspace(): Workspace | undefined {
        return this.workspace;
    }

    async getRelevantLanguages(): Promise<Language[]> {
        return [...(await this.getRelevantLanguageToFilesMap()).keys()].sort();
    }

    async getRelevantLanguageToFilesMap(): Promise<Map<Language, string[]>> {
        if (this.relevantLanguageToFilesMap) {
            return this.relevantLanguageToFilesMap;
        }
        if (!this.workspace) {
            this.relevantLanguageToFilesMap = new Map([...this.selectedLanguages].map(lang => [lang, []]));
            return this.relevantLanguageToFilesMap;
        }

        const files: string[] = await this.workspace.getExpandedFiles();
        this.relevantLanguageToFilesMap = new Map<Language, string[]>();

        for (const file of files) {
            const fileExt: string = path.extname(file).toLowerCase();
            const lang: Language | undefined = this.extensionToLanguageMap.get(fileExt);
            if (!lang || !this.selectedLanguages.has(lang)) {
                continue;
            }
            if(!this.relevantLanguageToFilesMap.has(lang)) {
                this.relevantLanguageToFilesMap.set(lang,[]);
            }
            this.relevantLanguageToFilesMap.get(lang)!.push(file);
        }
        return this.relevantLanguageToFilesMap;
    }
}

export function indent(value: string, indentation = '    '): string {
    return indentation + value.replaceAll('\n', `\n${indentation}`);
}

// Converts our file_extensions map which associates languages to file extensions to a map that associates
// file extensions to languages. This will speed up processing later, which is why we do this conversion.
export function toExtensionsToLanguageMap(langToFileExtsMap:  Record<Language, string[]>): Map<string, Language> {
    const extensionsToLanguageMap: Map<string, Language> = new Map();
    for (const language of Object.keys(langToFileExtsMap)) {
        for (const fileExt of langToFileExtsMap[language as Language]) {
            extensionsToLanguageMap.set(fileExt, language as Language);
        }
    }
    return extensionsToLanguageMap;
}