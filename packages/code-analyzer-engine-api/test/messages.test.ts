import {getMessageFromCatalog, MessageCatalog} from "../src";

const dummyMessageCatalog: MessageCatalog = {
    DummyMessage1: `This has one variable: '%s'`,
    DummyMessage2: `This has two variables: '%s' and %d`
}

describe('Message Catalog Tests', () => {
    it('When arguments are correctly passed in then it they get filled as they should', () => {
        expect(getMessageFromCatalog(dummyMessageCatalog, 'DummyMessage1', 'abc')).toEqual(
            `This has one variable: 'abc'`
        );
        expect(getMessageFromCatalog(dummyMessageCatalog, 'DummyMessage2', 'abc', 3)).toEqual(
            `This has two variables: 'abc' and 3`
        );
    });

    it('When too few variables are passed in then throw error', () => {
        expect(() => getMessageFromCatalog(dummyMessageCatalog, 'DummyMessage1')).toThrow(
            `Incorrect number of variables supplied to the message 'DummyMessage1' in the message catalog.\n` +
            `Expected amount: 1. Actual amount: 0.`
        );
    });

    it('When too many variables are passed in then throw error', () => {
        expect(() => getMessageFromCatalog(dummyMessageCatalog, 'DummyMessage1', 'low', 2)).toThrow(
            `Incorrect number of variables supplied to the message 'DummyMessage1' in the message catalog.\n` +
            `Expected amount: 1. Actual amount: 2.`
        );
    });

    it('When message id does not exist in the catalog then throw error', () => {
        expect(() => getMessageFromCatalog(dummyMessageCatalog, 'doesNotExist')).toThrow(
            `Message with id "doesNotExist" does not exist in the message catalog.`
        );
    });
});