import {
    ConfigObject,
    ConfigValue,
    ConfigValueExtractor,
    getMessageFromCatalog,
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
    // Custom rules to be added to the 'regex' engine of the format custom_rules.<rule_name>.<rule_property_name> = <value> where
    // <rule_name> is the name you would like to give to your custom rule
    // Example (in yaml format):
    //     NoTodoComments:
    //       regex: /\/\/[ \t]*TODO/gi
    //       file_extensions: [".cls", ".trigger"]
    //       description: "Prevents TODO comments from being in Apex code."
    //       violation: "A comment with a TODO statement was found. Please remove TODO statements from your Apex code."
    //       severity: "Info"
    //       tags: ['TechDebt']
    [ruleName: string] : RegexRule
}

export type RegexRule = {
    // The regular expression that triggers a violation when matched against the contents of a file.
    regex: RegExp;

    // The extensions of the files that you would like to test the regular expression against.
    // If not defined, or equal to null, then all text-based files of any file extension will be tested.
    file_extensions?: string[];

    // A description of the rule's purpose.
    description: string;

    // [Optional] The message emitted when a rule violation occurs. This message is intended to help the user understand the violation.
    // Default: `A match of the regular expression <regex> was found for rule '<ruleName>': <description>`
    violation_message: string;

    // [Optional] The string array of tag values to apply to this rule by default.
    // Default: ['Recommended']
    tags: string[];

    // [Optional] The severity level to apply to this rule by default.
    // Possible values: 1 or 'Critical', 2 or 'High', 3 or 'Moderate', 4 or 'Low', 5 or 'Info'
    // Default: 'Moderate'
    severity: SeverityLevel;
}

export const FILE_EXT_PATTERN: RegExp = /^[.][a-zA-Z0-9]+$/;
export const RULE_NAME_PATTERN: RegExp = /^[A-Za-z@][A-Za-z_0-9@\-/]*$/;
export const REGEX_STRING_PATTERN: RegExp = /^\/(.*?)\/(.*)$/;

export const DEFAULT_TAGS: string[] = ['Recommended'];
export const DEFAULT_SEVERITY_LEVEL: SeverityLevel = SeverityLevel.Moderate;

export function validateAndNormalizeConfig(rawConfig: ConfigObject): RegexEngineConfig {
    const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
    const customRulesExtractor: ConfigValueExtractor = valueExtractor.extractObjectAsExtractor('custom_rules');
    const customRules: RegexRules = {};
    for (const ruleName of customRulesExtractor.getKeys()) {
        if (!RULE_NAME_PATTERN.test(ruleName)){
            throw new Error(getMessage('InvalidRuleName', ruleName, customRulesExtractor.getFieldPath(), RULE_NAME_PATTERN.toString()));
        }
        const ruleExtractor: ConfigValueExtractor = customRulesExtractor.extractRequiredObjectAsExtractor(ruleName);
        const description: string = ruleExtractor.extractRequiredString('description');
        const rawRegexString: string = ruleExtractor.extractRequiredString('regex');
        const regex: RegExp = validateRegex(rawRegexString, ruleExtractor.getFieldPath('regex'));
        const rawFileExtensions: string[] | undefined = ruleExtractor.extractArray('file_extensions',
            (element, fieldPath) => ValueValidator.validateString(element, fieldPath, FILE_EXT_PATTERN));
        const rawSeverityLevelValue: ConfigValue = ruleExtractor.getObject()['severity'];

        customRules[ruleName] = {
            regex: regex,
            description: description,
            violation_message: ruleExtractor.extractString('violation_message',
                getDefaultRuleViolationMessage(regex, ruleName, description))!,
            severity: rawSeverityLevelValue ?
                validateSeverityValue(rawSeverityLevelValue, ruleExtractor.getFieldPath('severity')) : DEFAULT_SEVERITY_LEVEL,
            tags: ruleExtractor.extractArray('tags', ValueValidator.validateString, DEFAULT_TAGS)!,
            ...(rawFileExtensions ? { file_extensions: normalizeFileExtensions(rawFileExtensions) } : {}),
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

    if (!modifiers.includes('g')){
        throw new Error(getMessage('GlobalModifierNotProvided', fieldName, `/${pattern}/g${modifiers}`, value));
    }

    try {
        return new RegExp(pattern, modifiers);
    } catch (err) {
        /* istanbul ignore next */
        const errMsg: string = err instanceof Error ? err.message : String(err);
        throw new Error(getMessage('InvalidRegex', fieldName, errMsg), {cause: err});
    }
}

function validateSeverityValue(value: unknown, fieldName: string): SeverityLevel {
    // Note that Object.values(SeverityLevel) returns [1,2,3,4,5,"Critical","High","Moderate","Low","Info"]
    if ((typeof value !== 'string' && typeof value !== 'number')
        || !Object.values(SeverityLevel).includes(value as string | number)) {
        throw new Error(getMessage('ConfigValueNotAValidSeverityLevel', fieldName,
            JSON.stringify(Object.values(SeverityLevel)), JSON.stringify(value)));
    }
    if (typeof value === 'string') {
        // We can't type cast to enum from a string, so instead we choose the enum based on the string as a key.
        value = SeverityLevel[value as keyof typeof SeverityLevel];
    }
    // We can type cast to enum safely from a number
    return value as SeverityLevel;
}

function normalizeFileExtensions(rawFileExts: string[]): string[] {
    return [... new Set(rawFileExts.map(ext => ext.toLowerCase()))];
}