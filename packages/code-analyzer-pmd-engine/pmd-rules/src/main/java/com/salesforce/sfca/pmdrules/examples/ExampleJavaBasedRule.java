package com.salesforce.sfca.pmdrules.examples;

import net.sourceforge.pmd.lang.apex.ast.ASTVariableDeclaration;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;

/**
 * Implementation of ExampleJavaBasedRule which reports a violation if a variable with name "foo" is found.
 */
public class ExampleJavaBasedRule extends AbstractApexRule {

    @Override
    public Object visit(ASTVariableDeclaration node, Object data) {
        if (node.getImage().equals("foo")) {
            asCtx(data).addViolation(node, node.getImage());
        }
        return data;
    }
}
