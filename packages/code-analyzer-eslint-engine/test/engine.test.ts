import {
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RunRulesProgressEvent,
    RuleDescription,
    RunOptions,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {changeWorkingDirectoryToPackageRoot, unzipToFolder} from "./test-helpers";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {ESLintEngine} from "../src/engine";
import {DEFAULT_CONFIG} from "../src/config";
import {getMessage} from "../src/messages";
import * as os from "node:os";

changeWorkingDirectoryToPackageRoot();

jest.setTimeout(30_000);

const legacyConfigCasesFolder: string = path.join(__dirname, 'test-data', 'legacyConfigCases');
const workspaceWithNoCustomConfig: string =
    path.join(legacyConfigCasesFolder, 'workspace_NoCustomConfig');
const workspaceThatHasCustomConfigModifyingExistingRules: string =
    path.join(legacyConfigCasesFolder, 'workspace_HasCustomConfigModifyingExistingRules');
const workspaceThatHasCustomConfigWithNewRules: string =
    path.join(legacyConfigCasesFolder, 'workspace_HasCustomConfigWithNewRules');
const workspaceThatIgnoresFilesByConfig: string =
    path.join(legacyConfigCasesFolder, 'workspace_HasFilesIgnoredByConfig');
const workspaceThatHasEslintIgnoreFile: string =
    path.join(legacyConfigCasesFolder, 'workspace_HasEslintIgnoreFile');

describe('Tests for the getName method of ESLintEngine', () => {
    it('When getName is called, then eslint is returned', () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        expect(engine.getName()).toEqual('eslint');
    });
})

