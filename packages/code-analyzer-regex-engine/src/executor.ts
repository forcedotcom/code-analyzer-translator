import { Violation } from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";
import path from "node:path";
import os from "node:os"

const APEX_CLASS_FILE_EXT: string = ".cls"

export class RegexExecutor {
    lineSep: string

    constructor() {
        this.lineSep = os.EOL
    }

    async execute(allFiles: string[]): Promise<Violation[]> {
        let violations: Violation[] = []

        for (const file of allFiles) {
            const fileData = fs.statSync(file)
            if (fileData.isFile()) {
                violations = violations.concat(await this.scanFile(file));
            }
        }
        return violations;
    }

    private getColumnNumber(fileContents: string, charIndex: number, newlineIndexes: number[]): number {
        /*TODO: swap out findIndex for a modified binary search implementation */
        const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex)
        const idxOfCurrentLine = idxOfNextNewline === -1 ? newlineIndexes.length - 1: idxOfNextNewline - 1
        const eolOffset = this.lineSep.length - 1
        return charIndex - newlineIndexes.at(idxOfCurrentLine)! - eolOffset
    }

    private getLineNumber(fileContents: string, charIndex: number, newlineIndexes: number[]): number{
        const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex)
        return idxOfNextNewline === -1 ? newlineIndexes.length + 1 : idxOfNextNewline + 1;
    }

    private async scanFile(fileName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        if (path.extname((fileName)) === APEX_CLASS_FILE_EXT) {
            const fileContents: string = fs.readFileSync(fileName, {encoding: 'utf8'})
            const regex: RegExp = /[ \t]+((?=\r?\n)|(?=$))/g;
            const matches = fileContents.matchAll(regex);
            const newlineIndexes = this.getNewlineIndices(fileContents);

            for (const match of matches) {
                const codeLocation = {
                    file: fileName,
                    startLine: this.getLineNumber(fileContents, match.index, newlineIndexes),
                    startColumn: this.getColumnNumber(fileContents, match.index, newlineIndexes),
                    endLine: this.getLineNumber(fileContents,match.index + match[0].length, newlineIndexes),
                    endColumn: this.getColumnNumber(fileContents,match.index + match[0].length, newlineIndexes)
                }
                violations.push({
                    ruleName: "TrailingWhitespaceRule",
                    codeLocations: [codeLocation],
                    primaryLocationIndex: 0,
                    message: "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace."
                });
            }
        }
        return violations;
    }

    private getNewlineIndices(fileContents: string): number[] {
        const newlineRegex: RegExp = new RegExp(this.lineSep, "g")
        const matches = fileContents.matchAll(newlineRegex);
        const newlineIndexes = []

        for (const match of matches) {
            newlineIndexes.push(match.index);
        }
        return newlineIndexes
    }
}