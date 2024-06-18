import { RegexEngine, RegexEnginePlugin} from "../src/RegexEnginePlugin";
import * as EngineApi from '@salesforce/code-analyzer-engine-api';



describe('Regex Engine Tests', () => {
    let engine: RegexEngine;
    beforeAll(() => {
        engine = new RegexEngine();
    });

    it('Check that when I try to access an engine name, it is retrieved and the name is correct', () => {
        const name: string = engine.getName();
        expect(name).toEqual("regex");
        
    });
    it('If I call describeRules() on an engine, it should correctly return the single trailing whitespace rule', async () => {
        const rules_desc: EngineApi.RuleDescription[]= await engine.describeRules();
        const engineRules = [
            {
                name: "TrailingWhitespaceRule",
                severityLevel: EngineApi.SeverityLevel.Low,
                type: EngineApi.RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: "",
                resourceUrls: [""]
            },
        ];
        expect(rules_desc).toEqual(engineRules)
        
    });

    it('When I make a call to runRules(), nothing should happen since it is currently a no-op', () => {
        const ruleNames: string[] = ['TrailingWhitespaceRule']
        const runOptions: EngineApi.RunOptions = {"workspaceFiles": ["path/to/dir"] }
        engine.runRules(ruleNames, runOptions);

    })
});

describe('RegexEnginePlugin Tests' , () => {
    
    let pluginEngine: RegexEngine 
    let enginePlugin: RegexEnginePlugin;


    beforeAll(() => {
        enginePlugin = new RegexEnginePlugin();
        pluginEngine = enginePlugin.createEngine("regex") as RegexEngine;

    });

    it('Check that I can get all available engine names', () => {
        const availableEngines: string[] = ['regex'] 
        expect(enginePlugin.getAvailableEngineNames()).toStrictEqual(availableEngines)
    })
   
    it('Check that engine created from the RegexEnginePlugin has expected name', () => {
        const engineName = "regex";
        expect(pluginEngine.getName()).toStrictEqual(engineName)

    });

    it('Check that engine created from the RegexEnginePlugin has expected output when describeRules() is called', async () => {
        const expEngineRules = [
            {
                name: "TrailingWhitespaceRule",
                severityLevel: EngineApi.SeverityLevel.Low,
                type: EngineApi.RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: "",
                resourceUrls: [""]
            },
        ];
        const engineRules: EngineApi.RuleDescription[] = await pluginEngine.describeRules()
        expect(engineRules).toStrictEqual(expEngineRules)

    });

    it('Check that engine created from the RegexEnginePlugin has runRules() method as a no-op', () => {
        const ruleNames: string[] = ['TrailingWhitespaceRule']
        const runOptions: EngineApi.RunOptions = {"workspaceFiles": ["path/to/dir"] }
        pluginEngine.runRules(ruleNames, runOptions);

    })

    it('If I make an engine with an invalid name, it should throw an error with the proper error message', () => { 
        expect(() => {enginePlugin.createEngine('OtherEngine')}).toThrow("Unsupported engine name: OtherEngine");
        

    });
    
    


});



