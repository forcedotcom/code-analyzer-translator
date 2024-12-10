package sfca.rulesets.examples;

import net.sourceforge.pmd.test.SimpleAggregatorTst;

public class ExampleXPathBasedRuleTest extends SimpleAggregatorTst {

    @Override
    protected void setUp() {
        // The test data xml file for this rule's test will always be in the resources directory using a naming
        // convention based off the package for this test and the rule being tested:
        //     "resources/<TestPackageName>/xml/<RuleName>.xml".
        // In this case "sfca.rulesets.examples" is the package name of this test file. Thus, the associated test data
        // xml file for this rule must be found at: "resource/sfca/rulesets/examples/xml/ExampleXPathBasedRule.xml"
        addRule("sfca/rulesets/examples.xml", "ExampleXPathBasedRule");
    }
}
