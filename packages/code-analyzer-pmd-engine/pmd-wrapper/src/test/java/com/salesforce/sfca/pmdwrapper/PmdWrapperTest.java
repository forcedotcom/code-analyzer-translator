package com.salesforce.sfca.pmdwrapper;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.PrintStream;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
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