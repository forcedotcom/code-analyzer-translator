import which from 'which';
import path from 'node:path';
import * as fsp from 'node:fs/promises';

import {PythonCommandExecutor} from '../../src/python/PythonCommandExecutor';

const PYTHON_EXE = which.sync('python3');
const PATH_TO_ERROR_THROWER = path.resolve(__dirname, '..', 'test-data', 'executable-scripts', 'error-thrower.py');


describe('PythonCommandExecutor', () => {
    const executor: PythonCommandExecutor = new PythonCommandExecutor(PYTHON_EXE);
    describe('#exec()', () => {
        it('When invoked script fails, rejects with informative message', async () => {
            const pathToGoldfile = path.resolve(__dirname, '..', 'test-data', 'goldfiles', 'PythonCommandExecutor.test.ts', 'error.goldfile.txt');
            const expectedOutput: string = (await fsp.readFile(pathToGoldfile, {encoding: 'utf-8'}))
                .replace('__PYTHON__', PYTHON_EXE)
                .replace('__FILE__', PATH_TO_ERROR_THROWER);
            await expect(executor.exec([PATH_TO_ERROR_THROWER])).rejects.toThrow(expectedOutput);
        });
    });
});