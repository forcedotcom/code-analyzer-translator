import {Linter} from "eslint";

export const LEGACY_BASE_CONFIG_RECOMMENDED: Linter.BaseConfig = createLegacyBaseConfig('recommended');
export const LEGACY_BASE_CONFIG_ALL: Linter.BaseConfig = createLegacyBaseConfig('all');


// TODO: We need to review this and decide what we actually want as our base config. There are so many options.
// Note that if we go with @salesforce/eslint-config-lwc/recommended instead, then it has more rules which
// brings in more plugins. So we would need to npm install these plugins as well:
//         'import', // https://github.com/benmosher/eslint-plugin-import
//         'jest', // https://github.com/jest-community/eslint-plugin-jest
//         '@salesforce/eslint-plugin-lightning', // https://github.com/salesforce/eslint-plugin-lightning
// And many of these plugins have typescript variants, etc. So what do we want?
//
// Open question:
// * Can @salesforce/eslint-config-lwc/base be applied to typescript code along side
//   plugin:@typescript-eslint/recommended? See https://github.com/salesforce/eslint-config-lwc/issues/134
function createLegacyBaseConfig(allOrRecommended: string): Linter.BaseConfig {
    return {
        globals: {
            "$A": "readonly",  // Mark as known global for Aura: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/ref_jsapi_dollarA.htm
        },
        overrides: [
            {
                files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
                extends: [
                    `eslint:${allOrRecommended}`,
                    "@salesforce/eslint-config-lwc/base"
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
            },
            {
                files: ["**/*.ts"],
                extends: [
                    `eslint:${allOrRecommended}`,
                    `plugin:@typescript-eslint/${allOrRecommended}`,
                ],
                plugins: [
                    "@typescript-eslint"
                ],
                parser: '@typescript-eslint/parser',
                parserOptions: {
                    project: true
                }
            }
        ]
    };
}