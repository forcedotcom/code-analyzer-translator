import {ConfigObject, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "./engine";
import {getMessage} from './messages';


export class FlowTestEnginePlugin extends EnginePluginV1 {
    public getAvailableEngineNames(): string[] {
        return [FlowTestEngine.NAME];
    }

    public async createEngine(engineName: string, _engineConfig: ConfigObject): Promise<Engine> {
        if (engineName !== FlowTestEngine.NAME) {
            throw new Error(getMessage('CantCreateEngineWithUnknownName', engineName));
        }
        return new FlowTestEngine();
    }
}

