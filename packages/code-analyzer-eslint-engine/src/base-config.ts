import {Linter} from "eslint";
import {ESLintEngineConfig} from "./config";

export enum BaseRuleset {
    ALL = "all",
    RECOMMENDED = "recommended"
}

export class LegacyBaseConfigFactory {
    private readonly config: ESLintEngineConfig;

    constructor(config: ESLintEngineConfig) {
        this.config = config;
    }

    createBaseConfig(baseRuleset: BaseRuleset): Linter.Config  {
        const overrides: Linter.ConfigOverride[] = [];
        if (this.useJsConfig() && this.useLwcConfig()) {
            overrides.push(this.createJavascriptPlusLwcConfig(baseRuleset));
        } else if (this.useJsConfig()) {
            overrides.push(this.createJavascriptConfig(baseRuleset));
        } else if (this.useLwcConfig()) {
            overrides.push(this.createLwcConfig());
        }
        if (this.useTsConfig()) {
            overrides.push(this.createTypescriptConfig(baseRuleset));
        }

        return {
            globals: {
                // Mark $A as known global for Aura: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/ref_jsapi_dollarA.htm
                "$A": "readonly",
            },
            overrides: overrides
        };
    }

    private useJsConfig(): boolean {
        return !this.config.disable_javascript_base_config && this.config.javascript_file_extensions.length > 0;
    }

    private useLwcConfig(): boolean {
        return !this.config.disable_lwc_base_config && this.config.javascript_file_extensions.length > 0;
    }

    private useTsConfig(): boolean {
        return !this.config.disable_typescript_base_config && this.config.typescript_file_extensions.length > 0;
    }

    private createJavascriptConfig(baseRuleset: BaseRuleset): Linter.ConfigOverride {
        return {
            files: this.config.javascript_file_extensions.map(ext => `*${ext}`),
            extends: [`eslint:${baseRuleset}`]
        }
    }

    private createLwcConfig(): Linter.ConfigOverride {
        return {
            files: this.config.javascript_file_extensions.map(ext => `*${ext}`),
            extends: [
                "@salesforce/eslint-config-lwc/base" // Always using base for now. all and recommended both require additional plugins
            ],
            plugins: [
                "@lwc/eslint-plugin-lwc"
            ],
            parser: "@babel/eslint-parser",
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    parserOpts: {
                        plugins: [
                            "classProperties",
                            ["decorators", { "decoratorsBeforeExport": false }]
                        ]
                    }
                }
            }
        }
    }

    private createJavascriptPlusLwcConfig(baseRuleset: BaseRuleset): Linter.ConfigOverride {
        const jsPlusLwcConfig: Linter.ConfigOverride = this.createLwcConfig();
        (jsPlusLwcConfig.extends as string[]).push(`eslint:${baseRuleset}`);
        return jsPlusLwcConfig;
    }

    private createTypescriptConfig(baseRuleset: BaseRuleset): Linter.ConfigOverride {
        return {
            files: this.config.typescript_file_extensions.map(ext => `*${ext}`),
            extends: [
                `eslint:${baseRuleset}`, // The typescript plugin applies the base rules to the typescript files, so we want this
                `plugin:@typescript-eslint/${baseRuleset}`, // May override some rules from eslint:<all|recommended> as needed
            ],
            plugins: [
                "@typescript-eslint"
            ],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                // Finds the tsconfig.json file nearest to each source file. This should work for most users.
                // If not, then we may consider letting user specify this via config or alternatively, users can just
                // set disable_typescript_base_config=true and configure typescript in their own eslint config file.
                // See https://typescript-eslint.io/packages/parser/#project
                project: true
            }
        }
    }
}