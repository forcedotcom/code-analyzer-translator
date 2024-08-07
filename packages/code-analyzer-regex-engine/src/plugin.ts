import {ConfigObject, Engine, EnginePluginV1, SeverityLevel,} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {RegexEngine} from "./engine";
import {RegexEngineConfig, RegexRules, validateAndNormalizeConfig} from "./config";
import {getDeprecatedApiVersionRegex} from "./utils";

export const BASE_REGEX_RULES: RegexRules = {
    NoTrailingWhitespace: {
        regex: /[ \t]+((?=\r?\n)|(?=$))/g,
        file_extensions: ['.cls', '.trigger'],
        description: getMessage('TrailingWhitespaceRuleDescription'),
        violation_message: getMessage('TrailingWhitespaceRuleMessage'),
        severity: SeverityLevel.Info,
        tags: ['Recommended', 'CodeStyle']
    },
    UseInclusiveSecurityTerms: {
        regex:/\b(black|white)\s*list\w*/gi,
        description: getMessage('AvoidTermsWithImplicitBiasRuleDescription', JSON.stringify(['whitelist', 'blacklist'])),
        violation_message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(['whitelist', 'blacklist']), JSON.stringify(['allowlist', 'blocklist'])),
        tags: ['Recommended'],
        severity: SeverityLevel.Info
    },
    UseInclusiveOutageTerms: {
        regex: /\b(black|brown)\s*out\w*/gi,
        description: getMessage('AvoidTermsWithImplicitBiasRuleDescription', JSON.stringify(['brownout', 'blackout'])),
        violation_message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(['brownout', 'blackout']), JSON.stringify(['reduced availability', 'blockout'])),
        tags: ["Recommended"],
        severity: SeverityLevel.Info
    },
    UseInclusiveHierarchicalTerms: {
        regex: /\bslaves?\b/gi,
        description: getMessage('AvoidTermsWithImplicitBiasRuleDescription', JSON.stringify(['slave'])),
        violation_message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(['slave']), JSON.stringify(['secondary', 'follower'])),
        tags: ["Recommended"],
        severity: SeverityLevel.Info
    },
    UpdateOldApexApiVersion: {
        regex: new RegExp(`(?<=<apiVersion>)${getDeprecatedApiVersionRegex(new Date())}(?=<\\/apiVersion>)`, 'g'),
        file_extensions: ['.xml'],
        description: getMessage('UpdateOldApexApiVersionRuleDescription'),
        violation_message: getMessage('UpdateOldApexApiVersionRuleMessage'),
        tags: ["Recommended", "Security"],
        severity: SeverityLevel.High
    }
}

export const RULE_RESOURCE_URLS: Map<string, string[]> = new Map();
const INCLUSIVE_RULES_RESOURCE_URLS: string[] = ['https://www.salesforce.com/news/stories/salesforce-updates-technical-language-in-ongoing-effort-to-address-implicit-bias/'];

RULE_RESOURCE_URLS.set('UseInclusiveSecurityTerms', INCLUSIVE_RULES_RESOURCE_URLS)
RULE_RESOURCE_URLS.set('UseInclusiveOutageTerms', INCLUSIVE_RULES_RESOURCE_URLS)
RULE_RESOURCE_URLS.set('UseInclusiveHierarchicalTerms', INCLUSIVE_RULES_RESOURCE_URLS)

export class RegexEnginePlugin extends EnginePluginV1 {

    getAvailableEngineNames(): string[] {
        return [RegexEngine.NAME];
    }

    async createEngine(engineName: string, rawConfig: ConfigObject): Promise<Engine> {
        if (engineName !== RegexEngine.NAME) {
            throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
        }
        const config: RegexEngineConfig = validateAndNormalizeConfig(rawConfig);
        const allRules: RegexRules = {
            ... BASE_REGEX_RULES,
            ... config.custom_rules
        }
        return new RegexEngine(allRules, RULE_RESOURCE_URLS);
    }
}