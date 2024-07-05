import fs from "node:fs";
import path from "node:path";

export function calculateLongestCommonParentFolderOf(paths: string[]): string {
    const longestCommonStr: string = getLongestCommonPrefix(paths);
    return fs.existsSync(longestCommonStr) && fs.statSync(longestCommonStr).isDirectory() ?
        longestCommonStr : path.dirname(longestCommonStr);
}
function getLongestCommonPrefix(strs: string[]): string {
    // To find the longest common prefix, we first get the shortest string from our list of strings
    const shortestStr = strs.reduce((s1, s2) => s1.length <= s2.length ? s1 : s2);

    // Then we check that each string's ith character is the same as the shortest strings ith character
    for (let i = 0; i < shortestStr.length; i++) {
        if(!strs.every(str => str[i] === shortestStr[i])) {
            // If we find a string that doesn't match the ith character, we return the common prefix from [0,i)
            return shortestStr.substring(0, i)
        }
    }
    return shortestStr;
}

/**
 * Returns a copy of the string array but with duplicate entries removed while maintaining order of the original array.
 *   Note that we don't just return [... new Set(values)] because it doesn't maintain order.
 */
export function makeUnique(values: string[]): string[] {
    const result: string[] = [];
    const seen: Set<string> = new Set();
    for (const value of values) {
        if (!seen.has(value)) {
            result.push(value);
            seen.add(value);
        }
    }
    return result;
}