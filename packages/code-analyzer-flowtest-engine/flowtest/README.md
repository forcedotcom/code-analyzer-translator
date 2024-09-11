# Flowtest

Flowtest is a static analysis tool for Salesforce Flows. It is a CLI application that crawls flows, performs dataflow analysis, and generates security and coding practice 
reports.

## Why Flowtest exists
The need for this tool became apparent when we reviewed communities as part of the Vaccine effort. There, we saw
a number of vulnerable flows, for example System Mode flows that were exposed to communities that accepted a user input
as an ID and then deleted the record with this Id. 

At the same time, one problem with analyzing or auditing flows was that flow xml files are difficult for 
security auditors to read and understand. Flows effectively hide their source code. Neither are the collections
of bubbles and arrows in FlowBuilder amenable to code auditing at scale. Flows are much less readable than code.

At the same time, there is no existing security tooling for flows, and the target audience for flows are 
administrators and other non-software professionals, which means many flows will be difficult to decipher.

Moreover, flows are widely used in communities and public pages. 

Finally, flows do not have adequate security best practices published, neither are there any security functions
such as `isAccessible` made available to flow developers to allow them to secure their flows.

The combination of all of these factors means that there is a great need to rapidly scan flows for security issues,
as well as to provide feedback to partners so that they can be warned when an input variable can be a selector for
something like record deletes, or when user data can modify existing records in an org, even if they don't belong
to the user.

At a minimum, this is true in the Appexchange review, but tools like this should be made available to developers and
partners as well.

## Installation

This tool requires Python 3.10 (or later). It's recommended to 
create a [virtual environment](https://docs.python.org/3/library/venv.html)
with a controlled python version and to run the tool inside the virtual environment. 

Once a proper runtime is installed and activated, clone the repo, and  in the top level directory execute either
```
pip3 install .
```

or if you want to work on development, run the `install.sh` script that executes

```
pip3 install -e .
```

This will create an executable `flowtest` in your python binaries folder (make sure this folder is in your path, usually
the executable is placed into `venv/bin/flowtest`).

Once installed, you can scan all the flows in the current directory (or its children) via the commandline:

```
flowtest --html $html_report_path
```

where `$html_report_path` is the filename of the html report.

You can also generate json reports:

```
flowtest --json $json_report_path
```

... or multiple formats at once:

```
flowtest --json $path1 --xml $path2 --html $path3
```

To scan a different directory on your filesystem:

```
flowtest -d $my_dir --html $report_path
```

to scan a single flow:

```
flowtest -f $my_flow_path --json $report_path
```

Flowtest has many other options, including loading custom queries.
Use `flowtest -h` to get command help and consult the [product documentation](#product-documentation)

Please report all false positives, false negatives, feature requests or errors as issues in this repo.

## Development

* Developer documentation is available at the project wiki: 

[https://git.soma.salesforce.com/SecurityTools/FlowSecurityLinter/wiki](https://git.soma.salesforce.com/SecurityTools/FlowSecurityLinter/wiki)

* Join the Slack channel: #flowtest

## Product Documentation

* Tool documentation is available in the generated sphinx files, under `docs/`

* Clone the repo and then open `docs/index.html` in your browser.





