import * as engApi from "@salesforce/code-analyzer-engine-api"
import {
    ConfigObject,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions
} from "@salesforce/code-analyzer-engine-api"

/**
 * StubEnginePlugin - A plugin stub with preconfigured outputs to help with testing
 */
export class StubEnginePlugin extends engApi.EnginePluginV1 {
    private readonly createdEngines: Map<string, engApi.Engine> = new Map();

    getAvailableEngineNames(): string[] {
        return ["stubEngine1", "stubEngine2"];
    }

    createEngine(engineName: string, config: engApi.ConfigObject): engApi.Engine {
        if (engineName == "stubEngine1") {
            this.createdEngines.set(engineName, new StubEngine1(config));
        } else if (engineName == "stubEngine2") {
            this.createdEngines.set(engineName, new StubEngine2(config));
        } else {
            throw new Error(`Unsupported engine name: ${engineName}`)
        }
        return this.getCreatedEngine(engineName);
    }

    getCreatedEngine(engineName: string): engApi.Engine {
        if (this.createdEngines.has(engineName)) {
            return this.createdEngines.get(engineName) as engApi.Engine;
        }
        throw new Error(`Engine with name ${engineName} has not yet been created`);
    }
}

/**
 * StubEngine1 - A sample engine stub with preconfigured outputs to help with testing
 */
export class StubEngine1 extends engApi.Engine {
    readonly config: engApi.ConfigObject;
    readonly runRulesCallHistory: {ruleNames: string[], runOptions: engApi.RunOptions}[] = [];
    resultsToReturn: engApi.EngineRunResults = { violations: [] }

    constructor(config: engApi.ConfigObject) {
        super();
        this.config = config;
    }

    getName(): string {
        return "stubEngine1";
    }

    async describeRules(): Promise<engApi.RuleDescription[]> {
        return [
            {
                name: "stub1RuleA",
                severityLevel: engApi.SeverityLevel.Low,
                type: engApi.RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: "Some description for stub1RuleA",
                resourceUrls: ["https://example.com/stub1RuleA"]
            },
            {
                name: "stub1RuleB",
                severityLevel: engApi.SeverityLevel.High,
                type: engApi.RuleType.Standard,
                tags: ["Recommended", "Security"],
                description: "Some description for stub1RuleB",
                resourceUrls: ["https://example.com/stub1RuleB"]
            },
            {
                name: "stub1RuleC",
                severityLevel: engApi.SeverityLevel.Moderate,
                type: engApi.RuleType.Standard,
                tags: ["Recommended", "Performance", "Custom"],
                description: "Some description for stub1RuleC",
                resourceUrls: ["https://example.com/stub1RuleC"]
            },
            {
                name: "stub1RuleD",
                severityLevel: engApi.SeverityLevel.Low,
                type: engApi.RuleType.Standard,
                tags: ["CodeStyle"],
                description: "Some description for stub1RuleD",
                resourceUrls: ["https://example.com/stub1RuleD"]
            },
            {
                name: "stub1RuleE",
                severityLevel: engApi.SeverityLevel.Moderate,
                type: engApi.RuleType.Standard,
                tags: ["Performance"],
                description: "Some description for stub1RuleE",
                resourceUrls: ["https://example.com/stub1RuleE", "https://example.com/stub1RuleE_2"]
            }
        ];
    }

    async runRules(ruleNames: string[], runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        this.runRulesCallHistory.push({ruleNames, runOptions});
        this.emitEvent<engApi.ProgressEvent>({
            type: engApi.EventType.ProgressEvent,
            percentComplete: 0
        });
        this.emitEvent<engApi.LogEvent>({
            type: engApi.EventType.LogEvent,
            message: "someMiscFineMessageFromStubEngine1",
            logLevel: LogLevel.Fine
        });
        this.emitEvent<engApi.ProgressEvent>({
            type: engApi.EventType.ProgressEvent,
            percentComplete: 50
        });
        this.emitEvent<engApi.ProgressEvent>({
            type: engApi.EventType.ProgressEvent,
            percentComplete: 100
        });
        return this.resultsToReturn;
    }
}

// Used to test dynamic import loading of an engine plugin
export function createEnginePlugin(): engApi.EnginePlugin {
    return new StubEnginePlugin();
}

/**
 * StubEngine2 - A sample engine stub with preconfigured outputs to help with testing
 */
