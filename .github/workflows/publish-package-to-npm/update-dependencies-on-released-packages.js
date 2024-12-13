const path = require('path');
const fs = require('fs');

function main() {
    const packagesToRelease = process.argv[2].split(" ");

    console.log('====== RUNNING update-dependencies-on-released-packages.js =======');
    if (packagesToRelease.length > 0) {
        displayList('THESE PACKAGES ARE BEING RELEASED:', packagesToRelease);
    } else {
        console.log('NO PACKAGES ARE BEING RELEASED. THAT SEEMS INCORRECT.');
        // If we received no package names, that indicates problem in the release process.
        process.exit(1);
    }

    // Split on `\n` instead of ` ` because this argument comes from $(ls).
    const allPackages = process.argv[3].split("\n");

    if (allPackages.length > 0) {
        displayList('WILL CHECK DEPENDENCIES IN THESE PACKAGES:', allPackages);
    } else {
        console.log('NO PACKAGES TO CHECK FOR DEPENDENCIES. THAT SEEMS INCORRECT.');
        process.exit(1);
    }

    const packageJsonsToRelease = getPackageJsons(packagesToRelease);
    const allPackageJsons = getPackageJsons(allPackages);

    const packageChangesMade = updatePackageDependenciesAndDescribeChanges(packageJsonsToRelease, allPackageJsons);
    if (packageChangesMade.size > 0) {
        displayMapOfLists('THE FOLLOWING DEPENDENCY CHANGES WERE MADE:', packageChangesMade);
        persistPackageJsons(allPackages, allPackageJsons);
    } else {
        console.log('NO PACKAGE.JSON CHANGES WERE MADE');
    }
}

function displayMapOfLists(header, mapOfLists) {
    console.log(header);
    for (const [key, innerList] of mapOfLists.entries()) {
        displayList(`IN ${key}:`, innerList);
    }
    console.log('\n');
}

function displayList(header, list) {
    console.log(header);
    for (const item of list) {
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

function updatePackageDependenciesAndDescribeChanges(packagesToRelease, allPackages) {
    const changeDescriptionMap = new Map();
    for (const potentialDependency of packagesToRelease) {
        const dependencyName = potentialDependency.name;
        const dependencyVersion = potentialDependency.version;
        for (const potentiallyDependentPackage of allPackages) {
            const potentiallyDependentPackageName = potentiallyDependentPackage.name;
            const dependedUponVersion = potentiallyDependentPackage.dependencies[dependencyName];
            if (dependedUponVersion != null) {
                potentiallyDependentPackage.dependencies[dependencyName] = dependencyVersion;
                const changeDescriptionArray = changeDescriptionMap.get(potentiallyDependentPackageName) || [];
                changeDescriptionArray.push(`${dependencyName}@${dependedUponVersion} -> ${dependencyName}@${dependencyVersion}`);
                changeDescriptionMap.set(potentiallyDependentPackageName, changeDescriptionArray);
            }
        }
    }
    return changeDescriptionMap;
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