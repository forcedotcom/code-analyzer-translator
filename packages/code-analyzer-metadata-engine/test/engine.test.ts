import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {MetadataEngine, MetadataEnginePlugin} from "../src/plugin";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools"
import {
    EngineRunResults,
    RuleDescription,
    RuleType,
    SeverityLevel
} from "@salesforce/code-analyzer-engine-api";

changeWorkingDirectoryToPackageRoot();

export const VIRTUAL_ABSTRACT_CLASS_API_RULE_NAME = "PrivateMethodAPIVersionRule"
export const VIRTUAL_ABSTRACT_CLASS_API_RULE_MESSAGE = "For API versions 60.0 and below, declaring a private method in an abstract or virtual class will override a method with the same signature in a child class. Please update your API version to resolve the issue."
export const VIRTUAL_ABSTRACT_CLASS_API_RULE_DESCRIPTION = "Enforces a minimum API version for declaring private methods in abstract/virtual apex classes."
export const VIRTUAL_ABSTRACT_CLASS_API_RULE_RESOURCE_URLS = []

describe('Metadata Engine Tests', () => {
    let engine: MetadataEngine;
    beforeAll(() => {
        engine = new MetadataEngine();
    });

    it('Engine name is accessible and correct', () => {
        const name: string = engine.getName();
        expect(name).toEqual("metadata");

    });

    it('Calling describeRules() on an engine should return the single trailing whitespace rule', async () => {
        const rules_desc: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([])});
        const engineRules = [
            {
                name: VIRTUAL_ABSTRACT_CLASS_API_RULE_NAME,
                severityLevel: SeverityLevel.High,
                type: RuleType.Standard,
                tags: ["Recommended", "Security"],
                description: VIRTUAL_ABSTRACT_CLASS_API_RULE_DESCRIPTION,
                resourceUrls: VIRTUAL_ABSTRACT_CLASS_API_RULE_RESOURCE_URLS
            }
        ];
        expect(rules_desc).toEqual(engineRules)
    });

    it("Check that running runRules() is a no-op that just returns an empty list of violations", async () => {
        const runOptions = {workspace: testTools.createWorkspace([])}
        const expResults: EngineRunResults = {violations: []}
        const results = await engine.runRules(["PrivateMethodAPIVersionRule"], runOptions);
        expect(results).toEqual(expResults)
    })
});

describe('MetadataEnginePlugin Tests' , () => {
    let pluginEngine: MetadataEngine
    let enginePlugin: MetadataEnginePlugin;
    beforeAll(async () => {
        enginePlugin = new MetadataEnginePlugin();
        pluginEngine = await enginePlugin.createEngine("metadata", {}) as MetadataEngine;
    });

    it('Check that I can get all available engine names', () => {
        const availableEngines: string[] = ['metadata']
        expect(enginePlugin.getAvailableEngineNames()).toStrictEqual(availableEngines)
    })

    it('Check that engine created from the MetadataEnginePlugin has expected name', () => {
        const engineName = "metadata";
        expect(pluginEngine.getName()).toStrictEqual(engineName)
    });

    it('Check that engine created from the MetadataEnginePlugin has expected output when describeRules is called', async () => {
        const expEngineRules = [
            {
                name: "PrivateMethodAPIVersionRule",
                severityLevel: SeverityLevel.High,
                type: RuleType.Standard,
                tags: ["Recommended", "Security"],
                description: VIRTUAL_ABSTRACT_CLASS_API_RULE_DESCRIPTION,
                resourceUrls: VIRTUAL_ABSTRACT_CLASS_API_RULE_RESOURCE_URLS
            }
        ];
        const engineRules: RuleDescription[] = await pluginEngine.describeRules({workspace: testTools.createWorkspace([])})
        expect(engineRules).toStrictEqual(expEngineRules)
    });

    it('If I make an engine with an invalid name, it should throw an error with the proper error message', async () => {
        await expect(enginePlugin.createEngine('OtherEngine', {})).rejects.toThrow("The MetadataEnginePlugin does not support creating an engine with name 'OtherEngine'.");
    });
});


