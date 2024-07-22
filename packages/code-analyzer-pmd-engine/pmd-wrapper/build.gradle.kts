import java.awt.Desktop

plugins {
    // Apply the application plugin to add support for building a CLI application in Java.
    application

    // Code coverage plugin
    jacoco

    // This is a very useful utility for displaying the gradle task dependency tree
    //   Usage: ./gradlew <task 1>...<task N> taskTree
    //   Example Usage: ./gradlew build taskTree
    id("com.dorongold.task-tree") version "4.0.0"
}

repositories {
    mavenCentral()
}

// These dependencies use our version catalog. Versions are listed in the ../gradle/libs.versions.toml file.
// See https://docs.gradle.org/current/userguide/platforms.html#sub::toml-dependencies-format
dependencies {
    // --- APPLICATION DEPENDENCIES ---------------------------------------------
    implementation(libs.bundles.pmd7)
    implementation(libs.slf4j.nop) // Note, dots map to dashes. So this maps to libraries > slf4j-nop

    // --- TEST ONLY DEPENDENCIES -----------------------------------------------
    testImplementation(libs.hamcrest)
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(11)
    }
}

application {
    mainClass = "com.salesforce.sfca.pmdwrapper.PmdWrapper"
}


// Directories of interest
val pmdWrapperDistDir: String = layout.projectDirectory.dir("../dist/pmd-wrapper").asFile.path;
val reportsDir: String = layout.buildDirectory.dir("reports").get().asFile.path


// ======== ASSEMBLE RELATED TASKS =====================================================================================
// During assemble, we don't need to create a zip or a tar, so we disable these
tasks.distZip {
    // Disabled distZip from running but doesn't remove it from the task dependency tree (since we can't)
    enabled = false
}
tasks.distTar {
    // Disabled distTar from running but doesn't remove it from the task dependency tree (since we can't)
    enabled = false
}
// During assemble, we want to run the installDist task (which comes from the distribution plugin which comes from the application plugin)
// instead ... but first we need to modify the location where the jar files should be placed.
tasks.installDist {
    into(pmdWrapperDistDir)
    includeEmptyDirs = false
}
tasks.assemble {
    dependsOn(tasks.installDist)
}


// ======== TEST RELATED TASKS =========================================================================================
jacoco {
    toolVersion = "0.8.11"
}
tasks.test {
    // Use JUnit 5 for unit tests.
    useJUnitPlatform()

    testLogging {
        events("passed", "skipped", "failed")
        showStandardStreams = true
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }

    // Report is always generated after other test tasks
    finalizedBy(tasks.jacocoTestReport);
    finalizedBy(tasks.jacocoTestCoverageVerification)
}
tasks.jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = BigDecimal("0.80")
            }
        }
    }
}
tasks.register("showCoverageReport") {
    group = "verification"
    dependsOn(tasks.jacocoTestReport)
    doLast {
        Desktop.getDesktop().browse(File("$reportsDir/jacoco/test/html/index.html").toURI())
    }
}


// ======== CLEAN RELATED TASKS ========================================================================================
tasks.register<Delete>("deletePmdWrapperFromDist") {
    delete(pmdWrapperDistDir)
}
tasks.named("clean") {
    dependsOn("deletePmdWrapperFromDist")
}