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
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "../src/messages";
import {
    RegexRules, 
    DEFAULT_TAGS, 
    DEFAULT_SEVERITY_LEVEL
} from "../src/config";
import {BASE_REGEX_RULES} from "../src/plugin";

changeWorkingDirectoryToPackageRoot();

const SAMPLE_CUSTOM_RULES: RegexRules = {
    NoTodos: {
        regex: /TODO:/gi,
        description: "Detects TODO comments in code base.",
        file_extensions: [".js", ".cls"],
        violation_message: "sample violation message",
        severity: DEFAULT_SEVERITY_LEVEL,
        tags: DEFAULT_TAGS
    },
    NoHellos: {
        regex: /hello/gi,
        description: "Detects hellos in project.",
        violation_message: "sample violation message",
        severity: DEFAULT_SEVERITY_LEVEL,
        tags: DEFAULT_TAGS
    }
};

const EXPECTED_NoTrailingWhitespace_RULE_DESCRIPTION: RuleDescription = {
    name: "NoTrailingWhitespace",
    severityLevel: SeverityLevel.Info,
    type: RuleType.Standard,
    tags: ["Recommended", "CodeStyle"],
    description: getMessage('TrailingWhitespaceRuleDescription'),
    resourceUrls: []
};

const EXPECTED_NoTodos_RULE_DESCRIPTION = {
    name: "NoTodos",
    severityLevel: DEFAULT_SEVERITY_LEVEL,
    type: RuleType.Standard,
    tags: DEFAULT_TAGS,
    description: "Detects TODO comments in code base.",
    resourceUrls: []
};

const EXPECTED_NoHellos_RULE_DESCRIPTION = {
    name: "NoHellos",
    severityLevel: DEFAULT_SEVERITY_LEVEL,
    type: RuleType.Standard,
    tags: DEFAULT_TAGS,
    description: "Detects hellos in project.",
    resourceUrls: []
};

describe("Tests for RegexEngine's getName and describeRules methods", () => {
    let engine: RegexEngine;
    beforeAll(() => {
        engine = new RegexEngine({
            ... BASE_REGEX_RULES,
            ... SAMPLE_CUSTOM_RULES
        });
    });

    it('Engine name is accessible and correct', () => {
        const name: string = engine.getName();
        expect(name).toEqual("regex");
    });

    it('Calling describeRules without workspace, returns all available rules', async () => {
        const rulesDescriptions: RuleDescription[] = await engine.describeRules({});
        expect(rulesDescriptions).toHaveLength(3);
        expect(rulesDescriptions[0]).toMatchObject(EXPECTED_NoTrailingWhitespace_RULE_DESCRIPTION);
        expect(rulesDescriptions[1]).toMatchObject(EXPECTED_NoTodos_RULE_DESCRIPTION);
        expect(rulesDescriptions[2]).toMatchObject(EXPECTED_NoHellos_RULE_DESCRIPTION);
    });

    it("When workspace contains zero applicable files, then describeRules returns no rules", async () => {
        const rulesDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
                path.resolve(__dirname, 'test-data', 'workspaceWithNoTextFiles') //
            ])});
        expect(rulesDescriptions).toHaveLength(0);
    });

    it("When workspace contains files only applicable to only some of the rules, then describeRules only returns those rules", async () => {
        const rulesDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
                path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'dummy3.js')
            ])});
        expect(rulesDescriptions).toHaveLength(2);
        expect(rulesDescriptions[0]).toMatchObject(EXPECTED_NoTodos_RULE_DESCRIPTION);
        expect(rulesDescriptions[1]).toMatchObject(EXPECTED_NoHellos_RULE_DESCRIPTION);
    });

    it("When workspace contains files are applicable to all available rules, then describeRules returns all rules", async () => {
        const rulesDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
                path.resolve(__dirname, 'test-data', 'sampleWorkspace')
            ])});
        expect(rulesDescriptions).toHaveLength(3);
        expect(rulesDescriptions[0]).toMatchObject(EXPECTED_NoTrailingWhitespace_RULE_DESCRIPTION);
        expect(rulesDescriptions[1]).toMatchObject(EXPECTED_NoTodos_RULE_DESCRIPTION);
        expect(rulesDescriptions[2]).toMatchObject(EXPECTED_NoHellos_RULE_DESCRIPTION);
    });
});

