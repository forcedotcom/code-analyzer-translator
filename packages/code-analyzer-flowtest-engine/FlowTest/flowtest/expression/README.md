# Flow Expression Parsing

This directory contains grammar for flow expressions and is used to generate the python parser. 

# Grammar Development

(optional: only needed if you will modifying the parser for flow expressions)

If you are using pycharm, you can install the antlr plugin directly in the IDE. 

Otherwise: 

Download antler https://www.antlr.org/download.html (currently on 4.11.1)

Put it where you store java libs and add it to your classpath, e.g.

```sudo cp ~/Downloads/antlr-4.11.1-complete.jar /usr/local/lib/```

add the line in your `.zshrc` (or other config file):
```export CLASSPATH=/usr/local/lib/antlr-4.11.1-complete.jar:$CLASSPATH```

(optional) add aliases
```alias antlr4='java -Xmx500M -cp "/usr/local/lib/antlr-4.11.1-complete.jar:$CLASSPATH" org.antlr.v4.Tool'

alias grun='java -Xmx500M -cp "/usr/local/lib/antlr-4.11.1-complete.jar:$CLASSPATH" org.antlr.v4.gui.TestRig'
```
Install python runtime

```pip install antlr4-python3-runtime```

