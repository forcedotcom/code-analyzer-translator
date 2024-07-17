import { RegexEnginePlugin } from "./plugin";
import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";

function createEnginePlugin(): EnginePlugin {
    return new RegexEnginePlugin();
}

export { createEnginePlugin, RegexEnginePlugin }