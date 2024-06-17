import {RuleImpl, RuleSelection, RuleSelectionImpl} from "./rules"
import {
    EngineRunResults,
    EngineRunResultsImpl,
    RunResults,
    RunResultsImpl,
    UnexpectedErrorEngineRunResults
} from "./results"
import {EngineLogEvent, EngineProgressEvent, EngineResultsEvent, Event, EventType, LogLevel} from "./events"
import {getMessage} from "./messages";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {EventEmitter} from "node:events";
import {CodeAnalyzerConfig, FIELDS, RuleOverride} from "./config";
import {Clock, RealClock, toAbsolutePath} from "./utils";
import fs from "node:fs";
import path from "node:path";

export type RunOptions = {
    workspaceFiles: string[]
    pathStartPoints?: string[]
}

export class CodeAnalyzer {
    private readonly config: CodeAnalyzerConfig;
    private clock: Clock = new RealClock();
    private readonly eventEmitter: EventEmitter = new EventEmitter();
    private readonly engines: Map<string, engApi.Engine> = new Map();
    private readonly allRules: RuleImpl[] = [];

    constructor(config: CodeAnalyzerConfig) {
        this.config = config;
    }

    // For testing purposes only
    setClock(clock: Clock) {
        this.clock = clock;
    }

    public async addEnginePlugin(enginePlugin: engApi.EnginePlugin): Promise<void> {
        if (enginePlugin.getApiVersion() > engApi.ENGINE_API_VERSION) {
            this.emitLogEvent(LogLevel.Warn, getMessage('EngineFromFutureApiDetected',
                enginePlugin.getApiVersion(), `"${ enginePlugin.getAvailableEngineNames().join('","') }"`, engApi.ENGINE_API_VERSION))
        }
        const enginePluginV1: engApi.EnginePluginV1 = enginePlugin as engApi.EnginePluginV1;

        for (const engineName of getAvailableEngineNamesFromPlugin(enginePluginV1)) {
            const engConf: engApi.ConfigObject = this.config.getEngineConfigFor(engineName);
            const engine: engApi.Engine = createEngineFromPlugin(enginePluginV1, engineName, engConf);
            await this.addEngineIfValid(engineName, engine);

            const ruleDescriptions: engApi.RuleDescription[] = await engine.describeRules();
            validateRuleDescriptions(ruleDescriptions, engineName);
            for (let ruleDescription of ruleDescriptions) {
                ruleDescription = this.updateRuleDescriptionWithOverrides(engineName, ruleDescription);
                this.allRules.push(new RuleImpl(engineName, ruleDescription))
            }
        }
    }

    // This method should be called from the client with an absolute path to the module if it isn't available globally.
    // Basically, clients should call this method after resolving the module using require.resolve. For example:
    //     codeAnalyzer.dynamicallyAddEnginePlugin(require.resolve('./someRelativePluginModule'));
    public async dynamicallyAddEnginePlugin(enginePluginModulePath: string): Promise<void> {
        let pluginModule;
        try {
            enginePluginModulePath = require.resolve(enginePluginModulePath);
            pluginModule = (await import(enginePluginModulePath));
        } catch (err) {
            throw new Error(getMessage('FailedToDynamicallyLoadModule', enginePluginModulePath, (err as Error).message), {cause: err});
        }

        if (typeof pluginModule.createEnginePlugin !== 'function') {
            throw new Error(getMessage('FailedToDynamicallyAddEnginePlugin', enginePluginModulePath));
        }
        const enginePlugin: engApi.EnginePlugin = pluginModule.createEnginePlugin();
        await this.addEnginePlugin(enginePlugin);
    }

    public getEngineNames(): string[] {
        return Array.from(this.engines.keys());
    }

    public selectRules(...selectors: string[]): RuleSelection {
        selectors = selectors.length > 0 ? selectors : ['Recommended'];

        const ruleSelection: RuleSelectionImpl = new RuleSelectionImpl();
        for (const rule of this.allRules) {
            if (selectors.some(s => rule.matchesRuleSelector(s))) {
                ruleSelection.addRule(rule);
            }
        }
        return ruleSelection;
    }

