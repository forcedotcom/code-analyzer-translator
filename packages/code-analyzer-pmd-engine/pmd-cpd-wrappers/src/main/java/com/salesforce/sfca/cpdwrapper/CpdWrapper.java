package com.salesforce.sfca.cpdwrapper;

import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Arrays;
import java.util.Map;

import com.google.gson.Gson;

/**
 * Provides following commands:
 *   RUN:
 *     - Runs the rules provided by the input ruleset file on a set of files and writes results to a JSON file
 *     - Invocation: java -cp {classPath} com.salesforce.sfca.cpdwrapper.CpdWrapper run {argsInputFile} {resultsOutputFile}
 *         - {classPath} is the list of entries to add to the class path
 *         - {argsInputFile} is a JSON file containing the input arguments for the run command.
 *              Example:
 *                  {
 *                      "filesToScanPerLanguage": {
 *                          "apex": ["/full/path/to/apex_file1.cls", "/full/path/to/apex_file2.trigger", ...],
 *                          ...,
 *                          "xml": ["full/path/to/xml_file1.xml", "/full/path/to/xml_file2.xml", ...]
 *                      },
 *                      "minimumTokens": 100,
 *                      "skipDuplicateFiles": false
 *                  }
 *         - {resultsOutputFile} is a JSON file to write CPD results to.
 *             Example:
 *                 {
 *                     "apex": {
 *                         matches: [
 *                             {
 *                                 "numTokensInBlock": 18,
 *                                 "numNonemptyLinesInBlock": 5,
 *                                 "numBlocks": 2,
 *                                 "blockLocations": [
 *                                     {
 *                                         "file": "/full/path/to/file1.cls",
 *                                         "startLine": 1, "startCol": 1, "endLine": 5, "endCol": 2
 *                                     },
 *                                     {
 *                                         "file": "/full/path/to/file2.cls",
 *                                         "startLine": 18, "startCol": 6, "endLine": 22, "endCol": 8
 *                                     }
 *                                 ]
 *                             },
 *                             ...
 *                         ],
 *                         processingErrors: []
 *                     },
 *                     "xml": ...
 *                 }
 */
public class CpdWrapper {
    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();
        System.out.println("START OF CALL TO \"CpdWrapper\" WITH ARGUMENTS: " + String.join(" ", args));

        if (args.length == 0) {
            throw new RuntimeException("Missing arguments to CpdWrapper.");
        } else if(args[0].equalsIgnoreCase("run")) {
            invokeRunCommand(Arrays.copyOfRange(args, 1, args.length));
        } else {
            throw new RuntimeException("Bad first argument to CpdWrapper. Expected \"run\". Received: \"" + args[0] + "\"");
        }

        long endTime = System.currentTimeMillis();
        System.out.println("END OF CALL TO \"CpdWrapper\": " + (endTime - startTime) + " milliseconds");
    }

    private static void invokeRunCommand(String[] args) {
        if (args.length != 2) {
            throw new RuntimeException("Invalid number of arguments following the \"run\" command. Expected 2 but received: " + args.length);
        }
        String argsInputFile = args[0];
        String resultsOutputFile = args[1];

        Gson gson = new Gson();

        CpdRunInputData inputData;
        try (FileReader reader = new FileReader(argsInputFile)) {
            inputData = gson.fromJson(reader, CpdRunInputData.class);
        } catch (Exception e) {
            throw new RuntimeException("Could not read contents from \"" + argsInputFile + "\"", e);
        }

        CpdRunner cpdRunner = new CpdRunner();
        Map<String, CpdLanguageRunResults> results;
        try {
            results = cpdRunner.run(inputData);
        } catch (Exception e) {
            throw new RuntimeException("Error while attempting to invoke CpdRunner.run: " + e.getMessage(), e);
        }

        try (FileWriter fileWriter = new FileWriter(resultsOutputFile)) {
            gson.toJson(results, fileWriter);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}