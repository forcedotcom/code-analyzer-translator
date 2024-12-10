package com.salesforce.sfca.cpdwrapper;

import com.salesforce.sfca.shared.CodeLocation;
import com.salesforce.sfca.shared.ProcessingError;

import java.util.ArrayList;
import java.util.List;

/**
 * Java object to help build cpd results for a specific language.
 * We will serialize Map<String, CpdLanguageRunResults> to json to create the overall results for all languages.
 */
public class CpdLanguageRunResults {
    public List<Match> matches = new ArrayList<>();
    public List<ProcessingError> processingErrors = new ArrayList<>();

    public static class Match {
        public int numTokensInBlock;
        public int numNonemptyLinesInBlock;
        public int numBlocks;
        public List<CodeLocation> blockLocations = new ArrayList<>();
    }
}