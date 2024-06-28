import {Workspace} from "../engines";
import fs from "node:fs";
import path from "node:path";

export function createWorkspace(absFilesAndFolders: string[], workspaceId: string = 'someWorkspaceId'): Workspace {
    return new WorkspaceForTesting(workspaceId, absFilesAndFolders);
}

class WorkspaceForTesting implements Workspace {
    private readonly workspaceId: string;
    private readonly filesAndFolders: string[];
    private expandedFiles?: string[];

    constructor(workspaceId: string, absFilesAndFolders: string[]) {
        this.workspaceId = workspaceId;
        this.filesAndFolders = absFilesAndFolders;
    }

    getWorkspaceId(): string {
        return this.workspaceId;
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