import {
    ConfigObject,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation
} from "@salesforce/code-analyzer-engine-api";
import {RetireJsExecutor, AdvancedRetireJsExecutor, ZIPPED_FILE_MARKER} from "./executor";
import {Finding, Vulnerability} from "retire/lib/types";

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
        throw new Error(`The RetireJsEnginePlugin does not support creating an engine with name '${engineName}'.`);
    }
}

export class RetireJsEngine extends Engine {
    static readonly NAME = "retire-js";
    private readonly retireJsExecutor: RetireJsExecutor;

    constructor(retireJsExecutor?: RetireJsExecutor) {
        super();
        this.retireJsExecutor = retireJsExecutor ? retireJsExecutor : new AdvancedRetireJsExecutor();
    }

    getName(): string {
        return RetireJsEngine.NAME;
    }

    async describeRules(): Promise<RuleDescription[]> {
        return Object.values(RetireJsSeverity).map(createRuleDescription);
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const findings: Finding[] = await this.retireJsExecutor.execute(runOptions.filesToInclude);
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
        description: `Identifies JavaScript libraries with known vulnerabilities of ${rjsSeverity} severity.`,
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
    const message: string = (fileInsideZipArchive ?
                `'${library}' was found inside of the zipped archive in '${fileInsideZipArchive}' which contains a known vulnerability. `
                : `'${library}' contains a known vulnerability. `
        ) +
        `Please upgrade to latest version.\nVulnerability details: ${vulnerabilityDetails}`;

    return {
        ruleName: toRuleName(vulnerability.severity as RetireJsSeverity),
        message: message,
        codeLocations: [{file: fileOrZipArchive, startLine: 1, startColumn: 1}],
        primaryLocationIndex: 0,
        resourceUrls: vulnerability.info
    };
}