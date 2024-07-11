import { EngineRunResults } from "./results"

export enum EventType {
    LogEvent = "LogEvent",
    RuleSelectionProgressEvent = "RuleSelectionProgressEvent",
    EngineLogEvent = "EngineLogEvent",
    EngineRunProgressEvent = "EngineRunProgressEvent",
    EngineResultsEvent = "EngineResultsEvent"
}

export enum LogLevel {
    Error = 1,
    Warn = 2,
    Info = 3,
    Debug = 4,
    Fine = 5
}

export type LogEvent = {
    type: EventType.LogEvent,
    timestamp: Date,
    logLevel: LogLevel,
    message: string
}

export type RuleSelectionProgressEvent = {
    type: EventType.RuleSelectionProgressEvent,
    timestamp: Date,
    percentComplete: number
}

export type EngineLogEvent = {
    type: EventType.EngineLogEvent,
    timestamp: Date,
    engineName: string
    logLevel: LogLevel,
    message: string
}

export type EngineRunProgressEvent = {
    type: EventType.EngineRunProgressEvent,
    timestamp: Date,
    engineName: string,
    percentComplete: number
}

export type EngineResultsEvent = {
    type: EventType.EngineResultsEvent
    timestamp: Date,
    results: EngineRunResults
}

export type Event = LogEvent | RuleSelectionProgressEvent | EngineLogEvent | EngineRunProgressEvent | EngineResultsEvent;