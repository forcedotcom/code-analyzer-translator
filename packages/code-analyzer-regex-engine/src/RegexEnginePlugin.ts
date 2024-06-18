import * as EngineApi from '@salesforce/code-analyzer-engine-api/';

export class RegexEnginePlugin extends EngineApi.EnginePluginV1 {

    getAvailableEngineNames(): string[] {
        return [RegexEngine.NAME];
    }

    createEngine(engineName: string): EngineApi.Engine {
        if (engineName === RegexEngine.NAME) {
            return new RegexEngine()
        }  else {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }
        
    }

}

export class RegexEngine extends EngineApi.Engine {
    static readonly NAME = "regex"

    constructor() {
        super();
        
    }

    getName(): string {
        return RegexEngine.NAME;
    }

    async describeRules(): Promise<EngineApi.RuleDescription[]> {
        return [
            {
                name: "TrailingWhitespaceRule",
                severityLevel: EngineApi.SeverityLevel.Low,
                type: EngineApi.RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                /* TODO: Add rule description and resourceUrls for trailing whitespace rule*/ 
                description: "",
                resourceUrls: [""]
            },
        ];
    }

    async runRules(ruleNames: string[], runOptions: EngineApi.RunOptions): Promise<EngineApi.EngineRunResults> {
        /* TODO: Update section with logic for implementing trailing whitespace rule*/ 
        return {violations: []};

    }



    
}