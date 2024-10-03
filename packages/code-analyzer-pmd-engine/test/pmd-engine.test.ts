import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    RunRulesProgressEvent,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {PmdEngine} from "../src/pmd-engine";
import fs from "node:fs";
import path from "node:path";
import {PMD_VERSION, PmdLanguage} from "../src/constants";
import {DEFAULT_PMD_ENGINE_CONFIG} from "../src/config";

changeWorkingDirectoryToPackageRoot();

const testDataFolder: string = path.join(__dirname, 'test-data');

describe('Tests for the getName method of PmdEngine', () => {
    it('When getName is called, then pmd is returned', () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        expect(engine.getName()).toEqual('pmd');
    });
});


describe('Tests for the describeRules method of PmdEngine', () => {
    it('When using defaults without workspace, then apex and visualforce rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
        const progressEvents: DescribeRulesProgressEvent[] = [];
        engine.onEvent(EventType.DescribeRulesProgressEvent, (e: DescribeRulesProgressEvent) => progressEvents.push(e));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexAndVisualforce.goldfile.json');

        // Also check that we have fine logs with the argument list and the duration in milliseconds
        const fineLogEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Fine);
        expect(fineLogEvents.length).toBeGreaterThanOrEqual(3);
        expect(fineLogEvents[0].message).toContain('Calling JAVA command with');
        expect(fineLogEvents[1].message).toContain('ARGUMENTS');
        expect(fineLogEvents[2].message).toContain('milliseconds');

        // Also check that we have all the correct progress events
        expect(progressEvents.map(e => e.percentComplete)).toEqual([5, 14, 77, 86, 95, 100]);

        // Also sanity check that calling describeRules a second time gives same results (from cache):
        expect(await engine.describeRules({})).toEqual(ruleDescriptions);
    });

    it('When using defaults with workspace containing only apex code, then only apex rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.cls')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When using defaults with workspace containing only apex and xml code, then only apex rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.trigger'),
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.xml')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When using defaults with workspace containing only visualforce code, then only visualforce rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.page')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_visualforceOnly.goldfile.json');
    });

    it('When using defaults with workspace containing no supported files, then no rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.txt')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When specifying all available rule languages without a workspace, then all rules available are described', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: Object.values(PmdLanguage)
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_allLanguages.goldfile.json');
    });

    it('When specifying all zero rule languages, then no rules are described', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: []
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When specifying multiple rule languages, but only js files are in the workspace, then only ecmascript rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: ['ecmascript', 'xml' /* not in workspace */]
        });
        const workspace: Workspace = new Workspace([
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.js')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_ecmascriptOnly.goldfile.json');
    });
});

async function expectRulesToMatchGoldFile(actualRuleDescriptions: RuleDescription[], relativeExpectedFile: string) {
    const actualRuleDescriptionsJsonString: string = JSON.stringify(actualRuleDescriptions, undefined, 2);
    let expectedRuleDescriptionsJsonString: string = await fs.promises.readFile(
        path.join(testDataFolder, relativeExpectedFile), 'utf-8');
    expectedRuleDescriptionsJsonString = expectedRuleDescriptionsJsonString.replaceAll('{{PMD_VERSION}}', PMD_VERSION);
    expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
}

