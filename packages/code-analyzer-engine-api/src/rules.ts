export enum SeverityLevel {
    Critical = 1,
    High = 2,
    Moderate = 3,
    Low = 4,
    Info = 5
}

export enum RuleType {
    // For rules that produce violations where each violation is associated with a single code location.
    Standard= "Standard",

    // For rules that produce violations where each violation is associated with multiple code locations.
    MultiLocation = "MultiLocation",

    // For rules that produce violations where each violation is associated with one or more code locations
    // that make up the code flow path associated with the violation.
    Flow = "Flow",

    // For our UnexpectedEngineErrorRule that we used to surface an error message within a violation.
    UnexpectedError = "UnexpectedError",

    // NOT CURRENTLY USED - IS RESERVED FOR THE SFGE ENGINE RULES THAT PRODUCE PATH-BASED VIOLATIONS
    // The original thinking was that we may need a separate type from "Flow" just in case flow based rules
    // had additional fields than "DataFlow" so that machine processing could determine what fields should be processed.
    // We may instead decide to combing "DataFlow" and "Flow" into 1 type in the near future.
    DataFlow = "DataFlow"
}

export type RuleDescription = {
    name: string,
    severityLevel: SeverityLevel,
    type: RuleType, // TODO: We should consider just moving this to Violation or even CodeLocation (maybe calling it locationType or just type)
    tags: string[],
    description: string,
    resourceUrls: string[]
}