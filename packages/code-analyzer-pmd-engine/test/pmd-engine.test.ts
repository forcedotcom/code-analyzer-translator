import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    ConfigObject,
    ConfigValueExtractor,
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    RunRulesProgressEvent,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {PmdEngine} from "../src/pmd-engine";
import fs from "node:fs";
import path from "node:path";
import {PMD_VERSION, LanguageId} from "../src/constants";
import {DEFAULT_PMD_ENGINE_CONFIG, PMD_AVAILABLE_LANGUAGES, PmdEngineConfig} from "../src/config";
import {PmdCpdEnginesPlugin} from "../src";

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');

describe('Tests for the getName method of PmdEngine', () => {
    it('When getName is called, then pmd is returned', () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        expect(engine.getName()).toEqual('pmd');
    });
});


describe('Tests for the describeRules method of PmdEngine', () => {
    it('When using defaults without workspace, then all language rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
        const progressEvents: DescribeRulesProgressEvent[] = [];
        engine.onEvent(EventType.DescribeRulesProgressEvent, (e: DescribeRulesProgressEvent) => progressEvents.push(e));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_allLanguages.goldfile.json');

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
            path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.cls')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When using defaults with workspace containing only apex and visualforce code, then only apex and visualforce rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([
            path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.trigger'),
            path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.page')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexAndVisualforce.goldfile.json');
    });

    it('When using defaults with workspace containing only apex and text files, then only apex rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([
            path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.trigger'),
            path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.txt')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When using defaults with workspace containing only visualforce code, then only visualforce rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([
            path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.page')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_visualforceOnly.goldfile.json');
    });

    it('When using defaults with workspace containing no supported files, then no rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([
            path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.txt')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When specifying all available rule languages without a workspace, then all rules available are described', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: PMD_AVAILABLE_LANGUAGES
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_allLanguages.goldfile.json');

        // SANITY CHECK THAT NO RULES IN PMD HAVE A '-' CHARACTER IN ITS NAME SINCE IT IS WHAT WE USE TO MAKE UNIQUE NAMES
        expectNoDashesAppearOutsideOfOurLanguageSpecificRules(ruleDescriptions);

        // SANITY CHECK THAT OUR SHARED_RULE_NAMES IS UP-TO-DATE BY CHECKING FOR DUPLICATE RULE NAMES
        // If the following errors, then most likely we will need to update the SHARED_RULE_NAMES object.
        expectNoDuplicateRuleNames(ruleDescriptions);
    });

    it('When specifying all zero rule languages, then no rules are described', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: []
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When specifying multiple rule languages, but only js files are in the workspace, then only javascript rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: ['javascript', 'xml' /* not in workspace */]
        });
        const workspace: Workspace = new Workspace([
            path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.js')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_javascriptOnly.goldfile.json');
    });

    it('When adding a custom rulesets from disk, then the custom rules are added to the rule descriptions', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: ['apex', 'javascript'],
            custom_rulesets: [
                path.join(TEST_DATA_FOLDER, 'custom rules', 'somecat3.xml'),
                path.join(TEST_DATA_FOLDER, 'custom rules', 'subfolder', 'somecat4.xml')
            ]
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});

        const fakeRule7Description: RuleDescription = expectContainsRuleWithName(ruleDescriptions, 'fakerule7'); // From somecat3.xml
        expect(fakeRule7Description.severityLevel).toEqual(SeverityLevel.Low);
        expect(fakeRule7Description.tags).toEqual(['Recommended', 'SomeCat3', 'Apex', 'Custom']);
        expect(fakeRule7Description.resourceUrls).toEqual(['https://docs.pmd-code.org/pmd-doc-7.0.0/pmd_rules_apex_performance.html#avoiddebugstatements']);
        expect(fakeRule7Description.description).toContain('Debug statements contribute');
        expectContainsRuleWithName(ruleDescriptions, 'fakerule8'); // From somecat3.xml
        expectContainsRuleWithName(ruleDescriptions, 'fakerule9'); // From somecat3.xml
        const fakeRule10Description: RuleDescription = expectContainsRuleWithName(ruleDescriptions, 'fakerule10'); // From somecat4.xml
        expect(fakeRule10Description.severityLevel).toEqual(SeverityLevel.High);
        expect(fakeRule10Description.tags).toEqual(['Recommended', 'SomeCat4', 'Javascript', 'Custom']);
        expect(fakeRule10Description.resourceUrls).toHaveLength(0); // This particular rule purposely has no externalInfoUrl defined, so we confirm that it gives no resourceUrls.
        expectContainsRuleWithName(ruleDescriptions, 'fakerule11'); // From somecat4.xml
        expectContainsRuleWithName(ruleDescriptions, 'fakerule12'); // From somecat4.xml
        expectContainsRuleWithName(ruleDescriptions, 'fakerule13'); // From somecat4.xml
        expectContainsRuleWithName(ruleDescriptions, 'fakerule14'); // From somecat4.xml
    });

    it('When adding a jar files to the java classpath and adding custom rulesets, then the custom rules are added to the rule descriptions', async () => {
        const engine: PmdEngine = new PmdEngine({
            ...DEFAULT_PMD_ENGINE_CONFIG,
            java_classpath_entries: [
                path.join(TEST_DATA_FOLDER, 'custom rules', 'rulesets_apex_rules1.jar'),
                path.join(TEST_DATA_FOLDER, 'custom rules', 'category_joshapex_somecat2.jar')
            ],
            custom_rulesets: [
                'rulesets/apex/rules1.xml',
                'category/joshapex/somecat2.xml'
            ]
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});

        const fakeRule1Description: RuleDescription = expectContainsRuleWithName(ruleDescriptions, 'fakerule1'); // From rulesets_apex_rules1.jar
        expect(fakeRule1Description.severityLevel).toEqual(SeverityLevel.Moderate);
        expect(fakeRule1Description.tags).toEqual(['Recommended', 'Categories1', 'Apex', 'Custom']);
        expectContainsRuleWithName(ruleDescriptions, 'fakerule2'); // From rulesets_apex_rules1.jar
        expectContainsRuleWithName(ruleDescriptions, 'fakerule3'); // From rulesets_apex_rules1.jar
        const fakeRule4Description: RuleDescription = expectContainsRuleWithName(ruleDescriptions, 'fakerule4'); // From category_joshapex_somecat2.jar
        expect(fakeRule4Description.severityLevel).toEqual(SeverityLevel.Moderate);
        expect(fakeRule4Description.tags).toEqual(['Recommended', 'SomeCat2', 'Apex', 'Custom']);
        expectContainsRuleWithName(ruleDescriptions, 'fakerule5'); // From category_joshapex_somecat2.jar
        expectContainsRuleWithName(ruleDescriptions, 'fakerule6'); // From category_joshapex_somecat2.jar
    });

    it('When adding a jar file to the java classpath and but not adding a custom ruleset from it, then the custom rules are not added', async () => {
        const engine: PmdEngine = new PmdEngine({
            ...DEFAULT_PMD_ENGINE_CONFIG,
            java_classpath_entries: [
                path.join(TEST_DATA_FOLDER, 'custom rules', 'rulesets_apex_rules1.jar'), // Adding this ....
                path.join(TEST_DATA_FOLDER, 'custom rules', 'category_joshapex_somecat2.jar')
            ],
            custom_rulesets: [
                // ... but not adding in its ruleset: 'rulesets/apex/rules1.xml',
                'category/joshapex/somecat2.xml'
            ]
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});

        expectDoesNotContainRuleWithName(ruleDescriptions, 'fakerule1'); // From rulesets_apex_rules1.jar
        expectDoesNotContainRuleWithName(ruleDescriptions, 'fakerule2'); // From rulesets_apex_rules1.jar
        expectDoesNotContainRuleWithName(ruleDescriptions, 'fakerule3'); // From rulesets_apex_rules1.jar
        expectContainsRuleWithName(ruleDescriptions, 'fakerule4'); // From category_joshapex_somecat2.jar
        expectContainsRuleWithName(ruleDescriptions, 'fakerule5'); // From category_joshapex_somecat2.jar
        expectContainsRuleWithName(ruleDescriptions, 'fakerule6'); // From category_joshapex_somecat2.jar
    });

    it('When adding a folder to the java classpath, then all the rulesets in it and within all the jars are discoverable', async () => {
        // Doing end-to-end testing here as a sanity check that custom_rulesets work from raw relative paths on disk and from jar files
        const plugin: PmdCpdEnginesPlugin = new PmdCpdEnginesPlugin();
        const rawConfig: ConfigObject = {
            rule_languages: ['apex', 'javascript'],
            java_classpath_entries: [
                path.join(TEST_DATA_FOLDER, 'custom rules') // Contains 2 jar files and 2 ruleset xml files
            ],
            custom_rulesets: [
                'somecat3.xml', // On disk (will actually get converted to absolute during createEngineConfig)
                'subfolder/somecat4.xml', // On disk (will actually get converted to absolute during createEngineConfig)
                'rulesets/apex/rules1.xml', // From rulesets_apex_rules1.jar
                'category/joshapex/somecat2.xml' // From category_joshapex_somecat2.jar
            ]
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig('pmd', configValueExtractor);
        const engine: PmdEngine = new PmdEngine(resolvedConfig as PmdEngineConfig);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});

        const expectedRuleNames: string[] = [
            'fakerule1', 'fakerule2', 'fakerule3', // From rulesets_apex_rules1.jar
            'fakerule4', 'fakerule5', 'fakerule6', // From category_joshapex_somecat2.jar
            'fakerule7', 'fakerule8', 'fakerule9', // From subfolder/somecat4.xml
            'fakerule10','fakerule11', 'fakerule12', 'fakerule13', 'fakerule14' // From subfolder/somecat4.xml
        ]
        for (const expectedRuleName of expectedRuleNames) {
            expectContainsRuleWithName(ruleDescriptions, expectedRuleName);
        }
    });

    it('When specifying a custom_ruleset that cannot be found, then error with a good error message', async () => {
        const engine: PmdEngine = new PmdEngine({
            ...DEFAULT_PMD_ENGINE_CONFIG,
            custom_rulesets: [
                'does/not/exist.xml'
            ]
        });
        await expect(engine.describeRules({})).rejects.toThrow('PMD errored when attempting to load a custom ruleset "does/not/exist.xml". ' +
            'Make sure the resource is a valid file on disk or on the Java classpath.');
    });
});

