import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {getMessage} from "../src/messages";
import {toAbsolutePath} from "../src/utils";
import {CodeAnalyzer, CodeAnalyzerConfig, Workspace} from "../src";
import path from "node:path";

changeWorkingDirectoryToPackageRoot();

describe("Tests for the createWorkspace method of CodeAnalyzer", () => {
    let codeAnalyzer: CodeAnalyzer;

    beforeEach(async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
    });

    it("When creating multiple workspaces, then each workspace has a different id", async () => {
        const workspace1: Workspace = await codeAnalyzer.createWorkspace([]);
        const workspace2: Workspace = await codeAnalyzer.createWorkspace([]);
        expect(workspace1.getWorkspaceId()).toEqual('workspace1');
        expect(workspace2.getWorkspaceId()).toEqual('workspace2');
    });

    it("When creating workspace with file that does not exist, then error", async () => {
        await expect(codeAnalyzer.createWorkspace(['does/not/exist.cls'])).rejects.toThrow(
            getMessage('FileOrFolderDoesNotExist', toAbsolutePath('does/not/exist.cls')));
    });

    it("When provided a windows based path, it resolves correctly", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace(['test\\run.test.ts']);
        expect(workspace.getFilesAndFolders()).toEqual([path.resolve('test/run.test.ts')]);
    });

    it("When including a relative file and a folder then they both converted to absolute paths", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace(['src', 'test/run.test.ts']);
        expect(workspace.getFilesAndFolders()).toEqual([path.resolve('src'), path.resolve('test/run.test.ts')]);
    });

    it("When including a parent folder and child paths under that folder, then the redundant children are removed", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace(['test/test-data', 'test', 'test/run.test.ts']);
        expect(workspace.getFilesAndFolders()).toEqual([path.resolve('test')]);
    });

    it("When explicitly including files that we normally would ignore, then they are still included since they were explicitely added", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace([
            'test/test-data/sampleWorkspace/node_modules/place_holder.txt',
            'test/test-data/sampleWorkspace/someFile.txt',
            'test/test-data/sampleWorkspace/.gitignore']);
        expect(workspace.getFilesAndFolders()).toEqual([
            path.resolve('test', 'test-data', 'sampleWorkspace', 'node_modules', 'place_holder.txt'),
            path.resolve('test', 'test-data', 'sampleWorkspace', 'someFile.txt'),
            path.resolve('test', 'test-data', 'sampleWorkspace', '.gitignore')
        ].sort());
    });
});