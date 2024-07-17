import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {getMessage} from "../src/messages";
import {EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {PmdCpdEnginesPlugin} from "../src";
import {CpdEngine, PmdEngine} from "../src/engines";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the PmdCpdEnginesPlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new PmdCpdEnginesPlugin();
    });

    it(`When the getAvailableEngineNames method is called then both 'cpd' and 'pmd' are returned`, () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['cpd', 'pmd']);
    });

    it(`When createEngine is passed 'cpd' then the CpdEngine is returned`, async () => {
        expect(await plugin.createEngine('cpd', {})).toBeInstanceOf(CpdEngine);
    });

    it(`When createEngine is passed 'pmd' then the PmdEngine is returned`, async () => {
        expect(await plugin.createEngine('pmd', {})).toBeInstanceOf(PmdEngine);
    });

    it('When createEngine is passed an unsupported engine name, then an error is thrown', async () => {
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(
            getMessage('CantCreateEngineWithUnknownEngineName' ,'oops'));
    });
});
