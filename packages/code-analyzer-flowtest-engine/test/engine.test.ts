import path from 'node:path';
import {
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    RuleDescription,
    RunRulesProgressEvent,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "../src/engine";
import {RunTimeFlowTestCommandWrapper} from "../src/python/FlowTestCommandWrapper";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

const PATH_TO_NO_FLOWS_WORKSPACE = path.resolve(__dirname, 'test-data', 'example workspaces', 'contains-no-flows');
const PATH_TO_MULTIPLE_FLOWS_WORKSPACE = path.resolve(__dirname, 'test-data', 'example workspaces', 'contains-multiple-flows');
const PATH_TO_ONE_FLOW_NO_VIOLATIONS_WORKSPACE = path.resolve(__dirname, 'test-data', 'example workspaces', 'contains-one-flow-no-violations');
const PATH_TO_EXAMPLE1: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example1-containsWithoutSharingViolations.flow-meta.xml');
const PATH_TO_EXAMPLE2: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example2-containsWithSharingViolations.flow');
const PATH_TO_EXAMPLE3: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example3-containsNoViolations.flow');

describe('Tests for the FlowTestEngine', () => {
    const flowtestCommandWrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper('python3');

    it('getName() returns correct name', () => {
        const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);
        expect(engine.getName()).toEqual('flowtest');
    });

    describe('End-to-End tests', () => {
        const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);
        const workspace: Workspace = new Workspace([PATH_TO_MULTIPLE_FLOWS_WORKSPACE]);

        it('Engine can describe rules, run them, and convert the results into standard format', async () => {
            const describeProgressEvents: DescribeRulesProgressEvent[] = [];
            engine.onEvent(EventType.DescribeRulesProgressEvent, (e: DescribeRulesProgressEvent) => describeProgressEvents.push(e));
            const runProgressEvents: RunRulesProgressEvent[] = [];
            engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => runProgressEvents.push(e));

            // Part 1: Describing production rules.
            const ruleDescriptors: RuleDescription[] = await engine.describeRules({workspace});
            // No need to do in-depth examination of the rules, since other tests already do that. Just make sure we got
            // the right number of rules.
            expect(ruleDescriptors).toHaveLength(2);
            expect(describeProgressEvents.map(e => e.percentComplete)).toEqual([0, 75, 100]);

            // Part 2: Running production rules.
            const results: EngineRunResults = await engine.runRules(ruleDescriptors.map(r => r.name), {workspace});
            // No need to do in-depth examination of the results, since other tests already do that. Just make sure we
            // got the right number of violations.
            expect(results.violations).toHaveLength(4);
            expect(runProgressEvents.map(e => e.percentComplete)).toEqual([0, 10, 10, 36.64, 63.36, 100]);
        });
    });

    describe('Unit tests', () => {
        describe('#describeRules()', () => {
            describe('Rule description parsing', () => {
                it('Consolidates well-formed FlowTest rule descriptors into Code Analyzer rule descriptors', async () => {
                    const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules({});

                    expect(ruleDescriptors).toHaveLength(2);
                    expect(ruleDescriptors[0]).toEqual({
                        name: 'PreventPassingUserDataIntoElementWithoutSharing',
                        severityLevel: SeverityLevel.High,
                        tags: ['Recommended', 'Security', 'Xml'],
                        description: 'Avoid passing user data into flow elements in run mode: Without Sharing',
                        resourceUrls: []
                    });
                    expect(ruleDescriptors[1]).toEqual({
                        name: 'PreventPassingUserDataIntoElementWithSharing',
                        severityLevel: SeverityLevel.Low,
                        tags: ['Recommended', 'Security', 'Xml'],
                        description: 'Avoid passing user data into flow elements in run mode: With Sharing',
                        resourceUrls: []
                    });
                });
            });

            describe('Workspace processing', () => {
                it.each([
                    {desc: 'is undefined', workspace: undefined},
                    {
                        desc: 'contains *.flow-meta.xml files only',
                        workspace: new Workspace([PATH_TO_EXAMPLE1])
                    },
                    {
                        desc: 'contains *.flow files only',
                        workspace: new Workspace([PATH_TO_EXAMPLE2])
                    },
                    {
                        desc: 'contains *.flow-meta.xml and *.flow files',
                        workspace: new Workspace([PATH_TO_MULTIPLE_FLOWS_WORKSPACE])
                    },
                ])('When workspace $desc, rules are returned', async ({workspace}) => {
                    const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules({workspace});

                    expect(ruleDescriptors).toHaveLength(2);
                });

                it.each([
                    {
                        desc: 'is folder that contains no flow files',
                        workspace: new Workspace([PATH_TO_NO_FLOWS_WORKSPACE])
                    },
                    {
                        desc: 'is file that is not a flow file but lives in a folder with flow files',
                        workspace: new Workspace([path.resolve(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'shouldNotGetPickedUpByFlowTest.xml')])
                    },
                ])('When workspace $desc, no rules are returned', async ({workspace}) => {
                    const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules({workspace});

                    expect(ruleDescriptors).toHaveLength(0);
                });
            });
        });

        describe('#runRules', () => {

            const expectedExample1Violation1: Violation = {
                codeLocations: [
                    {
                        comment: "change_subject_of_case.change_subject_of_case: Initialization",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 124
                    },
                    {
                        comment: "change_subject_of_case.change_subject_of_case influences change_subj_assignment.another_case_holder.Subject: Variable Assignment",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 26
                    },
                    {
                        comment: "change_subj_assignment.another_case_holder.Subject influences update_to_new_subject.update_to_new_subject: flow into recordUpdates via influence over update_to_new_subject in run mode SystemModeWithoutSharing",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 102
                    }
                ],
                message: "User controlled data flows into recordUpdates element data in run mode: SystemModeWithoutSharing",
                primaryLocationIndex: 2,
                resourceUrls: [],
                ruleName: "PreventPassingUserDataIntoElementWithoutSharing"
            };

            const expectedExample1Violation2: Violation = {
                codeLocations: [
                    {
                        comment: "change_subject_of_case.change_subject_of_case: Initialization",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 124
                    },
                    {
                        comment: "change_subject_of_case.change_subject_of_case influences change_subj_assignment.another_case_holder.Subject: Variable Assignment",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 26
                    },
                    {
                        comment: "change_subj_assignment.another_case_holder.Subject influences delete_created_case.delete_created_case: flow into recordDeletes via influence over delete_created_case in run mode SystemModeWithoutSharing",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 69
                    }
                ],
                message: "User controlled data flows into recordDeletes element selector in run mode: SystemModeWithoutSharing",
                primaryLocationIndex: 2,
                resourceUrls: [],
                ruleName: "PreventPassingUserDataIntoElementWithoutSharing"
            };

            const expectedExample2Violation1: Violation = {
                codeLocations: [
                    {
                        comment: "change_subject_of_case.change_subject_of_case: Initialization",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 124
                    },
                    {
                        comment: "change_subject_of_case.change_subject_of_case influences change_subj_assignment.another_case_holder.Subject: Variable Assignment",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 26
                    },
                    {
                        comment: "change_subj_assignment.another_case_holder.Subject influences update_to_new_subject.update_to_new_subject: flow into recordUpdates via influence over update_to_new_subject in run mode SystemModeWithSharing",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 102
                    }
                ],
                message: "User controlled data flows into recordUpdates element data in run mode: SystemModeWithSharing",
                primaryLocationIndex: 2,
                resourceUrls: [],
                ruleName: "PreventPassingUserDataIntoElementWithSharing"
            };

            const expectedExample2Violation2: Violation = {
                codeLocations: [
                    {
                        comment: "change_subject_of_case.change_subject_of_case: Initialization",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 124
                    },
                    {
                        comment: "change_subject_of_case.change_subject_of_case influences change_subj_assignment.another_case_holder.Subject: Variable Assignment",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 26
                    },
                    {
                        comment: "change_subj_assignment.another_case_holder.Subject influences delete_created_case.delete_created_case: flow into recordDeletes via influence over delete_created_case in run mode SystemModeWithSharing",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 69
                    }
                ],
                message: "User controlled data flows into recordDeletes element selector in run mode: SystemModeWithSharing",
                primaryLocationIndex: 2,
                resourceUrls: [],
                ruleName: "PreventPassingUserDataIntoElementWithSharing"
            };

            let engine: FlowTestEngine;
            beforeEach(() => {
                engine = new FlowTestEngine(flowtestCommandWrapper);
            });

            afterEach(() => {
                jest.restoreAllMocks();
            });

            it('If Workspace has no root, throws an error', async () => {
                // ==== SETUP ====
                // Stub out the Workspace's getRoot method so it returns null.
                jest.spyOn(Workspace.prototype, 'getWorkspaceRoot').mockImplementation(() => {
                    return null;
                });

                // ==== TESTED BEHAVIOR ====
                // Specify a rule. It doesn't matter which one.
                const selectedRuleNames: string[] = ['PreventPassingUserDataIntoElementWithoutSharing'];
                // Specify files. It doesn't matter which.
                const workspaceFiles: string[] = [PATH_TO_EXAMPLE1];
                await expect(engine.runRules(selectedRuleNames, { workspace: new Workspace(workspaceFiles) }))
                    // Expect the error message to mention the lack of a root directory
                    .rejects.toThrow('has no identifiable root directory');
            });

            it('When running both rules on workspace that contains violations for SystemModeWithoutSharing and SystemModeWithSharing, then results are as expected', async () => {
                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];
                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, {
                    workspace: new Workspace([PATH_TO_MULTIPLE_FLOWS_WORKSPACE])
                });

                expect(engineResults.violations).toHaveLength(4);
                expect(engineResults.violations).toContainEqual(expectedExample1Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample1Violation2);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation2);
            });

            it('When running only one rule on workspace that contains violations for multiple rules, then results should only contain results for the selected rule', async () => {
                const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);

                const selectedRuleNames: string[] = ['PreventPassingUserDataIntoElementWithoutSharing'];
                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, {
                    workspace: new Workspace([PATH_TO_MULTIPLE_FLOWS_WORKSPACE])
                });

                expect(engineResults.violations).toHaveLength(2);
                expect(engineResults.violations).toContainEqual(expectedExample1Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample1Violation2);
            });

            it('When workspace includes only some files from within a folder, then filters out results for files outside of workspace', async () => {
                const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);

                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];

                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, {
                    workspace: new Workspace([PATH_TO_EXAMPLE2])
                });

                expect(engineResults.violations).toHaveLength(2);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation2);
            });

            it('When workspace does not contain flow files, then return zero violations', async () => {
                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];
                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, {
                    workspace: new Workspace([PATH_TO_NO_FLOWS_WORKSPACE])
                });

                expect(engineResults.violations).toHaveLength(0);
            });

            it('When workspace contains flow files that have no violations but is in folder with other flow files that do have violations, then return valid results with zero violations', async () => {
                const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);

                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];

                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, {
                    workspace: new Workspace([PATH_TO_EXAMPLE3])
                });

                expect(engineResults.violations).toHaveLength(0);
            });

            it('When workspace contains a flow file that has no violations and no other flow files are in the folder, then return valid results with zero violations', async () => {
                // Note that this test is needed because the implementation today currently runs flowtest on the
                // workspace root, and then we filter out the results based on the workspace files. Without this test
                // we might miss the flowtest utility returning results: null.
                // See https://git.soma.salesforce.com/SecurityTools/FlowSecurityLinter/issues/59
                const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);

                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];

                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, {
                    workspace: new Workspace([PATH_TO_ONE_FLOW_NO_VIOLATIONS_WORKSPACE])
                });

                expect(engineResults.violations).toHaveLength(0);
            });

            // TODO: Add in test that has violation that spans multiple files (parent flow file to sub flow file)
            //       --> Waiting for valid flow files example from Robert Sussland
        });

        describe('#getEngineVersion', () => {
            it('Returns something resembling a Semantic Version', async () => {
                const engine: FlowTestEngine = new FlowTestEngine(flowtestCommandWrapper);
                const version: string = await engine.getEngineVersion();

                expect(version).toMatch(/\d+\.\d+\.\d+.*/);
            });
        });
    });
});