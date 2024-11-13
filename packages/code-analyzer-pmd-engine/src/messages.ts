import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    PmdConfigOverview:
        `PMD ENGINE CONFIGURATION\n` +
        `To learn more about this configuration, visit: __LINK_COMING_SOON__`,

    SharedConfigFieldDescription_java_command:
        `Indicates the specific 'java' command associated with the JRE or JDK to use for the '%s' engine.\n` +
        `May be provided as the name of a command that exists on the path, or an absolute file path location.\n` +
        `If unspecified, or specified as null, then an attempt will be made to automatically discover a 'java' command from your environment.`,

    PmdConfigFieldDescription_rule_languages:
        `List of languages associated with the PMD rules to be made available for 'pmd' engine rule selection.\n` +
        `The languages that you may choose from are: %s.\n` +
        `See https://pmd.github.io/pmd/tag_rule_references.html to learn about the PMD rules available for each language.`,

    PmdConfigFieldDescription_java_classpath_entries:
        `List of jar files and/or folders to add the Java classpath when running PMD.\n` +
        `Each entry may be given as an absolute path or a relative path to 'config_root'.\n` +
        `This field is primarily used to supply custom Java based rule definitions to PMD.\n` +
        `See https://pmd.github.io/pmd/pmd_userdocs_extending_writing_java_rules.html`,

    PmdConfigFieldDescription_custom_rulesets:
        `List of xml ruleset files containing custom PMD rules to be made available for rule selection.\n` +
        `Each ruleset must be an xml file that is either:\n` +
        `  - on disk (provided as an absolute path or a relative path to 'config_root')\n` +
        `  - or a relative resource found on the Java classpath.\n` +
        `Not all custom rules can be fully defined within an xml ruleset file. For example, Java based rules may be defined in jar files.\n` +
        `In these cases, you will need to also add your additional files to the Java classpath using the 'java_classpath_entries' field.\n` +
        `See https://pmd.github.io/pmd/pmd_userdocs_making_rulesets.html to learn more about PMD rulesets.`,

    CpdConfigOverview:
        `CPD ENGINE CONFIGURATION\n` +
        `To learn more about this configuration, visit: __LINK_COMING_SOON__`,

    CpdConfigFieldDescription_rule_languages:
        `List of languages associated with CPD to be made available for 'cpd' engine rule selection.\n` +
        `The languages that you may choose from are: %s.`,

    CpdConfigFieldDescription_minimum_tokens:
        `The minimum number of tokens required to be in a duplicate block of code in order to be reported as a violation.\n` +
        `The concept of a token may be defined differently per language, but in general it a distinct basic element of source code.\n` +
        `For example, this could be language specific keywords, identifiers, operators, literals, and more.\n` +
        `See https://docs.pmd-code.org/latest/pmd_userdocs_cpd.html to learn more.`,

    CpdConfigFieldDescription_skip_duplicate_files:
        `Indicates whether to ignore multiple copies of files of the same name and length.`,

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
        `The following call to 'java' exited with non-zero exit code.\n` +
        `  Command: %s\n` +
        `  Exit code: %d\n` +
        `  StdErr:\n%s`,

    InvalidRuleLanguage:
        `The '%s' configuration value is invalid. The specified language '%s' is not one of the supported languages: %s`,

    InvalidJavaClasspathEntry:
        `The '%s' configuration value is invalid. The path must either be a '.jar' file or a folder.`,

    ErrorParsingOutputFile:
        `An internal error was thrown when trying to read the internal output file '%s':\n%s'`,

    ProcessingErrorForFile:
        `%s issued a processing error for file '%s':\n%s`,

    CpdTerminatingExceptionThrown:
        `CPD threw an exception while processing files for language '%s' which terminated the CPD process:\n%s`,

    DetectCopyPasteForLanguageRuleDescription:
        `Identify duplicate code blocks within your workspace files associated with the '%s' language.`,

    DetectCopyPasteForLanguageViolationMessage:
        `Duplicate code detected for language '%s'. Found %d code locations containing the same block of code consisting of %d tokens across %d lines.`,

    InvalidPositiveInteger:
        `The '%s' configuration value is invalid. The value must be a positive integer.`,
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}