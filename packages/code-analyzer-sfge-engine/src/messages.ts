import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    ConfigOverview:
        `SFGE ENGINE CONFIGURATION\n` +
        `To learn more about this configuration, visit:\n` +
        `  [PLACEHOLDER LINK]`,

    ConfigFieldDescription_java_command:
        `Indicates the specific 'java' command associated with the JRE or JDK to use for the SFGE engine.\n` +
        `May be provided as the name of a command that exists on the path, or an absolute file path location.\n` +
        `If unspecified, or specified as null, then an attempt will be made to automatically discover a 'java' command from your environment.`,

    CouldNotLocateJava:
        `Could not locate Java v%s+.\n` +
        `%s\n` +
        `If you have Java installed, specify the command in your Code Analyzer configuration as the value of property '%s'.\n` +
        `If you choose not to install Java, you may disable the corresponding engine in your Code Analyzer configuration by setting '%s' to true.`,

    InvalidUserSpecifiedJavaCommand:
        `The '%s' configuration value is invalid. %s`,

    JavaBelowMinimumVersion:
        `The command '%s' specifies Java v%s, which is below minimum supported version v%s.`,

    JavaVersionCheckProducedError:
        `When attempting to find the version of command '%s', an error was thrown:\n%s`,

    UnrecognizableJavaVersion:
        `The command '%s' does not seem to be a recognizable version of Java.`,

    UnsupportedEngineName:
        `The SfgeEnginePlugin does not support an engine with the name '%s'.`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}