import {
    ConfigObject,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation
} from "@salesforce/code-analyzer-engine-api";
import {RetireJsExecutor, AdvancedRetireJsExecutor, ZIPPED_FILE_MARKER, EmitLogEventFcn} from "./executor";
import {Finding, Vulnerability} from "retire/lib/types";
import {getMessage} from "./messages";

enum RetireJsSeverity {
    Critical = 'critical',
    High = 'high',
    Medium = 'medium',
    Low = 'low'
}

const SeverityMap: Map<RetireJsSeverity, SeverityLevel> = new Map([
    [RetireJsSeverity.Critical, SeverityLevel.Critical],
    [RetireJsSeverity.High, SeverityLevel.High],
    [RetireJsSeverity.Medium, SeverityLevel.Moderate],
    [RetireJsSeverity.Low, SeverityLevel.Low]
]);

export class RetireJsEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [RetireJsEngine.NAME];
    }

    createEngine(engineName: string, _config: ConfigObject): Engine {
        if (engineName === RetireJsEngine.NAME) {
            return new RetireJsEngine();
        }
        throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
    }
}

export class RetireJsEngine extends Engine {
    static readonly NAME = "retire-js";
    private readonly retireJsExecutor: RetireJsExecutor;

    constructor(retireJsExecutor?: RetireJsExecutor) {
        super();
        const emitLogEventFcn: EmitLogEventFcn = (logLevel: LogLevel, msg: string) => this.emitEvent<LogEvent>(
            {type: EventType.LogEvent, logLevel: logLevel, message: msg});
        this.retireJsExecutor = retireJsExecutor ? retireJsExecutor : new AdvancedRetireJsExecutor(emitLogEventFcn);
    }

    getName(): string {
        return RetireJsEngine.NAME;
    }

    async describeRules(): Promise<RuleDescription[]> {
        return Object.values(RetireJsSeverity).map(createRuleDescription);
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const findings: Finding[] = await this.retireJsExecutor.execute(runOptions.workspaceFiles);
        return {
            violations: toViolations(findings).filter(v => ruleNames.includes(v.ruleName))
        };
    }
}

function createRuleDescription(rjsSeverity: RetireJsSeverity): RuleDescription {
    return {
        name: toRuleName(rjsSeverity),
        severityLevel: toSeverityLevel(rjsSeverity),
        type: RuleType.Standard,
        tags: ['Recommended'],
        description: getMessage('RetireJsRuleDescription', `${rjsSeverity}`),
        resourceUrls: ['https://retirejs.github.io/retire.js/']
    }
}

function toSeverityLevel(rjsSeverity: RetireJsSeverity): SeverityLevel {
    const severityLevel: SeverityLevel | undefined = SeverityMap.get(rjsSeverity);
    if (severityLevel) {
        return severityLevel;
    }
    /* istanbul ignore next */
    throw new Error(`Unsupported RetireJs severity: ${rjsSeverity}`);
}

function toRuleName(rjsSeverity: RetireJsSeverity) {
    return `LibraryWithKnown${capitalizeFirstLetter(rjsSeverity)}SeverityVulnerability`;
}

function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function toViolations(findings: Finding[]): Violation[] {
    const violations: Violation[] = [];
    for (const finding of findings) {
        const fileParts: string[] = finding.file.split(ZIPPED_FILE_MARKER);
        const fileOrZipArchive: string = fileParts[0];
        const fileInsideZipArchive: string | undefined = fileParts.length > 1 ? fileParts[1] : undefined;

        for (const findingResult of finding.results) {
            /* istanbul ignore next */
            if (!findingResult.vulnerabilities) {
                continue;
            }
            const library: string = `${findingResult.component} v${findingResult.version}`;
            for (const vulnerability of findingResult.vulnerabilities) {
                violations.push(toViolation(vulnerability, library, fileOrZipArchive, fileInsideZipArchive));
            }
        }
    }
    return violations;
}

function toViolation(vulnerability: Vulnerability, library: string, fileOrZipArchive: string, fileInsideZipArchive?: string) {
    const vulnerabilityDetails: string = JSON.stringify(vulnerability.identifiers, null, 2);
    let message: string = fileInsideZipArchive ? getMessage('VulnerableLibraryFoundInZipArchive', library, fileInsideZipArchive)
        : getMessage('LibraryContainsKnownVulnerability', library);
    message = `${message} ${getMessage('UpgradeToLatestVersion')}\n${getMessage('VulnerabilityDetails', vulnerabilityDetails)}`

    return {
        ruleName: toRuleName(vulnerability.severity as RetireJsSeverity),
        message: message,
        codeLocations: [{file: fileOrZipArchive, startLine: 1, startColumn: 1}],
        primaryLocationIndex: 0,
        resourceUrls: vulnerability.info
    };
}