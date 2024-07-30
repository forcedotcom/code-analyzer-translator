import {getMessage} from "./messages";
import path from "node:path";
import fs from "node:fs";

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


export class ConfigValueExtractor {
    private readonly configObj: ConfigObject;
    private readonly fieldRoot?: string;
    private configRoot?: string;

    constructor(configObject: ConfigObject, fieldRoot?: string) {
        this.configObj = configObject;
        this.fieldRoot = fieldRoot;
    }

    getObject(): ConfigObject {
        return this.configObj;
    }

    extractConfigRoot(): string {
        if (!this.configRoot) {
            const fieldName: string = 'config_root'; // config_root is always top level, so don't use getFieldPath
            this.configRoot = this.isUndefined(fieldName) ? process.cwd() :
                validateAbsoluteFolder(this.configObj[fieldName], fieldName);
        }
        return this.configRoot;
    }

    extractRequiredBoolean(fieldName: string): boolean {
        return ValueValidator.validateBoolean(this.configObj[fieldName], this.getFieldPath(fieldName));
    }

    extractBoolean(fieldName: string, defaultValue?: boolean): boolean | undefined {
        return this.isUndefined(fieldName) ? defaultValue : this.extractRequiredBoolean(fieldName);
    }

    extractRequiredNumber(fieldName: string): number {
        return ValueValidator.validateNumber(this.configObj[fieldName], this.getFieldPath(fieldName));
    }

    extractNumber(fieldName: string, defaultValue?: number): number | undefined {
        return this.isUndefined(fieldName) ? defaultValue : this.extractRequiredNumber(fieldName);
    }

    extractRequiredString(fieldName: string): string {
        return ValueValidator.validateString(this.configObj[fieldName], this.getFieldPath(fieldName));
    }

    extractString(fieldName: string, defaultValue?: string): string | undefined {
        return this.isUndefined(fieldName) ? defaultValue : this.extractRequiredString(fieldName);
    }

    extractRequiredObject(fieldName: string): ConfigObject {
        return ValueValidator.validateObject(this.configObj[fieldName], this.getFieldPath(fieldName)) as ConfigObject;
    }

    extractRequiredObjectAsExtractor(fieldName: string): ConfigValueExtractor {
        const subObject: ConfigObject = this.extractRequiredObject(fieldName);
        return new ConfigValueExtractor(subObject, this.getFieldPath(fieldName));
    }

    extractObject(fieldName: string, defaultValue?: ConfigObject): ConfigObject | undefined {
        return this.isUndefined(fieldName) ? defaultValue : this.extractRequiredObject(fieldName);
    }

    extractObjectAsExtractor(fieldName: string, defaultValue?: ConfigObject): ConfigValueExtractor {
        const subObject: ConfigObject = this.extractObject(fieldName, defaultValue) || {};
        return new ConfigValueExtractor(subObject, this.getFieldPath(fieldName));
    }

    extractRequiredArray<T>(fieldName: string, elementValidator?: (element: unknown, elementFieldName: string) => T): T[] {
        return ValueValidator.validateArray<T>(this.configObj[fieldName], this.getFieldPath(fieldName), elementValidator);
    }

    extractArray<T>(fieldName: string, elementValidator?: (element: unknown, elementFieldName: string) => T, defaultValue?: T[]): T[] | undefined {
        return this.isUndefined(fieldName) ? defaultValue : this.extractRequiredArray(fieldName, elementValidator);
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
        return ValueValidator.validateFile(this.configObj[fieldName], this.getFieldPath(fieldName), this.extractConfigRoot());
    }

    extractFile(fieldName: string, defaultValue?: string): string | undefined {
        return this.isUndefined(fieldName) ? defaultValue : this.extractRequiredFile(fieldName);
    }

    extractRequiredFolder(fieldName: string): string {
        return ValueValidator.validateFolder(this.configObj[fieldName], this.getFieldPath(fieldName), this.extractConfigRoot());
    }

    extractFolder(fieldName: string, defaultValue?: string): string | undefined {
        return this.isUndefined(fieldName) ? defaultValue : this.extractRequiredFolder(fieldName);
    }

    getFieldPath(fieldName?: string): string {
        if (!fieldName) {
            return this.fieldRoot || '';
        }
        return this.fieldRoot && this.fieldRoot.length > 0 ? `${this.fieldRoot}.${fieldName}` : fieldName;
    }

    protected isUndefined(fieldName: string): boolean {
        // Note a user could provide a boolean false value, which is why we don't just do an if statement on the value
        // but instead check to see if it is undefined or null.
        return this.configObj[fieldName] === undefined || this.configObj[fieldName] === null;
    }
}

export class ValueValidator {
    static validateBoolean(value: unknown, fieldPath: string): boolean {
        return validateType<boolean>("boolean", value, fieldPath);
    }

    static validateNumber(value: unknown, fieldPath: string): number {
        return validateType<number>("number", value, fieldPath);
    }

    static validateString(value: unknown, fieldPath: string): string {
        return validateType<string>("string", value, fieldPath);
    }

    static validateObject(value: unknown, fieldPath: string): ConfigObject {
        return validateType<ConfigObject>("object", value, fieldPath);
    }

    static validateArray<T>(value: unknown, fieldPath: string, elementValidator?: (element: unknown, elementFieldName: string) => T): T[] {
        if (!Array.isArray(value)) {
            throw new Error(getMessage('ConfigValueMustBeOfType', fieldPath, 'array', getDataType(value)));
        }
        if (elementValidator) {
            value.every((element, index) => elementValidator(element, `${fieldPath}[${index}]`));
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

function validateAbsoluteFolder(value: unknown, fieldPath: string): string {
    const folderValue: string = validateAbsolutePath(value, fieldPath);
    if (!fs.statSync(folderValue).isDirectory()) {
        throw new Error(getMessage('ConfigFolderValueMustNotBeFile', fieldPath, folderValue));
    }
    return folderValue;
}

function validateAbsolutePath(value: unknown, fieldPath: string): string {
    const pathValue: string = ValueValidator.validateString(value, fieldPath);
    if (pathValue !== toAbsolutePath(pathValue)) {
        throw new Error(getMessage('ConfigPathValueMustBeAbsolute', fieldPath, pathValue, toAbsolutePath(pathValue)));
    } else if (!fs.existsSync(pathValue)) {
        throw new Error(getMessage('ConfigPathValueDoesNotExist', fieldPath, pathValue));
    }
    return pathValue;
}

function getDataType(value: unknown): string {
    return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
}