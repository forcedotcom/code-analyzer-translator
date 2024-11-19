import {CodeLocation, RunResults, Violation} from "../results";
import {OutputFormatter} from "../output-format";
import {Rule, SeverityLevel} from "../rules";

export type JsonResultsOutput = {
    runDir: string
    violationCounts: {
        total: number
        sev1: number
        sev2: number
        sev3: number
        sev4: number
        sev5: number
    }
    violations: JsonViolationOutput[]
}

export type JsonViolationOutput = {
    rule: string
    engine: string
    severity: number
    tags: string[]
    file?: string
    line?: number
    column?: number
    endLine?: number
    endColumn?: number
    primaryLocationIndex?: number
    locations?: JsonCodeLocationOutput[]
    message: string
    resources?: string[]
}

export class JsonCodeLocationOutput {
    private readonly file?: string;
    private readonly line?: number;
    private readonly column?: number;
    private readonly endLine?: number;
    private readonly endColumn?: number;
    private readonly comment?: string;

    public constructor(codeLocation: CodeLocation, runDir: string) {
        this.file = codeLocation.getFile() ? makeRelativeIfPossible(codeLocation.getFile()!, runDir) : /* istanbul ignore next */ undefined;
        this.line = codeLocation.getStartLine();
        this.column = codeLocation.getStartColumn();
        this.endLine = codeLocation.getEndLine();
        this.endColumn = codeLocation.getEndColumn();
        this.comment = codeLocation.getComment();
    }

    public getFile(): string | undefined {
        return this.file;
    }

    public getLine(): number | undefined {
        return this.line;
    }

    public getColumn(): number | undefined {
        return this.column;
    }

    public getEndLine(): number | undefined {
        return this.endLine;
    }

    public getEndColumn(): number | undefined {
        return this.endColumn;
    }

    public getComment(): string | undefined {
        return this.comment;
    }

    public toString(): string {
        let locationString: string = '';
        if (this.file != null) {
            locationString += this.file;
            if (this.line != null) {
                locationString += `:${this.line}`;
                if (this.column != null) {
                    locationString += `:${this.column}`;
                }
            }
        }
        if (this.comment != null) {
            locationString += ` (${this.comment})`;
        }
        return locationString;
    }
}

export class JsonOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        const resultsOutput: JsonResultsOutput = toJsonResultsOutput(results);
        return JSON.stringify(resultsOutput, undefined, 2);
    }
}

function makeRelativeIfPossible(file: string, rootDir: string): string {
    if (file.startsWith(rootDir)) {
        file = file.substring(rootDir.length);
    }
    return file;
}

export function toJsonResultsOutput(results: RunResults, sanitizeFcn: (text: string) => string = t => t): JsonResultsOutput {
    return {
        runDir: results.getRunDirectory(),
        violationCounts: {
            total: results.getViolationCount(),
            sev1: results.getViolationCountOfSeverity(SeverityLevel.Critical),
            sev2: results.getViolationCountOfSeverity(SeverityLevel.High),
            sev3: results.getViolationCountOfSeverity(SeverityLevel.Moderate),
            sev4: results.getViolationCountOfSeverity(SeverityLevel.Low),
            sev5: results.getViolationCountOfSeverity(SeverityLevel.Info),
        },
        violations: toJsonViolationOutputArray(results.getViolations(), results.getRunDirectory(), sanitizeFcn)
    };
}

export function toJsonViolationOutputArray(violations: Violation[], runDir: string, sanitizeFcn: (text: string) => string = t => t): JsonViolationOutput[] {
    return violations.map(v => toJsonViolationOutput(v, runDir, sanitizeFcn));
}

function toJsonViolationOutput(violation: Violation, runDir: string, sanitizeFcn: (text: string) => string): JsonViolationOutput {
    const rule: Rule = violation.getRule();
    const codeLocations: CodeLocation[] = violation.getCodeLocations();
    const primaryLocation: CodeLocation = codeLocations[violation.getPrimaryLocationIndex()];

    return {
        rule: sanitizeFcn(rule.getName()),
        engine: sanitizeFcn(rule.getEngineName()),
        severity: rule.getSeverityLevel(),
        tags: rule.getTags().map(sanitizeFcn),
        file: primaryLocation.getFile() ? makeRelativeIfPossible(primaryLocation.getFile() as string, runDir) : undefined,
        line: primaryLocation.getStartLine(),
        column: primaryLocation.getStartColumn(),
        endLine: primaryLocation.getEndLine(),
        endColumn: primaryLocation.getEndColumn(),
        primaryLocationIndex: violation.getPrimaryLocationIndex(),
        locations: toJsonCodeLocationOutputArray(codeLocations, runDir),
        message: sanitizeFcn(violation.getMessage()),
        resources: violation.getResourceUrls()
    };
}

function toJsonCodeLocationOutputArray(codeLocations: CodeLocation[], runDir: string): JsonCodeLocationOutput[] {
    return codeLocations.map(loc => {
        return new JsonCodeLocationOutput(loc, runDir);
    })
}