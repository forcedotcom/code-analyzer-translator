import {CodeAnalyzer, CodeAnalyzerConfig, EventType, LogEvent, LogLevel} from "../src";
import * as stubs from "./stubs";
import {getMessage} from "../src/messages";

describe("Tests for adding engines to Code Analyzer", () => {
    let codeAnalyzer: CodeAnalyzer;
    let logEvents: LogEvent[];

    beforeEach(() => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        logEvents = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
    })

    it('When adding engine plugin then all its engines are correctly added', () => {
        codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());

        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1","stubEngine2"])
    })

    it('(Forward Compatibility) When addEnginePlugin receives a plugin with a future api version then cast down to current api version', () => {
        codeAnalyzer.addEnginePlugin(new stubs.FutureEnginePlugin());

        const warnEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Warn, logEvents);
        expect(warnEvents.length).toEqual(1);
        expect(warnEvents[0].message).toEqual(getMessage('EngineFromFutureApiDetected', 99, '"future"', 1));
        expect(codeAnalyzer.getEngineNames()).toEqual(["future"]);
    })

    it('Attempt to add duplicate engines emits error log line but continues without adding the engines', () => {
        codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());
        codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());

        const errorEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Error, logEvents);
        expect(errorEvents.length).toEqual(2);
        expect(errorEvents[0].message).toEqual(getMessage('DuplicateEngine', 'stubEngine1'));
        expect(errorEvents[1].message).toEqual(getMessage('DuplicateEngine', 'stubEngine2'));
        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1","stubEngine2"])
    })

    it('When plugin returns engine that contradicts the plugin availableEngineNames method, then we emit error log line and skip that engine', () => {
        codeAnalyzer.addEnginePlugin(new stubs.ContradictingEnginePlugin());

        const errorEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Error, logEvents);
        expect(errorEvents.length).toEqual(1);
        expect(errorEvents[0].message).toEqual(getMessage('EngineNameContradiction', 'stubEngine1', 'stubEngine2'));
        expect(codeAnalyzer.getEngineNames().sort()).toEqual([])
    })

    it('When plugin returns engine that fails validation, then we emit error log line and skip that engine', () => {
        codeAnalyzer.addEnginePlugin(new stubs.InvalidEnginePlugin());

        const errorEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Error, logEvents);
        expect(errorEvents.length).toEqual(1);
        expect(errorEvents[0].message).toEqual(getMessage('EngineValidationFailed', 'invalidEngine', 'SomeErrorMessageFromValidate'));
        expect(codeAnalyzer.getEngineNames().sort()).toEqual([]);
    })

    it('When plugin throws error during getAvailableEngineNames, then we throw an exception', () => {
        expect(() => codeAnalyzer.addEnginePlugin(new stubs.ThrowingPlugin1())).toThrow(
            getMessage('PluginErrorFromGetAvailableEngineNames', 'SomeErrorFromGetAvailableEngineNames')
        );
    })

    it('When plugin throws error during createEngine, then we throw an exception', () => {
        expect(() => codeAnalyzer.addEnginePlugin(new stubs.ThrowingPlugin2())).toThrow(
            getMessage('PluginErrorFromCreateEngine', 'someEngine', 'SomeErrorFromCreateEngine')
        );
    });
});

function getLogEventsOfLevel(logLevel: LogLevel, logEvents: LogEvent[]): LogEvent[] {
    return logEvents.filter(e => e.logLevel == logLevel);
}