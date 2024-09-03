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
import {JavaCommandExecutor} from "./utils";
import path from "node:path";
import {extensionToPmdLanguage, PmdLanguage} from "./constants";
import {PmdRuleInfo, PmdWrapper} from "./pmd-wrapper";

export class PmdEngine extends Engine {
    static readonly NAME: string = "pmd";

    private readonly pmdWrapper: PmdWrapper;
    private readonly availableLanguages: PmdLanguage[];

    private pmdWorkspaceLiaisonCache: Map<string, PmdWorkspaceLiaison> = new Map();
    private pmdRuleInfoListCache: Map<string, PmdRuleInfo[]> = new Map();

    constructor() {
        super();
        const javaCmd: string = 'java'; // TODO: Will be configurable soon
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor(javaCmd, stdOutMsg =>
            this.emitLogEvent(LogLevel.Fine, `[JAVA StdOut]: ${stdOutMsg}`));
        this.pmdWrapper = new PmdWrapper(javaCommandExecutor);
        this.availableLanguages = [PmdLanguage.APEX, PmdLanguage.VISUALFORCE]; // TODO: Will be configurable soon
    }

    getName(): string {
        return PmdEngine.NAME;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspaceLiaison: PmdWorkspaceLiaison = this.getPmdWorkspaceLiaison(describeOptions.workspace);
        const ruleInfoList: PmdRuleInfo[] = await this.getPmdRuleInfoList(workspaceLiaison);
        const ruleDescriptions: RuleDescription[] = ruleInfoList.map(toRuleDescription);
        return ruleDescriptions.sort((rd1, rd2) => rd1.name.localeCompare(rd2.name));
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitLogEvent(LogLevel.Warn, "The runRules method of the 'pmd' engine has not been implemented yet. Simply returning zero violations for now.");
        return {
            violations: []
        };
    }

    private async getPmdRuleInfoList(workspaceLiaison: PmdWorkspaceLiaison): Promise<PmdRuleInfo[]> {
        const cacheKey: string = getCacheKey(workspaceLiaison.getWorkspace());
        if (!this.pmdRuleInfoListCache.has(cacheKey)) {
            const relevantLanguages: PmdLanguage[] = await workspaceLiaison.getRelevantLanguages();
            const ruleInfoList: PmdRuleInfo[] = await this.pmdWrapper.invokeDescribeCommand(relevantLanguages);
            this.pmdRuleInfoListCache.set(cacheKey, ruleInfoList);
        }
        return this.pmdRuleInfoListCache.get(cacheKey)!;
    }

    private getPmdWorkspaceLiaison(workspace?: Workspace) : PmdWorkspaceLiaison {
        const cacheKey: string = getCacheKey(workspace);
        if (!this.pmdWorkspaceLiaisonCache.has(cacheKey)) {
            this.pmdWorkspaceLiaisonCache.set(cacheKey, new PmdWorkspaceLiaison(workspace, this.availableLanguages));
        }
        return this.pmdWorkspaceLiaisonCache.get(cacheKey)!
    }
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

// noinspection JSMismatchedCollectionQueryUpdate (IntelliJ is confused about how I am setting the private values, suppressing warnings)
class PmdWorkspaceLiaison {
    private readonly workspace?: Workspace;
    private readonly availableLanguages: PmdLanguage[];

    private relevantLanguages?: PmdLanguage[];
    private relevantFiles?: string[];

    constructor(workspace: Workspace | undefined, availableLanguages: PmdLanguage[]) {
        this.workspace = workspace;
        this.availableLanguages = availableLanguages;
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

    async getRelevantLanguages(): Promise<PmdLanguage[]> {
        if (this.relevantLanguages === undefined) {
            await this.processWorkspace();
        }
        return this.relevantLanguages!;
    }

    private async processWorkspace(): Promise<void> {
        this.relevantFiles = [];
        if (!this.workspace) {
            this.relevantLanguages = [... this.availableLanguages].sort();
            return;
        }

        const relevantLanguagesSet: Set<PmdLanguage> = new Set();
        for (const file of await this.workspace.getExpandedFiles()) {
            const fileExt: string = path.extname(file).toLowerCase();
            const pmdLang: PmdLanguage | undefined = extensionToPmdLanguage[fileExt];
            if (pmdLang && this.availableLanguages.includes(pmdLang)) {
                this.relevantFiles.push(file);
                relevantLanguagesSet.add(extensionToPmdLanguage[fileExt]);
            }
        }
        this.relevantLanguages = [...relevantLanguagesSet].sort();
    }
}

function getCacheKey(workspace?: Workspace) {
    return workspace? workspace.getWorkspaceId() : process.cwd();
}