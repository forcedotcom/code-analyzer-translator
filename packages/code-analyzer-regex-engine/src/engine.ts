import {
    CodeLocation,
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
import os from "node:os";
import {RegexEngineConfig} from "./config";

const DEFAULT_TAGS: string[] = ["Recommended", "CodeStyle"]
const DEFAULT_RULE_TYPE: RuleType = RuleType.Standard
const DEFAULT_SEVERITY_LEVEL: SeverityLevel = SeverityLevel.Low
const DEFAULT_RESOURCE_URLS: string[] = []

export class RegexEngine extends Engine {
    static readonly NAME = "regex";
    readonly config: RegexEngineConfig;

    constructor(config: RegexEngineConfig) {
        super();
        this.config = config;
    }

    getName(): string {
        return RegexEngine.NAME;
    }

    getConfig(){
        return this.config
    }

    private hasIntersection<T>(list1: T[], list2: T[]): boolean {
        const set1 = new Set(list1);
        for (const item of list2) {
            if (set1.has(item)) {
                return true;
            }
        }
        return false;
    }

    private toRuleDescription(ruleName: string): RuleDescription {
        return {
            name: ruleName,
            severityLevel: DEFAULT_SEVERITY_LEVEL,
            type: DEFAULT_RULE_TYPE,
            description: this.config.rules[ruleName].description,
            tags: DEFAULT_TAGS,
            resourceUrls: DEFAULT_RESOURCE_URLS
        }
    }

    private getUniqueFileExtensions(files: string[]): string[] {
        return files.reduce((acc: string[], file: string) => {
            const extension = path.extname(file);
            if (!acc.includes(extension)) {
                acc.push(extension);
            }
            return acc;
        }, []);
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        if (!describeOptions.workspace) {
            return Object.keys(this.config.rules).map(ruleName => this.toRuleDescription(ruleName));
        }

        const fullFileList = await describeOptions.workspace.getExpandedFiles();
        const uniqueFileExtensions = this.getUniqueFileExtensions(fullFileList);

        return Object.entries(this.config.rules).reduce((acc: RuleDescription[], [ruleName, rule]) => {
            if (this.hasIntersection(uniqueFileExtensions, rule.file_extensions)) {
                acc.push(this.toRuleDescription(ruleName));
            }
            return acc;
        }, []);
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
        return this.config.rules[ruleName].file_extensions.includes(ext)
    }

    private async scanFile(fileName: string, ruleName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        const fileContents: string = await fs.promises.readFile(fileName, {encoding: 'utf8'});
        const regex: RegExp = this.config.rules[ruleName].regex;
        const matches = fileContents.matchAll(regex);
        const newlineIndexes = this.getNewlineIndices(fileContents);

        for (const match of matches) {
            const startLine = this.getLineNumber(match.index, newlineIndexes);
            const startColumn = this.getColumnNumber(match.index, newlineIndexes);
            const endLine = this.getLineNumber(match.index + match[0].length, newlineIndexes);
            const endColumn = this.getColumnNumber(match.index + match[0].length, newlineIndexes);
            const codeLocation: CodeLocation = {
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
                message: this.config.rules[ruleName].violation_message
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