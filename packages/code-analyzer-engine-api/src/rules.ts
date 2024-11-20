export enum SeverityLevel {
    Critical = 1,
    High = 2,
    Moderate = 3,
    Low = 4,
    Info = 5
}

export type RuleDescription = {
    name: string,
    severityLevel: SeverityLevel,
    tags: string[],
    description: string,
    resourceUrls: string[]
}