package com.salesforce.sfca.cpdwrapper;

import net.sourceforge.pmd.cpd.CPDConfiguration;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Class to help us invoke CPD - once for each language that should be processed
 */
class CpdRunner {
    public Map<String, List<CpdMatch>> run(CpdRunInputData runInputData) throws IOException {
        validateRunInputData(runInputData);

        Map<String, List<CpdMatch>> results = new HashMap<>();

        for (Map.Entry<String, List<String>> entry : runInputData.filesToScanPerLanguage.entrySet()) {
            String language = entry.getKey();
            List<String> filesToScan = entry.getValue();
            if (filesToScan.isEmpty()) {
                continue;
            }
            List<Path> pathsToScan = filesToScan.stream().map(Paths::get).collect(Collectors.toList());
            List<CpdMatch> languageMatches = runLanguage(language, pathsToScan, runInputData.minimumTokens, runInputData.skipDuplicateFiles);

            if (!languageMatches.isEmpty()) {
                results.put(language, languageMatches);
            }
        }

        return results;
    }

    private List<CpdMatch> runLanguage(String language, List<Path> pathsToScan, int minimumTokens, boolean skipDuplicateFiles) throws IOException {
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

        List<CpdMatch> cpdMatches = new ArrayList<>();

        try (CpdAnalysis cpd = CpdAnalysis.create(config)) {
            cpd.performAnalysis(report -> {
                for (Report.ProcessingError processingError : report.getProcessingErrors()) {
                    // We don't expect any processing errors, but if there are any, then we can push them
                    // to stdOut so that they ultimately get logged. But we should continue as normal here.
                    System.out.println("Unexpected CPD processing error: " + processingError.getError().getMessage());
                }
                for (Match match : report.getMatches()) {
                    CpdMatch cpdMatch = new CpdMatch();
                    cpdMatch.numBlocks = match.getMarkCount();
                    cpdMatch.numTokensInBlock = match.getTokenCount();
                    cpdMatch.numNonemptyLinesInBlock = match.getLineCount();

                    for (Mark mark : match.getMarkSet()) {
                        CpdMatch.BlockLocation blockLocation = new CpdMatch.BlockLocation();
                        FileLocation location = mark.getLocation();
                        blockLocation.file = location.getFileId().getAbsolutePath();
                        blockLocation.startLine = location.getStartLine();
                        blockLocation.startCol = location.getStartColumn();
                        blockLocation.endLine = location.getEndLine();
                        blockLocation.endCol = location.getEndColumn();

                        cpdMatch.blockLocations.add(blockLocation);
                    }

                    cpdMatches.add(cpdMatch);
                }
            });
        }

        return cpdMatches;
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