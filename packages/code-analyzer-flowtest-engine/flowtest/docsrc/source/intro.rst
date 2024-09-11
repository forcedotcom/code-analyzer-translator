
Problem Addressed
-----------------
Auditing no-code/low-code software is a time consuming process, as each flow needs to be opened
in the Flow Builder, and then each flow element needs to be double-clicked on
to examine what it is doing, and then collection variables need to be traced back
to Flow Elements that populate them, and each of these steps require more double-clicks
to open and inspect even the names of globals that are being reassigned or modified in
each Flow Element.

Over time, an organization or package may accumulate a large number of flows, each of
which are effectively blackboxes that can (and often do) run in System Mode.
This creates the need for a fast and accurate tool to audit this code.

For example, we'd like to know:

* Which objects are modified by each flow? And which fields?
* Which objects/fields are modified by user input?
* Which objects/fields are modified by user input for flows running in SystemMode?
* Is a user allowed to decide which flow should be deleted, updated, or retrieved?
* Does the flow reference a variable before it is initialized (for example in a faultConnector)?
* Does the flow reference a variable after it has been freed (e.g. a loop variable
  outside the loop)?

How it works
------------

Flow Builder automates this task by consuming metadata API or DeveloperDX code directories
containing flows, symbolically executing each flow in the directory (including following
subflows) and then generating an html report consolidating all findings for all flows, with
details provided for deeper inspection if desired.

Moreover, the Flow Security Tester supports running custom queries that you can write
in python that will be executed during the symbolic analysis.

