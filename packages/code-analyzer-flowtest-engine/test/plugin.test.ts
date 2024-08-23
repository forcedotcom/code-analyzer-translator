import {Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEnginePlugin} from "../src";
import {FlowTestEngine} from "../src/engine";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {SemVer} from "semver";
import {PythonVersionIdentifier} from "../src/PythonVersionIdentifier";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the FlowTestEnginePlugin', () => {
    it('When getAvailableNames is called, then it returns the FlowTestEngine name', () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin();
        expect(plugin.getAvailableEngineNames()).toEqual([FlowTestEngine.NAME]);
    });

    it('When createEngine is called in invalid engine name, then error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier());
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(getMessage('CantCreateEngineWithUnknownName','oops'));
    });

    it('When createEngine is called without user provided python command and it is discovered, then a FlowTestEngine is returned with the command in its config', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier());
        const engine: Engine = await plugin.createEngine(FlowTestEngine.NAME, {});
        expect(engine).toBeInstanceOf(FlowTestEngine);
        expect((engine as FlowTestEngine).getConfig()).toEqual({
            python_command: 'python3'
        });
    });

    it('When createEngine is called without user provided python and a valid python version is not discovered, then an error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier(new Map([['python', new SemVer('2.8.0')]])));
        await expect(plugin.createEngine(FlowTestEngine.NAME, {})).rejects.toThrow(getMessage('CouldNotLocatePython',
            '3.10.0', '["python3","python"]', 'engines.flowtest.python_command', FlowTestEngine.NAME, FlowTestEngine.NAME));
    });

    it('When createEngine is called with user provided python and it is valid, then a FlowTestEngine is returned with the command in its config', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier(new Map([
            ['customPython', new SemVer('3.11.0')],
            ['python3', new SemVer('3.10.0')],
        ])));
        const engine: Engine = await plugin.createEngine(FlowTestEngine.NAME, {python_command: 'customPython'});
        expect(engine).toBeInstanceOf(FlowTestEngine);
        expect((engine as FlowTestEngine).getConfig()).toEqual({
            python_command: 'customPython'
        });
    });

    it('When createEngine is called with user provided python that is below supported version, then an error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier(new Map([
            ['customPython', new SemVer('2.0.0')],
            ['python3', new SemVer('3.10.0')],
        ])));
        await expect(plugin.createEngine(FlowTestEngine.NAME, {python_command: 'customPython'})).rejects.toThrow(
            getMessage('UserSpecifiedPythonBelowMinimumVersion', 'engines.flowtest.python_command', 'customPython',
                '2.0.0', '3.10.0'));
    });

    it('When createEngine is called with user provided python that does not exist, then an error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new StubPythonVersionIdentifier());
        await expect(plugin.createEngine(FlowTestEngine.NAME, {python_command: 'customPython'})).rejects.toThrow(
            getMessage('UserSpecifiedPythonCommandProducedError', 'engines.flowtest.python_command', 'customPython',
                'Some Error Message'));
    });

    it('When createEngine is called with user provided python has a version that is not recognizable, then an error is thrown', async () => {
        const plugin: EnginePluginV1 = new FlowTestEnginePlugin(new NullProducingPythonVersionIdentifier());
        await expect(plugin.createEngine(FlowTestEngine.NAME, {python_command: 'customPython'})).rejects.toThrow(
            getMessage('UserSpecifiedPythonCommandProducedUnrecognizableVersion', 'engines.flowtest.python_command', 'customPython'));
    });
});

class StubPythonVersionIdentifier implements PythonVersionIdentifier {
    private versionMap: Map<string, SemVer|null>;

    public constructor(versionMap: Map<string, SemVer|null> = new Map([['python3', new SemVer('3.10.0')]])) {
        this.versionMap = versionMap;
    }

    public identifyPythonVersion(pythonCommand: string): Promise<SemVer|null> {
        if (this.versionMap.has(pythonCommand)) {
            return Promise.resolve(this.versionMap.get(pythonCommand) as SemVer);
        }
        return Promise.reject('Some Error Message');
    }
}

class NullProducingPythonVersionIdentifier implements PythonVersionIdentifier {
    async identifyPythonVersion(_pythonCommand: string): Promise<SemVer | null> {
        return null;
    }
}