describe('Tests for the describeRules method of ESLintEngine', () => {
    type LEGACY_CASE = {description: string, folder: string, expectationFile: string};
    const legacyCases: LEGACY_CASE[] = [
        {
            description: 'with no customizations',
            folder: workspaceWithNoCustomConfig,
            expectationFile: 'rules_DefaultConfig.goldfile.json'
        },
        {
            description: 'with config that modifies existing rules',
            folder: workspaceThatHasCustomConfigModifyingExistingRules,
            expectationFile: 'rules_DefaultConfigAndCustomConfigModifyingExistingRules.goldfile.json'
        },
        {
            description: 'with config that adds a new plugin and rules',
            folder: workspaceThatHasCustomConfigWithNewRules,
            expectationFile: 'rules_DefaultConfigAndCustomConfigWithNewRules.goldfile.json'
        },
    ]

    it.each(legacyCases)('When describing rules while cwd is folder $description and auto_discover_eslint_config=true, then return expected', async (caseObj: LEGACY_CASE) => {
        const origWorkingDir: string = process.cwd();
        process.chdir(caseObj.folder);
        try {
            const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
                auto_discover_eslint_config: true
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
            expectRulesToMatchLegacyExpectationFile(ruleDescriptions, caseObj.expectationFile);
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it.each(legacyCases)('When describing rules while from a workspace $description and auto_discover_eslint_config=true, then return expected', async (caseObj: LEGACY_CASE) => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            auto_discover_eslint_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({
            workspace: new Workspace([caseObj.folder])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, caseObj.expectationFile);
    });

    it.each(legacyCases)('When describing rules while config_root is folder $description and auto_discover_eslint_config=true, then return expected', async (caseObj: LEGACY_CASE) => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            auto_discover_eslint_config: true,
            config_root: caseObj.folder
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, caseObj.expectationFile);
    });

    it('When describing rules from a workspace with no javascript files, then no javascript rules should return', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
                path.join(workspaceWithNoCustomConfig, 'dummy3.txt'), path.join(workspaceWithNoCustomConfig, 'dummy2.ts')])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoJavascriptFilesInWorkspace.goldfile.json');
    });

    it('When describing rules from a workspace with no typescript files, then no typescript rules should returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
            path.join(workspaceWithNoCustomConfig, 'dummy1.js'), path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoTypescriptFilesInWorkspace.goldfile.json');
    });

    it('When describing rules from a workspace with no javascript or typescript files, then no rules should return', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
                path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When describing rules from an empty workspace, then no rules should return', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([])});
        expect(ruleDescriptions).toHaveLength(0);
    });


    it('When eslint_config_file is provided, then it is applied', async () => {
        // While the workspace is workspace_NoCustomConfig, we use the config from workspace_HasCustomConfigWithNewRules
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname,
            eslint_config_file: path.join(workspaceThatHasCustomConfigWithNewRules, '.eslintrc.yml')
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({
            workspace: new Workspace([workspaceWithNoCustomConfig])});

        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfigAndCustomConfigWithNewRules.goldfile.json');
    });

    it('When auto_discover_eslint_config=false and eslint_config_file is not provided, then no user config should be applied', async () => {
        // While sitting in workspace_HasCustomConfigModifyingExistingRules, we turn off customization
        const origWorkingDir: string = process.cwd();
        process.chdir(workspaceThatHasCustomConfigModifyingExistingRules); // We will cd into it ...
        try {
            const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
                config_root: workspaceThatHasCustomConfigModifyingExistingRules // ... make it config root ...
            });
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

            const ruleDescriptions: RuleDescription[] = await engine.describeRules({
                workspace: new Workspace([workspaceThatHasCustomConfigModifyingExistingRules])}); // ... and include it in the workspace

            expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig.goldfile.json');

            // Sanity check that we emit an info log event letting the user know that their custom eslint config isn't being used
            const relPathFromConfigRoot: string = path.join(workspaceThatHasCustomConfigModifyingExistingRules.slice((process.cwd() + path.sep).length), '.eslintrc.json');
            const relPathFromCwd: string = path.join(workspaceThatHasCustomConfigModifyingExistingRules.slice((process.cwd() + path.sep).length), '.eslintrc.json');
            expect(logEvents).toContainEqual({
                type: EventType.LogEvent,
                logLevel: LogLevel.Info,
                message: getMessage('UnusedEslintConfigFile', relPathFromCwd, relPathFromConfigRoot)
            });
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it('When auto_discover_eslint_config=false and eslint_config_file is provided, the supplied config file is used but others are not', async () => {
        // While sitting in workspace_HasCustomConfigWithNewRules, we use the eslint config file from workspace_HasCustomConfigModifyingExistingRules
        const origWorkingDir: string = process.cwd();
        process.chdir(workspaceThatHasCustomConfigWithNewRules); // We will cd into it ...
        try {
            const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
                config_root: workspaceThatHasCustomConfigWithNewRules, // ... make it config root ...
                auto_discover_eslint_config: false, // This should trump environment info but not the eslint_config_file
                eslint_config_file: path.join(workspaceThatHasCustomConfigModifyingExistingRules, '.eslintrc.json')
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({
                workspace: new Workspace([workspaceThatHasCustomConfigWithNewRules])}); // ... and include it in the workspace

            expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfigAndCustomConfigModifyingExistingRules.goldfile.json');
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it('When disable_javascript_base_config=true, then the base rules are removed for javascript only', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DisabledJavascriptBaseConfig.goldfile.json');
    });

    it('When disable_lwc_base_config=true, then the lwc rules are removed but javascript rules remain', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DisabledLwcBaseConfig.goldfile.json');
    });

    it('When disable_typescript_base_config=true, then the typescript rules are removed', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_typescript_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DisabledTypescriptBaseConfig.goldfile.json');
    });

    it('When disable_lwc_base_config=true and disable_typescript_base_config=true, then only base javascript rules remain', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_OnlyJavascriptBaseConfig.goldfile.json');
    });

    it('When disable_javascript_base_config=true and disable_lwc_base_config=true, then only base typescript rules remain', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_lwc_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_OnlyTypescriptBaseConfig.goldfile.json');
    });

    it('When disable_javascript_base_config=true and disable_typescript_base_config=true, then only base lwc rules remain', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_OnlyLwcBaseConfig.goldfile.json');
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

    it('When all base configs are off and custom config with new rules exists, when auto_discover_eslint_config=true then only custom config is applied', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: workspaceThatHasCustomConfigWithNewRules,
            auto_discover_eslint_config: true,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_OnlyCustomConfigWithNewRules.goldfile.json');
    });

    it('When all base configs are off and custom config that modifies eslint rules exists and auto_discover_eslint_config=true, then only custom config is applied', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            auto_discover_eslint_config: true,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({
            workspace: new Workspace([path.join(workspaceThatHasCustomConfigModifyingExistingRules, 'dummy1.js')])
        });
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_OnlyCustomConfigModifyingExistingRules.goldfile.json');
    });

    it('When file_extensions.javascript is empty, then javascript rules do not get picked up', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            file_extensions: {
                ... DEFAULT_CONFIG.file_extensions,
                javascript: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoJavascriptFilesInWorkspace.goldfile.json');
    });

    it('When file_extensions.javascript is empty, then javascript rules do not get picked up', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            file_extensions: {
                ... DEFAULT_CONFIG.file_extensions,
                typescript: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoTypescriptFilesInWorkspace.goldfile.json');
    });

    it('When file_extensions.javascript and file_extensions.typescript are both empty, then no rules are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            file_extensions: {
                ...DEFAULT_CONFIG.file_extensions,
                javascript: [],
                typescript: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When workspace contains custom config that installs same plugin as one of our base plugins, we should make eslint conflict error helpful', async () => {
        if (os.platform() === 'win32') {
            // Sadly this test takes like 30 to 60 seconds on windows. I wish there was an alternative way to write this
            // test, but we need a workspace that has the eslint plugin lwc plugin installed with all of its
            // dependencies and unzipping the workspace is the best thing I could come up with.
            // For now, we skip this test only on windows.
            return;
        }
        const workspaceZip: string = path.join(__dirname, 'test-data', 'workspaceWithConflictingConfig.zip');
        const tempFolder: string = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-test'));
        await unzipToFolder(workspaceZip, tempFolder);
        const workspaceFolder: string = path.join(tempFolder, 'workspaceWithConflictingConfig');

        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            auto_discover_eslint_config: true,
            config_root: workspaceFolder
        });
        await expect(engine.describeRules({})).rejects.toThrow(/The eslint engine encountered a conflict.*/);
    });

    it('When configuration file contains plugin that cannot be found, then error with helpful message', async () => {
        const workspaceFolder: string = path.join(__dirname, 'test-data', 'workspaceWithMissingESLintPlugin');
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            eslint_config_file: path.join(workspaceFolder, '.eslintrc.json'),
            config_root: workspaceFolder
        });
        await expect(engine.describeRules({})).rejects.toThrow(/The eslint engine encountered an unexpected error.*/);
    });

    it('When workspace contains ignored file based on eslint config, then that file is ignored during rule calculation', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            eslint_config_file: path.join(workspaceThatIgnoresFilesByConfig, '.eslintrc.json')
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(
            {workspace: new Workspace([workspaceThatIgnoresFilesByConfig])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoJavascriptFilesInWorkspace.goldfile.json');
    });

    it('When workspace contains .eslintignore that ignores a file but has not be applied, then that file not ignored and an info event is emitted', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(
            {workspace: new Workspace([workspaceThatHasEslintIgnoreFile])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig.goldfile.json');

        const relPathFromCwd: string = path.join(workspaceThatHasEslintIgnoreFile.slice((process.cwd() + path.sep).length), '.eslintignore');
        const relPathFromConfigRoot: string = path.join(workspaceThatHasEslintIgnoreFile.slice((__dirname + path.sep).length), '.eslintignore');
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Info,
            message: getMessage('UnusedEslintIgnoreFile', relPathFromCwd, relPathFromConfigRoot)
        });
    });

    it('When workspace contains .eslintignore that ignores a file and auto_discover_eslint_config=true, then that file is ignored', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname,
            auto_discover_eslint_config: true
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(
            {workspace: new Workspace([workspaceThatHasEslintIgnoreFile])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoJavascriptFilesInWorkspace.goldfile.json');
    });

    it('When workspace contains .eslintignore that is set as the eslint_ignore_file value, then that file is ignored', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname,
            eslint_ignore_file: path.join(workspaceThatHasEslintIgnoreFile, '.eslintignore')
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(
            {workspace: new Workspace([workspaceThatHasEslintIgnoreFile])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoJavascriptFilesInWorkspace.goldfile.json');
    });

    it('When custom rules only apply to file extensions that are not javascript or typescript based, then without specifying file extensions, they are not picked up', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname,
            disable_lwc_base_config: true,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            eslint_config_file: path.join(workspaceThatHasCustomConfigWithNewRules, '.eslintrc_customLanguage.yml')
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(
            {workspace: new Workspace([workspaceThatHasCustomConfigWithNewRules])});

        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When custom rules only apply to file extensions that are not javascript or typescript based, then when specifying file extensions, they are picked up', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname,
            disable_lwc_base_config: true,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            eslint_config_file: path.join(workspaceThatHasCustomConfigWithNewRules, '.eslintrc_customLanguage.yml'),
            file_extensions:{
                ... DEFAULT_CONFIG.file_extensions,
                other: ['.html', '.cmp']
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(
            {workspace: new Workspace([workspaceThatHasCustomConfigWithNewRules])});

        expect(ruleDescriptions).toHaveLength(3);
        expect(ruleDescriptions.map(rd => rd.name)).toEqual(["dummy/my-rule-1", "dummy/my-rule-2", "dummy/my-rule-3"]);
    });
});

