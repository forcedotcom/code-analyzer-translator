package com.salesforce.sfca.pmdwrapper;

import com.salesforce.sfca.shared.CodeLocation;
import com.salesforce.sfca.shared.ProcessingError;
import com.salesforce.sfca.shared.ProgressReporter;
import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.Language;
import net.sourceforge.pmd.lang.LanguageVersion;
import net.sourceforge.pmd.lang.document.TextFile;
import net.sourceforge.pmd.reporting.*;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public class PmdRunner {
    private final ProgressReporter progressReporter = new ProgressReporter();

    PmdRunResults run(PmdRunInputData inputData) {
        validateRunInputData(inputData);

        List<String> languagesToProcess = new ArrayList<>(inputData.runDataPerLanguage.keySet());
        progressReporter.initialize(languagesToProcess);

        PmdRunResults runResults = new PmdRunResults();
        for (String language: languagesToProcess) {
            runLanguage(language, inputData, runResults);
        }
        return runResults;
    }

    private void runLanguage(String language, PmdRunInputData inputData, PmdRunResults runResults) {
        PmdRunInputData.LanguageSpecificRunData languageSpecificRunData = inputData.runDataPerLanguage.get(language);

        PMDConfiguration config = new PMDConfiguration();
        config.addRuleSet(inputData.ruleSetInputFile);
        List<Path> inputPathList = languageSpecificRunData.filesToScan.stream().map(Paths::get).collect(Collectors.toList());
        config.setInputPathList(inputPathList);

        // Force the language so that pmd doesn't look at file extensions. Note: we already associated the files based
        // on their file extensions to the correct languages the typescript side.
        Language pmdLanguageId = config.getLanguageRegistry().getLanguageById(language);
        if (pmdLanguageId == null) {
            throw new RuntimeException("The language \"" + language + "\" is not recognized by PMD.");
        }
        LanguageVersion forcedLangVer = config.getLanguageVersionDiscoverer()
                .getDefaultLanguageVersion(pmdLanguageId);
        config.setForceLanguageVersion(forcedLangVer);

        try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
            pmd.addListener(new PmdRunProgressListener(progressReporter, language));
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
    }

    private void validateRunInputData(PmdRunInputData inputData) {
        if (inputData.ruleSetInputFile == null) {
            throw new RuntimeException(("The \"ruleSetInputFile\" field was missing."));
        }

        if (inputData.runDataPerLanguage == null) {
            throw new RuntimeException("The \"runDataPerLanguage\" field was not set.");
        }

        Set<Map.Entry<String, PmdRunInputData.LanguageSpecificRunData>> entries  = inputData.runDataPerLanguage.entrySet();
        if (entries.isEmpty()) {
            throw new RuntimeException("The \"runDataPerLanguage\" field didn't have any languages listed.");
        }

        for (Map.Entry<String, PmdRunInputData.LanguageSpecificRunData> entry: entries) {
            String language = entry.getKey();
            PmdRunInputData.LanguageSpecificRunData languageSpecificRunData = entry.getValue();
            if (languageSpecificRunData.filesToScan == null || languageSpecificRunData.filesToScan.isEmpty()) {
                throw new RuntimeException(("The \"filesToScan\" field was missing or empty for language: " + language));
            }
        }
    }
}

class PmdRunProgressListener implements GlobalAnalysisListener {
    private final ProgressReporter progressReporter;
    private final String language;

    private int totalNumFiles = 0;
    private int fileCount = 0;

    public PmdRunProgressListener(ProgressReporter progressReporter, String language) {
        this.progressReporter = progressReporter;
        this.language = language;
    }

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
        progressReporter.updateProgressForLanguage(language, 100 * ((float) fileCount / totalNumFiles));
        progressReporter.reportOverallProgress();
        return FileAnalysisListener.noop();
    }

    @Override
    public void close() {}
}