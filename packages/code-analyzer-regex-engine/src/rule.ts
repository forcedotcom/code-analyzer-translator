interface Rule {
    regex: RegExp;
    fileExtensions: string[];
    message: string;
    description: string;
}

export type RuleMap = { [ruleName: string]: Rule };