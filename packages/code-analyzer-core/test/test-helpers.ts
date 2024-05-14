import process from "node:process";
import path from "node:path";

export function changeWorkingDirectoryToPackageRoot() {
    let original_working_directory: string;
    beforeAll(() => {
        // The config files use relative folders assuming the test is running from the package root directory.
        // This directory is already typically the one used, unless we run the tests from the monorepo's root directory.
        // Note that the package root directory is used instead of the test directory since some IDEs (like IntelliJ)
        // fail to collect code coverage correctly unless this directory is used.
        original_working_directory = process.cwd();
        process.chdir(path.resolve(__dirname,'..'));
    });
    afterAll(() => {
        process.chdir(original_working_directory);
    });
}