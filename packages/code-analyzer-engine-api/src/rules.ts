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

export const COMMON_TAGS = {
    RECOMMENDED: "Recommended",

    CATEGORIES: {
        BEST_PRACTICES: "BestPractices",
        CODE_STYLE: "CodeStyle",
        DESIGN: "Design",
        DOCUMENTATION: "Documentation",
        ERROR_PRONE: "ErrorProne",
        SECURITY: "Security",
        PERFORMANCE: "Performance"
    },

    LANGUAGES: {
        APEX: "Apex",
        HTML: "Html",
        JAVASCRIPT: "Javascript",
        TYPESCRIPT: "Typescript",
        VISUALFORCE: "Visualforce",
        XML: "Xml"
    }
}