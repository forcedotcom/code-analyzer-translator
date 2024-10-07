// !!! IMPORTANT !!! KEEP THIS IN SYNC WITH gradle/libs.versions.toml
export const PMD_VERSION: string = '7.6.0';

// !!! IMPORTANT !!! KEEP THIS IN SYNC WITH gradle/libs.versions.toml
export enum PmdLanguage {
    APEX = 'apex',
    HTML = 'html',
    JAVA = 'java',
    JAVASCRIPT = 'ecmascript',
    VISUALFORCE = 'visualforce',
    XML = 'xml'
}

// The minimum required java version that users must have to run the 'pmd' engine
export const MINIMUM_JAVA_VERSION = '11.0.0';

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

// This object lists all the PMD rule names that are shared across languages which helps us map back and forth to unique names
export const SHARED_RULE_NAMES: Record<string, PmdLanguage[]> = {
    AssignmentInOperand: [PmdLanguage.JAVASCRIPT, PmdLanguage.JAVA],
    AvoidDeeplyNestedIfStmts: [PmdLanguage.APEX, PmdLanguage.JAVA],
    ClassNamingConventions: [PmdLanguage.APEX, PmdLanguage.JAVA],
    CognitiveComplexity: [PmdLanguage.APEX, PmdLanguage.JAVA],
    CyclomaticComplexity: [PmdLanguage.APEX, PmdLanguage.JAVA],
    EmptyCatchBlock: [PmdLanguage.APEX, PmdLanguage.JAVA],
    ExcessiveParameterList: [PmdLanguage.APEX, PmdLanguage.JAVA],
    ExcessivePublicCount: [PmdLanguage.APEX, PmdLanguage.JAVA],
    FieldNamingConventions: [PmdLanguage.APEX, PmdLanguage.JAVA],
    ForLoopsMustUseBraces: [PmdLanguage.APEX, PmdLanguage.JAVASCRIPT],
    FormalParameterNamingConventions: [PmdLanguage.APEX, PmdLanguage.JAVA],
    IfElseStmtsMustUseBraces: [PmdLanguage.APEX, PmdLanguage.JAVASCRIPT],
    IfStmtsMustUseBraces: [PmdLanguage.APEX, PmdLanguage.JAVASCRIPT],
    LocalVariableNamingConventions: [PmdLanguage.APEX, PmdLanguage.JAVA],
    MethodNamingConventions: [PmdLanguage.APEX, PmdLanguage.JAVA],
    MethodWithSameNameAsEnclosingClass: [PmdLanguage.APEX, PmdLanguage.JAVA],
    OneDeclarationPerLine: [PmdLanguage.APEX, PmdLanguage.JAVA],
    OverrideBothEqualsAndHashcode: [PmdLanguage.APEX, PmdLanguage.JAVA],
    TooManyFields: [PmdLanguage.APEX, PmdLanguage.JAVA],
    UnusedLocalVariable: [PmdLanguage.APEX, PmdLanguage.JAVA],
    WhileLoopsMustUseBraces: [PmdLanguage.APEX, PmdLanguage.JAVASCRIPT]
};