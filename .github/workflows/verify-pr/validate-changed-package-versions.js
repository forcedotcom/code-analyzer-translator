const path = require('path');
const fs = require('fs');

function main() {
    const changedFiles = process.argv[2].split('\n');
    if (changedFiles.length === 0) {
        console.log('No changed files; no verification needed');
        process.exit(0);
    }

    displayList('THE FOLLOWING FILES WERE CHANGED:', changedFiles);

    const changedPackages = identifyChangedPackages(changedFiles);

    if (changedPackages.length === 0) {
        console.log('No changed packages; no verification needed');
        process.exit(0);
    }

    displayList('THE FOLLOWING PACKAGES HAVE CHANGED FILES:', changedPackages);

    const incorrectlyVersionedPackages = identifyIncorrectlyVersionedPackages(changedPackages);

    if (incorrectlyVersionedPackages.length > 0) {
        displayList('PROBLEM: SOME PACKAGES ARE INCORRECTLY VERSIONED:', incorrectlyVersionedPackages);
        process.exit(1);
    } else {
        console.log('ALL CHANGED PACKAGES ARE APPROPRIATELY VERSIONED');
        process.exit(0);
    }
}

function displayList(header, list) {
    console.log(header);
    for (const listItem of list) {
        console.log(`* ${listItem}`);
    }
    console.log('');
}

function identifyChangedPackages(changedFiles) {
    const changedPackages = new Set();

    for (const changedFile of changedFiles) {
        const changedPackage = convertFileNameToPackageNameIfPossible(changedFile);
        if (changedPackage) {
            changedPackages.add(changedPackage);
        }
    }

    return [...changedPackages.keys()];
}

function convertFileNameToPackageNameIfPossible(changedFile) {
    const changedFilePathSegments = changedFile.split('/');
    if (changedFilePathSegments.length < 2 || changedFilePathSegments[0] !== 'packages') {
        return null;
    } else {
        return path.join(changedFilePathSegments[0], changedFilePathSegments[1]);
    }
}

function identifyIncorrectlyVersionedPackages(changedPackages) {
    const incorrectlyVersionedPackages = [];
    for (const changedPackage of changedPackages) {
        const packageVersion = getPackageVersion(changedPackage);
        if (!packageVersion.endsWith('-SNAPSHOT')) {
            incorrectlyVersionedPackages.push(`${changedPackage} (currently versioned as ${packageVersion}) lacks a trailing "-SNAPSHOT"`);
        }
    }
    return incorrectlyVersionedPackages;
}


function getPackageVersion(changedPackage) {
    const packageJsonPath = path.join(changedPackage, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version;
}

main();