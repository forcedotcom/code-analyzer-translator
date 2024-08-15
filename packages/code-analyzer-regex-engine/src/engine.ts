import {
    CodeLocation,
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {RegexRule, RegexRules} from "./config";
import {isBinaryFile} from "isbinaryfile";

const TEXT_BASED_FILE_EXTS = new Set<string>(
    [
        '.cjs', '.cls', '.cmp', '.css', '.csv', '.htm', '.html', '.js', '.json', '.jsx', '.md', '.mdt', '.mjs', '.page',
        '.rtf', '.trigger', '.ts', '.tsx', '.txt', '.xml', '.xsl', '.xslt', '.yaml', '.yml'
    ]
)

export class RegexEngine extends Engine {
    static readonly NAME = "regex";
    readonly regexRules: RegexRules;
    private readonly textFilesCache: Map<string, string[]> = new Map();
    private readonly ruleResourceUrls: Map<string, string[]>;

    constructor(regexRules: RegexRules, ruleResourceUrls: Map<string, string[]>) {
        super();
        this.regexRules = regexRules;
        this.ruleResourceUrls = ruleResourceUrls
    }

    getName(): string {
        return RegexEngine.NAME;
    }

    // For testing purposes only
    _getRegexRules(): RegexRules {
        return this.regexRules
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const textFiles: string[] | undefined = describeOptions.workspace ?
            (await this.getTextFiles(describeOptions.workspace)) : undefined;
        const ruleDescriptions: RuleDescription[] = [];
        for (const [ruleName, regexRule] of Object.entries(this.regexRules)) {
            if (!textFiles || textFiles.some(fileName => this.shouldScanFile(fileName, ruleName))){
                ruleDescriptions.push(this.toRuleDescription(ruleName, regexRule));
            }
        }
        return ruleDescriptions;
    }

    private async getTextFiles(workspace: Workspace): Promise<string[]>{
        const cacheKey: string = workspace.getWorkspaceId();
        if (this.textFilesCache.has(cacheKey)){
            return this.textFilesCache.get(cacheKey)!;
        }
        const fullFileList: string[] = await workspace.getExpandedFiles();
        const workspaceTextFiles: string[] =  await filterAsync(fullFileList, isTextFile);
        this.textFilesCache.set(cacheKey, workspaceTextFiles);
        return workspaceTextFiles;
    }

    private toRuleDescription(ruleName: string, regexRule: RegexRule): RuleDescription {
        return {
            name: ruleName,
            severityLevel: regexRule.severity,
            type: RuleType.Standard,
            tags: regexRule.tags,
            description: regexRule.description,
            resourceUrls: this.ruleResourceUrls.get(ruleName) ?? []
        }
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const textFiles: string[] = await this.getTextFiles(runOptions.workspace);
        const ruleRunPromises: Promise<Violation[]>[] = textFiles.map(file => this.runRulesForFile(file, ruleNames));
        return {
            violations: (await Promise.all(ruleRunPromises)).flat()
        };
    }

    private async runRulesForFile(file: string, ruleNames: string[]): Promise<Violation[]>{
        const rulesToRun: string[] = ruleNames.filter(rule => this.shouldScanFile(file, rule));
        const violationPromises:  Promise<Violation[]>[]  = rulesToRun.map(ruleName => this.scanFile(file, ruleName));
        return (await Promise.all(violationPromises)).flat();
    }

    private shouldScanFile(fileName: string, ruleName: string): boolean {
        const ext: string = path.extname(fileName).toLowerCase();
        const fileExtensions: string[] | undefined = this.regexRules[ruleName].file_extensions;
        return !fileExtensions || fileExtensions.includes(ext);
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
            });
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
        newlineIndexes.push(match.index);
    }
    return newlineIndexes;
}

async function isTextFile(fileName: string): Promise<boolean> {
    const ext: string = path.extname(fileName).toLowerCase();
    return TEXT_BASED_FILE_EXTS.has(ext) || !(await isBinaryFile(fileName));
}

type AsyncFilterFnc<T> = (value: T) => Promise<boolean>;

async function filterAsync<T>(array: T[], filterFcn: AsyncFilterFnc<T>): Promise<T[]> {
    const mask: boolean[] = await Promise.all(array.map(filterFcn));
    return array.filter((_, index) => mask[index]);
}