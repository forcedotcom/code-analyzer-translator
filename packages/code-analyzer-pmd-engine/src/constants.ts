// !!! IMPORTANT !!! KEEP THIS IN SYNC WITH gradle/libs.versions.toml
export const PMD_VERSION: string = '7.5.0';

// !!! IMPORTANT !!! KEEP THIS IN SYNC WITH gradle/libs.versions.toml
export enum PmdLanguage {
    APEX = 'apex',
    HTML = 'html',
    JAVA = 'java',
    JAVASCRIPT = 'ecmascript',
    VISUALFORCE = 'visualforce',
    XML = 'xml'
}

// Map from file extension to language for PMD.
// Note in the future we might consider getting this dynamically from our PmdWrapper (java side) instead of hard coding these.
export const extensionToPmdLanguage: Record<string, PmdLanguage> = {
    // (Apex - 'apex') Language Model: https://github.com/pmd/pmd/blob/master/pmd-apex/src/main/java/net/sourceforge/pmd/lang/apex/ApexLanguageModule.java
    '.cls': PmdLanguage.APEX,
    '.trigger': PmdLanguage.APEX,

    // (Java - 'java') Language Model: https://github.com/pmd/pmd/blob/master/pmd-java/src/main/java/net/sourceforge/pmd/lang/java/JavaLanguageModule.java
    '.java': PmdLanguage.JAVA,

    // (JavaScript - 'ecmascript') Language Model: https://github.com/pmd/pmd/blob/master/pmd-javascript/src/main/java/net/sourceforge/pmd/lang/ecmascript/EcmascriptLanguageModule.java
    '.js': PmdLanguage.JAVASCRIPT,

    // (HTML - 'html') Language Model: https://github.com/pmd/pmd/blob/master/pmd-html/src/main/java/net/sourceforge/pmd/lang/html/HtmlLanguageModule.java
    '.html': PmdLanguage.HTML,
    '.htm': PmdLanguage.HTML,
    '.xhtml': PmdLanguage.HTML,
    '.xht': PmdLanguage.HTML,
    '.shtml': PmdLanguage.HTML,

    // (Salesforce Visualforce - 'visualforce') Language Model: https://github.com/pmd/pmd/blob/master/pmd-visualforce/src/main/java/net/sourceforge/pmd/lang/visualforce/VfLanguageModule.java
    '.page': PmdLanguage.VISUALFORCE,
    '.component': PmdLanguage.VISUALFORCE,

    // (XML - 'xml') Language Model: https://github.com/pmd/pmd/blob/master/pmd-xml/src/main/java/net/sourceforge/pmd/lang/xml/XmlLanguageModule.java
    '.xml': PmdLanguage.XML
} as const;