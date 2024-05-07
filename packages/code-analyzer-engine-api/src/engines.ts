import { RuleDescription } from "./rules";
import { EngineRunResults } from "./results";
import { Event } from "./events";
import { EventEmitter } from "node:events";

export type EntryPoint = {
    file: string
    methodName?: string
}

export type RunOptions = {
    filesToInclude: string[]
    entryPoints?: EntryPoint[]
}

export abstract class Engine {
    private readonly eventEmitter: EventEmitter = new EventEmitter();

    public validate(): void {}

    abstract getName(): string

    abstract describeRules(): RuleDescription[]

    abstract runRules(ruleNames: string[], runOptions: RunOptions): EngineRunResults

    public onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void {
        this.eventEmitter.on(eventType, callback);
    }

    protected emitEvent<T extends Event>(event: T): void {
        this.eventEmitter.emit(event.type, event);
    }
}