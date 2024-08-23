import {Workspace} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "../src/engine";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the FlowTestEngine', () => {
    it('getName() returns correct name', () => {
        const engine: FlowTestEngine = new FlowTestEngine({
            python_command: 'pre-validated value'
        });
        expect(engine.getName()).toEqual('flowtest');
    });

    it('TEMPORARY TEST FOR CODE COVERAGE', async () => {
        // Will delete this test as soon as engine is implemented.
        const engine: FlowTestEngine = new FlowTestEngine({
            python_command: 'pre-validated value'
        });
        expect(await engine.describeRules({})).toEqual([]);
        expect(await engine.runRules([], {workspace: new Workspace([__dirname])})).toEqual({violations: []});
    });
});