package com.salesforce.sfca.pmdwrapper;

import com.google.gson.Gson;

import java.io.FileWriter;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Provides following commands:
 *   DESCRIBE:
 *     - Describes the available PMD rules by writing a list of PmdRuleInfo objects to a JSON file
 *     - Invocation: java -cp {classPath} describe {outputFile} {languages}
 *        - {classPath} is the list of entries to add to the class path
 *        - {outputFile} file to write the array of PmdRuleInfo objects to in JSON format
 *        - {languages} comma separated list of languages associated with the rules to describe
 *   RUN:
 *     - COMING SOON ...
 */
public class PmdWrapper {
    private PmdWrapper() {}

    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();
        System.out.println("START OF CALL TO \"PmdWrapper\" WITH ARGUMENTS: " + String.join(" ", args));

        if (args.length == 0) {
            throw new RuntimeException("Missing arguments to PmdWrapper.");
        } else if(args[0].equalsIgnoreCase("describe")) {
            invokeDescribeCommand(args);
        } else {
            throw new RuntimeException("Bad first argument to PmdWrapper. Expected \"describe\" or \"run\". Received: \"" + args[0] + "\"");
        }

        long endTime = System.currentTimeMillis();
        System.out.println("END OF CALL TO \"PmdWrapper\": " + (endTime - startTime) + " milliseconds");
    }

    private static void invokeDescribeCommand(String[] args) {
        if (args.length != 3) {
            throw new RuntimeException("Invalid number of arguments following the \"describe\" command. Expected 2 but received: " + (args.length - 1));
        }
        String outFile = args[1];
        Set<String> languages = Arrays.stream(args[2].toLowerCase().split(",")).collect(Collectors.toSet());

        PmdRuleDescriber ruleDescriber = new PmdRuleDescriber();
        List<PmdRuleInfo> pmdRuleInfoList = ruleDescriber.describeRulesFor(languages);

        Gson gson = new Gson();
        try (FileWriter fileWriter = new FileWriter(outFile)) {
            gson.toJson(pmdRuleInfoList, fileWriter);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}