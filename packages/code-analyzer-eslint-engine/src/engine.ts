import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel
} from '@salesforce/code-analyzer-engine-api'
import {ESLintRuleStatus, ESLintRuleType} from "./enums";
import {Rule} from "eslint";
import {ESLintWorkspace, MissingESLintWorkspace, PresentESLintWorkspace} from "./workspace";
import {ESLintStrategy, LegacyESLintStrategy} from "./strategy";
import {ESLintEngineConfig} from "./config";

export class ESLintEngine extends Engine {
    static readonly NAME = "eslint";
    private readonly config: ESLintEngineConfig;

    constructor(config: ESLintEngineConfig) {
        super();
        this.config = config;
    }

    getName(): string {
        return ESLintEngine.NAME;
    }

    getConfig(): ESLintEngineConfig {
        return this.config;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspace: ESLintWorkspace = describeOptions.workspace ?
            new PresentESLintWorkspace(describeOptions.workspace, this.config) :
            new MissingESLintWorkspace(this.config);

        const eslintStrategy: ESLintStrategy = new LegacyESLintStrategy(workspace, this.config);

        const ruleStatuses: Map<string, ESLintRuleStatus> = await eslintStrategy.calculateRuleStatuses();
        const rulesMetadata: Map<string, Rule.RuleMetaData> = await eslintStrategy.calculateRulesMetadata();

        const ruleDescriptions: RuleDescription[] = [];
        for (const [ruleName, ruleStatus] of ruleStatuses) {
            const ruleMetadata: Rule.RuleMetaData | undefined = rulesMetadata.get(ruleName);
            if (ruleMetadata) { // do not include rules that don't have metadata
                ruleDescriptions.push(toRuleDescription(ruleName, ruleMetadata, ruleStatus));
            }
        }
        return ruleDescriptions.sort((d1, d2) => d1.name.localeCompare(d2.name));
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        // TODO: Implement this. Note that we'll want to cache the eslintStrategy from above and reuse it if the workspace is the same.
        return {
            violations: []
        }
    }
}




function toRuleDescription(name: string, metadata: Rule.RuleMetaData, status: ESLintRuleStatus | undefined): RuleDescription {
    return {
        name: name,
        severityLevel: toSeverityLevel(metadata, status),
        type: RuleType.Standard,
        tags: toTags(metadata, status),
        description: metadata.docs?.description || '',
        resourceUrls: metadata.docs?.url ? [metadata.docs.url] : []
    }
}

function toSeverityLevel(metadata: Rule.RuleMetaData, status: ESLintRuleStatus | undefined): SeverityLevel {
    if (status === ESLintRuleStatus.WARN) {
        // An ESLint "warn" status is what users typically use to inform them of things without labeling it as a
        // violation to stop their build over. Our Info level severity is the closest to this.
        return SeverityLevel.Info;
    } else if (metadata.type === ESLintRuleType.PROBLEM) {
        // The "problem" category is typically something users care most about, so we mark these as High severity.
        return SeverityLevel.High;
    } else if (metadata.type === ESLintRuleType.LAYOUT) {
        // The "layout" category is more for cosmetic issues only, so we mark these as Low severity.
        return SeverityLevel.Low;
    }
    // All else will give assigned Moderate. Recall that users may override these severities if they wish.
    return SeverityLevel.Moderate;
}

function toTags(metadata: Rule.RuleMetaData, status: ESLintRuleStatus | undefined): string[] {
    const tags: string[] = [];
    if (status === ESLintRuleStatus.ERROR || status === ESLintRuleStatus.WARN) {
        // Any rule that base config or the user's config has turned on, should be marked as 'Recommended'
        // so that code analyzer will run these rules by default just as eslint runs these rules.
        tags.push('Recommended');
    }
    if (metadata.type) {
        tags.push(metadata.type);
    }
    return tags;
}