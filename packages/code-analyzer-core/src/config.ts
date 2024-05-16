import * as engApi from "@salesforce/code-analyzer-engine-api";
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from "node:os";
import * as yaml from 'js-yaml';
import {getMessage} from "./messages";
import {SeverityLevel} from "./rules";

const FIELDS = {
    LOG_FOLDER: 'log_folder',
    RULES: 'rules',
    ENGINES: 'engines',
    SEVERITY: 'severity',
    TAGS: 'tags'
} as const

export type EngineRuleSettings = {
    severity?: SeverityLevel
    tags?: string[]
}

type TopLevelConfig = {
    log_folder: string
    rules: Record<string, Record<string,EngineRuleSettings>>
    engines: Record<string, engApi.ConfigObject>
}

const DEFAULT_CONFIG: TopLevelConfig = {
    log_folder: os.tmpdir(),
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
            return CodeAnalyzerConfig.fromJsonString(fileContents);
        }  else if (fileExt == '.yaml' || fileExt == '.yml') {
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
            rules: validateAndExtractRuleSettingsValue(data),
            engines: validateAndExtractEngineSettingsValue(data)
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
        return this.config.rules[engineName] || {};
    }

    public getEngineSettingsFor(engineName: string): engApi.ConfigObject {
        return this.config.engines[engineName] || {};
    }
}

function validateAndExtractLogFolderValue(data: object): string {
    if (!(FIELDS.LOG_FOLDER in data)) {
        return DEFAULT_CONFIG.log_folder;
    }
    const logFolder: string = toAbsolutePath(validateType('string', data[FIELDS.LOG_FOLDER], FIELDS.LOG_FOLDER));
    if (!fs.existsSync(logFolder)) {
        throw new Error(getMessage('ConfigValueFolderMustExist', FIELDS.LOG_FOLDER, logFolder));
    } else if (!fs.statSync(logFolder).isDirectory()) {
        throw new Error(getMessage('ConfigValueMustBeFolder', FIELDS.LOG_FOLDER, logFolder));
    }
    return logFolder;
}

function validateAndExtractRuleSettingsValue(data: object): Record<string, Record<string, EngineRuleSettings>> {
    if (!(FIELDS.RULES in data)) {
        return DEFAULT_CONFIG.rules;
    }
    const ruleSettingsObj: object = validateObject(data[FIELDS.RULES], FIELDS.RULES);
    for (const [engineName, ruleSettingsForEngine] of Object.entries(ruleSettingsObj)) {
        const ruleSettingsForEngineObj: object = validateObject(ruleSettingsForEngine, `${FIELDS.RULES}.${engineName}`);
        for (const [ruleName, engineRuleSettings] of Object.entries(ruleSettingsForEngineObj)) {
            validateEngineRuleSettings(engineRuleSettings, `${FIELDS.RULES}.${engineName}.${ruleName}`);
        }
    }
    return data[FIELDS.RULES] as Record<string, Record<string, EngineRuleSettings>>;
}

function validateEngineRuleSettings(value: unknown, valueKey: string): void {
    const valueObj: object = validateObject(value, valueKey);
    if (FIELDS.SEVERITY in valueObj) {
        validateSeverityValue(valueObj[FIELDS.SEVERITY], `${valueKey}.${FIELDS.SEVERITY}`);
    }
    if (FIELDS.TAGS in valueObj ) {
        validateTagsValue(valueObj[FIELDS.TAGS], `${valueKey}.${FIELDS.TAGS}`);
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
    if (!(FIELDS.ENGINES in data)) {
        return DEFAULT_CONFIG.engines;
    }
    const engineSettingsObj: object = validateObject(data[FIELDS.ENGINES], FIELDS.ENGINES);
    for (const [engineName, settingsForEngine] of Object.entries(engineSettingsObj)) {
        validateObject(settingsForEngine, `${FIELDS.ENGINES}.${engineName}`);
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