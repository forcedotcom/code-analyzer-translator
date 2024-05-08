import { Rule, SeverityLevel } from "./rules"

export interface CodeLocation {
    getFile(): string
    getStartLine(): number
    getStartColumn(): number
    getEndLine(): number | null
    getEndColumn(): number | null
}

export interface Violation {
    getRule(): Rule,
    getMessage(): string,
    getCodeLocations(): CodeLocation[]
    getPrimaryLocationIndex(): number
}

export interface EngineRunResults {
    getEngineName(): string
    getViolationCountOfSeverity(severity: SeverityLevel): number
    getViolations(): Violation[]
}

export interface OutputFormatter {
    format(results: RunResults): string
}

export interface RunResults {
    getTotalViolationCount(): number
    getViolationCountOfSeverity(severity: SeverityLevel): number
    getAllViolations(): Violation[]
    getViolationsFromEngine(engineName: string): EngineRunResults
    toFormattedOutput(formatter: OutputFormatter): string
}