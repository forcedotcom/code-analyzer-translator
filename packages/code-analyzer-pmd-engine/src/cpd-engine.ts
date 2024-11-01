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
import {LanguageId} from "./constants";
import {getMessage} from "./messages";
import {WorkspaceLiaison} from "./utils";
import {CPD_AVAILABLE_LANGUAGES} from "./config";

const RULE_NAME_PREFIX: string = 'DetectCopyPasteFor';

export class CpdEngine extends Engine {
    static readonly NAME: string = "cpd";

    private readonly selectedLanguages: LanguageId[]

    private workspaceLiaisonCache: Map<string, WorkspaceLiaison> = new Map();

    constructor() {
        super();

        // We may pass this into the construct as a configurable option in the near future, at which point we'll need to decide on which languages to keep as default.
        this.selectedLanguages = CPD_AVAILABLE_LANGUAGES as LanguageId[]; // Using all languages for now
    }

    getName(): string {
        return CpdEngine.NAME;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(describeOptions.workspace);
        const relevantLanguages: LanguageId[] = await workspaceLiaison.getRelevantLanguages();
        return relevantLanguages.map(createRuleForLanguage);
    }

    async runRules(ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitLogEvent(LogLevel.Warn, `The '${CpdEngine.NAME}' engine's ability to run rules has not been implemented yet, so the following rules did not run: ${JSON.stringify(ruleNames)}`);
        return {
            violations: []
        };
    }

    private getWorkspaceLiaison(workspace?: Workspace) : WorkspaceLiaison {
        const cacheKey: string = getCacheKey(workspace);
        if (!this.workspaceLiaisonCache.has(cacheKey)) {
            this.workspaceLiaisonCache.set(cacheKey, new WorkspaceLiaison(workspace, this.selectedLanguages));
        }
        return this.workspaceLiaisonCache.get(cacheKey)!
    }
}

function createRuleForLanguage(languageId: LanguageId): RuleDescription {
    return {
        name: getRuleNameFromLanguage(languageId),
        severityLevel: SeverityLevel.Info,
        type: RuleType.MultiLocation,
        tags: [`${languageId}Language`],
        description: getMessage('DetectCopyPasteForLanguageRuleDescription', languageId),
        resourceUrls: ['https://docs.pmd-code.org/latest/pmd_userdocs_cpd.html#refactoring-duplicates']
    }
}

function getRuleNameFromLanguage(languageId: LanguageId) {
    return RULE_NAME_PREFIX + makeFirstCharUpperCase(languageId);
}

function makeFirstCharUpperCase(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function getCacheKey(workspace?: Workspace) {
    return workspace? workspace.getWorkspaceId() : process.cwd();
}