import {CodeAnalyzerConfig, SeverityLevel} from "../src";
import * as os from "node:os";
import * as path from "node:path";
import {getMessageFromCatalog, SHARED_MESSAGE_CATALOG} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

const DEFAULT_CONFIG_ROOT: string = process.cwd();
const TEST_DATA_DIR: string = path.resolve(__dirname, 'test-data');

describe("Tests for creating and accessing configuration values", () => {
    it("When constructing config withDefaults then default values are returned", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();

        expect(conf.getConfigRoot()).toEqual(DEFAULT_CONFIG_ROOT);
        expect(conf.getLogFolder()).toEqual(os.tmpdir());
        expect(conf.getCustomEnginePluginModules()).toEqual([]);
        expect(conf.getRuleOverridesFor("stubEngine1")).toEqual({});
        expect(conf.getEngineConfigFor("stubEngine1")).toEqual({config_root: DEFAULT_CONFIG_ROOT});
        expect(conf.getRuleOverridesFor("stubEngine2")).toEqual({});
        expect(conf.getEngineConfigFor("stubEngine2")).toEqual({config_root: DEFAULT_CONFIG_ROOT});
    });

    it("When configuration file does not exist, then throw an error", () => {
        const nonExistingFile: string = path.resolve(__dirname, "doesNotExist");
        expect(() => CodeAnalyzerConfig.fromFile(nonExistingFile)).toThrow(
            getMessage('ConfigFileDoesNotExist', nonExistingFile));
    });

    it("When configuration file has unsupported extension, then throw an error", () => {
        const fileWithBadExtension: string = path.resolve(__dirname, "config.test.ts");
        expect(() => CodeAnalyzerConfig.fromFile(fileWithBadExtension)).toThrow(
            getMessage('ConfigFileExtensionUnsupported', fileWithBadExtension, 'json,yaml,yml'));
        const fileWithNoExtension: string = path.resolve(__dirname, "..", "LICENSE");
        expect(() => CodeAnalyzerConfig.fromFile(fileWithNoExtension)).toThrow(
            getMessage('ConfigFileExtensionUnsupported', fileWithNoExtension, 'json,yaml,yml'));
    });

    it("When constructing config from yaml file then values from file are parsed correctly", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-01.yaml'));
        expect(conf.getConfigRoot()).toEqual(TEST_DATA_DIR);
        expect(conf.getLogFolder()).toEqual(path.join(TEST_DATA_DIR, 'sampleLogFolder'));
        expect(conf.getRuleOverridesFor('stubEngine1')).toEqual({
            stub1RuleB: {
                severity: SeverityLevel.Critical
            },
            stub1RuleD: {
                severity: SeverityLevel.Info,
                tags: ['Recommended', 'CodeStyle']
            }
        });
        expect(conf.getRuleOverridesFor('stubEngine2')).toEqual({
            stub2RuleA: {
                tags: ['Security', "SomeNewTag"]
            }
        });
        expect(conf.getEngineConfigFor('stubEngine1')).toEqual({config_root: TEST_DATA_DIR});
        expect(conf.getEngineConfigFor('stubEngine2')).toEqual({config_root: TEST_DATA_DIR});
    });

    it("When constructing config from file with yml extension then it is parsed as a yaml file", () => {
        // Also note that Yml should work just like yml. Case doesn't matter.
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-02.Yml'));
        expect(conf.getLogFolder()).toEqual(os.tmpdir());
        expect(conf.getCustomEnginePluginModules()).toEqual(['dummy_plugin_module_path']);
        expect(conf.getRuleOverridesFor('stubEngine1')).toEqual({});
        expect(conf.getRuleOverridesFor('stubEngine2')).toEqual({
            stub2RuleC: {
                severity: SeverityLevel.Moderate
            }
        });
        expect(conf.getEngineConfigFor('stubEngine1')).toEqual({
            config_root: TEST_DATA_DIR,
            miscSetting1: true,
            miscSetting2: {
                miscSetting2A: 3,
                miscSetting2B: ["hello", "world"]
            }
        });
        expect(conf.getEngineConfigFor('stubEngine2')).toEqual({config_root: TEST_DATA_DIR});
    });

    it("When constructing config from json file then values from file are parsed correctly", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-03.json'));
        expect(conf.getLogFolder()).toEqual(path.join(TEST_DATA_DIR, 'sampleLogFolder'));
        expect(conf.getCustomEnginePluginModules()).toEqual([]);
        expect(conf.getRuleOverridesFor('stubEngine1')).toEqual({});
        expect(conf.getRuleOverridesFor('stubEngine2')).toEqual({});
        expect(conf.getEngineConfigFor('stubEngine1')).toEqual({config_root: TEST_DATA_DIR});
        expect(conf.getEngineConfigFor('stubEngine2')).toEqual({config_root: TEST_DATA_DIR, miscSetting: "miscValue"});
    });

    it("When constructing config from invalid yaml string then we throw an error", () => {
        try {
            CodeAnalyzerConfig.fromYamlString('oops: this: should error');
            fail('Expected an exception to be thrown.')
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain(getMessage('ConfigContentFailedToParse',''));
            expect(errMsg).toContain('bad indentation of a mapping entry');
        }
    });

    it("When constructing config from invalid json string then we throw an error", () => {
        try {
            CodeAnalyzerConfig.fromJsonString('this.Is{NotValidJson');
            fail('Expected an exception to be thrown.')
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain(getMessage('ConfigContentFailedToParse',''));
            expect(errMsg).toContain('Unexpected token');
        }
    });

    it("When constructing config from yaml string that isn't an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromYamlString("3")).toThrow(
            getMessage('ConfigContentNotAnObject','number'));
        expect(() => CodeAnalyzerConfig.fromYamlString("null")).toThrow(
            getMessage('ConfigContentNotAnObject','null'));
    });

    it("When constructing config from json string that isn't an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromJsonString("[3,4]")).toThrow(
            getMessage('ConfigContentNotAnObject','array'));
        expect(() => CodeAnalyzerConfig.fromJsonString("null")).toThrow(
            getMessage('ConfigContentNotAnObject','null'));
    });

    it("When engines value is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({engines: ['oops']})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','engines', 'object', 'array'));
    });

    it("When engines.someEngine is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({engines: {someEngine: 3.2}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','engines.someEngine', 'object', 'number'));
    });

    it("When rules is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: 3})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules', 'object', 'number'));
    });

    it("When rules.someEngine is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: null}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules.someEngine', 'object', 'null'));
    });

    it("When rules.someEngine.someRule is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {someRule: [1,2]}}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules.someEngine.someRule', 'object', 'array'));
    });

    it("When the severity of a rule not a valid value then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {
            goodSevRule1: {severity: 3},
            goodSevRule2: {severity: "High"},
            badSevRule: {severity: 0}
        }}})).toThrow(
            getMessage('ConfigValueNotAValidSeverityLevel','rules.someEngine.badSevRule.severity',
                '["Critical","High","Moderate","Low","Info",1,2,3,4,5]', '0'));

        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {badSevRule: {severity: "oops"}}}})).toThrow(
            getMessage('ConfigValueNotAValidSeverityLevel','rules.someEngine.badSevRule.severity',
                '["Critical","High","Moderate","Low","Info",1,2,3,4,5]', '"oops"'));
    });

    it("When the tags of a rule is not a string array then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {
                    goodTagsRule1: {tags: ['Recommended']},
                    badTagsRule: {tags: 'oops'},
                    goodTagsRule2: {tags: ['helloWorld', 'great']}
                }}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeStringArray','rules.someEngine.badTagsRule.tags', '"oops"'));

        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {badTagsRule: {tags: null},}}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeStringArray','rules.someEngine.badTagsRule.tags', 'null'));
    });

    it("When tags is an empty array, then use the empty array as provided", () => {
        const someRuleOverrides: object = {
            someRule1: {tags: []}, // Should be accepted
            someRule2: {severity: 4, tags: ['Performance']}
        };
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({rules: {someEngine: someRuleOverrides}});
        expect(conf.getRuleOverridesFor('someEngine')).toEqual(someRuleOverrides);
    });

    it("When log_folder does not exist, then throw an error", () => {
        const nonExistingFolder: string = path.resolve(__dirname, "doesNotExist");
        expect(() => CodeAnalyzerConfig.fromObject({log_folder: nonExistingFolder})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist', 'log_folder', nonExistingFolder)
        );
    });

    it("When log_folder is a file and not a folder, then throw an error", () => {
        const notAFolder: string = path.resolve(__dirname, "config.test.ts");
        expect(() => CodeAnalyzerConfig.fromObject({log_folder: notAFolder})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigFolderValueMustNotBeFile', 'log_folder', notAFolder)
        );
    });

    it("When custom_engine_plugin_modules is not a string array, then throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({custom_engine_plugin_modules: 3})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeStringArray','custom_engine_plugin_modules', '3'));

        expect(() => CodeAnalyzerConfig.fromObject({custom_engine_plugin_modules: 'oops'})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeStringArray','custom_engine_plugin_modules', '"oops"'));
    });

    it("When supplied config_root path is a valid absolute path, then we use it", () => {
        const configRootValue: string = path.join(TEST_DATA_DIR, 'sampleWorkspace');
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({config_root: configRootValue});
        expect(conf.getConfigRoot()).toEqual(configRootValue);
    });

    it("When supplied config_root path does not exist, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({config_root: path.resolve('doesNotExist')})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist','config_root', path.resolve('doesNotExist')));
    });

    it("When supplied config_root path is a file instead of a folder, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({config_root: path.resolve('package.json')})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigFolderValueMustNotBeFile','config_root', path.resolve('package.json')));
    });

    it("When supplied config_root path is a relative folder, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({config_root: 'test/test-data'})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueMustBeAbsolute',
                'config_root', 'test/test-data', path.resolve('test','test-data')));
    });
});