import {ESLintRuleStatus} from "./enums";
import {ESLint, Linter, Rule} from "eslint";
import {ESLintWorkspace} from "./workspace";
import path from "node:path";
import {BaseRuleset, LegacyBaseConfigFactory} from "./base-config";
import {ESLintEngineConfig} from "./config";

export interface ESLintStrategy {
    calculateRuleStatuses(): Promise<Map<string, ESLintRuleStatus>>
    calculateRulesMetadata(): Promise<Map<string, Rule.RuleMetaData>>
}

export class LegacyESLintStrategy implements ESLintStrategy {
    private readonly workspace: ESLintWorkspace;
    private readonly baseConfigFactory: LegacyBaseConfigFactory;
    private readonly config: ESLintEngineConfig;
    private ruleStatuses?: Map<string, ESLintRuleStatus>;

    constructor(workspace: ESLintWorkspace, config: ESLintEngineConfig) {
        this.workspace = workspace;
        this.config = config;
        this.baseConfigFactory = new LegacyBaseConfigFactory(config);
    }

    async calculateRulesMetadata(): Promise<Map<string, Rule.RuleMetaData>> {
        const ruleModulesMap: Map<string, Rule.RuleModule> = await getAllRuleModules(this.createESLint(BaseRuleset.ALL));
        const rulesMetadata: Map<string, Rule.RuleMetaData> = new Map();
        for (const [ruleName, ruleModule] of ruleModulesMap) {
            if (ruleModule.meta && !ruleModule.meta.deprecated) { // do not add deprecated rules or rules without metadata
                rulesMetadata.set(ruleName, ruleModule.meta);
            }
        }
        return rulesMetadata;
    }

    /**
     * Calculates the status of all available rules
     *
     * To get the user selected status ("error", "warn", or "off") of every single rule, we have to ask ESLint to
     * calculate the configuration (which contains the rule status) for every file that will be scanned. This is
     * because users can add to their config that they only want certain rules to run for a particular file deep in
     * their project. This is why ESLint only offers a calculateConfigForFile(filePath) method and not a direct
     * getConfig() method. See https://eslint.org/docs/v8.x/integrate/nodejs-api#-eslintcalculateconfigforfilefilepath
     */
    async calculateRuleStatuses(): Promise<Map<string, ESLintRuleStatus>> {
        if (this.ruleStatuses) {
            return this.ruleStatuses;
        }

        const candidateFiles: string[] = this.userConfigEnabled() ?
            await this.workspace.getCandidateFilesForUserConfig() :
            await this.workspace.getCandidateFilesForBaseConfig();

        this.ruleStatuses = await this.calculateRuleStatusesFor(candidateFiles,
            this.createESLint(BaseRuleset.RECOMMENDED));

        // Since we have no easy way of turning on a rule that has been explicitly turned off in the config
        // (because we don't know its rule options or parser configuration ), we remove these turned off
        // rules entirely so that they can't be selected.
        const explicitlyTurnedOffRules: Set<string> = new Set();
        for (const [ruleName, ruleStatus] of this.ruleStatuses) {
            if (ruleStatus === ESLintRuleStatus.OFF) {
                explicitlyTurnedOffRules.add(ruleName);
                this.ruleStatuses.delete(ruleName);
            }
        }

        // The ruleStatuses so far only include the rules that are explicitly listed in the recommended base configs
        // and the users config files. We manually add in the other base rules that are not recommended so that they can
        // be selectable even though they are off by default. Note that we do not want to add in any additional rules
        // from users plugins that aren't explicitly configured since we have no easy way of turning them on for the
        // user (since we don't know if their rules require special options), thus we only add in the missing base rules.
        for (const ruleName of await this.getAllBaseRuleNames()) {
            if (!this.ruleStatuses.has(ruleName) && !explicitlyTurnedOffRules.has(ruleName)) {
                this.ruleStatuses.set(ruleName, ESLintRuleStatus.OFF);
            }
        }

        return this.ruleStatuses;
    }

