import * as tmp from "tmp";
import fs from "node:fs";
import path from "node:path";
import {isBinaryFileSync} from "isbinaryfile";
import {promisify} from "node:util";

tmp.setGracefulCleanup();
const tmpDirAsync = promisify((options: tmp.DirOptions, cb: tmp.DirCallback) => tmp.dir(options, cb));

/**
 * Creates a temporary directory that eventually cleans up after itself
 * @param parentTempDir - if supplied, then a temporary folder is placed directly underneath this parent folder.
 */
export async function createTempDir(parentTempDir?: string) : Promise<string> {
    return tmpDirAsync({dir: parentTempDir, keep: false, unsafeCleanup: true});
}

/**
 * Expands a list of files and/or folders to be a list of all contained files, including the files found in subfolders
 */
export function expandToListAllFiles(absoluteFileOrFolderPaths: string[]): string[] {
    let allFiles: string[] = [];
    for (const fileOrFolder of absoluteFileOrFolderPaths) {
        if (fs.statSync(fileOrFolder).isDirectory()) {
            const absSubPaths: string[] = fs.readdirSync(fileOrFolder).map(f => path.resolve(fileOrFolder, f));
            allFiles = [...allFiles, ...expandToListAllFiles(absSubPaths)];
        } else { // isFile
            allFiles.push(fileOrFolder);
        }
    }
    return allFiles;
}

/**
 * Attempts to create a symlink, and if that fails, attempts to create a link, and if that fails, just copies the file
 * @param srcFile Source file
 * @param destinationFile Destination file
 */
export async function linkOrCopy(srcFile: string, destinationFile: string): Promise<void> {
    const errMsgs: string[] = [];
    /* istanbul ignore next */
    return fs.promises.symlink(srcFile, destinationFile)
        .catch((err: Error) => {
            errMsgs.push(`symlink threw an error: ${err.message}`);
            return fs.promises.link(srcFile, destinationFile)
        }).catch((err: Error) => {
            errMsgs.push(`link threw an error: ${err.message}`);
            return fs.promises.copyFile(srcFile, destinationFile);
        }).catch((err: Error) => {
            errMsgs.push(`copyFile threw an error: ${err.message}`);
            throw new Error(`All attempts to copy file ${srcFile} to ${destinationFile} have failed.\n${errMsgs.join('\n')}`)
        });
}

/**
 * Determines if the provided file is a compressed zip file based on its contents
 *
 * Note that this code is directly from https://github.com/kevva/is-zip/blob/master/index.js
 * The is-zip module does not come with any typescript type information and thus cannot be used without "require".
 * But since it literally just contains the following code, it is simple enough to just copy the function here.
 */
export function isZipFile(file: string) {
    const buf: Buffer = fs.readFileSync(file);
    /* istanbul ignore next */
    if (!buf || buf.length < 4) {
        return false;
    }
    /* istanbul ignore next */
    return buf[0] === 80 && buf[1] === 75 && (buf[2] === 3 || buf[2] === 5 || buf[2] === 7) && (buf[3] === 4 || buf[3] === 6 || buf[3] === 8);
}

/**
 * Determines if a file is a non-binary text file
 * @param file a file path or the Buffer of its contents
 */
export function isTextFile(file: string | Buffer) {
    return !isBinaryFileSync(file);
}