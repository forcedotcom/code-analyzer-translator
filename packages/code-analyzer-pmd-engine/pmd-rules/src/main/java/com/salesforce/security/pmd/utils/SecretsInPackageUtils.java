package com.salesforce.security.pmd.utils;

import java.util.List;

public class SecretsInPackageUtils {
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

    private static final List<String> POTENTIAL_SECERT_VARS_LIST = List.of(
            "APIKEY",
            "API_KEY",
            "API-KEY",
            "PASSWORD",
            "PASSWD",
            "ENCRYPT",
            "TOKEN",
            "HASH",
            "SECRET",
            "SIGNATURE",
            "AUTHN",
            "AUTHZ",
            "OAUTH",
            "AUTHORIZATION",
            "AUTHENTICATION",
            "AUTHENTICATE",
            "BEARER",
            "CREDS", //cred - has too many false +ve hits, credential(s),
            "CREDENTIAL",
            "REFRESHTOKEN",
            "REFRESH_TOKEN",
            "CERT",
            "PRIVATE",
            "SYMMETRICKEY",
            "SYMMETRIC_KEY",
            "ASYMMETRIC_KEY",
            "ASYMMETRICKEY",
            "JWT",
            "SALT",
            "COOKIE",
            "SESSIONID",
            "SESSION_ID",
            "CREDITCARD",
            "CREDIT_CARD"
    );

    private static boolean isAPartialMatchInList(String inputStr, List<String> listOfStrings) {
        String inputStrUpper = inputStr.toUpperCase();
        for (String eachStr : listOfStrings) {
            if (inputStrUpper.contains(eachStr)) {
                return true;
            }
        }
        return false;
    }

    public static boolean isAnAuthTokenField(String fieldName) {
        return isAPartialMatchInList(fieldName.toUpperCase(), AUTH_FIELD_MAPPINGS_LIST);
    }

    public static boolean isAnInsecurePrivacyField(String fieldName) {
        return isAPartialMatchInList(fieldName.toUpperCase(), PRIVACY_FIELD_MAPPINGS_LIST);
    }

    public static boolean isAPotentialSecret(String attrName) {
        return isAPartialMatchInList(attrName, POTENTIAL_SECERT_VARS_LIST );
    }
}
