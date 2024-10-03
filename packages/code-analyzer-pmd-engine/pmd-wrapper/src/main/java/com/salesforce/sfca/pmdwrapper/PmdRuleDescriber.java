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
                    "category/ecmascript/errorprone.xml",
                    "category/ecmascript/performance.xml"
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
                    pmdRuleInfo.description = getLimitedDescription(rule);
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

    private static String getLimitedDescription(Rule rule) {
        // Since the rule description can be long, we remove unnecessary whitespace and clip the message
        // so that users can read more on the website if it is over 500 characters long.
        String ruleDescription = rule.getDescription().trim()
                .replaceAll("\\s+"," ") // Switch to only use a single space whenever whitespace is found
                .replaceAll("\\[([^]]+)]\\([^)]+\\)", "$1"); // Remove markdown urls. i.e. replace "[phrase](<url>)" with "phrase"
        if (ruleDescription.length() > 500) {
            String clipText = "...<<CLIPPED>> READ MORE AT: " +  rule.getExternalInfoUrl();
            ruleDescription = ruleDescription.substring(0, 500 - clipText.length()) + clipText;
        }
        return ruleDescription;
    }
}
