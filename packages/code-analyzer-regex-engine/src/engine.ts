import {
    CodeLocation,
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RunOptions,
    Violation
} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {RegexRules} from "./config";
import {isBinaryFileSync} from "isbinaryfile";

const TEXT_BASED_FILE_EXTS = new Set<string>(
    [
        '.cjs', '.cls', '.cmp', '.css', '.csv', '.htm', '.html', '.js', '.json', '.jsx', '.md', '.mdt', '.mjs', '.page',
        '.rtf', '.trigger', '.ts', '.tsx', '.txt', '.xml', '.xsl', '.xslt', '.yaml', '.yml'
    ]
)

export class RegexEngine extends Engine {
    static readonly NAME = "regex";
    readonly regexRules: RegexRules;

    constructor(regexRules: RegexRules) {
        super();
        this.regexRules = regexRules;
    }

    getName(): string {
        return RegexEngine.NAME;
    }

    // For testing purposes only
    _getRegexRules(): RegexRules {
        return this.regexRules
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        if (!describeOptions.workspace) {
            return Object.values(this.regexRules);
        }

        const fullFileList: string[] = await describeOptions.workspace.getExpandedFiles();
        const ruleDescriptions: RuleDescription[] = [];

        for (const regexRule of Object.values(this.regexRules)) {
            if (fullFileList.some(fileName => this.shouldScanFile(fileName, regexRule.name))){
                ruleDescriptions.push(regexRule);
            }
        }
        return ruleDescriptions;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const fullFileList: string[] = await runOptions.workspace.getExpandedFiles();
        const ruleRunPromises: Promise<Violation[]>[] = fullFileList.map(file => this.runRulesForFile(file, ruleNames));
        return {
            violations: (await Promise.all(ruleRunPromises)).flat()
        };
    }

    private async runRulesForFile(file: string, ruleNames: string[]): Promise<Violation[]>{
        const rulesToRun: string[] = ruleNames.filter(ruleName => this.shouldScanFile(file, ruleName));
        const violationPromises:  Promise<Violation[]>[]  = rulesToRun.map(ruleName => this.scanFile(file, ruleName));
        return (await Promise.all(violationPromises)).flat();
    }

    private shouldScanFile(fileName: string, ruleName: string): boolean {
        const ext: string = path.extname(fileName).toLowerCase();
        return this.regexRules[ruleName].file_extensions ?
            this.regexRules[ruleName].file_extensions.includes(ext) :
            TEXT_BASED_FILE_EXTS.has(ext) || isTextFile(fileName);
    }

    private async scanFile(fileName: string, ruleName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        const fileContents: string = await fs.promises.readFile(fileName, {encoding: 'utf8'});
        const regex: RegExp = this.regexRules[ruleName].regex;
        const newlineIndexes: number[] = getNewlineIndices(fileContents);

        for (const match of fileContents.matchAll(regex)) {
            const startLine: number = getLineNumber(match.index, newlineIndexes);
            const startColumn: number = getColumnNumber(match.index, newlineIndexes);
            const endLine: number = getLineNumber(match.index + match[0].length, newlineIndexes);
            const endColumn: number = getColumnNumber(match.index + match[0].length, newlineIndexes);
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
                message: this.regexRules[ruleName].violation_message
            })
        }
        return violations;
    }
}

function getColumnNumber(charIndex: number, newlineIndexes: number[]): number {
    const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex);
    const idxOfCurrentLine = idxOfNextNewline === -1 ? newlineIndexes.length - 1: idxOfNextNewline - 1;
    if (idxOfCurrentLine === 0){
        return charIndex + 1;
    } else {
        const eolOffset = os.EOL.length - 1;
        return charIndex - newlineIndexes.at(idxOfCurrentLine)! - eolOffset;
    }
}

function getLineNumber(charIndex: number, newlineIndexes: number[]): number{
    const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex);
    return idxOfNextNewline === -1 ? newlineIndexes.length : idxOfNextNewline;
}

function getNewlineIndices(fileContents: string): number[] {
    const newlineRegex: RegExp = new RegExp(os.EOL, "g");
    const matches = fileContents.matchAll(newlineRegex);
    const newlineIndexes = [-1];

    for (const match of matches) {
        newlineIndexes.push(match.index)
    }
    return newlineIndexes;
}

// TODO: Make this async and cache results to improve performance
function isTextFile(fileName: string): boolean {
    return !isBinaryFileSync(fileName);
}