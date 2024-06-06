export type CodeLocation = {
    file: string
    startLine: number
    startColumn: number
    endLine?: number
    endColumn?: number
}

export type Violation = {
    ruleName: string
    message: string
    codeLocations: CodeLocation[]
    primaryLocationIndex: number
    resourceUrls?: string[]
}

export type EngineRunResults = {
    violations: Violation[]
}