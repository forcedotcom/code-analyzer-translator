import {
    CodeLocation,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation
} from "@salesforce/code-analyzer-engine-api";
import {RetireJsEnginePlugin} from "../src";
import {RetireJsEngine} from "../src/engine";
import {RetireJsExecutor} from "../src/executor";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import path from "node:path";
import fs from "node:fs";
import {Finding} from "retire/lib/types";
import {getMessage} from "../src/messages";

changeWorkingDirectoryToPackageRoot();

const EXPECTED_CODE_LOCATION_1: CodeLocation = {
    file: "/temp/some-folder/jquery-3.1.0.js",
    startLine: 1,
    startColumn: 1
}

const EXPECTED_CODE_LOCATION_2: CodeLocation = {
    file: "/temp/someZipFile.zip",
    startLine: 1,
    startColumn: 1
}

const EXPECTED_VIOLATION_1: Violation = {
    ruleName: "LibraryWithKnownMediumSeverityVulnerability",
    codeLocations: [EXPECTED_CODE_LOCATION_1],
    primaryLocationIndex: 0,
    message: `${getMessage('LibraryContainsKnownVulnerability', 'jquery v3.1.0')} ${getMessage('UpgradeToLatestVersion')}\n`
        + getMessage('VulnerabilityDetails', `{\n  "summary": "jQuery before 3.4.0, as used in Drupal, Backdrop CMS, and other products, mishandles jQuery.extend(true, {}, ...) because of Object.prototype pollution",\n  "CVE": [\n    "CVE-2019-11358"\n  ],\n  "PR": "4333",\n  "githubID": "GHSA-6c3j-c64m-qhgq"\n}`),
    resourceUrls: [
        "https://blog.jquery.com/2019/04/10/jquery-3-4-0-released/",
        "https://github.com/jquery/jquery/commit/753d591aea698e57d6db58c9f722cd0808619b1b",
        "https://nvd.nist.gov/vuln/detail/CVE-2019-11358"
    ]
};

const EXPECTED_VIOLATION_2: Violation = {
    ruleName: "LibraryWithKnownMediumSeverityVulnerability",
    codeLocations: [EXPECTED_CODE_LOCATION_1],
    primaryLocationIndex: 0,
    message: `${getMessage('LibraryContainsKnownVulnerability', 'jquery v3.1.0')} ${getMessage('UpgradeToLatestVersion')}\n`
        + getMessage('VulnerabilityDetails', `{\n  "summary": "passing HTML containing <option> elements from untrusted sources - even after sanitizing it - to one of jQuery's DOM manipulation methods (i.e. .html(), .append(), and others) may execute untrusted code.",\n  "CVE": [\n    "CVE-2020-11023"\n  ],\n  "issue": "4647",\n  "githubID": "GHSA-jpcq-cgw6-v4j6"\n}`),
    resourceUrls: [
        "https://blog.jquery.com/2020/04/10/jquery-3-5-0-released/"
    ],
}

const EXPECTED_VIOLATION_3: Violation = {
    ruleName: "LibraryWithKnownHighSeverityVulnerability",
    codeLocations: [EXPECTED_CODE_LOCATION_1],
    primaryLocationIndex: 0,
    message: `${getMessage('LibraryContainsKnownVulnerability', 'jquery v3.1.0')} ${getMessage('UpgradeToLatestVersion')}\n`
        + getMessage('VulnerabilityDetails', `{\n  "summary": "Regex in its jQuery.htmlPrefilter sometimes may introduce XSS",\n  "CVE": [\n    "CVE-2020-11022"\n  ],\n  "issue": "4642",\n  "githubID": "GHSA-gxr4-xjj5-5px2"\n}`),
    resourceUrls: [
        "https://blog.jquery.com/2020/04/10/jquery-3-5-0-released/"
    ]
}

const EXPECTED_VIOLATION_4: Violation = {
    ruleName: "LibraryWithKnownLowSeverityVulnerability",
    codeLocations: [EXPECTED_CODE_LOCATION_2],
    primaryLocationIndex: 0,
    message: `${getMessage('VulnerableLibraryFoundInZipArchive', 'sessvars v1.0.0', 'innerFolder/sessvars-1.0.0.min.js')} ${getMessage('UpgradeToLatestVersion')}\n`
        + getMessage('VulnerabilityDetails', `{\n  "summary": "Unsanitized data passed to eval()",\n  "CVE": [\n    "CWE-79"\n  ]\n}`),
    resourceUrls: [
        "http://www.thomasfrank.se/sessionvars.html"
    ]
}

describe('Tests for the RetireJsEnginePlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new RetireJsEnginePlugin();
    });

    it('When the getAvailableEngineNames method is called then only retire-js is returned', () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['retire-js']);
    });

    it('When createEngine is passed retire-js then an RetireJsEngine instance is returned', () => {
        expect(plugin.createEngine('retire-js', {})).toBeInstanceOf(RetireJsEngine);
    });

    it('When createEngine is passed anything else then an error is thrown', () => {
        expect(() => plugin.createEngine('oops', {})).toThrow(
            getMessage('CantCreateEngineWithUnknownEngineName' ,'oops'));
    });
});

