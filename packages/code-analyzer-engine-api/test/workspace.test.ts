import path from "node:path";
import { Workspace } from "../src";

const SAMPLE_WORKSPACE_FOLDER: string = path.join(__dirname, 'test-data', 'sampleWorkspace');

describe('Tests for the Workspace class', () => {
    it('If a workspace identifier is supplied to the constructor, then the getWorkspaceId method returns it', async () => {
        const workspace: Workspace = new Workspace([SAMPLE_WORKSPACE_FOLDER], 'someWorkspaceId');
        expect(workspace.getWorkspaceId()).toEqual('someWorkspaceId');
    });

    it('If a workspace identifier is not supplied, then a new one unique one is created', async () => {
        const workspace1: Workspace = new Workspace([SAMPLE_WORKSPACE_FOLDER]);
        const workspace2: Workspace = new Workspace([SAMPLE_WORKSPACE_FOLDER]);
        expect(workspace1.getWorkspaceId().startsWith('workspace')).toEqual(true);
        expect(workspace2.getWorkspaceId().startsWith('workspace')).toEqual(true);
        expect(workspace2.getWorkspaceId()).not.toEqual(workspace1.getWorkspaceId());
    });

    it("When including a parent folder and child paths under that folder, then the redundant children are removed", async () => {
        const workspace: Workspace = new Workspace([
            path.join(__dirname, 'test-data'),
            __dirname,
            path.join(__dirname, 'run.test.ts')
        ]);
        expect(workspace.getFilesAndFolders()).toEqual([__dirname]);
    });


    it('When workspace folder ends in path.sep, then getFilesAndFolders removes the path.sep', () => {
        const workspace: Workspace = new Workspace([__dirname + path.sep]);
        expect(workspace.getFilesAndFolders()).toEqual([__dirname]);
    });

    it("When including files we don't care to process like .gitignore file or a node_modules folder, then they are removed", async () => {
        const workspace: Workspace = new Workspace([
            path.join(SAMPLE_WORKSPACE_FOLDER ,'node_modules', 'place_holder.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER ,'.gitignore')]);
        expect(workspace.getFilesAndFolders()).toEqual([path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt')]);
    });

    it('When calling getExpandedFiles, then all files underneath all subfolders are found while excluding dot files/folders and node_modules', async () => {
        const workspace: Workspace = new Workspace([path.join(__dirname, 'test-data', 'sampleWorkspace')]);
        expect(await workspace.getExpandedFiles()).toEqual([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile', 'dummy.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile2InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.txt')
        ].sort());
    });

    it('When workspace is empty, then getExpandedFiles is empty', async () => {
        const workspace: Workspace = new Workspace([]);
        expect(await workspace.getExpandedFiles()).toEqual([]);
    });

    it('When workspace is empty, then getWorkspaceRoot returns null', () => {
        const workspace: Workspace = new Workspace([]);
        expect(workspace.getWorkspaceRoot()).toEqual(null);
    });

    it('When workspace contains just a file, then getWorkspaceRoot returns its parent folder', () => {
        const workspace: Workspace = new Workspace([path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.txt')]);
        expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1'));
    });

    it('When workspace contains just a folder, then getWorkspaceRoot returns the folder', () => {
        const workspace: Workspace = new Workspace([path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1')]);
        expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1'));
    });

    it('When workspace contains two files from the same folder (with no common file name overlap), then getWorkspaceRoot their parent folder', () => {
        const workspace: Workspace = new Workspace([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.txt'),
        ]);
        expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2'));
    });

    it('When workspace contains two files from the same folder with no common file name overlap (where common name is actually a folder that exists), then getWorkspaceRoot their parent folder', () => {
        // The case has "...sub2/someFile" common to both files but someFile i actually a folder inside sub2 that we shouldn't return
        // We first test when the "someFile" folder is not in the workspace
        const workspace1: Workspace = new Workspace([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile2InSub2.txt'),
        ]);
        expect(workspace1.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2'));

        // We then test when the "someFile" folder is in the workspace
        const workspace2: Workspace = new Workspace([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile2InSub2.txt'),
        ]);
        expect(workspace2.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2'));
    });

    it('When root folder of workspace is also partially the name of another file that is not in the workspace, then getWorkspaceRoot returns the folder', () => {
        const workspace: Workspace = new Workspace([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile') // This is a folder. Notice the someFile1InSub2.txt is not our workspace
        ]);
        expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile'));
    });

    it('When workspace contains a folder and a file from that folder, then getWorkspaceRoot the folder', () => {
        const workspace: Workspace = new Workspace([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.txt'),
        ]);
        expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1'));
    });

    it('When workspace contains various files and folders, then getWorkspaceRoot returns the longest common parent folder', () => {
        const workspace: Workspace = new Workspace([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt'),
        ]);
        expect(workspace.getWorkspaceRoot()).toEqual(SAMPLE_WORKSPACE_FOLDER);
    });

    it('When workspace contains files from different drives, then getWorkspaceRoot returns null', () => {
        const workspace: Workspace = new Workspace([
            path.join('C:', 'someFolder', 'someFile1.txt'),
            path.join('D:', 'someFile2.txt')
        ]);
        expect(workspace.getWorkspaceRoot()).toEqual(null);
    });

    it('When workspace contains files that only have the absolute root folder in common, then getWorkspaceRoot returns it', () => {
        const absRoot: string = getAbsoluteRootFolder();
        const workspace: Workspace = new Workspace([
            path.join(absRoot, 'someFolder', 'someFile1.txt'),
            path.join(absRoot, 'someFile2')
        ]);
        expect(workspace.getWorkspaceRoot()).toEqual(absRoot);
    });

    it('When workspace folder ends in path.sep, then getWorkspaceRoot removes the path.sep', () => {
        const workspace: Workspace = new Workspace([__dirname + path.sep]);
        expect(workspace.getWorkspaceRoot()).toEqual(__dirname);
    });

    it('When a workspace consists a dot file/folder as a direct child underneath the workspace root (as opposed to indirectly) in it, then it should be excluded', async () => {
        const folderDirectlyContainingDotFileAndDotFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3');
        const workspace: Workspace = new Workspace([folderDirectlyContainingDotFileAndDotFolder]);
        // Sanity checks:
        expect(workspace.getWorkspaceRoot()).toEqual(folderDirectlyContainingDotFileAndDotFolder);
        expect(workspace.getFilesAndFolders()).toEqual([folderDirectlyContainingDotFileAndDotFolder]);
        // Actual verification - should not include dot files or folders:
        expect(await workspace.getExpandedFiles()).toEqual([path.join(folderDirectlyContainingDotFileAndDotFolder, 'someFileInSub3.txt')]);
    });

    it('When a workspace root happens to live under a dot folder, then the files are not excluded', async () => {
        const dotFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder');
        const workspace: Workspace = new Workspace([
            path.join(dotFolder, 'subFolder'),
            path.join(dotFolder, 'someFile.txt')]);
        expect(workspace.getFilesAndFolders()).toEqual([
            path.join(dotFolder, 'subFolder'),
            path.join(dotFolder, 'someFile.txt',)
        ].sort());
        expect(await workspace.getExpandedFiles()).toEqual([
            path.join(dotFolder, 'subFolder', 'someOtherFile.txt'),
            path.join(dotFolder, 'someFile.txt',)
        ].sort());
    });

    it('When a workspace root happens to live under a node_modules folder, then the files are not excluded', async () => {
        const nodeModulesFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules');
        const workspace: Workspace = new Workspace([
            path.join(nodeModulesFolder, 'placeholder.txt'),
            path.join(nodeModulesFolder, 'subFolder'),
        ]);
        expect(workspace.getFilesAndFolders()).toEqual([
            path.join(nodeModulesFolder, 'placeholder.txt'),
            path.join(nodeModulesFolder, 'subFolder')
        ].sort());
        expect(await workspace.getExpandedFiles()).toEqual([
            path.join(nodeModulesFolder, 'placeholder.txt'),
            path.join(nodeModulesFolder, 'subFolder', 'someFile.txt')
        ].sort());
    });
});

function getAbsoluteRootFolder(): string {
    let rootFolder: string = __dirname;
    while (rootFolder !== path.dirname(rootFolder)) {
        rootFolder = path.dirname(rootFolder);
    }
    return rootFolder;
}