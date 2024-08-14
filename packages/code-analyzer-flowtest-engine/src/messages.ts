import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG: {[key: string]: string} = {
    CantCreateEngineWithUnknownName: `The FlowTestEnginePlugin does not support creating an engine with name '%s'.`,
    CouldNotParseVersionFromOutput: `Could not parse a version number from output of '%s': %s`,
    UserSpecifiedUnrecognizablePython: `Config property '%s' specifies '%s', which is not a recognizable version of Python.`,
    UserSpecifiedPythonBelowMinimumVersion: `Config property '%s' value '%s' specifies Python v%s, which is below minimum supported version v%s.`,
    CouldNotLocatePython: `Could not locate a Python v%s+ install in any of the following: [%s]; Manually specify one with config property '%s'.`
};

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}