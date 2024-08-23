import {ConfigObject, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "./engine";
import {getMessage} from './messages';
import {validateAndNormalizeConfig} from "./config";
import {PythonVersionIdentifier, RuntimePythonVersionIdentifier} from "./PythonVersionIdentifier";


export class FlowTestEnginePlugin extends EnginePluginV1 {
    private readonly pythonVersionIdentifier: PythonVersionIdentifier;

    public constructor(pythonVersionIdentifier: PythonVersionIdentifier = new RuntimePythonVersionIdentifier()) {
        super();
        this.pythonVersionIdentifier = pythonVersionIdentifier;
    }

    public getAvailableEngineNames(): string[] {
        return [FlowTestEngine.NAME];
    }

    public async createEngine(engineName: string, rawEngineConfig: ConfigObject): Promise<Engine> {
        if (engineName !== FlowTestEngine.NAME) {
            throw new Error(getMessage('CantCreateEngineWithUnknownName', engineName));
        }
        return new FlowTestEngine(await validateAndNormalizeConfig(rawEngineConfig, this.pythonVersionIdentifier));
    }
}