export class StubEngine2 extends engApi.Engine {
    readonly config: engApi.ConfigObject;
    readonly runRulesCallHistory: {ruleNames: string[], runOptions: engApi.RunOptions}[] = [];
    resultsToReturn: engApi.EngineRunResults = { violations: [] }

    constructor(config: engApi.ConfigObject) {
        super();
        this.config = config;
    }

    getName(): string {
        return "stubEngine2";
    }

    async describeRules(): Promise<engApi.RuleDescription[]> {
        return [
            {
                name: "stub2RuleA",
                severityLevel: engApi.SeverityLevel.Moderate,
                type: engApi.RuleType.DataFlow,
                tags: ["Recommended", "Security"],
                description: "Some description for stub2RuleA",
                resourceUrls: ["https://example.com/stub2RuleA"]
            },
            {
                name: "stub2RuleB",
                severityLevel: engApi.SeverityLevel.Low,
                type: engApi.RuleType.DataFlow,
                tags: ["Performance", "Custom"],
                description: "Some description for stub2RuleB",
                resourceUrls: ["https://example.com/stub2RuleB"]
            },
            {
                name: "stub2RuleC",
                severityLevel: engApi.SeverityLevel.High,
                type: engApi.RuleType.DataFlow,
                tags: ["Recommended", "BestPractice"],
                description: "Some description for stub2RuleC",
                resourceUrls: [] // Purposely putting in nothing here
            }
        ];
    }

    async runRules(ruleNames: string[], runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        this.runRulesCallHistory.push({ruleNames, runOptions});
        this.emitEvent<engApi.LogEvent>({
            type: engApi.EventType.LogEvent,
            message: "someMiscInfoMessageFromStubEngine2",
            logLevel: LogLevel.Info
        });
        this.emitEvent<engApi.ProgressEvent>({
            type: engApi.EventType.ProgressEvent,
            percentComplete: 5
        });
        this.emitEvent<engApi.ProgressEvent>({
            type: engApi.EventType.ProgressEvent,
            percentComplete: 63
        });
        return this.resultsToReturn;
    }
}


export function getSampleViolationForStub1RuleA(): engApi.Violation {
    return {
        ruleName: 'stub1RuleA',
        message: 'SomeViolationMessage1',
        codeLocations: [
            {
                file: 'test/config.test.ts',
                startLine: 3,
                startColumn: 6,
                endLine: 11,
                endColumn: 8
            }
        ],
        primaryLocationIndex: 0,
        resourceUrls: [
            "https://example.com/stub1RuleA" // Same url as rule's url... to test that we don't duplicate it
        ]
    };
}

export function getSampleViolationForStub1RuleC(): engApi.Violation {
    return {
        ruleName: 'stub1RuleC',
        message: 'SomeViolationMessage2',
        codeLocations: [
            {
                file: 'test/run.test.ts',
                startLine: 21,
                startColumn: 7,
                endLine: 25,
                endColumn: 4
            }
        ],
        primaryLocationIndex: 0,
        resourceUrls: [
            "https://example.com/aViolationSpecificUrl1", // starting with "aViolation" so that we can test that this url comes after the rule url even though alphabetically it comes first
            "https://example.com/violationSpecificUrl2",
        ]
    };
}

export function getSampleViolationForStub1RuleE(): engApi.Violation {
    return {
        ruleName: 'stub1RuleE',
        message: 'Some Violation that contains\na new line in `it` and "various" \'quotes\'. Also it has <brackets> that may need to be {escaped}.',
        codeLocations: [
            {
                file: 'test/run.test.ts',
                startLine: 56,
                startColumn: 4
            }
        ],
        primaryLocationIndex: 0
    };
}

export function getSampleViolationForStub2RuleC(): engApi.Violation {
    return {
        ruleName: 'stub2RuleC',
        message: 'SomeViolationMessage3',
        codeLocations: [
            {
                file: 'test/stubs.ts',
                startLine: 4,
                startColumn: 13
            },
            {
                file: 'test/test-helpers.ts',
                startLine: 9,
                startColumn: 1
            },
            {
                file: 'test/stubs.ts',
                startLine: 76,
                startColumn: 8
            }
        ],
        primaryLocationIndex: 2
    };
}


/**
 * FutureEnginePlugin - A plugin to help with testing forward compatibility
 */
