import {
    ConfigObject,
    ConfigValueExtractor,
    getMessageFromCatalog,
    RuleDescription,
    RuleType,
    SeverityLevel,
    SHARED_MESSAGE_CATALOG,
    ValueValidator
} from "@salesforce/code-analyzer-engine-api"
import {getMessage} from "./messages";

export type RegexEngineConfig = {
    // Custom rules to be added to the regex engine
    custom_rules: RegexRules
}

export type RegexRules = {
    // Rule to be added to the regex engine where the key is the rule name and the value contains the rule definition.
    // Example (in yaml format):
    //     NoTodoComments:
    //       regex: /\/\/[ \t]*TODO/gi
    //       file_extensions: [".cls", ".trigger"]
    //       description: "Prevents TODO comments from being in apex code."
    //       violation: "A comment with a TODO statement was found. Please remove TODO statements from your apex code."
    [ruleName: string] : RuleDescription & {
        // The regular expression that triggers a violation when matched against the contents of a file.
        regex: RegExp;

        /// The extensions of the files that you would like to test the regular expression against.
        file_extensions: string[];

        // A description of the rule's purpose.
        description: string;

        // The message emitted when a rule violation occurs. This message is intended to help the user understand the violation.
        // Default: `A match of the regular expression {regex} was found for rule '{ruleName}': {description}`
        violation_message: string;
    }
}

export const FILE_EXT_PATTERN: RegExp = /^[.][a-zA-Z0-9]+$/;
export const RULE_NAME_PATTERN: RegExp = /^[A-Za-z@][A-Za-z_0-9@\-/]*$/;
export const REGEX_STRING_PATTERN: RegExp = /^\/(.*?)\/(.*)$/;

export function validateAndNormalizeConfig(rawConfig: ConfigObject): RegexEngineConfig {
    const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
    const customRulesExtractor: ConfigValueExtractor = valueExtractor.extractObjectAsExtractor('custom_rules');
    const customRules: RegexRules = {};
    for (const ruleName of customRulesExtractor.getKeys()) {
        if (!RULE_NAME_PATTERN.test(ruleName)){
            throw new Error(getMessage('InvalidRuleName', ruleName, customRulesExtractor.getFieldPath(), RULE_NAME_PATTERN.toString()))
        }
        const ruleExtractor: ConfigValueExtractor = customRulesExtractor.extractRequiredObjectAsExtractor(ruleName)
        const description: string = ruleExtractor.extractRequiredString('description')
        const rawRegexString: string = ruleExtractor.extractRequiredString('regex')
        const regex: RegExp = validateRegex(rawRegexString, ruleExtractor.getFieldPath('regex'))
        const rawFileExtensions: string[] = ruleExtractor.extractRequiredArray('file_extensions',
            (element, fieldPath) => ValueValidator.validateString(element, fieldPath, FILE_EXT_PATTERN));

        customRules[ruleName] = {
            regex: regex,
            description: description,
            violation_message: ruleExtractor.extractString('violation_message',
                getDefaultRuleViolationMessage(regex, ruleName, description))!,
            file_extensions: normalizeFileExtensions(rawFileExtensions),

            // Additional fields to complete the RuleDescription:
            name: ruleName,
            type: RuleType.Standard,
            severityLevel: SeverityLevel.Moderate, // This is the default, but user can control this via rule overrides instead of engine config.
            tags: ['Recommended'],                 // This is the default, but user can control this via rule overrides instead of engine config.
            resourceUrls: []                       // Empty for now. We might allow users to add in resourceUrls if we see a valid use case in the future.
        }

    }
    return {
        custom_rules: customRules
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
    const pattern: string = match[1];
    const modifiers: string = match[2];
    try {
        return new RegExp(pattern, modifiers);
    } catch (err) {
        /* istanbul ignore next */
        const errMsg: string = err instanceof Error ? err.message : String(err);
        throw new Error(getMessage('InvalidRegex', value, errMsg), {cause: err});
    }
}

function normalizeFileExtensions(rawFileExts: string[]): string[] {
    return [... new Set(rawFileExts.map(ext => ext.toLowerCase()))];
}