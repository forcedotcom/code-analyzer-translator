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

    it("When including files we don't care to process like .gitignore file or a node_modules folder, then they are removed", async () => {
        const workspace: Workspace = new Workspace([
            path.join(SAMPLE_WORKSPACE_FOLDER ,'node_modules', 'place_holder.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER ,'.gitignore')]);
        expect(workspace.getFilesAndFolders()).toEqual([path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt')]);
    });

    it('When calling getExpandedFiles, then all files underneath all subfolders are found', async () => {
        const workspace: Workspace = new Workspace([path.join(__dirname, 'test-data', 'sampleWorkspace')]);
        expect(await workspace.getExpandedFiles()).toEqual([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile2InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.txt')
        ]);
    })
});