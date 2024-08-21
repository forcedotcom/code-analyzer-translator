import {SemVer} from "semver";
import {ConfigObject} from "@salesforce/code-analyzer-engine-api";
import {FlowTestConfig, ConfigNormalizer, PYTHON_COMMAND_PATH} from "../src/config";
import {StubPythonVersionIdentifier} from "./stubs/StubPythonVersionIdentifier";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

describe('ConfigNormalizer', () => {
    describe('Deriving Python from raw config', () => {
        const fakePythonCommand = 'fakepythoncommand';
        const rawConfig: ConfigObject = {
            python_command_path: fakePythonCommand
        };

        it('When config-specified Python is 3.10+, it is returned', async () => {
            const pythonVersionIdentifier = new StubPythonVersionIdentifier(new Map([
                [fakePythonCommand, new SemVer('3.10.0')]
            ]));
            const normalizer = new ConfigNormalizer(pythonVersionIdentifier);

            const validatedConfig: FlowTestConfig = await normalizer.normalize(rawConfig);
            expect(validatedConfig.python_command_path).toEqual(fakePythonCommand);
        });

        it.each([
            {
                problem: 'outdated',
                versionMap: new Map<string,SemVer|null>([[fakePythonCommand, new SemVer('3.9.0')]]),
                expectedError: getMessage('UserSpecifiedPythonBelowMinimumVersion', PYTHON_COMMAND_PATH, fakePythonCommand, '3.9.0', '3.10.0')
            },
            {
                problem: 'non-functional',
                versionMap: new Map<string,SemVer|null>([[fakePythonCommand, null]]),
                expectedError: getMessage('UserSpecifiedUnrecognizablePython', PYTHON_COMMAND_PATH, fakePythonCommand)
            }
        ])('When config-specified Python is $problem, an error is thrown', async ({versionMap, expectedError}) => {
            const pythonVersionIdentifier = new StubPythonVersionIdentifier(versionMap);
            const normalizer = new ConfigNormalizer(pythonVersionIdentifier);

            await expect(normalizer.normalize(rawConfig)).rejects.toThrow(expectedError);
        });
    });

    describe('Automatic Python inference', () => {
        it('`python3` is tried first', async () => {
            const pythonVersionIdentifier = new StubPythonVersionIdentifier(new Map([
                // Map all three options to valid versions.
                ['python3', new SemVer('3.10.0')],
                ['python', new SemVer('3.10.0')]
            ]));
            const normalizer = new ConfigNormalizer(pythonVersionIdentifier);

            const validatedConfig: FlowTestConfig = await normalizer.normalize({});
            expect(validatedConfig.python_command_path).toEqual('python3');
        });

        it('`python` is tried second', async () => {
            const pythonVersionIdentifier = new StubPythonVersionIdentifier(new Map([
                // Map python3 to an invalid version.
                ['python3', new SemVer('3.9.0')],
                // Map python to a valid version.
                ['python', new SemVer('3.10.0')]
            ]));
            const normalizer = new ConfigNormalizer(pythonVersionIdentifier);

            const validatedConfig: FlowTestConfig = await normalizer.normalize({});
            expect(validatedConfig.python_command_path).toEqual('python');
        });

        it('If no 3.10+ version of Python can be found, error is thrown', async () => {
            // Map no valid versions of Python.
            const pythonVersionIdentifier = new StubPythonVersionIdentifier(new Map([
                ['python3', null],
                ['python', null]
            ]));
            const normalizer = new ConfigNormalizer(pythonVersionIdentifier);

            await expect(normalizer.normalize({})).rejects.toThrow(getMessage('CouldNotLocatePython','3.10.0', 'python3, python', PYTHON_COMMAND_PATH));
        });
    });
});