import fs from "node:fs";
import path from "node:path";

const UNWANTED_FOLDERS: string[] = ['node_modules', '.git', '.github'];
const UNWANTED_FILES: string[] = ['code_analyzer_config.yml', 'code_analyzer_config.yaml', '.gitignore'];

export class Workspace {
    private static nextId: number = 0;
    private readonly workspaceId: string;
    private readonly filesAndFolders: string[];
    private expandedFiles?: string[];

    /**
     * Constructs a workspace with a list of absolute file and folder paths
     * * This constructor assumes that the list of files and folder paths exists and that they are absolute paths
     * @param absoluteFileAndFolderPaths Absolute file and folder paths
     * @param workspaceId Optional workspace identifier
     */
    constructor(absoluteFileAndFolderPaths: string[], workspaceId?: string) {
        this.workspaceId = workspaceId || `workspace${++Workspace.nextId}`;
        this.filesAndFolders = removeRedundantPaths(absoluteFileAndFolderPaths).filter(isWantedPath);
    }

    getWorkspaceId(): string {
        return this.workspaceId;
    }

    getFilesAndFolders(): string[] {
        return this.filesAndFolders;
    }

    async getExpandedFiles(): Promise<string[]> {
        if (!this.expandedFiles) {
            this.expandedFiles = (await expandToListAllFiles(this.filesAndFolders)).filter(isWantedPath);
        }
        return this.expandedFiles as string[];
    }
}

/**
 *  Removes redundant paths.
 *  If a user supplies a parent folder and subfolder of file underneath the parent folder, then we can safely
 *  remove that subfolder or file. Also, if we find duplicate entries, we remove those as well.
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
 * Returns whether a path should be included or not (like those that live under a "node_modules" folder should not be)
 * Idea: in the future, we might consider having a .code_analyzer_ignore file or something that users can create
 */
function isWantedPath(absolutePath: string): boolean {
    return !UNWANTED_FOLDERS.some(f => absolutePath.includes(`${path.sep}${f}${path.sep}`)) &&
        !UNWANTED_FILES.includes(path.basename(absolutePath));
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