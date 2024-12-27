import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {RetireJsEngine} from "./engine";

export const RETIREJS_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
}

export class RetireJsEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [RetireJsEngine.NAME];
    }

    async createEngine(engineName: string, _config: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        return new RetireJsEngine();
    }

    describeEngineConfig(engineName: string): ConfigDescription {
        validateEngineName(engineName);
        return RETIREJS_ENGINE_CONFIG_DESCRIPTION;
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> {
        validateEngineName(engineName);
        configValueExtractor.validateContainsOnlySpecifiedKeys([]);
        return {};
    }
}

function validateEngineName(engineName: string): void {
    if (engineName !== RetireJsEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}