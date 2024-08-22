import * as engApi from "@salesforce/code-analyzer-engine-api";
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from "node:os";
import * as yaml from 'js-yaml';
import {getMessage} from "./messages";
import {toAbsolutePath} from "./utils"
import {SeverityLevel} from "./rules";
import {ValueValidator} from "@salesforce/code-analyzer-engine-api";

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
        const configExtractor: engApi.ConfigValueExtractor = new engApi.ConfigValueExtractor(rawConfig);
        const config: TopLevelConfig = {
            config_root: configExtractor.extractConfigRoot(),
            log_folder: configExtractor.extractFolder(FIELDS.LOG_FOLDER, DEFAULT_CONFIG.log_folder)!,
            custom_engine_plugin_modules: configExtractor.extractArray(FIELDS.CUSTOM_ENGINE_PLUGIN_MODULES,
                ValueValidator.validateString,
                DEFAULT_CONFIG.custom_engine_plugin_modules)!,
            rules: extractRulesValue(configExtractor),
            engines: extractEnginesValue(configExtractor)
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

function extractRulesValue(configExtractor: engApi.ConfigValueExtractor): Record<string, Record<string, RuleOverride>> {
    const rulesExtractor: engApi.ConfigValueExtractor = configExtractor.extractObjectAsExtractor(FIELDS.RULES, DEFAULT_CONFIG.rules);
    const rulesValue: Record<string, Record<string, RuleOverride>> = {};
    for (const engineName of rulesExtractor.getKeys()) {
        rulesValue[engineName] = extractRuleOverridesFrom(rulesExtractor.extractRequiredObjectAsExtractor(engineName));
    }
    return rulesValue;
}

function extractRuleOverridesFrom(engineRuleOverridesExtractor: engApi.ConfigValueExtractor): Record<string, RuleOverride> {
    const ruleOverrides: Record<string, RuleOverride> = {};
    for (const ruleName of engineRuleOverridesExtractor.getKeys()) {
        ruleOverrides[ruleName] = extractRuleOverrideFrom(engineRuleOverridesExtractor.extractRequiredObjectAsExtractor(ruleName));
    }
    return ruleOverrides;
}

function extractRuleOverrideFrom(ruleOverrideExtractor: engApi.ConfigValueExtractor): RuleOverride {
    const engSeverity: engApi.SeverityLevel | undefined = ruleOverrideExtractor.extractSeverityLevel(FIELDS.SEVERITY);
    return {
        tags: ruleOverrideExtractor.extractArray(FIELDS.TAGS, ValueValidator.validateString),
        severity: engSeverity === undefined ? undefined : engSeverity as SeverityLevel
    }
}

function extractEnginesValue(configExtractor: engApi.ConfigValueExtractor): Record<string, engApi.ConfigObject> {
    const enginesExtractor: engApi.ConfigValueExtractor = configExtractor.extractObjectAsExtractor(FIELDS.ENGINES,
        DEFAULT_CONFIG.engines);
    for (const engineName of enginesExtractor.getKeys()) { // Don't need the values, just want to validate them
        enginesExtractor.extractRequiredObjectAsExtractor(engineName).extractBoolean(FIELDS.DISABLE_ENGINE);
    }
    return enginesExtractor.getObject() as Record<string, engApi.ConfigObject>;
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