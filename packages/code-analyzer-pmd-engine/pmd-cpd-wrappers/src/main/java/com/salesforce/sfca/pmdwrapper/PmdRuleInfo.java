package com.salesforce.sfca.pmdwrapper;

import java.util.ArrayList;
import java.util.List;

class PmdRuleInfo {
    public String name;
    public String languageId;
    public String description;
    public String externalInfoUrl;
    public List<String> ruleSets = new ArrayList<>();
    public String priority;
    public String ruleSetFile;
}