import {
    ConfigObject,
    Engine,
    EnginePluginV1,
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {RegexEngine} from "./engine";

export class RegexEnginePlugin extends EnginePluginV1 {

    getAvailableEngineNames(): string[] {
        return [RegexEngine.NAME];
    }

    async createEngine(engineName: string, _config: ConfigObject): Promise<Engine> {
        if (engineName === RegexEngine.NAME) {
            return new RegexEngine();
        }  else {
            throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
        }
    }
}