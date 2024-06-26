import process from "node:process";
import path from "node:path";
import {Workspace} from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";

export function changeWorkingDirectoryToPackageRoot() {
    let original_working_directory: string;
    beforeAll(() => {
        // We change the directory to ensure that the config files (which use relative folders from the package root)
        // are processed correctly. The project root directory is typically the one used by default, but it may be
        // different if the tests are run from the mono-repo's root directory. Lastly, it is better to use the
        // package root directory is instead of the test directory since some IDEs (like IntelliJ) fail to collect
        // code coverage correctly unless this package root directory is used.
        original_working_directory = process.cwd();
        process.chdir(path.resolve(__dirname,'..'));
    });
    afterAll(() => {
        process.chdir(original_working_directory);
    });
}

export class WorkspaceForTesting implements Workspace {
    private readonly filesAndFolders: string[];
    private expandedFiles?: string[];

    constructor(absFilesAndFolders: string[]) {
        this.filesAndFolders = absFilesAndFolders;
    }

    getWorkspaceId(): string {
        return "someWorkspaceId";
    }

    getFilesAndFolders(): string[] {
        return this.filesAndFolders;
    }

    async getExpandedFiles(): Promise<string[]> {
        if (!this.expandedFiles) {
            this.expandedFiles = await expandToListAllFiles(this.filesAndFolders);
        }
        return this.expandedFiles as string[];
    }
}

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