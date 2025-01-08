import java.awt.Desktop

plugins {
    // plugin to build java code
    java

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
    implementation(libs.gson)
    implementation(libs.slf4j.nop) // Note, dots map to dashes. So this maps to libraries > slf4j-nop

    // --- TEST ONLY DEPENDENCIES -----------------------------------------------
    testImplementation(libs.hamcrest)
    testImplementation(libs.junit.jupiter) // Maps to junit-jupiter
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// TEMPORARY - FOR SOME REASON WHEN UPGRADING TO PMD 7.9.0, THE TRANSITIVE DEPENDENCY:
//    io.github.apex-dev-tools:apex-parser
// IS GETTING PULLED IN AS 4.3.1 INSTEAD OF THE LISTED 4.3.0 AND IT SEEMS TO HAVE A BUG: A MISSING DEPENDENCY LISTED.
// SO WE SHOULD FORCE 4.3.0 TO GET PULLED IN INSTEAD UNTIL THIS IS FIXED.
// See https://github.com/pmd/pmd/issues/5456
// TODO: As soon as the pmd folks fix this ^... we should remove this workaround:
configurations.all {
    resolutionStrategy {
        force("io.github.apex-dev-tools:apex-parser:4.3.0")
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}

// Directories of interest
val javaLibDir: File = layout.projectDirectory.dir("../dist/java-lib").asFile;
val reportsDir: String = layout.buildDirectory.dir("reports").get().asFile.path


// ======== BUILD RELATED TASKS ========================================================================================

// Task to build and copy jar file, giving it the name "sfca-pmd-cpd-wrappers-1.0.0.jar"
tasks.jar {
    archiveBaseName.set("sfca-pmd-cpd-wrappers")
    archiveVersion.set("1.0.0")
    destinationDirectory.set(javaLibDir) // Default location for JAR output
}
// Task to copy the runtime dependencies (and make this task run on build)
tasks.register<Copy>("copyDependencies") {
    from(configurations.runtimeClasspath) // This includes all runtime dependencies
    into(javaLibDir) // Target directory for dependencies
}
tasks.build {
    dependsOn("copyDependencies") // Ensure dependencies are copied during the build process
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
}
// The jacocoTestReport and jacocoTestCoverageVerification tasks must be run separately from the test task
// Otherwise, running a single test from the IDE will trigger this verification.
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
tasks.register<Delete>("deleteJavaLibDir") {
    delete(javaLibDir)
}
tasks.named("clean") {
    dependsOn("deleteJavaLibDir")
}