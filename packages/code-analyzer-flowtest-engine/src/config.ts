import {ConfigObject, ConfigValueExtractor} from "@salesforce/code-analyzer-engine-api";


export type FlowTestConfig = {
    /**
     * Optional. Indicates the specific Python command to use. If none is supplied, the engine will try to find one.
     * E.g., {@code python}, @{code /Library/Frameworks/Python.framework/Versions/3.12/bin/python3}.
     */
    python_command_path?: string;
}

export function validateAndNormalizeConfig(rawConfig: ConfigObject): FlowTestConfig {
    const valueExtractor = new ConfigValueExtractor(rawConfig);
    return {
        python_command_path: valueExtractor.extractString('python_command_path')
    };
}