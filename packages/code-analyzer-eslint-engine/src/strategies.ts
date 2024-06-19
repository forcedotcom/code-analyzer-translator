import {ESLint, Rule} from "eslint";
import path from "node:path";
import {ESLintRuleStatus} from "./enums";
import {LEGACY_BASE_CONFIG_ALL, LEGACY_BASE_CONFIG_RECOMMENDED} from "./base-config";
import process from "node:process";

export interface ESLintStrategy {
    getMetadataFor(ruleName: string): Rule.RuleMetaData

    calculateRuleStatuses(filesToScan?: string[]): Promise<Map<string, ESLintRuleStatus>>
}

export class LegacyESLintStrategy implements ESLintStrategy{
    private readonly userEslintConfigFile?: string;
    private allRulesMetadataCache?: Map<string, Rule.RuleMetaData>;
    private ruleStatusesCache?: Map<string, ESLintRuleStatus>;

    constructor(userEslintConfigFile?: string) {
        this.userEslintConfigFile = userEslintConfigFile;
    }

    getMetadataFor(ruleName: string): Rule.RuleMetaData {
        return this.getAllRulesMetadata().get(ruleName) as Rule.RuleMetaData;
    }

    /**
     * Returns the metadata for all rules (from all plugins available) that contain metadata.
     * Note that during this step, we do not reduce down the list of rules based on what the user has selected in their
     * configuration files or what we have selected in our base config. This method returns all the rules so that users
     * can use code analyzer to further categorize the rules (via code analyzer config) and select them if they wish.
     */
    private getAllRulesMetadata(): Map<string, Rule.RuleMetaData> {
        if (this.allRulesMetadataCache) {
            return this.allRulesMetadataCache;
        }

        const legacyESLint: ESLint = new ESLint({
            baseConfig: LEGACY_BASE_CONFIG_ALL,
            overrideConfigFile: this.userEslintConfigFile
        });
        const ruleModulesMap: Map<string, Rule.RuleModule> = this.getAllRuleModules(legacyESLint);
        const allRulesMetadata: Map<string, Rule.RuleMetaData> = new Map();
        for (const [ruleName, ruleModule] of ruleModulesMap) {
            if (ruleModule.meta && !ruleModule.meta.deprecated) { // do not add deprecated rules or rules without metadata
                allRulesMetadata.set(ruleName, ruleModule.meta);
            }
        }
        this.allRulesMetadataCache = allRulesMetadata;
        return allRulesMetadata;
    }

    private getAllRuleModules(legacyESLint: ESLint): Map<string, Rule.RuleModule> {
        // See https://github.com/eslint/eslint/discussions/18546 to see how we arrived at this implementation.
        const legacyESLintModule: string = path.resolve(path.dirname(require.resolve('eslint')),'eslint','eslint.js');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(legacyESLintModule).getESLintPrivateMembers(legacyESLint).cliEngine.getRules();
    }

    /**
     * Calculates the rule status over all the provided files and resolve the statuses across the different configurations
     * Since a rule status can differ for different files, we choose for the rule the status of:
     *     - "error" if any file marks the rule with "error"
     *     - otherwise "warn" if any file marks the rule with "warn"
     *     - otherwise "off" (which means it is off for all files)
     */
    async calculateRuleStatuses(filesToScan?: string[]): Promise<Map<string, ESLintRuleStatus>> {
        if (!filesToScan) {
            if (this.ruleStatusesCache) {
                return this.ruleStatusesCache;
            }
            filesToScan = getSampleFilesForRuleStatusCalculation();
        }

        const ruleStatusForAll: Map<string, ESLintRuleStatus> = await this.calculateRuleStatusesFor(filesToScan, new ESLint({
            baseConfig: LEGACY_BASE_CONFIG_ALL,
            overrideConfigFile: this.userEslintConfigFile
        }));

        const ruleStatusForRecommended: Map<string, ESLintRuleStatus> = await this.calculateRuleStatusesFor(filesToScan, new ESLint({
            baseConfig: LEGACY_BASE_CONFIG_RECOMMENDED,
            overrideConfigFile: this.userEslintConfigFile
        }));

        for (const ruleInAll of ruleStatusForAll.keys()) {
            if (!ruleStatusForRecommended.has(ruleInAll)) {
                ruleStatusForRecommended.set(ruleInAll, ESLintRuleStatus.OFF);
            }
        }

        this.ruleStatusesCache = ruleStatusForRecommended;
        return ruleStatusForRecommended;
    }

    private async calculateRuleStatusesFor(filesToScan: string[], legacyESLint: ESLint): Promise<Map<string, ESLintRuleStatus>> {
        const configs = await Promise.all(filesToScan.map(f => legacyESLint.calculateConfigForFile(f)));
        const ruleStatuses: Map<string, ESLintRuleStatus> = new Map();
        for (const config of configs) {
            for (const ruleName of Object.keys(config["rules"])) {
                const newStatus: ESLintRuleStatus = config["rules"][ruleName][0];
                if (!ruleStatuses.has(ruleName)) {
                    ruleStatuses.set(ruleName, newStatus);
                    continue;
                }
                const existingStatus: ESLintRuleStatus = ruleStatuses.get(ruleName) as ESLintRuleStatus;
                if (existingStatus === ESLintRuleStatus.ERROR || newStatus == ESLintRuleStatus.ERROR) {
                    ruleStatuses.set(ruleName, ESLintRuleStatus.ERROR);
                } else if (existingStatus === ESLintRuleStatus.WARN || newStatus === ESLintRuleStatus.WARN) {
                    ruleStatuses.set(ruleName, ESLintRuleStatus.WARN);
                } else {
                    ruleStatuses.set(ruleName, ESLintRuleStatus.OFF);
                }
            }
        }
        this.ruleStatusesCache = ruleStatuses;
        return ruleStatuses;
    }
}

function getSampleFilesForRuleStatusCalculation(): string[] {
    // To get the user selected status ("error", "warn" , or "off") of every single rule, we would theoretically have to
    // ask eslint to calculate the configuration (which contains the rule status) for every single file that will be
    // scanned. This is because users can add to their config that they only want certain rules to run for a particular
    // file deep in their project. This is why ESLint only offers a calculateConfigForFile(filePath) method and not a
    // getConfig method. See https://eslint.org/docs/v8.x/integrate/nodejs-api#-eslintcalculateconfigforfilefilepath
    // If we were to do a full analysis using all the workspace files, it would be rather expensive. Instead, we will
    // just use a list of sample dummy files instead to keep things fast. Note that the calculateConfigForFile method
    // doesn't need the file to actually exist, so we just generate some sample file names for the various types of
    // files that we expect eslint to scan.
    // With this shortcut, the worse case scenario is that we miss that a rule has been turned on for some particular
    // file (thus we would miss adding in the 'Recommended' tag for that rule). But in that case, the user can still
    // update their code analyzer config file to manually add in the 'Recommended' tag for these special cases.
    // Alternatively if users complain, then in the future we can add to the eslint engine a boolean field,
    // like perform-full-rule-analysis, to the config which would trigger using all their workspace files here instead.
    const cwd: string = process.cwd();
    const extensionsToScan: string[] = ['.js', '.cjs', '.mjs', '.ts'];
    return extensionsToScan.map(ext => `${cwd}${path.sep}dummy${ext}`);
}