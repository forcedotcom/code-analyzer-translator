package com.salesforce.sfca.pmdwrapper;

import com.salesforce.sfca.shared.CodeLocation;
import com.salesforce.sfca.shared.ProcessingError;

import java.util.ArrayList;
import java.util.List;

/**
 * Java object to help build pmd results for all languages.
 */
public class PmdRunResults {
    public List<Violation> violations = new ArrayList<>();
    public List<ProcessingError> processingErrors = new ArrayList<>();

    public static class Violation {
        public String rule;
        public String message;
        public CodeLocation codeLocation;
    }
}