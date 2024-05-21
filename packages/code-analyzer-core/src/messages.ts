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
        'Engine with name "%s" was added to Code Analyzer.',

    ConfigFileDoesNotExist:
        'The specified configuration file "%s" does not exist.',

    ConfigFileExtensionUnsupported:
        'The specified configuration file "%s" has an unsupported file extension. Supported extensions are: %s',

    ConfigContentFailedToParse:
        'Failed to parse the configuration content. Error:\n%s',

    ConfigContentNotAnObject:
        'The configuration content is invalid since it is of type %s instead of type object.',

    ConfigValueMustBeOfType:
        'The %s configuration value must be of type %s instead of type %s.',

    ConfigValueNotAValidSeverityLevel:
        'The %s configuration value must be one of the following: %s. Instead received: %s',

    ConfigValueNotAValidTagsLevel:
        'The %s configuration value must an array of strings. Instead received: %s',

    ConfigValueFolderMustExist:
        'The folder specified by the %s configuration value does not exist: %s',

    ConfigValueMustBeFolder:
        'The %s configuration value is not a folder: %s',

    RulePropertyOverridden:
        'The %s value of rule "%s" of engine "%s" was overridden according to the specified configuration. The old value of %s was replaced with the new value of %s.',

    FileOrFolderDoesNotExist:
        'The file or folder "%s" does not exist.',

    AtLeastOneFileOrFolderMustBeIncluded:
        'At least one file or folder must be included.',

    EntryPointFileDoesNotExist:
        'The value "%s" is not a valid entry point since the file "%s" does not exist.',

    EntryPointWithMethodMustNotBeFolder:
        'The value "%s" is not a valid entry point since "%s" is a folder instead of a file.',

    InvalidEntryPoint:
        `The value "%s" is not a valid entry point. Expected value to be of the format "<fileOrFolder>", "<file>#<methodName>", or "<file>#<methodName1>;<methodName2>;...".`,

    EntryPointMustBeUnderFilesToInclude:
        'The specified entry point of "%s" does not that exists underneath any of the specified paths: %s',

    RunningWithRunOptions:
        'Running with the following run options: %s',

    RunningEngineWithRules:
        'Running engine "%s" with the following rules: %s',
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