describe('Tests for the runRules method of PmdEngine', () => {
    const expectedOperationWithLimitsInLoopViolation: Violation = {
        ruleName: "OperationWithLimitsInLoop",
        message: 'Avoid operations in loops that may hit governor limits',
        codeLocations: [
            {
                file: path.join(testDataFolder, 'sampleWorkspace', 'sampleViolations', 'OperationWithLimitsInLoop.cls'),
                startLine: 4,
                startColumn: 38,
                endLine: 4,
                endColumn: 62
            }
        ],
        primaryLocationIndex: 0
    };

    const expectedVfUnescapeElViolation1: Violation = {
        ruleName: "VfUnescapeEl",
        message: 'Avoid unescaped user controlled content in EL',
        codeLocations: [
            {
                file: path.join(testDataFolder, 'sampleWorkspace', 'sampleViolations', 'VfUnescapeEl.page'),
                startLine: 3,
                startColumn: 19,
                endLine: 3,
                endColumn: 26
            }
        ],
        primaryLocationIndex: 0
    };

    const expectedVfUnescapeElViolation2: Violation = {
        ruleName: "VfUnescapeEl",
        message: 'Avoid unescaped user controlled content in EL',
        codeLocations: [
            {
                file: path.join(testDataFolder, 'sampleWorkspace', 'sampleViolations', 'VfUnescapeEl.page'),
                startLine: 5,
                startColumn: 19,
                endLine: 5,
                endColumn: 38
            }
        ],
        primaryLocationIndex: 0
    };

    const expectConsistentReturnViolation: Violation = {
        ruleName: "ConsistentReturn",
        message: 'A function should not mix return statements with and without a result.',
        codeLocations: [
            {
                file: path.join(testDataFolder, 'sampleWorkspace', 'sampleViolations', 'ConsistentReturn.js'),
                startLine: 1,
                startColumn: 1,
                endLine: 6,
                endColumn: 2
            }
        ],
        primaryLocationIndex: 0
    }

    it('When zero rule names are provided then return zero violations', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([path.join(testDataFolder, 'sampleWorkspace')]);
        const results: EngineRunResults = await engine.runRules([], {workspace: workspace});
        expect(results.violations).toHaveLength(0);
    });

    it('When workspace contains zero relevant files, then return zero violations', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const progressEvents: RunRulesProgressEvent[] = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));

        const workspace: Workspace = new Workspace([path.join(testDataFolder, 'sampleWorkspace', 'dummy.xml')]);
        const ruleNames: string[] = ['OperationWithLimitsInLoop', 'VfUnescapeEl'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});

        expect(results.violations).toHaveLength(0);

        // Also check that we have all the correct progress events
        expect(progressEvents.map(e => e.percentComplete)).toEqual([2, 100]);
    });

    it('When workspace contains relevant files containing violation, then return violations', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        const progressEvents: RunRulesProgressEvent[] = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));

        const workspace: Workspace = new Workspace([path.join(testDataFolder, 'sampleWorkspace')]);
        const ruleNames: string[] = ['OperationWithLimitsInLoop', 'VfUnescapeEl'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});

        expect(results.violations).toHaveLength(3);
        expect(results.violations).toContainEqual(expectedOperationWithLimitsInLoopViolation);
        expect(results.violations).toContainEqual(expectedVfUnescapeElViolation1);
        expect(results.violations).toContainEqual(expectedVfUnescapeElViolation2);

        // Also check that we throw error event when PMD can't parse a file
        const errorLogEvents: LogEvent[] = logEvents.filter(event => event.logLevel === LogLevel.Error);
        expect(errorLogEvents.length).toBeGreaterThan(0);
        expect(errorLogEvents[0].message).toMatch(/PMD issued a processing error for file.*dummy/);

        // Also check that we have all the correct progress events
        expect(progressEvents.map(e => e.percentComplete)).toEqual(
            [2, 4, 4.6, 8.8, 9.4, 10, 11.76, 15.28, 18.8, 32.88, 46.96, 61.04, 75.12, 89.2, 93.6, 98, 100]);
    });

    it('When a single rule is selected, then return only violations for that rule', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([path.join(testDataFolder, 'sampleWorkspace')]);
        const ruleNames: string[] = ['OperationWithLimitsInLoop'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});
        expect(results.violations).toHaveLength(1);
        expect(results.violations).toContainEqual(expectedOperationWithLimitsInLoopViolation);
    });

    it('When selected rules are not violated, then return zero violations', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([path.join(testDataFolder, 'sampleWorkspace')]);
        const ruleNames: string[] = ['WhileLoopsMustUseBraces', 'ExcessiveParameterList', 'VfCsrf'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});
        expect(results.violations).toHaveLength(0);
    });

    it('When specifying a non-default language and workspace contains violation for that language, then return correct violations', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: ['ecmascript', 'xml' /* sanity check: not relevant to workspace */, 'apex']
        });
        const workspace: Workspace = new Workspace([path.join(testDataFolder, 'sampleWorkspace')]);
        const ruleNames: string[] = ['ConsistentReturn', 'MissingEncoding' /* sanity check: not relevant to workspace */, 'OperationWithLimitsInLoop'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});
        expect(results.violations).toHaveLength(2);
        expect(results.violations).toContainEqual(expectedOperationWithLimitsInLoopViolation);
        expect(results.violations).toContainEqual(expectConsistentReturnViolation);
    });
});