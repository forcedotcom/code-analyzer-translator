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
import {getMessage} from "./messages";
import os from "node:os";

const APEX_CLASS_FILE_EXT: string = ".cls"

interface Rule {
    regex: RegExp;
    fileExtensions: string[];
    description: string;
}

type RuleMap = Record<string, Rule>;

export class RegexEngine extends Engine {
    static readonly NAME = "regex"
    private readonly regexRules: RuleMap = {
        "NoTrailingWhitespace": {
            regex: /[ \t]+((?=\r?\n)|(?=$))/g,
            fileExtensions: [APEX_CLASS_FILE_EXT],
            description: getMessage('TrailingWhitespaceRuleDescription'),
        }
    };

    getName(): string {
        return RegexEngine.NAME;
    }
    /*TODO: Use describeOptions so that rules not applicable to the workspace aren't returned and rules extracted from a data structure instead of being hardcoded */
    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        return [
            {
                name: "NoTrailingWhitespace",
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: getMessage("TrailingWhitespaceRuleDescription"),
                resourceUrls: []
            }
        ];
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const fullFileList: string[] = await runOptions.workspace.getExpandedFiles();
        const ruleRunPromises: Promise<Violation[]>[] = fullFileList.map(file => this.runRulesForFile(file, ruleNames));
        return {
            violations: (await Promise.all(ruleRunPromises)).flat()
        };
    }

    private async runRulesForFile(file: string, ruleNames: string[]): Promise<Violation[]>{
        const rulesToRun = ruleNames.filter(ruleName => this.shouldScanFile(file, ruleName));
        const violationPromises = rulesToRun.map(ruleName => this.scanFile(file, ruleName));
        const violationsArray = await Promise.all(violationPromises);
        return violationsArray.flat();
    }

    private shouldScanFile(fileName: string, ruleName: string): boolean {
        const ext = path.extname(fileName)
        return this.regexRules[ruleName].fileExtensions.includes(ext)
    }

    private async scanFile(fileName: string, ruleName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        const fileContents: string = await fs.promises.readFile(fileName, {encoding: 'utf8'});
        const regex: RegExp = this.regexRules[ruleName].regex;
        const matches = fileContents.matchAll(regex);
        const newlineIndexes = this.getNewlineIndices(fileContents);

        for (const match of matches) {
            const startLine = this.getLineNumber(match.index, newlineIndexes);
            const startColumn = this.getColumnNumber(match.index, newlineIndexes);
            const endLine = this.getLineNumber(match.index + match[0].length, newlineIndexes);
            const endColumn = this.getColumnNumber(match.index + match[0].length, newlineIndexes);
            const codeLocation = {
                file: fileName,
                startLine: startLine,
                startColumn: startColumn,
                endLine: endLine,
                endColumn: endColumn
            };
            violations.push({
                ruleName: ruleName,
                codeLocations: [codeLocation],
                primaryLocationIndex: 0,
                message: getMessage('RuleViolationMessage', this.regexRules[ruleName].regex.toString(), ruleName, this.regexRules[ruleName].description)
            })
        }
        return violations;
    }

    private getColumnNumber(charIndex: number, newlineIndexes: number[]): number {
        const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex);
        const idxOfCurrentLine = idxOfNextNewline === -1 ? newlineIndexes.length - 1: idxOfNextNewline - 1;
        if (idxOfCurrentLine === 0){
            return charIndex + 1;
        } else {
            const eolOffset = os.EOL.length - 1;
            return charIndex - newlineIndexes.at(idxOfCurrentLine)! - eolOffset;
        }
    }

    private getLineNumber(charIndex: number, newlineIndexes: number[]): number{
        const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex);
        return idxOfNextNewline === -1 ? newlineIndexes.length : idxOfNextNewline;
    }

    private getNewlineIndices(fileContents: string): number[] {
        const newlineRegex: RegExp = new RegExp(os.EOL, "g");
        const matches = fileContents.matchAll(newlineRegex);
        const newlineIndexes = [0];

        for (const match of matches) {
            newlineIndexes.push(match.index)
        }
        return newlineIndexes;
    }
}