describe('Typical tests for the runRules method of ESLintEngine', () => {
    const expectedJsViolation_noInvalidRegexp: Violation = {
        "codeLocations": [{
            "endColumn": 30,
            "endLine": 2,
            "file": path.join(workspaceWithNoCustomConfig, 'dummy1.js'),
            "startColumn": 15,
            "startLine": 2
        }],
        "message": "Invalid regular expression: /[/: Unterminated character class.",
        "primaryLocationIndex": 0,
        "ruleName": "no-invalid-regexp"
    };
    const expectedTsViolation_noInvalidRegexp: Violation = {
        "codeLocations": [{
            "endColumn": 38,
            "endLine": 6,
            "file": path.join(workspaceWithNoCustomConfig, 'dummy2.ts'),
            "startColumn": 23,
            "startLine": 6
        }],
        "message": "Invalid regular expression: /[/: Unterminated character class.",
        "primaryLocationIndex": 0,
        "ruleName": "no-invalid-regexp"
    };
    const expectedTsViolation_noWrapperObjectTypes: Violation = {
        "codeLocations": [{
            "endColumn": 20,
            "endLine": 2,
            "file": path.join(workspaceWithNoCustomConfig, 'dummy2.ts'),
            "startColumn": 14,
            "startLine": 2
        }],
        "message": "Prefer using the primitive `string` as a type name, rather than the upper-cased `String`.",
        "primaryLocationIndex": 0,
        "ruleName": "@typescript-eslint/no-wrapper-object-types"
    };

    it('When running with defaults and no customizations, then violations for javascript and typescript are found correctly', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: new Workspace([workspaceWithNoCustomConfig])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp', '@typescript-eslint/no-wrapper-object-types'], runOptions);

        expect(results.violations).toHaveLength(3);
        expect(results.violations).toContainEqual(expectedJsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_noWrapperObjectTypes);
    });

    it('When workspace only contains javascript files, then only javascript violations are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: new Workspace([path.join(workspaceWithNoCustomConfig, 'dummy1.js')])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toEqual([expectedJsViolation_noInvalidRegexp]);
    });

    it('When workspace only contains typescript files, then only typescript violations are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: new Workspace([path.join(workspaceWithNoCustomConfig, 'dummy2.ts')])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toEqual([expectedTsViolation_noInvalidRegexp]);
    });

    it('When workspace does not contains javascript or typescript files, then zero violations are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: new Workspace([path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toHaveLength(0);
    });

    it('When using custom plugin rules, then violations from custom rules are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            auto_discover_eslint_config: true
        });
        const runOptions: RunOptions = {workspace: new Workspace([path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy1.js')])};
        const results: EngineRunResults = await engine.runRules(['dummy/my-rule-1', 'dummy/my-rule-2'], runOptions);

        expect(results.violations).toHaveLength(2);
        expect(results.violations).toContainEqual({
            "codeLocations": [{
                "endColumn": 14,
                "endLine": 1,
                "file": path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy1.js'),
                "startColumn": 5,
                "startLine": 1
            }],
            "message": "Avoid using variables named 'forbidden'",
            "primaryLocationIndex": 0,
            "ruleName": "dummy/my-rule-1"
        });
        expect(results.violations).toContainEqual({
            "codeLocations": [{
                "endColumn": 9,
                "endLine": 3,
                "file":  path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy1.js'),
                "startColumn": 5,
                "startLine": 3
            }],
            "message": "Avoid using variables named 'oops'",
            "primaryLocationIndex": 0,
            "ruleName": "dummy/my-rule-1"
        });
    });

    it('When custom rules only apply to file extensions that are not javascript or typescript based, then when specifying file extensions, the rules run', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname,
            eslint_config_file: path.join(workspaceThatHasCustomConfigWithNewRules, '.eslintrc_customLanguage.yml'),
            file_extensions:{
                ... DEFAULT_CONFIG.file_extensions,
                other: ['.html', '.cmp']
            }
        });

        const runOptions: RunOptions = {workspace: new Workspace([path.join(workspaceThatHasCustomConfigWithNewRules)])};

        const results: EngineRunResults = await engine.runRules(['dummy/my-rule-1'], runOptions);

        expect(results.violations).toHaveLength(1);
        expect(results.violations[0]).toEqual({
            ruleName: "dummy/my-rule-1",
            primaryLocationIndex: 0,
            message: "Avoid using variables named 'forbidden'",
            codeLocations: [{
                file: path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy.html'),
                startLine: 2,
                startColumn: 5,
                endLine: 2,
                endColumn: 14
            }]
        });
    });

    it('When custom eslint config exists but is not applied, then runRules emits info message', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: __dirname
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const runOptions: RunOptions = {workspace: new Workspace([path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy1.js')])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);
        expect(results.violations).toHaveLength(0);

        const relPathFromConfigRoot: string = path.join(workspaceThatHasCustomConfigWithNewRules.slice((__dirname + path.sep).length), '.eslintrc.yml');
        const relPathFromCwd: string = path.join(workspaceThatHasCustomConfigWithNewRules.slice((process.cwd() + path.sep).length), '.eslintrc.yml');
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Info,
            message: getMessage('UnusedEslintConfigFile', relPathFromCwd, relPathFromConfigRoot)
        });
    });

    it('When runRules is called on workspace with a config that ignores files and auto discover is true, then those files are ignored', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            auto_discover_eslint_config: true
        });
        const runOptions: RunOptions = {workspace: new Workspace([workspaceThatIgnoresFilesByConfig])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp', '@typescript-eslint/no-wrapper-object-types'], runOptions);
        expect(results.violations).toHaveLength(2); // Should not contain js violations but should contain ts violations
        expect(path.extname(results.violations[0].codeLocations[0].file)).toEqual('.ts');
        expect(path.extname(results.violations[1].codeLocations[0].file)).toEqual('.ts');
    });

    it('When runRules is called and a ".eslintignore" file is provided that ignores files, then those files are ignored', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            eslint_ignore_file: path.join(workspaceThatHasEslintIgnoreFile, '.eslintignore')
        });
        const runOptions: RunOptions = {workspace: new Workspace([workspaceThatHasEslintIgnoreFile])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp', '@typescript-eslint/no-wrapper-object-types'], runOptions);
        expect(results.violations).toHaveLength(2); // Should not contain js violations but should contain ts violations
        expect(path.extname(results.violations[0].codeLocations[0].file)).toEqual('.ts');
        expect(path.extname(results.violations[1].codeLocations[0].file)).toEqual('.ts');
    });

    it('When runRules is called on a workspace that has a babel configuration file, then the file is ignored and no error events are thrown', async () => {
        const folderContainingBabelConfigFile: string = path.join(__dirname, 'test-data','workspaceWithBabelConfigFile');
        const logEvents: LogEvent[] = [];
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const origWorkingDir: string = process.cwd();
        process.chdir(folderContainingBabelConfigFile);
        try {
            const runOptions: RunOptions = {workspace: new Workspace([folderContainingBabelConfigFile])};
            engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
            await engine.runRules(['@lwc/lwc/no-unexpected-wire-adapter-usages'], runOptions);
            expect(logEvents.filter(ev => ev.logLevel === LogLevel.Error)).toHaveLength(0);
        } finally {
            process.chdir(origWorkingDir);
        }
    });
});

