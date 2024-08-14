import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions
} from "@salesforce/code-analyzer-engine-api";
import {FlowTestConfig} from "./config";

export class FlowTestEngine extends Engine {
    public static readonly NAME: string = 'flowtest';
    private readonly config: FlowTestConfig;

    public constructor(config: FlowTestConfig) {
        super();
        this.config = config;
    }

    public getName(): string {
        return FlowTestEngine.NAME;
    }

    public async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        const pythonCommand: string = this.config.python_command_path;
        this.emitDescribeRulesProgressEvent(10);
        this.emitLogEvent(LogLevel.Info, `Temporary message: Python command identified as ${pythonCommand}`);
        this.emitRunRulesProgressEvent(100);
        return [];
    }

    public async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
        const pythonCommand = this.config.python_command_path;

        this.emitRunRulesProgressEvent(10);
        this.emitLogEvent(LogLevel.Info, `Temporary message: Python command identified as ${pythonCommand}`);
        this.emitRunRulesProgressEvent(100);
        return {
            violations: []
        };
    }
}


