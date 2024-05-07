export enum SeverityLevel {
    High = 1,
    Moderate = 2,
    Low = 3
}

export enum RuleType {
    Standard= "Standard",
    PathBased = "PathBased",
    UnexpectedError = "UnexpectedError"
}

export interface Rule {
    getName(): string
    getEngineName(): string
    getSeverityLevel(): SeverityLevel
    getType(): string
    getTags(): string
    getDescription(): string
    getResourceUrls(): string[]
}

export interface RuleSelection {
    getCount(): number
    getEngineNames(): string[]
    getRulesFor(engineName: string): Rule[]
}