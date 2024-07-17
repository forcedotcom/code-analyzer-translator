import os from "node:os";

export function getColumnNumber(charIndex: number, newlineIndexes: number[]): number {
    /*TODO: swap out findIndex for a modified binary search implementation */
    const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex)
    const idxOfCurrentLine = idxOfNextNewline === -1 ? newlineIndexes.length - 1: idxOfNextNewline - 1
    if (idxOfCurrentLine === 0){
        return charIndex + 1
    } else {
        const eolOffset = os.EOL.length - 1
        return charIndex - newlineIndexes.at(idxOfCurrentLine)! - eolOffset
    }
}

export function getLineNumber(charIndex: number, newlineIndexes: number[]): number{
    const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex)
    return idxOfNextNewline === -1 ? newlineIndexes.length : idxOfNextNewline;
}

export function getNewlineIndices(fileContents: string): number[] {
    const newlineRegex: RegExp = new RegExp(os.EOL, "g")
    const matches = fileContents.matchAll(newlineRegex);
    const newlineIndexes = [0]

    for (const match of matches) {
        newlineIndexes.push(match.index);
    }
    return newlineIndexes
}