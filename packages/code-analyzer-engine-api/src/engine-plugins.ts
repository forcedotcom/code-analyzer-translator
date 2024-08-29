import {Engine} from "./engines"
import {ConfigDescription, ConfigObject, ConfigValueExtractor} from "./config";

export const ENGINE_API_VERSION: number = 1.0;

export interface EnginePlugin  {
    getApiVersion(): number
    getAvailableEngineNames(): string[]
}

export abstract class EnginePluginV1 implements EnginePlugin {
    /**
     * Returns the plugin's api version.
     * Note to plugin author: Do not override this method.
     */
    public getApiVersion(): number {
        return ENGINE_API_VERSION;
    }

    /**
     * Returns the names of the engines that this plugin can create.
     * Note to plugin author: This method must be implemented.
     */
    abstract getAvailableEngineNames(): string[]

    /**
     * Returns a configuration description object that helps describe the configuration and its fields
     * Note to plugin author: This method should be overridden to return the configuration that you wish to expose to the client.
     *                        Otherwise, an empty configuration description will be returned.
     * @param engineName The name of the engine
     */
    describeEngineConfig(engineName: string): ConfigDescription { // eslint-disable-line @typescript-eslint/no-unused-vars
        return {};
    }

    /**
     * Returns the resolved configuration with the full configuration state for the specified engine.
     * Note to plugin author: This method should be overridden to return the configuration that you wish to expose to the client.
     *                        Otherwise, the unvalidated user provided override values will be returned.
     * @param engineName The name of the engine
     * @param configValueExtractor An instance of ConfigValueExtractor to help extract and validate the configuration values from the user provided overrides
     */
    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> { // eslint-disable-line @typescript-eslint/no-unused-vars
        return configValueExtractor.getObject();
    }

    /**
     * Constructs an Engine instance for the provided engine name
     * @param engineName The name of the engine
     * @param resolvedConfig The resolved configuration to be applied when creating the engine
     */
    abstract createEngine(engineName: string, resolvedConfig: ConfigObject): Promise<Engine>
}