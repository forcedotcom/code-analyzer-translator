import {RuleDescription} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {ESLintEngine} from "../src/engine";
import {DEFAULT_CONFIG} from "../src/config";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the ESLintEngine with default config values', () => {
    it('When getName is called, then eslint is returned', () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        expect(engine.getName()).toEqual('eslint');
    });

    type LEGACY_CASE = {description: string, folder: string, expectationFile: string};
    const legacyCases: LEGACY_CASE[] = [
        {
            description: 'with no customizations',
            folder: 'workspace_NoCustomConfig',
            expectationFile: 'expectedRules_DefaultConfig.json'
        },
        {
            description: 'with config that modifies existing rules',
            folder: 'workspace_HasCustomConfigModifyingExistingRules',
            expectationFile: 'expectedRules_DefaultConfigAndCustomConfigModifyingExistingRules.json'
        },
        {
            description: 'with config that adds a new plugin and rules',
            folder: 'workspace_HasCustomConfigWithNewRules',
            expectationFile: 'expectedRules_DefaultConfigAndCustomConfigWithNewRules.json'
        },
    ]

    it.each(legacyCases)('When describing rules while cwd is folder $description, then return expected', async (caseObj: LEGACY_CASE) => {
        const origWorkingDir: string = process.cwd();
        process.chdir(path.join(__dirname, 'test-data', 'legacyConfigCases', caseObj.folder));
        try {
            const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
            expectRulesToMatchLegacyExpectationFile(ruleDescriptions, caseObj.expectationFile);
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it.each(legacyCases)('When describing rules while from a workspace $description, then return expected', async (caseObj: LEGACY_CASE) => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({
            workspace: testTools.createWorkspace([path.join(__dirname, 'test-data', 'legacyConfigCases', caseObj.folder)])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, caseObj.expectationFile);
    });

    it.each(legacyCases)('When describing rules while config_root is folder $description, then return expected', async (caseObj: LEGACY_CASE) => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: path.join(__dirname, 'test-data', 'legacyConfigCases', caseObj.folder)});
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, caseObj.expectationFile);
    });

    it('When describing rules from a workspace with no javascript files, then no javascript rules should return', async () => {
        const caseFolder: string = path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_NoCustomConfig');
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
                path.join(caseFolder, 'dummy3.txt'), path.join(caseFolder, 'dummy2.ts')])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DefaultConfig_NoJavascriptFilesInWorkspace.json');
    });

    it('When describing rules from a workspace with no typescript files, then no typescript rules should returned', async () => {
        const caseFolder: string = path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_NoCustomConfig');
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
            path.join(caseFolder, 'dummy1.js'), path.join(caseFolder, 'dummy3.txt')])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DefaultConfig_NoTypescriptFilesInWorkspace.json');
    });

    it('When describing rules from a workspace with no javascript or typescript files, then no rules should return', async () => {
        const caseFolder: string = path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_NoCustomConfig');
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
                path.join(caseFolder, 'dummy3.txt')])});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When describing rules from an empty workspace, then no rules should return', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([])});
        expect(ruleDescriptions).toHaveLength(0);
    });


    it('When eslint_config_file is provided, then it is applied', async () => {
        // While the workspace is workspace_NoCustomConfig, we use the config from workspace_HasCustomConfigWithNewRules
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname,
            eslint_config_file: path.join(__dirname,'test-data','legacyConfigCases','workspace_HasCustomConfigWithNewRules','.eslintrc.yml')
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({
            workspace: testTools.createWorkspace([path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_NoCustomConfig')])});

        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DefaultConfigAndCustomConfigWithNewRules.json');
    });

    it('When disable_config_lookup=true and eslint_config_file is not provided, then no user config should be applied', async () => {
        // While sitting in workspace_HasCustomConfigModifyingExistingRules, we turn off customization
        const folderForEverything: string = path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_HasCustomConfigModifyingExistingRules');
        const origWorkingDir: string = process.cwd();
        process.chdir(folderForEverything); // We will cd into it ...
        try {
            const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
                config_root: folderForEverything, // ... make it config root ...
                disable_config_lookup: true // This should trump the environment so that no user config is applied
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({
                workspace: testTools.createWorkspace([folderForEverything])}); // ... and include it in the workspace

            expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DefaultConfig.json');
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it('When disable_config_lookup=true and eslint_config_file is provided, the supplied config file is used but others are not', async () => {
        // While sitting in workspace_HasCustomConfigWithNewRules, we use the eslint config file from workspace_HasCustomConfigModifyingExistingRules
        const folderForEverything: string = path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_HasCustomConfigWithNewRules');
        const origWorkingDir: string = process.cwd();
        process.chdir(folderForEverything); // We will cd into it ...
        try {
            const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
                config_root: folderForEverything, // ... make it config root ...
                disable_config_lookup: true, // This should trump environment info but not the eslint_config_file
                eslint_config_file: path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_HasCustomConfigModifyingExistingRules', '.eslintrc.json')
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({
                workspace: testTools.createWorkspace([folderForEverything])}); // ... and include it in the workspace

            expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DefaultConfigAndCustomConfigModifyingExistingRules.json');
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it('When disable_javascript_base_config=true, then the base rules are removed for javascript only', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DisabledJavascriptBaseConfig.json');
    });

    it('When disable_lwc_base_config=true, then the lwc rules are removed but javascript rules remain', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DisabledLwcBaseConfig.json');
    });

    it('When disable_typescript_base_config=true, then the typescript rules are removed', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_typescript_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DisabledTypescriptBaseConfig.json');
    });

    it('When disable_lwc_base_config=true and disable_typescript_base_config=true, then only base javascript rules remain', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_OnlyJavascriptBaseConfig.json');
    });

    it('When disable_javascript_base_config=true and disable_lwc_base_config=true, then only base typescript rules remain', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_lwc_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_OnlyTypescriptBaseConfig.json');
    });

    it('When disable_javascript_base_config=true and disable_typescript_base_config=true, then only base lwc rules remain', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_OnlyLwcBaseConfig.json');
    });

    it('When all *_javascript_base_config equal true and no custom config exists, then no rules should exist', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When all base configs are off and custom config with new rules exists, then only custom config is applied', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_HasCustomConfigWithNewRules'),
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_OnlyCustomConfigWithNewRules.json');
    });

    it('When all base configs are off and custom config that modifies eslint rules exists, then only custom config is applied', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({
            workspace: testTools.createWorkspace([path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspace_HasCustomConfigModifyingExistingRules', 'dummy1.js')])
        });
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_OnlyCustomConfigModifyingExistingRules.json');
    });

    it('When javascript_file_extensions is empty, then javascript rules do not get picked up', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            javascript_file_extensions: []
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DefaultConfig_NoJavascriptFilesInWorkspace.json');
    });

    it('When javascript_file_extensions is empty, then javascript rules do not get picked up', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            typescript_file_extensions: []
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'expectedRules_DefaultConfig_NoTypescriptFilesInWorkspace.json');
    });

    it('When javascript_file_extensions and typescript_file_extensions are both empty, then no rules are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            javascript_file_extensions: [],
            typescript_file_extensions: []
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expect(ruleDescriptions).toHaveLength(0);
    });
});

function expectRulesToMatchLegacyExpectationFile(ruleDescriptions: RuleDescription[], expectationFile: string): void {
    const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
    const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
        path.join(__dirname, 'test-data', 'legacyConfigCases', expectationFile), 'utf8')
        .replaceAll('\r', ''); // Remove carriage return characters from files in windows
    expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
}