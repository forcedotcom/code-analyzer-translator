import path from "node:path";

// THIS FILE CONTAINS UTILITIES WHICH ARE USED INTERNALLY ONLY.
// None of the following exported interfaces and functions should be exported from the index file.

export function toAbsolutePath(fileOrFolder: string): string {
    // Convert slashes to platform specific slashes and then convert to absolute path
    return path.resolve(fileOrFolder.replace(/[\\/]/g, path.sep));
}

export interface Clock {
    now(): Date;
}

export class RealClock implements Clock {
    now(): Date {
        return new Date();
    }
}

export interface UniqueIdGenerator {
    getUniqueId(prefix: string): string;
}

export class SimpleUniqueIdGenerator implements UniqueIdGenerator {
    private counter: number = 0;

    getUniqueId(prefix: string): string {
        return `${prefix}${++this.counter}`;
    }
}

export class EngineProgressAggregator {
    private readonly percentagesMap: Map<string, number> = new Map();

    reset(engineNames: string[]): void {
        this.percentagesMap.clear();
        for (const engineName of engineNames) {
            this.setProgressFor(engineName, 0);
        }
    }

    setProgressFor(engineName: string, value: number): void {
        this.percentagesMap.set(engineName, value);
    }

    getAggregatedProgressPercentage(): number {
        let sumOfPercentages = 0;
        for (const value of this.percentagesMap.values()) {
            sumOfPercentages += value;
        }
        return sumOfPercentages / Math.max(this.percentagesMap.size, 1);
    }
}