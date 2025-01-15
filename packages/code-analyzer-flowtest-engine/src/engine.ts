import path from 'node:path';
import * as fs from 'node:fs/promises';
import {
    CodeLocation,
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from './messages';
import {
    FlowNodeDescriptor,
    FlowTestCommandWrapper,
    FlowTestExecutionResult
} from "./python/FlowTestCommandWrapper";
import {getConsolidatedRuleName, getConsolidatedRuleNames, getConsolidatedRuleByName} from "./hardcoded-catalog";

/**
 * An arbitrarily chosen value for how close the engine is to completion before the underlying FlowTest tool is invoked,
 * expressed as a percentage.
 */
const PRE_INVOCATION_RUN_PERCENT = 10;
/**
 * An arbitrarily chosen value for how close the engine is to completion after the underlying FlowTest tool has completed,
 * expressed as a percentage.
 */
const POST_INVOCATION_RUN_PERCENT = 90;

export class FlowTestEngine extends Engine {
    public static readonly NAME: string = 'flowtest';
    private readonly commandWrapper: FlowTestCommandWrapper;
    private relevantFilesCache: Map<string, string[]> = new Map();

    public constructor(commandWrapper: FlowTestCommandWrapper) {
        super();
        this.commandWrapper =  commandWrapper;
    }

    public getName(): string {
        return FlowTestEngine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    public async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        if (describeOptions.workspace && (await this.getRelevantFiles(describeOptions.workspace)).length == 0) {
            this.emitLogEvent(LogLevel.Debug, 'Workspace contains no Flow files. Returning no flowtest rules.');
            this.emitDescribeRulesProgressEvent(100);
            return [];
        }
        this.emitDescribeRulesProgressEvent(75);
        const consolidatedNames: string[] = getConsolidatedRuleNames();
        const convertedRules: RuleDescription[] = consolidatedNames.map(getConsolidatedRuleByName);
        this.emitDescribeRulesProgressEvent(100);
        return convertedRules;
    }

    public async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
        const relevantFiles: string[] = await this.getRelevantFiles(runOptions.workspace);
        if (relevantFiles.length == 0) {
            return { violations: [] };
        }

        const workspaceRoot: string | null = runOptions.workspace.getWorkspaceRoot();
        // If we can't identify a single directory as the root of the workspace, then there's nothing for us to pass into
        // FlowTest. So just throw an error and be done with it.
        // NOTE: The only known case where this can occur is if a Windows user is scanning files on two different drives
        //       (e.g., "C:" and "D:"). Since this is an extreme edge case, it's one we're willing to tolerate.
        if (workspaceRoot === null) {
            throw new Error(getMessage('WorkspaceLacksIdentifiableRoot', runOptions.workspace.getFilesAndFolders().join(', ')));
        }
        this.emitRunRulesProgressEvent(PRE_INVOCATION_RUN_PERCENT);
        const percentageUpdateHandler = /* istanbul ignore next */ (percentage: number) => {
            this.emitRunRulesProgressEvent(normalizeRelativeCompletionPercentage(percentage));
        }
        const executionResults: FlowTestExecutionResult = await this.commandWrapper.runFlowTestRules(workspaceRoot, percentageUpdateHandler);
        const convertedResults: EngineRunResults = toEngineRunResults(executionResults, ruleNames, relevantFiles);
        this.emitRunRulesProgressEvent(100);
        return convertedResults;
    }

    private async getRelevantFiles(workspace: Workspace): Promise<string[]> {
        const cacheKey: string = workspace.getWorkspaceId();
        if (!this.relevantFilesCache.has(cacheKey)) {
            const relevantFiles: string[] = (await workspace.getExpandedFiles()).filter(fileIsFlowFile);
            this.relevantFilesCache.set(cacheKey, relevantFiles);
        }
        return this.relevantFilesCache.get(cacheKey)!;
    }
}

function fileIsFlowFile(fileName: string): boolean {
    const lowerCaseFileName = fileName.toLowerCase();
    return lowerCaseFileName.endsWith('.flow') || lowerCaseFileName.endsWith('.flow-meta.xml');
}

/**
 * Accepts a percentage indicating the completion percentage of the underlying FlowTest tool, and converts it into a
 * percentage representing the completion percentage of the engine as a whole.
 * @param flowTestPercentage Completion percentage received from the FlowTest tool.
 */
// istanbul ignore next
function normalizeRelativeCompletionPercentage(flowTestPercentage: number): number {
    const percentageSpread: number = POST_INVOCATION_RUN_PERCENT - PRE_INVOCATION_RUN_PERCENT;
    return PRE_INVOCATION_RUN_PERCENT + ((flowTestPercentage * percentageSpread) / 100);
}

function toEngineRunResults(flowTestExecutionResult: FlowTestExecutionResult, requestedRules: string[], relevantFiles: string[]): EngineRunResults {
    const requestedRulesSet: Set<string> = new Set(requestedRules);
    const relevantFileSet: Set<string> = new Set(relevantFiles);
    const results: EngineRunResults = {
        violations: []
    };

    for (const queryName of Object.keys(flowTestExecutionResult.results)) {
        const flowTestRuleResults = flowTestExecutionResult.results[queryName];
        for (const flowTestRuleResult of flowTestRuleResults) {
            const ruleName = getConsolidatedRuleName(flowTestRuleResult.query_name);
            // FlowTest runs extremely quickly, and its rule selection is fiddly. So it's easier to just run all the rules,
            // and then throw away results for rules that the user didn't request.
            if (!requestedRulesSet.has(ruleName)) {
                continue;
            }
            // FlowTest has some logic to try and discover referenced Subflows in nearby directories. If it can find the
            // Subflow, then it is pulled into analysis, and if it can't, then the parent flow analysis ceases.
            // This can technically create situations where Violations are present referencing Flows that are not part
            // of the Workspace. To combat this, we iterate over the files referenced and discard a Violation if it references
            // files that are not part of the Workspace.
            const flowNodes: FlowNodeDescriptor[] = flowTestRuleResult.flow;
            if (flowNodes.some(node => !relevantFileSet.has(node.flow_path))) {
                continue;
            }

            results.violations.push({
                ruleName,
                message: flowTestRuleResult.description,
                codeLocations: toCodeLocationList(flowNodes),
                primaryLocationIndex: flowTestRuleResult.flow.length - 1,
                resourceUrls: []
            });
        }
    }
    return results;
}

function toCodeLocationList(flowNodes: FlowNodeDescriptor[]): CodeLocation[] {
    const results: CodeLocation[] = [];
    let previousFullVariable: string = '';
    for (let i = 0; i < flowNodes.length; i++) {
        const fullVariable = `${flowNodes[i].element_name}.${flowNodes[i].influenced_var}`;
        const comment: string = i == 0 ?
            getMessage('FirstNodeComment', fullVariable, flowNodes[i].comment) :
            getMessage('SubsequentNodeComment', previousFullVariable, fullVariable, flowNodes[i].comment);
        results.push({
            file: flowNodes[i].flow_path,
            startLine: flowNodes[i].line_no,
            startColumn: 1,
            comment: comment
        });
        previousFullVariable = fullVariable;
    }
    return results;
}