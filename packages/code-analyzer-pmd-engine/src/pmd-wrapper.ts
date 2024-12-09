import {createTempDir, JavaCommandExecutor} from "./utils";
import path from "node:path";
import fs from "node:fs";
import {getMessage} from "./messages";
import {LogLevel} from "@salesforce/code-analyzer-engine-api";

const PMD_WRAPPER_JAVA_CLASS: string = "com.salesforce.sfca.pmdwrapper.PmdWrapper";
const PMD_WRAPPER_LIB_FOLDER: string = path.resolve(__dirname, '..', 'dist', 'pmd-cpd-wrappers', 'lib');

export type PmdRuleInfo = {
    name: string,
    language: string,
    description: string,
    externalInfoUrl: string,
    ruleSet: string,
    priority: string,
    ruleSetFile: string,
    class: string
}

export type PmdResults = {
    violations: PmdViolation[]
    processingErrors: PmdProcessingError[]
}
export type PmdViolation = {
    rule: string
    message: string
    codeLocation: PmdCodeLocation
}
export type PmdCodeLocation = {
    file: string
    startLine: number
    startCol: number
    endLine: number
    endCol: number
}
export type PmdProcessingError = {
    file: string
    message: string
    detail: string
}

const STDOUT_PROGRESS_MARKER = '[Progress]';
const STDOUT_ERROR_MARKER = '[Error] ';

export class PmdWrapperInvoker {
    private readonly javaCommandExecutor: JavaCommandExecutor;
    private readonly userProvidedJavaClasspathEntries: string[];
    private temporaryWorkingDir?: string;
    private emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(javaCommandExecutor: JavaCommandExecutor, userProvidedJavaClasspathEntries: string[], emitLogEvent: (logLevel: LogLevel, message: string) => void) {
        this.javaCommandExecutor = javaCommandExecutor;
        this.userProvidedJavaClasspathEntries = userProvidedJavaClasspathEntries;
        this.emitLogEvent = emitLogEvent;
    }

    async invokeDescribeCommand(customRulesets: string[], pmdRuleLanguages: string[], emitProgress: (percComplete: number) => void): Promise<PmdRuleInfo[]> {
        const tempDir: string = await this.getTemporaryWorkingDir();
        const pmdRulesOutputFile: string = path.join(tempDir, 'ruleInfo.json');
        const customRulesetsListFile: string = path.join(tempDir, 'customRulesetsList.txt');
        await fs.promises.writeFile(customRulesetsListFile, customRulesets.join('\n'), 'utf-8');
        emitProgress(10);

        const javaCmdArgs: string[] = [PMD_WRAPPER_JAVA_CLASS, 'describe', pmdRulesOutputFile, customRulesetsListFile, pmdRuleLanguages.join(',')];
        const javaClassPaths: string[] = [
            path.join(PMD_WRAPPER_LIB_FOLDER, '*'),
            ... this.userProvidedJavaClasspathEntries.map(toJavaClasspathEntry)
        ];
        this.emitLogEvent(LogLevel.Fine, `Calling JAVA command with class path containing ${JSON.stringify(javaClassPaths)} and arguments: ${JSON.stringify(javaCmdArgs)}`);
        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths, (stdOutMsg) => {
            if (stdOutMsg.startsWith(STDOUT_ERROR_MARKER)) {
                const errorMessage: string = stdOutMsg.slice(STDOUT_ERROR_MARKER.length);
                throw new Error(errorMessage);
            } else {
                this.emitLogEvent(LogLevel.Fine, `[JAVA StdOut]: ${stdOutMsg}`)
            }
        });
        emitProgress(80);

        try {
            const pmdRulesFileContents: string = await fs.promises.readFile(pmdRulesOutputFile, 'utf-8');
            emitProgress(90);
            const pmdRuleInfoList: PmdRuleInfo[] = JSON.parse(pmdRulesFileContents);
            emitProgress(100);
            return pmdRuleInfoList;
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('ErrorParsingOutputFile', pmdRulesOutputFile, errMsg), {cause: err});
        }
    }

    async invokeRunCommand(pmdRuleInfoList: PmdRuleInfo[], filesToScan: string[], emitProgress: (percComplete: number) => void): Promise<PmdResults> {
        const tempDir: string = await this.getTemporaryWorkingDir();
        emitProgress(2);

        const ruleSetFileContents: string = createRuleSetFileContentsFor(pmdRuleInfoList);
        const ruleSetInputFile: string = path.join(tempDir, 'ruleSetInputFile.xml');
        await fs.promises.writeFile(ruleSetInputFile, ruleSetFileContents, 'utf-8');
        emitProgress(6);

        const filesToScanInputFile: string = path.join(tempDir, 'filesToScanInputFile.txt');
        await fs.promises.writeFile(filesToScanInputFile, filesToScan.join('\n'), 'utf-8');
        emitProgress(10);

        const resultsOutputFile: string = path.join(tempDir, 'resultsFile.json');
        const javaCmdArgs: string[] = [PMD_WRAPPER_JAVA_CLASS, 'run', ruleSetInputFile, filesToScanInputFile, resultsOutputFile];
        const javaClassPaths: string[] = [
            path.join(PMD_WRAPPER_LIB_FOLDER, '*'),
            ... this.userProvidedJavaClasspathEntries.map(toJavaClasspathEntry)
        ];
        this.emitLogEvent(LogLevel.Fine, `Calling JAVA command with class path containing ${JSON.stringify(javaClassPaths)} and arguments: ${JSON.stringify(javaCmdArgs)}`);
        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths, (stdOutMsg: string) => {
            if (stdOutMsg.startsWith(STDOUT_PROGRESS_MARKER)) {
                const parts: string[] = stdOutMsg.slice(STDOUT_PROGRESS_MARKER.length).split('::');
                const numFilesProcessed: number = parseInt(parts[0]);
                const totalNumFiles: number = parseInt(parts[1]);
                emitProgress(10 + (80 * numFilesProcessed / totalNumFiles));
            } else {
                this.emitLogEvent(LogLevel.Fine, `[JAVA StdOut]: ${stdOutMsg}`);
            }
        });

        try {
            const resultsFileContents: string = await fs.promises.readFile(resultsOutputFile, 'utf-8');
            emitProgress(95);

            const pmdResults:PmdResults = JSON.parse(resultsFileContents);
            emitProgress(100);
            return pmdResults;

        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('ErrorParsingOutputFile', resultsOutputFile, errMsg), {cause: err});
        }
    }

    private async getTemporaryWorkingDir(): Promise<string> {
        if (this.temporaryWorkingDir === undefined) {
            this.temporaryWorkingDir = await createTempDir();
        }
        return this.temporaryWorkingDir!;
    }
}

function createRuleSetFileContentsFor(pmdRuleInfoList: PmdRuleInfo[]): string {
    const ruleRefs: string[] = pmdRuleInfoList.map(pmdRuleInfo => `    <rule ref="${pmdRuleInfo.ruleSetFile}/${pmdRuleInfo.name}" />`);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<ruleset name="Ruleset for Salesforce Code Analyzer"\n' +
        '    xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"\n' +
        '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
        '    xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd">\n' +
        '    <description>Rules to Run for Salesforce Code Analyzer</description>\n' +
        ruleRefs.join('\n') + '\n' +
        '</ruleset>';
}

function toJavaClasspathEntry(jarfileOrFolder: string): string {
    return jarfileOrFolder.toLowerCase().endsWith(".jar") ? jarfileOrFolder : jarfileOrFolder + path.sep + "*";
}