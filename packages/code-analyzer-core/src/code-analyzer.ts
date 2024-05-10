import {RuleImpl, RuleSelection, RuleSelectionImpl} from "./rules"
import {RunResults} from "./results"
import {Event, EventType, LogLevel} from "./events"
import {getMessage} from "./messages";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {EventEmitter} from "node:events";

export type RunOptions = {
    filesToInclude: string[]
    entryPoints?: string[]
}

// Currently we have no configuration abilities implemented. So this is just a placeholder for now.
export class CodeAnalyzerConfig {
    public static withDefaults() {
        return new CodeAnalyzerConfig();
    }

    private constructor() {
    }

    public getEngineSpecificConfig(_engineName: string): engApi.ConfigObject {
        // To be implemented soon
        return {}
    }
}

export class CodeAnalyzer {
    private readonly config: CodeAnalyzerConfig;
    private readonly eventEmitter: EventEmitter = new EventEmitter();
    private readonly engines: Map<string, engApi.Engine> = new Map();

    constructor(config: CodeAnalyzerConfig) {
        this.config = config;
    }

    public addEnginePlugin(enginePlugin: engApi.EnginePlugin): void {
        if (enginePlugin.getApiVersion() > engApi.ENGINE_API_VERSION) {
            this.emitLogEvent(LogLevel.Warn, getMessage('EngineFromFutureApiDetected',
                enginePlugin.getApiVersion(), `"${ enginePlugin.getAvailableEngineNames().join('","') }"`, engApi.ENGINE_API_VERSION))
        }
        const enginePluginV1: engApi.EnginePluginV1 = enginePlugin as engApi.EnginePluginV1;

        for (const engineName of getAvailableEngineNamesFromPlugin(enginePluginV1)) {
            const engConf: engApi.ConfigObject = this.config.getEngineSpecificConfig(engineName);
            const engine: engApi.Engine = createEngineFromPlugin(enginePluginV1, engineName, engConf);
            this.addEngineIfValid(engineName, engine);
        }
    }

    public getEngineNames(): string[] {
        return Array.from(this.engines.keys());
    }

    public selectRules(...selectors: string[]): RuleSelection {
        selectors = selectors.length > 0 ? selectors : ['default'];

        const ruleSelection: RuleSelectionImpl = new RuleSelectionImpl();
        for (const rule of this.getAllRules()) {
            if (selectors.some(s => rule.matchesRuleSelector(s))) {
                ruleSelection.addRule(rule);
            }
        }
        return ruleSelection;
    }

    public run(_ruleSelection: RuleSelection, _runOptions: RunOptions): RunResults {
        throw new Error("not yet implemented");
    }

    public onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void {
        this.eventEmitter.on(eventType, callback);
    }

    private emitEvent<T extends Event>(event: T): void {
        this.eventEmitter.emit(event.type, event);
    }

    private emitLogEvent(logLevel: LogLevel, message: string): void {
        this.emitEvent({
            type: EventType.LogEvent,
            timestamp: new Date(),
            logLevel: logLevel,
            message: message
        })
    }

    private addEngineIfValid(engineName: string, engine: engApi.Engine): void {
        if (this.engines.has(engineName)) {
            this.emitLogEvent(LogLevel.Error, getMessage('DuplicateEngine', engineName));
            return;
        }
        if (engineName != engine.getName()) {
            this.emitLogEvent(LogLevel.Error, getMessage('EngineNameContradiction', engineName, engine.getName()));
            return;
        }
        try {
            engine.validate();
        } catch (err) {
            this.emitLogEvent(LogLevel.Error, getMessage('EngineValidationFailed', engineName, (err as Error).message));
            return;
        }
        this.engines.set(engineName, engine);
        this.emitLogEvent(LogLevel.Debug, getMessage('EngineAdded', engineName));
    }

    private getAllRules(): RuleImpl[] {
        const allRules: RuleImpl[] = [];
        for (const [engineName, engine] of this.engines) {
            for (const ruleDescription of engine.describeRules()) {
                allRules.push(new RuleImpl(engineName, ruleDescription))
            }
        }
        return allRules;
    }
}

function getAvailableEngineNamesFromPlugin(enginePlugin: engApi.EnginePluginV1): string[] {
    try {
        return enginePlugin.getAvailableEngineNames();
    } catch (err) {
        throw new Error(getMessage('PluginErrorFromGetAvailableEngineNames', (err as Error).message), {cause: err})
    }
}

function createEngineFromPlugin(enginePlugin: engApi.EnginePluginV1, engineName: string, config: engApi.ConfigObject) {
    try {
        return enginePlugin.createEngine(engineName, config);
    } catch (err) {
        throw new Error(getMessage('PluginErrorFromCreateEngine', engineName, (err as Error).message), {cause: err})
    }
}