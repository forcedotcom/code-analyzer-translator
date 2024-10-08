import {getMessage, getMessageFromCatalog, SHARED_MESSAGE_CATALOG} from "./messages";
import path from "node:path";
import fs from "node:fs";
import {SeverityLevel} from "./rules";

export type ConfigObject = {
    [key: string]: ConfigValue
}
export type ConfigValue =
    | string
    | number
    | boolean
    | null
    | ConfigValue[]
    | ConfigObject;

export type ConfigDescription = {
    // A brief overview of the configuration. It is recommended to include a link to documentation when possible.
    overview?: string

    // Description messages of the top-level fields in the configuration
    fieldDescriptions?: Record<string, string>
}

export class ConfigValueExtractor {
    private readonly configObj: ConfigObject;
    private readonly fieldPathRoot: string;
    private readonly configRoot: string;

    constructor(configObject: ConfigObject, fieldPathRoot: string = '', configRoot: string = process.cwd(), ) {
        this.configObj = configObject;
        this.fieldPathRoot = fieldPathRoot;
        this.configRoot = configRoot;
    }

    getObject(): ConfigObject {
        return this.configObj;
    }

    getKeys(): string[] {
        return Object.keys(this.configObj);
    }

    getConfigRoot(): string {
        return this.configRoot;
    }

    extractRequiredBoolean(fieldName: string): boolean {
        return ValueValidator.validateBoolean(this.configObj[fieldName], this.getFieldPath(fieldName));
    }

    extractBoolean(fieldName: string, defaultValue?: boolean): boolean | undefined {
        return !this.hasValueDefinedFor(fieldName) ? defaultValue : this.extractRequiredBoolean(fieldName);
    }

    extractRequiredNumber(fieldName: string): number {
        return ValueValidator.validateNumber(this.configObj[fieldName], this.getFieldPath(fieldName));
    }

    extractNumber(fieldName: string, defaultValue?: number): number | undefined {
        return !this.hasValueDefinedFor(fieldName) ? defaultValue : this.extractRequiredNumber(fieldName);
    }

    extractRequiredString(fieldName: string, regexpToMatch?: RegExp): string {
        return ValueValidator.validateString(this.configObj[fieldName], this.getFieldPath(fieldName), regexpToMatch);
    }

    extractString(fieldName: string, defaultValue?: string, regexpToMatch?: RegExp): string | undefined {
        return !this.hasValueDefinedFor(fieldName) ? defaultValue : this.extractRequiredString(fieldName, regexpToMatch);
    }

    extractRequiredSeverityLevel(fieldName: string): SeverityLevel {
        return ValueValidator.validateSeverityLevel(this.configObj[fieldName], this.getFieldPath(fieldName));
    }

    extractSeverityLevel(fieldName: string, defaultValue?: SeverityLevel): SeverityLevel | undefined {
        return !this.hasValueDefinedFor(fieldName) ? defaultValue : this.extractRequiredSeverityLevel(fieldName);
    }

    extractRequiredObject(fieldName: string): ConfigObject {
        return ValueValidator.validateObject(this.configObj[fieldName], this.getFieldPath(fieldName)) as ConfigObject;
    }

    extractRequiredObjectAsExtractor(fieldName: string): ConfigValueExtractor {
        const subObject: ConfigObject = this.extractRequiredObject(fieldName);
        return new ConfigValueExtractor(subObject, this.getFieldPath(fieldName));
    }

    extractObject(fieldName: string, defaultValue?: ConfigObject): ConfigObject | undefined {
        return !this.hasValueDefinedFor(fieldName) ? defaultValue : this.extractRequiredObject(fieldName);
    }

    extractObjectAsExtractor(fieldName: string, defaultValue?: ConfigObject): ConfigValueExtractor {
        const subObject: ConfigObject = this.extractObject(fieldName, defaultValue) || {};
        return new ConfigValueExtractor(subObject, this.getFieldPath(fieldName));
    }

    extractRequiredArray<T>(fieldName: string, elementValidator?: (element: unknown, elementFieldName: string) => T): T[] {
        return ValueValidator.validateArray<T>(this.configObj[fieldName], this.getFieldPath(fieldName), elementValidator);
    }

    extractArray<T>(fieldName: string, elementValidator?: (element: unknown, elementFieldName: string) => T, defaultValue?: T[]): T[] | undefined {
        return !this.hasValueDefinedFor(fieldName) ? defaultValue : this.extractRequiredArray(fieldName, elementValidator);
    }

    extractRequiredObjectArrayAsExtractorArray(fieldName: string): ConfigValueExtractor[] {
        const subObjects: ConfigObject[] = this.extractRequiredArray(fieldName, ValueValidator.validateObject);
        return subObjects.map((elem, index) => new ConfigValueExtractor(elem, `${this.getFieldPath(fieldName)}[${index}]`));
    }

    extractObjectArrayAsExtractorArray(fieldName: string, defaultValue?: ConfigObject[]): ConfigValueExtractor[] {
        const subObjects: ConfigObject[] = this.extractArray(fieldName, ValueValidator.validateObject, defaultValue) || [];
        return subObjects.map((elem, index) => new ConfigValueExtractor(elem, `${this.getFieldPath(fieldName)}[${index}]`));
    }

    extractRequiredFile(fieldName: string): string {
        return ValueValidator.validateFile(this.configObj[fieldName], this.getFieldPath(fieldName), this.getConfigRoot());
    }

    extractFile(fieldName: string, defaultValue?: string): string | undefined {
        return !this.hasValueDefinedFor(fieldName) ? defaultValue : this.extractRequiredFile(fieldName);
    }

