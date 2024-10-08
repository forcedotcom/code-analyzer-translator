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
            assertThat("For language: " + language, PmdRuleDescriber.LANGUAGE_TO_STANDARD_RULESETS.get(language).stream().sorted().collect(Collectors.toList()),
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
        assertThat(ruleInfo.description, is("Database class methods, DML operations, SOQL queries, SOSL queries, Approval class methods, Email sending, async scheduling or queueing within loops can cause governor limit exceptions. Instead, try to batch up the data into a list and invoke the operation once on that list of data outside the loop."));
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
        assertThat(ruleInfo.description, is("Reassigning values to incoming parameters of a method or constructor is not recommended, as this can make the code more difficult to understand. The code is often read with the assumption that parameter values don't change and an assignment violates therefore the principle of least astonishment. This is especially a problem if the parameter is documented e.g. in the method's... Learn more: " + ruleInfo.externalInfoUrl));
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
        assertThat(ruleInfo.description, is("Avoid using 'for' statements without using curly braces."));
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
        assertThat(ruleInfo.description, is("Avoid unescaped user controlled content in EL as it results in XSS."));
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
        assertThat(ruleInfo.description, is("When the character encoding is missing from the XML declaration, the parser may produce garbled text. This is completely dependent on how the parser is set up and the content of the XML file, so it may be hard to reproduce. Providing an explicit encoding ensures accurate and consistent parsing."));
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
