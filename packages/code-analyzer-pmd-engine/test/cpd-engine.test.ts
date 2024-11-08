import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {EngineRunResults, RuleDescription, Violation, Workspace} from "@salesforce/code-analyzer-engine-api";
import {CpdEngine} from "../src/cpd-engine";
import fs from "node:fs";
import path from "node:path";

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');

describe('Tests for the getName method of CpdEngine', () => {
    it('When getName is called, then cpd is returned', () => {
        const engine: CpdEngine = new CpdEngine();
        expect(engine.getName()).toEqual('cpd');
    });
});

describe('Tests for the describeRules method of PmdEngine', () => {
    it('When using defaults without workspace, then all rules are returned', async () => {
        // TODO: BEFORE GA, we need to eventually decide on what the default languages should be. For now we just return all.

        const engine: CpdEngine = new CpdEngine();
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});

        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_allLanguages.goldfile.json');
    });

    it('When using defaults with workspace that only contains apex code, then only apex rule is returned', async () => {
        const engine: CpdEngine = new CpdEngine();
        const workspace: Workspace = new Workspace([
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1.cls')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});

        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });
});

async function expectRulesToMatchGoldFile(actualRuleDescriptions: RuleDescription[], relativeExpectedFile: string): Promise<void> {
    const actualRuleDescriptionsJsonString: string = JSON.stringify(actualRuleDescriptions, undefined, 2);
    const expectedRuleDescriptionsJsonString: string = await fs.promises.readFile(
        path.join(TEST_DATA_FOLDER, 'cpdGoldfiles', relativeExpectedFile), 'utf-8');
    expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
}

describe('Tests for the runRules method of CpdEngine', () => {
    it('When zero rules names are provided then return zero violations', async () => {
        const engine: CpdEngine = new CpdEngine();
        expect(await engine.runRules([],{workspace: new Workspace([__dirname])})).toEqual({violations: []});
    });

    it('When rule name is not associated with a language that CPD knows about, then throw error', async () => {
        const engine: CpdEngine = new CpdEngine();
        await expect(engine.runRules(['DetectCopyPasteForOops'], {workspace: new Workspace([__dirname])})).rejects.toThrow(
            /Unexpected error: The rule 'DetectCopyPasteForOops' does not map to a supported CPD language:.*/);
    });

    it('When specified rules are not relevant to users workspace, then return zero violations', async () => {
        const engine: CpdEngine = new CpdEngine();
        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1.cls')]);
        const ruleNames: string[] = ['DetectCopyPasteForHtml'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});

        expect(results.violations).toHaveLength(0);
    });

    it('When specified rules contain relevant files containing no duplicate blocks using the default minimumToken value, then return zero violations', async () => {
        const engine: CpdEngine = new CpdEngine();
        const workspace: Workspace = new Workspace([
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript1.js'),
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript2.js') // duplicate blocks are smaller than default 100 tokens
        ]);
        const ruleNames: string[] = ['DetectCopyPasteForJavascript'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});

        expect(results.violations).toHaveLength(0);
    });

    it('When using defaults and workspace contains relevant files containing duplicate blocks, then return violations', async () => {
        const engine: CpdEngine = new CpdEngine();
        const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace')]);
        const ruleNames: string[] = ['DetectCopyPasteForApex', 'DetectCopyPasteForHtml', 'DetectCopyPasteForJavascript'];
        const results: EngineRunResults = await engine.runRules(ruleNames, {workspace: workspace});

        const expViolation1: Violation = {
            ruleName: "DetectCopyPasteForHtml",
            message: "Duplicate code detected for language 'html'. Found 2 code locations containing the same block of code consisting of 123 tokens across 43 lines.",
            primaryLocationIndex: 0,
            codeLocations: [
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'someReplicatedFile.html'),
                    startLine: 1,
                    startColumn: 1,
                    endLine: 43, // This should be 44 - this might be a bug with CPD: https://github.com/pmd/pmd/issues/5313
                    endColumn: 8
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'subFolder', 'someReplicatedFile.html'),
                    startLine: 1,
                    startColumn: 1,
                    endLine: 43, // This should be 44 - this might be a bug with CPD: https://github.com/pmd/pmd/issues/5313
                    endColumn: 8
                }
            ]
        };

        const expViolation2: Violation = {
            ruleName: "DetectCopyPasteForApex",
            message: "Duplicate code detected for language 'apex'. Found 2 code locations containing the same block of code consisting of 113 tokens across 27 lines.",
            primaryLocationIndex: 0,
            codeLocations: [
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1.cls'),
                    startLine: 2,
                    startColumn: 34,
                    endLine: 28,
                    endColumn: 6
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass2.cls'),
                    startLine: 2,
                    startColumn: 24,
                    endLine: 29,
                    endColumn: 4
                }
            ]
        };

        const expViolation3: Violation = {
            ruleName: "DetectCopyPasteForApex",
            message: "Duplicate code detected for language 'apex'. Found 3 code locations containing the same block of code consisting of 104 tokens across 24 lines.",
            primaryLocationIndex: 0,
            codeLocations: [
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1.cls'),
                    startLine: 5,
                    startColumn: 5,
                    endLine: 28,
                    endColumn: 6
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1.cls'),
                    startLine: 31,
                    startColumn: 9,
                    endLine: 54,
                    endColumn: 10
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass2.cls'),
                    startLine: 6,
                    startColumn: 3,
                    endLine: 29,
                    endColumn: 4
                }
            ]
        }

        expect(results.violations).toHaveLength(3);
        expect(results.violations).toContainEqual(expViolation1);
        expect(results.violations).toContainEqual(expViolation2);
        expect(results.violations).toContainEqual(expViolation3);
    });
});