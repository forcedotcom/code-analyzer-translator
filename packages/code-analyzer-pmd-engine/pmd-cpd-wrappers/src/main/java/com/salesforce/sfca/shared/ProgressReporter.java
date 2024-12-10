package com.salesforce.sfca.shared;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

// This class helps us track the overall progress of all language runs
public class ProgressReporter {
    private Map<String, Float> languageWeight = new HashMap<>();
    private Map<String, Float> progressPerLanguage = new HashMap<>();
    private float lastReportedProgress = 0.0f;

    public void initialize(Map<String, Integer> languageFileCounts) {
        progressPerLanguage = new HashMap<>();
        languageWeight = new HashMap<>();
        int totalNumFilesToScan = languageFileCounts.values().stream().mapToInt(Integer::intValue).sum();
        for (Map.Entry<String,Integer> entry : languageFileCounts.entrySet()) {
            String language = entry.getKey();
            Integer numFiles = entry.getValue();
            languageWeight.put(language, (float) numFiles / totalNumFilesToScan);
            this.updateProgressForLanguage(language, 0.0f);

        }
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
        float overallPerc = 0.0f;
        for (String language : progressPerLanguage.keySet()) {
            overallPerc += (progressPerLanguage.get(language) * languageWeight.get(language));
        }
        return overallPerc;
    }
}