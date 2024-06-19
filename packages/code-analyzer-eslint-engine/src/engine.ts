import {
    ConfigObject,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation
} from '@salesforce/code-analyzer-engine-api'
import {getMessage} from "./messages";
import {ESLint, Linter, Rule} from "eslint";
import path from "node:path";
import {ESLintRuleStatus, ESLintRuleType} from "./enums";
import {ESLintStrategy, LegacyESLintStrategy} from "./strategies";
import process from "node:process";
import fs from "node:fs";

export class ESLintEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [ESLintEngine.NAME];
    }

    createEngine(engineName: string, _config: ConfigObject): Engine {
        if (engineName === ESLintEngine.NAME) {
            return new ESLintEngine();
        }
        throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
    }
}

export class ESLintEngine extends Engine {
    static readonly NAME = "eslint";
    private folderForCache: string = '';
    private cachedEslintStrategy?: ESLintStrategy; // Not passed in. Will lazy construct this to use async if needed

    constructor() {
        super();
    }

    getName(): string {
        return ESLintEngine.NAME;
    }

    async describeRules(): Promise<RuleDescription[]> {
        const strategy: ESLintStrategy = this.getStrategy();
        const ruleStatuses: Map<string, ESLintRuleStatus> = await strategy.calculateRuleStatuses();

        const ruleDescriptions: RuleDescription[] = [];
        for (const [ruleName, ruleStatus] of ruleStatuses) {
            const ruleMetadata: Rule.RuleMetaData = strategy.getMetadataFor(ruleName);
            if (ruleMetadata) { // do not include rules that don't have metadata
                ruleDescriptions.push(toRuleDescription(ruleName, ruleMetadata, ruleStatus));
            }
        }

        return ruleDescriptions.sort((d1,d2) => d1.name.localeCompare(d2.name));
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        throw new Error('Method not implemented.');
    }

    private getStrategy(): ESLintStrategy {
        // Currently we only support legacy eslint configuration files. When we are ready to support the new eslint flat
        // configuration files then we'll want to use https://eslint.org/docs/v8.x/integrate/nodejs-api#loadeslint
        // to help us determine which strategy to take, but note that this would require an await
        // call. So we might need to change createEngine to async (or generate the strategy later on). Also getting
        // all the rule metadata for the flat config world may require us to load in all the config modules and parse
        // them ourselves. See https://github.com/eslint/eslint/discussions/18546.
        if (!this.cachedEslintStrategy || this.folderForCache !== process.cwd()) {
            // TODO: pass in user's legacy eslint config file from engine config if available
            const legacyConfigFile: string | undefined = findLegacyConfigFile();  // See https://github.com/eslint/eslint/issues/18615
            this.cachedEslintStrategy = new LegacyESLintStrategy(legacyConfigFile);
            this.folderForCache = process.cwd();
        }
        return this.cachedEslintStrategy;
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
        return SeverityLevel.Info;
    } else if (metadata.type === ESLintRuleType.PROBLEM) {
        return SeverityLevel.High;
    } else if (metadata.type === ESLintRuleType.LAYOUT) {
        return SeverityLevel.Low;
    }
    return SeverityLevel.Moderate;
}

function toTags(metadata: Rule.RuleMetaData, status: ESLintRuleStatus | undefined): string[] {
    const tags: string[] = [];
    if (status === ESLintRuleStatus.ERROR || status === ESLintRuleStatus.WARN) {
        tags.push('Recommended');
    }
    if (metadata.type) {
        tags.push(metadata.type);
    }
    return tags;
}

function findLegacyConfigFile(): string | undefined {
    const possibleUserConfigFiles = [".eslintrc.js", ".eslintrc.cjs", ".eslintrc.yaml", ".eslintrc.yml", ".eslintrc.json"];
    for (const possibleUserConfigFile of possibleUserConfigFiles) {
        const userConfigFile = path.join(process.cwd(), possibleUserConfigFile);
        if (fs.existsSync(userConfigFile)) {
            return userConfigFile;
        }
    }
    return undefined;
}