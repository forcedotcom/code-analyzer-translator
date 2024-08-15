export interface Clock {
    now(): Date;
}

export class RealClock implements Clock {
    now(): Date {
        return new Date();
    }
}