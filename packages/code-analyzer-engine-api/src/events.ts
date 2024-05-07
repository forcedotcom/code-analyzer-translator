export enum EventType {
    LogEvent = "LogEvent",
    ProgressEvent = "ProgressEvent"
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
    logLevel: LogLevel,
    message: string
}

export type ProgressEvent = {
    type: EventType.ProgressEvent,
    percentComplete: number
}

export type Event = LogEvent | ProgressEvent;