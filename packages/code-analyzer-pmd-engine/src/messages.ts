import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    UnsupportedEngineName:
        `The PmdCpdEnginesPlugin does not support an engine with name '%s'.`,

    JavaCommandError:
        `The following call to java exited with non-zero exit code.\n` +
        `  Command: %s\n` +
        `  Exit code: %d\n` +
        `  StdErr:\n%s`,

    ErrorParsingPmdWrapperOutputFile:
        `An internal error was thrown when trying to read the internal PmdWrapper output file '%s':\n%s'`,

    PmdProcessingErrorForFile:
        `PMD issued a processing error for file '%s':\n%s`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}