    extractRequiredFolder(fieldName: string): string {
        return ValueValidator.validateFolder(this.configObj[fieldName], this.getFieldPath(fieldName), this.getConfigRoot());
    }

    extractFolder(fieldName: string, defaultValue?: string): string | undefined {
        return !this.hasValueDefinedFor(fieldName) ? defaultValue : this.extractRequiredFolder(fieldName);
    }

    getFieldPath(fieldName?: string): string {
        if (!fieldName) {
            return this.fieldPathRoot;
        }
        return this.fieldPathRoot.length > 0 ? `${this.fieldPathRoot}.${fieldName}` : fieldName;
    }

    hasValueDefinedFor(fieldName: string): boolean {
        return this.configObj[fieldName] !== undefined && this.configObj[fieldName] !== null;
    }
}

export class ValueValidator {
    static validateBoolean(value: unknown, fieldPath: string): boolean {
        return validateType<boolean>("boolean", value, fieldPath);
    }

    static validateNumber(value: unknown, fieldPath: string): number {
        return validateType<number>("number", value, fieldPath);
    }

    static validateString(value: unknown, fieldPath: string, regexpToMatch?: RegExp): string {
        const strValue: string = validateType<string>("string", value, fieldPath);
        if (regexpToMatch && !regexpToMatch.test(strValue)) {
            throw new Error(getMessage('ConfigValueMustMatchRegExp', fieldPath, regexpToMatch.toString()));
        }
        return strValue;
    }

    static validateSeverityLevel(rawValue: unknown, fieldPath: string): SeverityLevel {
        let value: unknown = typeof rawValue === 'string' && rawValue.length > 1 ?
            rawValue.charAt(0).toUpperCase() + rawValue.slice(1).toLowerCase() : rawValue;

        // Note that Object.values(SeverityLevel) returns [1,2,3,4,5,"Critical","High","Moderate","Low","Info"]
        if ((typeof value !== 'string' && typeof value !== 'number')
            || !Object.values(SeverityLevel).includes(value as string | number)) {
            throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel', fieldPath,
                JSON.stringify(Object.values(SeverityLevel)), JSON.stringify(rawValue) || 'undefined'));
        }
        if (typeof value === 'string') {
            // We can't type cast to enum from a string, so instead we choose the enum based on the string as a key.
            value = SeverityLevel[value as keyof typeof SeverityLevel];
        }
        // We can type cast to enum safely from a number
        return value as SeverityLevel;
    }

    static validateObject(value: unknown, fieldPath: string): ConfigObject {
        return validateType<ConfigObject>("object", value, fieldPath);
    }

    static validateArray<T>(value: unknown, fieldPath: string, elementValidator?: (element: unknown, elementFieldName: string) => T): T[] {
        if (!Array.isArray(value)) {
            throw new Error(getMessage('ConfigValueMustBeOfType', fieldPath, 'array', getDataType(value)));
        }
        if (elementValidator) {
            value = value.map((element, index) => elementValidator(element, `${fieldPath}[${index}]`));
        }
        return value as T[];
    }

    static validateFile(value: unknown, fieldPath: string, possibleFileRoot?: string): string {
        const fileValue: string = ValueValidator.validatePath(value, fieldPath, possibleFileRoot);
        if (fs.statSync(fileValue).isDirectory()) {
            throw new Error(getMessage('ConfigFileValueMustNotBeFolder', fieldPath, fileValue));
        }
        return fileValue;
    }

    static validateFolder(value: unknown, fieldPath: string, possibleFolderRoot?: string): string {
        const folderValue: string = ValueValidator.validatePath(value, fieldPath, possibleFolderRoot);
        if (!fs.statSync(folderValue).isDirectory()) {
            throw new Error(getMessage('ConfigFolderValueMustNotBeFile', fieldPath, folderValue));
        }
        return folderValue;
    }

    static validatePath(value: unknown, fieldPath: string, possiblePathRoot?: string): string {
        const pathValue: string = ValueValidator.validateString(value, fieldPath);
        const pathsToTry: string[] = [];
        if (possiblePathRoot) {
            // If a possible root is supplied, then we first assume the pathValue is relative to it
            pathsToTry.push(toAbsolutePath(pathValue, possiblePathRoot));
        }
        // Otherwise we try to resolve it without a possible root
        pathsToTry.push(toAbsolutePath(pathValue));
        return validateAtLeastOnePathExists(pathsToTry, fieldPath);
    }
}

function validateType<T>(expectedType: string, value: unknown, fieldPath: string): T {
    const dataType: string = getDataType(value);
    if (dataType !== expectedType) {
        throw new Error(getMessage('ConfigValueMustBeOfType', fieldPath, expectedType, dataType));
    }
    return value as T;
}

function toAbsolutePath(pathValue: string, possiblePathRoot?: string): string {
    // Convert slashes to platform specific slashes and then convert to absolute path
    pathValue = pathValue.replace(/[\\/]/g, path.sep);
    if (!possiblePathRoot) {
        return path.resolve(pathValue);
    }
    return pathValue.startsWith(possiblePathRoot) ? pathValue : path.join(possiblePathRoot, pathValue);
}

function validateAtLeastOnePathExists(paths: string[], fieldPath: string): string {
    for (const currPath of paths) {
        if (fs.existsSync(currPath)) {
            return currPath;
        }
    }
    throw new Error(getMessage('ConfigPathValueDoesNotExist', fieldPath, paths[0]));
}

function getDataType(value: unknown): string {
    return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
}