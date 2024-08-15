import {ConfigObject, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "./engine";
import {getMessage} from './messages';
import {ConfigNormalizer} from "./config";
import {PythonVersionIdentifier, RuntimePythonVersionIdentifier} from "./lib/python/PythonVersionIdentifier";


export class FlowTestEnginePlugin extends EnginePluginV1 {
    private readonly configNormalizer: ConfigNormalizer;

    public constructor(pythonVersionIdentifier: PythonVersionIdentifier = new RuntimePythonVersionIdentifier()) {
        super();
        this.configNormalizer = new ConfigNormalizer(pythonVersionIdentifier);
    }

    public getAvailableEngineNames(): string[] {
        return [FlowTestEngine.NAME];
    }

    public async createEngine(engineName: string, engineConfig: ConfigObject): Promise<Engine> {
        if (engineName !== FlowTestEngine.NAME) {
            throw new Error(getMessage('CantCreateEngineWithUnknownName', engineName));
        }
        return new FlowTestEngine(await this.configNormalizer.normalize(engineConfig));
    }

}

