import {EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEnginePlugin} from "../src";
import {FlowTestEngine} from "../src/engine";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

describe('FlowTestEnginePlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new FlowTestEnginePlugin();
    });

    it('#getAvailableNames() returns the FlowTestEngine name', () => {
        expect(plugin.getAvailableEngineNames()).toEqual([FlowTestEngine.NAME]);
    });

    it('#createEngine() returns a FlowTestEngine when asked for one', async () => {
        expect(await plugin.createEngine('flowtest', {})).toBeInstanceOf(FlowTestEngine);
    });

    it('#createEngine() throws error when asked for an unsupported engine', async () => {
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(getMessage('CantCreateEngineWithUnknownName', 'oops'));
    });

})