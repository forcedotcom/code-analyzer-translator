import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
} from "@salesforce/code-analyzer-engine-api";
import {toEngineRunResults, toRuleDescription} from './utils';
import {getMessage} from './messages';
import {FlowTestCommandWrapper, FlowTestExecutionResult, FlowTestRuleDescriptor} from "./python/FlowTestCommandWrapper";

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

    public constructor(commandWrapper: FlowTestCommandWrapper) {
        super();
        this.commandWrapper =  commandWrapper;
    }

    public getName(): string {
        return FlowTestEngine.NAME;
    }

    public async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        if (describeOptions.workspace) {
            const workspaceFiles: string[] = await describeOptions.workspace.getExpandedFiles();
            // If a workspace is provided but it contains no flow files, then return no rules.
            if (!workspaceFiles.some(fileIsFlowFile)) {
                this.emitLogEvent(LogLevel.Debug, 'Workspace contains no Flow files; returning no rules');
                this.emitDescribeRulesProgressEvent(100);
                return [];
            }
        }
        const flowTestRules: FlowTestRuleDescriptor[] = await this.commandWrapper.getFlowTestRuleDescriptions();
        this.emitDescribeRulesProgressEvent(75);
        const convertedRules = flowTestRules.map(toRuleDescription);
        this.emitDescribeRulesProgressEvent(100);
        return convertedRules;
    }

    public async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
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
            this.emitDescribeRulesProgressEvent(normalizeRelativeCompletionPercentage(percentage));
        }
        const executionResults: FlowTestExecutionResult = await this.commandWrapper.runFlowTestRules(workspaceRoot, percentageUpdateHandler);
        const convertedResults: EngineRunResults = toEngineRunResults(executionResults, ruleNames, await runOptions.workspace.getExpandedFiles());
        this.emitRunRulesProgressEvent(100);
        return convertedResults;
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