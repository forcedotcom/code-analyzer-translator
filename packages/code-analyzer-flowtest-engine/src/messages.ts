import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG: {[key: string]: string} = {
    CantCreateEngineWithUnknownName: `The FlowTestEnginePlugin does not support creating an engine with name '%s'.`,
    CouldNotParseVersionFromOutput: `Could not parse a version from output of '%s': %s`,
    PythonReceivedFromConfig: `Received '%s' from config property %s`,
    ConfigDoesNotSpecifyPython: `Config has no value for '%s', attempting to auto-derive Python version`,
    PythonVersionAcceptable: `'%s' corresponds to Python v%s, which is acceptable`,
    PythonVersionUnacceptable: `'%s' corresponds to Python v%s, which is unacceptable`,
    PythonVersionNonfunctional: `'%s' does not correspond to a valid Python version`,
    CouldNotLocatePython: `Could not locate a Python v%s+ install in any of the following: [%s]; Manually specify one with config property '%s'.`
};

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}