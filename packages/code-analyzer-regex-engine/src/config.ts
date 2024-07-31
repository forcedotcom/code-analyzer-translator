import {
    ConfigObject,
    ConfigValueExtractor, getMessageFromCatalog, SHARED_MESSAGE_CATALOG,
    ValueValidator
} from "@salesforce/code-analyzer-engine-api"
import {getMessage} from "./messages";

export type RegexEngineConfig = {
    // A complete set of regex rules to be executed by the engine.
    rules: RegexRuleMap
}

export type RegexRuleMap = {
    // A collection of rules where the key is the rule name and the value is the rule itself.
    [ruleName: string] : RegexRule
}

export type RegexRule = {
    // The regular expression to match against. Emits a violation if a match is found.
    // Required field.
    regex: RegExp;

    /// The file extensions to which the rule applies.
    // Required field.
    file_extensions: string[];

    // A description of the rule's purpose.
    // Required field.
    description: string;

    // The message emitted when a rule violation occurs. This message is intended to help the user rectify the issue.
    // Default: `A match of the regular expression {regex} was found for rule '{ruleName}': {description}`
    violation_message: string;
}

const APEX_CLASS_FILE_EXT: string = ".cls";

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

export const FILE_EXT_PATTERN: RegExp = /^[.][a-zA-Z0-9]+$/;
export const RULE_NAME_PATTERN: RegExp = /^[A-Za-z@][A-Za-z_0-9@\-/]*$/;
export const REGEX_STRING_PATTERN: RegExp = /^\/(.*?)\/(.*)$/;

const RULES_FIELD_NAME: string = 'custom_rules';
const REGEX_ENGINE_ROOT: string = 'engines.regex';

export function validateAndNormalizeConfig(rawConfig: ConfigObject): RegexEngineConfig {
    const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, REGEX_ENGINE_ROOT);
    const customRulesExtractor: ConfigValueExtractor = valueExtractor.extractObjectAsExtractor(RULES_FIELD_NAME);
    const customRules: RegexRuleMap = {};

    for (const ruleName of customRulesExtractor.getKeys()) {
        if (!RULE_NAME_PATTERN.test(ruleName)){
            throw new Error(getMessage('InvalidRuleName', ruleName, customRulesExtractor.getFieldPath(), RULE_NAME_PATTERN.toString()))
        }
        const ruleExtractor: ConfigValueExtractor = customRulesExtractor.extractRequiredObjectAsExtractor(ruleName)
        const description: string = ruleExtractor.extractRequiredString('description')
        const rawRegexString: string = ruleExtractor.extractRequiredString('regex')
        const regex: RegExp = validateRegex(rawRegexString, ruleExtractor.getFieldPath('regex'))

        customRules[ruleName] = {
            regex: regex,
            description: description,
            violation_message: ruleExtractor.extractString('violation_message', getDefaultRuleViolationMessage(regex, ruleName, description))!,
            file_extensions: ruleExtractor.extractRequiredArray('file_extensions',
                (element, fieldPath) => ValueValidator.validateString(element, fieldPath, FILE_EXT_PATTERN))
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
    const match: RegExpMatchArray | null = value.match(REGEX_STRING_PATTERN);
    if (!match) {
        throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustMatchRegExp',
            fieldName, REGEX_STRING_PATTERN.toString()));
    }
    const pattern = match[1];
    const modifiers = match[2];

    try {
        return new RegExp(pattern, modifiers);
    } catch (err) {
        throw new Error(getMessage('InvalidRegex', value, getErrorMessage(err)))
    }
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    return String(error)
}