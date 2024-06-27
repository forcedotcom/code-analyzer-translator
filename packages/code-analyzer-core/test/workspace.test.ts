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
        expect(codeAnalyzer.createWorkspace(['does/not/exist.cls'])).rejects.toThrow(
            getMessage('FileOrFolderDoesNotExist', toAbsolutePath('does/not/exist.cls')));
    });

    it("When including a relative file and a folder then they both converted to absolute paths", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace(['src', 'test/run.test.ts']);
        expect(workspace.getFilesAndFolders()).toEqual([path.resolve('src'), path.resolve('test/run.test.ts')]);
    });

    it("When including a parent folder and child paths under that folder, then the redundant children are removed", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace(['test/test-data', 'test', 'test/run.test.ts']);
        expect(workspace.getFilesAndFolders()).toEqual([path.resolve('test')]);
    });

    it("When including files we care not to process like .gitignore file or a node_modules folder, then they are removed", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace([
            'test/test-data/sampleWorkspace/node_modules/place_holder.txt',
            'test/test-data/sampleWorkspace/someFile.txt',
            'test/test-data/sampleWorkspace/.gitignore',]);
        expect(workspace.getFilesAndFolders()).toEqual([path.resolve('test', 'test-data', 'sampleWorkspace', 'someFile.txt')]);
    });

    it("When calling getExpandedFiles, then all files underneath all subfolders are found", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace(["test\\test-data\\sampleWorkspace"]);
        expect(await workspace.getExpandedFiles()).toEqual([
            path.resolve('test', 'test-data', 'sampleWorkspace', 'someFile.txt'),
            path.resolve('test', 'test-data', 'sampleWorkspace', 'sub1', 'someFileInSub1.txt'),
            path.resolve('test', 'test-data', 'sampleWorkspace', 'sub1', 'sub2', 'someFile1InSub2.txt'),
            path.resolve('test', 'test-data', 'sampleWorkspace', 'sub1', 'sub2', 'someFile2InSub2.txt'),
            path.resolve('test', 'test-data', 'sampleWorkspace', 'sub1', 'sub3', 'someFileInSub3.txt'),
        ]);
    })
});