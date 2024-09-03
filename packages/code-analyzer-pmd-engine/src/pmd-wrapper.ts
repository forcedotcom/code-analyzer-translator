import {createTempDir, JavaCommandExecutor} from "./utils";
import {PmdLanguage} from "./constants";
import path from "node:path";
import fs from "node:fs";
import {getMessage} from "./messages";

const PMD_WRAPPER_JAVA_CLASS: string = "com.salesforce.sfca.pmdwrapper.PmdWrapper";
const PMD_WRAPPER_LIB_FOLDER: string = path.resolve(__dirname, '..', 'dist', 'pmd-wrapper', 'lib');

export type PmdRuleInfo = {
    name: string,
    language: string,
    message: string,
    externalInfoUrl: string,
    ruleSet: string,
    priority: string,
    ruleSetFile: string,
    class: string
}

export type PmdResults = {
    files: PmdFileResult[]
    processingErrors: PmdProcessingError[]
}
export type PmdFileResult = {
    filename: string
    violations: PmdViolation[]
}
export type PmdViolation = {
    beginline: number
    begincolumn: number
    endline: number
    endcolumn: number
    description: string
    rule: string
}
export type PmdProcessingError = {
    filename: string
    message: string
    detail: string
}

export class PmdWrapperInvoker {
    private readonly javaCommandExecutor: JavaCommandExecutor;
    private temporaryWorkingDir?: string;

    constructor(javaCommandExecutor: JavaCommandExecutor) {
        // const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor(); // TODO: Once java_command is configurable, then pass it in
        this.javaCommandExecutor = javaCommandExecutor;
    }

    async invokeDescribeCommand(languages: PmdLanguage[]): Promise<PmdRuleInfo[]> {
        const pmdRulesOutputFile: string = path.join(await this.getTemporaryWorkingDir(), 'ruleInfo.json');

        const javaCmdArgs: string[] = [PMD_WRAPPER_JAVA_CLASS, 'describe', pmdRulesOutputFile, languages.join(',')];
        const javaClassPaths: string[] = [
            path.join(PMD_WRAPPER_LIB_FOLDER, '*'),
        ];
        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths);

        try {
            const pmdRulesFileContents: string = await fs.promises.readFile(pmdRulesOutputFile, 'utf-8');
            return JSON.parse(pmdRulesFileContents);
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('ErrorParsingPmdWrapperOutputFile', pmdRulesOutputFile, errMsg), {cause: err});
        }
    }

    async invokeRunCommand(pmdRuleInfoList: PmdRuleInfo[], filesToScan: string[]): Promise<PmdResults> {
        const tempDir: string = await this.getTemporaryWorkingDir();

        const ruleSetFileContents: string = createRuleSetFileContentsFor(pmdRuleInfoList);
        const ruleSetInputFile: string = path.join(tempDir, 'ruleSetInputFile.xml');
        await fs.promises.writeFile(ruleSetInputFile, ruleSetFileContents, 'utf-8');

        const filesToScanInputFile: string = path.join(tempDir, 'filesToScanInputFile.txt');
        await fs.promises.writeFile(filesToScanInputFile, filesToScan.join('\n'), 'utf-8');

        const resultsOutputFile: string = path.join(tempDir, 'resultsFile.json');

        const javaCmdArgs: string[] = [PMD_WRAPPER_JAVA_CLASS, 'run', ruleSetInputFile, filesToScanInputFile, resultsOutputFile];
        const javaClassPaths: string[] = [
            path.join(PMD_WRAPPER_LIB_FOLDER, '*'),
        ];
        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths);

        try {
            const resultsFileContents: string = await fs.promises.readFile(resultsOutputFile, 'utf-8');
            return JSON.parse(resultsFileContents);
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('ErrorParsingPmdWrapperOutputFile', resultsOutputFile, errMsg), {cause: err});
        }
    }

    async getTemporaryWorkingDir(): Promise<string> {
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