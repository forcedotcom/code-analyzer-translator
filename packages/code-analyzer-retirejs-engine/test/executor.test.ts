import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {AdvancedRetireJsExecutor, RetireJsExecutor, SimpleRetireJsExecutor, ZIPPED_FILE_MARKER} from "../src/executor";
import * as utils from "../src/utils";
import {Component, Finding} from "retire/lib/types";
import path from "node:path";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the AdvancedRetireJsExecutor', () => {
    let executor: RetireJsExecutor;
    beforeAll(() => {
        executor = new AdvancedRetireJsExecutor();
    });

    it('When running a directory containing no violations, then output is an empty array.', async () => {
        const findings: Finding[] = await executor.execute([await utils.createTempDir()]);
        expect(findings).toEqual([]);
    });

    it('When vulnerable js library exists in folder, then AdvancedRetireJsExecutor reports it', async () => {
        const findings: Finding[] = normalizeFindings(await executor.execute([
            path.resolve('test','test-data','scenarios','1_hasJsLibraryWithVulnerability')]));
        const expectedFindings: Finding[] = [{
                file: path.resolve('test','test-data','scenarios','1_hasJsLibraryWithVulnerability','jquery-3.1.0.js'),
                results: getExpectedJQueryResults()
            }] as Finding[];
        expect(findings).toEqual(expectedFindings);
    });

    it('When no vulnerable js libraries exists in folder, then AdvancedRetireJsExecutor reports empty findings', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','2_hasJsLibraryWithoutVulnerability')]);
        expect(findings).toEqual([]);
    });

    it('When no js libraries exists in folder, then AdvancedRetireJsExecutor reports empty findings', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','3_hasNoJsLibraries')]);
        expect(findings).toEqual([]);
    });

    it('When resource files without vulnerabilities in folder, then AdvancedRetireJsExecutor reports empty findings', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','4_hasResourceFilesWithoutVulnerabilities')]);
        expect(findings).toEqual([]);
    });

    it('When folder contains vulnerabilities in files with odd extension or no extension, then AdvancedRetireJsExecutor finds them', async () => {
        const findings: Finding[] = normalizeFindings(await executor.execute([
            path.resolve('test','test-data','scenarios','5_hasVulnerabilitiesInFilesWithOddExtOrNoExt')]));
        expect(findings).toHaveLength(2);
        expect(findings).toContainEqual({
            file: path.resolve('test','test-data','scenarios','5_hasVulnerabilitiesInFilesWithOddExtOrNoExt','JsResWithOddExt.foo'),
            results: getExpectedJQueryResults()
        });
        expect(findings).toContainEqual({
            file: path.resolve('test','test-data','scenarios','5_hasVulnerabilitiesInFilesWithOddExtOrNoExt','JsResWithoutExt'),
            results: getExpectedJQueryResults()
        });
    });

    it('When folder contains vulnerabilities within zip files, then AdvancedRetireJsExecutor finds them', async () => {
        const findings: Finding[] = normalizeFindings(await executor.execute([
            path.resolve('test','test-data','scenarios','6_hasVulnerableResourceAndZipFiles')]));
        expect(findings).toHaveLength(8);
        for (const zipFileName of ['ZipFile.zip', 'ZipFileAsResource.resource', 'ZipFileWithOddExt.foo', 'ZipFileWithNoExt']) {
            expect(findings).toContainEqual({
                file: path.resolve('test', 'test-data', 'scenarios', '6_hasVulnerableResourceAndZipFiles', zipFileName) + ZIPPED_FILE_MARKER + 'JsFileWithoutExt',
                results: getExpectedJQueryResults()
            });
            expect(findings).toContainEqual({
                file: path.resolve('test', 'test-data', 'scenarios', '6_hasVulnerableResourceAndZipFiles', zipFileName) + ZIPPED_FILE_MARKER + 'JsFileWithOddExt.foo',
                results: getExpectedJQueryResults()
            });
        }
    });

    it('When folder contains vulnerabilities in files with odd extension or no extension, then AdvancedRetireJsExecutor finds them', async () => {
        const findings: Finding[] = normalizeFindings(await executor.execute([
            path.resolve('test','test-data','scenarios','7_hasZipFolderWithVulnFileInChildFolders')]));
        expect(findings).toHaveLength(2);
        expect(findings).toContainEqual({
            file: path.resolve('test', 'test-data', 'scenarios', '7_hasZipFolderWithVulnFileInChildFolders', 'ZipWithDirectories.zip') + ZIPPED_FILE_MARKER + 'FilledParentFolder/ChildFolderWithText/JsFileWithoutExt',
            results: getExpectedJQueryResults()
        });
        expect(findings).toContainEqual({
            file: path.resolve('test', 'test-data', 'scenarios', '7_hasZipFolderWithVulnFileInChildFolders', 'ZipWithDirectories.zip') + ZIPPED_FILE_MARKER + 'FilledParentFolder/ChildFolderWithText/JsFileWithOddExt.foo',
            results: getExpectedJQueryResults()
        });
    });

    it('When files are specified among input paths, then AdvancedRetireJsExecutor knows to target that scan those files without its peers', async () => {
        const findings: Finding[] = normalizeFindings(await executor.execute([
            path.resolve('test','test-data','scenarios','1_hasJsLibraryWithVulnerability', 'jquery-3.1.0.js'),
            path.resolve('test','test-data','scenarios','6_hasVulnerableResourceAndZipFiles', 'ImageFileWithNoExt'),
            path.resolve('test','test-data','scenarios','6_hasVulnerableResourceAndZipFiles', 'ZipFileWithNoExt')
        ]));
        expect(findings).toHaveLength(3);
        expect(findings).toContainEqual({
            file: path.resolve('test','test-data','scenarios','1_hasJsLibraryWithVulnerability','jquery-3.1.0.js'),
            results: getExpectedJQueryResults()
        });
        expect(findings).toContainEqual({
            file: path.resolve('test', 'test-data', 'scenarios', '6_hasVulnerableResourceAndZipFiles', 'ZipFileWithNoExt') + ZIPPED_FILE_MARKER + 'JsFileWithoutExt',
            results: getExpectedJQueryResults()
        });
        expect(findings).toContainEqual({
            file: path.resolve('test', 'test-data', 'scenarios', '6_hasVulnerableResourceAndZipFiles', 'ZipFileWithNoExt') + ZIPPED_FILE_MARKER + 'JsFileWithOddExt.foo',
            results: getExpectedJQueryResults()
        });
    });
});



