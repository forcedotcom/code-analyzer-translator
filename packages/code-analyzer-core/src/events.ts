import { EngineRunResults } from "./results"

export enum EventType {
    LogEvent = "LogEvent",
    EngineLogEvent = "EngineLogEvent",
    EngineProgressEvent = "EngineProgressEvent",
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

export type EngineLogEvent = {
    type: EventType.EngineLogEvent,
    timestamp: Date,
    engineName: string
    logLevel: LogLevel,
    message: string
}

export type EngineProgressEvent = {
    type: EventType.EngineProgressEvent,
    timestamp: Date,
    engineName: string,
    percentComplete: number
}

export type EngineResultsEvent = {
    type: EventType.EngineResultsEvent
    timestamp: Date,
    results: EngineRunResults
}

export type Event = LogEvent | EngineLogEvent | EngineProgressEvent | EngineResultsEvent;