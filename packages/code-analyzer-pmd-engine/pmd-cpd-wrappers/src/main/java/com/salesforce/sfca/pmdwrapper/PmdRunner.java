package com.salesforce.sfca.pmdwrapper;

import com.salesforce.sfca.shared.CodeLocation;
import com.salesforce.sfca.shared.ProcessingError;
import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.document.TextFile;
import net.sourceforge.pmd.reporting.*;

import java.nio.file.Paths;

public class PmdRunner {
    PmdRunResults runRules(String ruleSetInputFile, String filesToScanInputFile) {
        PMDConfiguration config = new PMDConfiguration();
        config.addRuleSet(ruleSetInputFile);
        config.setInputFilePath(Paths.get(filesToScanInputFile));

        PmdRunResults runResults = new PmdRunResults();

        // TODO: This is temporary. Soon we'll be looping over the languages.
        try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
            pmd.addListener(new PmdRunProgressListener());
            Report report = pmd.performAnalysisAndCollectReport();
            for (Report.ProcessingError reportProcessingError : report.getProcessingErrors()) {
                runResults.processingErrors.add(
                        ProcessingError.fromReportProcessingError(reportProcessingError));
            }
            for (RuleViolation ruleViolation : report.getViolations()) {
                PmdRunResults.Violation violation = new PmdRunResults.Violation();
                violation.rule = ruleViolation.getRule().getName();
                violation.message = ruleViolation.getDescription();
                violation.codeLocation = CodeLocation.fromFileLocation(ruleViolation.getLocation());
                runResults.violations.add(violation);
            }
        }

        return runResults;
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