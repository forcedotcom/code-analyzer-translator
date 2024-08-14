import {ConfigObject, Engine, EnginePluginV1, SeverityLevel,} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {RegexEngine} from "./engine";
import {RegexEngineConfig, RegexRules, validateAndNormalizeConfig} from "./config";
import {getDeprecatedApiVersionRegex} from "./utils";

export const TERMS_WITH_IMPLICIT_BIAS: string[] = ['whitelist', 'blacklist', 'brownout', 'blackout', 'slave']
export const TERMS_WITH_IMPLICIT_BIAS_REPLACEMENT_MAP: Record<string, string[]> = {
    whitelist: ['allowlist'],
    blacklist: ['blocklist'],
    brownout: ['reduced availability'],
    blackout: ['blockout'],
    slave: ['secondary', 'follower']
}

export const BASE_REGEX_RULES: RegexRules = {
    NoTrailingWhitespace: {
        regex: /[ \t]+((?=\r?\n)|(?=$))/g,
        file_extensions: ['.cls', '.trigger'],
        description: getMessage('TrailingWhitespaceRuleDescription'),
        violation_message: getMessage('TrailingWhitespaceRuleMessage'),
        severity: SeverityLevel.Info,
        tags: ['Recommended', 'CodeStyle']
    },
    AvoidTermsWithImplicitBias: {
        regex: /\b(((black|white)\s*list\w*)|((black|brown)\s*out\w*)|(slaves?\b))/gi,
        description: getMessage('AvoidTermsWithImplicitBiasRuleDescription', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
        violation_message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS), JSON.stringify(TERMS_WITH_IMPLICIT_BIAS_REPLACEMENT_MAP)),
        severity: SeverityLevel.Info,
        tags: ['Recommended']
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

RULE_RESOURCE_URLS.set('AvoidTermsWithImplicitBias', INCLUSIVE_RULES_RESOURCE_URLS)

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