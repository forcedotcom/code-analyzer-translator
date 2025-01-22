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


        // Until further notice, the Product Security team feels it is best to remove this rule until they can make it
        // more stable since the PMD HTML parser seems to throw errors on a number of LWC HTML files.
        // addRule("sfca/rulesets/AppExchange_html.xml", "DetectUseLwcDomManual");
    }
}
