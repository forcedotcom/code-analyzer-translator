package com.salesforce.security.pmd.html;

import net.sourceforge.pmd.lang.html.ast.ASTHtmlElement;
import net.sourceforge.pmd.lang.html.rule.AbstractHtmlRule;

public class DetectUnescapedHtmlInAura extends AbstractHtmlRule {
    @Override
    @SuppressWarnings("unchecked")
    public Object visit(ASTHtmlElement node, Object data) {
        if (node.getNodeName().equalsIgnoreCase("aura:unescapedHtml")) {
            this.asCtx(data).addViolation(node); // Message is defined in sfca/rulesets/AppExchange_html.xml file
        }
        return super.visit(node, data);
    }
}