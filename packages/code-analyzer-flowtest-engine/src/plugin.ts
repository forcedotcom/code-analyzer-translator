import {ConfigObject, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "./engine";
import {getMessage} from './messages';
import {validateAndNormalizeConfig} from "./config";
import {PythonVersionIdentifierImpl} from "./lib/python-versioning/PythonVersionIdentifier";


export class FlowTestEnginePlugin extends EnginePluginV1 {
    public getAvailableEngineNames(): string[] {
        return [FlowTestEngine.NAME];
    }

    public async createEngine(engineName: string, engineConfig: ConfigObject): Promise<Engine> {
        if (engineName !== FlowTestEngine.NAME) {
            throw new Error(getMessage('CantCreateEngineWithUnknownName', engineName));
        }
        return new FlowTestEngine(validateAndNormalizeConfig(engineConfig), {
            pythonVersionIdentifier: new PythonVersionIdentifierImpl()
        });
    }
}

