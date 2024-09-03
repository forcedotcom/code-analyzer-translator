package com.salesforce.sfca.pmdwrapper;

import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.rule.Rule;
import net.sourceforge.pmd.lang.rule.RuleSet;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

class PmdRuleDescriber {
    /**
     * Map from language to the available standard rulesets.
     * Notes:
     *   - Language is a setting on the individual rule and not ruleset, but the standard rulesets are all organized
     *     by language, so we are safe to use this mapping.
     *   - We could get this information dynamically from pmd.newRuleSetLoader().getStandardRuleSets() but it is very
     *     slow which is why we hard code this list here (in order to boost performance).
     *   - A unit test exists to validate that this hard coded map is up-to-date.
     */
    static Map<String, Set<String>> LANGUAGE_TO_STANDARD_RULESETS = Map.of(
            "apex", Set.of(
                    "category/apex/bestpractices.xml",
                    "category/apex/codestyle.xml",
                    "category/apex/design.xml",
                    "category/apex/documentation.xml",
                    "category/apex/errorprone.xml",
                    "category/apex/performance.xml",
                    "category/apex/security.xml"
            ),
            "ecmascript", Set.of(
                    "category/ecmascript/bestpractices.xml",
                    "category/ecmascript/codestyle.xml",
                    "category/ecmascript/errorprone.xml"
            ),
            "html", Set.of(
                    "category/html/bestpractices.xml"
            ),
            "java", Set.of(
                    "category/java/bestpractices.xml",
                    "category/java/codestyle.xml",
                    "category/java/design.xml",
                    "category/java/documentation.xml",
                    "category/java/errorprone.xml",
                    "category/java/multithreading.xml",
                    "category/java/performance.xml",
                    "category/java/security.xml"
            ),
            "pom", Set.of(
                    "category/pom/errorprone.xml"
            ),
            "visualforce", Set.of(
                    "category/visualforce/security.xml"
            ),
            "xml", Set.of(
                    "category/xml/bestpractices.xml",
                    "category/xml/errorprone.xml"
            ),
            "xsl", Set.of(
                    "category/xsl/codestyle.xml",
                    "category/xsl/performance.xml"
            )
    );

    List<PmdRuleInfo> describeRulesFor(Set<String> languages) {
        List<PmdRuleInfo> ruleInfoList = new ArrayList<>();
        PMDConfiguration config = new PMDConfiguration();
        for (String lang : languages) {
            for (String ruleSetFile : LANGUAGE_TO_STANDARD_RULESETS.get(lang)) {
                config.addRuleSet(ruleSetFile);
            }
        }

        try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
            for (RuleSet ruleSet : pmd.getRulesets()) {
                for (Rule rule : ruleSet.getRules()) {
                    PmdRuleInfo pmdRuleInfo = new PmdRuleInfo();
                    pmdRuleInfo.name = rule.getName();
                    pmdRuleInfo.language = rule.getLanguage().toString();
                    pmdRuleInfo.message = rule.getMessage();
                    pmdRuleInfo.externalInfoUrl = rule.getExternalInfoUrl();
                    pmdRuleInfo.ruleSet = rule.getRuleSetName();
                    pmdRuleInfo.priority = rule.getPriority().toString();
                    pmdRuleInfo.ruleSetFile = ruleSet.getFileName();
                    ruleInfoList.add(pmdRuleInfo);
                }
            }
        }
        return ruleInfoList;
    }
}
