package com.salesforce.security.pmd.xml;

import net.sourceforge.pmd.lang.xml.ast.internal.XmlParserImpl.RootXmlNode;
import java.io.File;
import java.io.IOException;
import java.util.List;
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

public class DetectSecretsInCustomObjects extends AbstractRule {
    private static final List<String> PRIVACY_FIELD_MAPPINGS_LIST = List.of(
            "SSN",
            "SOCIALSECURITY",
            "SOCIAL_SECURITY",
            "NATIONALID",
            "NATIONAL_ID",
            "NATIONAL_IDENTIFIER",
            "NATIONALIDENTIFIER",
            "DRIVERSLICENSE",
            "DRIVERS_LICENSE",
            "DRIVER_LICENSE",
            "DRIVERLICENSE",
            "PASSPORT",
            "AADHAAR",
            "AADHAR" //More?
    );

    private static final List<String> AUTH_FIELD_MAPPINGS_LIST = List.of(
            "KEY", // potentially high false +ve rate
            "ACCESS",
            "PASS",
            "ENCRYPT",
            "TOKEN",
            "HASH",
            "SECRET",
            "SIGNATURE",
            "SIGN",
            "AUTH", //AUTHORIZATION,AUTHENTICATION,AUTHENTICATE,OAUTH
            "AUTHORIZATION",
            "AUTHENTICATION",
            "AUTHENTICATE",
            "BEARER",
            "CRED", //cred, credential(s),
            "REFRESH", //
            "CERT",
            "PRIVATE",
            "PUBLIC",
            "JWT"
    );

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
        if (isAnAuthTokenField(fieldName)) {
            doObjectVisibilityCheck(ctx, target, fieldFileName);
        }
        if (isAnInsecurePrivacyField(fieldName)) {
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

    public boolean isAnAuthTokenField(String fieldName) {
        return isAPartialMatchInList(fieldName.toUpperCase(), AUTH_FIELD_MAPPINGS_LIST);
    }

    public boolean isAnInsecurePrivacyField(String fieldName) {
        return isAPartialMatchInList(fieldName.toUpperCase(), PRIVACY_FIELD_MAPPINGS_LIST);
    }


    private static boolean isAPartialMatchInList(String inputStr, List<String> listOfStrings) {
        String inputStrUpper = inputStr.toUpperCase();
        for (String eachStr : listOfStrings) {
            if (inputStrUpper.contains(eachStr)) {
                return true;
            }
        }
        return false;
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