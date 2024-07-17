import {RegexEngine} from "../src/engine";
import {RegexEnginePlugin} from "../src";
import {RuleDescription, RuleType, SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools";

describe('Plugin Tests' , () => {
    let pluginEngine: RegexEngine
    let enginePlugin: RegexEnginePlugin;
    beforeAll(async () => {
        enginePlugin = new RegexEnginePlugin();
        pluginEngine = await enginePlugin.createEngine("regex", {}) as RegexEngine;
    });

    it('Check that I can get all available engine names', () => {
        const availableEngines: string[] = ['regex']
        expect(enginePlugin.getAvailableEngineNames()).toStrictEqual(availableEngines)
    })

    it('Check that engine created from the Plugin has expected name', () => {
        const engineName = "regex";
        expect(pluginEngine.getName()).toStrictEqual(engineName)
    });

    it('Check that engine created from the Plugin has expected output when describeRules is called', async () => {
        const expEngineRules = [
            {
                name: "TrailingWhitespaceRule",
                severityLevel: SeverityLevel.Low,
                type: RuleType.Standard,
                tags: ["Recommended", "CodeStyle"],
                description: "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.",
                resourceUrls: []
            },
        ];
        const engineRules: RuleDescription[] = await pluginEngine.describeRules({workspace: testTools.createWorkspace([])})
        expect(engineRules).toStrictEqual(expEngineRules)
    });

    it('If I make an engine with an invalid name, it should throw an error with the proper error message', async () => {
        await expect(enginePlugin.createEngine('OtherEngine', {})).rejects.toThrow("The RegexEnginePlugin does not support creating an engine with name 'OtherEngine'.");
    });
});