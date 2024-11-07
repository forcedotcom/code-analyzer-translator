package com.salesforce.sfca.testtools;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

/**
 * Utility class to make it easy to suppress and capture anything that would be sent to stdout
 */
public class StdOutCaptor implements AutoCloseable {
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
