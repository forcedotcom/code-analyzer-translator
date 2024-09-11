"""test default queries to confirm issues are found.

    Any changes to these results without changes to queries
    are serious, as they mean customers get different results.

"""
import json
import os
import unittest
import flowtest.__main__

dir_path = os.path.dirname(os.path.realpath(__file__))


all_ = [os.path.join(dir_path, '..', 'test', 'test_data', 'flows'),
        os.path.join(dir_path, 'tmp_out', 'report_out.html'),
        os.path.join(dir_path, 'tmp_out', 'report_out.json'),
        os.path.join(dir_path, 'tmp_out', 'report_out.xml'),
        os.path.join(dir_path, 'tmp_out', 'my_log.log')]


def do_scan(flow_name: str):
    flow_path = os.path.join(all_[0], flow_name + '.flow-meta.xml')
    flowtest.__main__.main(['flowtest', '-f', flow_path, '--json', all_[2], '--log_file', all_[4]])
    with open(all_[2], 'r') as fp:
        res = json.load(fp)
    results = res['results']
    to_return = {}

    for result in results:
        query_name = result
        to_return[query_name] = set()
        for q_res in results[result]:
            field = q_res['field']
            path = tuple([x['element_name'] for x in q_res['flow']])
            to_return[query_name].add((field, path))

    return to_return


class MyTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls) -> None:
        cls.flows_dir = all_[0]
        cls.html_out = all_[1]
        cls.json_out = all_[2]
        cls.xml_out = all_[3]
        cls.log_file = all_[4]
        cls.all = all_

    def setUp(self) -> None:
        for path in self.all[1:]:
            if os.path.exists(path):
                os.remove(path)

    def tearDown(self) -> None:
        for path in self.all[1:]:
            if os.path.exists(path):
                os.remove(path)

    def test_subflow_auto(self):
        res = do_scan('subflow_test1')
        assert len(res) == 2
        # Check we can detect vulns from parent to child flow
        assert res['FlowSecurity.SystemModeWithoutSharing.recordCreates.data'] == {
            ('SuppliedName', ('input_text', 'assign_input_to_var', 'call_subflow', 'create_case')),
            ('AccountId', ('input_text', 'assign_input_to_var', 'call_subflow', 'create_case'))
        }
        # Check we can detect vulns from child flow to parent
        assert res['FlowSecurity.SystemModeWithoutSharing.recordLookups.selector'] == {
            ('SuppliedName', ('enter_text_subflow', 'combine_vars',
                              'assign_enter_to_output', 'call_subflow', 'get_records'))
        }

    def test_subflow_manual(self):
        # should be same as subflow auto
        res = do_scan('subflowtest2')
        assert len(res) == 2
        # Check we can detect vulns from parent to child flow
        assert res['FlowSecurity.SystemModeWithoutSharing.recordCreates.data'] == {
            ('SuppliedName', ('input_text', 'assign_input_to_var', 'call_subflow', 'create_case')),
            ('AccountId', ('input_text', 'assign_input_to_var', 'call_subflow', 'create_case'))
        }
        # Check we can detect vulns from child flow to parent
        assert res['FlowSecurity.SystemModeWithoutSharing.recordLookups.selector'] == {
            ('SuppliedName', ('enter_text_subflow', 'combine_vars',
                              'assign_enter_to_output', 'call_subflow', 'get_records'))
        }

    def test_assign_test(self):
        """This flow enters input text 'enter_text' and applies
        several formulas/templates, and then searches for get records

        Name <- var1 <- formula1 <- enter text
        Name <- var1 <- formula1 <- enter text
        Name <- var2 <- template2 <- var1 <- formula1 <- enter text
        Name <- var4 <- enter text
        Name <- var3 <- formula3 <- formula1 + var2 <- enter text (2 ways)
        """
        res = do_scan('assign_test')
        assert len(res) == 1  # only a single query
        assert res['FlowSecurity.SystemModeWithoutSharing.recordLookups.selector'] == {
            ('Name', ('Enter_text', 'formula1', 'formula3', 'assign_input1', 'get_records1')),
            ('Name', ('Enter_text', 'formula1', 'get_records1')),
            ('Name', ('Enter_text', 'formula1', 'assign_input1', 'get_records1')),
            ('Name', ('Enter_text', 'assign_input1', 'get_records1')),
            ('Name', ('Enter_text', 'formula1', 'assign_input1', 'template2',
                      'assign_input1', 'get_records1')),
            ('Name', ('Enter_text', 'formula1', 'assign_input1', 'template2',
                      'assign_input1', 'formula3', 'assign_input1', 'get_records1'))
        }


if __name__ == '__main__':
    unittest.main()
