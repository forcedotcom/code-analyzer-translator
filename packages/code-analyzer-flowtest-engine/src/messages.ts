import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG: {[key: string]: string} = {
    CantCreateEngineWithUnknownName: `The FlowTestEnginePlugin does not support creating an engine with name '%s'.`
};

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}