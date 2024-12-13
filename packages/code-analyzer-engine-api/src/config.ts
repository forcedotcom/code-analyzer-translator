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

    // Description objects for the primary fields in the configuration
    fieldDescriptions?: Record<string, ConfigFieldDescription>
}

export type ConfigFieldDescription = {
    // Text that describes the field to be documented
    descriptionText: string

    // The type for the value associated with this field (as a string).
    //   Note that this as a string instead of an enum in order to give flexibility to describe the type of the field as
    //   we want it to show up in our public docs, but it is recommended to return one of the following when possible:
    //     'string', 'number', 'boolean', 'object', 'array'
    valueType: string

    // The default value that is to be documented. Use null if you do not have a fixed default value.
    //   Note that this value may not necessarily be the same that could be auto calculated if the user doesn't provide
    //   the value in their configuration file. For example, we may want to report null as the default value for a
    //   java_command field whenever the user doesn't explicitly provide one even though it might automatically
    //   get calculated at runtime to be some java command found in their environment.
    defaultValue: ConfigValue
}

export class ConfigValueExtractor {
    private readonly configObj: ConfigObject;
    private readonly fieldPathRoot: string;
    private readonly configRoot: string;
    private keysThatBypassValidation: string[] = [];

    constructor(configObject: ConfigObject, fieldPathRoot: string = '', configRoot: string = process.cwd()) {
        this.configObj = configObject;
        this.fieldPathRoot = fieldPathRoot;
        this.configRoot = configRoot;
    }

    addKeysThatBypassValidation(keysThatBypassValidation: string[]) {
        this.keysThatBypassValidation = this.keysThatBypassValidation.concat(keysThatBypassValidation);
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

    validateContainsOnlySpecifiedKeys(keys: string[]) {
        const actualKeys: string[] = this.getKeys();
        const lowercasePublicKeys: string[] = keys.map(k => k.toLowerCase());
        for (const key of actualKeys) {
            if (!lowercasePublicKeys.includes(key.toLowerCase()) && !this.keysThatBypassValidation.includes(key)) {
                throw new Error(getMessage('ConfigObjectContainsInvalidKey',
                    this.fieldPathRoot || '<TopLevel>', key, JSON.stringify(keys.sort())))
            }
        }
    }

    getFieldPath(key?: string): string {
        if (!key) {
            return this.fieldPathRoot;
        }
        return this.fieldPathRoot.length > 0 ? `${this.fieldPathRoot}.${key}` : key;
    }

    hasValueDefinedFor(key: string): boolean {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return value !== null;
    }


    /** ==== BOOLEAN VALUE EXTRACTION ==== **/
    extractRequiredBoolean(key: string): boolean {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateBoolean(value, this.getFieldPath(key));
    }

    extractBoolean(key: string, defaultValue?: boolean): boolean | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredBoolean(key);
    }


    /** ==== NUMBER VALUE EXTRACTION ==== **/
    extractRequiredNumber(key: string): number {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateNumber(value, this.getFieldPath(key));
    }

