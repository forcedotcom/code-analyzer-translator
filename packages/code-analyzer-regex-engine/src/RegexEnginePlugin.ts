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
    Violation
} from "@salesforce/code-analyzer-engine-api";
import { RegexExecutor } from './executor';

export class RegexEnginePlugin extends EnginePluginV1 {

    getAvailableEngineNames(): string[] {
        return [RegexEngine.NAME];
    }

    async createEngine(engineName: string, _config: ConfigObject): Promise<Engine> {
        if (engineName === RegexEngine.NAME) {
            return new RegexEngine()
        }  else {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }
    }
}

export class RegexEngine extends Engine {
    static readonly NAME = "regex"

    getName(): string {
        return RegexEngine.NAME;
    }

    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        return [
            {
                name: "TrailingWhitespaceRule",
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.",
                resourceUrls: []
            },
        ];
    }

    async runRules(_ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const executor = new RegexExecutor()
        const fullFileList: string[] = await runOptions.workspace.getExpandedFiles()
        const violations: Violation[] = await executor.execute(fullFileList)
        return {
            violations: violations
        };
    }
}