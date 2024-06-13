import * as EngineApi from '@salesforce/code-analyzer-engine-api';
import fs from "node:fs";
import rd from 'readline'
import events from 'events'

export class RegexEnginePlugin extends EngineApi.EnginePluginV1 {
	private readonly createdEngines: Map<string, EngineApi.Engine> = new Map();

	getAvailableEngineNames(): string[] {
		return ['RegexEngine'];
	}

	createEngine(engineName: string, config: EngineApi.ConfigObject): EngineApi.Engine {
		if (engineName === 'RegexEngine') {
			this.createdEngines.set(engineName, new RegexEngine(config));
		}  else {
			throw new Error(`Unsupported engine name: ${engineName}`);
		}
		return this.getCreatedEngine(engineName);
	}

	getCreatedEngine(engineName: string): EngineApi.Engine {
		if (this.createdEngines.has(engineName)) {
			return this.createdEngines.get(engineName) as EngineApi.Engine;
		}
		throw new Error(`Engine with name ${engineName} has not yet been created`);
	}
}

export class RegexEngine extends EngineApi.Engine {
	readonly config: EngineApi.ConfigObject;
	readonly runRulesCallHistory: {ruleNames: string[], runOptions: EngineApi.RunOptions}[] = [];
	resultsToReturn: EngineApi.EngineRunResults = {
		violations: []
	};

	constructor(config: EngineApi.ConfigObject) {
		super();
		this.config = config;
	}

	getName(): string {
		return 'RegexEngine';
	}

	describeRules(): EngineApi.RuleDescription[] {
		return [
			{
				name: "TrailingWhitespaceRule",
				severityLevel: EngineApi.SeverityLevel.Low,
				type: EngineApi.RuleType.Standard,
				tags: ["Recommended", "CodeStyle"],
				description: "Some description for TrailingWhiteSpaceRuleStub",
				resourceUrls: ["https://example.com/TrailingWhiteSpaceRuleStub"]
			},
		];
	}

	runRules(ruleNames: string[], runOptions: EngineApi.RunOptions): EngineApi.EngineRunResults {
        /* Update section with logic for implementing trailing whitespace rule*/ 
		return this.resultsToReturn;

	}



	
}