    extractNumber(key: string, defaultValue?: number): number | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredNumber(key);
    }


    /** ==== STRING VALUE EXTRACTION ==== **/
    extractRequiredString(key: string, regexpToMatch?: RegExp): string {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateString(value, this.getFieldPath(key), regexpToMatch);
    }

    extractString(key: string, defaultValue?: string, regexpToMatch?: RegExp): string | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredString(key, regexpToMatch);
    }


    /** ==== SeverityLevel VALUE EXTRACTION ==== **/
    extractRequiredSeverityLevel(key: string): SeverityLevel {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateSeverityLevel(value, this.getFieldPath(key));
    }

    extractSeverityLevel(key: string, defaultValue?: SeverityLevel): SeverityLevel | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredSeverityLevel(key);
    }


    /** ==== OBJECT VALUE EXTRACTION ==== **/
    extractRequiredObject(key: string): ConfigObject {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateObject(value, this.getFieldPath(key)) as ConfigObject;
    }

    extractRequiredObjectAsExtractor(key: string): ConfigValueExtractor {
        const subObject: ConfigObject = this.extractRequiredObject(key);
        return new ConfigValueExtractor(subObject, this.getFieldPath(key));
    }

    extractObject(key: string, defaultValue?: ConfigObject): ConfigObject | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredObject(key);
    }

    extractObjectAsExtractor(key: string, defaultValue?: ConfigObject): ConfigValueExtractor {
        const subObject: ConfigObject = this.extractObject(key, defaultValue) || {};
        return new ConfigValueExtractor(subObject, this.getFieldPath(key));
    }


    /** ==== ARRAY VALUE EXTRACTION ==== **/
    extractRequiredArray<T>(key: string, elementValidator?: (element: unknown, elementFieldPath: string) => T): T[] {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateArray<T>(value, this.getFieldPath(key), elementValidator);
    }

    extractArray<T>(key: string, elementValidator?: (element: unknown, elementFieldPath: string) => T, defaultValue?: T[]): T[] | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredArray(key, elementValidator);
    }

    extractRequiredObjectArrayAsExtractorArray(key: string): ConfigValueExtractor[] {
        const subObjects: ConfigObject[] = this.extractRequiredArray(key, ValueValidator.validateObject);
        return subObjects.map((elem, index) => new ConfigValueExtractor(elem, `${this.getFieldPath(key)}[${index}]`));
    }

    extractObjectArrayAsExtractorArray(key: string, defaultValue?: ConfigObject[]): ConfigValueExtractor[] {
        const subObjects: ConfigObject[] = this.extractArray(key, ValueValidator.validateObject, defaultValue) || [];
        return subObjects.map((elem, index) => new ConfigValueExtractor(elem, `${this.getFieldPath(key)}[${index}]`));
    }


    /** ==== FILE PATH EXTRACTION ==== **/
    extractRequiredFile(key: string): string {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateFile(value, this.getFieldPath(key), [this.getConfigRoot()]);
    }

    extractFile(key: string, defaultValue?: string): string | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredFile(key);
    }


    /** ==== FOLDER PATH EXTRACTION ==== **/
    extractRequiredFolder(key: string): string {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateFolder(value, this.getFieldPath(key), [this.getConfigRoot()]);
    }

    extractFolder(key: string, defaultValue?: string): string | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredFolder(key);
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

    static validateArray<T>(value: unknown, fieldPath: string, elementValidator?: (element: unknown, elementFieldPath: string) => T): T[] {
        if (!Array.isArray(value)) {
            throw new Error(getMessage('ConfigValueMustBeOfType', fieldPath, 'array', getDataType(value)));
        }
        if (elementValidator) {
            value = value.map((element, index) => elementValidator(element, `${fieldPath}[${index}]`));
        }
        return value as T[];
    }

    static validateFile(value: unknown, fieldPath: string, possiblePathRoots: string[] = []): string {
        const fileValue: string = ValueValidator.validatePath(value, fieldPath, possiblePathRoots);
        if (fs.statSync(fileValue).isDirectory()) {
            throw new Error(getMessage('ConfigFileValueMustNotBeFolder', fieldPath, fileValue));
        }
        return fileValue;
    }

    static validateFolder(value: unknown, fieldPath: string, possiblePathRoots: string[] = []): string {
        const folderValue: string = ValueValidator.validatePath(value, fieldPath, possiblePathRoots);
        if (!fs.statSync(folderValue).isDirectory()) {
            throw new Error(getMessage('ConfigFolderValueMustNotBeFile', fieldPath, folderValue));
        }
        return folderValue;
    }

    static validatePath(value: unknown, fieldPath: string, possiblePathRoots: string[] = []): string {
        const pathValue: string = ValueValidator.validateString(value, fieldPath);
        const pathsToTry: string[] = [];
        for (const possiblePathRoot of possiblePathRoots) {
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

export function getValueUsingCaseInsensitiveKey(obj: ConfigObject, key: string): ConfigValue {
    if (key in obj) {
        return obj[key];
    }
    key = key.toLowerCase();
    for (const actualKey of Object.keys(obj)) {
        if (key == actualKey.toLowerCase()) {
            return obj[actualKey];
        }
    }
    return null;
}