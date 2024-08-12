import {LogLevel} from "@salesforce/code-analyzer-engine-api";
import {SemVer} from 'semver';
import {FlowTestConfig} from "../../config";
import {PythonVersionIdentifier} from './PythonVersionIdentifier';
import {getMessage} from '../../messages';

export type EmitLogEventFcn = (logLevel: LogLevel, msg: string) => void;

export class PythonVersionManager {
    private static MINIMUM_VERSION: string = '3.10.0';

    private readonly versionIdentifier: PythonVersionIdentifier;
    private readonly emitLogEvent: EmitLogEventFcn;

    public constructor(versionIdentifier: PythonVersionIdentifier, emitLogEvent: EmitLogEventFcn) {
        this.versionIdentifier = versionIdentifier;
        this.emitLogEvent = emitLogEvent;
    }

    public async getPythonCommand(config: FlowTestConfig): Promise<string> {
        const commandsToTry: string[] = [];
        if (config.python_command_path) {
            this.emitLogEvent(LogLevel.Info, getMessage('PythonReceivedFromConfig', config.python_command_path, 'python_command_path'));
            commandsToTry.push(config.python_command_path);
        } else {
            this.emitLogEvent(LogLevel.Info, getMessage('ConfigDoesNotSpecifyPython', 'python_command_path'));
            commandsToTry.push('python3', 'python', 'py');
        }

        for (const commandToTry of commandsToTry) {
            let commandVersion: SemVer|null;
            try {
                commandVersion = await this.versionIdentifier.identifyPythonVersion(commandToTry);
            } catch (e) {
                commandVersion = null;
            }

            // If we didn't get a version at all, it's because the command isn't a functional version of Python.
            if (!commandVersion) {
                this.emitLogEvent(LogLevel.Error, getMessage('PythonVersionNonfunctional', commandToTry));
                continue;
            }
            // If we got a version that comes out as below our minimum, we can't use this command.
            if (commandVersion.compare(PythonVersionManager.MINIMUM_VERSION) < 0) {
                this.emitLogEvent(LogLevel.Error, getMessage('PythonVersionUnacceptable', commandToTry, commandVersion.format()));
                continue;
            }
            // If there are no problems, we can use this command.
            this.emitLogEvent(LogLevel.Info, getMessage('PythonVersionAcceptable', commandToTry, commandVersion.format()));
            return commandToTry;
        }
        throw new Error(getMessage('CouldNotLocatePython', PythonVersionManager.MINIMUM_VERSION, commandsToTry.join(', '), 'python_command_path'));
    }
}