import {RegexEnginePlugin, RegexEngine} from "../src/RegexEnginePlugin";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    RuleDescription,
    RuleType,
    SeverityLevel
} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools"

changeWorkingDirectoryToPackageRoot();

describe('Regex Engine Tests', () => {
    let engine: RegexEngine;
    beforeAll(() => {
        engine = new RegexEngine();
    });

    it('Engine name is accessible and correct', () => {
        const name: string = engine.getName();
        expect(name).toEqual("regex");
        
    });
    
    it('Calling describeRules on an engine should return the single trailing whitespace rule', async () => {
        const rules_desc: RuleDescription[]= await engine.describeRules({workspace: testTools.createWorkspace([])});
        const engineRules = [
            {
                name: "TrailingWhitespaceRule",
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: "",
                resourceUrls: [""]
            },
        ];
        expect(rules_desc).toEqual(engineRules)
    });

    it('Confirm runRules() is a no-op', () => {
        const ruleNames: string[] = ['TrailingWhitespaceRule']
        engine.runRules(ruleNames, {workspace: testTools.createWorkspace([])});
    })
});

describe('RegexEnginePlugin Tests' , () => {
    let pluginEngine: RegexEngine 
    let enginePlugin: RegexEnginePlugin;
    beforeAll(async () => {
        enginePlugin = new RegexEnginePlugin();
        pluginEngine = await enginePlugin.createEngine("regex", {}) as RegexEngine;
    });

    it('Check that I can get all available engine names', () => {
        const availableEngines: string[] = ['regex'] 
        expect(enginePlugin.getAvailableEngineNames()).toStrictEqual(availableEngines)
    })
   
    it('Check that engine created from the RegexEnginePlugin has expected name', () => {
        const engineName = "regex";
        expect(pluginEngine.getName()).toStrictEqual(engineName)
    });

    it('Check that engine created from the RegexEnginePlugin has expected output when describeRules is called', async () => {
        const expEngineRules = [
            {
                name: "TrailingWhitespaceRule",
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: "",
                resourceUrls: [""]
            },
        ];
        const engineRules: RuleDescription[] = await pluginEngine.describeRules({workspace: testTools.createWorkspace([])})
        expect(engineRules).toStrictEqual(expEngineRules)
    });

    it('Check that engine created from the RegexEnginePlugin has runRules() method as a no-op', () => {
        const ruleNames: string[] = ['TrailingWhitespaceRule']
        pluginEngine.runRules(ruleNames, {workspace: testTools.createWorkspace([])});
    });

    it('If I make an engine with an invalid name, it should throw an error with the proper error message', () => { 
        expect(enginePlugin.createEngine('OtherEngine', {})).rejects.toThrow("Unsupported engine name: OtherEngine");
    });
});