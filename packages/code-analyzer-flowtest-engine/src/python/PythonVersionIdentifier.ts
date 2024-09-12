import {SemVer, coerce} from 'semver';
import * as cp from 'node:child_process';
import which from 'which';

export type PythonVersionDescriptor = {
    executable: string;
    version: SemVer|null;
};

export interface PythonVersionIdentifier {
    identifyPythonVersion(pythonCommand: string): Promise<PythonVersionDescriptor>;
}

export class RuntimePythonVersionIdentifier implements PythonVersionIdentifier{
    /**
     * Resolves to a {@link SemVer} representing the version of the Python instance invoked by the provided
     * command
     * @param pythonCommand
     */
    public async identifyPythonVersion(pythonCommand: string): Promise<PythonVersionDescriptor> {
        // It's possible that the supplied command version is an alias like `python3`. In that case, we need to convert
        // it into an absolute path via `which` in order to use it later.
        let absoluteCommand: string;
        try {
            absoluteCommand = await which(pythonCommand);
        } catch (e) {
            const message: string = e instanceof Error ? e.message : /* istanbul ignore next */ e as string;
            return Promise.reject(message);
        }
        return new Promise<PythonVersionDescriptor>((res, rej) => {
            // Python's version flag is `--version`.
            const child = cp.spawn(absoluteCommand, ['--version']);

            let stdout: string = '';
            let stderr: string = '';

            child.stdout.on('data', data => {
                stdout += data;
            });
            /* istanbul ignore next */
            child.stderr.on('data', data => {
                stderr += data;
            });
            child.on('exit', code => {
                /* istanbul ignore else */
                if (code === 0) {
                    // The version will be output in the form of something like "Python 3.12.4", which can be coerced to
                    // a SemVer directly, with the result being null if the coercion fails.
                    res({
                        executable: absoluteCommand,
                        version: coerce(stdout)
                    });
                } else {
                    // A non-0 exit code indicates a failure. So just reject with whatever `stderr` was.
                    rej(stderr);
                }
            });
            // This handler is for when the process can't be spawned (e.g., if the command doesn't exist on the machine).
            child.on('error', err => {
                // Reject with whatever the error message was.
                // istanbul ignore next: Difficult to create automated test
                rej(err.message);
            });
        });
    }
}