import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    CantCreateEngineWithUnknownEngineName:
        `The RegexEnginePlugin does not support creating an engine with name '%s'.`,

    TrailingWhitespaceRuleDescription:
        `Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.`,

    TrailingWhitespaceRuleMessage:
        `Found trailing whitespace at the end of a line of code.`,

    AvoidTermsWithImplicitBiasRuleDescription:
        `"Detects usage of terms that reinforce implicit bias.`,

    AvoidTermsWithImplicitBiasRuleMessage:
        `A term with implicit bias was found. Avoid using any of the following terms: %s`,

    AvoidOldSalesforceApiVersionsRuleDescription:
        `Detects usages of Salesforce API versions that are 3 or more years old.`,

    AvoidOldSalesforceApiVersionsRuleMessage:
        `Found the use of a Salesforce API version that is 3 or more years old. Avoid using an API version that is <= %d.0.`,

    RuleViolationMessage:
        `A match of the regular expression %s was found for rule '%s': %s`,

    InvalidRegex:
        `The '%s' configuration value is invalid. The value could not be converted into a regular expression: %s`,

    InvalidRuleName:
        `The rule name '%s' defined within the '%s' configuration value is invalid. The rule name must match the regular expression: '%s'`,

    GlobalModifierNotProvided:
        `The '%s' configuration value is invalid. The regex engine does not currently support rules without the 'g' modifier. Please use '%s' instead of '%s'.`,

    ConfigValueNotAValidSeverityLevel:
        `The '%s' configuration value must be one of the following: %s. Instead received: %s`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}