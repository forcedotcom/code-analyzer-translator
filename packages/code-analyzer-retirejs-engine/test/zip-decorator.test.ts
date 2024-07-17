import path from 'node:path';
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {DecoratedStreamZip} from "../src/zip-decorator";

changeWorkingDirectoryToPackageRoot()

describe('DecoratedStreamZip', () => {
   describe('#entries()', () => {
       it('Successfully reads a valid ZIP', async () => {
           // Create a StreamZip for a ZIP file we know is valid.
           const pathToZip = path.resolve('test', 'test-data', 'scenarios', '7_hasZipFolderWithVulnFileInChildFolders', 'ZipWithDirectories.zip');
           const zip = new DecoratedStreamZip({file: pathToZip, storeEntries: true});

           // Create the ZIP's entries.
           const entries = await zip.entries();

           // Make sure that all of the expected entries are in there.
           const expectedEntryNames = [
               'FilledParentFolder/',
               'FilledParentFolder/ChildFolderWithoutText/',
               'FilledParentFolder/ChildFolderWithoutText/ImageFile.png',
               '__MACOSX/',
               '__MACOSX/FilledParentFolder/',
               '__MACOSX/FilledParentFolder/ChildFolderWithoutText/',
               '__MACOSX/FilledParentFolder/ChildFolderWithoutText/._ImageFile.png',
               'FilledParentFolder/ChildFolderWithoutText/ImageFileWithoutExt',
               '__MACOSX/FilledParentFolder/ChildFolderWithoutText/._ImageFileWithoutExt',
               'FilledParentFolder/ChildFolderWithoutText/ImageFileWithWeirdExt.foo',
               '__MACOSX/FilledParentFolder/ChildFolderWithoutText/._ImageFileWithWeirdExt.foo',
               'FilledParentFolder/EmptyChildFolder/',
               'FilledParentFolder/ChildFolderWithText/',
               'FilledParentFolder/ChildFolderWithText/JsFileWithOddExt.foo',
               'FilledParentFolder/ChildFolderWithText/JsFileWithoutExt',
               'FilledParentFolder/ChildFolderWithText/JsFile.js',
               'EmptyParentFolder/'
           ];
           expect(Object.values(entries).map(e => e.name)).toEqual(expectedEntryNames);
       });

       it('Properly contextualizes failure to read a ZIP', async () => {
           // Create a StreamZip for a ZIP file we know is unreadable.
           const pathToZip = path.resolve('test', 'test-data', 'scenarios', '10_hasUnreadableZip', 'ZipInInvalidFormat.zip');
           const zip = new DecoratedStreamZip({file: pathToZip, storeEntries: true});

           // Ordinarily, we'd simply use Jest's `expect().toThrow()` method, but since we need to assert specific things
           // about the error, we're doing this instead.
           let errorMessage: string = '';
           try {
               // Attempt to get the ZIP's entries, which should throw an error.
               await zip.entries();
           } catch (e) {
               errorMessage = e instanceof Error ? e.message : e as string;
           }

           expect(errorMessage).toContain('Failed to get entries from ZIP file');
           expect(errorMessage).toContain('Reason: Invalid entry header');
       });
   });

    describe('#entryData()', () => {
        it('Properly contextualizes failure to read entries from a ZIP', async () => {
            // Create a StreamZip for a ZIP file we know has a corrupted entry.
            const pathToZip = path.resolve('test', 'test-data', 'scenarios', '11_hasZipWithCorruptedEntry', 'corrupt_entry.zip');
            const zip = new DecoratedStreamZip({file: pathToZip, storeEntries: true});

            // Get the entries from the ZIP.
            const entries = await zip.entries();
            const corruptedEntryName = 'doc/api_assets/logo.svg';

            // Ordinarily, we'd simply use Jest's `expect().toThrow()` method, but since we need to assert specific things
            // about the error, we're doing this instead.
            let errorMessage: string = '';
            try {
                // Attempt to get the data from the ZIP entry.
                await zip.entryData(corruptedEntryName);
            } catch (e) {
                errorMessage = e instanceof Error ? e.message : e as string;
            }

            expect(errorMessage).toContain(`Failed to read entry ${corruptedEntryName}`);
            expect(errorMessage).toContain('Reason: Error: invalid distance too far back');
        });
    });
});