    public async run(ruleSelection: RuleSelection, runOptions: RunOptions): Promise<RunResults> {
        const engineRunOptions: engApi.RunOptions = extractEngineRunOptions(runOptions);
        this.emitLogEvent(LogLevel.Debug, getMessage('RunningWithRunOptions', JSON.stringify(engineRunOptions)));

        const runResults: RunResultsImpl = new RunResultsImpl();
        for (const engineName of ruleSelection.getEngineNames()) {
            this.emitEvent<EngineProgressEvent>({
                type: EventType.EngineProgressEvent, timestamp: this.clock.now(), engineName: engineName, percentComplete: 0
            });

            const engineRunResults: EngineRunResults = await this.runEngineAndValidateResults(engineName, ruleSelection, engineRunOptions);
            runResults.addEngineRunResults(engineRunResults);

            this.emitEvent<EngineProgressEvent>({
                type: EventType.EngineProgressEvent, timestamp: this.clock.now(), engineName: engineName, percentComplete: 100
            });
            this.emitEvent<EngineResultsEvent>({
                type: EventType.EngineResultsEvent, timestamp: this.clock.now(), results: engineRunResults
            });
        }

        return runResults;
    }

    public onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void {
        this.eventEmitter.on(eventType, callback);
    }

    private async runEngineAndValidateResults(engineName: string, ruleSelection: RuleSelection, engineRunOptions: engApi.RunOptions): Promise<EngineRunResults> {
        const rulesToRun: string[] = ruleSelection.getRulesFor(engineName).map(r => r.getName());
        this.emitLogEvent(LogLevel.Debug, getMessage('RunningEngineWithRules', engineName, JSON.stringify(rulesToRun)));
        const engine: engApi.Engine = this.getEngine(engineName);

        let apiEngineRunResults: engApi.EngineRunResults;
        try {
            apiEngineRunResults = await engine.runRules(rulesToRun, engineRunOptions);
        } catch (error) {
            return new UnexpectedErrorEngineRunResults(engineName, error as Error);
        }

        validateEngineRunResults(engineName, apiEngineRunResults, ruleSelection);
        return new EngineRunResultsImpl(engineName, apiEngineRunResults, ruleSelection);
    }

    private emitEvent<T extends Event>(event: T): void {
        this.eventEmitter.emit(event.type, event);
    }

    private emitLogEvent(logLevel: LogLevel, message: string): void {
        this.emitEvent({
            type: EventType.LogEvent,
            timestamp: this.clock.now(),
            logLevel: logLevel,
            message: message
        })
    }

    private async addEngineIfValid(engineName: string, engine: engApi.Engine): Promise<void> {
        if (this.engines.has(engineName)) {
            this.emitLogEvent(LogLevel.Error, getMessage('DuplicateEngine', engineName));
            return;
        }
        if (engineName != engine.getName()) {
            this.emitLogEvent(LogLevel.Error, getMessage('EngineNameContradiction', engineName, engine.getName()));
            return;
        }
        try {
            await engine.validate();
        } catch (err) {
            this.emitLogEvent(LogLevel.Error, getMessage('EngineValidationFailed', engineName, (err as Error).message));
            return;
        }
        this.engines.set(engineName, engine);
        this.emitLogEvent(LogLevel.Debug, getMessage('EngineAdded', engineName));
        this.listenToEngineEvents(engine);
    }

    private listenToEngineEvents(engine: engApi.Engine) {
        engine.onEvent(engApi.EventType.LogEvent, (event: engApi.LogEvent) => {
            this.emitEvent<EngineLogEvent>({
                type: EventType.EngineLogEvent,
                timestamp: this.clock.now(),
                engineName: engine.getName(),
                logLevel: event.logLevel,
                message: event.message
            });
        });

        engine.onEvent(engApi.EventType.ProgressEvent, (event: engApi.ProgressEvent) => {
            this.emitEvent<EngineProgressEvent>({
                type: EventType.EngineProgressEvent,
                timestamp: this.clock.now(),
                engineName: engine.getName(),
                percentComplete: event.percentComplete
            });
        });
    }

