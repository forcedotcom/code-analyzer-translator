package com.salesforce.sfca.pmdwrapper;

import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;

import java.nio.file.Paths;

public class PmdRuleRunner {
    void runRules(String ruleSetInputFile, String filesToScanInputFile, String resultsOutputFile) {
        PMDConfiguration config = new PMDConfiguration();
        config.addRuleSet(ruleSetInputFile);
        config.setInputFilePath(Paths.get(filesToScanInputFile));
        config.setReportFormat("json");
        config.setReportFile(Paths.get(resultsOutputFile));

        try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
            pmd.performAnalysis();
        }
    }
}
