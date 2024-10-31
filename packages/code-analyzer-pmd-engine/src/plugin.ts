import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {PmdEngine} from "./pmd-engine";
import {CpdEngine} from "./cpd-engine";
import {PMD_ENGINE_CONFIG_DESCRIPTION, PmdEngineConfig, validateAndNormalizePmdConfig} from "./config";
import {JavaVersionIdentifier, RuntimeJavaVersionIdentifier} from "./JavaVersionIdentifier";

export class PmdCpdEnginesPlugin extends EnginePluginV1 {
    private readonly javaVersionIdentifier: JavaVersionIdentifier;

    constructor(javaVersionIdentifier: JavaVersionIdentifier = new RuntimeJavaVersionIdentifier()) {
        super();
        this.javaVersionIdentifier = javaVersionIdentifier;
    }

    getAvailableEngineNames(): string[] {
        return [PmdEngine.NAME, CpdEngine.NAME];
    }

    describeEngineConfig(engineName: string): ConfigDescription { // eslint-disable-line @typescript-eslint/no-unused-vars
        if (engineName === CpdEngine.NAME) {
            return super.describeEngineConfig(engineName); // TODO: Return the correct ConfigDescription once we implement the CPD engine.
        } else if (engineName === PmdEngine.NAME) {
            return PMD_ENGINE_CONFIG_DESCRIPTION;
        }
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> { // eslint-disable-line @typescript-eslint/no-unused-vars
        if (engineName === CpdEngine.NAME) {
            return super.createEngineConfig(engineName, configValueExtractor); // TODO: Return the correct ConfigObject once we implement the CPD engine.
        } else if (engineName === PmdEngine.NAME) {
            return await validateAndNormalizePmdConfig(configValueExtractor, this.javaVersionIdentifier) as ConfigObject;
        }
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }

    async createEngine(engineName: string, engineConfig: ConfigObject): Promise<Engine> {
        if (engineName === CpdEngine.NAME) {
            return new CpdEngine();
        } else if (engineName === PmdEngine.NAME) {
            return new PmdEngine(engineConfig as PmdEngineConfig);
        }
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}