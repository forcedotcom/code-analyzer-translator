import {SemVer} from 'semver';
import {ConfigObject, ConfigValueExtractor} from "@salesforce/code-analyzer-engine-api";
import {PythonVersionIdentifier} from './lib/python/PythonVersionIdentifier';
import {getMessage} from './messages';

const MINIMUM_PYTHON_VERSION = '3.10.0';
export const PYTHON_COMMAND_PATH = 'python_command_path';

export type FlowTestConfig = {
    /**
     * Indicates the specific Python command to use. Can be specified on the ConfigObject, or inferred automatically.
     * E.g., {@code python}, @{code /Library/Frameworks/Python.framework/Versions/3.12/bin/python3}.
     */
    [PYTHON_COMMAND_PATH]: string;
}

type FactoryDependencies = {
    pythonVersionIdentifier: PythonVersionIdentifier;
}

export interface FlowTestConfigFactory {
    create(rawConfig: ConfigObject): Promise<FlowTestConfig>;
}

export class FlowTestConfigFactoryImpl implements FlowTestConfigFactory {
    private readonly pythonVersionIdentifier: PythonVersionIdentifier;

    public constructor(dependencies: FactoryDependencies) {
        this.pythonVersionIdentifier = dependencies.pythonVersionIdentifier;
    }

    public async create(rawConfig: ConfigObject): Promise<FlowTestConfig> {
        const valueExtractor = new ConfigValueExtractor(rawConfig);
        const configSpecifiedPython: string|undefined = valueExtractor.extractString('python_command_path');

        if (configSpecifiedPython) {
            const version: SemVer|null = await this.pythonVersionIdentifier.identifyPythonVersion(configSpecifiedPython);
            if (!version) {
                throw new Error(getMessage('UserSpecifiedUnrecognizablePython', PYTHON_COMMAND_PATH, configSpecifiedPython));
            } else if (version.compare(MINIMUM_PYTHON_VERSION) < 0) {
                throw new Error(getMessage('UserSpecifiedPythonBelowMinimumVersion', PYTHON_COMMAND_PATH, configSpecifiedPython, version.format(), MINIMUM_PYTHON_VERSION));
            } else {
                return {
                    [PYTHON_COMMAND_PATH]: configSpecifiedPython
                };
            }
        } else {
            const possibleInferredPythons: string[] = ['python3', 'python'];

            // For each possible version of Python...
            for (const possibleInferredPython of possibleInferredPythons) {
                // Get its version.
                const version: SemVer|null = await this.pythonVersionIdentifier.identifyPythonVersion(possibleInferredPython);
                // Skip it if it's not recent enough or not recognizably a version.
                if (!version || version.compare(MINIMUM_PYTHON_VERSION) < 0) {
                    continue;
                }
                // Keep it if we haven't found a reason to throw it away yet.
                return {
                    [PYTHON_COMMAND_PATH]: possibleInferredPython
                };
            }
            // If none of the possible inferred Pythons worked out, throw an error.
            throw new Error(getMessage(
                'CouldNotLocatePython',
                MINIMUM_PYTHON_VERSION,
                possibleInferredPythons.join(', '),
                PYTHON_COMMAND_PATH)
            );
        }
    }
}