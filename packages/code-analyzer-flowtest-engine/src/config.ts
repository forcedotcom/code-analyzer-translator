import {SemVer} from 'semver';
import {ConfigObject, ConfigValueExtractor} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from './messages';
import {FlowTestEngine} from "./engine";
import {PythonVersionIdentifier} from "./PythonVersionIdentifier";

const MINIMUM_PYTHON_VERSION = '3.10.0';
export const PYTHON_COMMAND = 'python_command';

export type FlowTestConfig = {
    // Indicates the specific Python command to use for the 'flowtest' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/Library/Frameworks/Python.framework/Versions/3.12/bin/python3'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a Python command from your environment.
    python_command: string;
}

export async function validateAndNormalizeConfig(rawConfig: ConfigObject,
                                                 pythonVersionIdentifier: PythonVersionIdentifier): Promise<FlowTestConfig> {
    const valueExtractor: FlowTestEngineConfigValueExtractor = new FlowTestEngineConfigValueExtractor(rawConfig, pythonVersionIdentifier);
    return {
        python_command: await valueExtractor.extractPythonCommandPath()
    }
}

class FlowTestEngineConfigValueExtractor extends ConfigValueExtractor {
    private readonly pythonVersionIdentifier: PythonVersionIdentifier;

    constructor(rawConfig: ConfigObject, pythonVersionIdentifier: PythonVersionIdentifier) {
        super(rawConfig, `engines.${FlowTestEngine.NAME}`);
        this.pythonVersionIdentifier = pythonVersionIdentifier;
    }

    async extractPythonCommandPath(): Promise<string> {
        const configSpecifiedPython: string|undefined = this.extractString(PYTHON_COMMAND);
        return configSpecifiedPython ? await this.validatePythonCommandPath(configSpecifiedPython) :
            await this.findPythonCommandPathFromEnvironment();
    }

    private async validatePythonCommandPath(configSpecifiedPython: string): Promise<string> {
        let version: SemVer|null;
        try {
            version = await this.pythonVersionIdentifier.identifyPythonVersion(configSpecifiedPython);
        } catch (err) {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('UserSpecifiedPythonCommandProducedError',
                this.getFieldPath(PYTHON_COMMAND), configSpecifiedPython, errMsg));
        }
        if (!version) {
            throw new Error(getMessage('UserSpecifiedPythonCommandProducedUnrecognizableVersion',
                this.getFieldPath(PYTHON_COMMAND), configSpecifiedPython));
        } else if (version.compare(MINIMUM_PYTHON_VERSION) < 0) {
            throw new Error(getMessage('UserSpecifiedPythonBelowMinimumVersion',
                this.getFieldPath(PYTHON_COMMAND), configSpecifiedPython, version.format(), MINIMUM_PYTHON_VERSION));
        }
        return configSpecifiedPython;
    }

    private async findPythonCommandPathFromEnvironment(): Promise<string> {
        const possiblePythonCommands: string[] = ['python3', 'python'];
        for (const pythonCommand of possiblePythonCommands) {
            try {
                const version: SemVer | null = await this.pythonVersionIdentifier.identifyPythonVersion(pythonCommand);
                if (version !== null && version.compare(MINIMUM_PYTHON_VERSION) >= 0) {
                    return pythonCommand;
                }
            } catch (err) {
                // continue
            }
        }
        throw new Error(getMessage('CouldNotLocatePython', MINIMUM_PYTHON_VERSION,
            JSON.stringify(possiblePythonCommands), this.getFieldPath(PYTHON_COMMAND),
            FlowTestEngine.NAME, FlowTestEngine.NAME));
    }
}