import { MetadataEnginePlugin } from "./plugin";
import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";

function createEnginePlugin(): EnginePlugin {
    return new MetadataEnginePlugin();
}

export { createEnginePlugin, MetadataEnginePlugin }