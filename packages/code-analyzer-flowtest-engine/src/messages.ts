import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG: {[key: string]: string} = {
    CantCreateEngineWithUnknownName:
        `The FlowTestEnginePlugin does not support creating an engine with name '%s'.`,

    CouldNotParseVersionFromOutput:
        `Could not parse a version number from output of '%s': %s`,

    UserSpecifiedPythonCommandProducedUnrecognizableVersion:
        `The '%s' configuration value was invalid. The command '%s' does not seem to be a recognizable version of Python.`,

    UserSpecifiedPythonCommandProducedError:
        `The '%s' configuration value was invalid. When attempting to find the version of command '%s', an error was thrown: %s`,

    UserSpecifiedPythonBelowMinimumVersion:
        `The '%s' configuration value was invalid. The command '%s' specifies Python v%s, which is below minimum supported version v%s.`,

    CouldNotLocatePython:
        `Could not locate a Python v%s+ install using any of the following: %s.\n` +
        `If you have python installed, specify the command in your Code Analyzer configuration as the value of property '%s'.\n` +
        `If you choose not to install python, you may disable the '%s' engine in your Code Analyzer configuration by setting 'engines.%s.disable_engine' to true.`
};

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}