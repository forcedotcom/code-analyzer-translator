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

export type RuleDescription = {
    name: string,
    severityLevel: SeverityLevel,
    type: RuleType,
    tags: string[],
    description: string,
    resourceUrls: string[]
}