/**
 * Downloads the latest version of RetireJS's internal catalog of JS vulnerabilities, then writes the resulting JSON to:
 *     dist/RetireJsVulns.json
 *
 * Usage: From the root folder of the project, run `node build-tools/updateRetireJsVulns.mjs`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LATEST_VULN_FILE_URL = 'https://raw.githubusercontent.com/RetireJS/retire.js/master/repository/jsrepository-v2.json';
const DESTINATION_DIR = path.join(__dirname, '..', 'vulnerabilities');
const DESTINATION_FILE = path.join(DESTINATION_DIR, 'RetireJsVulns.json');
const MIN_NUM_EXPECTED_VULNS = 300; // There were actually about 347 on 2024/6/7, but I'll leave a buffer and make the minimum 300 for our sanity check.

async function updateRetireJsVulns() {
    console.log(`Creating RetireJS vulnerability file`);

    console.log(`* Downloading the latest RetireJS vulnerability file from: ${LATEST_VULN_FILE_URL}`);
    const vulnJsonObj = await downloadJsonFile(LATEST_VULN_FILE_URL);

    console.log(`* Validating the contents of the RetireJS vulnerability file`)
    validateJson(vulnJsonObj);

    console.log(`* Cleaning the contents of the RetireJS vulnerability file`);
    cleanUpJson(vulnJsonObj);

    console.log(`* Writing RetireJS vulnerability catalog to: ${DESTINATION_FILE}`)
    await writeJson(vulnJsonObj);
    console.log(`Success!`);
}

async function downloadJsonFile(jsonFileUrl) {
    const response = await fetch(jsonFileUrl);
    if (!response.ok) {
        throw new Error(`Error downloading ${jsonFileUrl}. Status ${response.status}; ${response.statusText}`);
    }
    return await response.json();
}

function validateJson(vulnJsonObj) {
    const problems = [];
    let numVulnFound = 0;
    for (const key of Object.keys(vulnJsonObj)) {
        const value = vulnJsonObj[key];
        if (!value.vulnerabilities || value.vulnerabilities.length === 0) {
            continue;
        }
        value.vulnerabilities.forEach((vuln, i) => {
            numVulnFound++;
            if (!vuln.identifiers) {
                problems.push(`Component: ${key}. Problem: Vulnerability #${i + 1} lacks identifiers.`);
            }
            if (!vuln.severity) {
                problems.push(`Component: ${key}. Problem: Vulnerability #${i + 1} lacks a severity.`);
            } else if (!["critical", "high","medium","low"].includes(vuln.severity)) {
                problems.push(`Component: ${key}. Problem: Vulnerability #${i + 1} contains a severity that we currently do not support: ${vuln.severity}.`);
            }
        });
    }
    if (problems.length > 0) {
        throw new Error(problems.join('\n'));
    }
    if (numVulnFound < MIN_NUM_EXPECTED_VULNS) {
        throw new Error(`The number of vulnerabilities in the downloaded file was ${numVulnFound}, but we expected at least ${MIN_NUM_EXPECTED_VULNS}.`);
    }
}

function cleanUpJson(vulnJsonObj) {
    Object.keys(vulnJsonObj).forEach((key) => {
        if (vulnJsonObj[key].extractors?.func) {
            delete vulnJsonObj[key].extractors.func;
        }
    });
}

function writeJson(vulnJsonObj) {
    if (!fs.existsSync(DESTINATION_DIR)) {
        fs.mkdirSync(DESTINATION_DIR);
    }
    fs.writeFileSync(DESTINATION_FILE, JSON.stringify(vulnJsonObj, null, 2));
}

// Run the update process
updateRetireJsVulns();