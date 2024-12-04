import {
    CodeLocation, COMMON_TAGS,
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {CPD_ENGINE_NAME, LanguageId} from "./constants";
import {getMessage} from "./messages";
import {indent, JavaCommandExecutor, WorkspaceLiaison} from "./utils";
import {CPD_AVAILABLE_LANGUAGES, CpdEngineConfig} from "./config";
import {
    CpdBlockLocation,
    CpdLanguageRunResults,
    CpdLanguageToFilesMap,
    CpdMatch,
    CpdRunInputData,
    CpdRunResults,
    CpdWrapperInvoker
} from "./cpd-wrapper";
import path from "node:path";
import fs from "node:fs/promises";

const RULE_NAME_PREFIX: string = 'DetectCopyPasteFor';

export class CpdEngine extends Engine {
    private readonly cpdWrapperInvoker: CpdWrapperInvoker;
    private readonly config: CpdEngineConfig;

    private workspaceLiaisonCache: Map<string, WorkspaceLiaison> = new Map();

    constructor(config: CpdEngineConfig) {
        super();
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor(config.java_command);
        this.cpdWrapperInvoker = new CpdWrapperInvoker(javaCommandExecutor,
            (logLevel: LogLevel, message: string) => this.emitLogEvent(logLevel, message));
        this.config = config;
    }

    getName(): string {
        return CPD_ENGINE_NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(describeOptions.workspace);
        this.emitDescribeRulesProgressEvent(33);
        const relevantLanguages: LanguageId[] = await workspaceLiaison.getRelevantLanguages();
        const ruleDescriptions: RuleDescription[] = relevantLanguages.map(createRuleForLanguage);
        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(runOptions.workspace);
        const relevantLanguageToFilesMap: Map<LanguageId, string[]> = await workspaceLiaison.getRelevantLanguageToFilesMap();
        this.emitRunRulesProgressEvent(2);

        const filesToScanPerLanguage: CpdLanguageToFilesMap = {};
        for (const languageId of ruleNames.map(getLanguageFromRuleName)) {
            if (relevantLanguageToFilesMap.has(languageId)) {
                // Calling toCpdLanguage is needed to convert the LanguageId to the identifier that CPD recognizes
                filesToScanPerLanguage[toCpdLanguage(languageId)] = relevantLanguageToFilesMap.get(languageId)!;
            }
        }

        if (Object.keys(filesToScanPerLanguage).length == 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        const inputData: CpdRunInputData = {
            filesToScanPerLanguage: filesToScanPerLanguage,
            minimumTokens: this.config.minimum_tokens,
            skipDuplicateFiles: this.config.skip_duplicate_files
        }
        this.emitRunRulesProgressEvent(5);

        const cpdRunResults: CpdRunResults = await this.cpdWrapperInvoker.invokeRunCommand(inputData,
            (innerPerc: number) => this.emitRunRulesProgressEvent(5 + 93*(innerPerc/100))); // 5 to 98%

        const violations: Violation[] = [];
        for (const cpdLanguage in cpdRunResults) {
            const languageId: LanguageId = toLanguageId(cpdLanguage);
            const cpdLanguageRunResults: CpdLanguageRunResults = cpdRunResults[cpdLanguage];
            for (const cpdMatch of cpdLanguageRunResults.matches) {
                violations.push(toViolation(languageId, cpdMatch));
            }
            for (const cpdProcessingError of cpdLanguageRunResults.processingErrors) {
                /* istanbul ignore next */
                if (cpdProcessingError.detail == '[TERMINATING_EXCEPTION]') {
                    this.emitLogEvent(LogLevel.Error, getMessage('CpdTerminatingExceptionThrown', languageId,
                        indent(cpdProcessingError.message)));
                } else {
                    this.emitLogEvent(LogLevel.Error, getMessage('ProcessingErrorForFile', 'CPD', cpdProcessingError.file,
                        indent(cpdProcessingError.message)));
                }
            }
        }

        this.emitRunRulesProgressEvent(100);
        return {
            violations: violations
        };
    }

    private getWorkspaceLiaison(workspace?: Workspace) : WorkspaceLiaison {
        const cacheKey: string = getCacheKey(workspace);
        if (!this.workspaceLiaisonCache.has(cacheKey)) {
            this.workspaceLiaisonCache.set(cacheKey, new WorkspaceLiaison(workspace, this.config.rule_languages as LanguageId[]));
        }
        return this.workspaceLiaisonCache.get(cacheKey)!
    }
}

function createRuleForLanguage(languageId: LanguageId): RuleDescription {
    const languageTag: string = languageId.charAt(0).toUpperCase() + languageId.slice(1);
    return {
        name: getRuleNameFromLanguage(languageId),
        severityLevel: SeverityLevel.Info,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN, languageTag],
        description: getMessage('DetectCopyPasteForLanguageRuleDescription', languageId),
        resourceUrls: ['https://docs.pmd-code.org/latest/pmd_userdocs_cpd.html#refactoring-duplicates']
    }
}

function getRuleNameFromLanguage(languageId: LanguageId) {
    return RULE_NAME_PREFIX + makeFirstCharUpperCase(languageId);
}

function makeFirstCharUpperCase(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function getLanguageFromRuleName(ruleName: string): LanguageId {
    const language: string = ruleName.slice(RULE_NAME_PREFIX.length).toLowerCase();
    if (!CPD_AVAILABLE_LANGUAGES.includes(language)) {
        throw new Error(`Unexpected error: The rule '${ruleName}' does not map to a supported CPD language: ${JSON.stringify(CPD_AVAILABLE_LANGUAGES)}`);
    }
    return language as LanguageId;
}

function getCacheKey(workspace?: Workspace) {
    return workspace? workspace.getWorkspaceId() : process.cwd();
}

function toCpdLanguage(languageId: LanguageId): string {
    // We must convert 'javascript' to 'ecmascript' since CPD actually uses 'ecmascript' as the identifier instead of 'javascript'
    return languageId == LanguageId.JAVASCRIPT ? 'ecmascript' : languageId;
}

function toLanguageId(cpdLanguage: string): LanguageId {
    // We must convert 'ecmascript' back to 'javascrijpt'
    return cpdLanguage == 'ecmascript' ? LanguageId.JAVASCRIPT : cpdLanguage as LanguageId;
}

function toViolation(languageId: LanguageId, cpdMatch: CpdMatch): Violation {
    return {
        ruleName: getRuleNameFromLanguage(languageId),
        message: getMessage('DetectCopyPasteForLanguageViolationMessage',
            languageId, cpdMatch.numBlocks, cpdMatch.numTokensInBlock, cpdMatch.numNonemptyLinesInBlock),
        primaryLocationIndex: 0,
        codeLocations: cpdMatch.blockLocations.map(toCodeLocation)
    }
}

function toCodeLocation(blockLocation: CpdBlockLocation): CodeLocation {
    return {
        file: blockLocation.file,
        startLine: blockLocation.startLine,
        startColumn: blockLocation.startCol,
        endLine: blockLocation.endLine,
        endColumn: blockLocation.endCol
    }
}