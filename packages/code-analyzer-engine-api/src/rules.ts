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
    RECOMMENDED: "Recommended", // Rules that should be enabled to run by default using the default rule selection
    CUSTOM: "Custom", // Rules that do not ship with a particular engine by default but have been added by the user

    CATEGORIES: {
        BEST_PRACTICES: "BestPractices", // Rules that help enforce coding best practices
        CODE_STYLE: "CodeStyle",         // Rules that help enforce a specific coding style
        DESIGN: "Design",                // Rules that help discover issues with code design and implementation
        DOCUMENTATION: "Documentation",  // Rules associated with code documentation
        ERROR_PRONE: "ErrorProne",       // Rules to help avoid possible runtime errors
        SECURITY: "Security",            // Rules to detect possible security vulnerabilities
        PERFORMANCE: "Performance"       // Rules to help detect suboptimal performing code
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