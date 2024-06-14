import {Finding} from "retire/lib/types";
import {exec, ExecException} from "node:child_process";
import {promisify} from "node:util";
import fs from "node:fs";
import * as utils from "./utils";
import path from "node:path";
import * as StreamZip from 'node-stream-zip';
import {getMessage} from "./messages";
import {LogLevel} from "@salesforce/code-analyzer-engine-api";

const execAsync = promisify(exec);

// To handle the special case where a vulnerable library is found within a zip archive, a RetireJsExecutor can use this
// marker to update the file field to look like <zip_file>::[ZIPPED_FILE]::<embedded_file> which the engine handles.
export const ZIPPED_FILE_MARKER = '::[ZIPPED_FILE]::';

const RETIRE_JS_VULN_REPO_FILE: string = path.resolve(__dirname, '..', 'vulnerabilities', 'RetireJsVulns.json')

const RETIRE_COMMAND: string = utils.findCommand('retire');

export interface RetireJsExecutor {
    execute(filesAndFoldersToScan: string[]): Promise<Finding[]>
}

export type EmitLogEventFcn = (logLevel: LogLevel, msg: string) => void;
const NO_OP: () => void = () => {};

/**
 * SimpleRetireJsExecutor - A simple wrapper around the retire command
 *
 * This executor does not do anything fancy and therefore only catches what users could catch if they ran
 * the retire command themselves.
 *
 * Currently, the SimpleRetireJsExecutor is just used by the AdvancedRetireJsExecutor where we always pass in
 * temporary folders to scan. In the future we might consider allowing users to configure the retire-js engine if
 * they want to just run this simple RetireJs strategy on their input directly. At that point, the advantage would
 * be that we wouldn't make any copies of their code to a temporary directory, thus allowing them to use of
 * '.retireignore' and '.retireignore.json' files in their project if they wish to do so.
 */
export class SimpleRetireJsExecutor implements RetireJsExecutor {
    private readonly emitLogEvent: EmitLogEventFcn;

    constructor(emitLogEvent: EmitLogEventFcn = NO_OP) {
        this.emitLogEvent = emitLogEvent;
    }

    async execute(filesAndFoldersToScan: string[]): Promise<Finding[]> {
        let findings: Finding[] = [];
        for (const fileOrFolder of filesAndFoldersToScan) {
            if (fs.statSync(fileOrFolder).isFile()) {
                findings = findings.concat(await this.scanFile(fileOrFolder));
            } else {
                findings = findings.concat(await this.scanFolder(fileOrFolder));
            }
        }
        return findings;
    }

    private async scanFile(_file: string): Promise<Finding[]> {
        // This line shouldn't be hit in production since users can't directly access this SimpleRetireJsExecutor themselves yet.
        // See: https://github.com/RetireJS/retire.js/blob/master/node/README.md#retireignore
        throw new Error('Currently the SimpleRetireJsExecutor does not support scanning individual files.');
    }

    private async scanFolder(folder: string): Promise<Finding[]> {
        const tempOutputFile: string = path.resolve(await utils.createTempDir(), "output.json");
        const command: string = `${RETIRE_COMMAND} --path "${folder}" --exitwith 13 --outputformat jsonsimple --outputpath "${tempOutputFile}" --jsrepo "${RETIRE_JS_VULN_REPO_FILE}"`;

        this.emitLogEvent(LogLevel.Fine, `Executing command: ${command}`);
        try {
            await execAsync(command, {encoding: 'utf-8'});
        } catch (err) {
            const execError: ExecException = err as ExecException;
            /* istanbul ignore next */
            if (execError.code != 13) {
                throw new Error(getMessage('UnexpectedErrorWhenExecutingCommand', command, execError.message) +
                    `\n\n[stdout]:\n${execError.stdout}\n[stderror]:\n${execError.stderr}`,
                    {cause: err});
            }
        }

        this.emitLogEvent(LogLevel.Fine, `Parsing output file: ${tempOutputFile}`);
        try {
            const fileContents: string = fs.readFileSync(tempOutputFile, 'utf-8');
            return JSON.parse(fileContents) as Finding[];
        } catch (err) {
            /* istanbul ignore next */
            throw new Error(getMessage('UnexpectedErrorWhenProcessingOutputFile', tempOutputFile, (err as Error).message),
                {cause: err});
        }
    }
}

