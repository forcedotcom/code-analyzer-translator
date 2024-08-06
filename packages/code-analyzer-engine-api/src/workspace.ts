import fs from "node:fs";
import path from "node:path";

const NON_DOT_FOLDERS_TO_EXCLUDE: string[] = ['node_modules'];
const NON_DOT_FILES_TO_EXCLUDE: string[] = ['code_analyzer_config.yml', 'code_analyzer_config.yaml'];

export class Workspace {
    private static nextId: number = 0;
    private readonly workspaceId: string;
    private readonly rawFilesAndFolders: string[];

    private normalizedFilesAndFolders?: string[];
    private expandedFiles?: string[];
    private workspaceRoot?: string | null;

    /**
     * Constructs a workspace with a list of absolute file and folder paths
     *   This constructor assumes that the list of files and folder paths exists and that they are absolute paths
     * @param absoluteFileAndFolderPaths Absolute file and folder paths
     * @param workspaceId Optional workspace identifier
     */
    constructor(absoluteFileAndFolderPaths: string[], workspaceId?: string) {
        this.workspaceId = workspaceId || `workspace${++Workspace.nextId}`;
        this.rawFilesAndFolders =removeRedundantPaths(absoluteFileAndFolderPaths).map(removeTrailingPathSep);
    }

    /**
     * Returns the identifier associated with the workspace
     */
    getWorkspaceId(): string {
        return this.workspaceId;
    }

    /**
     * Returns the unique list of files and folders that were used to construct the workspace.
     *   Any files or folders underneath the workspace root that Code Analyzer chooses to ignore (like .gitignore files,
     *   node_modules folders, etc.) are automatically excluded.
     */
    getFilesAndFolders(): string[] {
        if (!this.normalizedFilesAndFolders) {
            this.normalizedFilesAndFolders = this.rawFilesAndFolders.filter(f => !this.shouldExclude(f));
        }
        return this.normalizedFilesAndFolders;
    }

    /**
     * Returns the longest root folder that contains all the workspace paths or null if one does not exist
     *   For example, if the workspace was constructed with "/some/folder/subFolder/file1.txt" and
     *   "/some/folder/file2.txt", then the workspace root folder would be equal to "/some/folder".
     *   For the scenarios where a root folder does not exist, for example if the workspace is composed of paths from
     *   two different drives, like "C:\users\someUser\someProject" and "D:\anotherFolder", then null is returned.
     */
    getWorkspaceRoot(): string | null {
        if (this.workspaceRoot === undefined) {
            this.workspaceRoot = calculateLongestCommonParentFolderOf(this.rawFilesAndFolders);
        }
        return this.workspaceRoot;
    }

    /**
     * Returns the full list of the files recursively found within the workspace.
     *   This list is composed of the files that getFilesAndFolders() returns plus any files found recursively inside
     *   any of the folders that getFilesAndFolders() returns. That is, the folders are expanded so that the resulting
     *   list only contains file paths.
     *   Any files underneath the workspace root that Code Analyzer chooses to ignore (like .gitignore files,
     *   files in node_modules folders, etc.) are automatically excluded.
     */
    async getExpandedFiles(): Promise<string[]> {
        if (!this.expandedFiles) {
            this.expandedFiles = (await expandToListAllFiles(this.getFilesAndFolders())).filter(f => !this.shouldExclude(f));
        }
        return this.expandedFiles as string[];
    }

    /**
     * Returns whether a path should be excluded or not (like paths under a "node_modules" folder should be excluded)
     *   Idea: In the future, we might consider having a .code_analyzer_ignore file or something that users can create
     *         which could help the user have better control over what files are excluded.
     *
     *   Note: When determining whether to exclude a file or not, we base it entirely off looking only at the
     *   portion of the path underneath the workspace root. This allows us to not accidentally remove all files if the
     *   workspace happens to live under a dot folder for example. But since we calculate this workspace root folder
     *   based off of the provided paths, and have no way for the user to explicitly provide the workspace root, we
     *   end up with what looks like possible inconsistencies. For example, consider the case that we had the following
     *   paths:
     *      (1) '/some/folder/node_modules/someFolder/someFile1.txt'
     *      (2) '/some/folder/someFile2.txt'
     *   Then if workspace consisted of (1) only then it would not be excluded since the workspace root would be
     *   '/some/folder/node_modules/someFolder'. But if the workspace consisted of (1) and (2) then the workspace root
     *   would be '/some/folder' and since (1) is a file that lives in a node_modules folder underneath the workspace
     *   root then (1) would be excluded but (2) would remain in the workspace. Keep in mind that the files that we are
     *   given may have come as the output of a glob pattern, so there truly isn't a way to know what the workspace root
     *   is unless it is given by the user. But these are all super edge cases that most likely will never happen, so
     *   I think we are safe to use the calculated workspace root for now. If in the future, this becomes a problem,
     *   then we can add an enhancement to receive the workspace root explicitly from the user.
     */
    private shouldExclude(fileOrFolder: string): boolean {
        const relativeFileOrFolder: string = this.makeRelativeToWorkspaceRoot(fileOrFolder);
        if (relativeFileOrFolder.length === 0) { // folder is equal to the workspace root
            return false;
        }
        return NON_DOT_FOLDERS_TO_EXCLUDE.some(f => relativeFileOrFolder.includes(`${path.sep}${f}${path.sep}`)) ||
            NON_DOT_FILES_TO_EXCLUDE.includes(path.basename(relativeFileOrFolder)) ||
            relativeFileOrFolder.includes(`${path.sep}.`);
    }

