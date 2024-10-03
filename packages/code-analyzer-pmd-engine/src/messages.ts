import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    PmdConfigOverview:
        `PMD ENGINE CONFIGURATION\n` +
        `To learn more about this configuration, visit: __LINK_COMING_SOON__`,

    PmdConfigFieldDescription_java_command:
        `Indicates the specific 'java' command associated with the JRE or JDK to use for the 'pmd' engine.\n` +
        `May be provided as the name of a command that exists on the path, or an absolute file path location.\n` +
        `If unspecified, or specified as null, then an attempt will be made to automatically discover a 'java' command from your environment.`,

    UnsupportedEngineName:
        `The PmdCpdEnginesPlugin does not support an engine with name '%s'.`,

    InvalidUserSpecifiedJavaCommand:
        `The '%s' configuration value is invalid. %s`,

    JavaVersionCheckProducedError:
        `When attempting to find the version of command '%s', an error was thrown:\n%s`,

    UnrecognizableJavaVersion:
        `The command '%s' does not seem to be a recognizable version of Java.`,

    JavaBelowMinimumVersion:
        `The command '%s' specifies Java v%s, which is below minimum supported version v%s.`,

    CouldNotLocateJava:
        `Could not locate Java v%s+.\n` +
        `%s\n` +
        `If you have Java installed, specify the command in your Code Analyzer configuration as the value of property '%s'.\n` +
        `If you choose not to install Java, you may disable the corresponding engine in your Code Analyzer configuration by setting '%s' to true.`,

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