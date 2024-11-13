package com.salesforce.sfca.cpdwrapper;

import com.google.gson.JsonSyntaxException;
import com.salesforce.sfca.testtools.StdOutCaptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.FileNotFoundException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CpdWrapperTest {
    private final static String SAMPLE_APEX_1 =
            "global class ApexClass1 {\n" +
            "  global static void insertObj(Account account) {\n" +
            "      insert account;\n" +
            "  }\n" +
            "}\n";
    private final static String SAMPLE_APEX_2 =
            "global class ApexClass2 {\n" +
            "  public void insertObj(Account account) {\n" +
            "      insert account;\n" +
            "  }\n" +
            "\n" + // empty spaces is intentional - to sanity check that that empty lines are ignored
            "}\n";
    private final static String SAMPLE_JS_1 =
            "function abc1() {\n" +
            "  const a = 3;\n" +
            "  const b = 4;\n" +
            "}\n" +
            "function abc2() {\n" +
            "  if(true) {\n" +
            "    const a = 3;\n" +
            "    const b = 4;\n" +
            "  }\n" +
            "}\n";
    private final static String SAMPLE_JS_2 =
            "function abc3() {\n" +
            "  const a = 3;\n" +
            "  const b = 4;\n" +
            "}\n" +
            "function abc2() {\n" +
            "  if(true) {\n" +
            "    const a = 3;\n" +
            "    const b = 4;\n" +
            "  }\n" +
            "}\n";

    @Test
    void whenCallingMainWithNoCommand_thenError() {
        String[] args = {};
        Exception thrown = assertThrows(Exception.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is("Missing arguments to CpdWrapper."));
    }

    @Test
    void whenCallingMainWithUnsupportedCommand_thenError() {
        String[] args = {"oops", "abc"};
        Exception thrown = assertThrows(Exception.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is("Bad first argument to CpdWrapper. Expected \"run\". Received: \"oops\""));
    }

    @Test
    void whenCallingMainWithRunAndTooFewArgs_thenError() {
        String[] args = {"run", "notEnough"};
        Exception thrown = assertThrows(Exception.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"run\" command. Expected 2 but received: 1"));
    }

    @Test
    void whenCallingMainWithDescribeAndTooManyArgs_thenError() {
        String[] args = {"run", "too", "many", "args"};
        Exception thrown = assertThrows(Exception.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"run\" command. Expected 2 but received: 3"));
    }

    @Test
    void whenCallingMainWithRunAndInputFileThatDoesNotExist_thenError() {
        String[] args = {"run", "/does/not/exist.json", "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), containsString("Could not read contents from \"/does/not/exist.json\""));
        assertThat(thrown.getCause(), instanceOf(FileNotFoundException.class));
    }

    @Test
    void whenCallingMainWithRunAndInputFileThatDoesNotContainValidJson_thenError(@TempDir Path tempDir) throws Exception {
        String inputFileContents = "{\"oops"; // Not valid json
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), containsString("Could not read contents from \"" + inputFile + "\""));
        assertThat(thrown.getCause(), instanceOf(JsonSyntaxException.class));
    }

    @Test
    void whenCallingRunWithMissingField_filesToScanPerLanguage_thenError(@TempDir Path tempDir) throws Exception {
        String inputFileContents = "{" +
                "  \"minimumTokens\": 100, " +
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke CpdRunner.run: The \"filesToScanPerLanguage\" field was not set."));
    }

    @Test
    void whenCallingRunWithZeroLanguages_thenError(@TempDir Path tempDir) throws Exception {
        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "  }," +
                "  \"minimumTokens\": 120," +
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke CpdRunner.run: The \"filesToScanPerLanguage\" field was found to be empty."));
    }

    @Test
    void whenCallingRunWithInvalidLanguage_thenError(@TempDir Path tempDir) throws Exception {
        String dummyFile = createTempFile(tempDir, "dummy", "");
        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "       \"unknownLanguage\": [\"" + makePathJsonSafe(dummyFile) + "\"]" +
                "  }," +
                "  \"minimumTokens\": 120," +
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke CpdRunner.run: The language \"unknownLanguage\" is not recognized by CPD."));
    }

    @Test
    void whenCallingRunWithMissingField_minimumTokens_thenError(@TempDir Path tempDir) throws Exception {
        String dummyApexFile = createTempFile(tempDir, "dummy.cls", "");
        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "       \"apex\": [\"" + makePathJsonSafe(dummyApexFile) + "\"]" +
                "  }," +
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke CpdRunner.run: The \"minimumTokens\" field was not set to a positive number."));
    }

    @Test
    void whenCallingRunWithNegativeMinimumTokensValue_thenError(@TempDir Path tempDir) throws Exception {
        String dummyApexFile = createTempFile(tempDir, "dummy.cls", "");
        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "       \"apex\": [\"" + makePathJsonSafe(dummyApexFile) + "\"]" +
                "  }," +
                "  \"minimumTokens\": -1," +
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callCpdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke CpdRunner.run: The \"minimumTokens\" field was not set to a positive number."));
    }

    @Test
    void whenCallingRunWithFileToScanThatDoesNotExist_thenExceptionIsForwardedAsProcessingErrorWithTerminatingExceptionMarker(@TempDir Path tempDir) throws Exception {
        String doesNotExist = tempDir.resolve("doesNotExist.cls").toAbsolutePath().toString();
        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "       \"apex\": [\"" + makePathJsonSafe(doesNotExist) + "\"]" +
                "  }," +
                "  \"minimumTokens\": 100," +
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);
        String outputFile = tempDir.resolve("output.json").toAbsolutePath().toString();

        String[] args = {"run", inputFile, outputFile};
        callCpdWrapper(args);

        String resultsJsonString = new String(Files.readAllBytes(Paths.get(outputFile)));
        assertThat(resultsJsonString, allOf(
                containsString("\"processingErrors\":[{"),
                containsString("No such file"),
                containsString("\"detail\":\"[TERMINATING_EXCEPTION]\"")));
    }

    @Test
    void whenCallingRunWithValidFilesThatHaveDuplicates_thenJsonOutputShouldContainResults(@TempDir Path tempDir) throws Exception {
        String apexFile1 = createTempFile(tempDir, "ApexClass1.cls", SAMPLE_APEX_1);
        String apexFile2 = createTempFile(tempDir, "ApexClass2.cls", SAMPLE_APEX_2);
        String jsFile1 = createTempFile(tempDir, "jsFile1.js", SAMPLE_JS_1);
        String jsFile2 = createTempFile(tempDir, "jsFile2.js", SAMPLE_JS_2);

        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "       \"apex\": [\"" + makePathJsonSafe(apexFile1) + "\", \"" + makePathJsonSafe(apexFile2) + "\"]," +
                "       \"ecmascript\": [\"" + makePathJsonSafe(jsFile1) + "\", \"" + makePathJsonSafe(jsFile2) + "\"]" +
                "  }," +
                "  \"minimumTokens\": 5," +
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String outputFile = tempDir.resolve("output.json").toAbsolutePath().toString();
        String[] args = {"run", inputFile, outputFile};

        String stdOut = callCpdWrapper(args);

        String resultsJsonString = new String(Files.readAllBytes(Paths.get(outputFile)));

        String expectedOutput = "{\n" +
                "  \"apex\": {" +
                "    \"matches\": [\n" +
                "      {\n" +
                "        \"numTokensInBlock\": 12,\n" +
                "        \"numNonemptyLinesInBlock\": 4,\n" +
                "        \"numBlocks\": 2,\n" +
                "        \"blockLocations\": [\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(apexFile1) + "\",\n" +
                "            \"startLine\": 2,\n" +
                "            \"startCol\": 17,\n" +
                "            \"endLine\": 5,\n" +
                "            \"endCol\": 2\n" +
                "          },\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(apexFile2) + "\",\n" +
                "            \"startLine\": 2,\n" +
                "            \"startCol\": 10,\n" +
                "            \"endLine\": 6,\n" +
                "            \"endCol\": 2\n" +
                "          }\n" +
                "        ]\n" +
                "      }\n" +
                "    ],\n" +
                "    \"processingErrors\": []\n" +
                "  },\n" +
                "  \"ecmascript\": {" +
                "    \"matches\": [\n" +
                "      {\n" +
                "        \"numTokensInBlock\": 36,\n" +
                "        \"numNonemptyLinesInBlock\": 10,\n" +
                "        \"numBlocks\": 2,\n" +
                "        \"blockLocations\": [\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(jsFile1) + "\",\n" +
                "            \"startLine\": 1,\n" +
                "            \"startCol\": 14,\n" +
                "            \"endLine\": 10,\n" +
                "            \"endCol\": 2\n" +
                "          },\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(jsFile2) + "\",\n" +
                "            \"startLine\": 1,\n" +
                "            \"startCol\": 14,\n" +
                "            \"endLine\": 10,\n" +
                "            \"endCol\": 2\n" +
                "          }\n" +
                "        ]\n" +
                "      },\n" +
                "      {\n" +
                "        \"numTokensInBlock\": 13,\n" +
                "        \"numNonemptyLinesInBlock\": 4,\n" +
                "        \"numBlocks\": 4,\n" +
                "        \"blockLocations\": [\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(jsFile1) + "\",\n" +
                "            \"startLine\": 1,\n" +
                "            \"startCol\": 15,\n" +
                "            \"endLine\": 4,\n" +
                "            \"endCol\": 2\n" +
                "          },\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(jsFile1) + "\",\n" +
                "            \"startLine\": 6,\n" +
                "            \"startCol\": 10,\n" +
                "            \"endLine\": 9,\n" +
                "            \"endCol\": 4\n" +
                "          },\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(jsFile2) + "\",\n" +
                "            \"startLine\": 1,\n" +
                "            \"startCol\": 15,\n" +
                "            \"endLine\": 4,\n" +
                "            \"endCol\": 2\n" +
                "          },\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(jsFile2) + "\",\n" +
                "            \"startLine\": 6,\n" +
                "            \"startCol\": 10,\n" +
                "            \"endLine\": 9,\n" +
                "            \"endCol\": 4\n" +
                "          }\n" +
                "        ]\n" +
                "      }\n" +
                "    ],\n" +
                "    \"processingErrors\": []\n" +
                "  }\n" +
                "}";
        expectedOutput = expectedOutput.replaceAll("\\s+", "");
        assertThat(resultsJsonString, is(expectedOutput));

        // Also check that stdOut contains runtime information
        assertThat(stdOut, containsString("ARGUMENTS:"));
        assertThat(stdOut, containsString("milliseconds"));

        // Also check that stdOut contains correct progress information
        assertThat(stdOut, allOf(
                containsString("[Progress]6.25"),
                containsString("[Progress]12.5"),
                containsString("[Progress]25.0"),
                containsString("[Progress]37.5"),
                containsString("[Progress]50.0"),
                containsString("[Progress]56.25"),
                containsString("[Progress]62.5"),
                containsString("[Progress]75.0"),
                containsString("[Progress]87.5"),
                containsString("[Progress]100.0")));
    }

    @Test
    void whenCallingRunWithValidFilesHaveZeroDuplicatesSinceMinTokensIsHigh_thenJsonOutputShouldContainZeroResults(@TempDir Path tempDir) throws Exception {
        String apexFile1 = createTempFile(tempDir, "ApexClass1.cls", SAMPLE_APEX_1);
        String apexFile2 = createTempFile(tempDir, "ApexClass2.cls", SAMPLE_APEX_2);

        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "       \"apex\": [\"" + makePathJsonSafe(apexFile1) + "\", \"" + makePathJsonSafe(apexFile2) + "\"]" +
                "  }," +
                "  \"minimumTokens\": 500," + // This is why there are no dups found
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String outputFile = tempDir.resolve("output.json").toAbsolutePath().toString();
        String[] args = {"run", inputFile, outputFile};

        callCpdWrapper(args);

        String resultsJsonString = new String(Files.readAllBytes(Paths.get(outputFile)));

        assertThat(resultsJsonString, is("{}"));
    }

    @Test
    void whenCallingRunWithTwoIdenticalFilesButSkipDuplicateFilesIsFalse_thenJsonOutputShouldContainResults(@TempDir Path tempDir) throws Exception {
        String apexFileInParentFolder = createTempFile(tempDir, "ApexClass1.cls", SAMPLE_APEX_1);
        Path subFolder = tempDir.resolve("subFolder");
        Files.createDirectory(subFolder);
        String apexFileInSubFolder = createTempFile(subFolder, "ApexClass1.cls", SAMPLE_APEX_1);

        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "       \"apex\": [\"" + makePathJsonSafe(apexFileInParentFolder) + "\", \"" + makePathJsonSafe(apexFileInSubFolder) + "\"]," +
                "       \"xml\": []" + // Edge case - checking also that this doesn't blow up anything
                "  }," +
                "  \"minimumTokens\": 15," +
                "  \"skipDuplicateFiles\": false " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String outputFile = tempDir.resolve("output.json").toAbsolutePath().toString();
        String[] args = {"run", inputFile, outputFile};

        String stdOut = callCpdWrapper(args);

        String resultsJsonString = new String(Files.readAllBytes(Paths.get(outputFile)));

        String expectedOutput = "{\n" +
                "  \"apex\": {" +
                "    \"matches\": [\n" +
                "      {\n" +
                "        \"numTokensInBlock\": 18,\n" +
                "        \"numNonemptyLinesInBlock\": 5,\n" +
                "        \"numBlocks\": 2,\n" +
                "        \"blockLocations\": [\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(apexFileInParentFolder) + "\",\n" +
                "            \"startLine\": 1,\n" +
                "            \"startCol\": 1,\n" +
                "            \"endLine\": 5,\n" +
                "            \"endCol\": 2\n" +
                "          },\n" +
                "          {\n" +
                "            \"file\": \"" + makePathJsonSafe(apexFileInSubFolder) + "\",\n" +
                "            \"startLine\": 1,\n" +
                "            \"startCol\": 1,\n" +
                "            \"endLine\": 5,\n" +
                "            \"endCol\": 2\n" +
                "          }\n" +
                "        ]\n" +
                "      }\n" +
                "    ],\n" +
                "    \"processingErrors\": []\n" +
                "  }\n" +
                "}";
        expectedOutput = expectedOutput.replaceAll("\\s+", "");

        assertThat(resultsJsonString, is(expectedOutput));

        assertThat(stdOut, allOf(
                containsString("[Progress]12.5"),
                containsString("[Progress]25.0"),
                containsString("[Progress]50.0"),
                containsString("[Progress]75.0"),
                containsString("[Progress]100.0")));
    }

    @Test
    void whenCallingRunWithTwoIdenticalFilesButSkipDuplicateFilesIsTrue_thenJsonOutputShouldContainZeroResults(@TempDir Path tempDir) throws Exception {
        String apexFileInParentFolder = createTempFile(tempDir, "ApexClass1.cls", SAMPLE_APEX_1);
        Path subFolder = tempDir.resolve("subFolder");
        Files.createDirectory(subFolder);
        String apexFileInSubFolder = createTempFile(subFolder, "ApexClass1.cls", SAMPLE_APEX_1);

        String inputFileContents = "{" +
                "  \"filesToScanPerLanguage\": {" +
                "       \"apex\": [\"" + makePathJsonSafe(apexFileInParentFolder) + "\", \"" + makePathJsonSafe(apexFileInSubFolder) + "\"]" +
                "  }," +
                "  \"minimumTokens\": 15," +
                "  \"skipDuplicateFiles\": true " +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String outputFile = tempDir.resolve("output.json").toAbsolutePath().toString();
        String[] args = {"run", inputFile, outputFile};

        callCpdWrapper(args);

        String resultsJsonString = new String(Files.readAllBytes(Paths.get(outputFile)));

        assertThat(resultsJsonString, is("{}"));
    }

    private static String createTempFile(Path tempDir, String fileName, String fileContents) throws Exception {
        Path inputFilePath = tempDir.resolve(fileName);
        Files.write(inputFilePath, fileContents.getBytes());
        return inputFilePath.toAbsolutePath().toString();
    }

    private static String callCpdWrapper(String[] args) {
        try (StdOutCaptor stdoutCaptor = new StdOutCaptor()) {
            CpdWrapper.main(args);
            return stdoutCaptor.getCapturedOutput();
        }
    }

    private static String makePathJsonSafe(String file) {
        return file.replace("\\", "\\\\")   // Escape backslashes
                .replace("\"", "\\\"");     // Escape double quotes
    }
}


