import * as engApi from "@salesforce/code-analyzer-engine-api";
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from "node:os";
import * as yaml from 'js-yaml';
import {getMessage} from "./messages";
import {toAbsolutePath} from "./utils"
import {SeverityLevel} from "./rules";

export const FIELDS = {
    CONFIG_ROOT: 'config_root',
    LOG_FOLDER: 'log_folder',
    CUSTOM_ENGINE_PLUGIN_MODULES: 'custom_engine_plugin_modules',
    RULES: 'rules',
    ENGINES: 'engines',
    SEVERITY: 'severity',
    TAGS: 'tags',
    DISABLE_ENGINE: 'disable_engine'
} as const;

export type RuleOverride = {
    severity?: SeverityLevel
    tags?: string[]
}

type TopLevelConfig = {
    // The absolute folder path where other paths values in the config may be relative to.
    // Default: The location of the config file if supplied and the current working directory otherwise.
    config_root: string

    // Folder where the user would like to store log files. May be relative to config_root.
    // Default: The default temporary directory on the user's machine.
    log_folder: string

    // List of EnginePlugin modules to be dynamically added. Paths may be relative to the config_root.
    custom_engine_plugin_modules: string[]

    // Rule override entries of the format rules.<engine_name>.<rule_name>.<property_name> = <override_value>
    rules: Record<string, Record<string, RuleOverride>>

    // Engine specific configuration entries of the format engines.<engine_name>.<engine_specific_property> = <value>
    engines: Record<string, engApi.ConfigObject>
}

const DEFAULT_CONFIG: TopLevelConfig = {
    config_root: process.cwd(),
    log_folder: os.tmpdir(),
    custom_engine_plugin_modules: [],
    rules: {},
    engines: {}
};

export class CodeAnalyzerConfig {
    private readonly config: TopLevelConfig;

    public static withDefaults() {
        return new CodeAnalyzerConfig(DEFAULT_CONFIG);
    }

    public static fromFile(file: string) {
        file = toAbsolutePath(file);
        if (!fs.existsSync(file)) {
            throw new Error(getMessage('ConfigFileDoesNotExist', file));
        }
        const fileContents: string = fs.readFileSync(file, 'utf8');

        const fileExt : string = path.extname(file).toLowerCase();

        if (fileExt == '.json') {
            return CodeAnalyzerConfig.fromJsonString(fileContents, path.dirname(file));
        }  else if (fileExt == '.yaml' || fileExt == '.yml') {
            return CodeAnalyzerConfig.fromYamlString(fileContents, path.dirname(file));
        } else {
            throw new Error(getMessage('ConfigFileExtensionUnsupported', file, 'json,yaml,yml'))
        }
    }

    public static fromJsonString(jsonString: string, configRoot?: string): CodeAnalyzerConfig {
        const data: object = parseAndValidate(() => JSON.parse(jsonString));
        return CodeAnalyzerConfig.fromObject(data, configRoot);
    }

    public static fromYamlString(yamlString: string, configRoot?: string): CodeAnalyzerConfig {
        const data: object = parseAndValidate(() => yaml.load(yamlString));
        return CodeAnalyzerConfig.fromObject(data, configRoot);
    }

    public static fromObject(data: object, configRoot?: string): CodeAnalyzerConfig {
        const rawConfig: engApi.ConfigObject = data as engApi.ConfigObject;
        if (!rawConfig.config_root) {
            rawConfig.config_root = configRoot ? configRoot : process.cwd();
        }
        const configValueExtractor: engApi.ConfigValueExtractor = new engApi.ConfigValueExtractor(rawConfig);
        const config: TopLevelConfig = {
            config_root: configValueExtractor.extractConfigRoot(),
            log_folder: configValueExtractor.extractFolder(FIELDS.LOG_FOLDER, DEFAULT_CONFIG.log_folder)!,
            custom_engine_plugin_modules: configValueExtractor.extractStringArray(FIELDS.CUSTOM_ENGINE_PLUGIN_MODULES,
                DEFAULT_CONFIG.custom_engine_plugin_modules)!,
            rules: extractRulesValue(configValueExtractor),
            engines: extractEnginesValue(configValueExtractor)
        }
        return new CodeAnalyzerConfig(config);
    }

    private constructor(config: TopLevelConfig) {
        this.config = config;
    }

    public getLogFolder(): string {
        return this.config.log_folder;
    }

    public getConfigRoot(): string {
        return this.config.config_root;
    }

    public getCustomEnginePluginModules(): string[] {
        return this.config.custom_engine_plugin_modules;
    }

    public getRuleOverridesFor(engineName: string): Record<string, RuleOverride> {
        return this.config.rules[engineName] || {};
    }

    public getRuleOverrideFor(engineName: string, ruleName: string): RuleOverride {
        return this.getRuleOverridesFor(engineName)[ruleName] || {};
    }

