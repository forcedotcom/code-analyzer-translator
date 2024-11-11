package com.salesforce.sfca.cpdwrapper;

import net.sourceforge.pmd.cpd.CPDConfiguration;
import net.sourceforge.pmd.cpd.CPDListener;
import net.sourceforge.pmd.cpd.CpdAnalysis;
import net.sourceforge.pmd.cpd.Mark;
import net.sourceforge.pmd.cpd.Match;
import net.sourceforge.pmd.lang.Language;
import net.sourceforge.pmd.lang.document.FileLocation;
import net.sourceforge.pmd.reporting.Report;
import net.sourceforge.pmd.util.log.PmdReporter;
import org.slf4j.event.Level;

import javax.annotation.Nullable;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.MessageFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Class to help us invoke CPD - once for each language that should be processed
 */
class CpdRunner {
    private final ProgressReporter progressReporter = new ProgressReporter();

    public Map<String, CpdLanguageRunResults> run(CpdRunInputData runInputData) throws IOException {
        validateRunInputData(runInputData);

        List<String> languagesToProcess = runInputData.filesToScanPerLanguage.entrySet().stream()
                .filter(entry -> !entry.getValue().isEmpty())  // Keep only non-empty lists
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        progressReporter.initialize(languagesToProcess);

        Map<String, CpdLanguageRunResults> results = new HashMap<>();
        for (String language : languagesToProcess) {
            List<String> filesToScan = runInputData.filesToScanPerLanguage.get(language);
            List<Path> pathsToScan = filesToScan.stream().map(Paths::get).collect(Collectors.toList());
            CpdLanguageRunResults languageRunResults = runLanguage(language, pathsToScan, runInputData.minimumTokens, runInputData.skipDuplicateFiles);
            if (!languageRunResults.matches.isEmpty() || !languageRunResults.processingErrors.isEmpty()) {
                results.put(language, languageRunResults);
            }
        }
        return results;
    }

    private CpdLanguageRunResults runLanguage(String language, List<Path> pathsToScan, int minimumTokens, boolean skipDuplicateFiles) throws IOException {
        // Note that the name "minimumTokens" comes from the public facing documentation and the cli but
        // behind the scenes, it maps to MinimumTileSize. To learn more about the mappings to the config, see:
        // https://github.com/pmd/pmd/blob/main/pmd-cli/src/main/java/net/sourceforge/pmd/cli/commands/internal/CpdCommand.java
        CPDConfiguration config = new CPDConfiguration();
        Language cpdLanguageId = config.getLanguageRegistry().getLanguageById(language);
        if (cpdLanguageId == null) {
            throw new RuntimeException("The language \"" + language + "\" is not recognized by CPD.");
        }
        config.setOnlyRecognizeLanguage(cpdLanguageId);
        config.setMinimumTileSize(minimumTokens);
        config.setInputPathList(pathsToScan);
        config.setSkipDuplicates(skipDuplicateFiles);
        config.setReporter(new CpdErrorListener());

        CpdLanguageRunResults languageRunResults = new CpdLanguageRunResults();

        try (CpdAnalysis cpd = CpdAnalysis.create(config)) {

            // Note that we could use cpd.files().getCollectedFiles().size() to get the true totalNumFiles but
            // unfortunately getCollectedFiles doesn't cache and does a sort operation which is expensive.
            // So instead we use pathsToScan.size() since we send in the list of files instead of folders and so
            // these numbers should be the same.
            int totalNumFiles = pathsToScan.size();
            cpd.setCpdListener(new CpdLanguageRunListener(progressReporter, language, totalNumFiles));

            cpd.performAnalysis(report -> {
                for (Report.ProcessingError reportProcessingError : report.getProcessingErrors()) {
                    CpdLanguageRunResults.ProcessingError processingErr = new CpdLanguageRunResults.ProcessingError();
                    processingErr.file = reportProcessingError.getFileId().getAbsolutePath();
                    processingErr.message = reportProcessingError.getMsg();
                    processingErr.detail = reportProcessingError.getDetail();
                    languageRunResults.processingErrors.add(processingErr);
                }

                for (Match match : report.getMatches()) {
                    CpdLanguageRunResults.Match cpdMatch = new CpdLanguageRunResults.Match();
                    cpdMatch.numBlocks = match.getMarkCount();
                    cpdMatch.numTokensInBlock = match.getTokenCount();
                    cpdMatch.numNonemptyLinesInBlock = match.getLineCount();

                    for (Mark mark : match.getMarkSet()) {
                        CpdLanguageRunResults.Match.BlockLocation blockLocation = new CpdLanguageRunResults.Match.BlockLocation();
                        FileLocation location = mark.getLocation();
                        blockLocation.file = location.getFileId().getAbsolutePath();
                        blockLocation.startLine = location.getStartLine();
                        blockLocation.startCol = location.getStartColumn();
                        blockLocation.endLine = location.getEndLine();
                        blockLocation.endCol = location.getEndColumn();

                        cpdMatch.blockLocations.add(blockLocation);
                    }

                    languageRunResults.matches.add(cpdMatch);
                }
            });
        }

        return languageRunResults;
    }

