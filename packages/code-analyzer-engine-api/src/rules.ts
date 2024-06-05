export enum SeverityLevel {
    Critical = 1,
    High = 2,
    Moderate = 3,
    Low = 4,
    Info = 5
}

export enum RuleType {
    Standard = "Standard",
    DataFlow = "DataFlow",
    Flow = "Flow",
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