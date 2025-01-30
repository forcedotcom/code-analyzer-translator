import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    ConfigOverview:
        `RETIRE-JS ENGINE CONFIGURATION\n` +
        `To learn more about this configuration, visit:\n` +
        `  https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engine-retire-js.html#retirejs-configuration-reference`,

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
        `An unexpected error was thrown when executing the command '%s'.\nOutput from command:\n%s`,

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
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}