import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {createTempDir, JavaCommandExecutor} from "./utils";
import path from "node:path";
import * as fs from "node:fs";
import {getMessage} from "./messages";
import {extensionToPmdLanguage, PmdLanguage} from "./constants";

type PmdRuleInfo = {
    name: string,
    language: string,
    message: string,
    externalInfoUrl: string,
    ruleSet: string,
    priority: string,
    ruleSetFile: string,
    class: string
}

export class PmdEngine extends Engine {
    static readonly NAME: string = "pmd";

    // TODO: Eventually these will be configurable
    private readonly availableLanguages: PmdLanguage[] = [PmdLanguage.APEX, PmdLanguage.VISUALFORCE];

    private pmdRuleInfoCache: Map<string, Map<string, PmdRuleInfo>> = new Map();

    getName(): string {
        return PmdEngine.NAME;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const pmdRuleMap: Map<string, PmdRuleInfo> = await this.getPmdRuleMap(describeOptions.workspace);
        const ruleDescriptions: RuleDescription[] = [];
        for (const pmdRuleInfo of pmdRuleMap.values()) {
            ruleDescriptions.push(toRuleDescription(pmdRuleInfo));
        }
        return ruleDescriptions.sort((rd1, rd2) => rd1.name.localeCompare(rd2.name));
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitLogEvent(LogLevel.Warn, "The runRules method of the 'pmd' engine has not been implemented yet. Simply returning zero violations for now.");
        return {
            violations: []
        };
    }

    private async getPmdRuleMap(workspace?: Workspace): Promise<Map<string, PmdRuleInfo>> {
        const cacheKey: string = workspace? workspace.getWorkspaceId() : process.cwd();
        if (this.pmdRuleInfoCache.has(cacheKey)) {
            return this.pmdRuleInfoCache.get(cacheKey)!;
        }

        const relevantLanguages: PmdLanguage[] = await this.getRelevantLanguages(workspace);

        const tempDir: string = await createTempDir();
        const pmdRulesFile: string = path.join(tempDir, 'ruleInfo.json');
        await callPmdWrapperDescribeCommand(pmdRulesFile, relevantLanguages,
            (msg: string) => this.emitLogEvent(LogLevel.Fine, `[describeRules]: ${msg}`));

        let pmdRuleInfoList: PmdRuleInfo[];
        try {
            const pmdRulesFileContents: string = await fs.promises.readFile(pmdRulesFile, 'utf-8');
            pmdRuleInfoList = JSON.parse(pmdRulesFileContents);
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('ErrorParsingRuleInfoFile', pmdRulesFile, errMsg), {cause: err});
        }

        const pmdRuleMap: Map<string, PmdRuleInfo> = new Map();
        for (const pmdRuleInfo of pmdRuleInfoList) {
            pmdRuleMap.set(pmdRuleInfo.name, pmdRuleInfo);
        }
        this.pmdRuleInfoCache.set(cacheKey, pmdRuleMap);
        return pmdRuleMap;
    }

    private async getRelevantLanguages(workspace?: Workspace): Promise<PmdLanguage[]> {
        if (!workspace) {
            return this.availableLanguages;
        }
        const relevantLanguagesSet: Set<PmdLanguage> = new Set();
        for (const file of await workspace.getExpandedFiles()) {
            const fileExt: string = path.extname(file).toLowerCase();
            const pmdLang: PmdLanguage | undefined = extensionToPmdLanguage[fileExt];
            if (pmdLang && this.availableLanguages.includes(pmdLang)) {
                relevantLanguagesSet.add(extensionToPmdLanguage[fileExt]);
            }
        }
        return [...relevantLanguagesSet].sort();
    }
}

async function callPmdWrapperDescribeCommand(outFile: string, languages: PmdLanguage[], stdoutCallback: (str: string) => void): Promise<void> {
    const javaClassPaths: string[] = [
        path.resolve(__dirname, '..', 'dist', 'pmd-wrapper', 'lib', '*'),
    ];
    const mainClass: string = "com.salesforce.sfca.pmdwrapper.PmdWrapper";
    const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor(); // TODO: Once java_command is configurable, then pass it in
    await javaCommandExecutor.exec([mainClass, 'describe', outFile, languages.join(',')], javaClassPaths, stdoutCallback);
}

function toRuleDescription(pmdRule: PmdRuleInfo): RuleDescription {
    return {
        name: pmdRule.name,
        severityLevel: toSeverityLevel(pmdRule.priority),
        type: RuleType.Standard,
        tags: ['Recommended', pmdRule.ruleSet.replace(' ', ''), pmdRule.language + "Language"],
        description: pmdRule.message,
        resourceUrls: [pmdRule.externalInfoUrl] // TODO: Eventually we'll want to add in well architected links
    };
}

/* istanbul ignore next */
function toSeverityLevel(pmdRulePriority: string): SeverityLevel {
    if (pmdRulePriority === "High") {
        return SeverityLevel.High;
    } else if (pmdRulePriority === "Medium") {
        return SeverityLevel.Moderate;
    } else if (pmdRulePriority === "Low") {
        return SeverityLevel.Low;

    // The following don't seem to show up in the standard rules, but are documented as options available to users
    } else if (pmdRulePriority === "Medium High") {
        return SeverityLevel.Moderate;
    } else if (pmdRulePriority === "Medium Low") {
        return SeverityLevel.Low;
    }

    throw new Error("Unsupported priority: " + pmdRulePriority);
}