import path from "node:path";

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