async function expectRulesToMatchGoldFile(actualRuleDescriptions: RuleDescription[], relativeExpectedFile: string): Promise<void> {
    const actualRuleDescriptionsJsonString: string = JSON.stringify(actualRuleDescriptions, undefined, 2);
    let expectedRuleDescriptionsJsonString: string = await fs.promises.readFile(
        path.join(TEST_DATA_FOLDER, 'pmdGoldfiles', relativeExpectedFile), 'utf-8');
    expectedRuleDescriptionsJsonString = expectedRuleDescriptionsJsonString.replaceAll('{{PMD_VERSION}}', PMD_VERSION);
    expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
}

function expectContainsRuleWithName(ruleDescriptions: RuleDescription[], ruleName: string): RuleDescription {
    const ruleList: RuleDescription[] = ruleDescriptions.filter(rd => rd.name === ruleName);
    if (ruleList.length != 1) {
        throw new Error(`Expected to find 1 rule with name '${ruleName}' but found ${ruleList.length}.`);
    }
    return ruleList[0];
}

function expectDoesNotContainRuleWithName(ruleDescriptions: RuleDescription[], ruleName: string): void {
    const ruleList: RuleDescription[] = ruleDescriptions.filter(rd => rd.name === ruleName);
    if (ruleList.length != 0) {
        throw new Error(`Expected to find 0 rules with name '${ruleName}' but found ${ruleList.length}.`);
    }
}

