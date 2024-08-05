import { RuleDescription } from "./rules";
import { EngineRunResults } from "./results";
import {Event, EventType, LogLevel} from "./events";
import { EventEmitter } from "node:events";
import {Workspace} from "./workspace";

export type DescribeOptions = {
    // The workspace may or may not be available. If available then it can be used to give a more accurate list
    // of rules back to the user if the rules are dependent upon what files are in the workspace.
    workspace?: Workspace
}

export type PathPoint = {
    file: string
    methodName?: string
}

export type RunOptions = {
    workspace: Workspace
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

    protected emitLogEvent(logLevel: LogLevel, messages: string): void {
        this.emitEvent({
            type: EventType.LogEvent,
            logLevel: logLevel,
            message: messages
        });
    }

    protected emitDescribeRulesProgressEvent(percentComplete: number): void {
        this.emitEvent({
            type: EventType.DescribeRulesProgressEvent,
            percentComplete: percentComplete
        });
    }

    protected emitRunRulesProgressEvent(percentComplete: number): void {
        this.emitEvent({
            type: EventType.RunRulesProgressEvent,
            percentComplete: percentComplete
        });
    }
}