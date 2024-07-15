import {
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RunRulesProgressEvent,
    RuleDescription,
    RunOptions,
    Violation
} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools";
import {changeWorkingDirectoryToPackageRoot, unzipToFolder} from "./test-helpers";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {ESLintEngine} from "../src/engine";
import {DEFAULT_CONFIG} from "../src/config";
import {getMessage} from "../src/messages";
import * as os from "node:os";
import * as zlib from "node:zlib";

changeWorkingDirectoryToPackageRoot();

const legacyConfigCasesFolder: string = path.join(__dirname, 'test-data', 'legacyConfigCases');
const workspaceWithNoCustomConfig: string =
    path.join(legacyConfigCasesFolder, 'workspace_NoCustomConfig');
const workspaceThatHasCustomConfigModifyingExistingRules: string =
    path.join(legacyConfigCasesFolder, 'workspace_HasCustomConfigModifyingExistingRules');
const workspaceThatHasCustomConfigWithNewRules: string =
    path.join(legacyConfigCasesFolder, 'workspace_HasCustomConfigWithNewRules');

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

    it.each(legacyCases)('When describing rules while cwd is folder $description, then return expected', async (caseObj: LEGACY_CASE) => {
        const origWorkingDir: string = process.cwd();
        process.chdir(caseObj.folder);
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
            workspace: testTools.createWorkspace([caseObj.folder])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, caseObj.expectationFile);
    });

    it.each(legacyCases)('When describing rules while config_root is folder $description, then return expected', async (caseObj: LEGACY_CASE) => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: caseObj.folder});
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, caseObj.expectationFile);
    });

    it('When describing rules from a workspace with no javascript files, then no javascript rules should return', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
                path.join(workspaceWithNoCustomConfig, 'dummy3.txt'), path.join(workspaceWithNoCustomConfig, 'dummy2.ts')])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoJavascriptFilesInWorkspace.goldfile.json');
    });

    it('When describing rules from a workspace with no typescript files, then no typescript rules should returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
            path.join(workspaceWithNoCustomConfig, 'dummy1.js'), path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoTypescriptFilesInWorkspace.goldfile.json');
    });

    it('When describing rules from a workspace with no javascript or typescript files, then no rules should return', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
                path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])});
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
            eslint_config_file: path.join(workspaceThatHasCustomConfigWithNewRules, '.eslintrc.yml')
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({
            workspace: testTools.createWorkspace([workspaceWithNoCustomConfig])});

        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfigAndCustomConfigWithNewRules.goldfile.json');
    });

    it('When disable_config_lookup=true and eslint_config_file is not provided, then no user config should be applied', async () => {
        // While sitting in workspace_HasCustomConfigModifyingExistingRules, we turn off customization
        const origWorkingDir: string = process.cwd();
        process.chdir(workspaceThatHasCustomConfigModifyingExistingRules); // We will cd into it ...
        try {
            const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
                config_root: workspaceThatHasCustomConfigModifyingExistingRules, // ... make it config root ...
                disable_config_lookup: true // This should trump the environment so that no user config is applied
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({
                workspace: testTools.createWorkspace([workspaceThatHasCustomConfigModifyingExistingRules])}); // ... and include it in the workspace

            expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig.goldfile.json');
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it('When disable_config_lookup=true and eslint_config_file is provided, the supplied config file is used but others are not', async () => {
        // While sitting in workspace_HasCustomConfigWithNewRules, we use the eslint config file from workspace_HasCustomConfigModifyingExistingRules
        const origWorkingDir: string = process.cwd();
        process.chdir(workspaceThatHasCustomConfigWithNewRules); // We will cd into it ...
        try {
            const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
                config_root: workspaceThatHasCustomConfigWithNewRules, // ... make it config root ...
                disable_config_lookup: true, // This should trump environment info but not the eslint_config_file
                eslint_config_file: path.join(workspaceThatHasCustomConfigModifyingExistingRules, '.eslintrc.json')
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({
                workspace: testTools.createWorkspace([workspaceThatHasCustomConfigWithNewRules])}); // ... and include it in the workspace

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

    it('When all base configs are off and custom config with new rules exists, then only custom config is applied', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            config_root: workspaceThatHasCustomConfigWithNewRules,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_OnlyCustomConfigWithNewRules.goldfile.json');
    });

    it('When all base configs are off and custom config that modifies eslint rules exists, then only custom config is applied', async() => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({
            workspace: testTools.createWorkspace([path.join(workspaceThatHasCustomConfigModifyingExistingRules, 'dummy1.js')])
        });
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_OnlyCustomConfigModifyingExistingRules.goldfile.json');
    });

    it('When javascript_file_extensions is empty, then javascript rules do not get picked up', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            javascript_file_extensions: []
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoJavascriptFilesInWorkspace.goldfile.json');
    });

    it('When javascript_file_extensions is empty, then javascript rules do not get picked up', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            typescript_file_extensions: []
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expectRulesToMatchLegacyExpectationFile(ruleDescriptions, 'rules_DefaultConfig_NoTypescriptFilesInWorkspace.goldfile.json');
    });

    it('When javascript_file_extensions and typescript_file_extensions are both empty, then no rules are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG,
            javascript_file_extensions: [],
            typescript_file_extensions: []
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When workspace contains custom config that installs same plugin as one of our base plugins, we should make eslint conflict error helpful', async () => {
        // Sadly this test takes like 3 to 30 seconds. I wish there was an alternative way to write this test, but we
        // need a workspace that has the eslint plugin lwc plugin installed with all of its dependencies and unzipping
        // the workspace is the best thing I could come up with.
        const workspaceZip: string = path.join(__dirname, 'test-data', 'workspaceWithConflictingConfig.zip');
        const tempFolder: string = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-test'));
        await unzipToFolder(workspaceZip, tempFolder);
        const workspaceFolder: string = path.join(tempFolder, 'workspaceWithConflictingConfig');

        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG, config_root: workspaceFolder});
        await expect(engine.describeRules({})).rejects.toThrow(/The eslint engine encountered a conflict.*/);
    }, 30000); // Increasing timeout to 30 seconds

    it('When configuration file contains plugin that cannot be found, then error with helpful message', async () => {
        const workspaceFolder: string = path.join(__dirname, 'test-data', 'workspaceWithMissingESLintPlugin');
        const engine: ESLintEngine = new ESLintEngine({...DEFAULT_CONFIG, config_root: workspaceFolder});
        await expect(engine.describeRules({})).rejects.toThrow(/The eslint engine encountered an unexpected error.*/);
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
    const expectedTsViolation_banTypes: Violation = {
        "codeLocations": [{
            "endColumn": 20,
            "endLine": 2,
            "file": path.join(workspaceWithNoCustomConfig, 'dummy2.ts'),
            "startColumn": 14,
            "startLine": 2
        }],
        "message": "Don't use `String` as a type. Use string instead",
        "primaryLocationIndex": 0,
        "ruleName": "@typescript-eslint/ban-types"
    };

    it('When running with defaults and no customizations, then violations for javascript and typescript are found correctly', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([workspaceWithNoCustomConfig])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp', '@typescript-eslint/ban-types'], runOptions);

        expect(results.violations).toHaveLength(3);
        expect(results.violations).toContainEqual(expectedJsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_banTypes);
    });

    it('When workspace only contains javascript files, then only javascript violations are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([path.join(workspaceWithNoCustomConfig, 'dummy1.js')])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toEqual([expectedJsViolation_noInvalidRegexp]);
    });

    it('When workspace only contains typescript files, then only typescript violations are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([path.join(workspaceWithNoCustomConfig, 'dummy2.ts')])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toEqual([expectedTsViolation_noInvalidRegexp]);
    });

    it('When workspace does not contains javascript or typescript files, then zero violations are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])};
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toHaveLength(0);
    });

    it('When using custom plugin rules, then violations from custom rules are returned', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy1.js')])};
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
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([workspaceFolder])};
        const results: EngineRunResults = await engine.runRules(['no-unused-vars'], runOptions);

        const errorEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Error);
        expect(errorEvents).toHaveLength(1);
        expect(errorEvents[0].logLevel).toEqual(LogLevel.Error);
        expect(errorEvents[0].message).toEqual(
            getMessage('ESLintErroredWhenScanningFile', path.join(workspaceFolder, 'unparsableFile.js'),
                'Parsing error: Unterminated string constant. (2:4)'));

        // Sanity check that we still get violations from files that could be parsed
        expect(results.violations).toHaveLength(1);
        expect(results.violations[0].codeLocations[0].file).toEqual(
            path.join(workspaceFolder, 'parsableFileWithViolation.js'));
    });

    it('When eslint ignores a file, then we emit a warning event and continue to the next file', async () => {
        // eslint by default ignores files under node_modules... so if a user explicitly targets this file in their
        // workspace, then we should forward this warning.
        const fileThatIsIgnored: string = path.join(workspaceThatHasCustomConfigWithNewRules,
            'node_modules', 'eslint-plugin-dummy', 'index.js');
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([fileThatIsIgnored])};
        const results: EngineRunResults = await engine.runRules(['no-unused-vars'], runOptions);

        const warnEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Warn);
        expect(warnEvents).toHaveLength(1);
        expect(warnEvents[0].logLevel).toEqual(LogLevel.Warn);
        expect(warnEvents[0].message).toEqual(
            getMessage('ESLintWarnedWhenScanningFile', fileThatIsIgnored,
                'File ignored because of a matching ignore pattern. Use "--no-ignore" to override.'));

        expect(results.violations).toHaveLength(0);
    });

    it('When describeRules is called, then it emits correct progress events', async () => {
        await engine.describeRules({});
        expect(describeRulesProgressEvents.map(e => e.percentComplete)).toEqual([0, 10, 40, 80, 100]);
    });

    it('When runRules is called, then it emits correct progress events', async () => {
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([workspaceWithNoCustomConfig])};
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