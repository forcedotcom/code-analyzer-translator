import {
    ConfigDescription,
    ConfigValueExtractor,
} from "@salesforce/code-analyzer-engine-api";
import {SemVer} from "semver";
import path from "node:path";
import {JavaVersionIdentifier} from "./JavaVersionIdentifier";
import {MINIMUM_JAVA_VERSION} from "./constants";
import {indent} from './utils';
import {getMessage} from "./messages";

const DEFAULT_JAVA_COMMAND: string = 'java';

export type SfgeEngineConfig = {
    // Indicates the specific "java" command to use for the 'SFGE' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/path/to/jdk/openjdk_11.0.17.0.1_11.60.54_x64/bin/java'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a 'java' command from your environment.
    java_command: string
}

export const DEFAULT_SFGE_ENGINE_CONFIG: SfgeEngineConfig = {
    java_command: DEFAULT_JAVA_COMMAND
};

export const SFGE_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        java_command: {
            descriptionText: getMessage('ConfigFieldDescription_java_command'),
            valueType: "string",
            defaultValue: null // Using null for doc and since it indicates that the value is calculated based on the environment.
        }
    }
}

export async function validateAndNormalizeConfig(cve: ConfigValueExtractor, jvi: JavaVersionIdentifier): Promise<SfgeEngineConfig> {
    cve.validateContainsOnlySpecifiedKeys(['java_command']);

    const sfgeConfigValueExtractor: SfgeConfigValueExtractor = new SfgeConfigValueExtractor(cve, jvi);

    return {
        java_command: await sfgeConfigValueExtractor.extractJavaCommand()
    };
}

class SfgeConfigValueExtractor {
    private readonly configValueExtractor: ConfigValueExtractor;
    private readonly javaVersionIdentifier: JavaVersionIdentifier;

    public constructor(cve: ConfigValueExtractor, jvi: JavaVersionIdentifier) {
        this.configValueExtractor = cve;
        this.javaVersionIdentifier = jvi;
    }

    public async extractJavaCommand(): Promise<string> {
        const javaCommand: string | undefined = this.configValueExtractor.extractString('java_command');
        if (!javaCommand) {
            return await this.attemptToAutoDetectJavaCommand();
        }

        try {
            await this.validateJavaCommandContainsValidVersion(javaCommand);
        } catch (err) {
            throw new Error(getMessage('InvalidUserSpecifiedJavaCommand',
                this.configValueExtractor.getFieldPath('java_command'), (err as Error).message));
        }
        return javaCommand;
    }

    private async attemptToAutoDetectJavaCommand(): Promise<string> {
        const commandsToAttempt: string[] = [
            // Environment variables specifying JAVA HOME take precedence (if they exist)
            ...['JAVA_HOME', 'JRE_HOME', 'JDK_HOME'].filter(v => process.env[v]) // only keep vars that have a non-empty defined value
                .map(v => path.join(process.env[v]!, 'bin', 'java')),

            // Attempt to just use the default java command that might be already on the path as a last attempt
            DEFAULT_JAVA_COMMAND
        ];

        const errorMessages: string[] = [];
        for (const possibleJavaCommand of commandsToAttempt) {
            try {
                // Yes we want to have an await statement in a loop in this case since we want to try one at a time
                await this.validateJavaCommandContainsValidVersion(possibleJavaCommand);
                return possibleJavaCommand;
            } catch (err) {
                errorMessages.push((err as Error).message);
            }
        }
        const consolidatedErrorMessages: string = errorMessages.map((msg: string, idx: number) =>
            indent(`Attempt ${idx + 1}:\n${indent(msg)}`, '  | ')).join('\n');
        throw new Error(getMessage('CouldNotLocateJava',
            MINIMUM_JAVA_VERSION,
            consolidatedErrorMessages,
            this.configValueExtractor.getFieldPath('java_command'),
            this.configValueExtractor.getFieldPath('disable_engine')));
    }

    private async validateJavaCommandContainsValidVersion(javaCommand: string): Promise<void> {
        let version: SemVer | null;
        try {
            version = await this.javaVersionIdentifier.identifyJavaVersion(javaCommand);
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
}