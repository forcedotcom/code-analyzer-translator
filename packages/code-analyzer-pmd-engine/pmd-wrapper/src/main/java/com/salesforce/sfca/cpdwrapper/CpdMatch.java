package com.salesforce.sfca.cpdwrapper;

import java.util.ArrayList;
import java.util.List;

/**
 * Java object to help us build cpd results that will be serializable to json format
 * The data structure that we will serialize is Map<String, List<CpdMatch>> which will contain matches for each language.
 */
public class CpdMatch {
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