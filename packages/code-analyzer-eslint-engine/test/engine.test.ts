import {Engine, RuleDescription} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {ESLintEngine} from "../src/engine";
import {DEFAULT_CONFIG} from "../src/config";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the ESLintEngine with default config values', () => {
    let engine: Engine;
    beforeEach(() => {
        engine = new ESLintEngine(DEFAULT_CONFIG);
    });

    it('When getName is called, then eslint is returned', () => {
        expect(engine.getName()).toEqual('eslint');
    });

    const cases: {description: string, parentFolder: string, folder: string}[] = [
        {
            description: 'with no customizations',
            parentFolder: 'legacyConfigCases',
            folder: '1_NoCustomization'
        },
        {
            description: 'with config that modifies existing rules',
            parentFolder: 'legacyConfigCases',
            folder: '2_CustomizationOfExistingRules'
        },
        {
            description: 'with config that adds a new plugin and rules',
            parentFolder: 'legacyConfigCases',
            folder: '3_CustomizationWithNewRules'
        },
    ]

    it.each(cases)('When describing rules while cwd is folder $description, then return expected', async (caseObj) => {
        const caseFolder: string = path.resolve(__dirname, 'test-data', caseObj.parentFolder, caseObj.folder);

        const origWorkingDir: string = process.cwd();
        process.chdir(caseFolder);
        try {
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
            const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
            const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
                path.join(caseFolder, 'expectedRuleDescriptions.json'), 'utf8')
                .replaceAll('\r',''); // Remove carriage return characters from files in windows
            expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it.each(cases)('When describing rules while from a workspace $description, then return expected', async (caseObj) => {
        const caseFolder: string = path.resolve(__dirname, 'test-data', caseObj.parentFolder, caseObj.folder);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([caseFolder])});
        const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
        const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
            path.join(caseFolder, 'expectedRuleDescriptions.json'), 'utf8')
            .replaceAll('\r',''); // Remove carriage return characters from files in windows
        expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
    });

    it('When describing rules from a workspace with no javascript files, then no javascript rules should return', async () => {
        const caseFolder: string = path.resolve(__dirname, 'test-data', 'legacyConfigCases', '1_NoCustomization');
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
                path.join(caseFolder, 'dummy3.txt'), path.join(caseFolder, 'dummy2.ts')])});

        const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);

        // Note that it important to note that typescript uses the base eslint rules and additional typescript rules. So
        // the base eslint rules should not be removed.
        const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
            path.join(caseFolder, 'expectedRuleDescriptionsWithNoJavascript.json'), 'utf8')
            .replaceAll('\r',''); // Remove carriage return characters from files in windows
        expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
    });

    it('When describing rules from a workspace with no typescript files, then no typescript rules should returned', async () => {
        const caseFolder: string = path.resolve(__dirname, 'test-data', 'legacyConfigCases', '1_NoCustomization');
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
            path.join(caseFolder, 'dummy1.js'), path.join(caseFolder, 'dummy3.txt')])});

        const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
        const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
            path.join(caseFolder, 'expectedRuleDescriptionsWithNoTypescript.json'), 'utf8')
            .replaceAll('\r',''); // Remove carriage return characters from files in windows
        expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
    });

    it('When describing rules from a workspace with no javascript or typescript files, then no rules should return', async () => {
        const caseFolder: string = path.resolve(__dirname, 'test-data', 'legacyConfigCases', '1_NoCustomization');
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
                path.join(caseFolder, 'dummy3.txt')])});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When describing rules from an empty workspace, then no rules should return', async () => {
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([])});
        expect(ruleDescriptions).toHaveLength(0);
    });
});