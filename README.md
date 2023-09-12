<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# Code Analyzer Translator

## Introduction
Code Analyzer Translator is a GitHub Action plugin that can help convert [Code Analyzer](https://forcedotcom.github.io/sfdx-scanner/)’s results into a GitHub-friendly format. It takes JSON-format `outfile` from Code Analyzer (generated using `--outfile <filename.json>`) and renders markdown output that can be viewed from GitHub Action’s summary page.

## Prerequisites

1. Code Analyzer should’ve already been executed.
2. Code Analyzer’s results should be in JSON format specifically using the parameters --outfile <filename.json>. JSON generated using --json *will not work*.
3. Resulting json file is uploaded as an artifact using GitHub’s [action/upload-artifact](https://github.com/actions/upload-artifact).
4. The name and the path value used while uploading the artifact should be available to pass as parameters.

## Usage

Code Analyzer Translator is best used when combined with Code Analyzer Action plugin. The invocations can be ordered as below:

```yaml
    - name: Execute Code Analyzer
      id: execute-code-analyzer
      uses: forcedotcom/code-analyzer-action
        with:
          runtype: dfa
          projectdir: "force-app/main/default"

    - name: Render results as markdown
      if: always()
      uses: forcedotcom/code-analyzer-translator
        with:
          runtype: "dfa"
          outfile-artifact-name: "${{ steps.execute-code-analyzer.outputs.artifact-name }}"
          outfile-artifact-path: "${{ steps.execute-code-analyzer.outputs.artifact-path }}"
          code-analyzer-exit-code: "${{ steps.execute-code-analyzer.outputs.exit-code }}"
```

If you prefer to execute Code Analyzer with custom steps in your workflow, make sure you precede the invocation of Code Analyzer Translator with Code Analyzer execution and Artifact upload steps as shown below:

```yaml
          - name: Execute Code Analyzer
            run: |
              sfdx scanner:run --target <files> --outfile "sfca_results.json"
            shell: bash
            continue-on-error: true
          - name: Upload JSON output
            uses: actions/upload-artifact@v3
              with:
                name: "SFCA-Results"
                path: "sfca_results.json"
          - name: Render results as markdown
            if: always()
            uses: forcedotcom/code-analyzer-translator
            with:
              runtype: "dfa"
              outfile-artifact-name: "SFCA-Results"
              outfile-artifact-path: "sfca_results.json"
```

You can refer to tdx23-sfca-demo to see this GitHub Action’s usage and output.

## Parameters

### `outfile-artifact-name`
*Default value:* "SFCA-Results"

Artifact name that was used while uploading the JSON outfile using [action/upload-artifact](https://github.com/actions/upload-artifact).

### `outfile-artifact-path`
*Default value:* "sfca_results.json"

Path value used while uploading the JSON outfile as an artifact with [action/upload-artifact](https://github.com/actions/upload-artifact).

### `runtype`
*Default value:* "simple"

Denotes the type of run Code Analyzer was executed with to collect the results to be translated. If `scanner:run` command was used, set parameter to "simple". If `scanner:run:dfa` command was used, set parameter to "dfa".

### `code-analyzer-exit-code`
*Default value:* none

Exit code that was returned from Code Analyzer’s execution. If available, helps with rendering more useful summary.

## Development
Code Analyzer Translator has been developed using Typescript. `action.yml` file in the home directory defines the input parameters. Typescript action is defined under `src` directory, where `src/main.ts` is the starting point.

### Build steps

> Make sure you have Node LTS installed.

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run package
```

Run the tests :heavy_check_mark:  
```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)

...
```

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ npm run package
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin releases/v1
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket: 

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

