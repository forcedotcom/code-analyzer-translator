import {
    ConfigObject,
    ConfigValueExtractor,
    EnginePluginV1,
    getMessageFromCatalog,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {RetireJsEnginePlugin} from "../src";
import {RetireJsEngine} from "../src/engine";
import {getMessage} from "../src/messages";

describe('Tests for the RetireJsEnginePlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new RetireJsEnginePlugin();
    });

    it('When the getAvailableEngineNames method is called then only retire-js is returned', () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['retire-js']);
    });

    it('When createEngine is passed retire-js then an RetireJsEngine instance is returned', async () => {
        expect(await plugin.createEngine('retire-js', {})).toBeInstanceOf(RetireJsEngine);
    });

    it('When createEngine is passed anything else then an error is thrown', async () => {
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(
            getMessage('UnsupportedEngineName' ,'oops'));
    });

    it('When createEngineConfig is passed an invalid engine name, then error', async () => {
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({},'engines.retire-js');

        await expect(plugin.createEngineConfig('oops', configValueExtractor)).rejects.toThrow(
            getMessage('UnsupportedEngineName' ,'oops'));
    });

    it('When createEngineConfig is passed an object with an unknown field, then error', async () => {
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({unknownField: 3},'engines.retire-js');

        await expect(plugin.createEngineConfig('retire-js', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.retire-js',
                'unknownField', '[]'));
    });

    it('When createEngineConfig is passed an an empty object, then the normalized config is returned', async () => {
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({},'engines.retire-js');
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig('retire-js', configValueExtractor);
        expect(resolvedConfig).toEqual({});
    });
});