describe('Tests for runRules', () => {
    let engine: RegexEngine;
    beforeAll(() => {
        engine = new RegexEngine({
            ... BASE_REGEX_RULES,
            ... SAMPLE_CUSTOM_RULES
        });
    });

    it('if runRules() is called on a directory with no apex files, it should correctly return no violations', async () => {
        const runOptions: RunOptions = {
            workspace: new Workspace([
                path.resolve(__dirname, "test-data", "apexClassWhitespace", "1_notApexClassWithWhitespace")
            ])};
        const runResults: EngineRunResults = await engine.runRules( ["NoTrailingWhitespace"], runOptions);
        expect(runResults.violations).toHaveLength(0);
    });

    it("Ensure runRules when called on a list Apex classes, properly emits violations", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
            path.resolve(__dirname, "test-data", "apexClassWhitespace")
        ])};
        const runResults: EngineRunResults = await engine.runRules(["NoTrailingWhitespace", "NoTodos"], runOptions);

        const expectedViolations: Violation[] = [
            {
                ruleName: "NoTrailingWhitespace",
                message: getMessage('TrailingWhitespaceRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls"),
                        startLine: 6,
                        startColumn: 2,
                        endLine: 6,
                        endColumn: 4
                    }
                ]
            },
            {
                ruleName: "NoTrailingWhitespace",
                message: getMessage('TrailingWhitespaceRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls"),
                    startLine: 6,
                    startColumn: 2,
                    endLine: 6,
                    endColumn: 4
                }]
            },
            {
                ruleName: "NoTrailingWhitespace",
                message: getMessage('TrailingWhitespaceRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls"),
                    startLine: 1,
                    startColumn: 21,
                    endLine: 1,
                    endColumn: 23
                }]
            },
            {
                ruleName: "NoTrailingWhitespace",
                message: getMessage('TrailingWhitespaceRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myOuterClass.cls"),
                    startLine: 7,
                    startColumn: 2,
                    endLine: 7,
                    endColumn: 4
                }]
            }
        ];

        expect(runResults.violations).toHaveLength(expectedViolations.length);
        for (const expectedViolation of expectedViolations) {
            expect(runResults.violations).toContainEqual(expectedViolation);
        }
    });

    it("When workspace contains files that violate custom rules, then emit violation correctly", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
            path.resolve(__dirname, "test-data", "sampleWorkspace")
        ])};
        const runResults: EngineRunResults = await engine.runRules(["NoTodos", "NoHellos"], runOptions);

        const expectedViolations: Violation[] = [
            {
                ruleName: "NoTodos",
                message: "sample violation message",
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "sampleWorkspace", "dummy3.js"),
                        startLine: 1,
                        startColumn: 3,
                        endLine: 1,
                        endColumn: 8
                    }
                ]
            },
            {
                ruleName: "NoTodos",
                message: "sample violation message",
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "sampleWorkspace", "dummy3.js"),
                        startLine: 3,
                        startColumn: 17,
                        endLine: 3,
                        endColumn: 22
                    }
                ]
            },
            {
                ruleName: "NoHellos",
                message: "sample violation message",
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "sampleWorkspace", "dummy3.js"),
                        startLine: 3,
                        startColumn: 29,
                        endLine: 3,
                        endColumn: 34
                    }
                ]
            },
            {
                ruleName: "NoHellos",
                message: "sample violation message",
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "sampleWorkspace", "dummy4.txt"),
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 6
                    }
                ]
            }

        ];

        expect(runResults.violations).toHaveLength(expectedViolations.length);
        for (const expectedViolation of expectedViolations) {
            expect(runResults.violations).toContainEqual(expectedViolation);
        }
    });

    it("When running all rules compared to some rules, then output correctly returns what the correct violations according to specified rules", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
                path.resolve(__dirname, "test-data", "sampleWorkspace")
            ])};
        const runResults1: EngineRunResults = await engine.runRules(["NoTrailingWhitespace"], runOptions);
        const runResults2: EngineRunResults = await engine.runRules(["NoTodos"], runOptions);
        const runResults3: EngineRunResults = await engine.runRules(["NoTrailingWhitespace", "NoTodos"], runOptions);

        expect(runResults1.violations).toHaveLength(1);
        expect(runResults2.violations).toHaveLength(2);
        expect(runResults3.violations).toHaveLength(3);
        expect(runResults3.violations).toContainEqual(runResults1.violations[0]);
        expect(runResults3.violations).toContainEqual(runResults2.violations[0]);
        expect(runResults3.violations).toContainEqual(runResults2.violations[1]);
    });
});