    private void validateRunInputData(CpdRunInputData runInputData) {
        if (runInputData.filesToScanPerLanguage == null) {
            throw new RuntimeException("The \"filesToScanPerLanguage\" field was not set.");
        } else if (runInputData.filesToScanPerLanguage.isEmpty()) {
            throw new RuntimeException(("The \"filesToScanPerLanguage\" field was found to be empty."));
        } else if (runInputData.minimumTokens <= 0) {
            throw new RuntimeException("The \"minimumTokens\" field was not set to a positive number.");
        }
    }
}

// This class simply helps us process any errors that may be thrown by CPD. By default, CPD suppresses errors so that
// they are not thrown. So here, we look out for the errors that we care about and process it to throw a better
// error messages. We override the logEx method in particular because all other error methods call through to logEx.
class CpdErrorListener implements PmdReporter {
    @Override
    public void logEx(Level level, @javax.annotation.Nullable String s, Object[] objects, @Nullable Throwable throwable) {
        if (throwable != null) {
            throw new RuntimeException("CPD threw an unexpected exception:\n" + throwable.getMessage(), throwable);
        } else if (s != null) {
            String message = MessageFormat.format(s, objects);
            throw new RuntimeException("CPD threw an unexpected exception:\n" + message);
        }
    }

    // These methods aren't needed or used, but they are required to be implemented (since the interface does not give them default implementations)
    @Override
    public boolean isLoggable(Level level) {
        return false;
    }
    @Override
    public int numErrors() {
        return 0;
    }
}

// This class helps us track the overall progress of all language runs
class ProgressReporter {
    private Map<String, Float> progressPerLanguage = new HashMap<>();
    private float lastReportedProgress = 0.0f;

    public void initialize(List<String> languages) {
        progressPerLanguage = new HashMap<>();
        languages.forEach(l -> this.updateProgressForLanguage(l, 0.0f));
    }

    public void updateProgressForLanguage(String language, float percComplete) {
        progressPerLanguage.put(language, percComplete);
    }

    public void reportOverallProgress() {
        float currentProgress = this.calculateOverallPercentage();
        // The progress goes very fast, so we make sure to only report progress if there has been a significant enough increase (at least 1%)
        if (currentProgress >= lastReportedProgress + 1) {
            System.out.println("[Progress]" + currentProgress);
            lastReportedProgress = currentProgress;
        }
    }

    private float calculateOverallPercentage() {
        float sum = 0.0f;
        for (float progress : progressPerLanguage.values()) {
            sum += progress;
        }
        return sum / progressPerLanguage.size();
    }
}

// This class is a specific listener for a run of cpd for a single language.
class CpdLanguageRunListener implements CPDListener {
    private final ProgressReporter progressReporter;
    private final String language;
    private final int totalNumFiles;
    private int numFilesAdded = 0;
    private int currentPhase = CPDListener.INIT;

    public CpdLanguageRunListener(ProgressReporter progressReporter, String language, int totalNumFiles) {
        this.progressReporter = progressReporter;
        this.language = language;
        this.totalNumFiles = totalNumFiles;
    }

    @Override
    public void addedFile(int i) {
        // All files are added while we still are on phase 0 - INIT, i.e. before the phase is updated to phase 1 - HASH.
        this.numFilesAdded += i;
        updateAndReportCompletePercentage();
    }

    @Override
    public void phaseUpdate(int i) {
        this.currentPhase = i;
        updateAndReportCompletePercentage();
    }

    private void updateAndReportCompletePercentage() {
        this.progressReporter.updateProgressForLanguage(this.language, calculateCompletePercentage());
        this.progressReporter.reportOverallProgress();
    }

    private float calculateCompletePercentage() {
        if (this.currentPhase == CPDListener.INIT) {
            // Using Math.min just in case the totalNumFiles is inaccurate - although it shouldn't be.
            return 25*(Math.min((float) this.numFilesAdded / this.totalNumFiles, 1.0f));
        }
        return 100 * ((float) this.currentPhase / CPDListener.DONE);
    }
}