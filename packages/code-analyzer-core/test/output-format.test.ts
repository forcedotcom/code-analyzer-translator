import {RunResults, RunResultsImpl} from "../src/results";
import {CodeAnalyzer, CodeAnalyzerConfig, OutputFormat} from "../src";
import * as fs from "fs";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot, FixedClock} from "./test-helpers";
import * as stubs from "./stubs";

changeWorkingDirectoryToPackageRoot();

let runResults: RunResults;
beforeAll(async () => {
    const codeAnalyzer: CodeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
    codeAnalyzer.setClock(new FixedClock(new Date(2024, 6, 3, 9, 14, 34, 567)));
    const stubPlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
    await codeAnalyzer.addEnginePlugin(stubPlugin);
    (stubPlugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1).resultsToReturn = {
        violations: [stubs.getSampleViolationForStub1RuleA(), stubs.getSampleViolationForStub1RuleC(), stubs.getSampleViolationForStub1RuleE()]
    };
    (stubPlugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2).resultsToReturn = {
        violations: [stubs.getSampleViolationForStub2RuleC()]
    };
    runResults = await codeAnalyzer.run(codeAnalyzer.selectRules('all'), {workspaceFiles: ['test']});
});

describe("Tests for the CSV output format", () => {
    it("When an empty result is provided, we create a csv text with headers but no rows", () => {
        const results: RunResults = new RunResultsImpl();
        const formattedText: string = results.toFormattedOutput(OutputFormat.CSV);
        const expectedText: string = getContentsOfExpectedOutputFile('zeroViolations.csv');
        expect(formattedText).toEqual(expectedText);
    });

    it("When results contain multiple violations, we create csv text correctly", () => {
        const formattedText: string = runResults.toFormattedOutput(OutputFormat.CSV);
        const expectedText: string = getContentsOfExpectedOutputFile('multipleViolations.csv');
        expect(formattedText).toEqual(expectedText);
    });

    it("When results contain violation of type UnexpectedError, we create csv text correctly", async () => {
        const resultsWithUnexpectedError: RunResults = await createResultsWithUnexpectedError();
        const formattedText: string = resultsWithUnexpectedError.toFormattedOutput(OutputFormat.CSV);
        const expectedText: string = getContentsOfExpectedOutputFile('unexpectedEngineErrorViolation.csv');
        expect(formattedText).toEqual(expectedText);
    });
});

describe("Tests for the JSON output format", () => {
    it("When an empty result is provided, we create a json text with summary having zeros", () => {
        const results: RunResults = new RunResultsImpl();
        const formattedText: string = results.toFormattedOutput(OutputFormat.JSON);
        const expectedText: string = getContentsOfExpectedOutputFile('zeroViolations.json', true);
        expect(formattedText).toEqual(expectedText);
    });

    it("When results contain multiple violations , we create json text correctly", async () => {
        const formattedText: string = runResults.toFormattedOutput(OutputFormat.JSON);
        const expectedText: string = getContentsOfExpectedOutputFile('multipleViolations.json', true);
        expect(formattedText).toEqual(expectedText);
    });

    it("When results contain violation of type UnexpectedError, we create json text correctly", async () => {
        const resultsWithUnexpectedError: RunResults = await createResultsWithUnexpectedError();
        const formattedText: string = resultsWithUnexpectedError.toFormattedOutput(OutputFormat.JSON);
        const expectedText: string = getContentsOfExpectedOutputFile('unexpectedEngineErrorViolation.json', true);
        expect(formattedText).toEqual(expectedText);
    });
});

describe("Tests for the XML output format", () => {
    it("When an empty result is provided, we create a xml text with summary having zeros", () => {
        const results: RunResults = new RunResultsImpl();
        const formattedText: string = results.toFormattedOutput(OutputFormat.XML);
        const expectedText: string = getContentsOfExpectedOutputFile('zeroViolations.xml');
        expect(formattedText).toEqual(expectedText);
    });

    it("When results contain multiple violations , we create xml text correctly", () => {
        const formattedText: string = runResults.toFormattedOutput(OutputFormat.XML);
        const expectedText: string = getContentsOfExpectedOutputFile('multipleViolations.xml');
        expect(formattedText).toEqual(expectedText);
    });

    it("When results contain violation of type UnexpectedError, we create xml text correctly", async () => {
        const resultsWithUnexpectedError: RunResults = await createResultsWithUnexpectedError();
        const formattedText: string = resultsWithUnexpectedError.toFormattedOutput(OutputFormat.XML);
        const expectedText: string = getContentsOfExpectedOutputFile('unexpectedEngineErrorViolation.xml');
        expect(formattedText).toEqual(expectedText);
    });
});

describe("Other misc output formatting tests", () => {
    it("When an output format is not supported, then we error", () => {
        // This test is just a sanity check in case we add in an output format in the future without updating the
        // OutputFormat.forFormat factory method. We want to ensure an error will be thrown to alert us to the issue.

        // First we assert the error exists by forcefully casting a string to the output format to simulate a new one.
        const results: RunResults = new RunResultsImpl();
        const format: OutputFormat = "SomeUnsupportedFormat" as OutputFormat;
        expect(() => results.toFormattedOutput(format)).toThrow("Unsupported output format: SomeUnsupportedFormat");

        // Next we assert that all output formats in the enum are currently supported.
        for (const format of Object.values(OutputFormat)) {
            const output = results.toFormattedOutput(format);
            expect(typeof output).toEqual('string');
            expect(output.length).toBeGreaterThan(0);
        }
    });
});

function getContentsOfExpectedOutputFile(expectedOutputFileName: string, escapeBackslashes: boolean = false): string {
    const contents: string = fs.readFileSync(path.resolve('test','test-data','expectedOutputFiles',expectedOutputFileName), 'utf-8');
    let pathSepVar: string = path.sep;
    let runDirVar: string = process.cwd() + path.sep;
    if (escapeBackslashes) {
        pathSepVar = pathSepVar.replaceAll('\\','\\\\');
        runDirVar = runDirVar.replaceAll('\\','\\\\');
    }
    return contents.replaceAll('{{PATHSEP}}', pathSepVar)
        .replaceAll('{{RUNDIR}}', runDirVar)
        .replaceAll('\r',''); // fix for windows
}

async function createResultsWithUnexpectedError(): Promise<RunResults> {
    const codeAnalyzer: CodeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
    await codeAnalyzer.addEnginePlugin(new stubs.ThrowingEnginePlugin());
    return codeAnalyzer.run(codeAnalyzer.selectRules(), {workspaceFiles: ['test']});
}