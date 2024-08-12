import {SemVer} from 'semver';
import {PythonVersionIdentifierImpl} from '../../../src/lib/python-versioning/PythonVersionIdentifier';

describe('PythonVersionIdentifier implementations', () => {
    describe('PythonVersionIdentifierImpl', () => {

        it('When command outputs parseable version, resolves to that version', async () => {
            const identifier = new PythonVersionIdentifierImpl();
            // NOTE: We can't guarantee that the current machine has Python on it, but we _can_ guarantee that it has Node.
            //       So we'll tell it to provide Node's version, and then just compare that to the version of this node process.
            const output: SemVer = await identifier.identifyPythonVersion('node');
            expect(output.compare(process.version)).toEqual(0);
        });


        it('When command does not output parseable, rejects', async () => {
            const identifier = new PythonVersionIdentifierImpl();
            // Feed the identifier something that directly outputs nonsense.
            await expect(identifier.identifyPythonVersion('echo')).rejects.toContain('version');
        });

        it('When command throws an error, rejects', async () => {
            const identifier = new PythonVersionIdentifierImpl();
            // Feed the identifier a nonsense command.
            await expect(identifier.identifyPythonVersion('aaaaaaaa')).rejects.toContain('aaaaaaaa');
        });
    });
});