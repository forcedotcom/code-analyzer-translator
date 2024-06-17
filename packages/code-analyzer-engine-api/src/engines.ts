import { RuleDescription } from "./rules";
import { EngineRunResults } from "./results";
import { Event } from "./events";
import { EventEmitter } from "node:events";

export type PathPoint = {
    file: string
    methodName?: string
}

export type RunOptions = {
    workspaceFiles: string[]
    pathStartPoints?: PathPoint[]
}

export abstract class Engine {
    private readonly eventEmitter: EventEmitter = new EventEmitter();

    public async validate(): Promise<void> {}

    abstract getName(): string

    abstract describeRules(): Promise<RuleDescription[]>

    abstract runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults>

    public onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void {
        this.eventEmitter.on(eventType, callback);
    }

    protected emitEvent<T extends Event>(event: T): void {
        this.eventEmitter.emit(event.type, event);
    }
}