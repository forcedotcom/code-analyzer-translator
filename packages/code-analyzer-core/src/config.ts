import * as engApi from "@salesforce/code-analyzer-engine-api";
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from "node:os";
import * as yaml from 'js-yaml';
import {getMessage} from "./messages";
import {toAbsolutePath} from "./utils"
import {SeverityLevel} from "./rules";

// Only exported internally to share across files
export const FIELDS = {
    CONFIG_ROOT: 'config_root',
    LOG_FOLDER: 'log_folder',
    CUSTOM_ENGINE_PLUGIN_MODULES: 'custom_engine_plugin_modules', // Hidden
    RULES: 'rules',
    ENGINES: 'engines',
    SEVERITY: 'severity',
    TAGS: 'tags',
    DISABLE_ENGINE: 'disable_engine'
} as const;

/**
 * Object containing the unresolved user specified engine configuration override values
 */
export type EngineOverrides = engApi.ConfigObject;

/**
 * Object containing the user specified rule override values
 */
export type RuleOverrides = Record<string, RuleOverride>;
export type RuleOverride = {
    severity?: SeverityLevel
    tags?: string[]
}

type TopLevelConfig = {
    config_root: string
    log_folder: string
    rules: Record<string, RuleOverrides>
    engines: Record<string, EngineOverrides>
    custom_engine_plugin_modules: string[] // INTERNAL USE ONLY
}

// Only exported internally to help with testing
export const DEFAULT_CONFIG: TopLevelConfig = {
    config_root: process.cwd(),
    log_folder: os.tmpdir(),
    rules: {},
    engines: {},
    custom_engine_plugin_modules: [], // INTERNAL USE ONLY
};

/**
 * Object containing an overview and top level field descriptions of specific section of the Code Analyzer configuration
 */
export type ConfigDescription = {
    // A brief overview of this specific configuration object. It is recommended to include a link to documentation when possible.
    overview: string

    // Description objects for the primary fields in the configuration
    fieldDescriptions: Record<string, ConfigFieldDescription>
}
export type ConfigFieldDescription = engApi.ConfigFieldDescription & {
    // Whether or not the user has supplied a value for the field in their configuration file
    //   Note: Unlike the Engine API's ConfigFieldDescription, core has the ability to determine if the user supplied
    //   the field value (as we create a CodeAnalyzerConfig object), which is why "wasSuppliedByUser" is here only.
    wasSuppliedByUser: boolean
}

/**
 * Class that represents a Code Analyzer configuration
 */
export class CodeAnalyzerConfig {
    private readonly config: TopLevelConfig;

    /**
     * Creates a {@link CodeAnalyzerConfig} instance containing only default values
     */
    public static withDefaults() {
        return new CodeAnalyzerConfig(DEFAULT_CONFIG);
    }

    /**
     * Creates a {@link CodeAnalyzerConfig} instance from a YAML or JSON file
     * @param file an absolute path to the configuration file to be parsed
     */
    public static fromFile(file: string) {
        file = toAbsolutePath(file);
        if (!fs.existsSync(file)) {
            throw new Error(getMessage('ConfigFileDoesNotExist', file));
        }
        const fileContents: string = fs.readFileSync(file, 'utf8') || "{}";

        const fileExt : string = path.extname(file).toLowerCase();

        if (fileExt == '.json') {
            return CodeAnalyzerConfig.fromJsonString(fileContents, path.dirname(file));
        }  else if (fileExt == '.yaml' || fileExt == '.yml') {
            return CodeAnalyzerConfig.fromYamlString(fileContents, path.dirname(file));
        } else {
            throw new Error(getMessage('ConfigFileExtensionUnsupported', file, 'json,yaml,yml'))
        }
    }

    /**
     * Creates a {@link CodeAnalyzerConfig} instance from a JSON string
     * @param jsonString the string containing the JSON to be parsed
     * @param configRoot the root folder from which all file path values within the configuration are relative to
     */
    public static fromJsonString(jsonString: string, configRoot?: string): CodeAnalyzerConfig {
        const data: object = parseAndValidate(() => JSON.parse(jsonString));
        return CodeAnalyzerConfig.fromObject(data, configRoot);
    }

    /**
     * Creates a {@link CodeAnalyzerConfig} instance from a YAML string
     * @param yamlString the string containing the YAML to be parsed
     * @param configRoot the root folder for all file path values within the configuration are relative to
     */
    public static fromYamlString(yamlString: string, configRoot?: string): CodeAnalyzerConfig {
        const data: object = parseAndValidate(() => yaml.load(yamlString));
        return CodeAnalyzerConfig.fromObject(data, configRoot);
    }