describe('Tests for the RetireJsEngine', () => {
    let engine: Engine;
    beforeEach(() => {
        engine = new RetireJsEngine(new StubRetireJsExecutor());
    });

    it('When getName is called, then retire-js is returned', () => {
        expect(engine.getName()).toEqual('retire-js');
    });

    it('When validate is called, then nothing happens since it currently is a no-op', async () => {
        await engine.validate(); // Sanity check that nothing blows up since the core module will call this.
    });

    it('When describeRules is called, then the expected rules are returned', async () => {
        const ruleDescriptions: RuleDescription[] = await engine.describeRules();
        expect(ruleDescriptions).toHaveLength(4);
        expect(ruleDescriptions).toContainEqual({
            name: 'LibraryWithKnownCriticalSeverityVulnerability',
            severityLevel: SeverityLevel.Critical,
            type: RuleType.Standard,
            tags: ['Recommended'],
            description: getMessage('RetireJsRuleDescription', 'critical'),
            resourceUrls: ['https://retirejs.github.io/retire.js/']
        });
        expect(ruleDescriptions).toContainEqual({
            name: 'LibraryWithKnownHighSeverityVulnerability',
            severityLevel: SeverityLevel.High,
            type: RuleType.Standard,
            tags: ['Recommended'],
            description: getMessage('RetireJsRuleDescription', 'high'),
            resourceUrls: ['https://retirejs.github.io/retire.js/']
        });
        expect(ruleDescriptions).toContainEqual({
            name: 'LibraryWithKnownMediumSeverityVulnerability',
            severityLevel: SeverityLevel.Moderate,
            type: RuleType.Standard,
            tags: ['Recommended'],
            description: getMessage('RetireJsRuleDescription', 'medium'),
            resourceUrls: ['https://retirejs.github.io/retire.js/']
        });
        expect(ruleDescriptions).toContainEqual({
            name: 'LibraryWithKnownLowSeverityVulnerability',
            severityLevel: SeverityLevel.Low,
            type: RuleType.Standard,
            tags: ['Recommended'],
            description: getMessage('RetireJsRuleDescription', 'low'),
            resourceUrls: ['https://retirejs.github.io/retire.js/']
        });
    });

    it('When runRules is called, then the RetireJsExecutor is called with the correct inputs', async () => {
        // Note: This test replaces the StubRetireJsExecutor with a SpyRetireJsExecutor instead.
        const spyExecutor: SpyRetireJsExecutor = new SpyRetireJsExecutor();
        engine = new RetireJsEngine(spyExecutor);

        const allRuleNames: string[] = (await engine.describeRules()).map(r => r.name);
        const filesAndFoldersToScan: string[] = [path.resolve('build-tools'), path.resolve('test/test-helpers.ts')];
        const runOptions: RunOptions = {
            workspaceFiles: filesAndFoldersToScan,
            pathStartPoints: [{file: 'test/test-helpers.ts'}] // Sanity check that this should be ignored by this engine
        };
        const results: EngineRunResults = await engine.runRules(allRuleNames, runOptions);

        expect(spyExecutor.executeCallHistory).toEqual([{filesAndFoldersToScan: filesAndFoldersToScan}]);
        expect(results).toEqual({violations: []}); // Sanity check that zero vulnerabilities gives zero violations.
    });

    it('When using all rules and violations are found, then the engine correctly returns the results', async () => {
        const allRuleNames: string[] = (await engine.describeRules()).map(r => r.name);
        const engineRunResults: EngineRunResults = await engine.runRules(allRuleNames, {workspaceFiles: ['dummy']});

        expect(engineRunResults.violations).toHaveLength(4);
        expect(engineRunResults.violations[0]).toEqual(EXPECTED_VIOLATION_1);
        expect(engineRunResults.violations[1]).toEqual(EXPECTED_VIOLATION_2);
        expect(engineRunResults.violations[2]).toEqual(EXPECTED_VIOLATION_3);
        expect(engineRunResults.violations[3]).toEqual(EXPECTED_VIOLATION_4);
    });

    it('When only selecting some rules, then only violations for those rules are returned', async () => {
        const engineRunResults1: EngineRunResults = await engine.runRules(
            ['LibraryWithKnownHighSeverityVulnerability', 'LibraryWithKnownLowSeverityVulnerability'],
            {workspaceFiles: ['dummy']});
        expect(engineRunResults1).toEqual({
            violations: [EXPECTED_VIOLATION_3, EXPECTED_VIOLATION_4]
        });

        const engineRunResults2: EngineRunResults = await engine.runRules(
            ['LibraryWithKnownMediumSeverityVulnerability', 'LibraryWithKnownCriticalSeverityVulnerability'],
            {workspaceFiles: ['dummy']});
        expect(engineRunResults2).toEqual({
            violations: [EXPECTED_VIOLATION_1, EXPECTED_VIOLATION_2]
        });


        const engineRunResults3: EngineRunResults = await engine.runRules(
            ['LibraryWithKnownCriticalSeverityVulnerability'], {workspaceFiles: ['dummy']});
        expect(engineRunResults3).toEqual({violations: []});
    });
});

class SpyRetireJsExecutor implements RetireJsExecutor {
    readonly executeCallHistory: {filesAndFoldersToScan: string[]}[] = [];

    async execute(filesAndFoldersToScan: string[]): Promise<Finding[]> {
        this.executeCallHistory.push({filesAndFoldersToScan});
        return [];
    }
}

class StubRetireJsExecutor implements RetireJsExecutor {
    async execute(_filesAndFoldersToScan: string[]): Promise<Finding[]> {
        const jsonStr: string = fs.readFileSync(path.resolve('test','test-data','sampleRetireJsExecutorFindings.json'),'utf-8');
        return JSON.parse(jsonStr) as Finding[];
    }
}