package com.salesforce.sfca.shared;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

// This class helps us track the overall progress of all language runs
public class ProgressReporter {
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