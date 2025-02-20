import {
    ConfigObject,
    ConfigValueExtractor,
    DescribeOptions,
    DescribeRulesProgressEvent,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    RunOptions,
    RunRulesProgressEvent,
    Workspace
} from "../src";
import * as os from "node:os";

describe('Tests for v1', () => {
    it('EnginePluginV1 getApiVersion should return 1.0', () => {
        const dummyPlugin: EnginePluginV1 = new DummyEnginePluginV1();
        expect(dummyPlugin.getApiVersion()).toEqual(1.0);
    });

    it("EnginePluginV1's default's implementation of describeEngineConfig should return empty ConfigDescription object", () => {
        const dummyPlugin: EnginePluginV1 = new DummyEnginePluginV1();
        expect(dummyPlugin.describeEngineConfig('dummy')).toEqual({});
    });

    it("EnginePluginV1's default's implementation of createEngineConfig should return just return the unresolved overrides", async () => {
        const dummyPlugin: EnginePluginV1 = new DummyEnginePluginV1();
        expect(await dummyPlugin.createEngineConfig('dummy', new ConfigValueExtractor({a: 1}, 'engines.dummy', __dirname))).toEqual({a: 1});
    });

    it('Engine onEvent should receive events correctly from emitEvent', async () => {
        const dummyPlugin: EnginePluginV1 = new DummyEnginePluginV1();
        const dummyEngine: Engine = await dummyPlugin.createEngine('dummy', {});

        const logEvents: LogEvent[] = [];
        dummyEngine.onEvent(EventType.LogEvent, (event: LogEvent): void => {
            logEvents.push(event);
        });
        const describeRulesProgressEvents: DescribeRulesProgressEvent[] = [];
        dummyEngine.onEvent(EventType.DescribeRulesProgressEvent, (event: DescribeRulesProgressEvent): void => {
            describeRulesProgressEvents.push(event);
        });
        const runRulesProgressEvents: RunRulesProgressEvent[] = [];
        dummyEngine.onEvent(EventType.RunRulesProgressEvent, (event: RunRulesProgressEvent): void => {
            runRulesProgressEvents.push(event);
        });

        const workspace: Workspace = new Workspace([]);
        await dummyEngine.describeRules({workspace: workspace, logFolder: os.tmpdir()});
        await dummyEngine.runRules(["dummy"], {workspace: workspace, logFolder: os.tmpdir()});

        expect(logEvents).toHaveLength(2);
        expect(logEvents[0]).toEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: "describeRules called"
        });
        expect(logEvents[1]).toEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Fine,
            message: "runRules called"
        });

        expect(describeRulesProgressEvents).toHaveLength(2);
        expect(describeRulesProgressEvents).toHaveLength(2);
        expect(describeRulesProgressEvents[0]).toEqual({
            type: EventType.DescribeRulesProgressEvent,
            percentComplete: 30
        });
        expect(describeRulesProgressEvents[1]).toEqual({
            type: EventType.DescribeRulesProgressEvent,
            percentComplete: 99
        });

        expect(runRulesProgressEvents).toHaveLength(2);
        expect(runRulesProgressEvents[0]).toEqual({
            type: EventType.RunRulesProgressEvent,
            percentComplete: 5.0
        });
        expect(runRulesProgressEvents[1]).toEqual({
            type: EventType.RunRulesProgressEvent,
            percentComplete: 100.0
        });
    });
});


export class DummyEnginePluginV1 extends EnginePluginV1 {
    async createEngine(_engineName: string, _config: ConfigObject): Promise<Engine> {
        return new DummyEngineV1();
    }

    getAvailableEngineNames(): string[] {
        return ["dummy"];
    }
}

class DummyEngineV1 extends Engine {
    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(30);
        this.emitLogEvent(LogLevel.Debug, "describeRules called");
        this.emitDescribeRulesProgressEvent(99);
        return [];
    }

    getName(): string {
        return "dummy"
    }

    public getEngineVersion(): Promise<string> {
        return Promise.resolve('0.0.1');
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(5.0);
        this.emitLogEvent(LogLevel.Fine, "runRules called");
        this.emitRunRulesProgressEvent(100.0);
        return {
            violations: []
        };
    }
}