    /**
     * Creates a {@link CodeAnalyzerConfig} instance from an object
     * @param data the object containing the configuration options
     * @param configRoot the root folder for all file path values within the configuration are relative to
     */
    public static fromObject(data: object, configRoot?: string): CodeAnalyzerConfig {
        const rawConfig: engApi.ConfigObject = data as engApi.ConfigObject;
        configRoot = !rawConfig.config_root ? (configRoot ?? process.cwd()) :
            validateAbsoluteFolder(rawConfig.config_root, FIELDS.CONFIG_ROOT);
        const configExtractor: engApi.ConfigValueExtractor = new engApi.ConfigValueExtractor(rawConfig, '', configRoot);
        configExtractor.addKeysThatBypassValidation([FIELDS.CUSTOM_ENGINE_PLUGIN_MODULES]); // Because custom_engine_plugin_modules is currently hidden
        configExtractor.validateContainsOnlySpecifiedKeys([FIELDS.CONFIG_ROOT, FIELDS.LOG_FOLDER ,FIELDS.RULES, FIELDS.ENGINES]);
        const config: TopLevelConfig = {
            config_root: configRoot,
            log_folder: configExtractor.extractFolder(FIELDS.LOG_FOLDER, DEFAULT_CONFIG.log_folder)!,
            custom_engine_plugin_modules: configExtractor.extractArray(FIELDS.CUSTOM_ENGINE_PLUGIN_MODULES,
                engApi.ValueValidator.validateString,
                DEFAULT_CONFIG.custom_engine_plugin_modules)!,
            rules: extractRulesValue(configExtractor),
            engines: extractEnginesValue(configExtractor)
        }
        return new CodeAnalyzerConfig(config);
    }

    /**
     * Returns a {@link ConfigDescription} which describes the top level files associated with the Code Analyzer Config
     */
    public getConfigDescription(): ConfigDescription {
        return {
            overview: getMessage('ConfigOverview'),
            fieldDescriptions: {
                config_root: {
                    descriptionText: getMessage('ConfigFieldDescription_config_root'),
                    valueType: 'string',
                    defaultValue: null, // Using null for doc and since it indicates that the value is calculated based on the environment
                    wasSuppliedByUser: this.config.config_root !== DEFAULT_CONFIG.config_root
                },
                log_folder: {
                    descriptionText: getMessage('ConfigFieldDescription_log_folder'),
                    valueType: 'string',
                    defaultValue: null, // Using null for doc and since it indicates that the value is calculated based on the environment
                    wasSuppliedByUser: this.config.log_folder !== DEFAULT_CONFIG.log_folder
                },
                rules: {
                    descriptionText: getMessage('ConfigFieldDescription_rules'),
                    valueType: 'object',
                    defaultValue: {},
                    wasSuppliedByUser: this.config.rules !== DEFAULT_CONFIG.rules
                },
                engines: {
                    descriptionText: getMessage('ConfigFieldDescription_engines'),
                    valueType: 'object',
                    defaultValue: {},
                    wasSuppliedByUser: this.config.engines !== DEFAULT_CONFIG.engines
                }
            }
        };
    }

    private constructor(config: TopLevelConfig) {
        this.config = config;
    }

    /**
     * Returns the absolute path of where log files should be stored by Code Analyzer when selecting and running rules.
     *     Note that it is responsibility of clients of CodeAnalyzer to write log files to this folder if they wish.
     */
    public getLogFolder(): string {
        return this.config.log_folder;
    }

    /**
     * Returns the absolute path folder where all path based values within the configuration may be relative to.
     *     Typically, this is set as the folder where a configuration file was loaded from, but doesn't have to be.
     */
    public getConfigRoot(): string {
        return this.config.config_root;
    }

    /**
     * Returns any user-specified custom engine plugin modules that have been specified in the configuration.
     */
    public getCustomEnginePluginModules(): string[] {
        return this.config.custom_engine_plugin_modules;
    }

    /**
     * Returns a {@link RuleOverrides} instance containing the user specified overrides for all rules associated with the specified engine
     * @param engineName name of the engine
     */
    public getRuleOverridesFor(engineName: string): RuleOverrides {
        return engApi.getValueUsingCaseInsensitiveKey(this.config.rules, engineName) as RuleOverrides || {};
    }

