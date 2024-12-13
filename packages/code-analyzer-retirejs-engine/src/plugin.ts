import {ConfigObject, ConfigValueExtractor, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {RetireJsEngine} from "./engine";

export class RetireJsEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [RetireJsEngine.NAME];
    }

    async createEngine(engineName: string, _config: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        return new RetireJsEngine();
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