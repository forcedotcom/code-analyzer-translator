import {ConfigObject, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "./engine";
import {getMessage} from './messages';
import {FlowTestConfigFactory, FlowTestConfigFactoryImpl} from "./config";
import {PythonVersionIdentifierImpl} from "./lib/python/PythonVersionIdentifier";


export class FlowTestEnginePlugin extends EnginePluginV1 {
    public getAvailableEngineNames(): string[] {
        return [FlowTestEngine.NAME];
    }

    public async createEngine(engineName: string, engineConfig: ConfigObject): Promise<Engine> {
        if (engineName !== FlowTestEngine.NAME) {
            throw new Error(getMessage('CantCreateEngineWithUnknownName', engineName));
        }
        const configFactory: FlowTestConfigFactory = this._getConfigFactory();
        return new FlowTestEngine(await configFactory.create(engineConfig));
    }

    /* istanbul ignore next: Difficult to test */
    public _getConfigFactory(): FlowTestConfigFactory {
        return new FlowTestConfigFactoryImpl({
            pythonVersionIdentifier: new PythonVersionIdentifierImpl()
        });
    }
}

