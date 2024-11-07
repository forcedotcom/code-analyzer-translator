package com.salesforce.sfca.cpdwrapper;

import java.util.List;
import java.util.Map;

/**
 * Data structure for the CpdRunner that we can deserialize the input json file into
 */
class CpdRunInputData {
    public Map<String, List<String>> filesToScanPerLanguage;
    public int minimumTokens;
    public boolean skipDuplicateFiles;
}
