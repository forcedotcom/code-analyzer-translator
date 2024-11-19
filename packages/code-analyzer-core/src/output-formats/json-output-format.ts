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
    primaryLocationIndex?: number
    locations?: JsonCodeLocationOutput[]
    message: string
    resources?: string[]
}

export type JsonCodeLocationOutput = {
    file?: string;
    startLine?: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
    comment?: string;
}

export class JsonOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        const resultsOutput: JsonResultsOutput = toJsonResultsOutput(results);
        return JSON.stringify(resultsOutput, undefined, 2);
    }
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
    return {
        rule: sanitizeFcn(rule.getName()),
        engine: sanitizeFcn(rule.getEngineName()),
        severity: rule.getSeverityLevel(),
        tags: rule.getTags().map(sanitizeFcn),
        primaryLocationIndex: violation.getPrimaryLocationIndex(),
        locations: toJsonCodeLocationOutputArray(violation.getCodeLocations(), runDir),
        message: sanitizeFcn(violation.getMessage()),
        resources: violation.getResourceUrls()
    };
}

function toJsonCodeLocationOutputArray(codeLocations: CodeLocation[], runDir: string): JsonCodeLocationOutput[] {
    return codeLocations.map(loc => toJsonCodeLocationOutput(loc, runDir));
}

function toJsonCodeLocationOutput(codeLocation: CodeLocation, runDir: string): JsonCodeLocationOutput {
    return {
        file:  makeRelativeIfPossible(codeLocation.getFile(), runDir),
        startLine: codeLocation.getStartLine(),
        startColumn: codeLocation.getStartColumn(),
        endLine: codeLocation.getEndLine(),
        endColumn: codeLocation.getEndColumn(),
        comment: codeLocation.getComment()
    }
}

export function makeRelativeIfPossible(file: string|undefined, rootDir: string): string|undefined {
    if (file && file.startsWith(rootDir)) {
        file = file.substring(rootDir.length);
    }
    return file;
}