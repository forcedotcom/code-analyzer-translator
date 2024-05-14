import * as engApi from "@salesforce/code-analyzer-engine-api"

/**
 * StubEnginePlugin - A plugin stub with preconfigured outputs to help with testing
 */
export class StubEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ["stubEngine1", "stubEngine2"];
    }

    createEngine(engineName: string, _config: engApi.ConfigObject): engApi.Engine {
        if (engineName == "stubEngine1") {
            return new StubEngine1();
        } else if (engineName == "stubEngine2") {
            return new StubEngine2();
        } else {
            throw new Error(`Unsupported engine name: ${engineName}`)
        }
    }
}

/**
 * StubEngine1 - A sample engine stub with preconfigured outputs to help with testing
 */
class StubEngine1 extends engApi.Engine {
    getName(): string {
        return "stubEngine1";
    }

    describeRules(): engApi.RuleDescription[] {
        return [
            {
                name: "stub1RuleA",
                severityLevel: engApi.SeverityLevel.Low,
                type: engApi.RuleType.Standard,
                tags: ["default", "CodeStyle"],
                description: "Some description for stub1RuleA",
                resourceUrls: ["https://example.com/stub1RuleA"]
            },
            {
                name: "stub1RuleB",
                severityLevel: engApi.SeverityLevel.High,
                type: engApi.RuleType.Standard,
                tags: ["default", "Security"],
                description: "Some description for stub1RuleB",
                resourceUrls: ["https://example.com/stub1RuleB"]
            },
            {
                name: "stub1RuleC",
                severityLevel: engApi.SeverityLevel.Moderate,
                type: engApi.RuleType.Standard,
                tags: ["default", "Performance", "Custom"],
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

    runRules(ruleNames: string[], runOptions: engApi.RunOptions): engApi.EngineRunResults {
        return { violations: [] };
    }
}

/**
 * StubEngine2 - A sample engine stub with preconfigured outputs to help with testing
 */
class StubEngine2 extends engApi.Engine {
    getName(): string {
        return "stubEngine2";
    }

    describeRules(): engApi.RuleDescription[] {
        return [
            {
                name: "stub2RuleA",
                severityLevel: engApi.SeverityLevel.Moderate,
                type: engApi.RuleType.PathBased,
                tags: ["default", "Security"],
                description: "Some description for stub2RuleA",
                resourceUrls: ["https://example.com/stub2RuleA"]
            },
            {
                name: "stub2RuleB",
                severityLevel: engApi.SeverityLevel.Low,
                type: engApi.RuleType.PathBased,
                tags: ["Performance", "Custom"],
                description: "Some description for stub2RuleB",
                resourceUrls: ["https://example.com/stub2RuleB"]
            },
            {
                name: "stub2RuleC",
                severityLevel: engApi.SeverityLevel.High,
                type: engApi.RuleType.PathBased,
                tags: ["default", "BestPractice"],
                description: "Some description for stub2RuleC",
                resourceUrls: [] // Purposely putting in nothing here
            }
        ];
    }

    runRules(ruleNames: string[], runOptions: engApi.RunOptions): engApi.EngineRunResults {
        return { violations: [] };
    }
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

    describeRules(): engApi.RuleDescription[] {
        return [];
    }

    runRules(ruleNames: string[], runOptions: engApi.RunOptions): engApi.EngineRunResults {
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

    createEngine(_engineName: string, _config: engApi.ConfigObject): engApi.Engine {
        return new StubEngine2(); // returns "stubEngine2" from its getName method
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
        return new InvalidEngine(); // returns "stubEngine2" from its getName method
    }
}

/**
 * InvalidEngine - A plugin that returns an engine that fails the validate() check
 */
class InvalidEngine extends engApi.Engine {
    validate(): void {
        throw new Error('SomeErrorMessageFromValidate');
    }

    getName(): string {
        return "invalidEngine";
    }

    describeRules(): engApi.RuleDescription[] {
        return [];
    }

    runRules(ruleNames: string[], runOptions: engApi.RunOptions): engApi.EngineRunResults {
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