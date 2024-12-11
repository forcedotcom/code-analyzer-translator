// !!! IMPORTANT !!! KEEP THIS IN SYNC WITH gradle/libs.versions.toml
export const PMD_VERSION: string = '7.8.0';

export const PMD_ENGINE_NAME: string = "pmd";
export const CPD_ENGINE_NAME: string = "cpd";

// The minimum required java version that users must have to run the 'pmd' engine
export const MINIMUM_JAVA_VERSION = '11.0.0';

// !!! IMPORTANT !!! KEEP THIS LIST OF LANGUAGES IN SYNC WITH gradle/libs.versions.toml
export enum Language {
    APEX = 'apex', // [CPD+PMD]
    HTML = 'html', // [CPD+PMD]
    JAVASCRIPT = 'javascript', // [CPD+PMD] Note that this id gets converted to 'ecmascript' when communicating to PMD since it uses 'ecmascript' instead as the identifier
    TYPESCRIPT = 'typescript', // [CPD only - No PMD support] Note that TSLanguageModule is defined within the pmd-javascript jar file so no additional jar to add in here.
    VISUALFORCE = 'visualforce', // [CPD+PMD]
    XML = 'xml' // [CPD+PMD]
}

// Default map from language to file extensions to be associated with that language
//   Even though we force the file extensions per language to give us full control over the file extensions, minimally
//   we should support the default file associations found in the language model definitions:
//    * Apex ('apex') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-apex/src/main/java/net/sourceforge/pmd/lang/apex/ApexLanguageModule.java
//    * HTML ('html') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-html/src/main/java/net/sourceforge/pmd/lang/html/HtmlLanguageModule.java
//    * JavaScript ('ecmascript') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-javascript/src/main/java/net/sourceforge/pmd/lang/ecmascript/EcmascriptLanguageModule.java
//    * Typescript ('typescript') Language Module [CPD Only - No PMD Support]: https://github.com/pmd/pmd/blob/master/pmd-javascript/src/main/java/net/sourceforge/pmd/lang/typescript/TsLanguageModule.java
//    * Visualforce ('visualforce') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-visualforce/src/main/java/net/sourceforge/pmd/lang/visualforce/VfLanguageModule.java
//    * XML ('xml') Language Model [CPD+PMD]: https://github.com/pmd/pmd/blob/master/pmd-xml/src/main/java/net/sourceforge/pmd/lang/xml/XmlLanguageModule.java
//   Additionally, we must support the file extensions that the AppExchange rules want to also process per language.
export const DEFAULT_FILE_EXTENSIONS: Record<Language, string[]> = {
    [Language.APEX]: [
        // From PMD's ApexLanguageModule:
        '.cls', '.trigger'
    ],

    [Language.HTML]: [
        // From PMD's HtmlLanguageModule:
        '.html', '.htm', '.xhtml', '.xht', '.shtml'
    ],

    [Language.JAVASCRIPT]: [
        // From PMD's EcmascriptLanguageModule:
        '.js',

        // Other common JavasScript file extensions that we wish to include by default:
        '.cjs', '.mjs'
    ],

    [Language.TYPESCRIPT]: [
        // From PMD's TsLanguageModule:
        '.ts'
    ],

    [Language.VISUALFORCE]: [
        // FROM PMD's VfLanguageModule:
        '.page', '.component'
    ],

    [Language.XML]: [
        // FROM PMD's XmlLanguageModule:
        '.xml'

        // Salesforce metadata file extensions to associate to XML language, specifically for the AppExchange rules:
        // TODO: COMING SOON
    ]
}

// This object lists all the PMD rule names that are shared across languages which helps us map back and forth to unique names
export const SHARED_RULE_NAMES: Record<string, Language[]> = {
    ForLoopsMustUseBraces: [Language.APEX, Language.JAVASCRIPT],
    IfElseStmtsMustUseBraces: [Language.APEX, Language.JAVASCRIPT],
    IfStmtsMustUseBraces: [Language.APEX, Language.JAVASCRIPT],
    WhileLoopsMustUseBraces: [Language.APEX, Language.JAVASCRIPT]
};