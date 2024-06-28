import {LogLevel, RuleType, SeverityLevel} from "../src";
import * as engApi from "@salesforce/code-analyzer-engine-api";

describe('Misc tests', () => {
    it('When converting engApi.LogLevel to LogLevel or vice-verca, make sure the enums are the same', () => {
        // Currently the LogLevel from the engine api is the same name as the LogLevel from core. But if this
        // ever changes, then this test will serve as a reminder to update all of our code where we use the "as" cast
        // operator to convert from one to another.
        expect(LogLevel).toEqual(engApi.LogLevel);
    });

    it('When converting engApi.RuleType to RuleType or vice-verca, make sure the enums are the same', () => {
        // Currently the RuleType from the engine api is the same name as the RuleType from core. But if this
        // ever changes, then this test will serve as a reminder to update all of our code where we use the "as" cast
        // operator to convert from one to another.
        expect(RuleType).toEqual(engApi.RuleType);
    });

    it('When converting engApi.SeverityLevel to SeverityLevel or vice-verca, make sure the enums are the same', () => {
        // Currently the SeverityLevel from the engine api is the same name as the SeverityLevel from core. But if this
        // ever changes, then this test will serve as a reminder to update all of our code where we use the "as" cast
        // operator to convert from one to another.
        expect(SeverityLevel).toEqual(engApi.SeverityLevel);
    });
});