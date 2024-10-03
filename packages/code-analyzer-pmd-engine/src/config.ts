import {ConfigDescription, ConfigValueExtractor} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {JavaVersionIdentifier} from "./JavaVersionIdentifier";
import {SemVer} from "semver";
import path from "node:path";
import {indent} from "./utils";

export const PMD_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('PmdConfigOverview'),
    fieldDescriptions: {
        java_command: getMessage('PmdConfigFieldDescription_java_command')
    }
}

const MINIMUM_JAVA_VERSION = '11.0.0';

export type PmdEngineConfig = {
    // Indicates the specific "java" command to use for the 'pmd' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/path/to/jdk/openjdk_11.0.17.0.1_11.60.54_x64/bin/java'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a 'java' command from your environment.
    java_command: string
}

export const DEFAULT_PMD_ENGINE_CONFIG: PmdEngineConfig = {
    java_command: 'java'
}

export async function validateAndNormalizePmdConfig(configValueExtractor: ConfigValueExtractor,
                                                    javaVersionIdentifier: JavaVersionIdentifier): Promise<PmdEngineConfig> {
    return {
        java_command: await extractJavaCommand(configValueExtractor, javaVersionIdentifier)
    }
}

async function extractJavaCommand(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier): Promise<string> {
    const javaCommand: string|undefined = configValueExtractor.extractString('java_command');
    if (!javaCommand) {
        return await attemptToAutoDetectJavaCommand(configValueExtractor, javaVersionIdentifier);
    }

    try {
        await validateJavaCommandContainsValidVersion(javaCommand, javaVersionIdentifier);
    } catch (err) {
        throw new Error(getMessage('InvalidUserSpecifiedJavaCommand',
            configValueExtractor.getFieldPath('java_command'), (err as Error).message));
    }
    return javaCommand;
}

async function attemptToAutoDetectJavaCommand(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier): Promise<string> {
    const commandsToAttempt: string[] = [
        // Environment variables specifying JAVA HOME take precedence (if they exist)
        ... ['JAVA_HOME', 'JRE_HOME', 'JDK_HOME'].filter(v => process.env[v]) // only keep vars that have a non-empty defined value
            .map(v => path.join(process.env[v]!, 'bin', 'java')),

        // Attempt to just use the default java command that might be already on the path as a last attempt
        DEFAULT_PMD_ENGINE_CONFIG.java_command
    ];

    const errorMessages: string[] = [];
    for (const possibleJavaCommand of commandsToAttempt) {
        try {
            // Yes we want to have an await statement in a loop in this case since we want to try one at a time
            await validateJavaCommandContainsValidVersion(possibleJavaCommand, javaVersionIdentifier);
            return possibleJavaCommand;
        } catch (err) {
            errorMessages.push((err as Error).message);
        }
    }
    const consolidatedErrorMessages: string = errorMessages.map((msg: string, idx: number) =>
        indent(`Attempt ${idx+1}:\n${indent(msg)}`, '  | ')).join('\n');
    throw new Error(getMessage('CouldNotLocateJava',
        MINIMUM_JAVA_VERSION,
        consolidatedErrorMessages,
        configValueExtractor.getFieldPath('java_command'),
        configValueExtractor.getFieldPath('disable_engine')));
}

async function validateJavaCommandContainsValidVersion(javaCommand: string, javaVersionIdentifier: JavaVersionIdentifier): Promise<void> {
    let version: SemVer | null;
    try {
        version = await javaVersionIdentifier.identifyJavaVersion(javaCommand);
    } catch (err) {
        /* istanbul ignore next */
        const errMsg: string = err instanceof Error ? err.message : String(err);
        throw new Error(getMessage('JavaVersionCheckProducedError', javaCommand, indent(errMsg, '  | ')));
    }
    if (!version) {
        throw new Error(getMessage('UnrecognizableJavaVersion', javaCommand));
    } else if (version.compare(MINIMUM_JAVA_VERSION) < 0) {
        throw new Error(getMessage('JavaBelowMinimumVersion', javaCommand, version.toString(), MINIMUM_JAVA_VERSION));
    }
}