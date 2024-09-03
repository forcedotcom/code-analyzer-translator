import {ConfigObject, Engine, EnginePluginV1} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {PmdEngine} from "./pmd-engine";
import {CpdEngine} from "./cpd-engine";

export class PmdCpdEnginesPlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        // Will add in CpdEngine.NAME only after we have implemented the cpd engine so that it doesn't show up anywhere
        return [PmdEngine.NAME];
    }

    async createEngine(engineName: string, _engineConfig: ConfigObject): Promise<Engine> {
        if (engineName === CpdEngine.NAME) {
            return new CpdEngine();
        } else if (engineName === PmdEngine.NAME) {
            return new PmdEngine();
        }
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}