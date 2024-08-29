import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {ESLINT_ENGINE_CONFIG_DESCRIPTION, ESLintEngineConfig, validateAndNormalizeConfig} from "./config";
import {ESLintEngine} from "./engine";

export class ESLintEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [ESLintEngine.NAME];
    }

    describeEngineConfig(engineName: string): ConfigDescription {
        validateEngineName(engineName);
        return ESLINT_ENGINE_CONFIG_DESCRIPTION;
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> { // eslint-disable-line @typescript-eslint/no-unused-vars
        validateEngineName(engineName);
        return validateAndNormalizeConfig(configValueExtractor) as ConfigObject;
    }

    async createEngine(engineName: string, resolvedConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        return new ESLintEngine(resolvedConfig as ESLintEngineConfig);
    }
}

function validateEngineName(engineName: string) {
    if (engineName !== ESLintEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}