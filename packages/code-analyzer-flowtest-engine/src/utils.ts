import {EngineRunResults, RuleDescription, RuleType, SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import {FlowNodeDescriptor, FlowTestExecutionResult, FlowTestRuleDescriptor, FlowTestRuleResult} from "./python/FlowTestCommandWrapper";


export function toRuleDescription(flowTestRule: FlowTestRuleDescriptor): RuleDescription {
    return {
        // The name maps directly over.
        name: toCodeAnalyzerName(flowTestRule.query_name),
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

export function toEngineRunResults(flowTestExecutionResult: FlowTestExecutionResult, requestedRules: string[], allowedFiles: string[]): EngineRunResults {
    const requestedRulesSet: Set<string> = new Set(requestedRules);
    const allowedFilesSet: Set<string> = new Set(allowedFiles);
    const results: EngineRunResults = {
        violations: []
    };

    for (const queryName of Object.keys(flowTestExecutionResult.results)) {
        const flowTestRuleResults = flowTestExecutionResult.results[queryName];
        for (const flowTestRuleResult of flowTestRuleResults) {
            const ruleName = toCodeAnalyzerName(flowTestRuleResult.query_name);
            if (!requestedRulesSet.has(ruleName)) {
                continue;
            }
            const flowNodes: FlowNodeDescriptor[] = flowTestRuleResult.flow;
            if (flowNodes.some(node => !allowedFilesSet.has(node.flow_path))) {
                continue;
            }

            results.violations.push({
                ruleName: toCodeAnalyzerName(flowTestRuleResult.query_name),
                message: toCodeAnalyzerViolationMessage(flowTestRuleResult),
                codeLocations: flowTestRuleResult.flow.map(node => {
                    return {
                        file: node.flow_path,
                        startLine: node.line_no,
                        startColumn: 1
                    }
                }),
                primaryLocationIndex: flowTestRuleResult.flow.length - 1,
                resourceUrls: []
            });
        }
    }
    return results;
}

function toCodeAnalyzerName(queryName: string): string {
    return queryName.replaceAll('Flow: ', '').replaceAll(' ', '-').toLowerCase();
}

function toCodeAnalyzerViolationMessage(flowTestRuleResult: FlowTestRuleResult): string {
    const description: string = flowTestRuleResult.description;
    const elementList: string[] = flowTestRuleResult.flow.map(node => `${node.element_name}.${node.influenced_var}`);
    return `${description}; ${elementList.join(' => ')}`;
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