const path = require('path');
const fs = require('fs');

function main() {
    const packagesToRelease = process.argv[2].split(" ");

    console.log('====== RUNNING update-versions-in-released-packages.js =======');
    if (packagesToRelease.length > 0) {
        displayList('RECEIVED THE FOLLOWING PACKAGE NAMES:', packagesToRelease);
    } else {
        console.log('RECEIVED NO PACKAGE NAMES');
        // If we received no package names, that indicates problem in the release process.
        process.exit(1);
    }

    const packageJsonsToRelease = getPackageJsons(packagesToRelease);

    const packageChangesMade = updatePackageVersionsAndDescribeChanges(packageJsonsToRelease);

    if (packageChangesMade.length > 0) {
        displayList('THE FOLLOWING VERSION CHANGES WERE MADE:', packageChangesMade);
        persistPackageJsons(packagesToRelease, packageJsonsToRelease);
    } else {
        console.log('NO PACKAGE.JSON CHANGES WERE MADE');
    }
}

function displayList(header, list) {
    console.log(header);
    for (const listItem of list) {
        console.log(`* ${listItem}`);
    }
    console.log('');
}

function getPackageJsons(packageNames) {
    return packageNames.map(getPackageJson);
}

function getPackageJson(packageName) {
    const packageJsonPath = path.join('packages', packageName, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
}

function updatePackageVersionsAndDescribeChanges(packageJsons) {
    const changeDescriptionList = [];
    for (const packageJson of packageJsons) {
        const packageName = packageJson.name;

        // The version has already been validated as ending in `-SNAPSHOT`, so just rip that many characters off the end.
        const oldVersion = packageJson.version;
        const newVersion = oldVersion.slice(0, oldVersion.length - `-SNAPSHOT`.length);
        packageJson.version = newVersion;

        changeDescriptionList.push(`${packageName} from ${oldVersion} to ${newVersion}`);
    }
    return changeDescriptionList;
}

function persistPackageJsons(packageNames, packageJsons) {
    packageNames.forEach((packageName, idx) => {
        const packageJson = packageJsons[idx];
        persistPackageJson(packageName, packageJson);
    });
}

function persistPackageJson(packageName, packageJson) {
    const packageJsonPath = path.join('packages', packageName, 'package.json');
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

main();