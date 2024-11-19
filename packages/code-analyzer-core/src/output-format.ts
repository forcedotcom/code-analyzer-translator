import {RunResults} from "./results";
import {Clock, RealClock} from "./utils";
import {JsonOutputFormatter} from "./output-formats/json-output-format";
import {CsvOutputFormatter} from "./output-formats/csv-output-format";
import {XmlOutputFormatter} from "./output-formats/xml-output-format";
import {HtmlOutputFormatter} from "./output-formats/html-output-format";
import {SarifOutputFormatter} from "./output-formats/sarif-output-format";

export enum OutputFormat {
    CSV = "CSV",
    JSON = "JSON",
    XML = "XML",
    HTML = "HTML",
    SARIF = "SARIF"
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
            case OutputFormat.SARIF:
                return new SarifOutputFormatter();
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }
}
