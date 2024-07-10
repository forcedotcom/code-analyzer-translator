import {ConfigObject, ConfigValueExtractor, ValueValidator} from "../src";
import {getMessage} from "../src/messages";
import path from "node:path";

describe("Tests for ValueValidator", () => {
    it("When a boolean value is given to validateBoolean, then the value is returned", () => {
        expect(ValueValidator.validateBoolean(true, 'someFieldName')).toEqual(true);
    });

    it("When a non-boolean value is given to validateBoolean, then error", () => {
        expect(() =>  ValueValidator.validateBoolean(null, 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'boolean', 'null'));
    });

    it("When a number value is given to validateNumber, then the value is returned", () => {
        expect(ValueValidator.validateNumber(21.5, 'someFieldName')).toEqual(21.5);
    });

    it("When a non-number value is given to validateNumber, then error", () => {
        expect(() =>  ValueValidator.validateNumber('3', 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'number', 'string'));
    });

    it("When a string value is given to validateString, then the value is returned", () => {
        expect(ValueValidator.validateString('hello', 'someFieldName')).toEqual('hello');
    });

    it("When a non-string value is given to validateString, then error", () => {
        expect(() =>  ValueValidator.validateString(['hello'], 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'string', 'array'));
    });

    it("When an object value is given to validateObject, then the value is returned", () => {
        expect(ValueValidator.validateObject({a:1}, 'someFieldName')).toEqual({a:1});
    });

    it("When a non-object value is given to validateObject, then error", () => {
        expect(() =>  ValueValidator.validateObject([true], 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'object', 'array'));
    });

    it("When a string array is given to validateStringArray, then the value is returned", () => {
        expect(ValueValidator.validateStringArray(['a','b'], 'someFieldName')).toEqual(['a','b']);
    });

    it("When a value that is not a string array is given to validateStringArray, then error", () => {
        expect(() =>  ValueValidator.validateStringArray(['a',2], 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeStringArray', 'someFieldName', `["a",2]`));
    });

    it("When an absolute file is given to validateFile, then it is returned", () => {
        const inputFile: string = path.resolve(__dirname, 'config.test.ts');
        expect(ValueValidator.validateFile(inputFile, 'someFieldName')).toEqual(inputFile);
    });

    it("When an relative file is given to validateFile with a correct root, then it is returned", () => {
        const inputFile: string = 'test-data/sampleWorkspace/someFile.txt';
        const inputRoot: string = __dirname;
        expect(ValueValidator.validateFile(inputFile, 'someFieldName', inputRoot)).toEqual(
            path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'someFile.txt'));
    });

    it("When an non-string value is given to validateFile, then error", () => {
        expect(() => ValueValidator.validateFile(3, 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'string', 'number'));
    });

    it("When an absolute file that does not exist is given to validateFile, then error", () => {
        const inputFile: string = path.resolve(__dirname, 'does.not.exist');
        expect(() => ValueValidator.validateFile(inputFile, 'someFieldName')).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', inputFile));
    });

    it("When an relative file that does not exist is given to validateFile, then error", () => {
        const inputFile: string = 'test-data/does.not.exist';
        const inputRoot: string = __dirname;
        expect(() => ValueValidator.validateFile(inputFile, 'someFieldName', inputRoot)).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', path.resolve(__dirname, 'test-data', 'does.not.exist')));
    });

    it("When a folder is given to validateFile, then error", () => {
        expect(() => ValueValidator.validateFile(__dirname, 'someFieldName')).toThrow(
            getMessage('ConfigFileValueMustNotBeFolder', 'someFieldName', __dirname));
    });

    it("When an absolute folder is given to validateFolder, then it is returned", () => {
        expect(ValueValidator.validateFolder(__dirname, 'someFieldName')).toEqual(__dirname);
    });

    it("When an relative folder is given to validateFolder with a correct root, then it is returned", () => {
        const inputFile: string = 'test-data/sampleWorkspace';
        const inputRoot: string = __dirname;
        expect(ValueValidator.validateFolder(inputFile, 'someFieldName', inputRoot)).toEqual(
            path.resolve(__dirname, 'test-data', 'sampleWorkspace'));
    });

    it("When an non-string value is given to validateFolder, then error", () => {
        expect(() => ValueValidator.validateFolder({}, 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'string', 'object'));
    });

    it("When an absolute folder that does not exist is given to validateFolder, then error", () => {
        const inputFile: string = path.resolve(__dirname, 'doesNotExist');
        expect(() => ValueValidator.validateFolder(inputFile, 'someFieldName')).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', inputFile));
    });

    it("When an relative folder that does not exist is given to validateFolder, then error", () => {
        const inputFile: string = 'doesNotExist';
        const inputRoot: string = __dirname;
        expect(() => ValueValidator.validateFile(inputFile, 'someFieldName', inputRoot)).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', path.resolve(__dirname, 'doesNotExist')));
    });

    it("When a file is given to validateFolder, then error", () => {
        const input: string = path.resolve(__dirname, 'config.test.ts');
        expect(() => ValueValidator.validateFolder(input, 'someFieldName')).toThrow(
            getMessage('ConfigFolderValueMustNotBeFile', 'someFieldName', input));
    });
});

describe("Tests for ConfigValueExtractor", () => {
    it("When config_root is not supplied, then extractConfigRoot returns cwd", () => {
        const config: ConfigObject = {};
        const extractor: ConfigValueExtractor = new ConfigValueExtractor(config);
        expect(extractor.extractConfigRoot()).toEqual(process.cwd());
    });

    it("When config_root is supplied with valid folder, then extractConfigRoot returns it", () => {
        const config: ConfigObject = {config_root: __dirname};
        const extractor: ConfigValueExtractor = new ConfigValueExtractor(config);
        expect(extractor.extractConfigRoot()).toEqual(__dirname);
    });

    it("When config_root value is not a string, then extractConfigRoot throws an error", () => {
        const config: ConfigObject = {config_root: 3};
        const extractor: ConfigValueExtractor = new ConfigValueExtractor(config, 'thisIsNotUsedForConfigRoot');
        expect(() => extractor.extractConfigRoot()).toThrow(
            getMessage('ConfigValueMustBeOfType','config_root', 'string', 'number'));
    });

    it("When config_root value does not exist, then extractConfigRoot throws an error", () => {
        const config: ConfigObject = {config_root: path.resolve(__dirname, 'doesNotExist')};
        const extractor: ConfigValueExtractor = new ConfigValueExtractor(config, 'thisIsNotUsedForConfigRoot');
        expect(() => extractor.extractConfigRoot()).toThrow(
            getMessage('ConfigPathValueDoesNotExist','config_root', path.resolve(__dirname, 'doesNotExist')));
    });

    it("When config_root value is a file, then extractConfigRoot throws an error", () => {
        const config: ConfigObject = {config_root: path.resolve(__dirname, 'config.test.ts')};
        const extractor: ConfigValueExtractor = new ConfigValueExtractor(config, 'thisIsNotUsedForConfigRoot');
        expect(() => extractor.extractConfigRoot()).toThrow(
            getMessage('ConfigFolderValueMustNotBeFile','config_root', path.resolve(__dirname, 'config.test.ts')));
    });

    it("When config_root value is a relative folder instead of absolute, then extractConfigRoot throws an error", () => {
        const config: ConfigObject = {config_root: 'test'};
        const extractor: ConfigValueExtractor = new ConfigValueExtractor(config, 'thisIsNotUsedForConfigRoot');
        expect(() => extractor.extractConfigRoot()).toThrow(
            getMessage('ConfigPathValueMustBeAbsolute','config_root', 'test', path.resolve('test')));
    });

    it("When calling extractBoolean on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractBoolean('some_field')).toEqual(undefined);
        expect(extractor.extractBoolean('some_field', true)).toEqual(true);
    });

    it("When calling extractBoolean on a field that is a boolean, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: true});
        expect(extractor.extractBoolean('some_field')).toEqual(true);
        expect(extractor.extractBoolean('some_field', false)).toEqual(true);
    });

    it("When calling extractBoolean on a non-boolean field, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1:{}});
        expect(() => extractor1.extractBoolean('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'boolean', 'object'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2:3}, 'engines.dummy');
        expect(() => extractor2.extractBoolean('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'boolean', 'number'));
    });

    it("When calling extractNumber on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractNumber('some_field')).toEqual(undefined);
        expect(extractor.extractNumber('some_field', 3)).toEqual(3);
    });

    it("When calling extractNumber on a field that is a number, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 5});
        expect(extractor.extractNumber('some_field')).toEqual(5);
        expect(extractor.extractNumber('some_field', 1)).toEqual(5);
    });

    it("When calling extractNumber on a non-number field, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1:true});
        expect(() => extractor1.extractNumber('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'number', 'boolean'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2:'hello'}, 'engines.dummy');
        expect(() => extractor2.extractNumber('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'number', 'string'));
    });

    it("When calling extractString on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractString('some_field')).toEqual(undefined);
        expect(extractor.extractString('some_field', 'abc')).toEqual('abc');
    });

    it("When calling extractString on a field that is a string, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'hello world'});
        expect(extractor.extractString('some_field')).toEqual('hello world');
        expect(extractor.extractString('some_field', 'abc')).toEqual('hello world');
    });

    it("When calling extractString on a non-string field, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: {a:'hi'}});
        expect(() => extractor1.extractString('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'string', 'object'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: 3}, 'engines.dummy');
        expect(() => extractor2.extractString('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'string', 'number'));
    });

    it("When calling extractObject on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractObject('some_field')).toEqual(undefined);
        expect(extractor.extractObject('some_field', {a:1})).toEqual({a:1});
    });

    it("When calling extractObject on a field that is an object, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: {hello: 'world'}});
        expect(extractor.extractObject('some_field')).toEqual({hello: 'world'});
        expect(extractor.extractObject('some_field', {})).toEqual({hello: 'world'});
    });

    it("When calling extractObject on a non-object field, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractObject('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'object', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: [true]}, 'engines.dummy');
        expect(() => extractor2.extractObject('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'object', 'array'));
    });

    it("When calling extractStringArray on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractStringArray('some_field')).toEqual(undefined);
        expect(extractor.extractStringArray('some_field', [])).toEqual([]);
    });

    it("When calling extractStringArray on a field that is an string array, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: ['hello', 'world']});
        expect(extractor.extractStringArray('some_field')).toEqual(['hello', 'world']);
        expect(extractor.extractStringArray('some_field', [])).toEqual(['hello', 'world']);
    });

    it("When calling extractStringArray on a field that is not a string array, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractStringArray('some_field1')).toThrow(
            getMessage('ConfigValueMustBeStringArray','some_field1', '4'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: ['a',3]}, 'engines.dummy');
        expect(() => extractor2.extractStringArray('some_field2')).toThrow(
            getMessage('ConfigValueMustBeStringArray','engines.dummy.some_field2', '["a",3]'));
    });

    it("When calling extractFile on a field that does not exist, then return the default", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({});
        expect(extractor.extractFile('some_field')).toEqual(undefined);
        expect(extractor.extractFile('some_field', 'someDefault')).toEqual('someDefault');
    });

    it("When calling extractFile on valid file, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            config_root: __dirname,
            some_field: 'test-data\\sampleWorkspace\\someFile.txt'
        }, 'engines.dummy');
        const expectedFile: string = path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'someFile.txt');
        expect(extractor.extractFile('some_field')).toEqual(expectedFile);
        expect(extractor.extractFile('some_field', 'someDefault')).toEqual(expectedFile);
    });

    it("When calling extractFile on a field that is not a string, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractFile('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'string', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: ['a',3]}, 'engines.dummy');
        expect(() => extractor2.extractFile('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'string', 'array'));
    });

    it("When calling extractFile on a field that is a path that does not exist, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({config_root: __dirname, some_field1: 'does.not.exist'});
        expect(() => extractor1.extractFile('some_field1')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','some_field1', path.resolve(__dirname, 'does.not.exist')));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: 'does.not.exist'}, 'engines.dummy');
        expect(() => extractor2.extractFile('some_field2')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','engines.dummy.some_field2', path.resolve(process.cwd(), 'does.not.exist')));
    });

    it("When calling extractFile on a field that is a folder, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            config_root: __dirname,
            some_field: 'test-data'
        }, 'engines.dummy');
        expect(() => extractor.extractFile('some_field')).toThrow(
            getMessage('ConfigFileValueMustNotBeFolder','engines.dummy.some_field', path.resolve(__dirname, 'test-data')));
    });

    it("When calling extractFolder on a field that does not exist, then return the default", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({});
        expect(extractor.extractFolder('some_field')).toEqual(undefined);
        expect(extractor.extractFolder('some_field', 'someDefault')).toEqual('someDefault');
    });

    it("When calling extractFolder on valid relative folder, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            config_root: __dirname,
            some_field: 'test-data/sampleWorkspace'
        }, 'engines.dummy');
        const expectedFolder: string = path.resolve(__dirname, 'test-data', 'sampleWorkspace');
        expect(extractor.extractFolder('some_field')).toEqual(expectedFolder);
        expect(extractor.extractFolder('some_field', 'someDefault')).toEqual(expectedFolder);
    });

    it("When calling extractFolder on valid absolute folder, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            config_root: __dirname,
            some_field: path.resolve(__dirname, 'test-data')
        }, 'engines.dummy');
        const expectedFolder: string = path.resolve(__dirname, 'test-data');
        expect(extractor.extractFolder('some_field')).toEqual(expectedFolder);
        expect(extractor.extractFolder('some_field', 'someDefault')).toEqual(expectedFolder);
    });

    it("When calling extractFolder on a field that is not a string, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractFolder('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'string', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: ['a',3]}, 'engines.dummy');
        expect(() => extractor2.extractFolder('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'string', 'array'));
    });

    it("When calling extractFolder on a field that is a path that does not exist, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({config_root: __dirname, some_field1: 'doesNotExist'});
        expect(() => extractor1.extractFolder('some_field1')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','some_field1', path.resolve(__dirname, 'doesNotExist')));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: 'doesNotExist'}, 'engines.dummy');
        expect(() => extractor2.extractFolder('some_field2')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','engines.dummy.some_field2', path.resolve(process.cwd(), 'doesNotExist')));
    });

    it("When calling extractFolder on a field that is a file, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            config_root: __dirname,
            some_field: 'test-data/sampleWorkspace/someFile.txt'
        }, 'engines.dummy');
        expect(() => extractor.extractFolder('some_field')).toThrow(
            getMessage('ConfigFolderValueMustNotBeFile','engines.dummy.some_field',
                path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'someFile.txt')));
    });
});