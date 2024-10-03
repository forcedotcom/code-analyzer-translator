import {
    CodeLocation,
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {indent, JavaCommandExecutor} from "./utils";
import path from "node:path";
import {extensionToPmdLanguage, PmdLanguage} from "./constants";
import {PmdResults, PmdRuleInfo, PmdViolation, PmdWrapperInvoker} from "./pmd-wrapper";
import {getMessage} from "./messages";
import {PmdEngineConfig} from "./config";

export class PmdEngine extends Engine {
    static readonly NAME: string = "pmd";

    private readonly pmdWrapperInvoker: PmdWrapperInvoker;
    private readonly availableLanguages: PmdLanguage[];

    private pmdWorkspaceLiaisonCache: Map<string, PmdWorkspaceLiaison> = new Map();
    private pmdRuleInfoListCache: Map<string, PmdRuleInfo[]> = new Map();

    constructor(config: PmdEngineConfig) {
        super();
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor(config.java_command);
        this.pmdWrapperInvoker = new PmdWrapperInvoker(javaCommandExecutor,
            (logLevel: LogLevel, message: string) => this.emitLogEvent(logLevel, message));
        this.availableLanguages = [PmdLanguage.APEX, PmdLanguage.VISUALFORCE]; // TODO: Will be configurable soon
    }

    getName(): string {
        return PmdEngine.NAME;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspaceLiaison: PmdWorkspaceLiaison = this.getPmdWorkspaceLiaison(describeOptions.workspace);
        this.emitDescribeRulesProgressEvent(5);

        const ruleInfoList: PmdRuleInfo[] = await this.getPmdRuleInfoList(workspaceLiaison,
            (innerPerc: number) => this.emitDescribeRulesProgressEvent(5 + 90*(innerPerc/100))); // 5 to 95%

        const ruleDescriptions: RuleDescription[] = ruleInfoList.map(toRuleDescription);
        ruleDescriptions.sort((rd1, rd2) => rd1.name.localeCompare(rd2.name));
        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const workspaceLiaison: PmdWorkspaceLiaison = this.getPmdWorkspaceLiaison(runOptions.workspace);
        this.emitRunRulesProgressEvent(2);

        const filesToScan: string[] = await workspaceLiaison.getRelevantFiles();
        if (ruleNames.length === 0 || filesToScan.length === 0) {
            this.emitRunRulesProgressEvent(100);
            return {violations: []};
        }
        this.emitRunRulesProgressEvent(4);

        const ruleInfoList: PmdRuleInfo[] = await this.getPmdRuleInfoList(workspaceLiaison,
            (innerPerc: number) => this.emitRunRulesProgressEvent(4 + 6*(innerPerc/100))); // 4 to 10%

        const selectedRuleNames: Set<string> = new Set(ruleNames);
        const selectedRuleInfoList: PmdRuleInfo[] = ruleInfoList.filter(ruleInfo => selectedRuleNames.has(ruleInfo.name));
        const pmdResults: PmdResults = await this.pmdWrapperInvoker.invokeRunCommand(selectedRuleInfoList, filesToScan,
            (innerPerc: number) => this.emitRunRulesProgressEvent(10 + 88*(innerPerc/100))); // 10 to 98%

        const violations: Violation[] = [];
        for (const pmdFileResult of pmdResults.files) {
            for (const pmdViolation of pmdFileResult.violations) {
                violations.push(toViolation(pmdViolation, pmdFileResult.filename));
            }
        }
        for (const pmdProcessingError of pmdResults.processingErrors) {
            this.emitLogEvent(LogLevel.Error, getMessage('PmdProcessingErrorForFile', pmdProcessingError.filename,
                indent(pmdProcessingError.message)));
        }

        this.emitRunRulesProgressEvent(100);
        return {
            violations: violations
        };
    }

    private async getPmdRuleInfoList(workspaceLiaison: PmdWorkspaceLiaison, emitProgress: (percComplete: number) => void): Promise<PmdRuleInfo[]> {
        const cacheKey: string = getCacheKey(workspaceLiaison.getWorkspace());
        if (!this.pmdRuleInfoListCache.has(cacheKey)) {
            const relevantLanguages: PmdLanguage[] = await workspaceLiaison.getRelevantLanguages();
            const ruleInfoList: PmdRuleInfo[] = relevantLanguages.length === 0 ? [] :
                await this.pmdWrapperInvoker.invokeDescribeCommand(relevantLanguages, emitProgress);
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

function toViolation(pmdViolation: PmdViolation, file: string): Violation {
    const codeLocation: CodeLocation = {
        file: file,
        startLine: pmdViolation.beginline,
        startColumn: pmdViolation.begincolumn,
        endLine: pmdViolation.endline,
        endColumn: pmdViolation.endcolumn
    }
    return {
        ruleName: pmdViolation.rule,
        message: pmdViolation.description,
        codeLocations: [codeLocation],
        primaryLocationIndex: 0
    }
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
                relevantLanguagesSet.add(pmdLang);
            }
        }
        this.relevantLanguages = [...relevantLanguagesSet].sort();
    }
}

function getCacheKey(workspace?: Workspace) {
    return workspace? workspace.getWorkspaceId() : process.cwd();
}