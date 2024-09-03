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

export class PmdWrapper {
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

    async getTemporaryWorkingDir(): Promise<string> {
        if (this.temporaryWorkingDir === undefined) {
            this.temporaryWorkingDir = await createTempDir();
        }
        return this.temporaryWorkingDir!;
    }
}