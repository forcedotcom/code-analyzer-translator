import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {Workspace} from "@salesforce/code-analyzer-engine-api";
import {CpdEngine} from "../src/cpd-engine";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the CpdEngine', () => {
    it('When getName is called, then cpd is returned', () => {
        const engine: CpdEngine = new CpdEngine();
        expect(engine.getName()).toEqual('cpd');
    });

    it('TEMPORARY TEST FOR CODE COVERAGE', async () => {
        // Will delete this test as soon as we implement the CpdEngine.
        const engine: CpdEngine = new CpdEngine();
        expect(await engine.describeRules({})).toEqual([]);
        expect(await engine.runRules([],{workspace: new Workspace([__dirname])})).toEqual({violations: []});
    });
});