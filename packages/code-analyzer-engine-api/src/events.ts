export enum EventType {
    LogEvent = "LogEvent",
    RunRulesProgressEvent = "RunRulesProgressEvent",
    DescribeRulesProgressEvent = "DescribeRulesProgressEvent"
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

export type RunRulesProgressEvent = {
    type: EventType.RunRulesProgressEvent,
    percentComplete: number
}

export type DescribeRulesProgressEvent = {
    type: EventType.DescribeRulesProgressEvent,
    percentComplete: number
}

export type Event = LogEvent | RunRulesProgressEvent | DescribeRulesProgressEvent;