/**
 * AdvancedRetireJsExecutor - An advanced strategy of calling retire that does a lot more work to catch more vulnerabilities
 *
 * This executor examines all specifies files and makes a copy of all text based files into a temporary folder, renaming
 * the files with a .js extension before running the retire command on that folder. Additionally, it extracts all zip
 * folders as well into this temporary folder. If any vulnerabilities are found in the temporary duplicated/extracted
 * files then these vulnerabilities are mapped back to the original file names. If a vulnerability is found in a file
 * that is from an extracted zip folder, then we update the file field to look like
 *    <zip_file>::[ZIPPED_FILE]::<embedded_file>
 * which the engine then knows how to further process with special handling.
 */
export class AdvancedRetireJsExecutor implements RetireJsExecutor {
    private readonly simpleExecutor: RetireJsExecutor;
    private readonly emitLogEvent: EmitLogEventFcn;

    constructor(emitLogEvent: EmitLogEventFcn = NO_OP) {
        this.simpleExecutor = new SimpleRetireJsExecutor(emitLogEvent);
        this.emitLogEvent = emitLogEvent;
    }

    async execute(filesAndFoldersToScan: string[]): Promise<Finding[]> {
        const fileMap: Map<string, string> = new Map();
        const tmpDir: string = await utils.createTempDir();
        this.emitLogEvent(LogLevel.Fine, `Created a temporary directory where relevant files will be copied to for scanning: ${tmpDir}`);

        const allFiles: string[] = utils.expandToListAllFiles(filesAndFoldersToScan);
        const fileProcessingPromises: Promise<void>[] = allFiles.map(file => processFile(file, tmpDir, fileMap));
        await Promise.all(fileProcessingPromises);
        this.emitLogEvent(LogLevel.Fine, `Finished copying relevant files to temporary directory: '${tmpDir}'`);

        const findings: Finding[] = await this.simpleExecutor.execute([tmpDir]);

        for (let i = 0; i < findings.length; i++) {
            findings[i].file = fileMap.get(findings[i].file) as string;
        }
        return findings;
    }
}

async function processFile(file: string, tmpDir: string, fileMap: Map<string, string>): Promise<void> {
    if (file.toLowerCase().endsWith(".js") || utils.isTextFile(file)) {
        return processTextFile(file, tmpDir, fileMap);
    } else if (utils.isZipFile(file)) {
        return processZipFile(file, tmpDir, fileMap);
    }
}

async function processTextFile(file: string, tmpDir: string, fileMap: Map<string, string>): Promise<void> {
    // Note that retire.js can sometimes only detect vulnerabilities based on the name of the file, so
    // whenever possible we preserve the original name of the file by placing the file with the same name
    // (but with a .js) extension inside a sub folder in the temporary directory. The sub folder helps avoid with
    // possible name collisions. For performance, we avoid synchronous calls which block the main thread.
    const fileNameWithJsExt: string = path.basename(file, path.extname(file)) + '.js';
    const tmpSubFolder: string = await utils.createTempDir(tmpDir);
    const linkFile: string = path.resolve(tmpSubFolder, fileNameWithJsExt);
    fileMap.set(linkFile, file);
    return utils.linkOrCopy(file, linkFile);
}

async function processZipFile(zipFile: string, tmpDir: string, fileMap: Map<string, string>): Promise<void> {
    // Here we extract a zip file, looking one by one at the entries. Each text file based entry will be then processed
    // in a similar fashion to how processTextFile works except for the file is actually extracted since we can't
    // just make a symlink. Additionally, the fileMap points to the embedded file in the zip folder:
    // <zip_file>::[ZIPPED_FILE]::<embedded_file>
    const zip: StreamZip.StreamZipAsync = new StreamZip.async({file: zipFile, storeEntries: true});
    const entries: { [name: string]: StreamZip.ZipEntry } = await zip.entries();

    for (const entry of Object.values(entries)) {
        if (entry.isDirectory || !utils.isTextFile(await zip.entryData(entry.name))) {
            continue; // Skip directories and non-text files.
        }
        const zippedFileNameWithJsExt: string = path.basename(entry.name, path.extname(entry.name)) + '.js';
        const tmpSubFolder: string = await utils.createTempDir(tmpDir);
        const extractedFile: string = path.resolve(tmpSubFolder, zippedFileNameWithJsExt);
        fileMap.set(extractedFile, `${zipFile}${ZIPPED_FILE_MARKER}${entry.name}`);
        await zip.extract(entry.name, extractedFile);
    }

    await zip.close();
}