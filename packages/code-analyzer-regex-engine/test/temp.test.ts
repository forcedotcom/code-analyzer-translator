import path from "node:path"
import { RegexEngine, RegexEnginePlugin} from "../src/RegexEnginePlugin";
import * as EngineApi from '@salesforce/code-analyzer-engine-api';


describe('Regex Engine Tests', () => {
    let engine: RegexEngine;
    let config: EngineApi.ConfigObject = {"config" : 5}
    beforeAll(() => {
        engine = new RegexEngine(config);
    });
    it('getName', () => {
        const name: string = engine.getName();
        expect(name).toEqual("RegexEngine");
        
    });
    it('describeRules', () => {
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

    it('setting configurations', () => {
        const engConfig: EngineApi.ConfigObject = engine.config;
        expect(engConfig).toEqual(config);
        
    });
});

describe('RegexEnginePlugin Tests' , () => {
    
    let config: EngineApi.ConfigObject = {"config": 5};
    let engine: RegexEngine = new RegexEngine(config); 
    let enginePlugin: RegexEnginePlugin;

    beforeAll(() => {
        enginePlugin = new RegexEnginePlugin();

    });
   
    it('Basic engine creation', () => {
        enginePlugin.createEngine("RegexEngine", config);
        const pluginEngine = enginePlugin.getCreatedEngine("RegexEngine") as RegexEngine;
        expect(isEngineEqual(pluginEngine, engine)).toBeTruthy()

    });
    it('Check that engine changes after multiple calls to create', () => {
        let config2: EngineApi.ConfigObject = {"config": 11}
        let engine2: RegexEngine = new RegexEngine(config2);
        enginePlugin.createEngine("RegexEngine", config);
        enginePlugin.createEngine("RegexEngine", config2);
        const pluginEngine = enginePlugin.getCreatedEngine("RegexEngine") as RegexEngine;

        expect((isEngineEqual(pluginEngine, engine2))).toBeTruthy()



    });
    it('Creating engine with an invalid name', () => { 
        expect(() => {enginePlugin.createEngine('OtherEngine', config)}).toThrow("Unsupported engine name: OtherEngine");
        

    });
    it('Get engine before creation', () => { 
        expect(() => {enginePlugin.getCreatedEngine('OtherEngine')}).toThrow("Engine with name OtherEngine has not yet been created");
        

    });


});

function isEngineEqual(a: RegexEngine, b: RegexEngine)  {
    return (a.getName() === b.getName());

}

