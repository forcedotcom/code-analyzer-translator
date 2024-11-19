import {RunResults} from "../results";
import {stringify as stringifyToCsv} from "csv-stringify/sync";
import {Options as CsvOptions} from "csv-stringify";
import {OutputFormatter} from "../output-format";
import {JsonViolationOutput, toJsonViolationOutputArray} from "./json-output-format";

export class CsvOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        // Leveraging the JsonViolationOutput data structure for now. This may change in the near future.
        const violationOutputs: JsonViolationOutput[] = toJsonViolationOutputArray(results.getViolations(), results.getRunDirectory());
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