    public getEngineConfigFor(engineName: string): engApi.ConfigObject {
        // Each engine should have access to the config folder location and its own engine specific config, so that it
        // can resolve any relative paths in its engine specific config with this location. Thus, we always add the
        // config folder to the engine specific config.
        const configToGiveToEngine: engApi.ConfigObject = this.config.engines[engineName] || {};
        configToGiveToEngine.config_root = this.getConfigRoot();
        return configToGiveToEngine;
    }
}

function extractRulesValue(configValueExtractor: engApi.ConfigValueExtractor): Record<string, Record<string, RuleOverride>> {
    const rulesObj: engApi.ConfigObject | undefined = configValueExtractor.extractObject(FIELDS.RULES);
    if (!rulesObj) {
        return DEFAULT_CONFIG.rules;
    }
    const extractedValue: Record<string, Record<string, RuleOverride>> = {};
    for (const engineName of Object.keys(rulesObj)) {
        extractedValue[engineName] = extractRuleOverridesFor(rulesObj, engineName);
    }
    return extractedValue;
}

function extractRuleOverridesFor(rulesObj: object, engineName: string): Record<string, RuleOverride> {
    const extractedValue: Record<string, RuleOverride> = {};
    const ruleOverridesObj: object = engApi.ValueValidator.validateObject(rulesObj[engineName as keyof typeof rulesObj],
        `${FIELDS.RULES}.${engineName}`);
    for (const ruleName of Object.keys(ruleOverridesObj)) {
        extractedValue[ruleName] = extractRuleOverrideFor(ruleOverridesObj, engineName, ruleName);
    }
    return extractedValue;
}

function extractRuleOverrideFor(ruleOverridesObj: object, engineName: string, ruleName: string): RuleOverride {
    const extractedValue: RuleOverride = {};
    const ruleOverrideObj: object = engApi.ValueValidator.validateObject(ruleOverridesObj[ruleName as keyof typeof ruleOverridesObj],
        `${FIELDS.RULES}.${engineName}.${ruleName}`);
    if (FIELDS.SEVERITY in ruleOverrideObj) {
        extractedValue.severity = validateSeverityValue(ruleOverrideObj[FIELDS.SEVERITY],
            `${FIELDS.RULES}.${engineName}.${ruleName}.${FIELDS.SEVERITY}`);
    }
    if (FIELDS.TAGS in ruleOverrideObj ) {
        extractedValue.tags = engApi.ValueValidator.validateStringArray(ruleOverrideObj[FIELDS.TAGS],
            `${FIELDS.RULES}.${engineName}.${ruleName}.${FIELDS.TAGS}`);
    }
    return extractedValue;
}

function validateSeverityValue(value: unknown, valueKey: string): SeverityLevel {
    // Note that Object.values(SeverityLevel) returns [1,2,3,4,5,"Critical","High","Moderate","Low","Info"]
    if ((typeof value !== 'string' && typeof value !== 'number')
        || !Object.values(SeverityLevel).includes(value as string | number)) {
        throw new Error(getMessage('ConfigValueNotAValidSeverityLevel', valueKey,
            JSON.stringify(Object.values(SeverityLevel)), JSON.stringify(value)));
    }
    if (typeof value === 'string') {
        // We can't type cast to enum from a string, so instead we choose the enum based on the string as a key.
        value = SeverityLevel[value as keyof typeof SeverityLevel];
    }
    // We can type cast to enum safely from a number
    return value as SeverityLevel;
}

function extractEnginesValue(configValueExtractor: engApi.ConfigValueExtractor): Record<string, engApi.ConfigObject> {
    const engineSettingsObj: engApi.ConfigObject | undefined = configValueExtractor.extractObject(FIELDS.ENGINES);
    if (!engineSettingsObj) {
        return DEFAULT_CONFIG.engines;
    }
    for (const [engineName, settingsForEngine] of Object.entries(engineSettingsObj)) {
        const settingsForEngineObj: object = engApi.ValueValidator.validateObject(settingsForEngine, `${FIELDS.ENGINES}.${engineName}`);
        if (FIELDS.DISABLE_ENGINE in settingsForEngineObj) {
            engApi.ValueValidator.validateBoolean(settingsForEngineObj[FIELDS.DISABLE_ENGINE],
                `${FIELDS.ENGINES}.${engineName}.${FIELDS.DISABLE_ENGINE}`);
        }
    }
    return engineSettingsObj as Record<string, engApi.ConfigObject>;
}

function parseAndValidate(parseFcn: () => unknown): object {
    let data;
    try {
        data = parseFcn();
    } catch (err) {
        throw new Error(getMessage('ConfigContentFailedToParse', (err as Error).message), { cause: err });
    }
    const dataType: string = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
    if (dataType !== 'object') {
        throw new Error(getMessage('ConfigContentNotAnObject', dataType));
    }
    return data as object;
}