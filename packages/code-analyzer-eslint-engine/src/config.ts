import {
    ConfigDescription,
    ConfigValueExtractor,
    ValueValidator
} from '@salesforce/code-analyzer-engine-api';
import {getMessage} from "./messages";
import path from "node:path";
import {makeUnique} from "./utils";

export type ESLintEngineConfig = {
    // Your project's main ESLint configuration file. May be provided as a path relative to the config_root.
    // If not supplied, and auto_discover_eslint_config=true, then Code Analyzer will attempt to find and apply it automatically.
    // Currently, only support legacy config files are supported.
    eslint_config_file?: string

    // Your project's ".eslintignore" file. May be provided as a path relative to the config_root.
    // If not supplied, and auto_discover_eslint_config=true, then Code Analyzer will attempt to find and apply it automatically.
    eslint_ignore_file?: string

    // If true then ESLint will attempt to look up and apply any ESLint configuration and ignore files found in your workspace.
    // Default: false
    auto_discover_eslint_config: boolean

    // If true then the base configuration that supplies the standard eslint rules for javascript files will not be applied.
    // Default: false
    disable_javascript_base_config: boolean

    // If true then the base configuration that supplies the lwc rules for javascript files will not be applied.
    // Default: false
    disable_lwc_base_config: boolean

    // If true then the base configuration that supplies the standard rules for typescript files will not be applied.
    // Default: false
    disable_typescript_base_config: boolean

    // Extensions of the files in your workspace that will be used to discover rules for javascript and typescript.
    // Each file extension can only be associated to one language. If a specific language is not specified, then the
    // following list of default file extensions will be used:
    //   javascript: ['.js', '.cjs', '.mjs']
    //   typescript: ['.ts']
    file_extensions: FileExtensionsObject

    // (INTERNAL USE ONLY) Copy of the code analyzer config root.
    config_root: string
}

type FileExtensionsObject = {
    javascript: string[],
    typescript: string[]
};

export const DEFAULT_CONFIG: ESLintEngineConfig = {
    eslint_config_file: undefined,
    eslint_ignore_file: undefined,
    auto_discover_eslint_config: false,
    disable_javascript_base_config: false,
    disable_lwc_base_config: false,
    disable_typescript_base_config: false,
    file_extensions: {
        javascript: ['.js', '.cjs', '.mjs'],
        typescript: ['.ts']
    },
    config_root: process.cwd() // INTERNAL USE ONLY
}

