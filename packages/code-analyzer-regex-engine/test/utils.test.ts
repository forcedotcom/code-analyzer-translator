import {getDeprecatedApiVersionRegex} from "../src/utils";

type REGEX_TESTCASE = {
    date: Date;
    expected: string;
};

describe('getDeprecatedApiVersionRegex', () => {
    it.each<REGEX_TESTCASE>([
        { date: new Date('2024-08-15'), expected: '([1-4]\\d|5[0-2])\\.\\d' },  // Summer '21
        { date: new Date('2022-02-01'), expected: '([1-3]\\d|4[0-5])\\.\\d' },  // Spring '19
        { date: new Date('2023-05-02'), expected: '([1-3]\\d|4[0-8])\\.\\d' },  // Summer '20
        { date: new Date('2021-11-03'), expected: '([1-3]\\d|4[0-4])\\.\\d' }   // Winter '18
    ])('method should generate the correct regex string for the date', ({ date, expected }) => {
        const regexString = getDeprecatedApiVersionRegex(date);
        expect(regexString).toBe(expected);
    });

    it('Throw an error, if date is outside valid range to generate a valid API version ', () => {
        const earlyDate = new Date('2006-01-01');
        const lateDate = new Date('2050-01-01');
        expect(() => getDeprecatedApiVersionRegex(earlyDate)).toThrowError(
            "maxNumber must be between 0 and 99"
        );
        expect(() => getDeprecatedApiVersionRegex(lateDate)).toThrowError(
            "maxNumber must be between 0 and 99"
        );
    });

    it('Test will generate a valid API version now, but will throw error if 3 year old API version is >100', () => {
        const now = new Date();
        expect(() => getDeprecatedApiVersionRegex(now)).not.toThrow() // if this throws "the maxNumber must be between 0 and 99", rewrite utility
    });
});