    private updateRuleDescriptionWithOverrides(engineName: string, ruleDescription: engApi.RuleDescription): engApi.RuleDescription {
        const ruleOverride: RuleOverride = this.config.getRuleOverrideFor(engineName, ruleDescription.name);
        if (ruleOverride.severity) {
            this.emitLogEvent(LogLevel.Debug, getMessage('RulePropertyOverridden', FIELDS.SEVERITY,
                ruleDescription.name, engineName, ruleDescription.severityLevel, ruleOverride.severity));
            ruleDescription.severityLevel = ruleOverride.severity;
        }
        if (ruleOverride.tags) {
            this.emitLogEvent(LogLevel.Debug, getMessage('RulePropertyOverridden', FIELDS.TAGS,
                ruleDescription.name, engineName, JSON.stringify(ruleDescription.tags), JSON.stringify(ruleOverride.tags)));
            ruleDescription.tags = ruleOverride.tags;
        }
        return ruleDescription;
    }

    private getEngine(engineName: string): engApi.Engine {
        // This line should never return undefined, so we are safe to directly cast to engApi.Engine
        return this.engines.get(engineName) as engApi.Engine;
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

function validateRuleDescriptions(ruleDescriptions: engApi.RuleDescription[], engineName: string): void {
    const ruleNamesSeen: Set<string> = new Set();
    for (const ruleDescription of ruleDescriptions) {
        if (ruleNamesSeen.has(ruleDescription.name)) {
            throw new Error(getMessage('EngineReturnedMultipleRulesWithSameName', engineName, ruleDescription.name));
        }
        ruleNamesSeen.add(ruleDescription.name);
    }
}

function extractEngineRunOptions(runOptions: RunOptions): engApi.RunOptions {
    if(!runOptions.workspaceFiles || runOptions.workspaceFiles.length == 0) {
        throw new Error(getMessage('AtLeastOneFileOrFolderMustBeIncluded'));
    }
    const engineRunOptions: engApi.RunOptions = {
        workspaceFiles: removeRedundantPaths(runOptions.workspaceFiles.map(validateFileOrFolder))
    };

    if (runOptions.pathStartPoints && runOptions.pathStartPoints.length > 0) {
        engineRunOptions.pathStartPoints = runOptions.pathStartPoints.flatMap(extractEnginePathStartPoints)
    }
    validatePathStartPointsAreInsideWorkspace(engineRunOptions);
    return engineRunOptions;
}

function removeRedundantPaths(absolutePaths: string[]): string[] {
    // If a user supplies a parent folder and subfolder of file underneath the parent folder, then we can safely
    // remove that subfolder or file. Also, if we find duplicate entries, we remove those as well.
    const pathsSortedByLength: string[] = absolutePaths.sort((a, b) => a.length - b.length);
    const filteredPaths: string[] = [];
    for (const currentPath of pathsSortedByLength) {
        const isAlreadyContained = filteredPaths.some(existingPath =>
            currentPath.startsWith(existingPath + path.sep) || existingPath === currentPath
        );
        if (!isAlreadyContained) {
            filteredPaths.push(currentPath);
        }
    }
    return filteredPaths.sort(); // sort alphabetically
}

function validateFileOrFolder(fileOrFolder: string): string {
    const absFileOrFolder: string = toAbsolutePath(fileOrFolder);
    if (!fs.existsSync(fileOrFolder)) {
        throw new Error(getMessage('FileOrFolderDoesNotExist', absFileOrFolder));
    }
    return absFileOrFolder;
}

function validatePathStartPointFile(file: string, pathStartPointStr: string): string {
    const absFile: string = toAbsolutePath(file);
    if (!fs.existsSync(absFile)) {
        throw new Error(getMessage('PathStartPointFileDoesNotExist', pathStartPointStr, absFile));
    } else if (fs.statSync(absFile).isDirectory()) {
        throw new Error(getMessage('PathStartPointWithMethodMustNotBeFolder', pathStartPointStr, absFile));
    }
    return absFile;
}

function extractEnginePathStartPoints(pathStartPointStr: string): engApi.PathPoint[] {
    const parts: string[] = pathStartPointStr.split('#');
    if (parts.length == 1) {
        return [{
            file: validateFileOrFolder(pathStartPointStr)
        }];
    } else if (parts.length > 2) {
        throw new Error(getMessage('InvalidPathStartPoint', pathStartPointStr));
    }

    const pathStartPointFile: string = validatePathStartPointFile(parts[0], pathStartPointStr);
    const VALID_METHOD_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]*$/;
    const TRAILING_SPACES_AND_SEMICOLONS_REGEX = /\s+;*$/;
    const methodNames: string = parts[1].replace(TRAILING_SPACES_AND_SEMICOLONS_REGEX, '');
    return methodNames.split(";").map(methodName => {
        if (! VALID_METHOD_NAME_REGEX.test(methodName) ) {
            throw new Error(getMessage('InvalidPathStartPoint', pathStartPointStr));
        }
        return { file: pathStartPointFile, methodName: methodName };
    });
}

function validatePathStartPointsAreInsideWorkspace(engineRunOptions: engApi.RunOptions) {
    if (!engineRunOptions.pathStartPoints) {
        return;
    }
    for (const enginePathStartPoint of engineRunOptions.pathStartPoints) {
        if (!fileIsUnderneath(enginePathStartPoint.file, engineRunOptions.workspaceFiles)) {
            throw new Error(getMessage('PathStartPointMustBeInsideWorkspace', enginePathStartPoint.file,
                JSON.stringify(engineRunOptions.workspaceFiles)));
        }
    }
}

function fileIsUnderneath(file: string, filesOrFolders: string[]): boolean {
    return filesOrFolders.some(fileOrFolder => fileOrFolder == file ||
        (fs.statSync(fileOrFolder).isDirectory() && file.startsWith(fileOrFolder)));
}

function validateEngineRunResults(engineName: string, apiEngineRunResults: engApi.EngineRunResults, ruleSelection: RuleSelection): void {
    for (const violation of apiEngineRunResults.violations) {
        validateViolationRuleName(violation, engineName, ruleSelection);
        validateViolationPrimaryLocationIndex(violation, engineName);
        validateViolationCodeLocations(violation, engineName);
    }
}

function validateViolationRuleName(violation: engApi.Violation, engineName: string, ruleSelection: RuleSelection) {
    try {
        ruleSelection.getRule(engineName, violation.ruleName);
    } catch (error) {
        throw new Error(getMessage('EngineReturnedViolationForUnselectedRule', engineName, violation.ruleName), {cause: error});
    }
}

function validateViolationPrimaryLocationIndex(violation: engApi.Violation, engineName: string) {
    if (!isIntegerBetween(violation.primaryLocationIndex, 0, violation.codeLocations.length-1)) {
        throw new Error(getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex',
            engineName, violation.ruleName, violation.primaryLocationIndex, violation.codeLocations.length));
    }
}

