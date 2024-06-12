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
			{
				name: "VirtualClassSecurityLeakRuleStub",
				severityLevel: EngineApi.SeverityLevel.High,
				type: EngineApi.RuleType.Standard,
				tags: ["Recommended", "Security"],
				description: "Some description for VirtualClassSecurityLeakRuleStub",
				resourceUrls: ["https://example.com/VirtualClassSecurityLeakRuleStub"]
			}
		];
	}

	runRules(ruleNames: string[], runOptions: EngineApi.RunOptions): EngineApi.EngineRunResults {
        /* Update section with logic for implementing trailing whitespace rule*/ 
		this.runRulesCallHistory.push({ruleNames, runOptions});

		ruleNames.forEach( rule => {
			switch (rule) {
				case 'TrailingWhiteSpaceRule':
					const regex = new RegExp('\.cls$');
					runOptions.filesToInclude.forEach(fileName => {
						if (regex.test(fileName)) {
							this.processLineByLine(fileName);
						}




						

					});


			}

		});
		
		return this.resultsToReturn;

	}

	private async processLineByLine(fileName: string) {
		try {
		  const rl = rd.createInterface({
			input: fs.createReadStream(fileName),
			crlfDelay: Infinity
		  });


	  
		  rl.on('line', (line) => {
			const regex = new RegExp('([^ \t\r\n])[ \t]+$');
			if (regex.test(line)) {
				this.emitEvent<EngineApi.LogEvent>({
					type: EngineApi.EventType.LogEvent,
					message: "Trailing whitespace line found in code",
					logLevel: EngineApi.LogLevel.Info
				});
			}
			
		  });
	  
		  await events.once(rl, 'close');
	  
		 
		} catch (err) {
		  console.error(err);
		}
	  };
}

