import { Engine } from "./engines"

export const ENGINE_API_VERSION: number = 1.0;

export type ConfigObject = {
    [key: string]: ConfigValue
}
export type ConfigValue =
    | string
    | number
    | boolean
    | null
    | ConfigValue[]
    | ConfigObject;

export interface EnginePlugin  {
    getApiVersion(): number
    getAvailableEngineNames(): string[]
}

export abstract class EnginePluginV1 implements EnginePlugin {
    public getApiVersion(): number {
        return ENGINE_API_VERSION;
    }

    abstract getAvailableEngineNames(): string[]

    abstract createEngine(engineName: string, config: ConfigObject): Engine
}