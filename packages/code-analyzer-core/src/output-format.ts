import {CodeLocation, RunResults, Violation} from "./results";
import {Rule, RuleType, SeverityLevel} from "./rules";
import {stringify as stringifyToCsv} from "csv-stringify/sync";
import {Options as CsvOptions} from "csv-stringify";
import * as xmlbuilder from "xmlbuilder";

export enum OutputFormat {
    CSV = "CSV",
    JSON = "JSON",
    XML = "XML"
}

export abstract class OutputFormatter {
    abstract format(results: RunResults): string

    static forFormat(format: OutputFormat) {
        switch (format) {
            case OutputFormat.CSV:
                return new CsvOutputFormatter();
            case OutputFormat.JSON:
                return new JsonOutputFormatter();
            case OutputFormat.XML:
                return new XmlOutputFormatter();
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }
}

type ResultsOutput = {
    totalViolationCount: number
    sev1ViolationCount: number
    sev2ViolationCount: number
    sev3ViolationCount: number
    sev4ViolationCount: number
    sev5ViolationCount: number
    violations: ViolationOutput[]
}

type ViolationOutput = {
    index: number
    rule: string
    engine: string
    severity: number
    type: string
    file?: string
    line?: number
    column?: number
    endLine?: number
    endColumn?: number
    path?: string
    message: string
    resourceUrls?: string
}

class CsvOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        const violationOutputs: ViolationOutput[] = toViolationOutputs(results.getViolations());
        const options: CsvOptions = {
            header: true,
            quoted_string: true,
            columns: ['index', 'rule', 'engine', 'severity', 'type', 'file', 'line', 'column', 'endLine', 'endColumn',
                'path', 'message', 'resourceUrls']
        };
        return stringifyToCsv(violationOutputs, options);
    }
}

class JsonOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        const resultsOutput: ResultsOutput = toResultsOutput(results);
        return JSON.stringify(resultsOutput, undefined, 2);
    }
}

class XmlOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        const resultsOutput: ResultsOutput = toResultsOutput(results);

        const resultsNode: xmlbuilder.XMLElement = xmlbuilder.create('results', {version: '1.0', encoding: 'UTF-8'});
        resultsNode.attribute('totalViolationCount', resultsOutput.totalViolationCount);
        resultsNode.attribute('sev1ViolationCount', resultsOutput.sev1ViolationCount);
        resultsNode.attribute('sev2ViolationCount', resultsOutput.sev2ViolationCount);
        resultsNode.attribute('sev3ViolationCount', resultsOutput.sev3ViolationCount);
        resultsNode.attribute('sev4ViolationCount', resultsOutput.sev4ViolationCount);
        resultsNode.attribute('sev5ViolationCount', resultsOutput.sev5ViolationCount);

        const violationsNode: xmlbuilder.XMLElement = resultsNode.node('violations');
        for (const violationOutput of resultsOutput.violations) {
            const violationNode = violationsNode.node('violation');
            violationNode.attribute('index', violationOutput.index);
            violationNode.attribute('rule', violationOutput.rule);
            violationNode.attribute('engine', violationOutput.engine);
            violationNode.attribute('severity', violationOutput.severity);
            violationNode.attribute('type', violationOutput.type);
            if (violationOutput.file) {
                violationNode.node('file').text(violationOutput.file);
            }
            if (violationOutput.line) {
                violationNode.node('line').text(`${violationOutput.line}`);
            }
            if (violationOutput.column) {
                violationNode.node('column').text(`${violationOutput.column}`);
            }
            if (violationOutput.endLine) {
                violationNode.node('endLine').text(`${violationOutput.endLine}`);
            }
            if (violationOutput.endColumn) {
                violationNode.node('endColumn').text(`${violationOutput.endColumn}`);
            }
            if (violationOutput.path) {
                violationNode.node('path').text(violationOutput.path);
            }
            violationNode.node('message').text(violationOutput.message);
            if (violationOutput.resourceUrls) {
                violationNode.node('resourceUrls').text(violationOutput.resourceUrls);
            }
        }

        return violationsNode.end({ pretty: true, allowEmpty: true });
    }
}

function toResultsOutput(results: RunResults) {
    const resultsOutput: ResultsOutput = {
        totalViolationCount: results.getViolationCount(),
        sev1ViolationCount: results.getViolationCountOfSeverity(SeverityLevel.Critical),
        sev2ViolationCount: results.getViolationCountOfSeverity(SeverityLevel.High),
        sev3ViolationCount: results.getViolationCountOfSeverity(SeverityLevel.Moderate),
        sev4ViolationCount: results.getViolationCountOfSeverity(SeverityLevel.Low),
        sev5ViolationCount: results.getViolationCountOfSeverity(SeverityLevel.Info),
        violations: toViolationOutputs(results.getViolations())
    };
    return resultsOutput;
}

function toViolationOutputs(violations: Violation[]): ViolationOutput[] {
    const violationOutputs: ViolationOutput[] = [];
    for (let i = 0; i < violations.length; i++) {
        const violation: Violation = violations[i];
        const row: ViolationOutput = createViolationOutput(i+1, violation);
        violationOutputs.push(row)
    }
    return violationOutputs;
}

function createViolationOutput(index: number, violation: Violation): ViolationOutput {
    const rule: Rule = violation.getRule();
    const codeLocations: CodeLocation[] = violation.getCodeLocations();
    const primaryLocation: CodeLocation = codeLocations[violation.getPrimaryLocationIndex()];

    const violationOutput: ViolationOutput = {
        index: index,
        rule: rule.getName(),
        engine: rule.getEngineName(),
        severity: rule.getSeverityLevel(),
        type: rule.getType(),
        file: primaryLocation.getFile(),
        line: primaryLocation.getStartLine(),
        column: primaryLocation.getStartColumn(),
        endLine: primaryLocation.getEndLine(),
        endColumn: primaryLocation.getEndColumn(),
        message: violation.getMessage(),
        resourceUrls: violation.getRule().getResourceUrls().join(',')
    };

    if (rule.getType() == RuleType.PathBased) {
        violationOutput.path = createPathString(codeLocations);
    }

    return violationOutput;
}

function createPathString(codeLocations: CodeLocation[]): string {
    return codeLocations.map(createLocationString).join(',');
}

function createLocationString(codeLocation: CodeLocation) {
    let locationString: string = codeLocation.getFile();
    if (codeLocation.getStartLine()) {
        locationString += ':' + codeLocation.getStartLine();
        if (codeLocation.getStartColumn()) {
            locationString += ':' + codeLocation.getStartColumn();
        }
    }
    return locationString;
}