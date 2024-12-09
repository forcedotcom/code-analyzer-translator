package com.salesforce.sfca.pmdwrapper;

import java.util.List;
import java.util.Map;

public class PmdRunInputData {
    public String ruleSetInputFile;
    public Map<String, LanguageSpecificRunData> runDataPerLanguage;

    public static class LanguageSpecificRunData {
        public List<String> filesToScan;
    }
}
