import {ConfigDescription, ConfigValueExtractor, ValueValidator} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {JavaVersionIdentifier} from "./JavaVersionIdentifier";
import {SemVer} from "semver";
import path from "node:path";
import {indent} from "./utils";
import {MINIMUM_JAVA_VERSION, LanguageId, CPD_ENGINE_NAME, PMD_ENGINE_NAME} from "./constants";
import fs from "node:fs";

export const PMD_AVAILABLE_LANGUAGES: string[] = Object.values(LanguageId).filter(l => l !== LanguageId.TYPESCRIPT); // Typescript is available in CPD but not PMD
export const CPD_AVAILABLE_LANGUAGES: string[] = Object.values(LanguageId);

const DEFAULT_JAVA_COMMAND: string = 'java';

export const PMD_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('PmdConfigOverview'),
    fieldDescriptions: {
        java_command: getMessage('SharedConfigFieldDescription_java_command', PMD_ENGINE_NAME),
        rule_languages: getMessage('PmdConfigFieldDescription_rule_languages', toAvailableLanguagesText(PMD_AVAILABLE_LANGUAGES)),
        java_classpath_entries: getMessage('PmdConfigFieldDescription_java_classpath_entries'),
        custom_rulesets: getMessage('PmdConfigFieldDescription_custom_rulesets')
    }
}

export const CPD_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('CpdConfigOverview'),
    fieldDescriptions: {
        java_command: getMessage('SharedConfigFieldDescription_java_command', CPD_ENGINE_NAME),
        rule_languages: getMessage('CpdConfigFieldDescription_rule_languages', toAvailableLanguagesText(CPD_AVAILABLE_LANGUAGES)),
    }
}

export type PmdEngineConfig = {
    // Indicates the specific "java" command to use for the 'pmd' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/path/to/jdk/openjdk_11.0.17.0.1_11.60.54_x64/bin/java'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a 'java' command from your environment.
    java_command: string

    // List of languages associated with the PMD rules to be made available for 'pmd' engine rule selection.
    // The languages that you may choose from are: 'apex', 'html', 'java', 'javascript' (or 'ecmascript'), 'visualforce', 'xml'
    // See https://pmd.github.io/pmd/tag_rule_references.html to learn about the PMD rules available for each language.
    rule_languages: string[]

    // List of jar files and/or folders to add the Java classpath when running PMD.
    // Each entry may be given as an absolute path or a relative path to 'config_root'.
    // This field is primarily used to supply custom Java based rule definitions to PMD.
    // See https://pmd.github.io/pmd/pmd_userdocs_extending_writing_java_rules.html
    java_classpath_entries: string[]

    // List of xml ruleset files containing custom PMD rules to be made available for rule selection.
    // Each ruleset must be an xml file that is either::
    //   - on disk (provided as an absolute path or a relative path to 'config_root')
    //   - or a relative resource found on the Java classpath.
    // Not all custom rules can be fully defined within an xml ruleset file. For example, Java based rules may be defined in jar files.
    // In these cases, you will need to also add your additional files to the Java classpath using the 'java_classpath_entries' field.
    // See https://pmd.github.io/pmd/pmd_userdocs_making_rulesets.html
    custom_rulesets: string []
}

export const DEFAULT_PMD_ENGINE_CONFIG: PmdEngineConfig = {
    java_command: DEFAULT_JAVA_COMMAND,
    rule_languages: ['apex', 'visualforce'],
    java_classpath_entries: [],
    custom_rulesets: []
}

export type CpdEngineConfig = {
    // Indicates the specific "java" command to use for the 'cpd' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/path/to/jdk/openjdk_11.0.17.0.1_11.60.54_x64/bin/java'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a 'java' command from your environment.
    java_command: string

    // List of languages associated with CPD to be made available for 'cpd' engine rule selection.
    // The languages that you may choose from are: 'apex', 'html', 'java', 'javascript' (or 'ecmascript'), 'typescript', 'visualforce', 'xml'
    rule_languages: string[]
}

export const DEFAULT_CPD_ENGINE_CONFIG: CpdEngineConfig = {
    java_command: DEFAULT_JAVA_COMMAND,
    rule_languages: ['apex', 'html', 'javascript', 'typescript', 'visualforce', 'xml']
}

export async function validateAndNormalizePmdConfig(configValueExtractor: ConfigValueExtractor,
                                                    javaVersionIdentifier: JavaVersionIdentifier): Promise<PmdEngineConfig> {
    const pmdConfigValueExtractor: PmdConfigValueExtractor = new PmdConfigValueExtractor(configValueExtractor,
        javaVersionIdentifier);

    const javaClasspathEntries: string[] = pmdConfigValueExtractor.extractJavaClasspathEntries();
    return {
        java_command: await pmdConfigValueExtractor.extractJavaCommand(),
        rule_languages: pmdConfigValueExtractor.extractRuleLanguages(),
        java_classpath_entries: pmdConfigValueExtractor.extractJavaClasspathEntries(),
        custom_rulesets: pmdConfigValueExtractor.extractCustomRulesets(javaClasspathEntries)
    }
}

export async function validateAndNormalizeCpdConfig(configValueExtractor: ConfigValueExtractor,
                                                    javaVersionIdentifier: JavaVersionIdentifier): Promise<CpdEngineConfig> {
    const cpdConfigValueExtractor: CpdConfigValueExtractor = new CpdConfigValueExtractor(configValueExtractor,
        javaVersionIdentifier);

    return {
        java_command: await cpdConfigValueExtractor.extractJavaCommand(),
        rule_languages: cpdConfigValueExtractor.extractRuleLanguages()
    }
}

