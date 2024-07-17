import {RegexEngine} from "../src/engine";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation,
    CodeLocation
} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools"
import {getMessage} from "../src/messages";

const FILE_LOCATION_1 = path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myOuterClass.cls")
const FILE_LOCATION_2 = path.resolve(__dirname,  "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls")

const TRAILING_WHITESPACE_RULE_NAME: string = "NoTrailingWhitespace"
const TRAILING_WHITESPACE_RULE_DESCRIPTION: string ="Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace."
const TRAILING_WHITESPACE_RESOURCE_URLS: string[] = []
const TRAILING_WHITESPACE_REGEX: string = new RegExp('[ \\t]+((?=\\r?\\n)|(?=$))', 'g').toString()

const EXPECTED_CODE_LOCATION_1: CodeLocation = {
    file: FILE_LOCATION_1,
    startLine: 6,
    startColumn: 2,
    endLine: 6,
    endColumn: 4
};

const EXPECTED_CODE_LOCATION_2: CodeLocation = {
    file: FILE_LOCATION_2,
    startLine: 2,
    startColumn: 40,
    endLine: 2,
    endColumn: 41
};

const EXPECTED_CODE_LOCATION_3: CodeLocation = {
    file: FILE_LOCATION_2,
    startLine: 6,
    startColumn: 2,
    endLine: 6,
    endColumn: 4
};

const EXPECTED_CODE_LOCATION_4: CodeLocation = {
    file: FILE_LOCATION_2,
    startLine: 1,
    startColumn: 21,
    endLine: 1,
    endColumn: 23
};

const EXPECTED_VIOLATION_1: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: getMessage(
            'RuleViolationMessage',
            TRAILING_WHITESPACE_REGEX,
            TRAILING_WHITESPACE_RULE_NAME,
            TRAILING_WHITESPACE_RULE_DESCRIPTION),
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    }
];

const EXPECTED_VIOLATION_2: Violation[] = [

    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: getMessage(
            'RuleViolationMessage',
            TRAILING_WHITESPACE_REGEX,
            TRAILING_WHITESPACE_RULE_NAME,
            TRAILING_WHITESPACE_RULE_DESCRIPTION),
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_2]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: getMessage(
            'RuleViolationMessage',
            TRAILING_WHITESPACE_REGEX,
            TRAILING_WHITESPACE_RULE_NAME,
            TRAILING_WHITESPACE_RULE_DESCRIPTION),
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_3]

    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: getMessage(
            'RuleViolationMessage',
            TRAILING_WHITESPACE_REGEX,
            TRAILING_WHITESPACE_RULE_NAME,
            TRAILING_WHITESPACE_RULE_DESCRIPTION),
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_4]
    },
];

const EXPECTED_VIOLATION_3: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: getMessage(
            'RuleViolationMessage',
            TRAILING_WHITESPACE_REGEX,
            TRAILING_WHITESPACE_RULE_NAME,
            TRAILING_WHITESPACE_RULE_DESCRIPTION),
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_4]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: getMessage(
            'RuleViolationMessage',
            TRAILING_WHITESPACE_REGEX,
            TRAILING_WHITESPACE_RULE_NAME,
            TRAILING_WHITESPACE_RULE_DESCRIPTION),
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: getMessage(
            'RuleViolationMessage',
            TRAILING_WHITESPACE_REGEX,
            TRAILING_WHITESPACE_RULE_NAME,
            TRAILING_WHITESPACE_RULE_DESCRIPTION),
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_2]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: getMessage(
            'RuleViolationMessage',
            TRAILING_WHITESPACE_REGEX,
            TRAILING_WHITESPACE_RULE_NAME,
            TRAILING_WHITESPACE_RULE_DESCRIPTION),
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_3]
    },
];

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
                name: "NoTrailingWhitespace",
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: TRAILING_WHITESPACE_RULE_DESCRIPTION,
                resourceUrls: TRAILING_WHITESPACE_RESOURCE_URLS
            },
        ];
        expect(rules_desc).toEqual(engineRules)
    });
});

describe('runRules() TrailingWhitespaceRule tests', () => {
    let engine: RegexEngine;
    let ruleNames: string[];
    beforeAll(() => {
        ruleNames = ["NoTrailingWhitespace"]
        engine = new RegexEngine()
    });

    it('if runRules() is called on a directory with no apex files, it should correctly return no violations', async () => {
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "1_notApexClassWithWhitespace")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])};
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        const expViolations: Violation[] = [];
        expect(runResults.violations).toStrictEqual(expViolations)
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
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "3_apexClassWithoutWhitespace");
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])};
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        const expViolations: Violation[] = [];
        expect(runResults.violations).toStrictEqual(expViolations)
    });

    it("If runRules() is called with trailing whitespace rule on an Apex class that has trailing whitespace, emit violation", async () => {
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "2_apexClasses", "myOuterClass.cls");
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])};
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        expect(runResults.violations).toStrictEqual(EXPECTED_VIOLATION_1)
    });

    it("If trailing whitespace rule is run on an Apex class without trailing whitespace ensure there are no erroneous violations", async () => {
        const filePath = path.resolve("test", "test-data", "apexClassWhitespace", "3_apexClassWithoutWhitespace", "myOuterClass.cls")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([filePath])};
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        const expViolations: Violation[] = [];
        expect(runResults.violations).toStrictEqual(expViolations)

    });

    it("Ensure runRules() can be called on a list Apex classes and properly emits errors", async () => {
        const file1 = path.resolve("test", "test-data", "apexClassWhitespace", "2_apexClasses", "myOuterClass.cls");
        const file2 = path.resolve("test", "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls");
        const file3 = path.resolve("test", "test-data", "apexClassWhitespace", "3_apexClassWithoutWhitespace", "myOuterClass.cls");
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([file1, file2, file3])};
        const runResults: EngineRunResults = await engine.runRules(ruleNames, runOptions);
        expect(runResults.violations).toHaveLength(EXPECTED_VIOLATION_3.length)
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_3[0])
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_3[1])
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_3[2])
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_3[3])
    });
});