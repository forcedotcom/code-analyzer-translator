package com.salesforce.sfca.pmdwrapper;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

class PmdWrapperTest {
    @Test
    void testMain() {
        try (StdOutCaptor stdoutCaptor = new StdOutCaptor()) {
            PmdWrapper.main(new String[0]);
            assertThat(stdoutCaptor.getCapturedOutput().trim(), equalTo("Success"));
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
