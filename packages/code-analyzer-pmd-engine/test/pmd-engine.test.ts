import {PmdEngine} from "../src/engines";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the PmdEngine', () => {
    it('When getName is called, then pmd is returned', () => {
        const engine: PmdEngine = new PmdEngine();
        expect(engine.getName()).toEqual('pmd');
    });

    it('TEMPORARY TEST FOR CODE COVERAGE', async () => {
        // Will delete this test as soon as we implement the CpdEngine.
        const engine: PmdEngine = new PmdEngine();
        expect(await engine.describeRules({})).toEqual([]);
        expect(await engine.runRules([],{workspace: testTools.createWorkspace([__dirname])})).toEqual({violations: []});
    });
});