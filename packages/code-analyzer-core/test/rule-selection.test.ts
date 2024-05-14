import {
    CodeAnalyzer,
    CodeAnalyzerConfig,
    EventType,
    LogEvent,
    Rule,
    RuleSelection,
    RuleType,
    SeverityLevel
} from "../src";
import { SeverityLevel as EngApi_SeverityLevel } from "@salesforce/code-analyzer-engine-api"
import {StubEnginePlugin} from "./stubs";

describe('Tests for selecting rules', () => {
    let codeAnalyzer: CodeAnalyzer;
    let logEvents: LogEvent[];

    beforeEach(() => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        codeAnalyzer.addEnginePlugin(new StubEnginePlugin());
        logEvents = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
    })

    it('When no rule selectors are provided then default tag is used', () => {
        const selection: RuleSelection = codeAnalyzer.selectRules();
        expect(selection).toEqual(codeAnalyzer.selectRules('default'));

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(selection.getCount()).toEqual(5);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleC']);

        // Sanity check one of the rules in detail:
        const selectRulesForStub1: Rule[] = selection.getRulesFor('stubEngine1');
        const stub1RuleB = selectRulesForStub1[1];
        expect(stub1RuleB.getEngineName()).toEqual('stubEngine1');
        expect(stub1RuleB.getDescription()).toEqual('Some description for stub1RuleB');
        expect(stub1RuleB.getName()).toEqual('stub1RuleB');
        expect(stub1RuleB.getResourceUrls()).toEqual(['https://example.com/stub1RuleB']);
        expect(stub1RuleB.getSeverityLevel()).toEqual(SeverityLevel.High);
        expect(stub1RuleB.getTags()).toEqual(['default', 'Security']);
        expect(stub1RuleB.getType()).toEqual(RuleType.Standard);
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

        const selection2: RuleSelection = codeAnalyzer.selectRules('stubEngine2:default')
        expect(ruleNamesFor(selection2,'stubEngine1')).toEqual([])
        expect(ruleNamesFor(selection2,'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleC'])

        const selection3: RuleSelection = codeAnalyzer.selectRules('all:stub1RuleC')
        expect(ruleNamesFor(selection3,'stubEngine1')).toEqual(['stub1RuleC'])
        expect(ruleNamesFor(selection3,'stubEngine2')).toEqual([])

        const selection4: RuleSelection = codeAnalyzer.selectRules('default:2')
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
        const selection: RuleSelection = codeAnalyzer.selectRules('default:Performance', 'stubEngine2:2', 'stubEngine2:DoesNotExist');

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleC']);
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