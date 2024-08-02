import {
    ConfigObject,
    Engine,
    EnginePluginV1,
    getMessageFromCatalog,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "../src/messages";
import {ESLintEnginePlugin} from "../src";
import {ESLintEngine} from "../src/engine";
import {DEFAULT_CONFIG, LEGACY_ESLINT_CONFIG_FILES, LEGACY_ESLINT_IGNORE_FILE} from "../src/config";
import path from "node:path";

describe('Tests for the ESLintEnginePlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new ESLintEnginePlugin();
    });

    it('When the getAvailableEngineNames method is called then only eslint is returned', () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['eslint']);
    });

    it('When createEngine is passed eslint and empty config then an ESLintEngine instance is returned with default values', async () => {
        const engine: Engine = await plugin.createEngine('eslint', {});
        expect(engine).toBeInstanceOf(ESLintEngine);
        expect((engine as ESLintEngine).getConfig()).toEqual(DEFAULT_CONFIG);
    });

    it('When createEngine is passed anything else then an error is thrown', async () => {
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(
            getMessage('CantCreateEngineWithUnknownEngineName' ,'oops'));
    });

    it('When value we do not care about is on config, then we ignore it', async () => {
        const engine: ESLintEngine = (await plugin.createEngine('eslint', {dummy: 3})) as ESLintEngine;
        expect(engine.getConfig()).toEqual(DEFAULT_CONFIG);
    });

    it('When non-default config_root is provided to createEngine, then it is set on the config', async () => {
        const engine: ESLintEngine = (await plugin.createEngine('eslint', {config_root: __dirname})) as ESLintEngine;
        expect(engine.getConfig().config_root).toEqual(__dirname);
    });

    it('When config_root is invalid, then createEngine errors', async () => {
        await expect(plugin.createEngine('eslint', {config_root: 3})).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'config_root', 'string', 'number'));
    });

    it('When a valid eslint_config_file is passed to createEngine, then it is set on the config', async () => {
        const rawConfig: ConfigObject = {
            config_root: __dirname,
            eslint_config_file: 'test-data/legacyConfigCases/workspace_HasCustomConfigWithNewRules/.eslintrc.yml'
        };
        const engine: ESLintEngine = (await plugin.createEngine('eslint', rawConfig)) as ESLintEngine;
        expect(engine.getConfig().eslint_config_file).toEqual(
            path.resolve(__dirname, 'test-data', 'legacyConfigCases', 'workspace_HasCustomConfigWithNewRules', '.eslintrc.yml'));
    });

    it('When eslint_config_file value does not exist, then createEngine errors', async () => {
        const rawConfig: ConfigObject = {
            config_root: __dirname,
            eslint_config_file: 'test-data/doesNotExist'
        };
        await expect(plugin.createEngine('eslint', rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist',
                'engines.eslint.eslint_config_file', path.resolve(__dirname, 'test-data', 'doesNotExist')));
    });

    it('When eslint_config_file is not one of the supported legacy config file names, then createEngine errors', async () => {
        const rawConfig: ConfigObject = {
            config_root: path.resolve(__dirname, '..'),
            eslint_config_file: 'eslint.config.mjs'
        };
        await expect(plugin.createEngine('eslint', rawConfig)).rejects.toThrow(
            getMessage('InvalidLegacyConfigFileName', 'engines.eslint.eslint_config_file', 'eslint.config.mjs',
                JSON.stringify(LEGACY_ESLINT_CONFIG_FILES)));
    });

    it('When eslint_ignore_file value does not exist, then createEngine errors', async () => {
        const rawConfig: ConfigObject = {
            config_root: __dirname,
            eslint_ignore_file: 'test-data/doesNotExist/.eslintignore'
        };
        await expect(plugin.createEngine('eslint', rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist',
                'engines.eslint.eslint_ignore_file', path.resolve(__dirname, 'test-data', 'doesNotExist', '.eslintignore')));
    });

    it('When eslint_ignore_file does not have a file name of .eslintignore, then createEngine errors', async () => {
        const rawConfig: ConfigObject = {
            config_root: __dirname,
            eslint_ignore_file: path.join('test-data', 'workspaceWithConflictingConfig.zip')
        };
        await expect(plugin.createEngine('eslint', rawConfig)).rejects.toThrow(
            getMessage('InvalidLegacyIgnoreFileName', 'engines.eslint.eslint_ignore_file',
                'workspaceWithConflictingConfig.zip', LEGACY_ESLINT_IGNORE_FILE));
    });

    it('When auto_discover_eslint_config is passed to createEngine, then it is set on the config', async () => {
        const engine: ESLintEngine = (await plugin.createEngine('eslint', {auto_discover_eslint_config: true})) as ESLintEngine;
        expect(engine.getConfig().auto_discover_eslint_config).toEqual(true);
    });

    it('When auto_discover_eslint_config is invalid, then createEngine errors', async () => {
        await expect(plugin.createEngine('eslint', {auto_discover_eslint_config: 3})).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.auto_discover_eslint_config', 'boolean', 'number'));
    });

    it('When disable_javascript_base_config is passed to createEngine, then it is set on the config', async () => {
        const engine: ESLintEngine = (await plugin.createEngine('eslint', {disable_javascript_base_config: true})) as ESLintEngine;
        expect(engine.getConfig().disable_javascript_base_config).toEqual(true);
    });

    it('When disable_javascript_base_config is invalid, then createEngine errors', async () => {
        await expect(plugin.createEngine('eslint', {disable_javascript_base_config: 'abc'})).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.disable_javascript_base_config', 'boolean', 'string'));
    });

    it('When disable_lwc_base_config is passed to createEngine, then it is set on the config', async () => {
        const engine: ESLintEngine = (await plugin.createEngine('eslint', {disable_lwc_base_config: true})) as ESLintEngine;
        expect(engine.getConfig().disable_lwc_base_config).toEqual(true);
        // Sanity check that false is handled correctly as well
        const engine2: ESLintEngine = (await plugin.createEngine('eslint', {disable_lwc_base_config: false})) as ESLintEngine;
        expect(engine2.getConfig().disable_lwc_base_config).toEqual(false);
    });

    it('When disable_lwc_base_config is invalid, then createEngine errors', async () => {
        await expect(plugin.createEngine('eslint', {disable_lwc_base_config: {}})).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.disable_lwc_base_config', 'boolean', 'object'));
    });

    it('When disable_typescript_base_config is passed to createEngine, then it is set on the config', async () => {
        const engine: ESLintEngine = (await plugin.createEngine('eslint', {disable_typescript_base_config: true})) as ESLintEngine;
        expect(engine.getConfig().disable_typescript_base_config).toEqual(true);
    });

    it('When disable_typescript_base_config is invalid, then createEngine errors', async () => {
        await expect(plugin.createEngine('eslint', {disable_typescript_base_config: 'abc'})).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.disable_typescript_base_config', 'boolean', 'string'));
    });

    it('When a valid javascript_file_extensions value is passed to createEngine, then it is set on the config', async () => {
        const engine: ESLintEngine = (await plugin.createEngine('eslint', {javascript_file_extensions: ['.js', '.jsx', '.js']})) as ESLintEngine;
        expect(engine.getConfig().javascript_file_extensions).toEqual(['.js', '.jsx']); // Also checks that duplicates are removed
    });

    it('When javascript_file_extensions is invalid, then createEngine errors', async () => {
        await expect(plugin.createEngine('eslint', {javascript_file_extensions: [3, '.js']})).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.javascript_file_extensions[0]', 'string', 'number'));
    });

    it('When a valid typescript_file_extensions value is passed to createEngine, then it is set on the config', async () => {
        const engine: ESLintEngine = (await plugin.createEngine('eslint', {typescript_file_extensions: ['.ts', '.tsx']})) as ESLintEngine;
        expect(engine.getConfig().typescript_file_extensions).toEqual(['.ts', '.tsx']);
    });

    it('When typescript_file_extensions is invalid, then createEngine errors', async () => {
        await expect(plugin.createEngine('eslint', {typescript_file_extensions: ['.ts', 'missingDot']})).rejects.toThrow(
            getMessage('ConfigStringValueMustMatchPattern',
                'engines.eslint.typescript_file_extensions[1]', 'missingDot', '^[.][a-zA-Z0-9]+$'));
    });

    it('When an extension is listed in more than one *_file_extensions field, then createEngine errors', async () => {
        const rawConfig: ConfigObject = {
            typescript_file_extensions: ['.ts', '.js']
        };
        await expect(plugin.createEngine('eslint', rawConfig)).rejects.toThrow(
            getMessage('ConfigStringArrayValuesMustNotShareElements',
                `  engines.eslint.javascript_file_extensions: [".js",".cjs",".mjs"]\n` +
                `  engines.eslint.typescript_file_extensions: [".ts",".js"]`));
    });
});