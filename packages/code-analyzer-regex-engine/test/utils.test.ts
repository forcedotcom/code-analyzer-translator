import {convertToRegex} from "../src/utils";

describe('Tests for convertToRegex', () => {
    type PATTERN_TESTCASE = { input: string, expected: RegExp };
    const patternTestCases: PATTERN_TESTCASE[] = [
        // Raw regex strings
        {input: String.raw`/[a-zA-Z]{2,5}\d?/gi`, expected: new RegExp('[a-zA-Z]{2,5}\\d?', 'gi')},
        {input: String.raw`/\d{1,3}\s?[A-Z]*/g`, expected: new RegExp('\\d{1,3}\\s?[A-Z]*', 'g')},
        {input: String.raw`/[^aeiou]{4,}\W?/gm`, expected: new RegExp('[^aeiou]{4,}\\W?', 'gm')},
        {input: String.raw`/(foo|bar){2,3}\d*/g`, expected: new RegExp('(foo|bar){2,3}\\d*', 'g')},
        {input: String.raw`/\d{2,4}-[a-z]{3,}/g`, expected: new RegExp('\\d{2,4}-[a-z]{3,}', 'g')},
        {input: String.raw`/(cat|dog)?\s+[1-9]/g`, expected: new RegExp('(cat|dog)?\\s+[1-9]', 'g')},
        {input: String.raw`/\w{3,5}\.?\d?/g`, expected: new RegExp('\\w{3,5}\\.?\\d?', 'g')},
        // Quoted "double-escaped" strings
        {input: '/[A-Z]{1,4}@[a-z]{2,4}/g', expected: new RegExp('[A-Z]{1,4}@[a-z]{2,4}', 'g')},
        {input: '/\\d{3,5}[^\\d\\s]/g', expected: new RegExp('\\d{3,5}[^\\d\\s]', 'g')},
        {input: '/[a-zA-Z]+\\d{1,2}/g', expected: new RegExp('[a-zA-Z]+\\d{1,2}', 'g')},
        {input: '/[0-9]{2,}[A-Z]{2,}?/g', expected: new RegExp('[0-9]{2,}[A-Z]{2,}?', 'g')},
        {input: '/[^a-zA-Z0-9]{3,6}/g', expected: new RegExp('[^a-zA-Z0-9]{3,6}', 'g')},
        {input: '/(alpha|beta)\\d{2,4}?/gi', expected: new RegExp('(alpha|beta)\\d{2,4}?', 'gi')},
        {input: '/\\/\\/[ \\t]*TODO/gi', expected: new RegExp('\\/\\/[ \\t]*TODO', 'gi')},
    ];
    it.each(patternTestCases)('Verify regular expression construction for $input', async (testCase: PATTERN_TESTCASE) => {
        const actual: RegExp = convertToRegex(testCase.input);
        expect(actual).toEqual(testCase.expected);
    });
});