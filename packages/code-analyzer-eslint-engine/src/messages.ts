import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    CantCreateEngineWithUnknownEngineName:
        `The ESLintEnginePlugin does not support creating an engine with name '%s'.`,

    InvalidLegacyConfigFileName:
        `The '%s' configuration value was invalid. Expected the file name '%s' to be one of the following: %s`,

    ConfigStringValueMustMatchPattern:
        `The '%s' configuration value '%s' must match the pattern: /%s/`,

    ConfigStringArrayValuesMustNotShareElements:
        `The following configuration values must not share any common array elements between them:\n%s`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}