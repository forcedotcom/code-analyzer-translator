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
const JS_EXTENSIONS = ['.js', '.mjs', '.cjs'];

// To speed up our AdvancedRetireJsExecutor, we will only target files with extension among EXTENSIONS_TO_TARGET
// that don't live under one of the FOLDERS_TO_SKIP
const EXTENSIONS_TO_TARGET = [...JS_EXTENSIONS, '.resource', '.zip'];
const FOLDERS_TO_SKIP = ['node_modules', 'bower_components'];

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
        const tempOutputFile: string = (await utils.createTempDir()) + path.sep + 'output.json';
        const command: string = RETIRE_COMMAND +
            ` --path "${folder}"` +
            ` --exitwith 13` +
            ` --outputformat jsonsimple` +
            ` --outputpath "${tempOutputFile}"` +
            ` --jsrepo "${RETIRE_JS_VULN_REPO_FILE}"` +
            ` --ext "${JS_EXTENSIONS.map(ext => ext.replace('.','')).join(',')}"`;

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

    // Will contain the parent temporary directory where we place all files to be scanned
    private parentTempDir: string = '';

    // Map to associate each temp file (under the parentTempDir) to its original file
    private readonly tempToOrigFileMap: Map<string, string> = new Map();

    // Map to associate a list of original folders to a corresponding temporary subfolders name
    private readonly origToTempDirMap: Map<string, string> = new Map();

    // A counter to just help generate unique numbers to be appended to the generated file and subfolder names.
    // Since this counter is used for both files and folders which, it may not give the best human names for debugging.
    private uniqNameCounter: number = 0;

    constructor(emitLogEvent: EmitLogEventFcn = NO_OP) {
        this.simpleExecutor = new SimpleRetireJsExecutor(emitLogEvent);
        this.emitLogEvent = emitLogEvent;
    }

    async execute(filesAndFoldersToScan: string[]): Promise<Finding[]> {
        const allFiles: string[] = utils.expandToListAllFiles(filesAndFoldersToScan);
        const targetFiles: string[] = reduceToTargetFiles(allFiles);
        const { textFiles, zipFiles } = separateTextAndZipFiles(targetFiles);

        await this.prepareTempDirs(textFiles);
        this.emitLogEvent(LogLevel.Fine, `Created a temporary directory where relevant files will be copied to for scanning: ${this.parentTempDir}`);

        await Promise.all([
            ...textFiles.map(file => this.processTextFile(file)),
            ...zipFiles.map(file => this.processZipFile(file))]);
        this.emitLogEvent(LogLevel.Fine, `Finished copying relevant files to temporary directory: '${this.parentTempDir}'`);

        const findings: Finding[] = await this.simpleExecutor.execute([this.parentTempDir]);
        for (let i = 0; i < findings.length; i++) {
            findings[i].file = this.tempToOrigFileMap.get(findings[i].file) as string;
        }
        return findings;
    }

    /**
     *  Create parent temporary directory (that cleans up after itself when process exits) and add subdirectories under
     *  the parent for each of the unique folders containing text files
     */
    private async prepareTempDirs(textFiles: string[]): Promise<void[]> {
        this.origToTempDirMap.clear();
        this.tempToOrigFileMap.clear();
        this.uniqNameCounter = 0;
        this.parentTempDir = await utils.createTempDir();
        const mkdirPromises: Promise<void>[] = [];
        for (const textFile of textFiles) {
            const folder: string = path.dirname(textFile);
            if (!this.origToTempDirMap.has(folder)) {
                const tempDir: string = this.makeUniqueTempDirName();
                this.origToTempDirMap.set(folder, tempDir);
                mkdirPromises.push(fs.promises.mkdir(tempDir));
            }
        }
        return Promise.all(mkdirPromises);
    }

    /**
     * Make a symlink of the text file into its associated temporary directory with a .js file extension
     * Additionally, we update tempToOrigFileMap so that the original text file can be mapped from the temporary file.
     */
    private async processTextFile(origTextFile: string): Promise<void> {
        const fileInfo: path.ParsedPath = path.parse(origTextFile);
        const tempDir: string = this.origToTempDirMap.get(fileInfo.dir) as string;
        const fileNameWithJsExt: string = this.makeUniqueJsFileNameFor(fileInfo);
        const tempTextFile: string = tempDir + path.sep + fileNameWithJsExt;
        this.tempToOrigFileMap.set(tempTextFile, origTextFile);
        return utils.linkOrCopy(origTextFile, tempTextFile);
    }

    /**
     * Extract text files from zip file forcing them to have a js extension.
     * Additionally, we update the tempToOrigFileMap so that the temp file points to the embedded zip file as:
     *   <zip_file>::[ZIPPED_FILE]::<embedded_file>
     */
    private async processZipFile(zipFile: string): Promise<void> {
        const zip: StreamZip.StreamZipAsync = new StreamZip.async({file: zipFile, storeEntries: true});
        const entries: { [name: string]: StreamZip.ZipEntry } = await zip.entries();
        for (const entry of Object.values(entries)) {
            if (entry.isDirectory || !utils.isTextFile(await zip.entryData(entry.name))) {
                continue; // Skip directories and non-text files.
            }
            const zippedFileInfo: path.ParsedPath = path.parse(entry.name);
            const folderInZip: string = `${zipFile}${ZIPPED_FILE_MARKER}${zippedFileInfo.dir}`;
            if (!this.origToTempDirMap.has(folderInZip)) {
                const tempSubDir: string = this.makeUniqueTempDirName();
                this.origToTempDirMap.set(folderInZip, tempSubDir);
                await fs.promises.mkdir(tempSubDir);
            }
            const tempDir: string = this.origToTempDirMap.get(folderInZip) as string;
            const zippedFileNameWithJsExt: string = this.makeUniqueJsFileNameFor(zippedFileInfo);
            const tempUnzippedFile: string = tempDir + path.sep + zippedFileNameWithJsExt;
            this.tempToOrigFileMap.set(tempUnzippedFile, `${zipFile}${ZIPPED_FILE_MARKER}${entry.name}`);
            await zip.extract(entry.name, tempUnzippedFile);
        }
        await zip.close();
    }

    /**
     *  Returns the file name if it already is a javascript file (to allow vulnerability detection based on filename).
     *  Otherwise, returns a temp name with a .js extension so that it can be scanned.
     */
    private makeUniqueJsFileNameFor(fileInfo: path.ParsedPath): string {
        return JS_EXTENSIONS.includes(fileInfo.ext) ? fileInfo.base : `TMPFILE_${this.uniqNameCounter++}.js`;
    }

    private makeUniqueTempDirName(): string {
        return `${this.parentTempDir}${path.sep}TMPDIR_${this.uniqNameCounter++}`;
    }
}

function reduceToTargetFiles(files: string[]): string[] {
    const filesSet: Set<string> = new Set(files);
    return files.filter(file => shouldTarget(file, filesSet));
}
function shouldTarget(file: string, filesSet: Set<string>): boolean {
    const fileInfo: path.ParsedPath = path.parse(file);
    if (fileIsInFolderToSkip(file)) {
        return false;
    } else if (EXTENSIONS_TO_TARGET.includes(fileInfo.ext.toLowerCase())) {
        return true;
    }
    return filesSet.has(`${fileInfo.dir}${path.sep}${fileInfo.name}.resource-meta.xml`);
}
function fileIsInFolderToSkip(file: string): boolean {
    return FOLDERS_TO_SKIP.some(folderToSkip => file.includes(path.sep + folderToSkip + path.sep));
}

function separateTextAndZipFiles(files: string[]): {textFiles: string[], zipFiles: string[]} {
    const textFiles: string[] = [];
    const zipFiles: string[] = [];
    for (const file of files) {
        if (file.toLowerCase().endsWith(".js") || utils.isTextFile(file)) {
            textFiles.push(file);
        } else if (utils.isZipFile(file)) {
            zipFiles.push(file);
        }
    }
    return {textFiles, zipFiles};
}