describe('Tests for the getEngineVersion method of ESLint Engine', () => {
    it('getEngineVersion() outputs something resembling a Semantic Version', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const version: string = await engine.getEngineVersion();

        expect(version).toMatch(/\d+\.\d+\.\d+.*/);
    });
});

describe('Tests for emitting events', () => {
    let engine: ESLintEngine;
    let logEvents: LogEvent[];
    let runRulesProgressEvents: RunRulesProgressEvent[];
    let describeRulesProgressEvents: DescribeRulesProgressEvent[];
    beforeEach(() => {
        engine = new ESLintEngine(DEFAULT_CONFIG);
        logEvents = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        runRulesProgressEvents = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (event: RunRulesProgressEvent) => runRulesProgressEvents.push(event));
        describeRulesProgressEvents = [];
        engine.onEvent(EventType.DescribeRulesProgressEvent, (event: DescribeRulesProgressEvent) => describeRulesProgressEvents.push(event));
    })

    it('When workspace contains an unparsable javascript file, then we emit an error log event and continue to next file', async () => {
        const workspaceFolder: string = path.join(__dirname, 'test-data', 'workspaceWithUnparsableCode');
        const runOptions: RunOptions = {workspace: new Workspace([workspaceFolder])};
        const results: EngineRunResults = await engine.runRules(['no-unused-vars'], runOptions);

        const errorEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Error);
        expect(errorEvents).toHaveLength(1);
        expect(errorEvents[0].logLevel).toEqual(LogLevel.Error);
        expect(errorEvents[0].message).toEqual(
            getMessage('ESLintErroredWhenScanningFile', path.join(workspaceFolder, 'unparsableFile.js'),
                '    Parsing error: Unterminated string constant. (2:4)'));

        // Sanity check that we still get violations from files that could be parsed
        expect(results.violations).toHaveLength(1);
        expect(results.violations[0].codeLocations[0].file).toEqual(
            path.join(workspaceFolder, 'parsableFileWithViolation.js'));
    });

    it('When describeRules is called, then it emits correct progress events', async () => {
        await engine.describeRules({});
        expect(describeRulesProgressEvents.map(e => e.percentComplete)).toEqual([0, 10, 40, 80, 100]);
    });

    it('When runRules is called, then it emits correct progress events', async () => {
        const runOptions: RunOptions = {workspace: new Workspace([workspaceWithNoCustomConfig])};
        await engine.runRules(['no-unused-vars'], runOptions);
        expect(runRulesProgressEvents.map(e => e.percentComplete)).toEqual([0, 30, 95, 100]);
    });
});

function expectRulesToMatchLegacyExpectationFile(ruleDescriptions: RuleDescription[], expectationFile: string): void {
    const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
    const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
        path.join(legacyConfigCasesFolder, expectationFile), 'utf8');
    expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
}