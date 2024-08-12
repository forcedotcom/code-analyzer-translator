import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions
} from "@salesforce/code-analyzer-engine-api";
import {FlowTestConfig} from "./config";
import {PythonVersionIdentifier} from "./lib/python-versioning/PythonVersionIdentifier";
import {PythonVersionManager} from "./lib/python-versioning/PythonVersionManager";

export type FlowTestEngineDependencies = {
    pythonVersionIdentifier: PythonVersionIdentifier
};

export class FlowTestEngine extends Engine {
    public static readonly NAME: string = 'flowtest';
    private readonly config: FlowTestConfig;
    private readonly pythonVersionManager: PythonVersionManager;

    public constructor(config: FlowTestConfig, dependencies: FlowTestEngineDependencies) {
        super();
        this.config = config;
        const emitLogEventFunction = (l: LogLevel, m: string) => this.emitLogEvent(l, m);
        this.pythonVersionManager = new PythonVersionManager(dependencies.pythonVersionIdentifier, emitLogEventFunction);
    }

    public getName(): string {
        return FlowTestEngine.NAME;
    }

    public async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        const pythonCommand = await this.pythonVersionManager.getPythonCommand(this.config);
        this.emitDescribeRulesProgressEvent(10);
        this.emitLogEvent(LogLevel.Info, `Temporary message: Python command identified as ${pythonCommand}`);
        this.emitRunRulesProgressEvent(100);
        return [];
    }

    public async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
        const pythonCommand = await this.pythonVersionManager.getPythonCommand(this.config);

        this.emitRunRulesProgressEvent(10);
        this.emitLogEvent(LogLevel.Info, `Temporary message: Python command identified as ${pythonCommand}`);

        this.emitRunRulesProgressEvent(100);
        return {
            violations: []
        };
    }
}


