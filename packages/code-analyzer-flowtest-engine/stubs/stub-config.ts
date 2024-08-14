import {ConfigObject} from '@salesforce/code-analyzer-engine-api';
import {FlowTestConfig, FlowTestConfigFactory} from '../src/config';

export class StubFlowTestConfigFactory implements FlowTestConfigFactory {
    private readonly dummyPythonCommand: string;

    public constructor(dummyPythonCommand: string) {
        this.dummyPythonCommand = dummyPythonCommand;
    }

    public create(rawConfig: ConfigObject): Promise<FlowTestConfig> {
        return Promise.resolve({
            python_command_path: this.dummyPythonCommand
        });
    }
}