import {Rule, RuleSelection, SeverityLevel, UnexpectedEngineErrorRule} from "./rules"
import * as engApi from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {toAbsolutePath} from "./utils";
import {OutputFormat, OutputFormatter} from "./output-format";
import path from "node:path";

export interface CodeLocation {
    getFile(): string | undefined
    getStartLine(): number | undefined
    getStartColumn(): number | undefined
    getEndLine(): number | undefined
    getEndColumn(): number | undefined
}

export interface Violation {
    getRule(): Rule
    getMessage(): string
    getCodeLocations(): CodeLocation[]
    getPrimaryLocationIndex(): number
    getResourceUrls(): string[]
}

export interface EngineRunResults {
    getEngineName(): string
    getViolationCount(): number
    getViolationCountOfSeverity(severity: SeverityLevel): number
    getViolations(): Violation[]
}

export interface RunResults {
    getRunDirectory(): string
    getViolationCount(): number
    getViolationCountOfSeverity(severity: SeverityLevel): number
    getViolations(): Violation[]
    getEngineNames(): string[]
    getEngineRunResults(engineName: string): EngineRunResults
    toFormattedOutput(format: OutputFormat): string
}


/******* IMPLEMENTATIONS: **************************************************************************/
export class CodeLocationImpl implements CodeLocation {
    private readonly apiCodeLocation: engApi.CodeLocation;

    constructor(apiCodeLocation: engApi.CodeLocation) {
        this.apiCodeLocation = apiCodeLocation;
    }

    getFile(): string {
        return toAbsolutePath(this.apiCodeLocation.file);
    }

    getStartLine(): number {
        return this.apiCodeLocation.startLine;
    }

    getStartColumn(): number {
        return this.apiCodeLocation.startColumn;
    }

    getEndLine(): number | undefined {
        return this.apiCodeLocation.endLine;
    }

    getEndColumn(): number | undefined {
        return this.getEndLine() == undefined ? undefined : this.apiCodeLocation.endColumn;
    }
}

export class UndefinedCodeLocation implements CodeLocation {
    static readonly INSTANCE: UndefinedCodeLocation = new UndefinedCodeLocation();

    getFile(): undefined {
        return undefined;
    }

    getStartLine(): undefined {
        return undefined;
    }

    getStartColumn(): undefined {
        return undefined;
    }

    getEndLine(): undefined {
        return undefined;
    }

    getEndColumn(): undefined {
        return undefined;
    }
}

export class ViolationImpl implements Violation {
    private readonly apiViolation: engApi.Violation;
    private readonly rule: Rule;

    constructor(apiViolation: engApi.Violation, rule: Rule) {
        this.apiViolation = apiViolation;
        this.rule = rule;
    }

    getRule(): Rule {
        return this.rule;
    }

    getMessage(): string {
        return this.apiViolation.message;
    }

    getCodeLocations(): CodeLocation[] {
        return this.apiViolation.codeLocations.map(l => new CodeLocationImpl(l));
    }

    getPrimaryLocationIndex(): number {
        return this.apiViolation.primaryLocationIndex;
    }

    getResourceUrls(): string[] {
        // Returns the urls from the rule and then appends any urls from the violation that are not already from the rule.
        const urls: string[] = this.rule.getResourceUrls();
        return !this.apiViolation.resourceUrls ? urls :
            [...urls, ...this.apiViolation.resourceUrls.filter(url => !urls.includes(url))];
    }
}

export class UnexpectedEngineErrorViolation implements Violation {
    private readonly engineName: string;
    private readonly error: Error;
    private readonly rule: Rule;

    constructor(engineName: string, error: Error) {
        this.engineName = engineName;
        this.error = error;
        this.rule = new UnexpectedEngineErrorRule(engineName);
    }

    getRule(): Rule {
        return this.rule;
    }

    getMessage(): string {
        return getMessage('UnexpectedEngineErrorViolationMessage', this.engineName, this.error.message);
    }

    getCodeLocations(): CodeLocation[] {
        return [UndefinedCodeLocation.INSTANCE];
    }

    getPrimaryLocationIndex(): number {
        return 0;
    }

    getResourceUrls(): string[] {
        return [];
    }
}

export class EngineRunResultsImpl implements EngineRunResults {
    private readonly engineName: string;
    private readonly apiEngineRunResults: engApi.EngineRunResults;
    private readonly ruleSelection: RuleSelection;

    constructor(engineName: string, apiEngineRunResults: engApi.EngineRunResults, ruleSelection: RuleSelection) {
        this.engineName = engineName;
        this.apiEngineRunResults = apiEngineRunResults;
        this.ruleSelection = ruleSelection;
    }

    getEngineName(): string {
        return this.engineName;
    }

    getViolationCount(): number {
        return this.apiEngineRunResults.violations.length;
    }

    getViolationCountOfSeverity(severity: SeverityLevel): number {
        return this.getViolations().filter(v => v.getRule().getSeverityLevel() == severity).length;
    }

    getViolations(): Violation[] {
        return this.apiEngineRunResults.violations.map(v =>
            new ViolationImpl(v, this.ruleSelection.getRule(this.engineName, v.ruleName)));
    }
}

export class UnexpectedErrorEngineRunResults implements EngineRunResults {
    private readonly engineName: string;
    private readonly violation: Violation;

    constructor(engineName: string, error: Error) {
        this.engineName = engineName;
        this.violation = new UnexpectedEngineErrorViolation(engineName, error);
    }

    getEngineName(): string {
        return this.engineName;
    }

    getViolationCount(): number {
        return 1;
    }

    getViolationCountOfSeverity(severity: SeverityLevel): number {
        return severity == SeverityLevel.Critical ? 1 : 0;
    }

    getViolations(): Violation[] {
        return [this.violation];
    }
}

export class RunResultsImpl implements RunResults {
    private readonly runDir: string;
    private readonly engineRunResultsMap: Map<string, EngineRunResults> = new Map();

    constructor(runDir: string = process.cwd() + path.sep) {
        this.runDir = runDir;
    }

    getRunDirectory() {
        return this.runDir;
    }

    getViolations(): Violation[] {
        return Array.from(this.engineRunResultsMap.values()).flatMap(
            engineRunResults => engineRunResults.getViolations());
    }

    getViolationCount(): number {
        let count = 0;
        for (const engineRunResults of this.engineRunResultsMap.values()) {
            count += engineRunResults.getViolationCount();
        }
        return count;
    }

    getViolationCountOfSeverity(severity: SeverityLevel): number {
        let count = 0;
        for (const engineRunResults of this.engineRunResultsMap.values()) {
            count += engineRunResults.getViolationCountOfSeverity(severity);
        }
        return count;
    }

    getEngineNames(): string[] {
        return Array.from(this.engineRunResultsMap.keys());
    }

    getEngineRunResults(engineName: string): EngineRunResults {
        const engineRunResults = this.engineRunResultsMap.get(engineName);
        if (!engineRunResults) {
            // This line should ideally never be hit. But it is added as protection in case the client passes in a bad engine name.
            throw new Error(getMessage('EngineRunResultsMissing', engineName));
        }
        return engineRunResults;
    }

    toFormattedOutput(format: OutputFormat): string {
        return OutputFormatter.forFormat(format).format(this);
    }

    addEngineRunResults(engineRunResults: EngineRunResults): void {
        this.engineRunResultsMap.set(engineRunResults.getEngineName(), engineRunResults);
    }
}