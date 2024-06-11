import {
    CodeAnalyzer,
    CodeAnalyzerConfig,
    Rule,
    RuleSelection,
    RuleType,
    SeverityLevel
} from "../src";
import { SeverityLevel as EngApi_SeverityLevel } from "@salesforce/code-analyzer-engine-api"
import {RepeatedRuleNameEnginePlugin, StubEnginePlugin} from "./stubs";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {getMessage} from "../src/messages";

describe('Tests for selecting rules', () => {
    changeWorkingDirectoryToPackageRoot();

    let codeAnalyzer: CodeAnalyzer;

    async function setupCodeAnalyzer(codeAnalyzer: CodeAnalyzer) : Promise<void> {
        await codeAnalyzer.addEnginePlugin(new StubEnginePlugin());
    }

    beforeEach(async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        await setupCodeAnalyzer(codeAnalyzer);
    })

    it('When no rule selectors are provided then the Recommended tag is used', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules();
        expect(selection).toEqual(codeAnalyzer.selectRules('Recommended'));

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(selection.getCount()).toEqual(5);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleC']);

        // Sanity check one of the rules in detail:
        const selectedRulesForStubEngine1: Rule[] = selection.getRulesFor('stubEngine1');
        const stub1RuleB = selectedRulesForStubEngine1[1];
        expect(stub1RuleB.getEngineName()).toEqual('stubEngine1');
        expect(stub1RuleB.getDescription()).toEqual('Some description for stub1RuleB');
        expect(stub1RuleB.getName()).toEqual('stub1RuleB');
        expect(stub1RuleB.getResourceUrls()).toEqual(['https://example.com/stub1RuleB']);
        expect(stub1RuleB.getSeverityLevel()).toEqual(SeverityLevel.High);
        expect(stub1RuleB.getTags()).toEqual(['Recommended', 'Security']);
        expect(stub1RuleB.getType()).toEqual(RuleType.Standard);

        // Sanity check we can directly get one of the rules from the selection
        expect(selection.getRule('stubEngine1', 'stub1RuleB')).toEqual(stub1RuleB);
    });

    it('When all is provide then all is returned', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules('all');

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(selection.getCount()).toEqual(8);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD', 'stub1RuleE']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleB', 'stub2RuleC']);
    })

    it('When test selector is an individual rule name then only that rule is selected', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules('stub2RuleB')

        expect(selection.getEngineNames()).toEqual(['stubEngine2']);
        expect(selection.getCount()).toEqual(1);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual([]);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleB']);
    });

    it('When test selector is tag then all rules with that tag are selected', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules('CodeStyle')

        expect(selection.getEngineNames()).toEqual(['stubEngine1']);
        expect(selection.getCount()).toEqual(2);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual([]);
    });

    it('When test selector is an engine name then all rules from that engine are selected', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules('stubEngine1')

        expect(selection.getEngineNames()).toEqual(['stubEngine1']);
        expect(selection.getCount()).toEqual(5);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD', 'stub1RuleE']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual([]);
    });

    it('When test selector a severity level then all rules with that severity are selected', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules('3')

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleC', 'stub1RuleE']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA']);
    });

    it('When using a colon with a rule selector, then it acts like an intersection of two selectors', () => {
        const selection1: RuleSelection = codeAnalyzer.selectRules('stubEngine1:4')
        expect(ruleNamesFor(selection1,'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleD'])
        expect(ruleNamesFor(selection1,'stubEngine2')).toEqual([])

        const selection2: RuleSelection = codeAnalyzer.selectRules('stubEngine2:Recommended')
        expect(ruleNamesFor(selection2,'stubEngine1')).toEqual([])
        expect(ruleNamesFor(selection2,'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleC'])

        const selection3: RuleSelection = codeAnalyzer.selectRules('all:stub1RuleC')
        expect(ruleNamesFor(selection3,'stubEngine1')).toEqual(['stub1RuleC'])
        expect(ruleNamesFor(selection3,'stubEngine2')).toEqual([])

        const selection4: RuleSelection = codeAnalyzer.selectRules('Recommended:2')
        expect(ruleNamesFor(selection4,'stubEngine1')).toEqual(['stub1RuleB'])
        expect(ruleNamesFor(selection4,'stubEngine2')).toEqual(['stub2RuleC'])

        const selection5: RuleSelection = codeAnalyzer.selectRules('Custom:Performance')
        expect(ruleNamesFor(selection5,'stubEngine1')).toEqual(['stub1RuleC'])
        expect(ruleNamesFor(selection5,'stubEngine2')).toEqual(['stub2RuleB'])

        const selection6: RuleSelection = codeAnalyzer.selectRules('Custom:Performance:3')
        expect(ruleNamesFor(selection6,'stubEngine1')).toEqual(['stub1RuleC'])
        expect(ruleNamesFor(selection6,'stubEngine2')).toEqual([])

        const selection7: RuleSelection = codeAnalyzer.selectRules('Performance:2')
        expect(ruleNamesFor(selection7,'stubEngine1')).toEqual([])
        expect(ruleNamesFor(selection7,'stubEngine2')).toEqual([])
    });

    it('When multiple selectors are provided, then they act as a union', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules(
            'Security', // a tag
            'stubEngine2', // an engine name
            'stub1RuleD' // a rule name
        );

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleB', 'stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleB', 'stub2RuleC']);

        // Sanity check against duplicates
        expect(codeAnalyzer.selectRules('all', 'Performance', 'DoesNotExist')).toEqual(codeAnalyzer.selectRules('all'));
    });

    it('When colons are used and multiple selectors are provided then we get correct union and intersection behavior', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules('Recommended:Performance', 'stubEngine2:2', 'stubEngine2:DoesNotExist');

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleC']);
    });

    it('When selecting rules based on severity names instead of severity number, then we correctly return the rules', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules('High', 'Recommended:Low');

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA','stub1RuleB']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleC']);
    });

    it('When selector is the wrong case, then we still accept the selector since we treat selection with case insensitivity', () => {
        const selection1: RuleSelection = codeAnalyzer.selectRules('RecOmmended:higH', 'perFORMance');

        expect(selection1.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection1, 'stubEngine1')).toEqual(['stub1RuleB','stub1RuleC','stub1RuleE']);
        expect(ruleNamesFor(selection1, 'stubEngine2')).toEqual(['stub2RuleB','stub2RuleC']);

        expect(codeAnalyzer.selectRules('Stub1RulEd')).toEqual(codeAnalyzer.selectRules('stub1RuleD'));
        expect(codeAnalyzer.selectRules('aLL')).toEqual(codeAnalyzer.selectRules('all'));
    });

    it('When config contains rule overrides for the selected rules, then the rule selection contains these overrides', async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));
        await setupCodeAnalyzer(codeAnalyzer);

        const selection: RuleSelection = codeAnalyzer.selectRules();

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(selection.getCount()).toEqual(5);

        // sample-config-01.yaml makes stub1RuleD is now Recommended and stub2RuleA no longer Recommended
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleC']);

        // sample-config-01.yaml stub1RuleB have changed severity
        const selectedRulesForStubEngine1: Rule[] = selection.getRulesFor('stubEngine1');
        const stub1RuleB = selectedRulesForStubEngine1[1];
        expect(stub1RuleB.getEngineName()).toEqual('stubEngine1');
        expect(stub1RuleB.getName()).toEqual('stub1RuleB');
        expect(stub1RuleB.getResourceUrls()).toEqual(['https://example.com/stub1RuleB']);
        expect(stub1RuleB.getSeverityLevel()).toEqual(SeverityLevel.Critical); // This changed
        expect(stub1RuleB.getTags()).toEqual(['Recommended', 'Security']);
        expect(stub1RuleB.getType()).toEqual(RuleType.Standard);
    });

    it('When config contains rule overrides, then we can select based on the new tags', async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));
        await setupCodeAnalyzer(codeAnalyzer);

        const selection: RuleSelection = codeAnalyzer.selectRules('SomeNewTag');
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual([]);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA']);

        // sample-config-01.yaml stub2RuleA have changed tags
        const selectedRulesForStubEngine2: Rule[] = selection.getRulesFor('stubEngine2');
        const stub2RuleA = selectedRulesForStubEngine2[0];
        expect(stub2RuleA.getEngineName()).toEqual('stubEngine2');
        expect(stub2RuleA.getName()).toEqual('stub2RuleA');
        expect(stub2RuleA.getResourceUrls()).toEqual(['https://example.com/stub2RuleA']);
        expect(stub2RuleA.getSeverityLevel()).toEqual(SeverityLevel.Moderate);
        expect(stub2RuleA.getTags()).toEqual(['Security', 'SomeNewTag']); // This changed
        expect(stub2RuleA.getType()).toEqual(RuleType.DataFlow);
    });

    it('When config contains severity overrides, then we can select based on the severity values', async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));
        await setupCodeAnalyzer(codeAnalyzer);

        const selection: RuleSelection = codeAnalyzer.selectRules('5');
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual([]);
    });

    it('When attempting to get a rule that does not exist in the selection, then error', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules();

        expect(() => selection.getRule('stubEngine1', 'doesNotExist')).toThrow(
            getMessage('RuleDoesNotExistInSelection', 'doesNotExist', 'stubEngine1'));
        expect(() => selection.getRule('oopsEngine', 'stub1RuleD')).toThrow(
            getMessage('RuleDoesNotExistInSelection', 'stub1RuleD', 'oopsEngine'));
    });
});

describe('Misc tests', () => {
    it('When converting from a RuleDescription to a Rule, we need to make sure the SeverityLevel enums are the same', () => {
        // Current the SeverityLevel from the engine api is the same name as the SeverityLevel from core. But if this
        // ever changes, then this test will serve as a reminder to update our getSeverityLevel method of RuleImpl.
        expect(SeverityLevel).toEqual(EngApi_SeverityLevel)
    });
});


function ruleNamesFor(selection: RuleSelection, engineName: string): string[] {
    return selection.getRulesFor(engineName).map(r => r.getName());
}