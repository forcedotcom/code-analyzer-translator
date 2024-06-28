import * as testTools from "../src/testtools";
import {Workspace} from "../src";
import path from "node:path";

describe('Tests for the various testtools', () => {
    it('The createWorkspace tool returns a fully functional workspace for testing purposes', async () => {
        const sampleWorkspaceFolder: string = path.resolve(__dirname, 'test-data', 'sampleWorkspace');
        const workspace: Workspace = testTools.createWorkspace([sampleWorkspaceFolder]);
        expect(workspace.getWorkspaceId()).toEqual("someWorkspaceId");
        expect(workspace.getFilesAndFolders()).toEqual([sampleWorkspaceFolder]);
        expect(await workspace.getExpandedFiles()).toEqual([
            path.join(sampleWorkspaceFolder, 'someFile.txt'),
            path.join(sampleWorkspaceFolder, 'sub1', 'someFileInSub1.txt'),
            path.join(sampleWorkspaceFolder, 'sub1', 'sub2', 'someFile1InSub2.txt'),
            path.join(sampleWorkspaceFolder, 'sub1', 'sub2', 'someFile2InSub2.txt'),
            path.join(sampleWorkspaceFolder, 'sub1', 'sub3', 'someFileInSub3.txt'),
        ]);

        const workspace2: Workspace = testTools.createWorkspace([sampleWorkspaceFolder], 'aDifferentWorkspaceId');
        expect(workspace2.getWorkspaceId()).toEqual('aDifferentWorkspaceId');
    });
});