// ---------------------------------------------------------------------------------------------------------------------
// These tests are just nice to have right now. We do not expose SimpleRetireJsExecutor currently.
// ---------------------------------------------------------------------------------------------------------------------
describe('Tests for the SimpleRetireJsExecutor', () => {
    let executor: RetireJsExecutor;
    beforeAll(() => {
        executor = new SimpleRetireJsExecutor();
    });

    it('When running a directory containing no violations, then output is an empty array.', async () => {
        const findings: Finding[] = await executor.execute([await utils.createTempDir()]);
        expect(findings).toEqual([]);
    });

    it('When vulnerable js library exists in folder, then SimpleRetireJsExecutor reports it', async () => {
        const findings: Finding[] = normalizeFindings(await executor.execute([
            path.resolve('test','test-data','scenarios','1_hasJsLibraryWithVulnerability')]));
        const expectedFindings: Finding[] = [{
                file: path.resolve('test','test-data','scenarios','1_hasJsLibraryWithVulnerability','jquery-3.1.0.js'),
                results: getExpectedJQueryResults()
            }] as Finding[];

        expect(findings).toEqual(expectedFindings);
    });

    it('When no vulnerable js libraries exists in folder, then SimpleRetireJsExecutor reports empty findings', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','2_hasJsLibraryWithoutVulnerability')]);
        expect(findings).toEqual([]);
    });

    it('When no js libraries exists in folder, then SimpleRetireJsExecutor reports empty findings', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','3_hasNoJsLibraries')]);
        expect(findings).toEqual([]);
    });

    it('When resource files without vulnerabilities in folder, then SimpleRetireJsExecutor reports empty findings', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','4_hasResourceFilesWithoutVulnerabilities')]);
        expect(findings).toEqual([]);
    });

    it('When folder contains vulnerabilities in files with odd extension or no extension, then SimpleRetireJsExecutor does not find them', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','5_hasVulnerabilitiesInFilesWithOddExtOrNoExt')]);
        expect(findings).toEqual([]);
    });

    it('When folder contains vulnerabilities within resource and zip files, then SimpleRetireJsExecutor does not find them', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','6_hasVulnerableResourceAndZipFiles')]);
        expect(findings).toEqual([]);
    });

    it('When folder contains vulnerabilities in files with odd extension or no extension, then SimpleRetireJsExecutor does not find them', async () => {
        const findings: Finding[] = await executor.execute([
            path.resolve('test','test-data','scenarios','7_hasZipFolderWithVulnFileInChildFolders')]);
        expect(findings).toEqual([]);
    });

    it('When file is specified among input paths, then SimpleRetireJsExecutor currently errors out since it does not support files', () => {
        expect(executor.execute([path.resolve('test','test-data','scenarios','1_hasJsLibraryWithVulnerability', 'jquery-3.1.0.js')]))
            .rejects.toThrow('Currently the SimpleRetireJsExecutor does not support scanning individual files.');
    });
});

