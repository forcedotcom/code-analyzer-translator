import {Workspace} from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";
import path from "node:path";
import {ESLintEngineConfig, LEGACY_ESLINT_CONFIG_FILES} from "./config";
import {calculateLongestCommonParentFolderOf, makeUnique} from "./utils";

export type AsyncFilterFnc<T> = (value: T) => Promise<boolean>;

export interface ESLintWorkspace {
    getFilesToScan(filterFcn: AsyncFilterFnc<string>): Promise<string[]>
    getCandidateFilesForUserConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]>
    getCandidateFilesForBaseConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]>
    getLegacyConfigFile(): string | undefined
}


export class MissingESLintWorkspace implements ESLintWorkspace {
    private readonly config: ESLintEngineConfig;
    private legacyConfigLookupCache?: {file?: string}; // Using object to be able to cache undefined result

    constructor(config: ESLintEngineConfig) {
        this.config = config;
    }

    /* istanbul ignore next */
    async getFilesToScan(_filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        throw new Error("This method should never be called");
    }

    async getCandidateFilesForUserConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        // With no workspace, we just reuse same candidate files as base config
        return this.getCandidateFilesForBaseConfig(filterFcn);
    }

    async getCandidateFilesForBaseConfig(_filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        return createPlaceholderCandidateFiles([
                ... this.config.javascript_file_extensions,
                ... this.config.typescript_file_extensions],
            this.config.config_root
        )
    }

    getLegacyConfigFile(): string | undefined {
        if (!this.legacyConfigLookupCache) {
            this.legacyConfigLookupCache = {
                file: chooseLegacyConfigFile(this.config, [this.config.config_root, process.cwd()])
            };
        }
        return this.legacyConfigLookupCache.file;
    }
}


type FilesOfInterest = {
    javascriptFiles: string[]
    typescriptFiles: string[]
}

export class PresentESLintWorkspace implements ESLintWorkspace {
    private readonly delegateWorkspace: Workspace;
    private readonly config: ESLintEngineConfig;
    private workspaceRoot?: string;
    private filesOfInterest?: FilesOfInterest;
    private legacyConfigLookupCache?: {file?: string}; // Using object to be able to cache undefined result

    constructor(delegateWorkspace: Workspace, config: ESLintEngineConfig) {
        this.delegateWorkspace = delegateWorkspace;
        this.config = config;
    }

    private getWorkspaceRoot(): string {
        if (!this.workspaceRoot) {
            const filesAndFolders: string[] = this.delegateWorkspace.getFilesAndFolders();
            this.workspaceRoot = calculateLongestCommonParentFolderOf(filesAndFolders) || this.config.config_root;
        }
        return this.workspaceRoot;
    }

    async getFilesToScan(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        const filesOfInterest: FilesOfInterest = await this.getFilesOfInterest(filterFcn);
        return filesOfInterest.javascriptFiles.concat(filesOfInterest.typescriptFiles);
    }

    async getCandidateFilesForUserConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        return this.getFilesToScan(filterFcn);
    }

    async getCandidateFilesForBaseConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        const filesOfInterest: FilesOfInterest = await this.getFilesOfInterest(filterFcn);
        let candidateFiles: string[] = [];
        if (filesOfInterest.javascriptFiles.length > 0) {
            candidateFiles = createPlaceholderCandidateFiles(this.config.javascript_file_extensions, this.getWorkspaceRoot());
        }
        if (filesOfInterest.typescriptFiles.length > 0) {
            candidateFiles = candidateFiles.concat(
                createPlaceholderCandidateFiles(this.config.typescript_file_extensions, this.getWorkspaceRoot()));
        }
        return candidateFiles;
    }

    getLegacyConfigFile(): string | undefined {
        if (!this.legacyConfigLookupCache) {
            this.legacyConfigLookupCache = {
                file: chooseLegacyConfigFile(this.config, [this.getWorkspaceRoot(), this.config.config_root, process.cwd()])
            };
        }
        return this.legacyConfigLookupCache.file;
    }

    private async getFilesOfInterest(filterFcn: AsyncFilterFnc<string>): Promise<FilesOfInterest> {
        if (this.filesOfInterest) {
            return this.filesOfInterest;
        }

        this.filesOfInterest = { javascriptFiles: [], typescriptFiles: [] };
        for (const file of await this.delegateWorkspace.getExpandedFiles()) {
            const fileExt = path.extname(file).toLowerCase();
            if (this.config.javascript_file_extensions.includes(fileExt)) {
                this.filesOfInterest.javascriptFiles.push(file);
            } else if (this.config.typescript_file_extensions.includes(fileExt)) {
                this.filesOfInterest.typescriptFiles.push(file);
            }
        }
        this.filesOfInterest.javascriptFiles = await filterAsync(this.filesOfInterest.javascriptFiles, filterFcn);
        this.filesOfInterest.typescriptFiles = await filterAsync(this.filesOfInterest.typescriptFiles, filterFcn);

        return this.filesOfInterest;
    }
}

function createPlaceholderCandidateFiles(fileExtensions: string[], rootFolder: string) {
    return fileExtensions.map(ext => `${rootFolder}${path.sep}placeholderCandidateFile${ext}`);
}

function chooseLegacyConfigFile(config: ESLintEngineConfig, foldersToCheck: string[]): string | undefined {
    return config.eslint_config_file || (config.disable_config_lookup ? undefined :
        findLegacyConfigFile(makeUnique(foldersToCheck)));
}

function findLegacyConfigFile(foldersToCheck: string[]): string | undefined {
    for (const folder of foldersToCheck) {
        for (const legacyConfigFileName of LEGACY_ESLINT_CONFIG_FILES) {
            const possibleUserConfigFile = path.join(folder, legacyConfigFileName);
            if (fs.existsSync(possibleUserConfigFile)) { // Using synchronous code to ensure we check for the files in the correct order
                return possibleUserConfigFile;
            }
        }
    }
    return undefined;
}

async function filterAsync<T>(array: T[], filterFcn: AsyncFilterFnc<T>): Promise<T[]> {
    const mask: boolean[] = await Promise.all(array.map(filterFcn));
    return array.filter((_, index) => mask[index]);
}