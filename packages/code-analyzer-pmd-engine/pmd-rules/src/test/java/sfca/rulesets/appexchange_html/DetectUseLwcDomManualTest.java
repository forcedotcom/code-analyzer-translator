package sfca.rulesets.appexchange_html;

import net.sourceforge.pmd.test.SimpleAggregatorTst;

public class DetectUseLwcDomManualTest extends SimpleAggregatorTst {
    @Override
    protected void setUp() {
        // The test data xml file for this rule's test will always be in the resources directory using a naming
        // convention based off the package for this test and the rule being tested:
        //     "resources/<TestPackageName>/xml/<RuleName>.xml".
        // In this case "sfca.rulesets.appexchange_html" is the package name of this test file. Thus, the associated
        // test data xml file for this rule must be found at:
        //      "resource/sfca/rulesets/appexchange_html/xml/DetectUseLwcDomManual.xml"
        addRule("sfca/rulesets/AppExchange_html.xml", "DetectUseLwcDomManual");
    }
}
