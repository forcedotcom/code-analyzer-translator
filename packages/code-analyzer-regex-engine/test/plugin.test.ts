import {RegexEngine} from "../src/engine";
import {RegexEnginePlugin} from "../src";
import {
    CodeLocation,
    ConfigObject,
    EngineRunResults,
    getMessageFromCatalog,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools";
import {getMessage} from "../src/messages";
import path from "node:path";
import {RegexRuleMap} from "../src/config";
import {
    TRAILING_WHITESPACE_REGEX,
    TRAILING_WHITESPACE_RULE_DESCRIPTION,
    TRAILING_WHITESPACE_RULE_FILE_EXTENSIONS
} from "./trailing_whitespace_rule_config";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

const FILE_LOCATION_1 = path.resolve(__dirname,  "test-data", "workspace_NoCustomConfig", "dummy.ts")

const BASELINE_NO_TODOS_RULE = {
    regex: String.raw`/TODO:\s/gi`,
    description: "Detects TODO comments in code base.",
    file_extensions: [".js", ".ts", ".cls"]
};

const EXPECTED_CODE_LOCATION_1: CodeLocation = {
    file: FILE_LOCATION_1,
    startLine: 1,
    startColumn: 4,
    endLine: 1,
    endColumn: 10
}

export const EXPECTED_VIOLATION_1: Violation[] = [
    {
        ruleName: "NoTodos",
        message: getMessage(
            'RuleViolationMessage',
            /TODO:\s/gi.toString(),
            "NoTodos",
            "Detects TODO comments in code base."
        ),

        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    }
];

const EXPECTED_REGEX_LIST: RegExp[] = [
    new RegExp('[a-zA-Z]{2,5}\\d?', 'i'),
    new RegExp('\\d{1,3}\\s?[A-Z]*', 'g'),
    new RegExp('[^aeiou]{4,}\\W?', 'm'),
    new RegExp('(foo|bar){2,3}\\d*', 'g'),
    new RegExp('\\d{2,4}-[a-z]{3,}', 'g'),
    new RegExp('(cat|dog)?\\s+[1-9]', 'g'),
    new RegExp('\\w{3,5}\\.?\\d?', 'g'),
    new RegExp('[A-Z]{1,4}@[a-z]{2,4}', 'g'),
    new RegExp('\\d{3,5}[^\\d\\s]', 'g'),
    new RegExp('[a-zA-Z]+\\d{1,2}', 'g'),
    new RegExp('[0-9]{2,}[A-Z]{2,}?', 'g'),
    new RegExp('[^a-zA-Z0-9]{3,6}', 'g'),
    new RegExp('(alpha|beta)\\d{2,4}?', 'i')
]

changeWorkingDirectoryToPackageRoot();

describe('RegexEnginePlugin No Custom Config Tests' , () => {
    let pluginEngine: RegexEngine;
    let enginePlugin: RegexEnginePlugin;
    beforeAll(async () => {
        enginePlugin = new RegexEnginePlugin()
        pluginEngine = await enginePlugin.createEngine("regex", {}) as RegexEngine
    });

    it('Check that I can get all available engine names', () => {
        const availableEngines: string[] = ['regex'];
        expect(enginePlugin.getAvailableEngineNames()).toStrictEqual(availableEngines)
    })

    it('Check that engine created from the plugin has expected name', () => {
        const engineName = "regex";
        expect(pluginEngine.getName()).toStrictEqual(engineName)
    });

    it('Check that engine created from the plugin has expected output when describeRules() is called', async () => {
        const expEngineRules = [
            {
                name: "NoTrailingWhitespace",
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: getMessage('TrailingWhitespaceRuleDescription'),
                resourceUrls: []
            },
        ];
        const engineRules: RuleDescription[] = await pluginEngine.describeRules({});
        expect(engineRules).toStrictEqual(expEngineRules)
    });

    it('If I make an engine with an invalid name, it should throw an error with the proper error message', async () => {
        await expect(enginePlugin.createEngine('OtherEngine', {})).rejects.toThrow("The RegexEnginePlugin does not support creating an engine with name 'OtherEngine'.");
    });
});

describe('RegexEnginePlugin Custom Config Tests', () => {
    let enginePlugin: RegexEnginePlugin;
    beforeAll(async () => {
        enginePlugin = new RegexEnginePlugin()
    });

    it("Check that engine created from plugin can take custom rule and add it to config", async () => {
        const rawConfig: ConfigObject = {
            custom_rules: {
                "NoTodos": BASELINE_NO_TODOS_RULE
            }
        }
        const pluginEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine
        const customRuleRegex: RegExp = /TODO:\s/gi
        const expEngineConfigRules: RegexRuleMap = {
            "NoTodos": {
                regex: customRuleRegex,
                description: BASELINE_NO_TODOS_RULE.description,
                file_extensions: BASELINE_NO_TODOS_RULE.file_extensions,
                violation_message: getMessage('RuleViolationMessage', customRuleRegex.toString(), "NoTodos", "Detects TODO comments in code base.")
            },
            "NoTrailingWhitespace": {
                description: TRAILING_WHITESPACE_RULE_DESCRIPTION,
                file_extensions: TRAILING_WHITESPACE_RULE_FILE_EXTENSIONS,
                regex: TRAILING_WHITESPACE_REGEX,
                violation_message: getMessage('TrailingWhitespaceRuleMessage')
            },
        }
        expect(pluginEngine.getConfig().rules).toEqual(expEngineConfigRules)
    });

    it("Check that engine created from plugin can describe a custom rule", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": BASELINE_NO_TODOS_RULE
            }
        }
        const pluginEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine
        const dir = path.resolve("test", "test-data", "workspace_NoCustomConfig")
        const describeOptions: RunOptions = {workspace: testTools.createWorkspace([dir])};
        const expRuleDesc: RuleDescription[] = [
            {
                name: "NoTodos",
                description: BASELINE_NO_TODOS_RULE.description,
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                resourceUrls: []
            }
        ]
        const ruleDesc: RuleDescription[] = await pluginEngine.describeRules(describeOptions);
        expect(ruleDesc).toStrictEqual(expRuleDesc)

    });

    it("Check that engine created from plugin can run custom_rules", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": BASELINE_NO_TODOS_RULE
            }
        }
        const pluginEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine
        const dir = path.resolve("test", "test-data", "workspace_NoCustomConfig")
        const runOptions: RunOptions = {workspace: testTools.createWorkspace([dir])};
        const ruleNames: string[] = ["NoTodos"]
        const runResults: EngineRunResults = await pluginEngine.runRules(ruleNames, runOptions);
        expect(runResults.violations).toHaveLength(EXPECTED_VIOLATION_1.length)
        expect(runResults.violations).toContainEqual(EXPECTED_VIOLATION_1[0])
    });

    it('If custom_rules is given via a config object array, emit appropriate error', async () => {
        const rawConfig: ConfigObject = {
            custom_rules: [
                {
                    name: "NoTodos",
                    ...BASELINE_NO_TODOS_RULE
                }
            ]
        }
        await expect(enginePlugin.createEngine('regex', rawConfig)).rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules', 'object', 'array'))
    })


    it("If regex given in a rule is malformed, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules:
                {
                    "BadRule": {
                        regex: '/something[/gi',
                        description: "Bad rule description",
                        file_extensions: [".js", ".ts", ".cls"]
                    }
                }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage('InvalidRegex', '/something[/gi', 'engines.regex.custom_rules.BadRule.regex', "Invalid regular expression: /something[/gi: Unterminated character class"));
    });

    it("If regex is not given in forward-slash delimited strings, emit appropriate error", async () => {
        const rawConfig = {
            custom_rules: {
                "BadRule": {
                    regex: 'something[',
                    description: "Bad rule description",
                    file_extensions: [".js", ".ts", ".cls"]
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage('InvalidRegexString', 'something[', 'engines.regex.custom_rules.BadRule.regex'));
    });

    it("If regex is given without two forward slashes, emit appropriate error", async () => {
        const rawConfig = {
            custom_rules: {
                "BadRule": {
                    regex: 'something[/gi',
                    modifier: "gi",
                    description: "Bad rule description",
                    file_extensions: [".js", ".ts", ".cls"]
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage('InvalidRegexString', 'something[/gi', 'engines.regex.custom_rules.BadRule.regex'));
    });


    it("If regex modifiers are invalid, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/lpr",
                    description: BASELINE_NO_TODOS_RULE.description,
                    file_extensions: BASELINE_NO_TODOS_RULE.file_extensions
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage('InvalidRegex', "/TODO:/lpr", 'engines.regex.custom_rules.NoTodos.regex', 'Invalid flags supplied to RegExp constructor \'lpr\''));
    });

    it("If regex modifiers are repeated, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/gig",
                    description: BASELINE_NO_TODOS_RULE.description,
                    file_extensions: BASELINE_NO_TODOS_RULE.file_extensions
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage('InvalidRegex', "/TODO:/gig", 'engines.regex.custom_rules.NoTodos.regex','Invalid flags supplied to RegExp constructor \'gig\'' ));
    });

    it("If modifiers u, v appear together, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/guv",
                    description: BASELINE_NO_TODOS_RULE.description,
                    file_extensions: BASELINE_NO_TODOS_RULE.file_extensions
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage('InvalidRegex', "/TODO:/guv", 'engines.regex.custom_rules.NoTodos.regex', 'Invalid flags supplied to RegExp constructor \'guv\''));
    });

    it("If regex is not given by user, emit error", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    description: BASELINE_NO_TODOS_RULE.description,
                    file_extensions: BASELINE_NO_TODOS_RULE.file_extensions
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.regex', 'string', 'undefined'));
    });

    it("If rule name is empty, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "" : BASELINE_NO_TODOS_RULE
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage( 'RuleNameCannotBeEmpty', 'engines.regex.custom_rules'));
    });

    it("If description is not a string, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: BASELINE_NO_TODOS_RULE.regex,
                    description: 4,
                    file_extensions: BASELINE_NO_TODOS_RULE.file_extensions
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.description', 'string', 'number'));
    });

    it("If description is not defined, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: BASELINE_NO_TODOS_RULE.regex,
                    file_extensions: BASELINE_NO_TODOS_RULE.file_extensions
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.description', 'string', 'undefined'));
    });

    it("If file_extensions are not a string array, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: BASELINE_NO_TODOS_RULE.regex,
                    description: BASELINE_NO_TODOS_RULE.description,
                    file_extensions: ".js"
                }
            }
        }
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.file_extensions', 'array', 'string'));
    });

    it("If file_extensions are not properly formatted, emit appropriate error", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: BASELINE_NO_TODOS_RULE.regex,
                    description: BASELINE_NO_TODOS_RULE.description,
                    file_extensions: ["js"]
                }
            }
        }
        const regexString: string = "^[.][a-zA-Z0-9]+$"
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage('ConfigStringValueMustMatchPattern', 'engines.regex.custom_rules.NoTodos.file_extensions[0]', "js", regexString));
    });

    it("If user creates a rule with a custom violation message, ensure that is maintained in config", async () => {
        const custom_message: string = "I have a custom message";
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...BASELINE_NO_TODOS_RULE,
                    violation_message: custom_message
                }
            }
        }
        const pluginEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine
        expect(pluginEngine.getConfig().rules["NoTodos"].violation_message).toStrictEqual(custom_message)
    });

    it('Single-Escaped Regex Blitz: ensure custom custom_rules with regex strings match up with intended regular expressions', async () => {
        const regexList: string[] = [
            String.raw`/[a-zA-Z]{2,5}\d?/i`,
            String.raw`/\d{1,3}\s?[A-Z]*/g`,
            String.raw`/[^aeiou]{4,}\W?/m`,
            String.raw`/(foo|bar){2,3}\d*/g`,
            String.raw`/\d{2,4}-[a-z]{3,}/g`,
            String.raw`/(cat|dog)?\s+[1-9]/g`,
            String.raw`/\w{3,5}\.?\d?/g`,
            String.raw`/[A-Z]{1,4}@[a-z]{2,4}/g`,
            String.raw`/\d{3,5}[^\d\s]/g`,
            String.raw`/[a-zA-Z]+\d{1,2}/g`,
            String.raw`/[0-9]{2,}[A-Z]{2,}?/g`,
            String.raw`/[^a-zA-Z0-9]{3,6}/g`,
            String.raw`/(alpha|beta)\d{2,4}?/i`
        ];
        await runRegexBlitzTest(regexList)

    });

    it('Double-Escaped Regex Blitz: ensure custom custom_rules with regex strings match up with intended regular expressions', async () => {
        const regexList: string[] = [
            '/[a-zA-Z]{2,5}\\d?/i',
            '/\\d{1,3}\\s?[A-Z]*/g',
            '/[^aeiou]{4,}\\W?/m',
            '/(foo|bar){2,3}\\d*/g',
            '/\\d{2,4}-[a-z]{3,}/g',
            '/(cat|dog)?\\s+[1-9]/g',
            '/\\w{3,5}\\.?\\d?/g',
            '/[A-Z]{1,4}@[a-z]{2,4}/g',
            '/\\d{3,5}[^\\d\\s]/g',
            '/[a-zA-Z]+\\d{1,2}/g',
            '/[0-9]{2,}[A-Z]{2,}?/g',
            '/[^a-zA-Z0-9]{3,6}/g',
            '/(alpha|beta)\\d{2,4}?/i'
        ];
        await runRegexBlitzTest(regexList)
    });

    async function runRegexBlitzTest(regexList: string[]) {
        const custom_rules: ConfigObject = createCustomRulesFromRegexList(regexList);
        const rawConfig: ConfigObject = {
            custom_rules: custom_rules
        };
        const pluginEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine;
        for (let i = 0; i < EXPECTED_REGEX_LIST.length; i++) {
            expect(checkRegexMatches(pluginEngine.getConfig().rules[`Rule${i}`].regex, EXPECTED_REGEX_LIST[i]));
        }
    }
});

function createCustomRulesFromRegexList(regexList: string[]): ConfigObject {
    const rulesMap: ConfigObject = {}
    regexList.forEach((regex, index) => (
        rulesMap[`Rule${index}`] = {
        regex: regex,
        description: `Detects pattern ${regex}`,
        file_extensions: [".js", ".ts", ".cls"],
        violation_message: `Detected pattern ${regex}`
    }));
    return rulesMap
}

function checkRegexMatches(a: RegExp, b: RegExp){
    return (a.source === b.source) && (a.flags === b.flags)
}