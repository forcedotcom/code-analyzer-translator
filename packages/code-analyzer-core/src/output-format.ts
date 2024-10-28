import {CodeLocation, RunResults, Violation} from "./results";
import {Rule, RuleType, SeverityLevel} from "./rules";
import {stringify as stringifyToCsv} from "csv-stringify/sync";
import {Options as CsvOptions} from "csv-stringify";
import * as xmlbuilder from "xmlbuilder";
import * as fs from 'fs';
import path from "node:path";
import {Clock, RealClock} from "./utils";

export enum OutputFormat {
    CSV = "CSV",
    JSON = "JSON",
    XML = "XML",
    HTML = "HTML"
}

export abstract class OutputFormatter {
    abstract format(results: RunResults): string

    static forFormat(format: OutputFormat, /* istanbul ignore next */ clock: Clock = new RealClock()) {
        switch (format) {
            case OutputFormat.CSV:
                return new CsvOutputFormatter();
            case OutputFormat.JSON:
                return new JsonOutputFormatter();
            case OutputFormat.XML:
                return new XmlOutputFormatter();
            case OutputFormat.HTML:
                return new HtmlOutputFormatter(clock);
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
    primaryLocationIndex?: number
    locations?: CodeLocationOutput[]
    message: string
    resources?: string[]
}

class CodeLocationOutput {
    private readonly file: string;
    private readonly line: number;
    private readonly column: number;
    private readonly endLine?: number;
    private readonly endColumn?: number;
    private readonly comment?: string;

    public constructor(codeLocation: CodeLocation, runDir: string) {
        this.file = makeRelativeIfPossible(codeLocation.getFile()!, runDir);
        this.line = codeLocation.getStartLine()!;
        this.column = codeLocation.getStartColumn()!;
        this.endLine = codeLocation.getEndLine();
        this.endColumn = codeLocation.getEndColumn();
        this.comment = codeLocation.getComment();
    }

    public getFile(): string {
        return this.file;
    }

    public getLine(): number {
        return this.line;
    }

    public getColumn(): number {
        return this.column;
    }

    public getEndLine(): number | undefined {
        return this.endLine;
    }

    public getEndColumn(): number | undefined {
        return this.endColumn;
    }

    public getComment(): string | undefined {
        return this.comment;
    }

    public toString(): string {
        const commentPortion: string = this.comment ? ` (${this.comment})` : '';
        return `${this.file}:${this.line}:${this.column}${commentPortion}`;
    }
}

class CsvOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        const violationOutputs: ViolationOutput[] = toViolationOutputs(results.getViolations(), results.getRunDirectory());
        const options: CsvOptions = {
            header: true,
            quoted_string: true,
            columns: ['rule', 'engine', 'severity', 'type', 'tags', 'file', 'line', 'column',
                'endLine', 'endColumn', 'locations', 'message', 'resources'],
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
            if (violationOutput.primaryLocationIndex != null) {
                violationNode.node('primaryLocationIndex').text(`${violationOutput.primaryLocationIndex}`);
            }
            if (violationOutput.locations) {
                const pathLocationsNode: xmlbuilder.XMLElement = violationNode.node('locations');
                for (const location of violationOutput.locations) {
                    const locationNode: xmlbuilder.XMLElement = pathLocationsNode.node('location');
                    locationNode.node('file').text(location.getFile());
                    locationNode.node('line').text(`${location.getLine()}`);
                    locationNode.node('column').text(`${location.getColumn()}`);
                    if (location.getEndLine() != null) {
                        locationNode.node('endLine').text(`${location.getEndLine()}`);
                    }
                    if (location.getEndColumn() != null) {
                        locationNode.node('endColumn').text(`${location.getEndColumn()}`);
                    }
                    if (location.getComment() != null) {
                        locationNode.node('comment').text(location.getComment()!);
                    }
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

const HTML_TEMPLATE_VERSION: string = '0.0.1';
const HTML_TEMPLATE_FILE: string = path.resolve(__dirname, '..', 'output-templates', `html-template-${HTML_TEMPLATE_VERSION}.txt`);
class HtmlOutputFormatter implements OutputFormatter {
    private static readonly TIMESTAMP_HOLE: string = '{{###TIMESTAMP###}}';
    private static readonly RUNDIR_HOLE: string = '{{###RUNDIR###}}';
    private static readonly VIOLATIONS_HOLE: string = '{{###VIOLATIONS###}}';
    private readonly clock: Clock;

    constructor(clock: Clock) {
        this.clock = clock;
    }

    format(results: RunResults): string {
        const resultsOutput: ResultsOutput = toResultsOutput(results, escapeHtml);
        const htmlTemplate: string = fs.readFileSync(HTML_TEMPLATE_FILE, 'utf-8');
        const timestampString: string = this.clock.now().toLocaleString('en-us', {year: "numeric", month: "short",
            day: "numeric", hour: "numeric", minute: "numeric", hour12: true});

        // Note that value.replace(a,b) has special handling if b has '$' characters in it, so to avoid this special
        // handling, we use value.replace(a, (match) => b) instead so that we always replace with exact text.
        return htmlTemplate
            .replace(HtmlOutputFormatter.TIMESTAMP_HOLE, (_m) => timestampString)
            .replace(HtmlOutputFormatter.RUNDIR_HOLE, (_m) => resultsOutput.runDir)
            .replace(HtmlOutputFormatter.VIOLATIONS_HOLE, (_m) => JSON.stringify(resultsOutput.violations));
    }
}

function toResultsOutput(results: RunResults, sanitizeFcn: (text: string) => string = t => t): ResultsOutput {
    return {
        runDir: results.getRunDirectory(),
        violationCounts: {
            total: results.getViolationCount(),
            sev1: results.getViolationCountOfSeverity(SeverityLevel.Critical),
            sev2: results.getViolationCountOfSeverity(SeverityLevel.High),
            sev3: results.getViolationCountOfSeverity(SeverityLevel.Moderate),
            sev4: results.getViolationCountOfSeverity(SeverityLevel.Low),
            sev5: results.getViolationCountOfSeverity(SeverityLevel.Info),
        },
        violations: toViolationOutputs(results.getViolations(), results.getRunDirectory(), sanitizeFcn)
    };
}

function toViolationOutputs(violations: Violation[], runDir: string, sanitizeFcn: (text: string) => string = t => t): ViolationOutput[] {
    return violations.map(v => createViolationOutput(v, runDir, sanitizeFcn));
}

function createViolationOutput(violation: Violation, runDir: string, sanitizeFcn: (text: string) => string): ViolationOutput {
    const rule: Rule = violation.getRule();
    const codeLocations: CodeLocation[] = violation.getCodeLocations();
    const primaryLocation: CodeLocation = codeLocations[violation.getPrimaryLocationIndex()];

    return {
        rule: sanitizeFcn(rule.getName()),
        engine: sanitizeFcn(rule.getEngineName()),
        severity: rule.getSeverityLevel(),
        type: rule.getType(),
        tags: rule.getTags().map(sanitizeFcn),
        file: primaryLocation.getFile() ? makeRelativeIfPossible(primaryLocation.getFile() as string, runDir) : undefined,
        line: primaryLocation.getStartLine(),
        column: primaryLocation.getStartColumn(),
        endLine: primaryLocation.getEndLine(),
        endColumn: primaryLocation.getEndColumn(),
        primaryLocationIndex: [RuleType.DataFlow, RuleType.Flow].includes(rule.getType()) ? violation.getPrimaryLocationIndex() : undefined,
        locations: [RuleType.DataFlow, RuleType.Flow].includes(rule.getType()) ? createCodeLocationOutputs(codeLocations, runDir) : undefined,
        message: sanitizeFcn(violation.getMessage()),
        resources: violation.getResourceUrls()
    };
}

function createCodeLocationOutputs(codeLocations: CodeLocation[], runDir: string): CodeLocationOutput[] {
    return codeLocations.map(loc => {
        return new CodeLocationOutput(loc, runDir);
    })
}

function makeRelativeIfPossible(file: string, rootDir: string): string {
    if (file.startsWith(rootDir)) {
        file = file.substring(rootDir.length);
    }
    return file;
}

function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, function (match: string) {
        /* istanbul ignore next */
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return match;
        }
    });
}