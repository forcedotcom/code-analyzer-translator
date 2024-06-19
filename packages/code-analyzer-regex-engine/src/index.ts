import { RegexEnginePlugin } from "./RegexEnginePlugin";
import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";

function createEnginePlugin(): EnginePlugin {
    return new RegexEnginePlugin();
}

export { createEnginePlugin, RegexEnginePlugin }