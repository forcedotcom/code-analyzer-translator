import {
    ConfigObject,
    ConfigValueExtractor,
    ValueValidator
} from "@salesforce/code-analyzer-engine-api"
import {getMessage} from "./messages";

const APEX_CLASS_FILE_EXT: string = ".cls"

export type RegexRule = {
    regex: RegExp;
    file_extensions: string[];
    description: string;
    violation_message: string;
}
export type RegexRuleMap = Record<string, RegexRule>;

export type RegexEngineConfig = {
    rules: RegexRuleMap
}

export const DEFAULT_CONFIG: RegexEngineConfig = {
    rules: {
        "NoTrailingWhitespace": {
            regex: /[ \t]+((?=\r?\n)|(?=$))/g,
            file_extensions: [APEX_CLASS_FILE_EXT],
            description: getMessage('TrailingWhitespaceRuleDescription'),
            violation_message: getMessage('TrailingWhitespaceRuleMessage')
        }
    }
};

const RULES_FIELD_NAME: string = 'custom_rules'
const REGEX_ENGINE_ROOT: string = 'engines.regex'
const FILE_EXT_PATTERN: RegExp = /^[.][a-zA-Z0-9]+$/;

export function validateAndNormalizeConfig(rawConfig: ConfigObject): RegexEngineConfig {
    const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, REGEX_ENGINE_ROOT);
    const customRulesExtractor: ConfigValueExtractor = valueExtractor.extractObjectAsExtractor(RULES_FIELD_NAME);
    const customRules: RegexRuleMap = {};
    const keys: string[] = Object.keys(customRulesExtractor.getObject())

    for (const ruleName of keys) {
        if (!ruleName){
            throw new Error(getMessage('RuleNameCannotBeEmpty', customRulesExtractor.getFieldPath()))
        }
        const ruleExtractor: ConfigValueExtractor = customRulesExtractor.extractRequiredObjectAsExtractor(ruleName)
        const description: string = ruleExtractor.extractRequiredString('description')
        const rawRegexString: string = ruleExtractor.extractRequiredString('regex')
        const regex: RegExp = validateRegex(rawRegexString, ruleExtractor.getFieldPath('regex'))
        const rawFileExtensions: string[] = ruleExtractor.extractRequiredArray('file_extensions', ValueValidator.validateString)

        customRules[ruleName] = {
            regex: regex,
            description: description,
            violation_message: ruleExtractor.extractString('violation_message', getDefaultRuleViolationMessage(regex, ruleName, description))!,
            file_extensions: rawFileExtensions.map((fileExt, i) => validateStringMatches(
                FILE_EXT_PATTERN, fileExt, `${ruleExtractor.getFieldPath('file_extensions')}[${i}]`))
        }

    }
    return {
        rules: {
            ...DEFAULT_CONFIG.rules,
            ...customRules
        }
    };
}

function getDefaultRuleViolationMessage(regex: RegExp, ruleName: string, description: string): string {
    return getMessage('RuleViolationMessage', regex.toString(), ruleName, description)
}

function validateRegex(value: string, fieldName: string): RegExp {
    const match: RegExpMatchArray | null = value.match(/^\/(.*?)\/(.*)$/);
    if (!match) {
        throw new Error(getMessage('InvalidRegexString', value, fieldName));
    }
    const pattern = match[1];
    const modifiers = match[2];

    try {
        return new RegExp(pattern, modifiers);
    } catch (err) {
        throw new Error(getMessage('InvalidRegex', value, fieldName, getErrorMessage(err)))
    }
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    return String(error)
}

/* TODO: Extract to engine API level so there's no code repetition */
function validateStringMatches(pattern: RegExp, value: string, fieldName: string): string {
    if (!pattern.test(value)) {
        throw new Error(getMessage('ConfigStringValueMustMatchPattern', fieldName, value, pattern.source));
    }
    return value;
}
