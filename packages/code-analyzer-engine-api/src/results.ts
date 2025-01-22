/**
 * Describes the code location details associated with a {@link Violation}
 */
export type CodeLocation = {
    /** The file associated with a violation */
    file: string
    
    /** The start line in the file where the violating code begins */
    startLine: number
    
    /** The column associated with the start line where the violating code begins */
    startColumn: number
    
    /** The end line in the file where the violating code ends */
    endLine?: number
    
    /** The column associated with the end line where the violating code ends */
    endColumn?: number
    
    /** Optional comment to give core context associated with this line or block of code */
    comment?: string
}

/**
 * Describes a violation that an engine found in one or more code locations
 */
export type Violation = {
    /** The name of the rule associated with the violation */
    ruleName: string

    /** The violation message */
    message: string
    
    /** An array of {@link CodeLocation} instances associated with the violation */
    codeLocations: CodeLocation[]

    /** The index of the primary code location within the code locations array */
    primaryLocationIndex: number

    /** An array of urls for resources associated with the violation */
    resourceUrls?: string[]
}

/**
 * Describes the results of an engine's run of rules
 */
export type EngineRunResults = {
    /** The array of {@link Violation} instances for the engine */
    violations: Violation[]
}