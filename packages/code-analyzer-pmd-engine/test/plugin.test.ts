import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    ConfigObject,
    ConfigValueExtractor,
    EnginePluginV1,
    getMessageFromCatalog,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {PmdCpdEnginesPlugin} from "../src";
import {getMessage} from "../src/messages";
import {CpdEngine} from "../src/cpd-engine";
import {PmdEngine} from "../src/pmd-engine";
import {DEFAULT_PMD_ENGINE_CONFIG, PMD_ENGINE_CONFIG_DESCRIPTION, PmdEngineConfig} from "../src/config";
import {JavaVersionIdentifier} from "../src/JavaVersionIdentifier";
import { SemVer } from "semver";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the PmdCpdEnginesPlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new PmdCpdEnginesPlugin();
    });

    it(`When the getAvailableEngineNames method is called then both 'cpd' and 'pmd' are returned`, () => {
        // TODO: Will add in 'cpd' only after we have implemented it, so for now we just check for 'pmd'
        expect(plugin.getAvailableEngineNames()).toEqual(['pmd']);
    });

    it(`When describeEngineConfig is passed 'cpd' then the correct config description is returned`, async () => {
        // TODO: Will update expected value when we actually implement the cpd engine
        expect(plugin.describeEngineConfig('cpd')).toEqual({});
    });

    it(`When describeEngineConfig is passed 'pmd' then the correct config description is returned`, async () => {
        expect(plugin.describeEngineConfig('pmd')).toEqual(PMD_ENGINE_CONFIG_DESCRIPTION);

        // Sanity check that we list the correct available languages:
        expect(PMD_ENGINE_CONFIG_DESCRIPTION.fieldDescriptions!['rule_languages']).toEqual(
            getMessage('PmdConfigFieldDescription_rule_languages',
                `'apex', 'html', 'java', 'ecmascript' (or 'javascript'), 'visualforce', 'xml'`));
    });

    it('When describeEngineConfig is passed an unsupported engine name, then an error is thrown', async () => {
        expect(() => plugin.describeEngineConfig('oops')).toThrow(getMessage('UnsupportedEngineName', 'oops'));
    });

    it(`When createEngineConfig is called with 'cpd', then return correct config object`, async () => {
        // TODO: Will update expected value when we actually implement the cpd engine
        expect(await plugin.createEngineConfig('cpd', new ConfigValueExtractor({}, 'engines.cpd'))).toEqual({});
    });

    it(`When createEngineConfig for 'pmd' is given an empty raw config, then the correct defaults are returned (assuming java version is correct on machine)`, async () => {
        // This test assumes that all environments that run this test will have JAVA v11+ installed and either has
        // * the JAVA_HOME environment variable points to the home folder of this java command
        // * or has the java command is already on the top of the PATH
        const resolvedConfig: PmdEngineConfig = await plugin.createEngineConfig('pmd', new ConfigValueExtractor({}, 'engines.pmd')) as PmdEngineConfig;
        expect(resolvedConfig.java_command.endsWith('java')).toEqual(true);
        expect(resolvedConfig).toEqual({
            java_command: resolvedConfig.java_command, // Already checked that it ends with 'java'
            rule_languages: ['apex', 'visualforce']
        });
    });

    it(`When createEngineConfig for 'pmd' is given an empty raw config and if our attempt to look-up java on the users machine fails, then error`, async () => {
        const pluginWithStub: PmdCpdEnginesPlugin =  new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(null));
        try {
            await pluginWithStub.createEngineConfig('pmd', new ConfigValueExtractor({}, 'engines.pmd'));
            fail('Expected error to be thrown');
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain('Could not locate Java v11.0.0+');
            expect(errMsg).toContain(getMessage('UnrecognizableJavaVersion', 'java'));
        }
    });

    it(`When createEngineConfig for 'pmd' is given an empty raw config and if our attempt to look-up java on the users machine produces old java version, then error`, async () => {
        const pluginWithStub: PmdCpdEnginesPlugin = new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(new SemVer('1.8.0')));
        try {
            await pluginWithStub.createEngineConfig('pmd', new ConfigValueExtractor({}, 'engines.pmd'));
            fail('Expected error to be thrown');
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain('Could not locate Java v11.0.0+');
            expect(errMsg).toContain(getMessage('JavaBelowMinimumVersion', 'java', '1.8.0', '11.0.0'));
        }
    });

    it(`When createEngineConfig for 'pmd' is given an invalid java_command, then error`, async () => {
        try {
            await plugin.createEngineConfig('pmd', new ConfigValueExtractor({java_command: '/does/not/exist/java'}, 'engines.pmd'));
            fail('Expected error to be thrown');
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain(`The 'engines.pmd.java_command' configuration value is invalid.`);
            expect(errMsg).toContain(`When attempting to find the version of command '/does/not/exist/java', an error was thrown:`);
        }
    });

    it(`When createEngineConfig for 'pmd' is given a java_command that version less than minimum required, then error`, async () => {
        const pluginWithStub: PmdCpdEnginesPlugin =  new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(new SemVer('1.9.0')));
        await expect(pluginWithStub.createEngineConfig('pmd', new ConfigValueExtractor({java_command: '/some/java'}, 'engines.pmd'))).rejects.toThrow(
            getMessage('InvalidUserSpecifiedJavaCommand', 'engines.pmd.java_command',
                getMessage('JavaBelowMinimumVersion', '/some/java', '1.9.0', '11.0.0')));
    });

    it(`When createEngineConfig for 'pmd' is given a java_command that is greater than the minimum required, then use it`, async () => {
        const pluginWithStub: PmdCpdEnginesPlugin =  new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(new SemVer('21.4.0')));
        const rawConfig: ConfigObject = {java_command: '/some/java'};
        const normalizedConfig: PmdEngineConfig = await pluginWithStub.createEngineConfig('pmd',
            new ConfigValueExtractor(rawConfig, 'engines.pmd')) as PmdEngineConfig;
        expect(normalizedConfig.java_command).toEqual('/some/java');
    })

    it(`When createEngineConfig for 'pmd' is given an valid list of rule languages, then normalize it`, async () => {
        const rawConfig: ConfigObject = {rule_languages: ['APEX', 'xml', 'VisualForce', 'jaVA', 'java']};
        const normalizedConfig: PmdEngineConfig = await plugin.createEngineConfig('pmd',
            new ConfigValueExtractor(rawConfig, 'engines.pmd')) as PmdEngineConfig;
        expect(normalizedConfig.rule_languages).toEqual(['apex', 'java', 'visualforce', 'xml']);
    });

    it(`When createEngineConfig for 'pmd' is given javascript among the list of rule languages, then normalize it to equal ecmascript`, async () => {
        const rawConfig: ConfigObject = {rule_languages: ['apex', 'javascript']};
        const normalizedConfig: PmdEngineConfig = await plugin.createEngineConfig('pmd',
            new ConfigValueExtractor(rawConfig, 'engines.pmd')) as PmdEngineConfig;
        expect(normalizedConfig.rule_languages).toEqual(['apex', 'ecmascript']);
    });

    it(`When createEngineConfig for 'pmd' is given both javascript and ecmascrijpt among the list of rule languages, then remove dups`, async () => {
        const rawConfig: ConfigObject = {rule_languages: ['xml', 'javaScript', 'EcmaScript']};
        const normalizedConfig: PmdEngineConfig = await plugin.createEngineConfig('pmd',
            new ConfigValueExtractor(rawConfig, 'engines.pmd')) as PmdEngineConfig;
        expect(normalizedConfig.rule_languages).toEqual(['ecmascript', 'xml']);
    });

    it(`When createEngineConfig for 'pmd' is given an empty list of rule languages, then use it`, async () => {
        const rawConfig: ConfigObject = {rule_languages: []};
        const normalizedConfig: PmdEngineConfig = await plugin.createEngineConfig('pmd',
            new ConfigValueExtractor(rawConfig, 'engines.pmd')) as PmdEngineConfig;
        expect(normalizedConfig.rule_languages).toEqual([]);
    });

    it(`When createEngineConfig for 'pmd' is given an value that is not a string array, then error`, async () => {
        const rawConfig1: ConfigObject = {rule_languages: 'apex'}; // String is not a string array
        await expect(plugin.createEngineConfig('pmd', new ConfigValueExtractor(rawConfig1, 'engines.pmd')))
            .rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.pmd.rule_languages', 'array', 'string'));
        const rawConfig2: ConfigObject = {rule_languages: ['apex', 5]}; // 5 is not a string
        await expect(plugin.createEngineConfig('pmd', new ConfigValueExtractor(rawConfig2, 'engines.pmd')))
            .rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.pmd.rule_languages[1]', 'string', 'number'));
    });

    it(`When createEngineConfig for 'pmd' is given an unsupported rule language, then error`, async () => {
        const rawConfig: ConfigObject = {rule_languages: ['apex', 'cpp', 'xml']}; // We don't support cpp
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd');
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessage('InvalidRuleLanguage', 'engines.pmd.rule_languages', 'cpp',
                `'apex', 'html', 'java', 'ecmascript' (or 'javascript'), 'visualforce', 'xml'`));
    });

    it('When createEngineConfig is called with an unsupported engine name, then an error is thrown', async () => {
        await expect(plugin.createEngineConfig('oops', new ConfigValueExtractor({}))).rejects.toThrow(
            getMessage('UnsupportedEngineName', 'oops'));
    });

    it(`When createEngine is passed 'cpd' then the CpdEngine is returned`, async () => {
        expect(await plugin.createEngine('cpd', {})).toBeInstanceOf(CpdEngine);
    });

    it(`When createEngine is passed 'pmd' then the PmdEngine is returned`, async () => {
        expect(await plugin.createEngine('pmd', DEFAULT_PMD_ENGINE_CONFIG)).toBeInstanceOf(PmdEngine);
    });

    it('When createEngine is passed an unsupported engine name, then an error is thrown', async () => {
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(
            getMessage('UnsupportedEngineName', 'oops'));
    });
});

class StubJavaVersionIdentifier implements JavaVersionIdentifier {
    private readonly version: SemVer|null;

    constructor(version: SemVer|null) {
        this.version = version;
    }

    async identifyJavaVersion(_javaCommand: string): Promise<SemVer|null> {
        return this.version;
    }
}