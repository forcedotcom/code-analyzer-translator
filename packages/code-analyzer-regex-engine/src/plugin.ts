import {
    ConfigObject,
    Engine,
    EnginePluginV1,
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {RegexEngine} from "./engine";
import {validateAndNormalizeConfig} from "./config";

export class RegexEnginePlugin extends EnginePluginV1 {

    getAvailableEngineNames(): string[] {
        return [RegexEngine.NAME];
    }

    async createEngine(engineName: string, config: ConfigObject): Promise<Engine> {
        if (engineName === RegexEngine.NAME) {
            return new RegexEngine(validateAndNormalizeConfig(config));
        }  else {
            throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
        }
    }
}