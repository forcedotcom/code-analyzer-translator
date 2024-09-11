"""Primary integration tests for __main__ entry point.

Does not test actual shell invocation, which is done in :mod:`functional_test`

"""
import os
import unittest
import flowtest.__main__

#: set this to true to scan the entire corpus, which takes 4-5 minutes
scan_all_samples = False
scan_slow = False

dir_path = os.path.dirname(os.path.realpath(__file__))


class MyTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        all_ = [os.path.join(dir_path, '..', 'test', 'test_data', 'flows'),
                os.path.join(dir_path, 'tmp_out', 'report_out.html'),
                os.path.join(dir_path, 'tmp_out', 'report_out.json'),
                os.path.join(dir_path, 'tmp_out', 'report_out.xml'),
                os.path.join(dir_path, 'tmp_out', 'my_log.log')]
        cls.flows_dir = all_[0]
        cls.html_out = all_[1]
        cls.json_out = all_[2]
        cls.xml_out = all_[3]
        cls.log_file = all_[4]
        cls.all = all_
        cls.test_flow = os.path.join(all_[0], 'Example_CreateLead.flow-meta.xml')
        cls.test_flow2 = os.path.join(all_[0], 'no_issues_sample.flow-meta.xml')

    def setUp(self) -> None:
        for path in self.all[1:]:
            if os.path.exists(path):
                os.remove(path)

    def tearDown(self) -> None:
        for path in self.all[1:]:
            if os.path.exists(path):
                os.remove(path)

    def test_cli_run_single(self):
        flowtest.__main__.main(['flowtest', '-f', self.test_flow, '--html', self.html_out, '--log_file', self.log_file])
        assert os.path.exists(self.html_out)

    def test_cli_run_single_no_issues(self):
        flowtest.__main__.main(
            ['flowtest', '-f', self.test_flow2, '--html', self.html_out, '--log_file', self.log_file])
        assert os.path.exists(self.html_out)

    def test_cli_run_single_json(self):
        flowtest.__main__.main(['flowtest', '-f', self.test_flow, '--json', self.json_out, '--log_file', self.log_file])
        assert os.path.exists(self.json_out)

    def test_cli_run_single_xml(self):
        flowtest.__main__.main(['flowtest', '-f', self.test_flow, '--xml', self.xml_out, '--log_file', self.log_file])
        assert os.path.exists(self.xml_out)

    def test_cli_set_debug(self):
        flowtest.__main__.main(['flowtest', '-f', self.test_flow, '--debug', '--json',
                                self.json_out, '--log_file', self.log_file])
        assert os.path.exists(self.json_out)

    def test_cli_run_dir_very_slow(self):
        if scan_all_samples is False:
            return
        flowtest.__main__.main(['flowtest', '-d', os.path.join(dir_path, 'test_data', 'corpus'),
                                '-t', self.html_out, '--json', self.json_out, '--log_file',
                                self.log_file])
        assert os.path.exists(self.json_out)
        assert os.path.exists(self.html_out)

    def test_cli_smaller_dir(self):
        # test to see we don't crash
        flowtest.__main__.main(['flowtest', '-d', os.path.join(dir_path, 'test_data', 'functional_data'),
                                '-t', self.html_out, '--json',
                                self.json_out, '--log_file', self.log_file])
        assert os.path.exists(self.json_out)
        assert os.path.exists(self.html_out)

    def test_gotos(self):
        if os.path.exists(self.html_out):
            os.remove(self.html_out)
        flowtest.__main__.main(['flowtest', '-f',
                                os.path.join(dir_path, 'test_data', 'corpus', 'meetabl', 'flows',
                                             'Meeting_Screen_Flow_Create_Meeting.flow'),
                                '--html', self.html_out, '--log_file', self.log_file])
        assert os.path.exists(self.html_out)

    def test_gotos2(self):
        if os.path.exists(self.html_out):
            os.remove(self.html_out)
        flowtest.__main__.main(['flowtest', '-f',
                                os.path.join(dir_path, 'test_data', 'corpus', 'meetabl',
                                             'flows', 'Meeting_Outcome_Screen_Flow_Create_Meeting_Outcome.flow'),
                                '--html', self.html_out, '--log_file', self.log_file])
        assert os.path.exists(self.html_out)

    def test_missing_subflow(self):
        if os.path.exists(self.html_out):
            os.remove(self.html_out)
        flowtest.__main__.main(['flowtest', '-f',
                                os.path.join(dir_path, 'test_data', 'corpus', 'engage_base',
                                             'src1', 'flows', 'BPC_HCPPortal_PortalRegistration.flow'),
                                '--html', self.html_out, '--log_file', self.log_file])
        assert os.path.exists(self.html_out)

    def test_slow_flow(self):
        if scan_slow is False:
            return
        if os.path.exists(self.html_out):
            os.remove(self.html_out)
        slow_flow = os.path.join(dir_path, 'test_data', 'corpus', 'appointed', 'src1', 'flows',
                                 'Onboarding_Flow-8.flow')
        flowtest.__main__.main(['flowtest', '-f', slow_flow,
                                '--html', self.html_out, '--log_file', self.log_file])

    def test_res_none_flow(self):
        flow = os.path.join(dir_path, 'test_data', 'corpus', 'project_lifecycle_pro', 'flows',
                            'Rollup_Program_Financials_When_Project_Membership_Changes.flow')

        flowtest.__main__.main(['flowtest', '-f', flow,
                                '--html', self.html_out, '--log_file', self.log_file])

    def test_carnac_prediction_flow(self):
        flow = os.path.join(dir_path, 'test_data/corpus/CoreFlowswithDirStructure/ui-service-setup-components'
                            , 'flows', 'sales_channel', 'slack_sales_DealRoom-1.flow')
        flowtest.__main__.main(['flowtest', '-f', flow,
                                '--html', self.html_out, '--log_file', self.log_file])

    def test_brb_subflow(self):
        flow = os.path.join(dir_path, 'test_data', 'corpus', 'CoreFlowswithDirStructure',
                            'ui-industries-lending-components', 'flows', 'runtime_industries_lending', 'Brw-1.flow')
        flowtest.__main__.main(['flowtest', '-f', flow,
                                '--html', self.html_out, '--log_file', self.log_file])


if __name__ == '__main__':
    unittest.main()
