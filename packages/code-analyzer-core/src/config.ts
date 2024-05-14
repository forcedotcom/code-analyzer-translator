import * as engApi from "@salesforce/code-analyzer-engine-api";
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from "node:os";
import * as yaml from 'js-yaml';
import {getMessage} from "./messages";
import {SeverityLevel} from "./rules";

export type EngineRuleSettings = {
    severity?: SeverityLevel
    tags?: string[]
}

type TopLevelConfig = {
    log_folder: string
    rule_settings: Record<string, Record<string,EngineRuleSettings>>
    engine_settings: Record<string, engApi.ConfigObject>
}

const DEFAULT_CONFIG: TopLevelConfig = {
    log_folder: os.tmpdir(),
    rule_settings: {},
    engine_settings: {}
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

        const fileExt : string = file.split('.').pop()?.toLowerCase() || "";

        if (fileExt == 'json') {
            return CodeAnalyzerConfig.fromJsonString(fileContents);
        }  else if (fileExt == 'yaml' || fileExt == 'yml') {
            return CodeAnalyzerConfig.fromYamlString(fileContents);
        } else {
            throw new Error(getMessage('ConfigFileExtensionUnsupported', file, 'json,yaml,yml'))
        }
    }

    public static fromJsonString(jsonString: string): CodeAnalyzerConfig {
        const data: object = parseAndValidate(() => JSON.parse(jsonString));
        return CodeAnalyzerConfig.fromObject(data);
    }

    public static fromYamlString(yamlString: string): CodeAnalyzerConfig {
        const data: object = parseAndValidate(() => yaml.load(yamlString));
        return CodeAnalyzerConfig.fromObject(data);
    }

    public static fromObject(data: object): CodeAnalyzerConfig {
        const config: TopLevelConfig = {
            log_folder: validateAndExtractLogFolderValue(data),
            rule_settings: validateAndExtractRuleSettingsValue(data),
            engine_settings: validateAndExtractEngineSettingsValue(data)
        }
        return new CodeAnalyzerConfig(config);
    }

    private constructor(config: TopLevelConfig) {
        this.config = config;
    }

    public getLogFolder(): string {
        return this.config.log_folder;
    }

    public getRuleSettingsFor(engineName: string): EngineRuleSettings {
        return this.config.rule_settings[engineName] || {};
    }

    public getEngineSettingsFor(engineName: string): engApi.ConfigObject {
        return this.config.engine_settings[engineName] || {};
    }
}

function validateAndExtractLogFolderValue(data: object): string {
    if (!('log_folder' in data)) {
        return DEFAULT_CONFIG.log_folder;
    }
    const logFolder: string = toAbsolutePath(validateType('string', data['log_folder'], 'log_folder'));
    if (!fs.existsSync(logFolder)) {
        throw new Error(getMessage('ConfigValueFolderMustExist', 'log_folder', logFolder));
    } else if (!fs.statSync(logFolder).isDirectory()) {
        throw new Error(getMessage('ConfigValueMustBeFolder', 'log_folder', logFolder));
    }
    return logFolder;
}

function validateAndExtractRuleSettingsValue(data: object): Record<string, Record<string, EngineRuleSettings>> {
    if (!('rule_settings' in data)) {
        return DEFAULT_CONFIG.rule_settings;
    }
    const ruleSettingsObj: object = validateObject(data['rule_settings'], 'rule_settings');
    for (const [engineName, ruleSettingsForEngine] of Object.entries(ruleSettingsObj)) {
        const ruleSettingsForEngineObj: object = validateObject(ruleSettingsForEngine, `rule_settings.${engineName}`);
        for (const [ruleName, engineRuleSettings] of Object.entries(ruleSettingsForEngineObj)) {
            validateEngineRuleSettings(engineRuleSettings, `rule_settings.${engineName}.${ruleName}`);
        }
    }
    return data['rule_settings'] as Record<string, Record<string, EngineRuleSettings>>;
}

function validateEngineRuleSettings(value: unknown, valueKey: string): void {
    const valueObj: object = validateObject(value, valueKey);
    if ('severity' in valueObj) {
        validateSeverityValue(valueObj['severity'], `${valueKey}.severity`);
    }
    if ('tags' in valueObj ) {
        validateTagsValue(valueObj['tags'], `${valueKey}.tags`);
    }
}

function validateObject(value: unknown, valueKey: string) {
    return validateType<object>('object', value, valueKey);
}

function validateType<T>(expectedType: string, value: unknown, valueKey: string): T {
    if (typeOf(value) !== expectedType) {
        throw new Error(getMessage('ConfigValueMustBeOfType', valueKey, expectedType, typeOf(value)));
    }
    return value as T;
}

function validateSeverityValue(value: unknown, valueKey: string): void {
    // Note that Object.values(SeverityLevel) returns [1,2,3,4,5,"Critical","High","Moderate","Low","Info"]
    if ((typeof value !== 'string' && typeof value !== 'number')
        || !Object.values(SeverityLevel).includes(value as string | number)) {
        throw new Error(getMessage('ConfigValueNotAValidSeverityLevel', valueKey,
            JSON.stringify(Object.values(SeverityLevel)), JSON.stringify(value)));
    }
}

function validateTagsValue(value: unknown, valueKey: string): void {
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
        throw new Error(getMessage('ConfigValueNotAValidTagsLevel', valueKey, JSON.stringify(value)));
    }
}

function validateAndExtractEngineSettingsValue(data: object): Record<string, engApi.ConfigObject> {
    if (!('engine_settings' in data)) {
        return DEFAULT_CONFIG.engine_settings;
    }
    const engineSettingsObj: object = validateObject(data['engine_settings'], 'engine_settings');
    for (const [engineName, settingsForEngine] of Object.entries(engineSettingsObj)) {
        validateObject(settingsForEngine, `engine_settings.${engineName}`);
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
    if (typeOf(data) !== 'object') {
        throw new Error(getMessage('ConfigContentNotAnObject', typeOf(data)));
    }
    return data as object;
}

function toAbsolutePath(fileOrFolder: string): string {
    // Convert slashes to platform specific slashes and then convert to absolute path
    return path.resolve(fileOrFolder.replace(/[\\/]/g, path.sep));
}

function typeOf(value: unknown) {
    return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
}