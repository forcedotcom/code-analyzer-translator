import {calculateLongestCommonParentFolderOf, makeUnique} from "../src/utils";
import path from "node:path";

describe('Tests for the calculateLongestCommonParentFolderOf utility function', () => {
    it('When an empty array is given, then null is returned)', () => {
        expect(calculateLongestCommonParentFolderOf([])).toStrictEqual(null);
    });

    it('When a single folder is provided, then that folder is returned', () => {
        expect(calculateLongestCommonParentFolderOf([__dirname])).toEqual(__dirname);
    });

    it('When a file is provided, then the parent folder of that file is returned', () => {
        expect(calculateLongestCommonParentFolderOf([path.join(__dirname, 'utils.test.ts')])).toEqual(__dirname);
    });

    it('When two files from the same folder are provided, then their parent folder is returned', () => {
        expect(calculateLongestCommonParentFolderOf([
            path.join(__dirname, 'test-data', 'legacyConfigCases', 'expectedRules_DefaultConfig.json'),
            path.join(__dirname, 'test-data', 'legacyConfigCases', 'expectedRules_DisabledJavascriptBaseConfig.json'),
        ])).toEqual(path.join(__dirname, 'test-data', 'legacyConfigCases'));
    });

    it('When a folder and a file from that folder are provided, then the folder is returned', () => {
        expect(calculateLongestCommonParentFolderOf([
            path.join(__dirname, 'test-data', 'legacyConfigCases', 'expectedRules_DefaultConfig.json'),
            path.join(__dirname, 'test-data', 'legacyConfigCases'),
        ])).toEqual(path.join(__dirname, 'test-data', 'legacyConfigCases'));
    });

    it('When a various files and folders are provided, then the longest common parent folder is returned', () => {
        expect(calculateLongestCommonParentFolderOf([
            path.join(__dirname, 'test-data', 'legacyConfigCases', 'expectedRules_DefaultConfig.json'),
            path.join(__dirname, 'test-data','legacyConfigCases', 'workspace_NoCustomConfig'),
            path.join(__dirname, 'test-data', 'legacyConfigCases', 'workspaceHasCustomConfigWithNewRules', 'dummy1.js'),
        ])).toEqual(path.join(__dirname, 'test-data', 'legacyConfigCases'));
    });

    it('When strings are provided which are not absolute paths that share a common root folder, then return null', () => {
        expect(calculateLongestCommonParentFolderOf(['oops', 'nope'])).toStrictEqual(null);
    });

    it('When the root folder is the longest common folder, then return it', () => {
        let rootFolder: string = __dirname;
        while (rootFolder !== path.dirname(rootFolder)) {
            rootFolder = path.dirname(rootFolder);
        }

        expect(calculateLongestCommonParentFolderOf([
            path.join(rootFolder, 'someFile'),
            path.join(rootFolder, 'someFolder', 'anotherFile')
        ])).toEqual(rootFolder);
    });
});

describe('Tests for the makeUnique utility function', () => {
    it('When an empty array is given, then return it', () => {
        expect(makeUnique([])).toEqual([]);
    });

    it('When an array with one value is given, then return it', () => {
        expect(makeUnique(['hello'])).toEqual(['hello']);
    });

    it('When an array with duplicate values is given, then remove duplicate entries maintaining the original order', () => {
        expect(makeUnique(['hello','1','z','z','hello','world'])).toEqual(['hello','1','z','world']);
    });
});
