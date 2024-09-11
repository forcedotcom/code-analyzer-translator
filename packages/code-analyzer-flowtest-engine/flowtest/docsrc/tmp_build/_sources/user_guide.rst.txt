===========
User Guide
===========

Installation
------------

This tool requires Python 3.10 (or later). It's recommended to
create a [virtual environment](https://docs.python.org/3/library/venv.html)
with a controlled python version and to run the tool inside the virtual environment.

Once a proper runtime is installed and activated, clone the repo, and  in the top level directory execute either::

    pip3 install .


or if you want to work on development, run the `install.sh` script that executes::

    pip3 install -e .


This will create an executable `flowtest` in your python binaries folder (make sure this folder is in your path).


Usage
-----

To scan all the flows in the current directory (or its children)::

    flowtest --html $html_report_path


where `$html_report_path` is the filename of the html report.

You can also generate json reports::

    flowtest --json $json_report_path


or multiple formats at once::

    flowtest --json $path1 --xml $path2 --html $path3

To scan a different directory on your filesystem::

    flowtest -d $my_dir --html $report_path


to scan a single flow::

    flowtest -f $my_flow_path --json $report_path


Flowtest has many other options, including loading custom queries.
Use `flowtest -h` to get command help.

Please report all false positives, false negatives, feature requests or errors as issues in this repo.
