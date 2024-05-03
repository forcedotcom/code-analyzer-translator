// This is just a temporary file and will go away soon. Just using it to make sure things are wired up correctly.

import { Temp } from '../src/Temp'

describe('Sample Test', () => {
    const temp: Temp = new Temp();
    it('abc', () => {
        expect(temp.hello()).toEqual("world");
    })
});