function validateViolationCodeLocations(violation: engApi.Violation, engineName: string) {
    for (const codeLocation of violation.codeLocations) {
        const absFile: string = toAbsolutePath(codeLocation.file);
        fs.existsSync(absFile)

        if (!fs.existsSync(absFile)) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationFileThatDoesNotExist',
                engineName, violation.ruleName, absFile));
        }

        if (!fs.statSync(absFile).isFile()) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationFileAsFolder',
                engineName, violation.ruleName, absFile));
        }

        if (!isValidLineOrColumn(codeLocation.startLine)) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                engineName, violation.ruleName, 'startLine', codeLocation.startLine));
        }

        if (!isValidLineOrColumn(codeLocation.startColumn)) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                engineName, violation.ruleName, 'startColumn', codeLocation.startColumn));
        }

        if (codeLocation.endLine !== undefined) {
            if (!isValidLineOrColumn(codeLocation.endLine)) {
                throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                    engineName, violation.ruleName, 'endLine', codeLocation.endLine));
            } else if (codeLocation.endLine < codeLocation.startLine) {
                throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithEndLineBeforeStartLine',
                    engineName, violation.ruleName, codeLocation.endLine, codeLocation.startLine));
            }

            if (codeLocation.endColumn !== undefined) {
                if (!isValidLineOrColumn(codeLocation.endColumn)) {
                    throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                        engineName, violation.ruleName, 'endColumn', codeLocation.endColumn));
                } else if (codeLocation.endLine == codeLocation.startLine && codeLocation.endColumn < codeLocation.startColumn) {
                    throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithEndColumnBeforeStartColumnOnSameLine',
                        engineName, violation.ruleName, codeLocation.endColumn, codeLocation.startColumn));
                }
            }
        }
    }
}

function isValidLineOrColumn(value: number) {
    return isIntegerBetween(value, 1, Number.MAX_VALUE);
}

function isIntegerBetween(value: number, leftBound: number, rightBound: number): boolean {
    return value >= leftBound && value <= rightBound && Number.isInteger(value);
}