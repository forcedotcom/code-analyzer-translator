import { Violation, CodeLocation } from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";
import path from "node:path";

const APEX_CLASS_FILE_EXT: string = ".cls"

export class RegexExecutor {

    async execute(allFiles: string[]): Promise<Violation[]>{
        let violations: Violation[] = []

        for (const file of allFiles) {
            const fileData = fs.statSync(file)
            if (fileData.isFile()) {
                violations = violations.concat(await this.scanFile(file));
            }  
        }
        
        return violations;
    }

    private async scanFile(fileName: string): Promise<Violation[]> {
        const fileType: string = path.extname(fileName)
        const violations: Violation[] = fileType === APEX_CLASS_FILE_EXT ? await this.getViolations(fileName) : [];

        return violations;
    }

    private async getViolations(fileName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        const fileContents: string = fs.readFileSync(fileName, {encoding: 'utf8'})
        const regex: RegExp = /\s+(?:\n|(?=$))/g;
        let codeLocation: CodeLocation;
        let violation: Violation
        let match: RegExpExecArray | null


        while ((match = regex.exec(fileContents))) {
            console.log(JSON.stringify(match, null, 2))
            codeLocation = this.getViolationCodeLocation(fileName, fileContents.slice(0, match.index + 1))
            violation = {
                ruleName: "Trailing Whitespace", 
                codeLocations: [codeLocation],
                primaryLocationIndex: 0,
                message: "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace."
            }
            violations.push(violation)
        }

        return violations;
    }

    private getViolationCodeLocation(fileName: string, fileContent: string): CodeLocation{
        const newlineRegex: RegExp = /\r?\n/g
        const splitContent: string[] = fileContent.split(newlineRegex)
        let lineNum: number;
        let colNum: number;

        if (splitContent.length > 0) {
            lineNum = splitContent.length;
            const lastLine: string = splitContent.at(-1) as string
            colNum = lastLine.length
        } else {
            lineNum = 1
            colNum = fileContent.length
        }

        const codeLocation: CodeLocation = {
            file: fileName,
            startLine: lineNum,
            startColumn: colNum,
        }
        
        return codeLocation
 
    }
}