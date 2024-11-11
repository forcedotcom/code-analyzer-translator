package com.salesforce.sfca.cpdwrapper;

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
        public List<BlockLocation> blockLocations = new ArrayList<>();

        public static class BlockLocation {
            public String file;
            public int startLine;
            public int startCol;
            public int endLine;
            public int endCol;
        }
    }

    public static class ProcessingError {
        public String file;
        public String message;
        public String detail;
    }
}