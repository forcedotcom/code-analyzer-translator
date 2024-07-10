import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace
} from '@salesforce/code-analyzer-engine-api'
import {ESLintRuleStatus, ESLintRuleType} from "./enums";
import {ESLint, Linter, Rule} from "eslint";
import {MissingESLintWorkspace, PresentESLintWorkspace} from "./workspace";
import {ESLintStrategy, LegacyESLintStrategy} from "./strategy";
import {ESLintEngineConfig} from "./config";

export class ESLintEngine extends Engine {
    static readonly NAME = "eslint";
    private readonly config: ESLintEngineConfig;
    private readonly eslintStrategyCache: Map<string, ESLintStrategy> = new Map();

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
        const eslintStrategy: ESLintStrategy = this.getESLintStrategy(describeOptions.workspace);

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

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const eslintStrategy: ESLintStrategy = this.getESLintStrategy(runOptions.workspace);
        const eslintResults: ESLint.LintResult[] = await eslintStrategy.run(ruleNames);
        return {
            violations: this.toViolations(eslintResults, ruleNames)
        };
    }

    private getESLintStrategy(workspace?: Workspace): ESLintStrategy {
        if (!workspace) {
            return new LegacyESLintStrategy(new MissingESLintWorkspace(this.config), this.config);
        }
        const strategyKey: string = workspace.getWorkspaceId();
        if(!this.eslintStrategyCache.has(strategyKey)) {
            this.eslintStrategyCache.set(strategyKey,
                new LegacyESLintStrategy(new PresentESLintWorkspace(workspace, this.config), this.config));
        }
        return this.eslintStrategyCache.get(strategyKey)!;
    }

    private toViolations(eslintResults: ESLint.LintResult[], ruleNames: string[]): Violation[] {
        const violations: Violation[] = [];
        for (const eslintResult of eslintResults) {
            for (const resultMsg of eslintResult.messages) {
                const ruleName = resultMsg.ruleId;
                if(!ruleName) { // If there is no ruleName, this is how ESLint indicates something else went wrong (like a parse error).
                    // TODO: Log an warning event since eslint warned or errored in some way... most likely a parser error.
                    continue;
                } else if (!ruleNames.includes(ruleName)) {
                    // TODO: Log a warning event since: A rule with name '${ruleName}' produced a violation, but this rule was not registered so it will not be included in the results. Result:\n${JSON.stringify(eslintResult,null,2)}`);
                    continue;
                }
                violations.push(toViolation(eslintResult.filePath, resultMsg));
            }
        }
        return violations;
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

function toViolation(file: string, resultMsg: Linter.LintMessage): Violation {
    // Note: If in the future we add in some sort of suggestion or fix field on Violation, then we might want to
    // leverage the fix and/or suggestions field on the LintMessage object.
    // See: https://eslint.org/docs/v8.x/integrate/nodejs-api#-lintmessage-type
    return {
        ruleName: resultMsg.ruleId as string,
        message: resultMsg.message,
        codeLocations: [{
            file: file,
            startLine: normalizeStartValue(resultMsg.line),
            startColumn: normalizeStartValue(resultMsg.column),
            endLine: normalizeEndValue(resultMsg.endLine),
            endColumn: normalizeEndValue(resultMsg.endColumn),
        }],
        primaryLocationIndex: 0
    };
}

function normalizeStartValue(startValue: number): number {
    // Sometimes rules contain a negative number if the line/column is unknown, so we force 1 in that case
    return Math.max(startValue, 1);
}

function normalizeEndValue(endValue: number | undefined): number | undefined {
    // Sometimes rules contain a negative number if the line/column is unknown, so we force undefined in that case
    /* istanbul ignore next */
    return endValue && endValue > 0 ? endValue : undefined;
}