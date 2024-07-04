import {ConfigObject, ConfigValueExtractor} from '@salesforce/code-analyzer-engine-api';
import {getMessage} from "./messages";
import path from "node:path";

export type ESLintEngineConfig = {
    // The code analyzer config root. It is supplied to us automatically from core even if the user doesn't specify it.
    config_root: string

    // Your project's main ESLint configuration file. May be provided as a path relative to the config_root.
    // If not supplied, and disable_config_lookup=false, then we will attempt to find it.
    // Currently, only support legacy config files are supported.
    eslint_config_file?: string

    // If true then ESLint will not automatically look up and apply any ESLint configuration files automatically.
    // Default: false
    disable_config_lookup: boolean

    // If true then the base configuration that supplies the standard eslint rules for javascript files will not be applied.
    // Default: false
    disable_javascript_base_config: boolean

    // If true then the base configuration that supplies the lwc rules for javascript files will not be applied.
    // Default: false
    disable_lwc_base_config: boolean

    // If true then the base configuration that supplies the standard rules for typescript files will not be applied.
    // Default: false
    disable_typescript_base_config: boolean

    // Extensions of the javascript files in your workspace that will be used to discover javascript based rules.
    // Default: ['.js', '.cjs', '.mjs']
    javascript_file_extensions: string[]

    // Extensions of the typescript files in your workspace that will be used to discover typescript based rules.
    // Default: ['.ts']
    typescript_file_extensions: string[]

    // Extensions of the other (non-javascript and non-typescript) files in your workspace that will be used to discover other rules.
    // Default: []
    other_file_extensions: string[]
}

export const DEFAULT_CONFIG: ESLintEngineConfig = {
    config_root: process.cwd(),
    eslint_config_file: undefined,
    disable_config_lookup: false,
    disable_javascript_base_config: false,
    disable_lwc_base_config: false,
    disable_typescript_base_config: false,
    javascript_file_extensions:  ['.js', '.cjs', '.mjs'],
    typescript_file_extensions: ['.ts'],
    other_file_extensions: []
}

// See https://eslint.org/docs/v8.x/use/configure/configuration-files#configuration-file-formats
export const LEGACY_ESLINT_CONFIG_FILES: string[] =
    ['.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json'];

export function validateAndNormalizeConfig(rawConfig: ConfigObject): ESLintEngineConfig {
    const valueExtractor: ESLintEngineConfigValueExtractor = new ESLintEngineConfigValueExtractor(rawConfig);
    const [jsExts, tsExts, otherExts] = valueExtractor.extractFileExtensionsValues();
    return {
        config_root: valueExtractor.extractConfigRoot(),
        eslint_config_file: valueExtractor.extractESLintConfigFileValue(),
        disable_config_lookup: valueExtractor.extractBoolean('disable_config_lookup', DEFAULT_CONFIG.disable_config_lookup)!,
        disable_javascript_base_config: valueExtractor.extractBoolean('disable_javascript_base_config', DEFAULT_CONFIG.disable_javascript_base_config)!,
        disable_lwc_base_config: valueExtractor.extractBoolean('disable_lwc_base_config', DEFAULT_CONFIG.disable_lwc_base_config)!,
        disable_typescript_base_config: valueExtractor.extractBoolean('disable_typescript_base_config', DEFAULT_CONFIG.disable_typescript_base_config)!,
        javascript_file_extensions:  jsExts,
        typescript_file_extensions: tsExts,
        other_file_extensions: otherExts
    };
}

class ESLintEngineConfigValueExtractor extends ConfigValueExtractor {
    private static readonly FILE_EXT_PATTERN: RegExp = /^[.][a-zA-Z0-9]+$/;

    constructor(rawConfig: ConfigObject) {
        super(rawConfig, 'engines.eslint');
    }

    extractESLintConfigFileValue(): string | undefined {
        const eslintConfigFileField: string = 'eslint_config_file';
        const eslintConfigFile: string | undefined = this.extractFile(eslintConfigFileField, DEFAULT_CONFIG.eslint_config_file);
        if (eslintConfigFile && !LEGACY_ESLINT_CONFIG_FILES.includes(path.basename(eslintConfigFile))) {
            throw new Error(getMessage('InvalidLegacyConfigFileName', this.getFullFieldName(eslintConfigFileField),
                path.basename(eslintConfigFile), JSON.stringify(LEGACY_ESLINT_CONFIG_FILES)));
        }
        return eslintConfigFile;
    }

    extractFileExtensionsValues(): string[][] {
        const jsExtsField: string = 'javascript_file_extensions';
        const jsExts: string[] = makeUnique(this.extractExtensionsValue(jsExtsField, DEFAULT_CONFIG.javascript_file_extensions)!);
        const tsExtsField: string = 'typescript_file_extensions';
        const tsExts: string[] = makeUnique(this.extractExtensionsValue(tsExtsField, DEFAULT_CONFIG.typescript_file_extensions)!);
        const otherExtsField: string = 'other_file_extensions';
        const otherExts: string[] = makeUnique(this.extractExtensionsValue(otherExtsField, DEFAULT_CONFIG.other_file_extensions)!);

        const allExts: string[] = [...jsExts, ...tsExts, ...otherExts];
        if (allExts.length != makeUnique(allExts).length) {
            const currentValuesString: string =
                `  ${this.getFullFieldName(jsExtsField)}: ${JSON.stringify(jsExts)}\n` +
                `  ${this.getFullFieldName(tsExtsField)}: ${JSON.stringify(tsExts)}\n` +
                `  ${this.getFullFieldName(otherExtsField)}: ${JSON.stringify(otherExts)}`;
            throw new Error(getMessage('ConfigStringArrayValuesMustNotShareElements', currentValuesString));
        }

        return [jsExts, tsExts, otherExts];
    }

    extractExtensionsValue(fieldName: string, defaultValue: string[]): string[] {
        const fileExts: string[] = this.extractStringArray(fieldName, defaultValue)!;
        return fileExts.map((fileExt, i) => validateStringMatches(
            ESLintEngineConfigValueExtractor.FILE_EXT_PATTERN, fileExt, `${this.getFullFieldName(fieldName)}[${i}]`));
    }
}

function makeUnique(value: string[]): string[] {
    return [...new Set(value)];
}

function validateStringMatches(pattern: RegExp, value: string, fieldName: string): string {
    if (!pattern.test(value)) {
        throw new Error(getMessage('ConfigStringValueMustMatchPattern', fieldName, value, pattern.source));
    }
    return value;
}