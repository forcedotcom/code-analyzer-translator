import { Violation } from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";
import path from "node:path";

const APEX_CLASS_FILE_EXT: string = ".cls"

export class RegexExecutor {
    newlineIndexes: number[]

    constructor() {
        this.newlineIndexes = [];
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

    private getColumnNumber(fileContents: string, charIndex: number): number {
        /*TODO: swap out findIndex for a modified binary search implementation */
        if (charIndex === 0){
            return 1;
        }

        const idxOfNextNewline = this.newlineIndexes.findIndex(el => el >= charIndex)
        const idxOfCorrectNewline = idxOfNextNewline === -1 ? this.newlineIndexes.length - 1 : idxOfNextNewline - 1
        return charIndex - this.newlineIndexes.at(idxOfCorrectNewline)!
    }

    private getLineNumber(fileContents: string, charIndex: number): number{
        const idxOfNextNewline = this.newlineIndexes.findIndex(el => el >= charIndex)
        return idxOfNextNewline === -1 ? this.newlineIndexes.length + 1 : idxOfNextNewline + 1;
    }

    private async scanFile(fileName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        if (path.extname((fileName)) === APEX_CLASS_FILE_EXT) {
            const fileContents: string = fs.readFileSync(fileName, {encoding: 'utf8'})
            const regex: RegExp = /[ \t]+((?=\r?\n)|(?=$))/g;
            const matches = fileContents.matchAll(regex);
            this.updateNewlineIndices(fileContents);

            for (const match of matches) {
                const codeLocation = {
                    file: fileName,
                    startLine: this.getLineNumber(fileContents, match.index),
                    startColumn: this.getColumnNumber(fileContents, match.index),
                    endLine: this.getLineNumber(fileContents,match.index + match[0].length),
                    endColumn: this.getColumnNumber(fileContents,match.index + match[0].length)
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

    private updateNewlineIndices(fileContents: string): void {
        const newlineRegex: RegExp = /\r?\n/g
        const matches = fileContents.matchAll(newlineRegex);
        this.newlineIndexes = []

        for (const match of matches) {
            this.newlineIndexes.push(match.index);
        }
    }
}