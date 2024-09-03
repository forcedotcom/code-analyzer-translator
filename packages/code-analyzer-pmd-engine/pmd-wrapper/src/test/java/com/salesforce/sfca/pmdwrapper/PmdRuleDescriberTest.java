package com.salesforce.sfca.pmdwrapper;

import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.rule.Rule;
import net.sourceforge.pmd.lang.rule.RuleSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.stream.Collectors;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

public class PmdRuleDescriberTest {
    private PmdRuleDescriber ruleDescriber;

    @BeforeEach
    void setup() {
        ruleDescriber = new PmdRuleDescriber();
    }

    @Test
    void testThatHardCodedStandardRulesetsAreUpToDate() {
        // Note that in the source code, we hard code the standard rulesets because the following dynamic way of getting
        // this information is really slow (adding a full second to the describe method). So we fetch dynamically once
        // to help catch when changes occur to the standard rulesets so that we can keep LANGUAGE_TO_STANDARD_RULESETS
        // up to date.
        Map<String, Set<String>> expectedMap = new HashMap<>();
        try (PmdAnalysis pmd = PmdAnalysis.create(new PMDConfiguration())) {
            for (RuleSet ruleSet : pmd.newRuleSetLoader().getStandardRuleSets()) {
                for (Rule rule : ruleSet.getRules()) {
                    String language = rule.getLanguage().toString();
                    if (!expectedMap.containsKey(language)) {
                        expectedMap.put(language, new HashSet<>());
                    }
                    expectedMap.get(language).add(ruleSet.getFileName());
                }
            }
        }

        // I could just compare the two maps, but I'd prefer to make the output very readable when things fail to help
        // show the diff between actual and expected... thus the loop and conversion to sorted lists:
        assertThat(PmdRuleDescriber.LANGUAGE_TO_STANDARD_RULESETS.keySet(), is(expectedMap.keySet()));
        for (String language: PmdRuleDescriber.LANGUAGE_TO_STANDARD_RULESETS.keySet()) {
            assertThat(PmdRuleDescriber.LANGUAGE_TO_STANDARD_RULESETS.get(language).stream().sorted().collect(Collectors.toList()),
                    is(expectedMap.get(language).stream().sorted().collect(Collectors.toList())));
        }
    }

    @Test
    void whenDescribeRulesForApex_thenCorrectRulesAreReturned() {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(Set.of("apex"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("apex"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = findRuleInfoWithName(ruleInfoList, "OperationWithLimitsInLoop");
        assertThat(ruleInfo, is(notNullValue()));
        assertThat(ruleInfo.message, is("Avoid operations in loops that may hit governor limits"));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#operationwithlimitsinloop")));
        assertThat(ruleInfo.ruleSet, is("Performance"));
        assertThat(ruleInfo.priority, is("Medium"));
        assertThat(ruleInfo.ruleSetFile, is("category/apex/performance.xml"));
    }

    @Test
    void whenDescribeRulesForJava_thenCorrectRulesAreReturned()  {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(Set.of("java"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("java"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = findRuleInfoWithName(ruleInfoList, "AvoidReassigningParameters");
        assertThat(ruleInfo, is(notNullValue()));
        assertThat(ruleInfo.language, is("java"));
        assertThat(ruleInfo.message, is("Avoid reassigning parameters such as ''{0}''"));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#avoidreassigningparameters")));
        assertThat(ruleInfo.ruleSet, is("Best Practices"));
        assertThat(ruleInfo.priority, is("Medium High"));
        assertThat(ruleInfo.ruleSetFile, is("category/java/bestpractices.xml"));
    }

    @Test
    void whenDescribeRulesForEcmascript_thenCorrectRulesAreReturned() {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(Set.of("ecmascript"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("ecmascript"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = findRuleInfoWithName(ruleInfoList, "ForLoopsMustUseBraces");
        assertThat(ruleInfo, is(notNullValue()));
        assertThat(ruleInfo.language, is("ecmascript"));
        assertThat(ruleInfo.message, is("Avoid using 'for' statements without curly braces"));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#forloopsmustusebraces")));
        assertThat(ruleInfo.ruleSet, is("Code Style"));
        assertThat(ruleInfo.priority, is("Medium"));
        assertThat(ruleInfo.ruleSetFile, is("category/ecmascript/codestyle.xml"));
    }

    @Test
    void whenDescribeRulesForVisualforce_thenCorrectRulesAreReturned()  {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(Set.of("visualforce"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("visualforce"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = findRuleInfoWithName(ruleInfoList, "VfUnescapeEl");
        assertThat(ruleInfo, is(notNullValue()));
        assertThat(ruleInfo.language, is("visualforce"));
        assertThat(ruleInfo.message, is("Avoid unescaped user controlled content in EL"));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#vfunescapeel")));
        assertThat(ruleInfo.ruleSet, is("Security"));
        assertThat(ruleInfo.priority, is("Medium"));
        assertThat(ruleInfo.ruleSetFile, is("category/visualforce/security.xml"));
    }

    @Test
    void whenDescribeRulesForXml_thenCorrectRulesAreReturned()  {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(Set.of("xml"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("xml"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = findRuleInfoWithName(ruleInfoList, "MissingEncoding");
        assertThat(ruleInfo, is(notNullValue()));
        assertThat(ruleInfo.language, is("xml"));
        assertThat(ruleInfo.message, is("Set an explicit XML encoding in the XML declaration to ensure proper parsing"));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#missingencoding")));
        assertThat(ruleInfo.ruleSet, is("Best Practices"));
        assertThat(ruleInfo.priority, is("Medium"));
        assertThat(ruleInfo.ruleSetFile, is("category/xml/bestpractices.xml"));
    }

    @Test
    void whenDescribeRulesForMultipleLanguages_thenCorrectRulesAreReturned() {
        List<PmdRuleInfo> combinedRuleInfoList = ruleDescriber.describeRulesFor(Set.of("apex", "visualforce"));
        List<PmdRuleInfo> apexRuleInfoList = ruleDescriber.describeRulesFor(Set.of("apex"));
        List<PmdRuleInfo> visualforceRuleInfoList = ruleDescriber.describeRulesFor(Set.of("visualforce"));
        assertThat(combinedRuleInfoList, hasSize(apexRuleInfoList.size() + visualforceRuleInfoList.size()));
    }

    private PmdRuleInfo findRuleInfoWithName(List<PmdRuleInfo> ruleInfoList, String ruleName) {
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            if (ruleInfo.name.equals(ruleName)) {
                return ruleInfo;
            }
        }
        return null; // Return null if no rule with the specified name is found
    }
}
