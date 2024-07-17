import {RegexEnginePlugin} from "../src/plugin";
import {RegexEngine} from "../src/engine";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation
} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools"
import {
    EXPECTED_VIOLATION_1,
    EXPECTED_VIOLATION_2, EXPECTED_VIOLATION_3,
    TRAILING_WHITESPACE_RESOURCE_URLS,
    TRAILING_WHITESPACE_RULE_MESSAGE,
} from "./test-config";

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

    it('Calling describeRules() on an engine should return the single trailing whitespace rule', async () => {
        const rules_desc: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([])});
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
});

describe('runRules() TrailingWhitespaceRule tests', () => {
    let engine: RegexEngine;
    let ruleNames: string[] ;
    beforeAll(() => {
        ruleNames = ["TrailingWhitespaceRule"]
        engine = new RegexEngine();
    });

    it('if runRules() is called on a directory with no apex files, it should correctly return no violations', async () => {
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "1_notApexClassWithWhitespace")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])}
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        const expViolations: Violation[] = [];
        expect(runResults.violations).toStrictEqual(expViolations);
    });

    it('Confirm runRules() returns correct errors when called on a file', async () => {
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])}
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        expect(runResults.violations).toHaveLength(3)
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_2[0])
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_2[1])
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_2[2])
    });

    it('If runRules() finds no violations when an apex file has no trailing whitespaces', async () => {
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "3_apexClassWithoutWhitespace")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])}
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        const expViolations: Violation[] = [];
        expect(runResults.violations).toStrictEqual(expViolations);
    });

    it("If runRules() is called with trailing whitespace rule on an Apex class that has trailing whitespace, emit violation", async () => {
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "2_apexClasses", "myOuterClass.cls")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])}
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        expect(runResults.violations).toStrictEqual(EXPECTED_VIOLATION_1)
    });

    it("If trailing whitespace rule is run on an Apex class without trailing whitespace ensure there are no erroneous violations", async () => {
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "3_apexClassWithoutWhitespace", "myOuterClass.cls")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])}
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        const expViolations: Violation[] = []
        expect(runResults.violations).toStrictEqual(expViolations);

    });

    it("Ensure execute() can be called on a list Apex classes and properly emits errors", async () => {
        const file1 = path.resolve("test", "test-data", "apexClassWhitespace", "2_apexClasses", "myOuterClass.cls")
        const file2 = path.resolve("test", "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls");
        const file3 = path.resolve("test", "test-data", "apexClassWhitespace", "3_apexClassWithoutWhitespace", "myOuterClass.cls")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([file1, file2, file3])}
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        expect(runResults.violations).toHaveLength(EXPECTED_VIOLATION_3.length)
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_3[0])
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_3[1])
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_3[2])
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_3[3])
    });
});

describe('Plugin Tests' , () => {
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
   
    it('Check that engine created from the Plugin has expected name', () => {
        const engineName = "regex";
        expect(pluginEngine.getName()).toStrictEqual(engineName)
    });

    it('Check that engine created from the Plugin has expected output when describeRules is called', async () => {
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
        await expect(enginePlugin.createEngine('OtherEngine', {})).rejects.toThrow("The RegexEnginePlugin does not support creating an engine with name 'OtherEngine'.");
    });
});

