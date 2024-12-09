import {
    COMMON_TAGS,
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {indent, JavaCommandExecutor, WorkspaceLiaison} from "./utils";
import path from "node:path";
import * as fs from 'node:fs/promises';
import {extensionToLanguageId, LanguageId, PMD_ENGINE_NAME, SHARED_RULE_NAMES} from "./constants";
import {
    LanguageSpecificPmdRunData,
    PmdResults,
    PmdRuleInfo,
    PmdViolation,
    PmdWrapperInvoker
} from "./pmd-wrapper";
import {getMessage} from "./messages";
import {PmdEngineConfig} from "./config";
import {RULE_MAPPINGS} from "./pmd-rule-mappings";

export class PmdEngine extends Engine {
    private readonly pmdWrapperInvoker: PmdWrapperInvoker;
    private readonly selectedLanguages: LanguageId[];
    private readonly customRulesets: string[];

    private workspaceLiaisonCache: Map<string, WorkspaceLiaison> = new Map();
    private pmdRuleInfoListCache: Map<string, PmdRuleInfo[]> = new Map();

    constructor(config: PmdEngineConfig) {
        super();
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor(config.java_command);
        const userProvidedJavaClasspathEntries: string[] = config.java_classpath_entries;
        this.pmdWrapperInvoker = new PmdWrapperInvoker(javaCommandExecutor, userProvidedJavaClasspathEntries,
            (logLevel: LogLevel, message: string) => this.emitLogEvent(logLevel, message));
        this.selectedLanguages = config.rule_languages as LanguageId[];
        this.customRulesets = config.custom_rulesets;
    }

    getName(): string {
        return PMD_ENGINE_NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(describeOptions.workspace);
        this.emitDescribeRulesProgressEvent(5);

        const ruleInfoList: PmdRuleInfo[] = await this.getPmdRuleInfoList(workspaceLiaison,
            (innerPerc: number) => this.emitDescribeRulesProgressEvent(5 + 90*(innerPerc/100))); // 5 to 95%

        const ruleDescriptions: RuleDescription[] = ruleInfoList.map(toRuleDescription);
        ruleDescriptions.sort((rd1, rd2) => rd1.name.localeCompare(rd2.name));
        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(runOptions.workspace);
        const relevantLanguageToFilesMap: Map<LanguageId, string[]> = await workspaceLiaison.getRelevantLanguageToFilesMap();
        this.emitRunRulesProgressEvent(2);

        const ruleInfoList: PmdRuleInfo[] = await this.getPmdRuleInfoList(workspaceLiaison,
            (innerPerc: number) => this.emitRunRulesProgressEvent(2 + 3*(innerPerc/100))); // 2 to 5%

        const selectedRuleInfoList: PmdRuleInfo[] = ruleNames
            .map(ruleName => fetchRuleInfoByRuleName(ruleInfoList, ruleName))
            .filter(ruleInfo => ruleInfo !== null);

        const runDataPerLanguage: Record<string, LanguageSpecificPmdRunData> = {};
        const relevantLanguages: Set<string> = new Set(selectedRuleInfoList.map(ruleInfo => ruleInfo.language));
        for (const language of relevantLanguages) {
            const filesToScanForLanguage: string[] = relevantLanguageToFilesMap.get(toLanguageId(language)) || /* istanbul ignore next */ [];
            if (filesToScanForLanguage.length > 0) {
                runDataPerLanguage[language] = {
                    filesToScan: filesToScanForLanguage
                }
            }
        }

        if (Object.keys(runDataPerLanguage).length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }


        const pmdResults: PmdResults = await this.pmdWrapperInvoker.invokeRunCommand(selectedRuleInfoList, runDataPerLanguage,
            (innerPerc: number) => this.emitRunRulesProgressEvent(5 + 93*(innerPerc/100))); // 5 to 98%

        const violations: Violation[] = [];
        for (const pmdViolation of pmdResults.violations) {
            violations.push(toViolation(pmdViolation));
        }
        for (const pmdProcessingError of pmdResults.processingErrors) {
            this.emitLogEvent(LogLevel.Error, getMessage('ProcessingErrorForFile', 'PMD', pmdProcessingError.file,
                indent(pmdProcessingError.message)));
        }

        this.emitRunRulesProgressEvent(100);
        return {
            violations: violations
        };
    }

    private async getPmdRuleInfoList(workspaceLiaison: WorkspaceLiaison, emitProgress: (percComplete: number) => void): Promise<PmdRuleInfo[]> {
        const cacheKey: string = getCacheKey(workspaceLiaison.getWorkspace());
        if (!this.pmdRuleInfoListCache.has(cacheKey)) {
            const relevantLanguages: LanguageId[] = await workspaceLiaison.getRelevantLanguages();
            const pmdRuleLanguages: string[] = relevantLanguages.map(toPmdRuleLanguage);
            const ruleInfoList: PmdRuleInfo[] = relevantLanguages.length === 0 ? [] :
                await this.pmdWrapperInvoker.invokeDescribeCommand(this.customRulesets, pmdRuleLanguages, emitProgress);
            this.pmdRuleInfoListCache.set(cacheKey, ruleInfoList);
        }
        return this.pmdRuleInfoListCache.get(cacheKey)!;
    }

    private getWorkspaceLiaison(workspace?: Workspace) : WorkspaceLiaison {
        const cacheKey: string = getCacheKey(workspace);
        if (!this.workspaceLiaisonCache.has(cacheKey)) {
            this.workspaceLiaisonCache.set(cacheKey, new WorkspaceLiaison(workspace, this.selectedLanguages));
        }
        return this.workspaceLiaisonCache.get(cacheKey)!
    }
}

function toRuleDescription(pmdRuleInfo: PmdRuleInfo): RuleDescription {
    const languageId: LanguageId = toLanguageId(pmdRuleInfo.language);
    const uniqueRuleName: string = toUniqueRuleName(pmdRuleInfo.name, languageId);

    let severityLevel: SeverityLevel;
    let tags: string[];

    if (uniqueRuleName in RULE_MAPPINGS) {
        severityLevel = RULE_MAPPINGS[uniqueRuleName].severity;
        tags = RULE_MAPPINGS[uniqueRuleName].tags;
    } else { // Any rule we don't know about from our RULE_MAPPINGS must be a custom rule. Unit tests prevent otherwise.
        severityLevel = toSeverityLevel(pmdRuleInfo.priority);
        const categoryTag: string = pmdRuleInfo.ruleSet.replaceAll(' ', '');
        const languageTag: string = languageId.charAt(0).toUpperCase() + languageId.slice(1);
        tags = [COMMON_TAGS.RECOMMENDED, categoryTag, languageTag, COMMON_TAGS.CUSTOM];
    }

    return {
        name: uniqueRuleName,
        severityLevel: severityLevel,
        tags: tags,
        description: pmdRuleInfo.description,
        resourceUrls: pmdRuleInfo.externalInfoUrl ? [pmdRuleInfo.externalInfoUrl] : [] // TODO: Eventually we'll want to add in well architected links
    };
}

function toUniqueRuleName(ruleName: string, ruleLanguage: LanguageId): string {
    if (ruleName in SHARED_RULE_NAMES && ruleLanguage !== LanguageId.APEX) {
        return `${ruleName}-${ruleLanguage}`;
    }
    return ruleName;
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

function toViolation(pmdViolation: PmdViolation): Violation {
    return {
        ruleName: toUniqueRuleName(pmdViolation.rule, extensionToLanguageId[path.extname(pmdViolation.codeLocation.file)]),
        message: pmdViolation.message,
        codeLocations: [{
            file: pmdViolation.codeLocation.file,
            startLine: pmdViolation.codeLocation.startLine,
            startColumn: pmdViolation.codeLocation.startCol,
            endLine: pmdViolation.codeLocation.endLine,
            endColumn: pmdViolation.codeLocation.endCol
        }],
        primaryLocationIndex: 0
    }
}

function getCacheKey(workspace?: Workspace) {
    return workspace? workspace.getWorkspaceId() : process.cwd();
}

function fetchRuleInfoByRuleName(ruleInfoList: PmdRuleInfo[], uniqueRuleName: string) : PmdRuleInfo|null {
    // Note that some pmd rule names that were shared among languages were converted to contain a "-<language>" suffix.
    // So we need to map these names (like "TooManyFields-java") back into "TooManyFields" for the "java" language.
    const langSeparator: number = uniqueRuleName.indexOf('-');
    const specificLanguageId: LanguageId|undefined = langSeparator > 0 ?
        uniqueRuleName.substring(langSeparator+1) as LanguageId: undefined;
    const pmdRuleName: string = langSeparator > 0 ? uniqueRuleName.substring(0, langSeparator) : uniqueRuleName;
    return ruleInfoList.find(ruleInfo =>
        ruleInfo.name === pmdRuleName && (specificLanguageId === undefined || toLanguageId(ruleInfo.language) === specificLanguageId)
    ) || null;
}

function toPmdRuleLanguage(languageId: LanguageId): string {
    // We must convert 'javascript' to 'ecmascript' since PMD actually uses 'ecmascript' as the identifier instead of 'javascript'
    return languageId == LanguageId.JAVASCRIPT ? 'ecmascript' : languageId;
}

function toLanguageId(pmdRuleLanguage: string): LanguageId {
    // We must convert 'ecmascript' back to 'javascrijpt'
    return pmdRuleLanguage == 'ecmascript' ? LanguageId.JAVASCRIPT : pmdRuleLanguage as LanguageId;
}