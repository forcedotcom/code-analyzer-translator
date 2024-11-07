import * as engApi from "@salesforce/code-analyzer-engine-api"
import {getMessage} from "./messages";

export enum SeverityLevel {
    Critical = 1,
    High = 2,
    Moderate = 3,
    Low = 4,
    Info = 5
}

export enum RuleType {
    // For rules that produce violations where each violation is associated with a single code location.
    Standard= "Standard",

    // For rules that produce violations where each violation is associated with multiple code locations.
    MultiLocation = "MultiLocation",

    // For rules that produce violations where each violation is associated with one or more code locations
    // that make up the code flow path associated with the violation.
    Flow = "Flow",

    // For our UnexpectedEngineErrorRule that we used to surface an error message within a violation.
    UnexpectedError = "UnexpectedError",

    // NOT CURRENTLY USED - IS RESERVED FOR THE SFGE ENGINE RULES THAT PRODUCE PATH-BASED VIOLATIONS
    // The original thinking was that we may need a separate type from "Flow" just in case flow based rules
    // had additional fields than "DataFlow" so that machine processing could determine what fields should be processed.
    // We may instead decide to combing "DataFlow" and "Flow" into 1 type in the near future.
    DataFlow = "DataFlow"
}

export interface Rule {
    getName(): string
    getEngineName(): string
    getSeverityLevel(): SeverityLevel
    getType(): RuleType  // TODO: We should consider just moving this to Violation or even CodeLocation (maybe calling it locationType or just type)
    getTags(): string[]
    getDescription(): string
    getResourceUrls(): string[]
}

export interface RuleSelection {
    getCount(): number
    getEngineNames(): string[]
    getRulesFor(engineName: string): Rule[]
    getRule(engineName: string, ruleName: string): Rule
}


/******* IMPLEMENTATIONS: **************************************************************************/

export class RuleImpl implements Rule {
    private readonly engineName: string
    private readonly ruleDesc: engApi.RuleDescription;

    constructor(engineName: string, ruleDesc: engApi.RuleDescription) {
        this.engineName = engineName;
        this.ruleDesc = ruleDesc;
    }

    getDescription(): string {
        return this.ruleDesc.description;
    }

    getEngineName(): string {
        return this.engineName;
    }

    getName(): string {
        return this.ruleDesc.name;
    }

    getResourceUrls(): string[] {
        return this.ruleDesc.resourceUrls;
    }

    getSeverityLevel(): SeverityLevel {
        // Currently the engApi.SeverityLevel has the same enum values as core's SeverityLevel.
        // If this ever changes, then we'll need to update this method mapping one to the other.
        return this.ruleDesc.severityLevel as SeverityLevel;
    }

    getTags(): string[] {
        return this.ruleDesc.tags;
    }

    getType(): RuleType {
        return this.ruleDesc.type as RuleType;
    }

    matchesRuleSelector(ruleSelector: string): boolean {
        const sevNumber: number = this.getSeverityLevel().valueOf();
        const sevName: string = SeverityLevel[sevNumber];
        const selectables: string[] = [
            "all",
            this.getEngineName().toLowerCase(),
            this.getName().toLowerCase(),
            sevName.toLowerCase(),
            String(sevNumber),
            ...this.getTags().map(t => t.toLowerCase())
        ]
        for (const selectorPart of ruleSelector.toLowerCase().split(':')) {
            const partMatched: boolean = selectables.some(s => s == selectorPart);
            if (!partMatched) return false;
        }
        return true;
    }
}

export class UnexpectedEngineErrorRule implements Rule {
    private readonly engineName: string;

    constructor(engineName: string) {
        this.engineName = engineName;
    }

    getDescription(): string {
        return getMessage('UnexpectedEngineErrorRuleDescription', this.engineName);
    }

    getEngineName(): string {
        return this.engineName;
    }

    getName(): string {
        return "UnexpectedEngineError";
    }

    getResourceUrls(): string[] {
        return [];
    }

    getSeverityLevel(): SeverityLevel {
        return SeverityLevel.Critical;
    }

    getTags(): string[] {
        return [];
    }

    getType(): RuleType {
        return RuleType.UnexpectedError;
    }
}

export class RuleSelectionImpl implements RuleSelection {
    private readonly ruleMap: Map<string, Rule[]> = new Map();

    addRule(rule: Rule) {
        const engineName = rule.getEngineName();
        if (!this.ruleMap.has(engineName)) {
            this.ruleMap.set(engineName, []);
        }
        this.ruleMap.get(engineName)!.push(rule);
    }

    getCount(): number {
        let count = 0;
        for (const rules of this.ruleMap.values()) {
            count += rules.length
        }
        return count;
    }

    getEngineNames(): string[] {
        return Array.from(this.ruleMap.keys());
    }

    getRulesFor(engineName: string): Rule[] {
        return this.ruleMap.get(engineName) || [];
    }

    getRule(engineName: string, ruleName: string): Rule {
        for (const rule of this.getRulesFor(engineName)) {
            if (rule.getName() == ruleName) {
                return rule;
            }
        }
        throw new Error(getMessage('RuleDoesNotExistInSelection', ruleName, engineName));
    }
}