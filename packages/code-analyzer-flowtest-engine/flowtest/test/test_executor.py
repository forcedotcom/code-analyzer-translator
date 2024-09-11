from unittest import TestCase

import flowtest.executor as executor


class Test(TestCase):
    def setUp(self):
        self.input_cache = {"A_PATH": [["X_in", "X_out"], ["Y_in"]],
                            "B_PATH": [["Z_in"]],
                            "C_PATH": None}

    def test_add_inputs_to_call_cache(self):
        res = executor.call_carnac(self.input_cache, "X_in", subflow_path="A_PATH",
                                   outputs=None)
        assert res == "X_out"

    def test_add_inputs_to_call_cache_none_match(self):
        res = executor.call_carnac(self.input_cache, "Y_in", subflow_path="A_PATH",
                                   outputs=None)
        assert res is None

    def test_add_inputs_to_call_cache_none(self):
        res = executor.call_carnac(self.input_cache, "T_in", subflow_path="A_PATH",
                                   outputs=None)
        assert res is None

    def test_add_inputs_to_call_cache_no_path(self):
        res = executor.call_carnac(self.input_cache, "X_in", subflow_path="D_PATH",
                                   outputs=None)
        assert res is None

    def test_add_outputs_to_call_cache(self):
        res = executor.add_outputs_to_call_cache(self.input_cache, inputs="Y_in",
                                                 added="Y_out", flow_path="A_PATH")
        assert res['A_PATH'][1] == ['Y_in', 'Y_out']

    def test_add_outputs_to_call_cache_no_match(self):
        self.assertRaises(AssertionError, executor.add_outputs_to_call_cache, self.input_cache, inputs="Z_in",
                          added="Y_out", flow_path="A_PATH")
