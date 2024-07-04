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

    extractConfigRoot(): string {
        if (!this.configRoot) {
            const fieldName: string = 'config_root'; // config_root is always top level, so don't use getFullFieldName
            this.configRoot = this.isUndefined(fieldName) ? process.cwd() :
                validateAbsoluteFolder(this.configObj[fieldName], fieldName);
        }
        return this.configRoot;
    }

    extractBoolean(fieldName: string, defaultValue?: boolean): boolean | undefined {
        return this.isUndefined(fieldName) ? defaultValue :
            ValueValidator.validateBoolean(this.configObj[fieldName], this.getFullFieldName(fieldName));
    }

    extractNumber(fieldName: string, defaultValue?: number): number | undefined {
        return this.isUndefined(fieldName) ? defaultValue :
            ValueValidator.validateNumber(this.configObj[fieldName], this.getFullFieldName(fieldName));
    }

    extractString(fieldName: string, defaultValue?: string): string | undefined {
        return this.isUndefined(fieldName) ? defaultValue :
            ValueValidator.validateString(this.configObj[fieldName], this.getFullFieldName(fieldName));
    }

    extractObject(fieldName: string, defaultValue?: ConfigObject): ConfigObject | undefined {
        return this.isUndefined(fieldName) ? defaultValue :
            ValueValidator.validateObject(this.configObj[fieldName], this.getFullFieldName(fieldName)) as ConfigObject;
    }

    extractStringArray(fieldName: string, defaultValue?: string[]): string[] | undefined {
        return this.isUndefined(fieldName) ? defaultValue :
            ValueValidator.validateStringArray(this.configObj[fieldName], this.getFullFieldName(fieldName));
    }

    extractFile(fieldName: string, defaultValue?: string): string | undefined {
        return this.isUndefined(fieldName) ? defaultValue :
            ValueValidator.validateFile(this.configObj[fieldName], this.getFullFieldName(fieldName), this.extractConfigRoot());
    }

    extractFolder(fieldName: string, defaultValue?: string): string | undefined {
        return this.isUndefined(fieldName) ? defaultValue :
            ValueValidator.validateFolder(this.configObj[fieldName], this.getFullFieldName(fieldName), this.extractConfigRoot());
    }

    getFullFieldName(fieldName: string): string {
        return this.fieldRoot && this.fieldRoot.length > 0 ? `${this.fieldRoot}.${fieldName}` : fieldName;
    }

    private isUndefined(fieldName: string): boolean {
        // Note a user could provide a boolean false value, which is why we don't just do an if statement on the value
        // but instead check to see if it is undefined or null.
        return this.configObj[fieldName] === undefined || this.configObj[fieldName] === null;
    }
}

export class ValueValidator {
    static validateBoolean(value: unknown, fieldName: string): boolean {
        return validateType<boolean>("boolean", value, fieldName);
    }

    static validateNumber(value: unknown, fieldName: string): number {
        return validateType<number>("number", value, fieldName);
    }

    static validateString(value: unknown, fieldName: string): string {
        return validateType<string>("string", value, fieldName);
    }

    static validateObject(value: unknown, fieldName: string): object {
        return validateType<object>("object", value, fieldName);
    }

    static validateStringArray(value: unknown, fieldName: string): string[] {
        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
            throw new Error(getMessage('ConfigValueMustBeStringArray', fieldName, JSON.stringify(value)));
        }
        return value as string[];
    }

    static validateFile(value: unknown, fieldName: string, possibleFileRoot?: string): string {
        const fileValue: string = ValueValidator.validatePath(value, fieldName, possibleFileRoot);
        if (fs.statSync(fileValue).isDirectory()) {
            throw new Error(getMessage('ConfigFileValueMustNotBeFolder', fieldName, fileValue));
        }
        return fileValue;
    }

    static validateFolder(value: unknown, fieldName: string, possibleFolderRoot?: string): string {
        const folderValue: string = ValueValidator.validatePath(value, fieldName, possibleFolderRoot);
        if (!fs.statSync(folderValue).isDirectory()) {
            throw new Error(getMessage('ConfigFolderValueMustNotBeFile', fieldName, folderValue));
        }
        return folderValue;
    }

    static validatePath(value: unknown, fieldName: string, possiblePathRoot?: string): string {
        const pathValue: string = ValueValidator.validateString(value, fieldName);
        const pathsToTry: string[] = [];
        if (possiblePathRoot) {
            // If a possible root is supplied, then we first assume the pathValue is relative to it
            pathsToTry.push(toAbsolutePath(pathValue, possiblePathRoot));
        }
        // Otherwise we try to resolve it without a possible root
        pathsToTry.push(toAbsolutePath(pathValue));
        return validateAtLeastOnePathExists(pathsToTry, fieldName);
    }
}

function validateType<T>(expectedType: string, value: unknown, fieldName: string): T {
    const dataType: string = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (dataType !== expectedType) {
        throw new Error(getMessage('ConfigValueMustBeOfType', fieldName, expectedType, dataType));
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

function validateAtLeastOnePathExists(paths: string[], fieldName: string): string {
    for (const currPath of paths) {
        if (fs.existsSync(currPath)) {
            return currPath;
        }
    }
    throw new Error(getMessage('ConfigPathValueDoesNotExist', fieldName, paths[0]));
}

function validateAbsoluteFolder(value: unknown, fieldName: string): string {
    const folderValue: string = validateAbsolutePath(value, fieldName);
    if (!fs.statSync(folderValue).isDirectory()) {
        throw new Error(getMessage('ConfigFolderValueMustNotBeFile', fieldName, folderValue));
    }
    return folderValue;
}

function validateAbsolutePath(value: unknown, fieldName: string): string {
    const pathValue: string = ValueValidator.validateString(value, fieldName);
    if (pathValue !== toAbsolutePath(pathValue)) {
        throw new Error(getMessage('ConfigPathValueMustBeAbsolute', fieldName, pathValue, toAbsolutePath(pathValue)));
    } else if (!fs.existsSync(pathValue)) {
        throw new Error(getMessage('ConfigPathValueDoesNotExist', fieldName, pathValue));
    }
    return pathValue;
}