import {ConfigObject, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {validateAndNormalizeConfig} from "./config";
import {ESLintEngine} from "./engine";

export class ESLintEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [ESLintEngine.NAME];
    }

    async createEngine(engineName: string, engineConfig: ConfigObject): Promise<Engine> {
        if (engineName !== ESLintEngine.NAME) {
            throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
        }
        return new ESLintEngine(validateAndNormalizeConfig(engineConfig));
    }
}