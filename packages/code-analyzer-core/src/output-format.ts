import {RunResults} from "./results";
import {Clock, RealClock} from "./utils";
import {JsonOutputFormatter} from "./output-formats/json-output-format";
import {CsvOutputFormatter} from "./output-formats/csv-output-format";
import {XmlOutputFormatter} from "./output-formats/xml-output-format";
import {HtmlOutputFormatter} from "./output-formats/html-output-format";
import {SarifOutputFormatter} from "./output-formats/sarif-output-format";

/**
 * Enum of output formats available
 */
export enum OutputFormat {
    CSV = "CSV",
    JSON = "JSON",
    XML = "XML",
    HTML = "HTML",
    SARIF = "SARIF"
}

// exported internally only to be shared between multiple source files
export const CODE_ANALYZER_CORE_NAME: string = 'code-analyzer';

/**
 * Abstract class to convert RunResults to formatted output text
 */
export abstract class OutputFormatter {
    /**
     * Formats run results into output text as a string
     * @param runResults RunResults to be formatted
     */
    abstract format(runResults: RunResults): string

    /**
     * Creates the {@link OutputFormatter} associated with an {@link OutputFormat}
     * @param format {@link OutputFormat} instance
     * @param clock (optional - for internal testing purposes only)
     */
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
            case OutputFormat.SARIF:
                return new SarifOutputFormatter();
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }
}