describe('Tests for the runRules method of PmdEngine', () => {
    const expectedOperationWithLimitsInLoopViolation: Violation = {
        ruleName: "OperationWithLimitsInLoop",
        message: 'Avoid operations in loops that may hit governor limits',
        codeLocations: [
            {
                file: path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'OperationWithLimitsInLoop.cls'),
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
                file: path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'VfUnescapeEl.page'),
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
                file: path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'VfUnescapeEl.page'),
                startLine: 5,
                startColumn: 19,
                endLine: 5,
                endColumn: 38
            }
        ],
        primaryLocationIndex: 0
    };

    const expectedConsistentReturnViolation: Violation = {
        ruleName: "ConsistentReturn",
        message: 'A function should not mix return statements with and without a result.',
        codeLocations: [
            {
                file: path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'ConsistentReturn.js'),
                startLine: 1,
                startColumn: 1,
                endLine: 6,
                endColumn: 2
            }
        ],
        primaryLocationIndex: 0
    }

    const expectedWhileLoopsMustUseBracesViolation: Violation = {
        ruleName: "WhileLoopsMustUseBraces-javascript",
        message: 'Avoid using while statements without curly braces',
        codeLocations: [
            {
                file: path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'WhileLoopsMustUseBraces.js'),
                startLine: 2,
                startColumn: 1,
                endLine: 3,
                endColumn: 9
            }
        ],
        primaryLocationIndex: 0
    }

    const expectedFakeRule1Violation: Violation = {
        ruleName: "fakerule1",
        message: 'Avoid debug statements since they impact on performance',
        codeLocations: [
            {
                file: path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'AvoidDebugStatements.cls'),
                startLine: 4,
                startColumn: 9,
                endLine: 4,
                endColumn: 27
            }
        ],
        primaryLocationIndex: 0
    }

    const expectedFakeRule7Violation: Violation = {
        ruleName: "fakerule7",
        message: 'Avoid debug statements since they impact on performance',
        codeLocations: [
            {
                file: path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'AvoidDebugStatements.cls'),
                startLine: 4,
                startColumn: 9,
                endLine: 4,
                endColumn: 27
            }
        ],
        primaryLocationIndex: 0
    }


    it('When zero rule names are provided then return zero violations', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace')]);
        const results: EngineRunResults = await engine.runRules([], {workspace: workspace});
        expect(results.violations).toHaveLength(0);
    });

    it('When workspace contains zero relevant files, then return zero violations', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const progressEvents: RunRulesProgressEvent[] = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));

        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.txt')]);
        const ruleNames: string[] = ['OperationWithLimitsInLoop', 'VfUnescapeEl'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});

        expect(results.violations).toHaveLength(0);

        // Also check that we have all the correct progress events
        expect(progressEvents.map(e => e.percentComplete)).toEqual([2, 100]);
    });

    it('When specified rules are not relevant to users workspace, then return zero violations', async () => {
        const engine: PmdEngine = new PmdEngine({
            ...DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: ['xml']
        });
        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'dummy.xml')]);
        const ruleNames: string[] = ['OperationWithLimitsInLoop', 'VfUnescapeEl'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});

        expect(results.violations).toHaveLength(0);
    });

    it('When workspace contains relevant files containing violation, then return violations', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        const progressEvents: RunRulesProgressEvent[] = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));

        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace')]);
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
            [2, 2.3, 4.4, 4.7, 5, 6.86, 10.58, 14.3, 26.7, 39.1, 51.5, 63.9, 76.3, 88.7, 93.35, 98, 100]);
    });

    it('When a single rule is selected, then return only violations for that rule', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace')]);
        const ruleNames: string[] = ['OperationWithLimitsInLoop'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});
        expect(results.violations).toHaveLength(1);
        expect(results.violations).toContainEqual(expectedOperationWithLimitsInLoopViolation);
    });

    it('When selected rules are not violated, then return zero violations', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace')]);
        const ruleNames: string[] = ['WhileLoopsMustUseBraces', 'ExcessiveParameterList', 'VfCsrf'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});
        expect(results.violations).toHaveLength(0);
    });

    it('When specifying a non-default language and workspace contains violations for that language, then return correct violations', async () => {
        const engine: PmdEngine = new PmdEngine({
            ... DEFAULT_PMD_ENGINE_CONFIG,
            rule_languages: ['javascript', 'xml' /* sanity check: not relevant to workspace */, 'apex']
        });
        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace')]);
        const ruleNames: string[] = ['ConsistentReturn', 'WhileLoopsMustUseBraces-javascript', 'MissingEncoding' /* sanity check: not relevant to workspace */, 'OperationWithLimitsInLoop'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});
        expect(results.violations).toHaveLength(3);
        expect(results.violations).toContainEqual(expectedOperationWithLimitsInLoopViolation);
        expect(results.violations).toContainEqual(expectedConsistentReturnViolation);
        expect(results.violations).toContainEqual(expectedWhileLoopsMustUseBracesViolation);
    });

    it('When custom rule is provided that produces violation, then correct violations are returned', async () => {
        const engine: PmdEngine = new PmdEngine({
            ...DEFAULT_PMD_ENGINE_CONFIG,
            java_classpath_entries: [
                path.join(TEST_DATA_FOLDER, 'custom rules', 'rulesets_apex_rules1.jar')
            ],
            custom_rulesets: [
                'rulesets/apex/rules1.xml',
                path.join(TEST_DATA_FOLDER, 'custom rules', 'somecat3.xml')
            ]
        });
        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace')]);
        const ruleNames: string[] = ['fakerule1', 'fakerule2', 'fakerule7', 'fakerule8'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});
        expect(results.violations).toHaveLength(2); // Expecting fakerule1 and fakerule7 (which both have a definition equivalent to the AvoidDebugStatements rule)
        expect(results.violations).toContainEqual(expectedFakeRule1Violation);
        expect(results.violations).toContainEqual(expectedFakeRule7Violation);
    });
});

describe('Tests for the getEngineVersion method of PmdEngine', () => {
    it('Outputs something resembling a Semantic Version', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const version: string = await engine.getEngineVersion();

        expect(version).toMatch(/\d+\.\d+\.\d+.*/);
    });
});


function expectNoDashesAppearOutsideOfOurLanguageSpecificRules(ruleDescriptions: RuleDescription[]): void {
    for (const ruleDescription of ruleDescriptions) {
        const dashIdx: number = ruleDescription.name.indexOf('-');
        if (dashIdx >= 0) {
            const possibleLang: string = ruleDescription.name.substring(dashIdx+1) as LanguageId;
            if (!(Object.values(LanguageId) as string[]).includes(possibleLang)) {
                throw new Error(`${ruleDescription.name} contains a '-' which is a reserved character for our PMD rules`)
            }
        }
    }
}

function expectNoDuplicateRuleNames(ruleDescriptions: RuleDescription[]): void {
    const seen: Set<string> = new Set();
    for (const ruleDescription of ruleDescriptions) {
        if (seen.has(ruleDescription.name)) {
            throw new Error(`The rule name ${ruleDescription.name} appears more than once among the rule descriptions.`);
        }
        seen.add(ruleDescription.name);
    }
}