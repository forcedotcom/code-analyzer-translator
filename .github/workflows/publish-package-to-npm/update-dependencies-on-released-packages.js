const path = require('path');
const fs = require('fs');

function main() {
    const packagesToRelease = process.argv[2].split(" ");
    const allPackages = process.argv[3].split("\n");

    const packageJsonsToRelease = getPackageJsons(packagesToRelease);
    const allPackageJsons = getPackageJsons(allPackages);

    const packageChangesMade = updatePackageDependenciesAndDescribeChanges(packageJsonsToRelease, allPackageJsons);
    if (packageChangesMade.size > 0) {
        displayMapOfLists('THE FOLLOWING DEPENDENCY CHANGES WERE MADE CHANGES WERE MADE:', packageChangesMade);
        persistPackageJsons(allPackages, allPackageJsons);
    } else {
        console.log('NO PACKAGE.JSON CHANGES WERE MADE');
    }
}

function displayMapOfLists(header, mapOfLists) {
    console.log(header);
    for (const [key, innerList] of mapOfLists.entries()) {
        console.log(`IN ${key}:`);
        for (const innerListItem of innerList) {
            console.log(`- ${innerListItem}`);
        }
        console.log('');
    }
    console.log('\n');
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