export class FutureEnginePlugin extends engApi.EnginePluginV1 {
    public getApiVersion(): number {
        return 99.0; // Simulate a version from the future
    }

    getAvailableEngineNames(): string[] {
        return ["future"];
    }

    createEngine(_engineName: string, _config: engApi.ConfigObject): engApi.Engine {
        return new FutureEngine();
    }
}

/**
 * FutureEngine - An engine to help with testing forward compatibility
 */
class FutureEngine extends engApi.Engine {
    getName(): string {
        return "future";
    }

    async describeRules(): Promise<engApi.RuleDescription[]> {
        return [];
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return { violations: [] };
    }
}

/**
 * ContradictingEnginePlugin - A plugin that returns an engine with a name that contradicts the one requested
 */
export class ContradictingEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ["stubEngine1"];
    }

    createEngine(_engineName: string, config: engApi.ConfigObject): engApi.Engine {
        return new StubEngine2(config); // returns "stubEngine1" from its getName method - thus the contradiction
    }
}

/**
 * InvalidEnginePlugin - A plugin that returns an engine that fails the validate() check
 */
export class InvalidEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ["invalidEngine"];
    }

    createEngine(_engineName: string, _config: engApi.ConfigObject): engApi.Engine {
        return new InvalidEngine();
    }
}

/**
 * InvalidEngine - A plugin that returns an engine that fails the validate() check
 */
class InvalidEngine extends engApi.Engine {
    async validate(): Promise<void> {
        throw new Error('SomeErrorMessageFromValidate');
    }

    getName(): string {
        return "invalidEngine";
    }

    async describeRules(): Promise<engApi.RuleDescription[]> {
        return [];
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return { violations: [] };
    }
}

/**
 * ThrowingPlugin1 - A plugin that throws an exception during a call to getAvailableEngineNames
 */
export class ThrowingPlugin1 extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        throw new Error('SomeErrorFromGetAvailableEngineNames');
    }

    createEngine(_engineName: string, _config: engApi.ConfigObject): engApi.Engine {
        throw new Error('Should not be called');
    }
}

/**
 * ThrowingPlugin2 - A plugin that throws an exception during a call to createEngine
 */
export class ThrowingPlugin2 extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['someEngine'];
    }

    createEngine(_engineName: string, _config: engApi.ConfigObject): engApi.Engine {
        throw new Error('SomeErrorFromCreateEngine');
    }
}

/**
 * ThrowingEnginePlugin - A plugin that returns an engine that throws an error when ran
 */
export class ThrowingEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['throwingEngine'];
    }

    createEngine(_engineName: string, config: engApi.ConfigObject): engApi.Engine {
        return new ThrowingEngine(config);
    }
}

/**
 * ThrowingEngine - An engine that throws an error when ran
 */
class ThrowingEngine extends StubEngine1 {
    constructor(config: engApi.ConfigObject) {
        super(config);
    }

    getName(): string {
        return "throwingEngine";
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        throw new Error('SomeErrorMessageFromThrowingEngine');
    }
}

/**
 * RepeatedRuleNameEnginePlugin - A plugin that returns an engine that returns multiple rules with the same name
 */
export class RepeatedRuleNameEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['repeatedRuleNameEngine'];
    }

    createEngine(_engineName: string, _config: ConfigObject): Engine {
        return new RepeatedRuleNameEngine();
    }
}

/**
 * RepeatedRuleNameEngine - An engine that returns multiple rules with the same name
 */
class RepeatedRuleNameEngine extends engApi.Engine {
    getName(): string {
        return 'repeatedRuleNameEngine';
    }

    async describeRules(): Promise<RuleDescription[]> {
        return [
            {
                name: "repeatedRule",
                severityLevel: engApi.SeverityLevel.Moderate,
                type: engApi.RuleType.DataFlow,
                tags: ["Recommended", "Security"],
                description: "Some description 1",
                resourceUrls: ["https://example.com/repeatedRule1"]
            },
            {
                name: "repeatedRule", // Same name as above
                severityLevel: engApi.SeverityLevel.Low,
                type: engApi.RuleType.Standard,
                tags: ["Performance", "Custom"],
                description: "Some description 2",
                resourceUrls: ["https://example.com/repeatedRule2"]
            }
        ];
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        return { violations: [] };
    }
}