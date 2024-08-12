import {SemVer} from 'semver';
import {LogLevel} from "@salesforce/code-analyzer-engine-api";

import {PythonVersionManager} from "../../../src/lib/python-versioning/PythonVersionManager";
import {FlowTestConfig} from "../../../src/config";
import {getMessage} from '../../../src/messages';

import {StubPythonVersionIdentifier} from "../../stubs/StubPythonVersionIdentifier";

describe('PythonVersionManager', () => {
    let logEvents: {logLevel: LogLevel, message: string}[] = [];
    const logEventFunction = (logLevel: LogLevel, message: string) => {
        logEvents.push({
            logLevel,
            message
        });
    };

    beforeEach(() => {
        logEvents = [];
    });

    describe('Deriving Python command from config', () => {
        const fakePythonCommand = 'fakepythoncommand';
        const config: FlowTestConfig = {
            python_command_path: fakePythonCommand
        };

        it('When config-specified Python is 3.10+, it is returned', async () => {
            const stubIdentifier = new StubPythonVersionIdentifier(new Map([
                [fakePythonCommand, new SemVer('3.10.0')]
            ]));
            const versionManager = new PythonVersionManager(stubIdentifier, logEventFunction);

            // Verify that the right value was returned.
            const output = await versionManager.getPythonCommand(config);
            expect(output).toEqual(fakePythonCommand);
            // Verify that the right events were logged.
            expect(logEvents).toEqual([
                {logLevel: LogLevel.Info, message: getMessage('PythonReceivedFromConfig', fakePythonCommand, 'python_command_path')},
                {logLevel: LogLevel.Info, message: getMessage('PythonVersionAcceptable', fakePythonCommand, '3.10.0')}
            ]);
        });

        it.each([
            {
                problem: 'outdated',
                versionMap: new Map<string,SemVer>([[fakePythonCommand, new SemVer('3.9.0')]]),
                expectedRejectionLog: getMessage('PythonVersionUnacceptable', fakePythonCommand, '3.9.0')
            },
            {
                problem: 'non-functional',
                versionMap: new Map<string,SemVer>(),
                expectedRejectionLog: getMessage('PythonVersionNonfunctional', fakePythonCommand)
            }
        ])('When config-specified Python is $problem, an error is thrown', async ({versionMap, expectedRejectionLog}) => {
            const stubIdentifier = new StubPythonVersionIdentifier(versionMap);
            const versionManager = new PythonVersionManager(stubIdentifier, logEventFunction);

            // Expect the right error to be thrown
            await expect(versionManager.getPythonCommand(config)).rejects.toThrow(getMessage('CouldNotLocatePython',
                '3.10.0',
                fakePythonCommand,
                'python_command_path'));
            // Verify that the right events were logged.
            expect(logEvents).toEqual([
                {logLevel: LogLevel.Info, message: getMessage('PythonReceivedFromConfig', fakePythonCommand, 'python_command_path')},
                {logLevel: LogLevel.Error, message: expectedRejectionLog}
            ]);
        });
    });

    describe('Deriving Python command dynamically', () => {
        it('`python3` is tried first', async () => {
            const stubIdentifier = new StubPythonVersionIdentifier(new Map([
                // Map all three options to valid versions.
                ['python3', new SemVer('3.10.0')],
                ['python', new SemVer('3.10.0')],
                ['py', new SemVer('3.10.0')]
            ]));
            const versionManager = new PythonVersionManager(stubIdentifier, logEventFunction);

            // Expect the right value to be returned
            const output = await versionManager.getPythonCommand({});
            expect(output).toEqual('python3');
            // Verify that the right events were logged.
            expect(logEvents).toEqual([
                {logLevel: LogLevel.Info, message: getMessage('ConfigDoesNotSpecifyPython', 'python_command_path')},
                {logLevel: LogLevel.Info, message: getMessage('PythonVersionAcceptable', 'python3', '3.10.0')}
            ]);
        });

        it('`python` is tried second', async () => {
            const stubIdentifier = new StubPythonVersionIdentifier(new Map([
                // Map python3 to an invalid version.
                ['python3', new SemVer('3.9.0')],
                // Map python and py to valid versions.
                ['python', new SemVer('3.10.0')],
                ['py', new SemVer('3.10.0')]
            ]));
            const versionManager = new PythonVersionManager(stubIdentifier, logEventFunction);

            // Expect the right value to be returned.
            const output = await versionManager.getPythonCommand({});
            expect(output).toEqual('python');
            // Verify that the right events were logged.
            expect(logEvents).toEqual([
                {logLevel: LogLevel.Info, message: getMessage('ConfigDoesNotSpecifyPython', 'python_command_path')},
                {logLevel: LogLevel.Error, message: getMessage('PythonVersionUnacceptable', 'python3', '3.9.0')},
                {logLevel: LogLevel.Info, message: getMessage('PythonVersionAcceptable', 'python', '3.10.0')}
            ]);
        });

        it('`py` is tried last', async () => {
            const stubIdentifier = new StubPythonVersionIdentifier(new Map([
                // Map python3 to an invalid version.
                ['python3', new SemVer('3.8.0')],
                // Map python to nothing at all.
                // Map only py to a valid version.
                ['py', new SemVer('3.10.0')]
            ]));
            const versionManager = new PythonVersionManager(stubIdentifier, logEventFunction);

            // Expect the right value to be returned.
            const output = await versionManager.getPythonCommand({});
            expect(output).toEqual('py');
            // Verify that the right events were logged.
            expect(logEvents).toEqual([
                {logLevel: LogLevel.Info, message: getMessage('ConfigDoesNotSpecifyPython', 'python_command_path')},
                {logLevel: LogLevel.Error, message: getMessage('PythonVersionUnacceptable', 'python3', '3.8.0')},
                {logLevel: LogLevel.Error, message: getMessage('PythonVersionNonfunctional', 'python')},
                {logLevel: LogLevel.Info, message: getMessage('PythonVersionAcceptable', 'py', '3.10.0')}
            ]);
        });

        it('If no 3.10+ version of Python can be found, error is thrown', async () => {
            // Map no valid version of Python.
            const stubIdentifier = new StubPythonVersionIdentifier(new Map());
            const versionManager = new PythonVersionManager(stubIdentifier, logEventFunction);

            // Expect the right error message to be thrown.
            await expect(versionManager.getPythonCommand({})).rejects.toThrow(getMessage('CouldNotLocatePython',
                '3.10.0',
                'python3, python, py',
                'python_command_path'
            ));
            // Verify that the right events were logged.
            expect(logEvents).toEqual([
                {logLevel: LogLevel.Info, message: getMessage('ConfigDoesNotSpecifyPython', 'python_command_path')},
                {logLevel: LogLevel.Error, message: getMessage('PythonVersionNonfunctional', 'python3')},
                {logLevel: LogLevel.Error, message: getMessage('PythonVersionNonfunctional', 'python')},
                {logLevel: LogLevel.Error, message: getMessage('PythonVersionNonfunctional', 'py')},
            ]);
        });
    });
});