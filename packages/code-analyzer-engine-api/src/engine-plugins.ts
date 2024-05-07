import { Engine } from "./engines"

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
    getPluginVersion(): number
}

export abstract class EnginePluginV1 implements EnginePlugin {
    public getPluginVersion(): number {
        return 1.0;
    }

    abstract getAvailableEngineNames(): string[]

    abstract createEngine(engineName: string, config: ConfigObject): Engine
}