    /**
     * Returns a {@link RuleOverride} instance containing the user specified override values for the specified rule
     * @param engineName name of the engine
     * @param ruleName name of the rule
     */
    public getRuleOverrideFor(engineName: string, ruleName: string): RuleOverride {
        return engApi.getValueUsingCaseInsensitiveKey(this.getRuleOverridesFor(engineName), ruleName) as RuleOverride || {};
    }

    /**
     * Returns a {@link EngineOverrides} instance containing the user specified engine override values for the specified engine
     * @param engineName name of the engine
     */
    public getEngineOverridesFor(engineName: string): EngineOverrides {
        return engApi.getValueUsingCaseInsensitiveKey(this.config.engines, engineName) as EngineOverrides || {};
    }
}

function extractRulesValue(configExtractor: engApi.ConfigValueExtractor): Record<string, RuleOverrides> {
    const rulesExtractor: engApi.ConfigValueExtractor = configExtractor.extractObjectAsExtractor(FIELDS.RULES, DEFAULT_CONFIG.rules);
    const rulesValue: Record<string, Record<string, RuleOverride>> = {};
    for (const engineName of rulesExtractor.getKeys()) {
        rulesValue[engineName] = extractRuleOverridesFrom(rulesExtractor.extractRequiredObjectAsExtractor(engineName));
    }
    return rulesValue;
}

function extractRuleOverridesFrom(engineRuleOverridesExtractor: engApi.ConfigValueExtractor): RuleOverrides {
    const ruleOverrides: Record<string, RuleOverride> = {};
    for (const ruleName of engineRuleOverridesExtractor.getKeys()) {
        ruleOverrides[ruleName] = extractRuleOverrideFrom(engineRuleOverridesExtractor.extractRequiredObjectAsExtractor(ruleName));
    }
    return ruleOverrides;
}

function extractRuleOverrideFrom(ruleOverrideExtractor: engApi.ConfigValueExtractor): RuleOverride {
    ruleOverrideExtractor.validateContainsOnlySpecifiedKeys([FIELDS.SEVERITY, FIELDS.TAGS]);
    const engSeverity: engApi.SeverityLevel | undefined = ruleOverrideExtractor.extractSeverityLevel(FIELDS.SEVERITY);
    return {
        tags: ruleOverrideExtractor.extractArray(FIELDS.TAGS, engApi.ValueValidator.validateString),
        severity: engSeverity === undefined ? undefined : engSeverity as SeverityLevel
    }
}

function extractEnginesValue(configExtractor: engApi.ConfigValueExtractor): Record<string, EngineOverrides> {
    const enginesExtractor: engApi.ConfigValueExtractor = configExtractor.extractObjectAsExtractor(FIELDS.ENGINES,
        DEFAULT_CONFIG.engines);
    for (const engineName of enginesExtractor.getKeys()) { // Don't need the values, just want to validate them
        enginesExtractor.extractRequiredObjectAsExtractor(engineName).extractBoolean(FIELDS.DISABLE_ENGINE);
    }
    return enginesExtractor.getObject() as Record<string, EngineOverrides>;
}

function parseAndValidate(parseFcn: () => unknown): object {
    let data;
    try {
        data = parseFcn();
    } catch (err) {
        throw new Error(getMessage('ConfigContentFailedToParse', (err as Error).message), { cause: err });
    }
    if (data === null) {
        return {};
    }
    const dataType: string = Array.isArray(data) ? 'array' : typeof data;
    if (dataType !== 'object') {
        throw new Error(getMessage('ConfigContentNotAnObject', dataType));
    }
    return data as object;
}

function validateAbsoluteFolder(value: unknown, fieldPath: string): string {
    const folderValue: string = validateAbsolutePath(value, fieldPath);
    if (!fs.statSync(folderValue).isDirectory()) {
        throw new Error(engApi.getMessageFromCatalog(engApi.SHARED_MESSAGE_CATALOG,
            'ConfigFolderValueMustNotBeFile', fieldPath, folderValue));
    }
    return folderValue;
}

function validateAbsolutePath(value: unknown, fieldPath: string): string {
    const pathValue: string = engApi.ValueValidator.validateString(value, fieldPath);
    if (pathValue !== toAbsolutePath(pathValue)) {
        throw new Error(getMessage('ConfigPathValueMustBeAbsolute', fieldPath, pathValue, toAbsolutePath(pathValue)));
    } else if (!fs.existsSync(pathValue)) {
        throw new Error(engApi.getMessageFromCatalog(engApi.SHARED_MESSAGE_CATALOG,
            'ConfigPathValueDoesNotExist', fieldPath, pathValue));
    }
    return pathValue;
}