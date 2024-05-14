const messageCatalog : { [key: string]: string } = {
    EngineFromFutureApiDetected:
        'The following engines use the engine api version %d: %s.\n' +
        'This version of Code Analyzer only has knowledge of the %d engine api.\n' +
        'Therefore some capabilities from these engines may not fully work with this version of Code Analyzer.',

    DuplicateEngine:
        'Failed to add engine with name "%s" because an engine with this name has already been added to Code Analyzer.',

    EngineNameContradiction:
        'Failed to add engine with name "%s" because its getName() method returns a different name of "%s".',

    EngineValidationFailed:
        'Failed to add engine with name "%s" because it failed validation:\n%s',

    PluginErrorFromGetAvailableEngineNames:
        `Failed to add engine plugin since the plugin's getAvailableNames method through an error:\n%s`,

    PluginErrorFromCreateEngine:
        `Failed to create engine with name "%s" since the plugin's createEngine method through an error:\n%s`,

    EngineAdded:
        'Engine with name "%s" was added to Code Analyzer.'
}

/**
 * getMessage - This is the main entry point to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    const messageTemplate = messageCatalog[msgId];
    if (messageTemplate === undefined) {
        throw new Error(`Message with id "${msgId}" does not exist in the message catalog.`);
    }
    const argsLength = args.length; // Capturing length here because once we shift, it'll change.
    let replaceCount = 0;
    const message: string = messageTemplate.replace(/%[sd]/g, (match) => {
        replaceCount++;
        return String(args.shift() ?? match)
    });
    if (replaceCount != argsLength) {
        throw new Error(`Incorrect length of args for the call to getMessage('${msgId}',...args).\n`
            + `Expected length: ${replaceCount}. Actual length: ${argsLength}.`);
    }
    return message;
}