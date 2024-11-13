// !!! IMPORTANT !!! KEEP THIS IN SYNC WITH gradle/libs.versions.toml
export const PMD_VERSION: string = '7.7.0';

export const PMD_ENGINE_NAME: string = "pmd";
export const CPD_ENGINE_NAME: string = "cpd";

// !!! IMPORTANT !!! KEEP THIS IN SYNC WITH gradle/libs.versions.toml
export enum LanguageId {
    APEX = 'apex', // [CPD+PMD]
    HTML = 'html', // [CPD+PMD]
    JAVASCRIPT = 'javascript', // [CPD+PMD] Note that this id gets converted to 'ecmascript' when communicating to PMD since it uses 'ecmascript' instead as the identifier
    TYPESCRIPT = 'typescript', // [CPD only - No PMD support] Note that TSLanguageModule is defined within the pmd-javascript jar file so no additional jar to add in here.
    VISUALFORCE = 'visualforce', // [CPD+PMD]
    XML = 'xml' // [CPD+PMD]
}

// The minimum required java version that users must have to run the 'pmd' engine
export const MINIMUM_JAVA_VERSION = '11.0.0';

// Map from file extension to language for PMD or CPD.
//   In the future we might consider getting this dynamically from our PmdWrapper (java side) instead of hard coding
//   these, but hard coding actually makes things much faster so that we have one less round trip to java to perform.
export const extensionToLanguageId: Record<string, LanguageId> = {
    // (Apex - 'apex') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-apex/src/main/java/net/sourceforge/pmd/lang/apex/ApexLanguageModule.java
    '.cls': LanguageId.APEX,
    '.trigger': LanguageId.APEX,

    // (JavaScript - 'ecmascript') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-javascript/src/main/java/net/sourceforge/pmd/lang/ecmascript/EcmascriptLanguageModule.java
    '.js': LanguageId.JAVASCRIPT,

    // (HTML - 'html') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-html/src/main/java/net/sourceforge/pmd/lang/html/HtmlLanguageModule.java
    '.html': LanguageId.HTML,
    '.htm': LanguageId.HTML,
    '.xhtml': LanguageId.HTML,
    '.xht': LanguageId.HTML,
    '.shtml': LanguageId.HTML,

    // (Salesforce Visualforce - 'visualforce') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-visualforce/src/main/java/net/sourceforge/pmd/lang/visualforce/VfLanguageModule.java
    '.page': LanguageId.VISUALFORCE,
    '.component': LanguageId.VISUALFORCE,

    // (Typescript - 'typescript') Language Module [CPD Only - No PMD Support]: https://github.com/pmd/pmd/blob/master/pmd-javascript/src/main/java/net/sourceforge/pmd/lang/typescript/TsLanguageModule.java
    '.ts': LanguageId.TYPESCRIPT,

    // (XML - 'xml') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-xml/src/main/java/net/sourceforge/pmd/lang/xml/XmlLanguageModule.java
    '.xml': LanguageId.XML
} as const;

// This object lists all the PMD rule names that are shared across languages which helps us map back and forth to unique names
export const SHARED_RULE_NAMES: Record<string, LanguageId[]> = {
    ForLoopsMustUseBraces: [LanguageId.APEX, LanguageId.JAVASCRIPT],
    IfElseStmtsMustUseBraces: [LanguageId.APEX, LanguageId.JAVASCRIPT],
    IfStmtsMustUseBraces: [LanguageId.APEX, LanguageId.JAVASCRIPT],
    WhileLoopsMustUseBraces: [LanguageId.APEX, LanguageId.JAVASCRIPT]
};