import path from 'node:path';
import os from 'node:os';
import * as fsp from 'node:fs/promises';
import {PythonCommandExecutor} from './PythonCommandExecutor';
import {getMessage} from '../messages';


export interface FlowTestCommandWrapper {
    getFlowTestRuleDescriptions(): Promise<FlowTestRuleDescriptor[]>;
    runFlowTestRules(dir: string, completionPercentageHandler: (percentage: number) => void): Promise<FlowTestExecutionResult>;
}

/**
 * The format used by FlowTest to describe the Queries (FlowTest's term for what we'd call rules) it can run.
 */
export type FlowTestRuleDescriptor = {
    /**
     * A machine-readable ID consisting of a unique string. E.g., "FlowSecurity.SystemModeWithSharing.recordCreates.data".
     */
    query_id: string;
    /**
     * A human-readable name consisting of a unique string. E.g., "Flow: SystemModeWithSharing recordCreates data".
     */
    query_name: string;
    /**
     * A string indicating relative severity. either {@code Flow_Low_Severity}, {@code Flow_Moderate_Severity}, or {@code Flow_High_Severity}.
     */
    severity: string;
    /**
     * A string describing the specific case the query identifies.
     */
    query_description: string;
    /**
     * A URL for help text.
     */
    help_url: string;
    /**
     * Not a property we care about.
     */
    query_version: string;
    /**
     * A string-wrapped boolean indicating whether the rule is security-related.
     */
    is_security: string;
}

export type FlowTestExecutionResult = {
    results: {
        [queryId: string]: FlowTestRuleResult[]
    }
}

export type FlowTestRuleResult = {
    flow: FlowNodeDescriptor[];
    query_name: string;
    severity: string;
    description: string;
    elem_name: string;
    field: string;
}

export type FlowNodeDescriptor = {
    influenced_var: string;
    influencer_var: string;
    element_name: string;
    comment: string;
    flow_path: string;
    line_no: number;
    source_text: string;
}

const PATH_TO_PIPX_PYZ = path.join(__dirname, '..', '..', 'pipx.pyz');
const PATH_TO_FLOWTEST_ROOT = path.join(__dirname, '..', '..', 'FlowTest');
const STATUS_DELIMITER = '**STATUS:';

export class RunTimeFlowTestCommandWrapper implements FlowTestCommandWrapper {
    private readonly pythonCommandExecutor: PythonCommandExecutor;

    public constructor(pythonCommand: string) {
        this.pythonCommandExecutor = new PythonCommandExecutor(pythonCommand);
    }

    public async getFlowTestRuleDescriptions(): Promise<FlowTestRuleDescriptor[]> {
        const pythonArgs: string[] = [
            PATH_TO_PIPX_PYZ,
            'run',
            '--spec',
            PATH_TO_FLOWTEST_ROOT,
            '--',
            'flowtest',
            '-p'
        ];

        let stdout: string = '';
        const processStdout = (stdoutMsg: string) => {
            stdout += stdoutMsg;
        }
        await this.pythonCommandExecutor.exec(pythonArgs, processStdout);
        // We typically try to avoid reading output directly from stdout, but in this case there's no option to write the rule
        // descriptions to a file, so we have no choice. At the very least, we can wrap it in a try-catch.
        try {
            return JSON.parse(stdout) as FlowTestRuleDescriptor[];
        } catch (e) {
            throw new Error(getMessage('CouldNotParseRuleDescriptions', stdout));
        }
    }

    public async runFlowTestRules(dir: string, completionPercentageHandler: (percentage: number) => void): Promise<FlowTestExecutionResult> {
        const tmpFile: string = this.createTmpFileName();
        const pythonArgs: string[] = [
            PATH_TO_PIPX_PYZ,
            'run',
            '--spec',
            PATH_TO_FLOWTEST_ROOT,
            '--',
            'flowtest',
            '-j',
            tmpFile,
            '-d',
            dir
        ];

        const processStdout = (stdoutMsg: string) => {
            // If the message doesn't start with our status delimiter, then we don't care.
            if (!stdoutMsg.startsWith(STATUS_DELIMITER)) {
                return;
            }
            // Rip off the status delimiter and then attempt to parse a Float out of the status update.
            const percentageFlowsScanned: number = parseFloat(stdoutMsg.slice(STATUS_DELIMITER.length));
            // If we successfully parsed a Float, pass it through the completion percentage processor.
            if (!Number.isNaN(percentageFlowsScanned)) {
                completionPercentageHandler(percentageFlowsScanned);
            }
        }

        await this.pythonCommandExecutor.exec(pythonArgs, processStdout);

        const outputFileContents: string = await fsp.readFile(tmpFile, {encoding: 'utf-8'});

        let parsedResults: object;
        try {
            parsedResults = JSON.parse(outputFileContents);
        } catch (e) {
            throw new Error(getMessage('ResultsFileNotValidJson', outputFileContents));
        }

        if (!this.executionResultsAreValid(parsedResults)) {
            throw new Error(getMessage('CouldNotParseExecutionResults', JSON.stringify(parsedResults)));
        }

        return parsedResults;
    }

    private createTmpFileName(): string {
        return path.join(os.tmpdir(), `flow-test-execution-${Date.now()}.json`);
    }

    // istanbul ignore next
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private executionResultsAreValid(executionResults: any): executionResults is FlowTestExecutionResult {
        if (!('results' in executionResults) || typeof executionResults.results !== 'object') {
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: any = executionResults.results;

        for (const key of Object.keys(results)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result: any = results[key];
            if (!Array.isArray(result)) {
                return false;
            }
            for (const ruleResult of result) {
                if (!this.ruleResultIsValid(ruleResult)) {
                    return false;
                }
            }
        }
        return true;
    }

    // istanbul ignore next
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private ruleResultIsValid(ruleResult: any): ruleResult is FlowTestRuleResult {
        if (!('query_name' in ruleResult) || typeof ruleResult.query_name !== 'string') {
            return false;
        }
        if (!('severity' in ruleResult) || typeof ruleResult.severity !== 'string') {
            return false;
        }
        if (!('description' in ruleResult) || typeof ruleResult.description !== 'string') {
            return false;
        }
        if (!('elem' in ruleResult) || typeof ruleResult.elem !== 'string') {
            return false;
        }
        if (!('elem_name' in ruleResult) || typeof ruleResult.elem_name !== 'string') {
            return false;
        }
        if (!('field' in ruleResult) || typeof ruleResult.field !== 'string') {
            return false;
        }
        if (!('flow' in ruleResult) || !(Array.isArray(ruleResult.flow))) {
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flowNodes: any[] = ruleResult.flow;
        for (const flowNode of flowNodes) {
            if (!this.flowNodeIsValid(flowNode)) {
                return false;
            }
        }
        return true;
    }

    // istanbul ignore next
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private flowNodeIsValid(flowNode: any): flowNode is FlowNodeDescriptor {
        if (!('influenced_var' in flowNode) || typeof flowNode.influenced_var !== 'string') {
            return false;
        }
        if (!('influencer_var' in flowNode) || typeof flowNode.influencer_var !== 'string') {
            return false;
        }
        if (!('element_name' in flowNode) || typeof flowNode.element_name !== 'string') {
            return false;
        }
        if (!('comment' in flowNode) || typeof flowNode.comment !== 'string') {
            return false;
        }
        if (!('flow_path' in flowNode) || typeof flowNode.flow_path !== 'string') {
            return false;
        }
        if (!('line_no' in flowNode) || typeof flowNode.line_no !== 'number') {
            return false;
        }
        return 'source_text' in flowNode && typeof flowNode.source_text === 'string';
    }
}