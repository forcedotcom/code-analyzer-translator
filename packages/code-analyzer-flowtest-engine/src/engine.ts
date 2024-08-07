import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RunOptions
} from "@salesforce/code-analyzer-engine-api";

export class FlowTestEngine extends Engine {
    public static readonly NAME: string = 'flowtest';

    public getName(): string {
        return FlowTestEngine.NAME;
    }

    public describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        this.emitRunRulesProgressEvent(100);
        return Promise.resolve([]);
    }

    public runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);

        this.emitRunRulesProgressEvent(100);
        return Promise.resolve({
            violations: []
        });
    }
}