// Abstract class to extraction code for shared fields for PMD and CPD engines, like 'java_command' and 'rule_languages'.
abstract class SharedConfigValueExtractor {
    protected readonly configValueExtractor: ConfigValueExtractor;
    private readonly javaVersionIdentifier: JavaVersionIdentifier;

    protected constructor(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier) {
        this.configValueExtractor = configValueExtractor;
        this.javaVersionIdentifier = javaVersionIdentifier;
    }

    // The list of all possible languages that can be chosen within the rule_languages array
    protected abstract getAllPossibleRuleLanguages(): string[];

    // The default return value for rule_languages
    protected abstract getDefaultRuleLanguages(): string[];

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

    extractRuleLanguages(): string[] {
        let ruleLanguages: string[] | undefined = this.configValueExtractor.extractArray('rule_languages',
            ValueValidator.validateString);
        if (ruleLanguages === undefined) {
            return this.getDefaultRuleLanguages();
        }

        // Make unique and convert to lowercase
        const ruleLanguagesSet: Set<string> = new Set(ruleLanguages.map(l => l.toLowerCase()));

        // Provide support for 'ecmascript' which is a supported alias of 'javascript'
        if (ruleLanguagesSet.has('ecmascript')) {
            ruleLanguagesSet.delete('ecmascript');
            ruleLanguagesSet.add('javascript');
        }

        // Validate each language is supported
        ruleLanguages = [...ruleLanguagesSet];
        for (const ruleLanguage of ruleLanguages) {
            if (!this.getAllPossibleRuleLanguages().includes(ruleLanguage)) {
                throw new Error(getMessage('InvalidRuleLanguage',
                    this.configValueExtractor.getFieldPath('rule_languages'),
                    ruleLanguage,
                    toAvailableLanguagesText(this.getAllPossibleRuleLanguages())));
            }
        }
        return ruleLanguages.sort();
    }
}

class PmdConfigValueExtractor extends SharedConfigValueExtractor {
    constructor(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier) {
        super(configValueExtractor, javaVersionIdentifier);
    }

    extractJavaClasspathEntries(): string[] {
        const entries: string[] = this.configValueExtractor.extractArray('java_classpath_entries',
            (entry: unknown, entryField: string) => ValueValidator.validatePath(entry, entryField,
                [this.configValueExtractor.getConfigRoot()]),
            DEFAULT_PMD_ENGINE_CONFIG.java_classpath_entries)!;
        for (let i= 0; i < entries.length; i++) {
            if (path.extname(entries[i]).toLowerCase() !== '.jar' && !fs.statSync(entries[i]).isDirectory()) {
                throw new Error(getMessage('InvalidJavaClasspathEntry',
                    this.configValueExtractor.getFieldPath('java_classpath_entries') + `[${i}]`));
            }
        }
        return [... new Set(entries)]; // Converting to set and back to array to remove duplicates
    }

    extractCustomRulesets(javaClassPathEntries: string[]): string[] {
        const customRulesets: string[] =  this.configValueExtractor.extractArray('custom_rulesets',
            ValueValidator.validateString, DEFAULT_PMD_ENGINE_CONFIG.custom_rulesets)!;

        const possibleParentFolders: string [] = [
            this.configValueExtractor.getConfigRoot(),
            ... javaClassPathEntries.filter(entry => !entry.toLowerCase().endsWith('.jar')) // folder based entries
        ]

        for (let i=0; i < customRulesets.length; i++) {
            try {
                // Using the validatePath method to simply help resolve relative paths on disk to absolute paths on disk
                customRulesets[i] = ValueValidator.validatePath(customRulesets[i],
                    this.configValueExtractor.getFieldPath('custom_rulesets') + `[${i}]`,
                    [this.configValueExtractor.getConfigRoot(),...possibleParentFolders]);
            } catch (_err) {
                // If the ruleset isn't found on disk, then at this point we could ideally attempt to validate that it
                // exists in one of the jar files, but that would be expensive. Instead, we will rely on our pmd-wrapper
                // (which is called when describing rules) to finish validation when we add in the ruleset on the Java
                // side - at which point our try/catch statement will provide a nice error message.
            }
        }
        return [... new Set(customRulesets)]; // Converting to set and back to array to remove duplicates
    }

    protected getAllPossibleRuleLanguages(): string[] {
        return PMD_AVAILABLE_LANGUAGES;
    }

    protected getDefaultRuleLanguages(): string[] {
        return DEFAULT_PMD_ENGINE_CONFIG.rule_languages;
    }
}

class CpdConfigValueExtractor extends SharedConfigValueExtractor {
    constructor(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier) {
        super(configValueExtractor, javaVersionIdentifier);
    }

    protected getAllPossibleRuleLanguages(): string[] {
        return CPD_AVAILABLE_LANGUAGES;
    }

    protected getDefaultRuleLanguages(): string[] {
        return DEFAULT_CPD_ENGINE_CONFIG.rule_languages;
    }
}

function toAvailableLanguagesText(languages: string[]): string {
    return languages.map(lang => `'${lang}'`)
        .join(', ').replace(`'javascript'`, `'javascript' (or 'ecmascript')`);
}