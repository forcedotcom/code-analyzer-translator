import path from "node:path";
import { changeWorkingDirectoryToPackageRoot } from "./test-helpers";
import { CodeLocation, Violation} from "@salesforce/code-analyzer-engine-api";

changeWorkingDirectoryToPackageRoot();

export const FILE_LOCATION_1 = path.resolve(__dirname, "test-data", "2_apexClasses", "myOuterClass.cls")
export const FILE_LOCATION_2 = path.resolve(__dirname, "test-data", "2_apexClasses", "myOut.cls")
export const FILE_LOCATION_3 = path.resolve(__dirname,  "test-data", "2_apexClasses", "myClass.cls")
export const FILE_LOCATION_4 = path.resolve(__dirname, "test-data", "3_FolderWithMultipleWhitespaceApexClasses", "myOuterClass.cls")
export const FILE_LOCATION_5 = path.resolve(__dirname, "test-data", "3_FolderWithMultipleWhitespaceApexClasses", "subDir", "myOuterClass.cls")
export const FILE_LOCATION_6 = path.resolve(__dirname, "test-data", "5_apexClassWithBlankLine", "myOuterClass.cls")
export const FILE_LOCATION_7 = path.resolve(__dirname, "test-data", "6_apexClassWithExtraNewline", "myOuterClass.cls")
export const FILE_LOCATION_8 = path.resolve(__dirname, "test-data", "7_apexClassWithMultipleExtraNewlines", "myOuterClass.cls")
export const FILE_LOCATION_9 = path.resolve(__dirname, "test-data", "8_apexClassWithNewlineAtBeginning", "myOuterClass.cls")
export const TRAILING_WHITESPACE_RULE_NAME = "TrailingWhitespaceRule"
export const TRAILING_WHITESPACE_RULE_MESSAGE = "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.";
export const TRAILING_WHITESPACE_RESOURCE_URLS = []

const EXPECTED_CODE_LOCATION_1: CodeLocation = {
    file: FILE_LOCATION_1,
    startLine: 6,
    startColumn: 2,
    endLine: 6,
    endColumn: 4
}

const EXPECTED_CODE_LOCATION_2: CodeLocation = {
    file: FILE_LOCATION_3,
    startLine: 2,
    startColumn: 40,
    endLine: 2,
    endColumn: 41
}

const EXPECTED_CODE_LOCATION_3: CodeLocation = {
    file: FILE_LOCATION_3,
    startLine: 6,
    startColumn: 2,
    endLine: 6,
    endColumn: 4
}

const EXPECTED_CODE_LOCATION_4: CodeLocation = {
    file: FILE_LOCATION_6,
    startLine: 5,
    startColumn: 1,
    endLine: 5,
    endColumn: 2
}

const EXPECTED_CODE_LOCATION_5: CodeLocation = {
    file: FILE_LOCATION_7,
    startLine: 7,
    startColumn: 1,
    endLine: 7,
    endColumn: 1
}

const EXPECTED_CODE_LOCATION_6: CodeLocation = {
    file: FILE_LOCATION_8,
    startLine: 7,
    startColumn: 1,
    endLine: 7,
    endColumn: 1
}

const EXPECTED_CODE_LOCATION_7: CodeLocation = {
    file: FILE_LOCATION_8,
    startLine: 8,
    startColumn: 1,
    endLine: 8,
    endColumn: 1
}

const EXPECTED_CODE_LOCATION_8: CodeLocation = {
    file: FILE_LOCATION_9,
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 1
}

export const EXPECTED_VIOLATION_1: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    }
]

export const EXPECTED_VIOLATION_2: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_2]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_3]

    }  
]

export const EXPECTED_VIOLATION_3: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_2]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_3]

    }  
]

export const EXPECTED_VIOLATION_4: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_4]
    }
]

export const EXPECTED_VIOLATION_5: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_5]
    }
]

export const EXPECTED_VIOLATION_6: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_6]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_7]
    }
]

export const EXPECTED_VIOLATION_7: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_8]
    }
]

