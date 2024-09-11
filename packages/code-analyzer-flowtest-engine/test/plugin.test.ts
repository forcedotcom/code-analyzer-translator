import {ConfigObject, ConfigValueExtractor, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEnginePlugin} from "../src";
import {FlowTestEngine} from "../src/engine";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {SemVer} from "semver";
import {PythonVersionDescriptor, PythonVersionIdentifier} from "../src/python/PythonVersionIdentifier";
import {FLOWTEST_ENGINE_CONFIG_DESCRIPTION} from "../src/config";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the FlowTestEnginePlugin', () => {
    it('When getAvailableNames is called, then it returns the FlowTestEngine name', () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin();
        expect(plugin.getAvailableEngineNames()).toEqual([FlowTestEngine.NAME]);
    });

    it('When createEngineConfigDescription is called with an invalid engine name, then error is thrown', () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin();
        expect(() => plugin.describeEngineConfig('oops')).toThrow(getMessage('UnsupportedEngineName','oops'));
    });

    it('When createEngineConfigDescription is with a valid engine name, then return the correct ConfigDescription', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin();
        expect(plugin.describeEngineConfig(FlowTestEngine.NAME)).toEqual(FLOWTEST_ENGINE_CONFIG_DESCRIPTION);
    });

    it('When createEngineConfig is called with an invalid engine name, then error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin();
        await expect(plugin.createEngineConfig('oops', new ConfigValueExtractor({}))).rejects.toThrow(
            getMessage('UnsupportedEngineName','oops'));
    });

    it('When createEngineConfig is called without user provided python command and it is discovered, then the resolved value appears on config', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier());
        const userProvidedOverrides: ConfigObject = {};
        const resolvedConfig: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides);
        expect(resolvedConfig['python_command']).toEqual('python3');
    });

    it('When createEngineConfig is called without user provided python and a valid python version is not discovered, then an error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier(new Map([['python', new SemVer('2.8.0')]])));
        const userProvidedOverrides: ConfigObject = {};
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(getMessage('CouldNotLocatePython',
            '3.10.0', '["python3","python"]', 'engines.flowtest.python_command', FlowTestEngine.NAME, FlowTestEngine.NAME));
    });

    it('When createEngineConfig is called with user provided python and it is valid, then the command is in the config', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier(new Map([
            ['customPython', new SemVer('3.11.0')],
            ['python3', new SemVer('3.10.0')],
        ])));
        const userProvidedOverrides: ConfigObject = {python_command: 'customPython'};
        const resolvedConfig: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides);
        expect(resolvedConfig['python_command']).toEqual('customPython');
    });

    it('When createEngineConfig is called with user provided python that is below supported version, then an error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier(new Map([
            ['customPython', new SemVer('2.0.0')],
            ['python3', new SemVer('3.10.0')],
        ])));
        const userProvidedOverrides: ConfigObject = {python_command: 'customPython'};
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessage('UserSpecifiedPythonBelowMinimumVersion', 'engines.flowtest.python_command', 'customPython',
                '2.0.0', '3.10.0'));
    });

    it('When createEngineConfig is called with user provided python that does not exist, then an error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier());
        const userProvidedOverrides: ConfigObject = {python_command: 'customPython'};
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessage('UserSpecifiedPythonCommandProducedError', 'engines.flowtest.python_command', 'customPython',
                'Some Error Message'));
    });

    it('When createEngineConfig is called with user provided python has a version that is not recognizable, then an error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new NullProducingPythonVersionIdentifier());
        const userProvidedOverrides: ConfigObject = {python_command: 'customPython'};
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessage('UserSpecifiedPythonCommandProducedUnrecognizableVersion', 'engines.flowtest.python_command', 'customPython'));
    });

    it('When createEngine is called with an invalid engine name, then error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier());
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(getMessage('UnsupportedEngineName','oops'));
    });

    it('When createEngine is called with a valid engine name and config, then a FlowTestEngine is returned', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin();
        const resolvedConfig: ConfigObject = {python_command: 'python3'};
        const engine: Engine = await plugin.createEngine(FlowTestEngine.NAME, resolvedConfig);
        expect(engine).toBeInstanceOf(FlowTestEngine);
    });
});

async function callCreateEngineConfig(plugin: EnginePluginV1, userProvidedOverrides: ConfigObject): Promise<ConfigObject> {
    const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(userProvidedOverrides, `engines.${FlowTestEngine.NAME}`);
    return await plugin.createEngineConfig(FlowTestEngine.NAME, configValueExtractor);
}

class StubPythonVersionIdentifier implements PythonVersionIdentifier {
    private versionMap: Map<string, SemVer|null>;

    public constructor(versionMap: Map<string, SemVer|null> = new Map([['python3', new SemVer('3.10.0')]])) {
        this.versionMap = versionMap;
    }

    public identifyPythonVersion(pythonCommand: string): Promise<PythonVersionDescriptor> {
        if (this.versionMap.has(pythonCommand)) {
            const version = this.versionMap.get(pythonCommand)!;
            return Promise.resolve({
                executable: pythonCommand,
                version
            });
        }
        return Promise.reject('Some Error Message');
    }
}

class NullProducingPythonVersionIdentifier implements PythonVersionIdentifier {
    async identifyPythonVersion(pythonCommand: string): Promise<PythonVersionDescriptor> {
        return {
            executable: pythonCommand,
            version: null
        };
    }
}