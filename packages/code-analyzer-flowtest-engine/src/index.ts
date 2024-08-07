import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEnginePlugin} from "./plugin";

function createEnginePlugin(): EnginePlugin {
    return new FlowTestEnginePlugin();
}

export {createEnginePlugin, FlowTestEnginePlugin};