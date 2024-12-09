package com.salesforce.sfca.shared;

import net.sourceforge.pmd.reporting.Report;

/**
 * Java object to help build processing error objects for the PMD and CPD results
 */
public class ProcessingError {
    public String file;
    public String message;
    public String detail;

    public static ProcessingError fromReportProcessingError(Report.ProcessingError reportProcessingError) {
        ProcessingError processingErr = new ProcessingError();
        processingErr.file = reportProcessingError.getFileId().getAbsolutePath();
        processingErr.message = reportProcessingError.getMsg();
        processingErr.detail = reportProcessingError.getDetail();
        return processingErr;
    }
}