import {ConfigObject, Engine, EnginePluginV1, RuleType, SeverityLevel,} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {RegexEngine} from "./engine";
import {RegexEngineConfig, RegexRules, validateAndNormalizeConfig} from "./config";

export const BASE_REGEX_RULES: RegexRules = {
    NoTrailingWhitespace: {
        regex: /[ \t]+((?=\r?\n)|(?=$))/g,
        file_extensions: ['.cls', '.trigger'],
        description: getMessage('TrailingWhitespaceRuleDescription'),
        violation_message: getMessage('TrailingWhitespaceRuleMessage'),
        name: "NoTrailingWhitespace",
        type: RuleType.Standard,
        severityLevel: SeverityLevel.Info,
        tags: ['Recommended', 'CodeStyle'],
        resourceUrls: []
    }
}

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
        return new RegexEngine(allRules);
    }
}