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
    runDir: string
    violationCounts: {
        total: number
        sev1: number
        sev2: number
        sev3: number
        sev4: number
        sev5: number
    }
    violations: ViolationOutput[]
}

type ViolationOutput = {
    id: number
    rule: string
    engine: string
    severity: number
    type: string
    tags: string[]
    file?: string
    line?: number
    column?: number
    endLine?: number
    endColumn?: number
    pathLocations?: string[]
    message: string
    resources?: string[]
}

class CsvOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        const violationOutputs: ViolationOutput[] = toViolationOutputs(results.getViolations(), results.getRunDirectory());
        const options: CsvOptions = {
            header: true,
            quoted_string: true,
            columns: ['id', 'rule', 'engine', 'severity', 'type', 'tags', 'file', 'line', 'column',
                'endLine', 'endColumn', 'pathLocations', 'message', 'resources'],
            cast: {
                object: value => {
                    if (Array.isArray(value)) {
                        return { value: value.join(','), quoted: true };
                    }
                    /* istanbul ignore next */
                    throw new Error(`Unsupported value to cast: ${value}.`)
                }
            }
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
        resultsNode.node('runDir').text(resultsOutput.runDir);
        const violationCountsNode: xmlbuilder.XMLElement = resultsNode.node('violationCounts');
        violationCountsNode.node('total').text(`${resultsOutput.violationCounts.total}`);
        violationCountsNode.node('sev1').text(`${resultsOutput.violationCounts.sev1}`);
        violationCountsNode.node('sev2').text(`${resultsOutput.violationCounts.sev2}`);
        violationCountsNode.node('sev3').text(`${resultsOutput.violationCounts.sev3}`);
        violationCountsNode.node('sev4').text(`${resultsOutput.violationCounts.sev4}`);
        violationCountsNode.node('sev5').text(`${resultsOutput.violationCounts.sev5}`);

        const violationsNode: xmlbuilder.XMLElement = resultsNode.node('violations');
        for (const violationOutput of resultsOutput.violations) {
            const violationNode: xmlbuilder.XMLElement = violationsNode.node('violation');
            violationNode.attribute('id', violationOutput.id);
            violationNode.node('rule').text(violationOutput.rule);
            violationNode.node('engine').text(violationOutput.engine);
            violationNode.node('severity').text(`${violationOutput.severity}`);
            violationNode.node('type').text(violationOutput.type);
            const tagsNode: xmlbuilder.XMLElement = violationNode.node('tags');
            for (const tag of violationOutput.tags) {
                tagsNode.node('tag').text(tag);
            }
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
            if (violationOutput.pathLocations) {
                const pathLocationsNode: xmlbuilder.XMLElement = violationNode.node('pathLocations');
                for (const pathLocation of violationOutput.pathLocations) {
                    pathLocationsNode.node('pathLocation', pathLocation);
                }
            }
            violationNode.node('message').text(violationOutput.message);
            if (violationOutput.resources) {
                const resourcesNode: xmlbuilder.XMLElement = violationNode.node('resources');
                for (const resource of violationOutput.resources) {
                    resourcesNode.node('resource').text(resource);
                }
            }
        }

        return violationsNode.end({ pretty: true, allowEmpty: true });
    }
}

function toResultsOutput(results: RunResults) {
    const resultsOutput: ResultsOutput = {
        runDir: results.getRunDirectory(),
        violationCounts: {
            total: results.getViolationCount(),
            sev1: results.getViolationCountOfSeverity(SeverityLevel.Critical),
            sev2: results.getViolationCountOfSeverity(SeverityLevel.High),
            sev3: results.getViolationCountOfSeverity(SeverityLevel.Moderate),
            sev4: results.getViolationCountOfSeverity(SeverityLevel.Low),
            sev5: results.getViolationCountOfSeverity(SeverityLevel.Info),
        },
        violations: toViolationOutputs(results.getViolations(), results.getRunDirectory())
    };
    return resultsOutput;
}

function toViolationOutputs(violations: Violation[], runDir: string): ViolationOutput[] {
    const violationOutputs: ViolationOutput[] = [];
    for (let i = 0; i < violations.length; i++) {
        const violation: Violation = violations[i];
        const row: ViolationOutput = createViolationOutput(i+1, violation, runDir);
        violationOutputs.push(row)
    }
    return violationOutputs;
}

function createViolationOutput(id: number, violation: Violation, runDir: string): ViolationOutput {
    const rule: Rule = violation.getRule();
    const codeLocations: CodeLocation[] = violation.getCodeLocations();
    const primaryLocation: CodeLocation = codeLocations[violation.getPrimaryLocationIndex()];

    return {
        id: id,
        rule: rule.getName(),
        engine: rule.getEngineName(),
        severity: rule.getSeverityLevel(),
        type: rule.getType(),
        tags: rule.getTags(),
        file: primaryLocation.getFile() ? makeRelativeIfPossible(primaryLocation.getFile() as string, runDir) : undefined,
        line: primaryLocation.getStartLine(),
        column: primaryLocation.getStartColumn(),
        endLine: primaryLocation.getEndLine(),
        endColumn: primaryLocation.getEndColumn(),
        pathLocations: [RuleType.DataFlow, RuleType.Flow].includes(rule.getType()) ? createPathLocations(codeLocations, runDir) : undefined,
        message: violation.getMessage(),
        resources: violation.getResourceUrls()
    };
}

function createPathLocations(codeLocations: CodeLocation[], runDir: string): string[] {
    return codeLocations.map(l => createLocationString(l, runDir)).filter(s => s.length > 0);
}

function createLocationString(codeLocation: CodeLocation, runDir: string): string {
    let locationString: string = '';
    if (codeLocation.getFile()) {
        locationString += makeRelativeIfPossible(codeLocation.getFile() as string, runDir);
        if (codeLocation.getStartLine()) {
            locationString += ':' + codeLocation.getStartLine();
            if (codeLocation.getStartColumn()) {
                locationString += ':' + codeLocation.getStartColumn();
            }
        }
    }
    return locationString;
}

function makeRelativeIfPossible(file: string, rootDir: string): string {
    if (file.startsWith(rootDir)) {
        file = file.substring(rootDir.length);
    }
    return file;
}