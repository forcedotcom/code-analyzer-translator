import * as engApi from "@salesforce/code-analyzer-engine-api";
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from "node:os";
import * as yaml from 'js-yaml';
import {getMessage} from "./messages";
import {toAbsolutePath} from "./utils"
import {SeverityLevel} from "./rules";
import {getMessageFromCatalog, SHARED_MESSAGE_CATALOG, ValueValidator} from "@salesforce/code-analyzer-engine-api";

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

export type EngineOverrides = engApi.ConfigObject;

export type RuleOverrides = Record<string, RuleOverride>;

export type RuleOverride = {
    severity?: SeverityLevel
    tags?: string[]
}
export const TOP_LEVEL_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        config_root: getMessage('ConfigFieldDescription_config_root'),
        log_folder: getMessage('ConfigFieldDescription_log_folder'),
        rules: getMessage('ConfigFieldDescription_rules'),
        engines: getMessage('ConfigFieldDescription_engines'),
    }
}

type TopLevelConfig = {
    config_root: string
    log_folder: string
    rules: Record<string, RuleOverrides>
    engines: Record<string, EngineOverrides>
    custom_engine_plugin_modules: string[] // INTERNAL USE ONLY
}

const DEFAULT_CONFIG: TopLevelConfig = {
    config_root: process.cwd(),
    log_folder: os.tmpdir(),
    rules: {},
    engines: {},
    custom_engine_plugin_modules: [], // INTERNAL USE ONLY
};

export type ConfigDescription = engApi.ConfigDescription;

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
        configRoot = !rawConfig.config_root ? (configRoot ?? process.cwd()) :
            validateAbsoluteFolder(rawConfig.config_root, FIELDS.CONFIG_ROOT);
        const configExtractor: engApi.ConfigValueExtractor = new engApi.ConfigValueExtractor(rawConfig, '', configRoot);
        const config: TopLevelConfig = {
            config_root: configRoot,
            log_folder: configExtractor.extractFolder(FIELDS.LOG_FOLDER, DEFAULT_CONFIG.log_folder)!,
            custom_engine_plugin_modules: configExtractor.extractArray(FIELDS.CUSTOM_ENGINE_PLUGIN_MODULES,
                ValueValidator.validateString,
                DEFAULT_CONFIG.custom_engine_plugin_modules)!,
            rules: extractRulesValue(configExtractor),
            engines: extractEnginesValue(configExtractor)
        }
        return new CodeAnalyzerConfig(config);
    }

    public static getConfigDescription(): ConfigDescription {
        return TOP_LEVEL_CONFIG_DESCRIPTION;
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

    public getRuleOverridesFor(engineName: string): RuleOverrides {
        return this.config.rules[engineName] || {};
    }

    public getRuleOverrideFor(engineName: string, ruleName: string): RuleOverride {
        return this.getRuleOverridesFor(engineName)[ruleName] || {};
    }

    public getEngineOverridesFor(engineName: string): EngineOverrides {
        return this.config.engines[engineName] || {};
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
    const engSeverity: engApi.SeverityLevel | undefined = ruleOverrideExtractor.extractSeverityLevel(FIELDS.SEVERITY);
    return {
        tags: ruleOverrideExtractor.extractArray(FIELDS.TAGS, ValueValidator.validateString),
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
    const dataType: string = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
    if (dataType !== 'object') {
        throw new Error(getMessage('ConfigContentNotAnObject', dataType));
    }
    return data as object;
}

function validateAbsoluteFolder(value: unknown, fieldPath: string): string {
    const folderValue: string = validateAbsolutePath(value, fieldPath);
    if (!fs.statSync(folderValue).isDirectory()) {
        throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigFolderValueMustNotBeFile', fieldPath, folderValue));
    }
    return folderValue;
}

function validateAbsolutePath(value: unknown, fieldPath: string): string {
    const pathValue: string = ValueValidator.validateString(value, fieldPath);
    if (pathValue !== toAbsolutePath(pathValue)) {
        throw new Error(getMessage('ConfigPathValueMustBeAbsolute', fieldPath, pathValue, toAbsolutePath(pathValue)));
    } else if (!fs.existsSync(pathValue)) {
        throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist', fieldPath, pathValue));
    }
    return pathValue;
}