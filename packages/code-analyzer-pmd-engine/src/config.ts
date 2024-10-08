import {ConfigDescription, ConfigValueExtractor, ValueValidator} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {JavaVersionIdentifier} from "./JavaVersionIdentifier";
import {SemVer} from "semver";
import path from "node:path";
import {indent} from "./utils";
import {MINIMUM_JAVA_VERSION, PmdLanguage} from "./constants";

const PMD_AVAILABLE_LANGUAGES: string[] = Object.values(PmdLanguage);
const PMD_AVAILABLE_LANGUAGES_TEXT: string = PMD_AVAILABLE_LANGUAGES.map(lang => `'${lang}'`)
    .join(', ').replace(`'ecmascript'`, `'ecmascript' (or 'javascript')`);

export const PMD_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('PmdConfigOverview'),
    fieldDescriptions: {
        java_command: getMessage('PmdConfigFieldDescription_java_command'),
        rule_languages: getMessage('PmdConfigFieldDescription_rule_languages', PMD_AVAILABLE_LANGUAGES_TEXT)
    }
}

export type PmdEngineConfig = {
    // Indicates the specific "java" command to use for the 'pmd' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/path/to/jdk/openjdk_11.0.17.0.1_11.60.54_x64/bin/java'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a 'java' command from your environment.
    java_command: string

    // List of languages associated with the PMD rules to be made available for selection
    // The available languages are: 'apex', 'html', 'java', 'ecmascript' (or 'javascript'), 'visualforce', 'xml'
    // See https://pmd.github.io/pmd/tag_rule_references.html
    rule_languages: string[]
}

export const DEFAULT_PMD_ENGINE_CONFIG: PmdEngineConfig = {
    java_command: 'java',
    rule_languages: ['apex', 'visualforce']
}

export async function validateAndNormalizePmdConfig(configValueExtractor: ConfigValueExtractor,
                                                    javaVersionIdentifier: JavaVersionIdentifier): Promise<PmdEngineConfig> {
    const pmdConfigValueExtractor: PmdConfigValueExtractor = new PmdConfigValueExtractor(configValueExtractor,
        javaVersionIdentifier);
    return {
        java_command: await pmdConfigValueExtractor.extractJavaCommand(),
        rule_languages: pmdConfigValueExtractor.extractRuleLanguages()
    }
}

class PmdConfigValueExtractor {
    private readonly configValueExtractor: ConfigValueExtractor;
    private readonly javaVersionIdentifier: JavaVersionIdentifier;

    constructor(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier) {
        this.configValueExtractor = configValueExtractor;
        this.javaVersionIdentifier = javaVersionIdentifier;
    }

    async extractJavaCommand(): Promise<string> {
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

    extractRuleLanguages(): string[] {
        let ruleLanguages: string[] | undefined = this.configValueExtractor.extractArray('rule_languages',
            ValueValidator.validateString);
        if (ruleLanguages === undefined) {
            return DEFAULT_PMD_ENGINE_CONFIG.rule_languages;
        }

        // Make unique and convert to lowercase
        const ruleLanguagesSet: Set<string> = new Set(ruleLanguages.map(l => l.toLowerCase()));

        // Provide support for 'javascript' which is a supported alias of 'ecmascript'
        if (ruleLanguagesSet.has('javascript')) {
            ruleLanguagesSet.delete('javascript');
            ruleLanguagesSet.add('ecmascript');
        }

        // Validate each language is supported
        ruleLanguages = [...ruleLanguagesSet];
        for (const ruleLanguage of ruleLanguages) {
            if (!PMD_AVAILABLE_LANGUAGES.includes(ruleLanguage)) {
                throw new Error(getMessage('InvalidRuleLanguage',
                    this.configValueExtractor.getFieldPath('rule_languages'),
                    ruleLanguage,
                    PMD_AVAILABLE_LANGUAGES_TEXT));
            }
        }
        return ruleLanguages.sort();
    }

    private async attemptToAutoDetectJavaCommand(): Promise<string> {
        const commandsToAttempt: string[] = [
            // Environment variables specifying JAVA HOME take precedence (if they exist)
            ...['JAVA_HOME', 'JRE_HOME', 'JDK_HOME'].filter(v => process.env[v]) // only keep vars that have a non-empty defined value
                .map(v => path.join(process.env[v]!, 'bin', 'java')),

            // Attempt to just use the default java command that might be already on the path as a last attempt
            DEFAULT_PMD_ENGINE_CONFIG.java_command
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