import { EnginePlugin } from "@salesforce/code-analyzer-engine-api"
import { RuleSelection } from "./rules"
import { RunResults } from "./results"
import { Event } from "./events"

export type RunOptions = {
    filesToInclude: string[]
    entryPoints?: string[]
}

// Temporarily making this an interface
export interface CodeAnalyzer {
    addEnginePlugin(enginePlugin: EnginePlugin): void

    selectRules(ruleSelectors: string[]): RuleSelection

    run(ruleSelection: RuleSelection, runOptions: RunOptions): RunResults

    onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void
}