import fs from "node:fs";
import path from "node:path";

/**
 * Returns the longest common parent folder of the provided paths.
 *
 * @param paths It is assumed that paths is a non-empty array of absolute value paths.
 * If empty or if no common parent folder exists (like in the case on Windows machines of using two different drives
 * C: and D:) then null is returned (to allow the client of this function to handle this case without needing try/catch)
 */
export function calculateLongestCommonParentFolderOf(paths: string[]): string | null {
    if (paths.length === 0) {
        return null;
    }
    const longestCommonStr: string = getLongestCommonPrefix(paths);
    if (longestCommonStr.length === 0) {
        return null;
    }
    if (longestCommonStr.length > 1 && longestCommonStr.endsWith(path.sep)) {
        return longestCommonStr.slice(0, longestCommonStr.length - 1);
    }
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
 */
export function makeUnique(values: string[]): string[] {
    // It turns out that spread operator on a Set actually maintains the order in which elements are added to the set.
    // See https://exploringjs.com/js/book/ch_sets.html#:~:text=As%20you%20can%20see%2C%20Sets,in%20which%20they%20were%20added.
    return [...new Set(values)];
}