export const ESLINT_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        eslint_config_file: {
            descriptionText: getMessage('ConfigFieldDescription_eslint_config_file'),
            valueType: "string",
            defaultValue: null
        },
        eslint_ignore_file: {
            descriptionText: getMessage('ConfigFieldDescription_eslint_ignore_file'),
            valueType: "string",
            defaultValue: null
        },
        auto_discover_eslint_config: {
            descriptionText: getMessage('ConfigFieldDescription_auto_discover_eslint_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.auto_discover_eslint_config
        },
        disable_javascript_base_config: {
            descriptionText: getMessage('ConfigFieldDescription_disable_javascript_base_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.disable_javascript_base_config
        },
        disable_lwc_base_config: {
            descriptionText: getMessage('ConfigFieldDescription_disable_lwc_base_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.disable_lwc_base_config
        },
        disable_typescript_base_config: {
            descriptionText: getMessage('ConfigFieldDescription_disable_typescript_base_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.disable_typescript_base_config
        },
        file_extensions: {
            descriptionText: getMessage('ConfigFieldDescription_file_extensions'),
            valueType: "object",
            defaultValue: DEFAULT_CONFIG.file_extensions
        }
    }
}

// See https://eslint.org/docs/v8.x/use/configure/configuration-files#configuration-file-formats
export const LEGACY_ESLINT_CONFIG_FILES: string[] =
    ['.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json'];

export const LEGACY_ESLINT_IGNORE_FILE: string = '.eslintignore';


export function validateAndNormalizeConfig(configValueExtractor: ConfigValueExtractor): ESLintEngineConfig {
    const eslintConfigValueExtractor: ESLintEngineConfigValueExtractor = new ESLintEngineConfigValueExtractor(configValueExtractor);
    return {
        config_root: configValueExtractor.getConfigRoot(), // INTERNAL USE ONLY
        eslint_config_file: eslintConfigValueExtractor.extractESLintConfigFileValue(),
        eslint_ignore_file: eslintConfigValueExtractor.extractESLintIgnoreFileValue(),
        auto_discover_eslint_config: eslintConfigValueExtractor.extractBooleanValue('auto_discover_eslint_config'),
        disable_javascript_base_config: eslintConfigValueExtractor.extractBooleanValue('disable_javascript_base_config'),
        disable_lwc_base_config: eslintConfigValueExtractor.extractBooleanValue('disable_lwc_base_config'),
        disable_typescript_base_config: eslintConfigValueExtractor.extractBooleanValue('disable_typescript_base_config'),
        file_extensions:  eslintConfigValueExtractor.extractFileExtensionsValue(),
    };
}

class ESLintEngineConfigValueExtractor {
    private static readonly FILE_EXT_PATTERN: RegExp = /^[.][a-zA-Z0-9]+$/;
    private readonly delegateExtractor: ConfigValueExtractor;

    constructor(delegateExtractor: ConfigValueExtractor) {
        this.delegateExtractor = delegateExtractor;
    }

    extractESLintConfigFileValue(): string | undefined {
        const eslintConfigFileField: string = 'eslint_config_file';
        const eslintConfigFile: string | undefined = this.delegateExtractor.extractFile(eslintConfigFileField, DEFAULT_CONFIG.eslint_config_file);
        if (eslintConfigFile && !LEGACY_ESLINT_CONFIG_FILES.includes(path.basename(eslintConfigFile))) {
            throw new Error(getMessage('InvalidLegacyConfigFileName', this.delegateExtractor.getFieldPath(eslintConfigFileField),
                path.basename(eslintConfigFile), JSON.stringify(LEGACY_ESLINT_CONFIG_FILES)));
        }
        return eslintConfigFile;
    }

    extractESLintIgnoreFileValue(): string | undefined {
        const eslintIgnoreFileField: string = 'eslint_ignore_file';
        const eslintIgnoreFile: string | undefined = this.delegateExtractor.extractFile(eslintIgnoreFileField, DEFAULT_CONFIG.eslint_ignore_file);
        if (eslintIgnoreFile && path.basename(eslintIgnoreFile) !== LEGACY_ESLINT_IGNORE_FILE) {
            throw new Error(getMessage('InvalidLegacyIgnoreFileName', this.delegateExtractor.getFieldPath(eslintIgnoreFileField),
                path.basename(eslintIgnoreFile), LEGACY_ESLINT_IGNORE_FILE));
        }
        return eslintIgnoreFile;
    }

    extractFileExtensionsValue(): FileExtensionsObject {
        if (!this.delegateExtractor.hasValueDefinedFor('file_extensions')) {
            return DEFAULT_CONFIG.file_extensions;
        }

        const fileExtsObjExtractor: ConfigValueExtractor = this.delegateExtractor.extractObjectAsExtractor('file_extensions');

        // Validate languages
        const validLanguages: string[] = Object.keys(DEFAULT_CONFIG.file_extensions);
        for (const key of fileExtsObjExtractor.getKeys()) {
            // Note: In the future we may want to make the languages case-insensitive. Right now it is a little tricky
            //       because the extract* methods (like extractArray) look for the exact key name.
            if (!(validLanguages.includes(key))) {
                throw new Error(getMessage('InvalidFieldKeyForObject', fileExtsObjExtractor.getFieldPath(), key, validLanguages.join(', ')))
            }
        }

        // Validate file extension patterns
        const extractExtensionsValue = function (fieldName: string, defaultValue: string[]): string[] {
            const fileExts: string[] = fileExtsObjExtractor.extractArray(fieldName, ValueValidator.validateString, defaultValue)!;
            fileExts.map((fileExt, i) => validateStringMatches(
                ESLintEngineConfigValueExtractor.FILE_EXT_PATTERN, fileExt, `${fileExtsObjExtractor.getFieldPath(fieldName)}[${i}]`));
            return makeUnique(fileExts);
        }
        const fileExtsObj: FileExtensionsObject = {
            javascript: extractExtensionsValue('javascript', DEFAULT_CONFIG.file_extensions.javascript),
            typescript: extractExtensionsValue('typescript', DEFAULT_CONFIG.file_extensions.typescript)
        }

        // Validate that there is no file extension listed with multiple languages
        const allExts: string[] = fileExtsObj.javascript.concat(fileExtsObj.typescript);
        if (allExts.length != (new Set(allExts)).size) {
            const currentValuesString: string =
                `  ${fileExtsObjExtractor.getFieldPath('javascript')}: ${JSON.stringify(fileExtsObj.javascript)}\n` +
                `  ${fileExtsObjExtractor.getFieldPath('typescript')}: ${JSON.stringify(fileExtsObj.typescript)}`;
            throw new Error(getMessage('ConfigStringArrayValuesMustNotShareElements', currentValuesString));
        }

        return fileExtsObj;
    }

    extractBooleanValue(field_name: string): boolean {
        return this.delegateExtractor.extractBoolean(field_name, DEFAULT_CONFIG[field_name as keyof ESLintEngineConfig] as boolean)!;
    }
}

function validateStringMatches(pattern: RegExp, value: string, fieldName: string): string {
    if (!pattern.test(value)) {
        throw new Error(getMessage('ConfigStringValueMustMatchPattern', fieldName, value, pattern.source));
    }
    return value;
}