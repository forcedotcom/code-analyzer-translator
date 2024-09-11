"""Integration test for shell CLI invocation.

It can often happen that relative modules are loaded that the executable
can't find but which work well in an IDE during unit testing, so
run this to verify exit codes, file system read/writes and module imports
are working properly in the finished executable.

"""
import os
import unittest
import subprocess
import json
from flowtest.version import __version__

dir_path = os.path.dirname(os.path.realpath(__file__))

py_version = 'venv3.12'
executable_path = os.path.join(dir_path, '..', py_version, 'bin', 'flowtest')


def command(args: [str]) -> str:
    to_run = [executable_path] + args
    result = subprocess.run(to_run, stdout=subprocess.PIPE, check=True)
    return result.stdout.decode()


class MyTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls) -> None:
        cls.flow_dir = os.path.join(dir_path, 'test_data', 'functional_data')
        cls.single_flow = os.path.join(dir_path, 'test_data', 'functional_data', 'assign_test.flow-meta.xml')

    def setUp(self):
        self.html_out = os.path.abspath(os.path.join(dir_path, 'tmp_out', 'html_out.html'))
        self.xml_out = os.path.abspath(os.path.join(dir_path, 'tmp_out', 'xml_out.xml'))
        self.json_out = os.path.abspath(os.path.join(dir_path, 'tmp_out', 'json_out.json'))
        self.log_file = os.path.abspath(os.path.join(dir_path, 'tmp_out', 'log_file.log'))
        for path in [self.xml_out, self.json_out, self.html_out, self.log_file]:
            if os.path.exists(path):
                os.remove(path)

    def tearDown(self) -> None:
        for path in [self.xml_out, self.json_out, self.html_out, self.log_file]:
            if os.path.exists(path):
                os.remove(path)

    def test_help(self):
        result = command(['-h'])
        assert 'usage: flowtest [-h]' in result

    def test_version(self):
        result = command(['-v'])
        assert f'flowtest {__version__}' in result

    def test_reports(self):
        result = command(['--html', self.html_out, '--xml', self.xml_out, '--json', self.json_out,
                          '-d', self.flow_dir, '--log_file', self.log_file])
        assert result is not None
        assert "found 5 flows to scan" in result
        assert "scanning complete" in result
        assert os.path.exists(self.html_out)
        assert os.path.exists(self.xml_out)
        assert os.path.exists(self.json_out)

        with open(self.json_out, 'r') as fp:
            res = json.load(fp)
        assert res is not None
        assert res['preset'] == 'All'
        assert len(res['results']) > 0

    def test_single_flow(self):
        result = command(['--html', self.html_out, '--xml', self.xml_out, '--json', self.json_out,
                          '-f', self.single_flow, '--log_file', self.log_file])
        assert f"scanning the single flow:" in result
        assert "scanning complete." in result

    def test_no_dir(self):
        curr_dir = os.getcwd()
        os.chdir(self.flow_dir)
        if os.path.exists(self.html_out):
            os.remove(self.html_out)

        result = command(['--html', self.html_out, '--log_file', self.log_file])
        assert 'found 5 flows to scan' in result

        # clean up, since we are in a different directory
        assert os.path.exists(self.html_out)
        os.remove(self.html_out)
        if os.path.exists(self.log_file):
            os.remove(self.log_file)
        os.chdir(curr_dir)


