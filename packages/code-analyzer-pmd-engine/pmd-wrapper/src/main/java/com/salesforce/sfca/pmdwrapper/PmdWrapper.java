package com.salesforce.sfca.pmdwrapper;

import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;

public class PmdWrapper {

    private PmdWrapper() {}

    public static void main(String[] args) {
        // This is just temporary code to make sure we wired things up correctly.
        PMDConfiguration config = new PMDConfiguration();

        try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
            System.out.println("Success");
        }
    }
}
