import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions
} from "@salesforce/code-analyzer-engine-api";

export class CpdEngine extends Engine {
    static readonly NAME: string = "cpd";

    getName(): string {
        return CpdEngine.NAME;
    }

    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitLogEvent(LogLevel.Info, `The '${CpdEngine.NAME}' engine has not been implemented yet, so no rules are available.`);
        return [];
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        return {
            violations: []
        };
    }
}

export class PmdEngine extends Engine {
    static readonly NAME: string = "pmd";

    getName(): string {
        return PmdEngine.NAME;
    }

    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitLogEvent(LogLevel.Info, `The '${PmdEngine.NAME}' engine has not been implemented yet, so no rules are available.`);
        return [];
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        return {
            violations: []
        };
    }
}