import {LogLevel, SeverityLevel} from "../src";
import * as engApi from "@salesforce/code-analyzer-engine-api";

// Currently the LogLevel and SeverityLevel enums from the engine api have the same values as their
// counterparts in core. But if there values every get out of sync, then this test will serve as a reminder to update
// all of our code where we use the "as" cast operator to convert from one to another.
describe('Tests to check that we can safely convert enums to and from core and the engine api', () => {
    it('When converting engApi.LogLevel to LogLevel or vice-verca, make sure the enums are the same', () => {
        expect(LogLevel).toEqual(engApi.LogLevel);
    });

    it('When converting engApi.SeverityLevel to SeverityLevel or vice-verca, make sure the enums are the same', () => {
        expect(SeverityLevel).toEqual(engApi.SeverityLevel);
    });
});