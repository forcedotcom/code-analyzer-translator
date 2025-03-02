import { RuleDescription } from "./rules";
import { EngineRunResults } from "./results";
import {Event, EventType, LogLevel} from "./events";
import { EventEmitter } from "node:events";
import {Workspace} from "./workspace";

/**
 * Options available to the {@link Engine.describeRules} method
 */
export type DescribeOptions = {
    /**
     * The absolute path where additional log files should be stored by engines when describing rules.
     *     Note that engines should use the emitLogEvent method as a primary means of logging into the main Code
     *     Analyzer log file, and should only use this log folder if additional log files need to be created. If files
     *     are written to this folder, then we recommend that engines specify that the file was created by logging its
     *     full path into the main log with the emitLogEvent method.
     */
    logFolder: string

    /**
     * The workspace may or may not be available. If available, then engines should use this workspace object to give a
     * more accurate list of which of the engine's rules are relevant to the files in the workspace. That is
     * if there are rules for this engine that are simply not applicable to the files available, then the rule
     * descriptions for those rules should not be returned in the output of the {@link Engine.describeRules} method.
     */
    workspace?: Workspace
}

/**
 * Options available to the {@link Engine.runRules} method
 */
export type RunOptions = {
    /**
     * The absolute path where additional log files should be stored by engines when running rules.
     *     Note that engines should use the emitLogEvent method as a primary means of logging into the main Code
     *     Analyzer log file, and should only use this log folder if additional log files need to be created. If files
     *     are written to this folder, then we recommend that engines specify that the file was created by logging its
     *     full path into the main log with the emitLogEvent method.
     */
    logFolder: string

    /**
     * The workspace object specifying the files that the engine's rules should run against.
     */
    workspace: Workspace

    /**
     * If the implementing engine has path based rules, then the engine can decide to reduce the number of paths to
     * analyze if the user has provided a list of path start points here. Note that users may not always supply this
     * option and so engines that want to leverage it must use it conditionally based on whether it is defined.
     */
    pathStartPoints?: PathPoint[]
}

/**
 * The point in a path to analyze - used for path-based engines/rules only.
 */
export type PathPoint = {
    /** The file associated with a path to analyze */
    file: string

    /** The method name associated with a path to analyze */
    methodName?: string
}

/**
 * Abstract class that all engines must extend from in order to be possibly added to Code Analyzer.
 */
export abstract class Engine {
    private readonly eventEmitter: EventEmitter = new EventEmitter();

    /**
     * Returns the name of the engine
     */
    abstract getName(): string

    /**
     * Returns an array of {@link RuleDescription} instances that describe the engine's rules available for selection
     * @param describeOptions {@link DescribeOptions} instance
     */
    abstract describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]>

    /**
     * Runs a specific list of rules on a specified workspace and returns {@link EngineRunResults}
     * @param ruleNames the names of the rules to run
     * @param runOptions {@link RunOptions} instance containing the workspace to run rules against
     */
    abstract runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults>

    /**
     * Returns the version of the engine
     * It is recommended that subclasses implement this method to return a semantic version string of X.Y.Z format
     */
    abstract getEngineVersion(): Promise<string>;

    /**
     * Attach a listener callback to one of the events that the engine may directly emit
     *   NOTE: We recommend clients do not listen to events directly from the engine, but instead use the onEvent
     *   method that is available on the CodeAnalyzer class to receive more rich events with additional information.
     * @param eventType The {@link EventType} that you would like to add a callback for
     * @param callback The callback function that should be invoked when an associated event is emitted
     */
    public onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void {
        this.eventEmitter.on(eventType, callback);
    }

    /**
     * Method that subclasses can use to emit any {@link Event}.
     * @param event the {@link Event} instance
     * @protected
     */
    protected emitEvent<T extends Event>(event: T): void {
        this.eventEmitter.emit(event.type, event);
    }

    /**
     * Convenience method that subclasses can use to easily emit an event of type {@link LogEvent}
     * @param logLevel the log level to associate to the message
     * @param messages the log message
     * @protected
     */
    protected emitLogEvent(logLevel: LogLevel, messages: string): void {
        this.emitEvent({
            type: EventType.LogEvent,
            logLevel: logLevel,
            message: messages
        });
    }

    /**
     * Convenience method that subclasses can use to easily emit an event of type {@link DescribeRulesProgressEvent}
     * @param percentComplete the percent of completion between 0 and 100
     * @protected
     */
    protected emitDescribeRulesProgressEvent(percentComplete: number): void {
        this.emitEvent({
            type: EventType.DescribeRulesProgressEvent,
            percentComplete: roundToHundredths(percentComplete)
        });
    }

    /**
     * Convenience method that subclasses can use to easily emit an event of type {@link RunRulesProgressEvent}
     * @param percentComplete the percent of completion between 0 and 100
     * @protected
     */
    protected emitRunRulesProgressEvent(percentComplete: number): void {
        this.emitEvent({
            type: EventType.RunRulesProgressEvent,
            percentComplete: roundToHundredths(percentComplete)
        });
    }
}

export function roundToHundredths(num: number): number {
    return Math.round(num * 100) / 100;
}