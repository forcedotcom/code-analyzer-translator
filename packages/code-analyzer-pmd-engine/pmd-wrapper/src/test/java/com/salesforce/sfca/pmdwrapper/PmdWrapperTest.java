package com.salesforce.sfca.pmdwrapper;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.PrintStream;
import java.lang.reflect.Type;
import java.nio.file.FileSystemException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

class PmdWrapperTest {
    @Test
    void whenCallingMainWithNoCommand_thenError() {
        String[] args = {};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Missing arguments to PmdWrapper."));
    }

    @Test
    void whenCallingMainWithUnsupportedCommand_thenError() {
        String[] args = {"oops", "abc"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Bad first argument to PmdWrapper. Expected \"describe\" or \"run\". Received: \"oops\""));
    }

    @Test
    void whenCallingMainWithDescribeAndTwoFewArgs_thenError() {
        String[] args = {"describe", "notEnough"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"describe\" command. Expected 2 but received: 1"));
    }

    @Test
    void whenCallingMainWithDescribeAndTooManyArgs_thenError() {
        String[] args = {"describe", "too", "many", "args"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"describe\" command. Expected 2 but received: 3"));
    }

    @Test
    void whenCallingMainWithDescribeAndBadOutputFile_thenError() {
        String[] args = {"describe", "/this/folder/does/not/exist", "apex,visualforce"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getCause(), instanceOf(FileNotFoundException.class));
    }

    @Test
    void whenCallingMainWithDescribeAndValidArgs_thenItWritesValidJsonToFile(@TempDir Path tempDir) throws Exception {
        Path tempFile = tempDir.resolve("tempFile.txt");
        String[] args = {"describe", tempFile.toAbsolutePath().toString(), "apex,visualforce"};
        String stdOut = callPmdWrapper(args);

        // Read the file and convert the json back into a list of PmdRuleInfo instances
        String fileContents = Files.readString(tempFile);
        Gson gson = new Gson();
        Type pmdRuleInfoListType = new TypeToken<List<PmdRuleInfo>>(){}.getType();
        List<PmdRuleInfo> pmdRuleInfoList = gson.fromJson(fileContents, pmdRuleInfoListType);

        // Keeping assertions to a minimal since we will lock in most of the output details in our other tests
        assertThat(pmdRuleInfoList, hasSize(greaterThan(60))); // Keeping this test flexible so it doesn't fail on each upgrade

        // Assert stdOut contains time arguments and time information (which help us with debugging)
        assertThat(stdOut, allOf(containsString("ARGUMENTS"), containsString("milliseconds")));
    }

    @Test
    void whenCallingMainWithRunAndTwoFewArgs_thenError() {
        String[] args = {"run", "not", "enough"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"run\" command. Expected 3 but received: 2"));
    }

    @Test
    void whenCallingMainWithRunAndTooManyArgs_thenError() {
        String[] args = {"run", "too", "many", "args", "unfortunately"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"run\" command. Expected 3 but received: 4"));
    }

    @Test
    void whenCallingMainWithRunAndValidArgs_thenItWritesValidJsonToFile(@TempDir Path tempDir) throws Exception {
        // Note that I am hard coding some files here because it is actually more work to put them in a resources folder
        // and then copy them to a temp directory (which is needed because the utility assumes absolute file paths).
        // But if this list grows, then we'll need to create a utility to make this easier.

        Path ruleSetInputFilePath = tempDir.resolve("ruleSetInputFile.xml");
        String ruleSetContents = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<ruleset name=\"Ruleset for Salesforce Code Analyzer\"\n" +
                "    xmlns=\"http://pmd.sourceforge.net/ruleset/2.0.0\"\n" +
                "    xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "    xsi:schemaLocation=\"http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd\">\n" +
                "    <description>Rules to Run for Salesforce Code Analyzer</description>\n" +
                "    <rule ref=\"category/visualforce/security.xml/VfUnescapeEl\" />\n" +
                "    <rule ref=\"category/apex/performance.xml/OperationWithLimitsInLoop\" />\n" +
                "</ruleset>";
        Files.write(ruleSetInputFilePath, ruleSetContents.getBytes());

        Path sampleApexFile = tempDir.resolve("OperationWithLimitsInLoop.cls");
        String apexViolationCode = "public class OperationWithLimitsInLoop {\n" +
                "    public static void main() {\n" +
                "        for (Integer i = 0; i < 10; i++) {\n" +
                "            List<Account> accounts = [SELECT Id FROM Account];\n" +
                "        }\n" +
                "    }\n" +
                "}";
        Files.write(sampleApexFile, apexViolationCode.getBytes());

        Path sampleVfFile = tempDir.resolve("VfUnescapeEl.page");
        String vfViolationCode = "<apex:page controller=\"testSELECT\">\n" +
                "    <script>\n" +
                "      console.log({!Name});\n" +
                "    </script>\n" +
                "</apex:page>";
        Files.write(sampleVfFile, vfViolationCode.getBytes());

        Path filesToScanInputFilePath = tempDir.resolve("filesToScan.txt");
        String filesToScanContents = sampleApexFile.toAbsolutePath() + "\n" + sampleVfFile.toAbsolutePath();
        Files.write(filesToScanInputFilePath, filesToScanContents.getBytes());

        String ruleSetInputFile = ruleSetInputFilePath.toAbsolutePath().toString();
        String filesToScanInputFile = filesToScanInputFilePath.toAbsolutePath().toString();
        String resultsOutputFile = tempDir.resolve("results.json").toAbsolutePath().toString();

        String[] args = {"run", ruleSetInputFile, filesToScanInputFile, resultsOutputFile};
        String stdOut = callPmdWrapper(args); // Should not error

        // Assert results contain valid json and that the expected rule violations (note this is more thoroughly tested on the typescript side)
        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        JsonElement element = JsonParser.parseString(resultsJsonString); // Should not error
        assertThat(element.isJsonObject(), is(true));
        assertThat(resultsJsonString, allOf(
                containsString("\"rule\": \"OperationWithLimitsInLoop\""),
                containsString("\"rule\": \"VfUnescapeEl\"")
        ));

        // Assert stdOut contains time arguments and time information (which help us with debugging)
        assertThat(stdOut, allOf(containsString("ARGUMENTS"), containsString("milliseconds")));
    }


    private static String callPmdWrapper(String[] args) {
        try (StdOutCaptor stdoutCaptor = new StdOutCaptor()) {
            PmdWrapper.main(args);
            return stdoutCaptor.getCapturedOutput();
        }
    }
}

class StdOutCaptor implements AutoCloseable {
    private final ByteArrayOutputStream outputStreamCaptor;
    private final PrintStream origStream;

    public StdOutCaptor() {
        origStream = System.out;
        outputStreamCaptor = new ByteArrayOutputStream();
        System.setOut(new PrintStream(outputStreamCaptor));
    }

    public String getCapturedOutput() {
        return outputStreamCaptor.toString();
    }

    @Override
    public void close() {
        System.setOut(this.origStream);
    }
}