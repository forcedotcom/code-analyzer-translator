import {EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEnginePlugin} from "../src";
import {FlowTestEngine} from "../src/engine";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {StubPythonVersionIdentifier} from "../stubs/lib/python/StubPythonVersionIdentifier";
import {SemVer} from "semver";

changeWorkingDirectoryToPackageRoot();

describe('FlowTestEnginePlugin', () => {

    it('#getAvailableNames() returns the FlowTestEngine name', () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin();
        expect(plugin.getAvailableEngineNames()).toEqual([FlowTestEngine.NAME]);
    });

    it('#createEngine() returns a FlowTestEngine when asked for one', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier(new Map([
            // Simulate the machine having a viable version of Python on it.
            ['python3', new SemVer('3.10.0')]
        ])));
        expect(await plugin.createEngine('flowtest', {})).toBeInstanceOf(FlowTestEngine);
    });

    it('#createEngine() throws error when asked for an unsupported engine', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier(new Map([
            // Simulate the machine having a viable version of Python on it.
            ['python3', new SemVer('3.10.0')]
        ])));
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(getMessage('CantCreateEngineWithUnknownName', 'oops'));
    });

})