function getSalesforceApiVersion(date: Date): number {
    // Salesforce releases 3 versions per year (Winter, Spring, Summer)
    const year = date.getFullYear();
    const month = date.getMonth();

    if (month >= 0 && month < 4) {
        return (year - 2004) * 3;
    } else if (month >= 4 && month < 8) {
        return (year - 2004) * 3 + 1;
    } else {
        return (year - 2004) * 3 + 2;
    }
}

function generateRegexStringForNumbersBelow(maxNumber: number): string {
    if (maxNumber < 0 || maxNumber > 99) {
        throw new Error("maxNumber must be between 0 and 99");
    }

    const decimalMatch: string = '\\.\\d';
    if (maxNumber < 10) {
        return `[0-${maxNumber}]${decimalMatch}`;
    }

    const tensDigit: number = Math.floor(maxNumber / 10);
    const unitsDigit: number = maxNumber % 10;

    const lessThanMaxTens: string = `[1-${tensDigit - 1}]\\d`;
    const lessThanMaxUnits: string = `${tensDigit}[0-${unitsDigit}]`;

    return `(${lessThanMaxTens}|${lessThanMaxUnits})${decimalMatch}`;
}

export function getDeprecatedApiVersionRegex(date: Date): string {
    const pastDate = new Date(date);
    pastDate.setFullYear(pastDate.getFullYear() - 3);
    const oldApiVersion = getSalesforceApiVersion(pastDate);
    return generateRegexStringForNumbersBelow(oldApiVersion);
}
