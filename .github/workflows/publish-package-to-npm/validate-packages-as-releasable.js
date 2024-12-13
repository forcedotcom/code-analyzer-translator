const path = require('path');
const fs = require('fs');

function main() {
    const packagesToRelease = process.argv[2].split(' ');

    console.log('====== RUNNING validate-packages-as-releasable.js =======');
    if (packagesToRelease.length === 0) {
        console.log('Error: No packages selected for release');
        process.exit(1);
    }

    displayList('THE FOLLOWING PACKAGES ARE SELECTED FOR RELEASE:', packagesToRelease);

    const unreleasablePackages = identifyUnreleasablePackages(packagesToRelease);

    if (unreleasablePackages.length > 0) {
        displayList('THE FOLLOWING PACKAGES CANNOT BE RELEASED IN THEIR CURRENT STATE:', unreleasablePackages);
        process.exit(1);
    } else {
        console.log('ALL PACKAGES ARE VALIDATED AS RELEASABLE');
        process.exit(0);
    }
}

function displayList(header, list) {
    console.log(header);
    for (const listItem of list) {
        console.log(`* ${listItem}`);
    }
    console.log('\n');
}

function identifyUnreleasablePackages(packagesToRelease) {
    const unreleasablePackages = [];
    for (const packageToRelease of packagesToRelease) {
        const packageVersion = getPackageVersion(packageToRelease);
        if (!packageVersion.endsWith('-SNAPSHOT')) {
            unreleasablePackages.push(`${packageToRelease} (currently versioned as ${packageVersion}) lacks a trailing '-SNAPSHOT'`);
        }
    }
    return unreleasablePackages;
}

function getPackageVersion(packageToRelease) {
    const packageJsonPath = path.join('packages', packageToRelease, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version;
}

main();