function normalizeFindings(findings: Finding[]): Finding[] {
    // With retire 5.0.0, a bug exists on windows platforms where it cant detect vulnerabilities based on "filename" and
    // so it always just has detection done via "filecontents". Since we don't use this field, it is easiest to just
    // remove it that to try to work around this bug. See https://github.com/RetireJS/retire.js/issues/437. When this
    // bug is fixed then we can update this test file and the getExpectedJQueryResults method to have detection again.
    for (let i = 0; i < findings.length; i++) {
        for (let k = 0; k < findings[i].results.length; k++) {
            delete findings[i].results[k].detection;
        }
    }
    return findings;
}

function getExpectedJQueryResults(): Component[] {
    return [
        {
            component: "jquery",
            npmname: "jquery",
            version: "3.1.0",
            vulnerabilities: [
                {
                    atOrAbove: "1.1.4",
                    below: "3.4.0",
                    identifiers: {
                        CVE: [
                            "CVE-2019-11358"
                        ],
                        PR: "4333",
                        githubID: "GHSA-6c3j-c64m-qhgq",
                        summary: "jQuery before 3.4.0, as used in Drupal, Backdrop CMS, and other products, mishandles jQuery.extend(true, {}, ...) because of Object.prototype pollution"
                    },
                    info: [
                        "https://blog.jquery.com/2019/04/10/jquery-3-4-0-released/",
                        "https://github.com/jquery/jquery/commit/753d591aea698e57d6db58c9f722cd0808619b1b",
                        "https://nvd.nist.gov/vuln/detail/CVE-2019-11358"
                    ],
                    severity: "medium"
                },
                {
                    atOrAbove: "1.0.3",
                    below: "3.5.0",
                    identifiers: {
                        CVE: [
                            "CVE-2020-11023"
                        ],
                        githubID: "GHSA-jpcq-cgw6-v4j6",
                        issue: "4647",
                        summary: "passing HTML containing <option> elements from untrusted sources - even after sanitizing it - to one of jQuery's DOM manipulation methods (i.e. .html(), .append(), and others) may execute untrusted code."
                    },
                    info: [
                        "https://blog.jquery.com/2020/04/10/jquery-3-5-0-released/"
                    ],
                    severity: "medium"
                },
                {
                    atOrAbove: "1.2.0",
                    below: "3.5.0",
                    identifiers: {
                        CVE: [
                            "CVE-2020-11022"
                        ],
                        githubID: "GHSA-gxr4-xjj5-5px2",
                        issue: "4642",
                        summary: "Regex in its jQuery.htmlPrefilter sometimes may introduce XSS"
                    },
                    info: [
                        "https://blog.jquery.com/2020/04/10/jquery-3-5-0-released/"
                    ],
                    severity: "medium"
                }
            ]
        }
        ] as Component[];
    }