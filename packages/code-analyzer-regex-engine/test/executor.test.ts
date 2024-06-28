
import { changeWorkingDirectoryToPackageRoot } from "./test-helpers";
import path from "node:path";
import { RegexExecutor } from '../src/executor';
import { EXPECTED_VIOLATION_1, EXPECTED_VIOLATION_2, EXPECTED_VIOLATION_3, EXPECTED_VIOLATION_4} from './test-config';
import { Violation } from "@salesforce/code-analyzer-engine-api";

changeWorkingDirectoryToPackageRoot();
 
console.log(path.resolve("packages", "code-analyzer-regex-engine", "test", "test-data"))
describe("Executor tests", () => {
    let executor: RegexExecutor;
    beforeAll(() => {
        executor = new RegexExecutor();
    });
    
    /* I realize that I am not totally certain what the intended behavior of this case should be. But it might be better as just a no-op*/
    it("If I have a file that's not an Apex class, execute() should not return any violations.", async () => 
    {
        const file = path.resolve("test", "test-data", "1_notApexClassWithWhitespace", "something.xml")
        const violations: Violation[] = await executor.execute([file])
        const expViolations: Violation[] = [];
        expect(violations).toStrictEqual(expViolations);
    });

    it("If execute() is called with an Apex class that has trailing whitespace, emit violation", async () => {
        const file = path.resolve("test", "test-data", "2_apexClasses", "myOuterClass.cls")
        const violations: Violation[] = await executor.execute([file])
        
        expect(violations).toStrictEqual(EXPECTED_VIOLATION_1)
    });

    it("If execute() is pointed to an Apex class without trailing whitespace ensure there are no erroneous violations", async () => {
        const file = path.resolve("test", "test-data", "4_ApexClassWithoutWhitespace", "myOuterClass.cls")
        const violations: Violation[] = await executor.execute([file])
        const expViolations: Violation[] = [];
        expect(violations).toStrictEqual(expViolations);

    });

    it('Ensure that execute() can catch multiple violations in the same file', async () => {
        const file = path.resolve("test", "test-data", "2_apexClasses", "myClass.cls");
        const violations: Violation[] = await executor.execute([file]);
        expect(violations).toStrictEqual(EXPECTED_VIOLATION_2)
    })

    it("Ensure execute() can be called on a list Apex classes and properly emits errors", async () => {
        const file1 = path.resolve("test", "test-data", "2_apexClasses", "myOuterClass.cls")
        const file2 = path.resolve("test", "test-data", "2_apexClasses", "myClass.cls");
        const file3 = path.resolve("test", "test-data", "4_ApexClassWithoutWhitespace", "myOuterClass.cls")
        const violations: Violation[] = await executor.execute([file1, file2, file3])
        expect(violations).toStrictEqual(EXPECTED_VIOLATION_3)
    });

    it("If execute is pointed to a file with a blank line in the middle, ensure that it properly emits a violations", async () => {
        const file = path.resolve("test", "test-data", "5_apexClassWithBlankLine", "myOuterClass.cls")
        const violations: Violation[] = await executor.execute([file]);
        expect(violations).toStrictEqual(EXPECTED_VIOLATION_4);
    })



})


