import {getMessage} from "../src/messages";

describe('Message Catalog Tests', () => {
    it('When arguments are correctly passed in then it they get filled as they should', () => {
        expect(getMessage('RetireJsRuleDescription', 'low')).toEqual(
            'Identifies JavaScript libraries with known vulnerabilities of low severity.'
        );
    });

    it('When too few arguments are passed in then throw error', () => {
        expect(() => getMessage('RetireJsRuleDescription')).toThrow(
            'Incorrect length of args for the call to getMessage(\'RetireJsRuleDescription\',...args).\n' +
            'Expected length: 1. Actual length: 0.'
        );
    });

    it('When too many arguments are passed in then throw error', () => {
        expect(() => getMessage('RetireJsRuleDescription', 'low', 2)).toThrow(
            'Incorrect length of args for the call to getMessage(\'RetireJsRuleDescription\',...args).\n' +
            'Expected length: 1. Actual length: 2.'
        );
    });

    it('When message id does not exist in the catalog then throw error', () => {
        expect(() => getMessage('doesNotExist')).toThrow(
            'Message with id "doesNotExist" does not exist in the message catalog.'
        );
    });
});