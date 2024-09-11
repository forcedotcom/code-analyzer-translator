import os
import unittest
import flowtest.__main__ as main

FLOW_NAME = 'expression_example.flow-meta.xml'
dir_path = os.path.dirname(os.path.realpath(__file__))
FLOW_PATH = os.path.join(dir_path, 'test_data', 'flows', FLOW_NAME)

class MyTestCase(unittest.TestCase):
    def test_parser(self):
        args = main.parse_args(["command",
                                "--flow", FLOW_PATH,
                                "--xml", "foo",
                                "--id", "my_id"
                                ])
        assert args.flow is not None
        assert args.xml is not None
        assert args.id is not None
