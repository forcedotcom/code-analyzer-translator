package com.salesforce.sfca.shared;

import net.sourceforge.pmd.lang.document.FileLocation;

/**
 * Java object to help build code location objects for the PMD and CPD results
 */
public class CodeLocation {
    public String file;
    public int startLine;
    public int startCol;
    public int endLine;
    public int endCol;

    public static CodeLocation fromFileLocation(FileLocation fileLocation) {
        CodeLocation codeLocation = new CodeLocation();
        codeLocation.file = fileLocation.getFileId().getAbsolutePath();
        codeLocation.startLine = fileLocation.getStartLine();
        codeLocation.startCol = fileLocation.getStartColumn();
        codeLocation.endLine = fileLocation.getEndLine();
        codeLocation.endCol = fileLocation.getEndColumn();
        return codeLocation;
    }
}