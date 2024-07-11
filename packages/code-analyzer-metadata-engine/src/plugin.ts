import {
    ConfigObject,
    DescribeOptions,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";

export class MetadataEnginePlugin extends EnginePluginV1 {

    getAvailableEngineNames(): string[] {
        return [MetadataEngine.NAME];
    }

    async createEngine(engineName: string, _config: ConfigObject): Promise<Engine> {
        if (engineName !== MetadataEngine.NAME) {
            throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
        }
        return new MetadataEngine()
    }
}

export class MetadataEngine extends Engine {
    static readonly NAME = "metadata"

    getName(): string {
        return MetadataEngine.NAME;
    }

    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        return [
            {
                name: "PrivateMethodAPIVersionRule",
                severityLevel: SeverityLevel.High,
                resourceUrls: [],
                tags: ["Recommended", "Security"],
                type: RuleType.Standard,
                description: getMessage('PrivateMethodApiVersionRuleDescription')
            }
        ];
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        /*TODO: Implement logic for running rules */
        return {
            violations: []
        }
    }
}