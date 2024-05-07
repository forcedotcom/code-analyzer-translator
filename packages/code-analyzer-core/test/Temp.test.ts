// This is just a temporary file and will go away soon. Just using it to make sure things are wired up correctly.

import { Temp } from '@salesforce/code-analyzer-engine-api'

describe('Sample Test', () => {
    it('abc', () => {
        const t: Temp = new Temp();
        expect(t.hello()).toEqual("world");
    })
});