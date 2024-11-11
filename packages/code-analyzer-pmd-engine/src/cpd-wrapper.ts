import {createTempDir, JavaCommandExecutor} from "./utils";
import {LogLevel} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import fs from "node:fs";
import {getMessage} from "./messages";

const CPD_WRAPPER_JAVA_CLASS: string = "com.salesforce.sfca.cpdwrapper.CpdWrapper";
const CPD_WRAPPER_LIB_FOLDER: string = path.resolve(__dirname, '..', 'dist', 'pmd-cpd-wrappers', 'lib');

export type CpdRunInputData = {
    filesToScanPerLanguage: CpdLanguageToFilesMap,
    minimumTokens: number,
    skipDuplicateFiles: boolean
}
export type CpdLanguageToFilesMap = { // JSON.stringify doesn't support maps, so we can't just use Map<string, string[]>
    [language: string]: string[]
}

export type CpdRunResults = {
    [language: string]: CpdLanguageRunResults
}
export type CpdLanguageRunResults = {
    matches: CpdMatch[],
    processingErrors: CpdProcessingError[]
}
export type CpdMatch = {
    numTokensInBlock: number,
    numNonemptyLinesInBlock: number,
    numBlocks: number,
    blockLocations: CpdBlockLocation[]
}
export type CpdBlockLocation = {
    file: string,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number
}
export type CpdProcessingError = {
    file: string,
    message: string,
    detail: string
}

export class CpdWrapperInvoker {
    private readonly javaCommandExecutor: JavaCommandExecutor;
    private temporaryWorkingDir?: string;
    private emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(javaCommandExecutor: JavaCommandExecutor, emitLogEvent: (logLevel: LogLevel, message: string) => void) {
        this.javaCommandExecutor = javaCommandExecutor;
        this.emitLogEvent = emitLogEvent;
    }

    async invokeRunCommand(inputData: CpdRunInputData): Promise<CpdRunResults> {
        const tempDir: string = await this.getTemporaryWorkingDir();

        const inputFile: string = path.join(tempDir, 'cpdRunInput.json');
        await fs.promises.writeFile(inputFile, JSON.stringify(inputData), 'utf-8');

        const outputFile: string = path.join(tempDir, 'cpdRunOutput.json');

        const javaCmdArgs: string[] = [CPD_WRAPPER_JAVA_CLASS, 'run', inputFile, outputFile];
        const javaClassPaths: string[] = [
            path.join(CPD_WRAPPER_LIB_FOLDER, '*'),
        ];
        this.emitLogEvent(LogLevel.Fine, `Calling JAVA command with class path containing ${JSON.stringify(javaClassPaths)} and arguments: ${JSON.stringify(javaCmdArgs)}`);
        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths, (stdOutMsg: string) => {
            this.emitLogEvent(LogLevel.Fine, `[JAVA StdOut]: ${stdOutMsg}`);
        });

        try {
            const resultsFileContents: string = await fs.promises.readFile(outputFile, 'utf-8');
            return JSON.parse(resultsFileContents);
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('ErrorParsingOutputFile', outputFile, errMsg), {cause: err});
        }
    }

    private async getTemporaryWorkingDir(): Promise<string> {
        if (this.temporaryWorkingDir === undefined) {
            this.temporaryWorkingDir = await createTempDir();
        }
        return this.temporaryWorkingDir!;
    }
}