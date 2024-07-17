import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    CantCreateEngineWithUnknownEngineName:
        `The RegexEnginePlugin does not support creating an engine with name '%s'.`,

    TrailingWhitespaceRuleDescription:
        "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.",

    PrivateMethodApiVersionRuleDescription:
        "For API versions 60.0 and below, declaring a private method in an abstract or virtual class will override a method with the same signature in a child class. Please update your API version to resolve the issue."
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}