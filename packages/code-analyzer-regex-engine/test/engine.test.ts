import path from "node:path"
import { RegexEngine, RegexEnginePlugin} from "../src/RegexEnginePlugin";
import * as EngineApi from '@salesforce/code-analyzer-engine-api';
import { EngineRunResults } from "@salesforce/code-analyzer-engine-api";


describe('Regex Engine Tests', () => {
    let engine: RegexEngine;
    let config: EngineApi.ConfigObject = {"config" : 5}
    beforeAll(() => {
        engine = new RegexEngine(config);
    });
    it('Check that when I try to access an engine name, it is retrieved and the name is correct', () => {
        const name: string = engine.getName();
        expect(name).toEqual("regex");
        
    });
    it('If I call describeRules() on an engine, it should correctly return the single trailing whitespace rule', () => {
        const rules_desc: EngineApi.RuleDescription[]= engine.describeRules();
        expect(rules_desc).toEqual(
            [
                {
                    name: "TrailingWhitespaceRule",
                    severityLevel: EngineApi.SeverityLevel.Low,
                    type: EngineApi.RuleType.Standard,
                    tags: ["Recommended", "CodeStyle"],
                    description: "Some description for TrailingWhiteSpaceRuleStub",
                    resourceUrls: ["https://example.com/TrailingWhiteSpaceRuleStub"]
                },
            ]
        )
        
    });

    it('Check that any settings configurations are propogated to the engine when creating the new engine', () => {
        const engConfig: EngineApi.ConfigObject = engine.config;
        expect(engConfig).toEqual(config);
        
    });

    it('When I make a call to runRules(), nothing should happen since it is currently a no-op', () => {
        const ruleNames: string[] = ['TrailingWhitespaceRule']
        const runOptions: EngineApi.RunOptions = {"filesToInclude": ["path/to/dir"] }
        engine.runRules(ruleNames, runOptions);

    })
});

describe('RegexEnginePlugin Tests' , () => {
    
    let config: EngineApi.ConfigObject = {"config": 5};
    let engine: RegexEngine = new RegexEngine(config); 
    let enginePlugin: RegexEnginePlugin;

    beforeAll(() => {
        enginePlugin = new RegexEnginePlugin();

    });

    it('Check that I can get all available engine names', () => {
        const availableEngines: string[] = ['regex'] 
        expect(enginePlugin.getAvailableEngineNames()).toStrictEqual(availableEngines)
    })
   
    it('Check that I can create engine using createEngine from the plugin (while retaining passed-in configuration information) ', () => {
        enginePlugin.createEngine("regex", config);
        const pluginEngine = enginePlugin.getCreatedEngine("regex") as RegexEngine;
        expect(pluginEngine).toStrictEqual(engine)

    });
    it('Check that if I call create on a RegexEnginePlugin engine more than once, the most recently created engine is retained', () => {
        let config2: EngineApi.ConfigObject = {"config": 11}
        let engine2: RegexEngine = new RegexEngine(config2);
        enginePlugin.createEngine("regex", config);
        enginePlugin.createEngine("regex", config2);
        const pluginEngine = enginePlugin.getCreatedEngine("regex") as RegexEngine;

        expect(pluginEngine).toStrictEqual(engine2)



    });
    it('If I make an engine with an invalid name, it should throw an error with the proper error message', () => { 
        expect(() => {enginePlugin.createEngine('OtherEngine', config)}).toThrow("Unsupported engine name: OtherEngine");
        

    });
    it('If I try to access a plugin engine before it has been created, it should throw an error with the correct message', () => { 
        expect(() => {enginePlugin.getCreatedEngine('OtherEngine')}).toThrow("Engine with name OtherEngine has not yet been created");
        

    });
    


});



