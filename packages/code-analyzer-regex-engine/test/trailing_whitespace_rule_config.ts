export const TRAILING_WHITESPACE_RULE_NAME: string = "NoTrailingWhitespace"
export const TRAILING_WHITESPACE_RULE_DESCRIPTION: string ="Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace."
export const TRAILING_WHITESPACE_RESOURCE_URLS: string[] = []
export const TRAILING_WHITESPACE_REGEX = new RegExp('[ \\t]+((?=\\r?\\n)|(?=$))', 'g')
export const TRAILING_WHITESPACE_RULE_FILE_EXTENSIONS: string[] = [".cls"]