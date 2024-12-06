package com.salesforce.sfca.cpdwrapper;

import java.util.List;
import java.util.Map;

/**
 * Data structure for the CpdRunner that we can deserialize the input json file into
 */
class CpdRunInputData {
    public Map<String, LanguageSpecificRunData> runDataPerLanguage;
    public boolean skipDuplicateFiles;
}

class LanguageSpecificRunData {
    public List<String> filesToScan;
    public int minimumTokens;
}