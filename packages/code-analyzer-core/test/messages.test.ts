import {getMessage} from "../src/messages";

describe('Message Catalog Tests', () => {
    it('When arguments are correctly passed in then it they get filled as they should', () => {
        expect(getMessage('EngineFromFutureApiDetected', 1, 'HELLO', 2)).toEqual(
            'The following engines use the engine api version 1: HELLO.\n' +
            'This version of Code Analyzer only has knowledge of the 2 engine api.\n' +
            'Therefore some capabilities from these engines may not fully work with this version of Code Analyzer.',
        );
    });

    it('When too few arguments are passed in then throw error', () => {
        expect(() => getMessage('EngineFromFutureApiDetected', 1)).toThrow(
            'Incorrect length of args for the call to getMessage(\'EngineFromFutureApiDetected\',...args).\n' +
            'Expected length: 3. Actual length: 1.'
        );
    });

    it('When too many arguments are passed in then throw error', () => {
        expect(() => getMessage('EngineFromFutureApiDetected', 1, 'HELLO', 2, 'WORLD')).toThrow(
            'Incorrect length of args for the call to getMessage(\'EngineFromFutureApiDetected\',...args).\n' +
            'Expected length: 3. Actual length: 4.'
        );
    });

    it('When message id does not exist in the catalog then throw error', () => {
        expect(() => getMessage('doesNotExist')).toThrow(
            'Message with id "doesNotExist" does not exist in the message catalog.'
        );
    });
});