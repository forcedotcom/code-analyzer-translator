package com.salesforce.sfca.pmdwrapper;

import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.document.TextFile;
import net.sourceforge.pmd.reporting.FileAnalysisListener;
import net.sourceforge.pmd.reporting.GlobalAnalysisListener;
import net.sourceforge.pmd.reporting.ListenerInitializer;

import java.nio.file.Paths;

public class PmdRuleRunner {
    void runRules(String ruleSetInputFile, String filesToScanInputFile, String resultsOutputFile) {
        PMDConfiguration config = new PMDConfiguration();
        config.addRuleSet(ruleSetInputFile);
        config.setInputFilePath(Paths.get(filesToScanInputFile));
        config.setReportFormat("json");
        config.setReportFile(Paths.get(resultsOutputFile));

        try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
            pmd.addListener(new PmdRunProgressListener());
            pmd.performAnalysis();
        }
    }
}

class PmdRunProgressListener implements GlobalAnalysisListener {
    private int totalNumFiles = 0;
    private int fileCount = 0;

    @Override
    public ListenerInitializer initializer() {
        return new ListenerInitializer() {
            @Override
            public void setNumberOfFilesToAnalyze(int totalFiles) {
                totalNumFiles = totalFiles;
            }
        };
    }

    @Override
    public synchronized FileAnalysisListener startFileAnalysis(TextFile textFile) {
        // Note that this method must be synchronized so that multiple threads cannot mess
        // up the order of progress with race conditions.
        fileCount++;
        System.out.println("[Progress]" + fileCount + "::" + totalNumFiles);
        return FileAnalysisListener.noop();
    }

    @Override
    public void close() {}
}