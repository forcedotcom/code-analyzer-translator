import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    CantCreateEngineWithUnknownEngineName:
        `The ESLintEnginePlugin does not support creating an engine with name '%s'.`,

    InvalidLegacyConfigFileName:
        `The '%s' configuration value was invalid. Expected the file name '%s' to be one of the following: %s`,

    InvalidLegacyIgnoreFileName:
        `The '%s' configuration value was invalid. Expected the file name '%s' to be equal to '%s'.`,

    ConfigStringValueMustMatchPattern:
        `The '%s' configuration value '%s' must match the pattern: /%s/`,

    ConfigStringArrayValuesMustNotShareElements:
        `The following configuration values must not share any common array elements between them:\n%s`,

    ESLintErroredWhenScanningFile:
        `When scanning file '%s' with the eslint engine, ESLint gave the following error:\n%s`,

    ESLintWarnedWhenScanningFile:
        `When scanning file '%s' with the eslint engine, ESLint gave the following warning:\n%s`,

    ESLintThrewExceptionWithPluginConflictMessage:
        `The eslint engine encountered a conflict between a plugin supplied by one of your ESLint configuration ` +
        `files and a plugin supplied by the base configuration.\n` +
        `To continue to use your custom config you may need to disable one or more of the provided base ` +
        `configurations, by setting one or more of the following fields to true in your Code Analyzer configuration:\n` +
        `  engines:\n` +
        `    eslint:\n` +
        `      disable_javascript_base_config: true\n` +
        `      disable_lwc_base_config: true\n` +
        `      disable_typescript_base_config: true\n` +
        `Alternatively, you can use continue to use the base config by disabling your custom config by ` +
        `setting 'eslint_config_file' to null and setting 'auto_discover_eslint_config' to false inside of your Code ` +
        `Analyzer configuration:\n` +
        `  engines:\n` +
        `    eslint:\n` +
        `      eslint_config_file: null\n` +
        `      auto_discover_eslint_config: false\n\n` +
        `Error thrown from %s': %s\n\n` +
        'ESLint options used: %s',

    ESLintThrewExceptionWithUnknownMessage:
        `The eslint engine encountered an unexpected error thrown from '%s': %s\n\n` +
        'ESLint options used: %s',

    ViolationFoundFromUnregisteredRule:
        `A rule with name '%s' produced a violation, but this rule was not registered with the 'eslint' engine so it will not be included in the results.\n` +
        `This may occur if in your file you are using inline comments to attempt to disable or configure this rule even though it is unknown to ESLint and Code Analyzer.\n` +
        `Ignored Violation:\n%s`,

    UnusedEslintConfigFile:
        `The ESLint configuration file '%s' was found but not applied.\n` +
        `To apply this configuration file, set it as the eslint_config_file value in your Code Analyzer configuration. For example:\n` +
        `  engines:\n` +
        `    eslint:\n` +
        `      eslint_config_file: "%s"\n` +
        `Alternatively, to have Code Analyzer automatically discover and apply any ESLint configuration and ignore files found in your workspace, set the auto_discover_eslint_config value to true.`,

    UnusedEslintIgnoreFile:
        `The ESLint ignore file '%s' was found but not applied.\n` +
        `To apply this ignore file, set it as the eslint_ignore_file value in your Code Analyzer configuration. For example:\n` +
        `  engines:\n` +
        `    eslint:\n` +
        `      eslint_ignore_file: "%s"\n` +
        `Alternatively, to have Code Analyzer automatically discover and apply any ESLint configuration and ignore files found in your workspace, set the auto_discover_eslint_config value to true.`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}