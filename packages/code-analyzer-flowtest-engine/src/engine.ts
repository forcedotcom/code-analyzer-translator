import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel
} from "@salesforce/code-analyzer-engine-api";
import {FlowTestCommandWrapper, FlowTestRuleDescriptor} from "./python/FlowTestCommandWrapper";

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
                this.emitLogEvent(LogLevel.Fine, 'Workspace contains no Flow files; returning no rules');
                this.emitDescribeRulesProgressEvent(100);
                return [];
            }
        }
        const flowTestRules: FlowTestRuleDescriptor[] = await this.commandWrapper.getFlowTestRuleDescriptions();
        this.emitDescribeRulesProgressEvent(75);
        const convertedRules = flowTestRules.map(r => toRuleDescription(r));
        this.emitDescribeRulesProgressEvent(100);
        return convertedRules;
    }

    public async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);

        this.emitRunRulesProgressEvent(10);
        this.emitRunRulesProgressEvent(100);
        return {
            violations: []
        };
    }
}

function fileIsFlowFile(fileName: string): boolean {
    const lowerCaseFileName = fileName.toLowerCase();
    return lowerCaseFileName.endsWith('.flow') || lowerCaseFileName.endsWith('.flow-meta.xml');
}

function toRuleDescription(flowTestRule: FlowTestRuleDescriptor): RuleDescription {
    return {
        // The name maps directly over.
        name: flowTestRule.query_name,
        severityLevel: toCodeAnalyzerSeverity(flowTestRule.severity),
        // All rules in FlowTest are obviously Flow-type.
        type: RuleType.Flow,
        // All rules are Recommended, but not all rules are Security rules.
        tags: flowTestRule.is_security.toLowerCase() === 'true' ? ['Recommended', 'Security'] : ['Recommended'],
        // The description maps directly over.
        description: flowTestRule.query_description,
        resourceUrls: toResourceUrls(flowTestRule.help_url)
    }
}

function toCodeAnalyzerSeverity(flowTestSeverity: string): SeverityLevel {
    switch (flowTestSeverity) {
        case 'Flow_High_Severity':
            return SeverityLevel.High;
        case 'Flow_Moderate_Severity':
            return SeverityLevel.Moderate;
        case 'Flow_Low_Severity':
            return SeverityLevel.Low
    }
    throw new Error(`Developer error: invalid severity level ${flowTestSeverity}`);
}

function toResourceUrls(helpUrl: string): string[] {
    // Treat the hardcoded string "none" as equivalent to an empty string.
    if (helpUrl.toLowerCase() === 'none' || helpUrl === '') {
        return [];
    } else {
        return [helpUrl];
    }
}
