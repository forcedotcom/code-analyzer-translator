import {SemVer, coerce} from 'semver';
import * as cp from 'node:child_process';
import {getMessage} from '../../messages';

export interface PythonVersionIdentifier {
    identifyPythonVersion(pythonCommand: string): Promise<SemVer>;
}

export class PythonVersionIdentifierImpl implements PythonVersionIdentifier{
    /**
     * Resolves to a {@link SemVer} representing the version of the Python instance invoked by the provided
     * command
     * @param pythonCommand
     */
    public identifyPythonVersion(pythonCommand: string): Promise<SemVer> {
        return new Promise<SemVer>((res, rej) => {
            // Python's version flag is `--version`.
            const child = cp.spawn(pythonCommand, ['--version']);

            let stdout: string = '';
            let stderr: string = '';

            child.stdout.on('data', data => {
                stdout += data;
            });

            child.stderr.on('data', data => {
                stderr += data;
            });

            child.on('exit', code => {
                // A 0-code indicates that the process ran successfully.
                if (code === 0) {
                    // The version will be output in the form of something like "Python 3.12.4", which can be coerced to
                    // a SemVer directly.
                    const coercedVersion = coerce(stdout);
                    if (coercedVersion) {
                        return res(coercedVersion);
                    } else {
                        // If we weren't able to parse out a SemVer, then reject and include the unparseable stdout.
                        return rej(getMessage('CouldNotParseVersionFromOutput', pythonCommand, stdout));
                    }
                } else {
                    // A non-0 exit code indicates a failure. So just reject with whatever `stderr` was.
                    return rej(stderr);
                }
            });

            // This handler is for when the process can't be spawned (e.g., if the command doesn't exist on the machine).
            child.on('error', err => {
                // Reject with whatever the error message was.
                return rej(err.message);
            });
        });
    }
}