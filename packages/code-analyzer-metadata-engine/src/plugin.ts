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

export class MetadataEnginePlugin extends EnginePluginV1 {

    getAvailableEngineNames(): string[] {
        return [MetadataEngine.NAME];
    }

    async createEngine(engineName: string, _config: ConfigObject): Promise<Engine> {
        if (engineName === MetadataEngine.NAME) {
            return new MetadataEngine()
        }  else {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }
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
                description: "Enforces a minimum API version for declaring private methods in abstract/virtual apex classes."
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