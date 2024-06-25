import { RuleDescription } from "./rules";
import { EngineRunResults } from "./results";
import { Event } from "./events";
import { EventEmitter } from "node:events";

export type DescribeOptions = {
    ruleSelectionId: string
    workspaceFiles: string[]
}

export type PathPoint = {
    file: string
    methodName?: string
}

export type RunOptions = {
    ruleSelectionId: string
    workspaceFiles: string[]
    pathStartPoints?: PathPoint[]
}

export abstract class Engine {
    private readonly eventEmitter: EventEmitter = new EventEmitter();

    abstract getName(): string

    abstract describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]>

    abstract runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults>

    public onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void {
        this.eventEmitter.on(eventType, callback);
    }

    protected emitEvent<T extends Event>(event: T): void {
        this.eventEmitter.emit(event.type, event);
    }
}