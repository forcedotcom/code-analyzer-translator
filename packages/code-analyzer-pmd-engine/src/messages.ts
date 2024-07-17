import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    CantCreateEngineWithUnknownEngineName:
        `The PmdCpdEnginesPlugin does not support creating an engine with name '%s'.`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}