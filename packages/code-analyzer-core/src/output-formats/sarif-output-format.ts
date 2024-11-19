import {CodeLocation, EngineRunResults, RunResults, Violation} from "../results";
import * as sarif from "sarif";
import {Rule, RuleType, SeverityLevel} from "../rules";
import {OutputFormatter} from "../output-format";

export class SarifOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        const runDir = results.getRunDirectory();

        const sarifRuns: sarif.Run[] = results.getEngineNames()
            .map(engineName => results.getEngineRunResults(engineName))
            .filter(engineRunResults => engineRunResults.getViolationCount() > 0)
            .map(engineRunResults => toSarifRun(engineRunResults, runDir));

        // Construct SARIF log
        const sarifLog: sarif.Log = {
            version: "2.1.0",
            $schema: 'http://json.schemastore.org/sarif-2.1.0',
            runs: sarifRuns,
        };

        // Return formatted SARIF JSON string
        return JSON.stringify(sarifLog, null, 2);
    }
}

function toSarifRun(engineRunResults: EngineRunResults, runDir: string): sarif.Run {
    const violations: Violation[] = engineRunResults.getViolations();
    const rules: Rule[] = [... new Set(violations.map(v => v.getRule()))];
    const ruleNames: string[] = rules.map(r => r.getName());

    return {
        tool: {
            driver: {
                name: engineRunResults.getEngineName(),
                informationUri: "https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/version-5.html",
                rules: rules.map(toSarifReportingDescriptor),
            }
        },
        results: violations.map(v => toSarifResult(v, ruleNames.indexOf(v.getRule().getName()))),
        invocations: [
            {
                executionSuccessful: true,
                workingDirectory: {
                    uri: runDir,
                },
            },
        ],
    };
}

function toSarifResult(violation: Violation, ruleIndex: number) : sarif.Result {
    const primaryCodeLocation = violation.getCodeLocations()[violation.getPrimaryLocationIndex()];
    const result: sarif.Result = {
        ruleId: violation.getRule().getName(),
        ruleIndex: ruleIndex,
        message: { text: violation.getMessage() },
        locations: [toSarifLocation(primaryCodeLocation)],
    };
    if(typeSupportsMultipleLocations(violation.getRule().getType())) {
        result.relatedLocations = violation.getCodeLocations().map(toSarifLocation);
    }
    result.level = toSarifNotificationLevel(violation.getRule().getSeverityLevel());
    return result;
}

function toSarifLocation(codeLocation: CodeLocation): sarif.Location {
    return {
        physicalLocation: {
            artifactLocation: {
                uri: codeLocation.getFile(),
            },
            region: {
                startLine: codeLocation.getStartLine(),
                startColumn: codeLocation.getStartColumn(),
                endLine: codeLocation.getEndLine(),
                endColumn: codeLocation.getEndColumn()
            } as sarif.Region
        }
    }
}

function toSarifReportingDescriptor(rule: Rule): sarif.ReportingDescriptor {
    return {
        id: rule.getName(),
        properties: {
            category: rule.getTags(),
            severity: rule.getSeverityLevel()
        },
        ...(rule.getResourceUrls()?.[0] && { helpUri: rule.getResourceUrls()[0] })
    }
}

function toSarifNotificationLevel(severity: SeverityLevel): sarif.Notification.level {
    return severity < 3 ? 'error' : 'warning'; // IF satif.Notification.level is an enum then please return the num instead of the string.
}

function typeSupportsMultipleLocations(ruleType: RuleType) {
    return [RuleType.DataFlow, RuleType.Flow, RuleType.MultiLocation].includes(ruleType);
}