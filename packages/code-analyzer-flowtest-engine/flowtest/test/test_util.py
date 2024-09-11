import os
from unittest import TestCase

import flow_parser.parse
import flowtest.util as util

dir_path = os.path.dirname(os.path.realpath(__file__))


class Test(TestCase):
    def test_get_flows_in_dir(self):
        root_dir = os.path.join(dir_path, 'test_data', 'flows')
        res = util.get_flows_in_dir(root_dir)
        assert res is not None
        assert (res[('flows__Example_CreateLead', 'Example_CreateLead')]
                .endswith('test_data/flows/Example_CreateLead.flow-meta.xml'))
        assert (res[('flows__expression_example', 'expression_example')]
                .endswith('test_data/flows/expression_example.flow-meta.xml'))

    def test_get_effective_sharing(self):
        assert util.get_effective_run_mode(util.RunMode.SystemModeWithoutSharing,
                                           util.RunMode.DefaultMode) is util.RunMode.SystemModeWithoutSharing
        assert util.get_effective_run_mode(util.RunMode.SystemModeWithoutSharing,
                                           util.RunMode.SystemModeWithSharing) is util.RunMode.SystemModeWithSharing

    def test_propagate(self):
        old = flow_parser.parse.VariableType(tag='fields', object_name='foo')
        new = flow_parser.parse.VariableType(tag='recordCreates')
        v_type = util.propagate(old, new)
        assert v_type.object_name == 'foo'
        assert v_type.tag == 'recordCreates'

    def test_propagate_no_match(self):
        old = flow_parser.parse.VariableType(tag='fields', object_name='foo')
        new = flow_parser.parse.VariableType(tag='recordCreates', object_name='bar')
        v_type = util.propagate(old, new)
        assert v_type.object_name == 'bar'
        assert v_type.tag == 'recordCreates'

    def test_propagate_override(self):
        old = flow_parser.parse.VariableType(tag='fields', object_name='foo')
        new = flow_parser.parse.VariableType(tag='recordCreates', object_name='bar')
        v_type = util.propagate(old, new, object_name='baz')
        assert v_type.object_name == 'baz'
        assert v_type.tag == 'recordCreates'

    def test_resolve_name_namespace(self):
        tgt = os.path.join('bar', 'foo')
        all_flows = {('foo', 'bar__foo'): tgt}
        res = util.resolve_name(all_flow_paths=all_flows, sub_name='bar__foo')
        assert res == tgt

    def test_resolve_name_local(self):
        tgt = os.path.join('bar', 'foo')
        all_flows = {('foo', 'bar__foo'): tgt}
        res = util.resolve_name(all_flow_paths=all_flows, sub_name='foo')
        assert res == tgt

    def test_resolve_name_no_match(self):
        tgt = os.path.join('bar', 'foo')
        all_flows = {('foo', 'bar__foo'): tgt}
        res = util.resolve_name(all_flow_paths=all_flows, sub_name='baz')
        assert res is None





