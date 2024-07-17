import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation
} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import fs from "node:fs";
import {getColumnNumber, getLineNumber, getNewlineIndices} from "./utils";
import {getMessage} from "./messages";
import {RuleMap} from "./rule";

const APEX_CLASS_FILE_EXT: string = ".cls"

export class RegexEngine extends Engine {
    static readonly NAME = "regex"
    private regexRules: RuleMap = {};

    /*TODO: swap hardcoding of rule for addRules() method that processes a config file*/
    constructor() {
        super();
        this.regexRules = {
            "TrailingWhitespaceRule": {
                regex: /[ \t]+((?=\r?\n)|(?=$))/g,
                fileExtensions: [APEX_CLASS_FILE_EXT],
                description: getMessage('TrailingWhitespaceRuleDescription'),
                message: getMessage('TrailingWhitespaceRuleDescription')
            }
        }
    }

    getName(): string {
        return RegexEngine.NAME;
    }

    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        return [
            {
                name: "TrailingWhitespaceRule",
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.",
                resourceUrls: []
            }
        ];
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const fullFileList: string[] = await runOptions.workspace.getExpandedFiles();
        const violations: Violation[] = [];

        const filePromises = fullFileList.map(async (file) => {
            const rulesToRun = ruleNames.filter(rule => this.shouldScanFile(file, rule));
            const violationPromises = rulesToRun.map(async (rule) => await this.scanFile(file, rule));
            violations.push(...(await Promise.all(violationPromises)).flat());
        });

        await Promise.all(filePromises);

        return {
            violations: violations
        };
    }

    private shouldScanFile(fileName: string, ruleName: string): boolean {
        const ext = path.extname(fileName)
        return this.regexRules[ruleName].fileExtensions.includes(ext)
    }

    private async scanFile(fileName: string, ruleName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        const fileContents: string = await fs.promises.readFile(fileName, {encoding: 'utf8'})
        const regex: RegExp = this.regexRules[ruleName].regex;
        const matches = fileContents.matchAll(regex);
        const newlineIndexes = getNewlineIndices(fileContents);

        for (const match of matches) {
            const codeLocation = {
                file: fileName,
                startLine: getLineNumber(match.index, newlineIndexes),
                startColumn: getColumnNumber(match.index, newlineIndexes),
                endLine: getLineNumber(match.index + match[0].length, newlineIndexes),
                endColumn: getColumnNumber(match.index + match[0].length, newlineIndexes)
            }
            violations.push({
                ruleName: ruleName,
                codeLocations: [codeLocation],
                primaryLocationIndex: 0,
                message: this.regexRules[ruleName].message
            });
        }
        return violations;
    }
}