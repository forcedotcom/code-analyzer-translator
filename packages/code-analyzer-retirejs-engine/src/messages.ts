const messageCatalog : { [key: string]: string } = {
    UnsupportedEngineName:
        `The RetireJsEnginePlugin does not support an engine with name '%s'.`,

    RetireJsRuleDescription:
        `Identifies JavaScript libraries with known vulnerabilities of %s severity.`,

    LibraryContainsKnownVulnerability:
        `'%s' contains a known vulnerability.`,

    VulnerableLibraryFoundInZipArchive:
        `'%s' was found inside of the zipped archive in '%s' which contains a known vulnerability.`,

    UpgradeToLatestVersion:
        `Please upgrade to latest version.`,

    VulnerabilityDetails:
        `Vulnerability details: %s`,

    UnexpectedErrorWhenExecutingCommand:
        `An unexpected error was thrown when executing the command '%s': %s`,

    UnexpectedErrorWhenProcessingOutputFile:
        `An unexpected error was thrown when processing the output file '%s': %s`,

    FunctionThrewAnError:
        `The function '%s' threw an error: %s`,

    AllAttemptsToCopyFileHaveFailed:
        `All attempts to copy file '%s' to '%s' have failed.`,

    CouldNotGetZipEntries:
        `Failed to get entries from ZIP file %s. Reason: %s.`,

    CouldNotReadZipEntry:
        `Failed to read entry %s in ZIP file %s. Reason: %s.`,

    CouldNotExtractZip:
        `Failed to extract ZIP file %s. Reason: %s.`
}

/**
 * getMessage - This is the main function to get a message out of the message catalog.
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