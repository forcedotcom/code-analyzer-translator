import path from "node:path";
import { changeWorkingDirectoryToPackageRoot } from "./test-helpers";
import { CodeLocation, Violation} from "@salesforce/code-analyzer-engine-api";

changeWorkingDirectoryToPackageRoot();

export const FILE_LOCATION_1 = path.resolve("packages", "code-analyzer-regex-engine", "test", "test-data", "2_apexClasses", "myOuterClass.cls")
export const FILE_LOCATION_2 = path.resolve("packages", "code-analyzer-regex-engine", "test", "test-data", "2_apexClasses", "myOut.cls")
export const FILE_LOCATION_3 = path.resolve("packages", "code-analyzer-regex-engine", "test", "test-data", "2_apexClasses", "myClass.cls")
export const FILE_LOCATION_4 = path.resolve("packages", "code-analyzer-regex-engine", "test", "test-data", "3_FolderWithMultipleWhitespaceApexClasses", "myOuterClass.cls")
export const FILE_LOCATION_5 = path.resolve("packages", "code-analyzer-regex-engine", "test", "test-data", "3_FolderWithMultipleWhitespaceApexClasses", "subDir", "myOuterClass.cls")
export const FILE_LOCATION_6 = path.resolve("packages", "code-analyzer-regex-engine", "test", "test-data", "5_apexClassWithBlankLine", "myOuterClass.cls")
export const TRAILING_WHITESPACE_RULE_MESSAGE = "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.";
export const TRAILING_WHITESPACE_RESOURCE_URLS = []

const EXPECTED_CODE_LOCATION_1: CodeLocation = {
    file: FILE_LOCATION_1,
    startLine: 6,
    startColumn: 2
}

const EXPECTED_CODE_LOCATION_2: CodeLocation = {
    file: FILE_LOCATION_3,
    startLine: 2,
    startColumn: 40
}

const EXPECTED_CODE_LOCATION_3: CodeLocation = {
    file: FILE_LOCATION_3,
    startLine: 6,
    startColumn: 2
}

const EXPECTED_CODE_LOCATION_4: CodeLocation = {
    file: FILE_LOCATION_6,
    startLine: 4,
    startColumn: 30
}


export const EXPECTED_VIOLATION_1: Violation[] = [
    {
        ruleName: "Trailing Whitespace",
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    }
]

export const EXPECTED_VIOLATION_2: Violation[] = [
    {
        ruleName: "Trailing Whitespace",
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_2]
    },
    {
        ruleName: "Trailing Whitespace",
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_3]

    }  
]

export const EXPECTED_VIOLATION_3: Violation[] = [
    {
        ruleName: "Trailing Whitespace",
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    },
    {
        ruleName: "Trailing Whitespace",
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_2]
    },
    {
        ruleName: "Trailing Whitespace",
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_3]

    }  
]

export const EXPECTED_VIOLATION_4: Violation[] = [
    {
        ruleName: "Trailing Whitespace",
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_4]
    }
]
