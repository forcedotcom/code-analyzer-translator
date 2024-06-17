import {
    ConfigObject,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    ProgressEvent,
    RuleDescription,
    RunOptions,
} from "../src";

describe('Tests for v1', () => {
    it('EnginePluginV1 getApiVersion should return 1.0', () => {
        const dummyPlugin: EnginePluginV1 = new DummyEnginePluginV1();
        expect(dummyPlugin.getApiVersion()).toEqual(1.0);
    });

    it('Engine onEvent should receive events correctly from emitEvent', async () => {
        const dummyPlugin: EnginePluginV1 = new DummyEnginePluginV1();
        const dummyEngine: Engine = dummyPlugin.createEngine('dummy', {});
        await dummyEngine.validate(); // Calling simply for code coverage

        const logEvents: LogEvent[] = [];
        dummyEngine.onEvent(EventType.LogEvent, (event: LogEvent): void => {
            logEvents.push(event);
        });
        const progressEvents: ProgressEvent[] = [];
        dummyEngine.onEvent(EventType.ProgressEvent, (event: ProgressEvent): void => {
            progressEvents.push(event);
        });

        await dummyEngine.runRules(["dummy"], {
            workspaceFiles: ["some/file"]
        });

        expect(logEvents).toHaveLength(1);
        expect(logEvents[0]).toEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Info,
            message: "Hello World"
        });

        expect(progressEvents).toHaveLength(2);
        expect(progressEvents[0]).toEqual({
            type: EventType.ProgressEvent,
            percentComplete: 5.0
        });
        expect(progressEvents[1]).toEqual({
            type: EventType.ProgressEvent,
            percentComplete: 100.0
        });
    });
});


export class DummyEnginePluginV1 extends EnginePluginV1 {
    createEngine(engineName: string, config: ConfigObject): Engine {
        return new DummyEngineV1();
    }

    getAvailableEngineNames(): string[] {
        return ["dummy"];
    }
}

class DummyEngineV1 extends Engine {
    async describeRules(): Promise<RuleDescription[]> {
        return [];
    }

    getName(): string {
        return "dummy"
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitEvent({
            type: EventType.ProgressEvent,
            percentComplete: 5.0
        });
        this.emitEvent({
            type: EventType.LogEvent,
            logLevel: LogLevel.Info,
            message: "Hello World"
        });
        this.emitEvent({
            type: EventType.ProgressEvent,
            percentComplete: 100.0
        });
        return {
            violations: []
        };
    }
}