    private makeRelativeToWorkspaceRoot(fileOrFolder: string): string {
        if(this.getWorkspaceRoot()) {
            return fileOrFolder.slice(this.getWorkspaceRoot()!.length);
        }
        /* istanbul ignore next */
        return fileOrFolder;
    }
}

/**
 *  Removes redundant paths.
 *    If a user supplies a parent folder and subfolder of file underneath the parent folder, then we can safely
 *    remove that subfolder or file. Also, if we find duplicate entries, we remove those as well.
 */
function removeRedundantPaths(absolutePaths: string[]): string[] {
    const pathsSortedByLength: string[] = absolutePaths.sort((a, b) => a.length - b.length);
    const filteredPaths: string[] = [];
    for (const currentPath of pathsSortedByLength) {
        const isAlreadyContained = filteredPaths.some(existingPath =>
            currentPath.startsWith(existingPath + path.sep) || existingPath === currentPath
        );
        if (!isAlreadyContained) {
            filteredPaths.push(currentPath);
        }
    }
    return filteredPaths.sort(); // sort alphabetically
}

/**
 * Removes trailing path.sep values if needed
 */
function removeTrailingPathSep(absolutePath: string): string {
    return absolutePath.length > path.sep.length && absolutePath.endsWith(path.sep) ?
        absolutePath.slice(0, absolutePath.length - path.sep.length) : absolutePath;
}

/**
 * Expands a list of files and/or folders to be a list of all contained files, including the files found in subfolders
 */
export async function expandToListAllFiles(absoluteFileOrFolderPaths: string[]): Promise<string[]> {
    const allFiles: string[] = [];
    async function processPath(currentPath: string): Promise<void> {
        if ((await fs.promises.stat(currentPath)).isDirectory()) {
            const subPaths: string[] = await fs.promises.readdir(currentPath);
            const absSubPaths: string[] = subPaths.map(f => path.join(currentPath, f));
            await Promise.all(absSubPaths.map(processPath)); // Process subdirectories recursively
        } else {
            allFiles.push(currentPath);
        }
    }
    await Promise.all(absoluteFileOrFolderPaths.map(processPath));
    return allFiles.sort();
}

/**
 * Returns the longest common parent folder of the provided paths.
 *   If empty or if no common parent folder exists, like in the case on Windows machines of using two different drives
 *   C: and D:, then null is returned (to allow the client of this function to handle this case without try/catch).
 * @param paths It is assumed that paths is a non-empty array of absolute value paths.
 */
export function calculateLongestCommonParentFolderOf(paths: string[]): string | null {
    if (paths.length === 0) {
        return null;
    }
    const longestCommonStr: string = getLongestCommonPrefix(paths);
    if (longestCommonStr.length === 0) {
        return null;
    }
    if (longestCommonStr.length > 1 && longestCommonStr.endsWith(path.sep)) {
        return longestCommonStr.slice(0, longestCommonStr.length - 1);
    }
    return fs.existsSync(longestCommonStr) && fs.statSync(longestCommonStr).isDirectory() && !includesAFileThatIsNotAFolderThatStartsWith(longestCommonStr, paths) ?
        longestCommonStr : path.dirname(longestCommonStr);
}
function getLongestCommonPrefix(strs: string[]): string {
    // To find the longest common prefix, we first get the shortest string from our list of strings
    const shortestStr = strs.reduce((s1, s2) => s1.length <= s2.length ? s1 : s2);

    // Then we check that each string's ith character is the same as the shortest strings ith character
    for (let i = 0; i < shortestStr.length; i++) {
        if(!strs.every(str => str[i] === shortestStr[i])) {
            // If we find a string that doesn't match the ith character, we return the common prefix from [0,i)
            return shortestStr.substring(0, i)
        }
    }
    return shortestStr;
}
function includesAFileThatIsNotAFolderThatStartsWith(partialPathStr:string, allPaths: string[]) {
    // This handles the edge case when the workspace contains a folder that is part of the name of another file.
    // For example if "/root/abc/def.txt" and "/root/abcDef.txt" both exist, then we need to know when we can select
    // "/root/abc" as a folder or when we should be selecting "/root" because "/root/abc" just came from "/root/abcDef.txt"
    return allPaths.some(p => p.startsWith(partialPathStr) && p.length > partialPathStr.length && p[partialPathStr.length] !== path.sep);
}