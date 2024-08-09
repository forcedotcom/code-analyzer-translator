import {RegexEngine} from "../src/engine";
import {RegexEnginePlugin} from "../src";
import {
    ConfigObject,
    Engine,
    getMessageFromCatalog,
    RuleType,
    SeverityLevel,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "../src/messages";
import {FILE_EXT_PATTERN, REGEX_STRING_PATTERN, RegexRules, RULE_NAME_PATTERN} from "../src/config";
import {BASE_REGEX_RULES} from "../src/plugin";

const SAMPLE_RAW_CUSTOM_RULE_DEFINITION = {
    regex: String.raw`/TODO:\s/gi`,
    description: "Detects TODO comments in code base.",
    file_extensions: [".js", ".ts", ".cls"]
};

const SAMPLE_RAW_CUSTOM_RULE_NO_FILE_EXTS_DEFINITION = {
    regex: String.raw`/hello/gi`,
    description: "Detects hellos in project",
}
describe('RegexEnginePlugin No Custom Config Tests' , () => {
    let enginePlugin: RegexEnginePlugin;
    beforeAll(() => {
        enginePlugin = new RegexEnginePlugin()
    });

    it('Check that I can get all available engine names', () => {
        expect(enginePlugin.getAvailableEngineNames()).toStrictEqual(['regex']);
    })

    it('Check that engine created from the plugin has expected type and name', async () => {
        const engine: Engine = await enginePlugin.createEngine('regex', {});
        expect(engine).toBeInstanceOf(RegexEngine);
        expect(engine.getName()).toStrictEqual('regex');
    });

    it('If I make an engine with an invalid name, it should throw an error with the proper error message', async () => {
        await expect(enginePlugin.createEngine('OtherEngine', {})).rejects.toThrow(
            getMessage('CantCreateEngineWithUnknownEngineName', 'OtherEngine'));
    });
});

describe('RegexEnginePlugin Custom Config Tests', () => {
    let enginePlugin: RegexEnginePlugin;
    beforeAll(async () => {
        enginePlugin = new RegexEnginePlugin()
    });

    it("When valid custom rules are provided, then they are appended to base rules", async () => {
        const rawConfig: ConfigObject = {
            custom_rules: {
                NoTodos: SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                NoHellos: SAMPLE_RAW_CUSTOM_RULE_NO_FILE_EXTS_DEFINITION
            }
        };
        const engine: RegexEngine = await enginePlugin.createEngine('regex', rawConfig) as RegexEngine;
        const customNoTodoRuleRegex: RegExp = /TODO:\s/gi;
        const customNoHelloRuleRegex: RegExp = /hello/gi;
        const expRegexRules: RegexRules = {
            ...BASE_REGEX_RULES,
            NoTodos: {
                regex: customNoTodoRuleRegex,
                description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions,
                violation_message: getMessage('RuleViolationMessage', customNoTodoRuleRegex.toString(), 'NoTodos', 'Detects TODO comments in code base.'),
                name: "NoTodos",
                type: RuleType.Standard,
                severityLevel: SeverityLevel.Moderate,
                tags: ['Recommended'],
                resourceUrls: []
            },
            NoHellos: {
                regex: customNoHelloRuleRegex,
                description: SAMPLE_RAW_CUSTOM_RULE_NO_FILE_EXTS_DEFINITION.description,
                violation_message: getMessage('RuleViolationMessage', customNoHelloRuleRegex.toString(), 'NoHellos', 'Detects hellos in project'),
                name: "NoHellos",
                type: RuleType.Standard,
                severityLevel: SeverityLevel.Moderate,
                tags: ['Recommended'],
                resourceUrls: []
            }
        };
        expect(engine._getRegexRules()).toEqual(expRegexRules);
    });

    it('If custom_rules is given as an array instead of an object, emit appropriate error', async () => {
        const rawConfig: ConfigObject = {
            custom_rules: [
                {
                    name: "NoTodos",
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION
                }
            ]
        };
        await expect(enginePlugin.createEngine('regex', rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules', 'object', 'array'));
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
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessage('InvalidRegex', 'engines.regex.custom_rules.BadRule.regex', "Invalid regular expression: /something[/gi: Unterminated character class"));
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
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustMatchRegExp',
                'engines.regex.custom_rules.BadRule.regex', REGEX_STRING_PATTERN.toString()));
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
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustMatchRegExp',
                'engines.regex.custom_rules.BadRule.regex', REGEX_STRING_PATTERN.toString()));
    });


    it("If regex has invalid modifiers, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/glpr",
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessage('InvalidRegex', "engines.regex.custom_rules.NoTodos.regex", 'Invalid flags supplied to RegExp constructor \'glpr\''));

    });

    it("If regex modifiers are repeated, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/gig",
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessage('InvalidRegex', "engines.regex.custom_rules.NoTodos.regex", 'Invalid flags supplied to RegExp constructor \'gig\''));
    });

    it("If modifiers u, v appear together, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/guv",
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessage('InvalidRegex', "engines.regex.custom_rules.NoTodos.regex", 'Invalid flags supplied to RegExp constructor \'guv\''));
    });

    it('If global modifier does not appear in regex, emit appropriate error', async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/i",
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessage('GlobalModifierNotProvided', "engines.regex.custom_rules.NoTodos.regex", "/TODO:/gi" , "/TODO:/i"));
    });

    it("If regex is not given by user, emit error", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.regex.custom_rules.NoTodos.regex', 'string', 'undefined'));
    });

    it("If rule name is empty, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "": SAMPLE_RAW_CUSTOM_RULE_DEFINITION
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessage('InvalidRuleName', '', 'engines.regex.custom_rules', RULE_NAME_PATTERN.toString()));
    });

    it("If rule name has special character at the beginning, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "1hello": SAMPLE_RAW_CUSTOM_RULE_DEFINITION
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessage('InvalidRuleName', '1hello', 'engines.regex.custom_rules', RULE_NAME_PATTERN.toString()));
    });

    it("If rule name has invalid character after first character, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "rule*": SAMPLE_RAW_CUSTOM_RULE_DEFINITION
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessage('InvalidRuleName', 'rule*', 'engines.regex.custom_rules', RULE_NAME_PATTERN.toString()));
    });

    it("If description is not a string, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    description: 4,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.description', 'string', 'number'));
    });

    it("If description is not defined, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.description', 'string', 'undefined'));
    });

    it("If file_extensions are not a string array, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: ".js"
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.file_extensions', 'array', 'string'));
    });

    it("If file_extensions are not properly formatted, emit appropriate error", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: ["js"]
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustMatchRegExp', 'engines.regex.custom_rules.NoTodos.file_extensions[0]', FILE_EXT_PATTERN.toString()));
    });

    it("If file_extensions are not unique or are upper case, then they are normalized to be unique and lower case", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: [".JS", ".JS", ".tS", ".Js"]
                }
            }
        };
        const engine: RegexEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine;
        expect(engine._getRegexRules()["NoTodos"].file_extensions).toEqual(['.js', '.ts']);
    });

    it("If user creates a rule with a custom violation message, ensure that is maintained in config", async () => {
        const custom_message: string = "I have a custom message";
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    violation_message: custom_message
                }
            }
        };
        const pluginEngine: RegexEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine;
        expect(pluginEngine._getRegexRules()["NoTodos"].violation_message).toStrictEqual(custom_message);
    });

    it("If user creates a rule with a custom severity level, ensure that is maintained in config", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    severity_level: SeverityLevel.Critical
                },
                "OtherRule": {
                    ... SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    severity_level: "Critical"
                }
            }
        };
        const pluginEngine: RegexEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine;
        expect(pluginEngine._getRegexRules()["NoTodos"].severityLevel).toStrictEqual(SeverityLevel.Critical);
        expect(pluginEngine._getRegexRules()["OtherRule"].severityLevel).toStrictEqual(SeverityLevel.Critical);
    });


    it("If user creates a rule with an invalid severity level, ensure correct error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    severity_level: 7
                }
            }
        };
        const severityLevelValues: (string | SeverityLevel)[] = Object.values(SeverityLevel)
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessage('ConfigValueNotAValidSeverityLevel', 'engines.regex.custom_rules.NoTodos.severity_level', JSON.stringify(severityLevelValues), '7'));
    });

    it("If user creates a rule with a custom tags, ensure they are maintained in config", async () => {
        const customTags: string[] = ["RandomTag"]
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    tags: customTags
                }
            }
        };
        const pluginEngine: RegexEngine = await enginePlugin.createEngine("regex", rawConfig) as RegexEngine;
        expect(pluginEngine._getRegexRules()["NoTodos"].tags).toStrictEqual(customTags);
    });

    it("If user creates a rule with tags that are not a string array, ensure correct error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    tags: "RandomTag"
                }
            }
        };
        await expect(enginePlugin.createEngine("regex", rawConfig)).rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.tags', 'array', 'string'));
    });

    type PATTERN_TESTCASE = { input: string, expected: RegExp };
    const patternTestCases: PATTERN_TESTCASE[] = [
        // Raw regex strings
        {input: String.raw`/[a-zA-Z]{2,5}\d?/gi`, expected: new RegExp('[a-zA-Z]{2,5}\\d?', 'gi')},
        {input: String.raw`/\d{1,3}\s?[A-Z]*/g`, expected: new RegExp('\\d{1,3}\\s?[A-Z]*', 'g')},
        {input: String.raw`/[^aeiou]{4,}\W?/gm`, expected: new RegExp('[^aeiou]{4,}\\W?', 'gm')},
        {input: String.raw`/(foo|bar){2,3}\d*/g`, expected: new RegExp('(foo|bar){2,3}\\d*', 'g')},
        {input: String.raw`/\d{2,4}-[a-z]{3,}/g`, expected: new RegExp('\\d{2,4}-[a-z]{3,}', 'g')},
        {input: String.raw`/(cat|dog)?\s+[1-9]/g`, expected: new RegExp('(cat|dog)?\\s+[1-9]', 'g')},
        {input: String.raw`/\w{3,5}\.?\d?/g`, expected: new RegExp('\\w{3,5}\\.?\\d?', 'g')},
        // Quoted "double-escaped" strings
        {input: '/[A-Z]{1,4}@[a-z]{2,4}/g', expected: new RegExp('[A-Z]{1,4}@[a-z]{2,4}', 'g')},
        {input: '/\\d{3,5}[^\\d\\s]/g', expected: new RegExp('\\d{3,5}[^\\d\\s]', 'g')},
        {input: '/[a-zA-Z]+\\d{1,2}/g', expected: new RegExp('[a-zA-Z]+\\d{1,2}', 'g')},
        {input: '/[0-9]{2,}[A-Z]{2,}?/g', expected: new RegExp('[0-9]{2,}[A-Z]{2,}?', 'g')},
        {input: '/[^a-zA-Z0-9]{3,6}/g', expected: new RegExp('[^a-zA-Z0-9]{3,6}', 'g')},
        {input: '/(alpha|beta)\\d{2,4}?/gi', expected: new RegExp('(alpha|beta)\\d{2,4}?', 'gi')},
    ];
    it.each(patternTestCases)('Verify regular expression construction for $input', async (testCase: PATTERN_TESTCASE) => {
        const rawConfig: ConfigObject = {
            custom_rules: {
                SomeRuleName: {
                    regex: testCase.input,
                    description: 'Sample description',
                    file_extensions: ['.js', '.ts']
                }
            }
        };
        const pluginEngine = await enginePlugin.createEngine('regex', rawConfig) as RegexEngine;
        const actual: RegExp = pluginEngine._getRegexRules()['SomeRuleName'].regex;
        expect(actual).toEqual(testCase.expected);
    });
});