    private userConfigEnabled(): boolean {
        // The use of the user's config is based on whether we are allowed to dynamically lookup user config as we go.
        // If not, then it is determined on whether the user has manually supplied a config file.
        return !this.config.disable_config_lookup || this.workspace.getLegacyConfigFile() !== undefined;
    }

    private async calculateRuleStatusesFor(files: string[], eslint: ESLint): Promise<Map<string, ESLintRuleStatus>> {
        const configs: Linter.Config[] = await Promise.all(files.map(f => eslint.calculateConfigForFile(f) as Linter.Config));
        const ruleStatuses: Map<string, ESLintRuleStatus> = new Map();
        for (const config of configs) {
            /* istanbul ignore next */
            if (!config.rules) {
                continue;
            }
            const rulesRecord: Linter.RulesRecord = config.rules as Linter.RulesRecord;
            for (const ruleName of Object.keys(rulesRecord)) {
                const newStatus: ESLintRuleStatus = getRuleStatusFromRuleEntry(rulesRecord[ruleName]);
                const existingStatus: ESLintRuleStatus | undefined = ruleStatuses.get(ruleName);
                if (!existingStatus || existingStatus < newStatus) {
                    ruleStatuses.set(ruleName, newStatus);
                }
            }
        }
        return ruleStatuses;
    }

    private createESLint(baseRuleset: BaseRuleset, overrideConfig?: Linter.Config): ESLint {
        const options: ESLint.Options = {
            cwd: __dirname, // This is needed to make the base plugins discoverable. Don't worry, user's plugins are also still discovered.
            errorOnUnmatchedPattern: false,
            baseConfig: this.baseConfigFactory.createBaseConfig(baseRuleset), // This is applied first (on bottom).
            useEslintrc: !this.config.disable_config_lookup,                  // This is applied second.
            overrideConfigFile: this.workspace.getLegacyConfigFile(),         // This is applied third.
            overrideConfig: overrideConfig                                    // This is applied fourth (on top).
        };
        return new ESLint(options);
    }

    private async getAllBaseRuleNames(): Promise<string[]> {
        const candidateFiles: string[] = await this.workspace.getCandidateFilesForBaseConfig();
        const eslintForBaseRuleNameDiscovery: ESLint = new ESLint({
            cwd: __dirname, // This is needed to make the base plugins discoverable.
            baseConfig: this.baseConfigFactory.createBaseConfig(BaseRuleset.ALL),
            useEslintrc: false
        });
        return Array.from(
            (await this.calculateRuleStatusesFor(candidateFiles, eslintForBaseRuleNameDiscovery)).keys()
        );
    }
}

async function getAllRuleModules(legacyESLint: ESLint): Promise<Map<string, Rule.RuleModule>> {
    // See https://github.com/eslint/eslint/discussions/18546 to see how we arrived at this implementation.
    const legacyESLintModule: string = path.resolve(path.dirname(require.resolve('eslint')),'eslint','eslint.js');
    const {getESLintPrivateMembers} = await import(legacyESLintModule);
    return getESLintPrivateMembers(legacyESLint).cliEngine.getRules();
}

function getRuleStatusFromRuleEntry(ruleEntry: Linter.RuleEntry): ESLintRuleStatus {
    if (typeof ruleEntry === "number") {
        return ruleEntry === 2 ? ESLintRuleStatus.ERROR :
            ruleEntry === 1 ? ESLintRuleStatus.WARN : ESLintRuleStatus.OFF;
    } else if (typeof ruleEntry === "string") {
        return ruleEntry.toLowerCase() === "error" ? ESLintRuleStatus.ERROR :
            ruleEntry.toLowerCase() === "warn" ? ESLintRuleStatus.WARN : ESLintRuleStatus.OFF;
    }

    // Rules are typically defined with an array of options where the first option is the severity status of the rule.
    // So this is actually the default case:
    return getRuleStatusFromRuleEntry(ruleEntry[0]);
}