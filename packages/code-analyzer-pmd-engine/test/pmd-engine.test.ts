import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {EventType, LogEvent, LogLevel, RuleDescription, Workspace} from "@salesforce/code-analyzer-engine-api";
import {PmdEngine} from "../src/pmd-engine";
import fs from "node:fs";
import path from "node:path";
import {PMD_VERSION} from "../src/constants";

changeWorkingDirectoryToPackageRoot();

const testDataFolder: string = path.join(__dirname, 'test-data');

describe('Tests for the getName method of PmdEngine', () => {
    it('When getName is called, then pmd is returned', () => {
        const engine: PmdEngine = new PmdEngine();
        expect(engine.getName()).toEqual('pmd');
    });
});

describe('Tests for the describeRules method of PmdEngine', () => {
    it('When using defaults without workspace, then apex and visualforce rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine();
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexAndVisualforce.goldfile.json');

        // Also sanity check that we have fine logs with the argument list and the duration in milliseconds
        const fineLogEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Fine);
        expect(fineLogEvents.length).toBeGreaterThanOrEqual(2);
        expect(fineLogEvents[0].message).toContain('ARGUMENTS');
        expect(fineLogEvents[1].message).toContain('milliseconds');

        // Also sanity check that calling describeRules a second time gives same results (from cache):
        expect(await engine.describeRules({})).toEqual(ruleDescriptions);
    });

    it('When using defaults with workspace containing only apex code, then only apex rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine();
        const workspace: Workspace = new Workspace([
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.cls')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When using defaults with workspace containing only apex and xml code, then only apex rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine();
        const workspace: Workspace = new Workspace([
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.trigger'),
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.xml')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When using defaults with workspace containing only visualforce code, then only visualforce rules are returned', async () => {
        const engine: PmdEngine = new PmdEngine();
        const workspace: Workspace = new Workspace([
            path.join(testDataFolder, 'sampleWorkspace', 'dummy.page')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_visualforceOnly.goldfile.json');
    });
});

async function expectRulesToMatchGoldFile(actualRuleDescriptions: RuleDescription[], relativeExpectedFile: string) {
    const actualRuleDescriptionsJsonString: string = JSON.stringify(actualRuleDescriptions, undefined, 2);
    let expectedRuleDescriptionsJsonString: string = await fs.promises.readFile(
        path.join(testDataFolder, relativeExpectedFile), 'utf-8');
    expectedRuleDescriptionsJsonString = expectedRuleDescriptionsJsonString.replaceAll('{{PMD_VERSION}}', PMD_VERSION);
    expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
}