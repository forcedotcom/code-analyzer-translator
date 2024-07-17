import {ConfigObject, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {CpdEngine, PmdEngine} from "./engines";

export class PmdCpdEnginesPlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [CpdEngine.NAME, PmdEngine.NAME];
    }

    async createEngine(engineName: string, _engineConfig: ConfigObject): Promise<Engine> {
        if (engineName === CpdEngine.NAME) {
            return new CpdEngine();
        } else if (engineName === PmdEngine.NAME) {
            return new PmdEngine();
        }
        throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
    }
}