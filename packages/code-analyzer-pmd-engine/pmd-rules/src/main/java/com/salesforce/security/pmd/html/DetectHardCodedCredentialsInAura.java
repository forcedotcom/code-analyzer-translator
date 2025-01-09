package com.salesforce.security.pmd.html;

import java.util.List;

import net.sourceforge.pmd.lang.html.ast.ASTHtmlElement;
import net.sourceforge.pmd.lang.html.rule.AbstractHtmlRule;
import net.sourceforge.pmd.lang.rule.xpath.Attribute;

import com.salesforce.security.pmd.utils.SecretsInPackageUtils;

public class DetectHardCodedCredentialsInAura extends AbstractHtmlRule  {
    private static final String AURA_C_COMPONENT = "C:";
    private static final String AURA_HARDCODED_SECRET_VIOLATION =
            "Detected a potential hard coded secret in aura:attribute \"%s\"";

    @Override
    @SuppressWarnings("unchecked")
    public Object visit(ASTHtmlElement node, Object data) {
        detectHardCodedSecrets(node,data);
        return super.visit(node, data);
    }

    private void detectHardCodedSecrets(ASTHtmlElement htmlElement, Object data) {
        String name=htmlElement.getNodeName();
        if (name.equalsIgnoreCase("aura:attribute")) {
            detectSecretsInAuraAttrs(htmlElement, data);
        } else if (name.toUpperCase().startsWith(AURA_C_COMPONENT)) {
            detectSecretsInAuraComponent(htmlElement, data);
        }

    }

    private void detectSecretsInAuraComponent(ASTHtmlElement component, Object data) {
        List<Attribute> allAttrs=component.getAttributes();
        for (Attribute eachAttr: allAttrs) {
            String attrName = eachAttr.getName();
            if (SecretsInPackageUtils.isAPotentialSecret(attrName)) {
                this.asCtx(data).addViolationWithMessage(component,
                        String.format(AURA_HARDCODED_SECRET_VIOLATION, attrName));
            }
        }

    }

    private void detectSecretsInAuraAttrs(ASTHtmlElement nextAttr, Object data) {
        String attrName = nextAttr.getAttribute("name");
        String type = nextAttr.getAttribute("type");
        if (type!=null && //handles null pointer exception when type is not specified
                (type.compareToIgnoreCase("string")!=0 && type.compareToIgnoreCase("list")!=0)) {
            return;
        }
        String defaultValue = nextAttr.getAttribute("default");
        if (defaultValue==null || defaultValue.isEmpty()){
            return;
        }
        if (SecretsInPackageUtils.isAPotentialSecret(attrName)) {
            this.asCtx(data).addViolationWithMessage(nextAttr,
                    String.format(AURA_HARDCODED_SECRET_VIOLATION, attrName));
        }
    }
}
