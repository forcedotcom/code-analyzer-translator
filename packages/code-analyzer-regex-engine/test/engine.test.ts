import {RegexEnginePlugin, RegexEngine} from "../src/RegexEnginePlugin";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    RuleDescription,
    RuleType,
    SeverityLevel,
    RunOptions,
    EngineRunResults,
    Violation
} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools"
import { TRAILING_WHITESPACE_RULE_MESSAGE, TRAILING_WHITESPACE_RESOURCE_URLS, EXPECTED_VIOLATION_2 } from "./test-config";

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
                description: TRAILING_WHITESPACE_RULE_MESSAGE,
                resourceUrls: TRAILING_WHITESPACE_RESOURCE_URLS
            },
        ];
        expect(rules_desc).toEqual(engineRules)
    });



    describe('runRules() tests', () => {
        let ruleNames: string[];
        beforeAll(() => {
            ruleNames = ['TrailingWhitespaceRule']
        })

        it('if runRules() is called on a directory with no apex files, it should correctly return no violations', async () => {
            const filePath = path.resolve("test", "test-data", "1_notApexClassWithWhitespace")
            const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])}
            const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
            const expViolations: Violation[] = [];
            expect(runResults.violations).toStrictEqual(expViolations);
        });

        it('Confirm runRules() returns correct errors when called on a file', async () => {
            const ruleNames: string[] = ['TrailingWhitespaceRule']
            const filePath = path.resolve("test", "test-data", "2_apexClasses", "myClass.cls")
            const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])}
            const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
            expect(runResults.violations).toStrictEqual(EXPECTED_VIOLATION_2)
        });

        it('If runRules() finds no violations when an apex file has no trailing whitespaces', async () => {
            const filePath = path.resolve("test", "test-data", "4_ApexClassWithoutWhitespace")
            const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])}
            const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
            const expViolations: Violation[] = [];
            expect(runResults.violations).toStrictEqual(expViolations);
        });
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
                description: "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.",
                resourceUrls: []
            },
        ];
        const engineRules: RuleDescription[] = await pluginEngine.describeRules({workspace: testTools.createWorkspace([])})
        expect(engineRules).toStrictEqual(expEngineRules)
    });

    it('If I make an engine with an invalid name, it should throw an error with the proper error message', async () => {
        await expect(enginePlugin.createEngine('OtherEngine', {})).rejects.toThrow("Unsupported engine name: OtherEngine");
    });
});

