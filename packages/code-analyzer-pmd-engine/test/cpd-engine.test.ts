import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {RuleDescription, Workspace} from "@salesforce/code-analyzer-engine-api";
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
            path.join(TEST_DATA_FOLDER, 'sampleWorkspace', 'dummy.cls')
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
    it('TEMPORARY TEST FOR CODE COVERAGE', async () => {
        // Will delete this test as soon as we implement the CpdEngine.
        const engine: CpdEngine = new CpdEngine();
        expect(await engine.runRules([],{workspace: new Workspace([__dirname])})).toEqual({violations: []});
    });
});