import {SemVer} from 'semver';
import {
    ConfigObject,
    ConfigValueExtractor,
    EnginePluginV1,
    getMessageFromCatalog,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {SfgeEnginePlugin} from "../src";
import {
    DEFAULT_SFGE_ENGINE_CONFIG,
    SFGE_ENGINE_CONFIG_DESCRIPTION,
    SfgeEngineConfig
} from "../src/config";
import {SfgeEngine} from "../src/engine";
import {JavaVersionIdentifier} from "../src/JavaVersionIdentifier";
import {getMessage} from '../src/messages';

describe('SfgeEnginePlugin', () => {
    let plugin: EnginePluginV1;

    beforeAll(() => {
        plugin = new SfgeEnginePlugin();
    });

    it(`#getAvailableEngineNames() returns 'sfge'`, () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['sfge']);
    });

    describe('#describeEngineConfig', () => {
        it(`When passed 'sfge', the correct config description is returned.`, () => {
            expect(plugin.describeEngineConfig('sfge')).toEqual(SFGE_ENGINE_CONFIG_DESCRIPTION);
        });

        it('When passed an unsupported engine name, an appropriate error is thrown', () => {
            expect(() => plugin.describeEngineConfig('oops')).toThrow(getMessage('UnsupportedEngineName', 'oops'));
        });
    });

    describe('#createEngineConfig', () => {
        it('When passed an unsupported engine name, an appropriate error is thrown', async () => {
           await expect(plugin.createEngineConfig('oops', new ConfigValueExtractor({}, 'engines.oops')))
               .rejects.toThrow(getMessage('UnsupportedEngineName', 'oops'));
        });

        it('When given an object with an unknown field, an appropriate error is thrown', async () => {
            const cve: ConfigValueExtractor = new ConfigValueExtractor({invalidField: 2}, 'engines.sfge');
            await expect(plugin.createEngineConfig('sfge', cve)).rejects.toThrow(
                getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.sfge', 'invalidField',
                    '["java_command"]'));
        });

        describe('When given an empty raw config...', () => {
            it('...and java can be looked up, returns the correct defaults', async () => {
                // This test assumes that all environments that run this test will have JAVA v11+ installed and either has
                // * the JAVA_HOME environment variable points to the home folder of this java command
                // * or has the java command is already on the top of the PATH
                const resolvedConfig: SfgeEngineConfig = await plugin.createEngineConfig('sfge', new ConfigValueExtractor({}, 'engines.sfge')) as SfgeEngineConfig;
                expect(resolvedConfig.java_command.endsWith('java')).toEqual(true);
                expect(resolvedConfig).toEqual({
                    java_command: resolvedConfig.java_command // Already checked that it ends with 'java'
                });
            });

            it(`...and machine's java cannot be looked up, throws an appropriate error`, async () => {
                const pluginWithStub: SfgeEnginePlugin = new SfgeEnginePlugin(new StubJavaVersionIdentifier(null));
                try {
                    await pluginWithStub.createEngineConfig('sfge', new ConfigValueExtractor({}, 'engines.sfge'));
                    fail(`Expected error to be thrown`);
                } catch (err) {
                    const errMsg: string = (err as Error).message;
                    expect(errMsg).toContain('Could not locate Java v11.0.0+');
                    expect(errMsg).toContain(getMessage('UnrecognizableJavaVersion', 'java'));
                }
            });

            it(`...and machine's java version is too old, throws an appropriate error`, async () => {
                const pluginWithStub: SfgeEnginePlugin = new SfgeEnginePlugin(new StubJavaVersionIdentifier(new SemVer('1.8.0')));
                try {
                    await pluginWithStub.createEngineConfig('sfge', new ConfigValueExtractor({}, 'engines.sfge'));
                    fail(`Expected error to be thrown`);
                } catch (err) {
                    const errMsg: string = (err as Error).message;
                    expect(errMsg).toContain('Could not locate Java v11.0.0+');
                    expect(errMsg).toContain(getMessage('JavaBelowMinimumVersion', 'java', '1.8.0', '11.0.0'));
                }
            });
        });

        describe('When given a config with a java_command that is...', () => {
            it('...invalid, an appropriate error is thrown', async () => {
                try {
                    await plugin.createEngineConfig('sfge', new ConfigValueExtractor({java_command: '/does/not/exist/java'}, 'engines.sfge'));
                    fail('Expected error to be thrown');
                } catch (err) {
                    const errMsg: string = (err as Error).message;
                    expect(errMsg).toContain(`The 'engines.sfge.java_command' configuration value is invalid.`);
                    expect(errMsg).toContain(`When attempting to find the version of command '/does/not/exist/java', an error was thrown:`);
                }
            });

            it('...too old, an appropriate error is thrown', async () => {
                const pluginWithStub: SfgeEnginePlugin = new SfgeEnginePlugin(new StubJavaVersionIdentifier(new SemVer('1.9.0')));
                await expect(pluginWithStub.createEngineConfig('sfge', new ConfigValueExtractor({java_command: '/some/java'}, 'engines.sfge'))).rejects.toThrow(
                    getMessage('InvalidUserSpecifiedJavaCommand', 'engines.sfge.java_command',
                        getMessage('JavaBelowMinimumVersion', '/some/java', '1.9.0', '11.0.0')));
            });

            it('...valid and recent, that value is used', async () => {
                const pluginWithStub: SfgeEnginePlugin = new SfgeEnginePlugin(new StubJavaVersionIdentifier(new SemVer('21.4.0')));
                const rawConfig: ConfigObject = {java_command: '/some/java'};
                const normalizedConfig: SfgeEngineConfig = await pluginWithStub.createEngineConfig('sfge',
                    new ConfigValueExtractor(rawConfig, 'engines.sfge')) as SfgeEngineConfig;
                expect(normalizedConfig.java_command).toEqual('/some/java');
            });
        });
    });

    describe('#createEngine', () => {
        it(`When passed 'sfge', returns an SfgeEngine instance`, async () => {
            expect(await plugin.createEngine('sfge', DEFAULT_SFGE_ENGINE_CONFIG)).toBeInstanceOf(SfgeEngine);
        });

        it('When passed an unsupported engine name, throws an appropriate error', async () => {
            await expect(plugin.createEngine('oops', {})).rejects.toThrow(
                getMessage('UnsupportedEngineName', 'oops'));
        });
    });
});

class StubJavaVersionIdentifier implements JavaVersionIdentifier {
    private readonly version: SemVer|null;

    public constructor(version: SemVer|null) {
        this.version = version;
    }

    public identifyJavaVersion(_javaCommand: string): Promise<SemVer|null> {
        return Promise.resolve(this.version);
    }
}