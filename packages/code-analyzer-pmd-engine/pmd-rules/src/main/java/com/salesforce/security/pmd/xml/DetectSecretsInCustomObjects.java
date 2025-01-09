package com.salesforce.security.pmd.xml;

import net.sourceforge.pmd.lang.xml.ast.internal.XmlParserImpl.RootXmlNode;
import java.io.File;
import java.io.IOException;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;

import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import net.sourceforge.pmd.reporting.RuleContext;
import net.sourceforge.pmd.lang.ast.Node;
import net.sourceforge.pmd.lang.document.FileId;
import net.sourceforge.pmd.lang.rule.AbstractRule;
import org.xml.sax.SAXException;

import com.salesforce.security.pmd.utils.SecretsInPackageUtils;

public class DetectSecretsInCustomObjects extends AbstractRule {
     public static final String VISIBILITY_XPATH_EXPR = "/CustomObject/visibility[text()=\"Public\"]";
    public static final String PRIVACY_FIELD_XPATH_EXPR = "/CustomField/type[text()!=\"EncryptedText\"]";
    private static final String CUSTOM_SETTINGS_XPATH_EXPR = "/CustomObject/customSettingsType";

    @Override
    public void apply(Node target, RuleContext ctx) {
        FileId fId = target.getReportLocation().getFileId();
        String fieldFileName = fId.getAbsolutePath();
        if (!fieldFileName.endsWith(".field-meta.xml")) {
            return;
        }
        String fieldName = fieldNameFromFileName(fieldFileName);
        if (SecretsInPackageUtils.isAnAuthTokenField(fieldName)) {
            doObjectVisibilityCheck(ctx, target, fieldFileName);
        }
        if (SecretsInPackageUtils.isAnInsecurePrivacyField(fieldName)) {
            checkFieldType(ctx, target, fieldName);
        }
    }

    private void checkFieldType(RuleContext ctx, Node node, String fieldName) {
        RootXmlNode pmdRootNode = (RootXmlNode) node;
        Document xmlDoc = pmdRootNode.getNode();
        if (isXPathExpFoundInDocument(xmlDoc, PRIVACY_FIELD_XPATH_EXPR)) { //not an EncryptedText type
            ctx.addViolationWithMessage(pmdRootNode,
                    fieldName +" is a potential privacy field and is not an EncryptedText");
        }
    }

    private void doObjectVisibilityCheck(RuleContext ctx, Node pmdRootNode, String fieldFileName) {
        String fieldName = fieldNameFromFileName(fieldFileName);

        String objectFileName = getObjectFileName(fieldFileName);
        if (objectFileName == null) {
            return;
        }
        String objectName = objectNameFromFileName(objectFileName);

        if (objectName.endsWith("__mdt") || isCustomSettingsObject(objectFileName)) {
            if (isObjectVisibilityPublic(objectFileName)) {
                ctx.addViolationWithMessage(pmdRootNode, fieldName +
                        " is a potential auth token in the object: " +
                        objectName + " with public visibility");
            }
        } else if (objectName.endsWith("__c")) {
            ctx.addViolationWithMessage(pmdRootNode, fieldName +
                    " is a potential auth token in a custom object: " +
                    objectName);
        }
    }

    private boolean isCustomSettingsObject(String filename) {
        return isXPathExpFoundInDocument(filename, CUSTOM_SETTINGS_XPATH_EXPR);
    }

    private boolean isObjectVisibilityPublic(String filename) {
        return isXPathExpFoundInDocument(filename, VISIBILITY_XPATH_EXPR);
    }

    private boolean isXPathExpFoundInDocument(String filename, String customSettingsXpathExpr) {
        try {
            return isXPathExpFoundInDocument(parseDocument(filename), customSettingsXpathExpr);
        } catch (Exception e) {
            return false; //TBD: Handle the exception properly
        }
    }

    private boolean isXPathExpFoundInDocument(Document parsedXml, String customSettingsXpathExpr) {
        try {
            XPath xPath =  XPathFactory.newInstance().newXPath();
            NodeList nodeList = (NodeList)xPath
                    .compile(customSettingsXpathExpr)
                    .evaluate(parsedXml, XPathConstants.NODESET);

            return nodeList.getLength() > 0;
        }
        catch (Exception e) {
            return false; //TBD: Handle the exception properly
        }
    }

    private String getObjectFileName(String fieldFileName) {
        File fieldFile = new File(fieldFileName);
        try {
            File objectDirFile = fieldFile.getParentFile() //fields directory
                    .getParentFile(); //must be the objectName
            String objectNamePath = objectDirFile.getAbsolutePath();
            String objectName = objectDirFile.getName();
            String objectDefinitionFileName = objectName + ".object-meta.xml";
            return objectNamePath + File.separator + objectDefinitionFileName;
        }
        catch(Exception e) {
            return null; //TBD: Handle the exception properly
        }
    }

    private static Document parseDocument(String xmlFile) throws ParserConfigurationException, SAXException, IOException {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setExpandEntityReferences(false);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new File(xmlFile));
    }

    private static String fieldNameFromFileName(String fieldFileName) {
        return (new File(fieldFileName)).getName().replaceFirst(".field-meta.xml","");
    }

    private static String objectNameFromFileName(String objectFileName) {
        return (new File(objectFileName)).getName().replaceFirst(".object-meta.xml", "");
    }
}