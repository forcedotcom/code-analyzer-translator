import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    CantCreateEngineWithUnknownEngineName:
        `The RegexEnginePlugin does not support creating an engine with name '%s'.`,

    TrailingWhitespaceRuleDescription:
        "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.",

    TrailingWhitespaceRuleMessage:
        "Found trailing whitespace at the end of a line of code.",

    RuleViolationMessage:
        `A match of the regular expression %s was found for rule '%s': %s`,

    InvalidRegexModifier:
        `Inputted modifiers %s for configuration field: %s is not a valid regex modifier string. Please update your user configuration.`,

    InvalidRegexString:
        `Inputted regex %s is not a properly formatted regular expression field at configuration field: %s. Please change the malformed expression.`,

    InvalidRegex:
     `The regex string %s for configuration field %s could not be converted into a regular expression. The following error message was thrown: %s`,

    /*TODO: Move message to shared catalog at engine API level */
    ConfigStringValueMustMatchPattern:
        `The '%s' configuration value '%s' must match the pattern: /%s/`,

    RuleNameCannotBeEmpty:
     `A rule name for configuration field %s was found to be empty. Please create a name for your custom rule.`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}