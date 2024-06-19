import {Engine, EnginePluginV1, RuleDescription} from "@salesforce/code-analyzer-engine-api";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {ESLintEngine, ESLintEnginePlugin} from "../src/engine";
import {getMessage} from "../src/messages";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the ESLintEnginePlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new ESLintEnginePlugin();
    });

    it('When the getAvailableEngineNames method is called then only eslint is returned', () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['eslint']);
    });

    it('When createEngine is passed eslint then an ESLintEngine instance is returned', () => {
        expect(plugin.createEngine('eslint', {})).toBeInstanceOf(ESLintEngine);
    });

    it('When createEngine is passed anything else then an error is thrown', () => {
        expect(() => plugin.createEngine('oops', {})).toThrow(
            getMessage('CantCreateEngineWithUnknownEngineName' ,'oops'));
    });
});

describe('Tests for the ESLintEngine', () => {
    let engine: Engine;
    beforeEach(() => {
        engine = new ESLintEngine();
    });

    it('When getName is called, then retire-js is returned', () => {
        expect(engine.getName()).toEqual('eslint');
    });

    it('When validate is called, then nothing happens since it currently is a no-op', async () => {
        await engine.validate(); // Sanity check that nothing blows up since the core module will call this.
    });

    async function testDescribeRules(testCase: string): Promise<void> {
        const origWorkingDir: string = process.cwd();
        process.chdir(path.resolve(__dirname, 'test-data', 'cases', testCase));
        try {
            const ruleDescriptions: RuleDescription[] = await engine.describeRules();
            const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
            const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
                path.resolve(__dirname, 'test-data', 'cases', `${testCase}_ExpectedRuleDescriptions.json`), 'utf8')
                .replaceAll('\r',''); // Fix for windows
            expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
        } finally {
            process.chdir(origWorkingDir);
        }
    }

    it('When describing rules in the normal case with no customizations, then the expected rule descriptions are returned', async () => {
        await testDescribeRules('1_NoCustomization');
    });

    it('When describing rules when users config file modifies existing rules, then the expected rule descriptions are returned', async () => {
        await testDescribeRules('2_CustomizationOfExistingRules');
    });

    it('When describing rules when users config file adds a new plugin and rules, then the expected rule descriptions are returned', async () => {
        await testDescribeRules('3_CustomizationWithNewRules');
    });
});