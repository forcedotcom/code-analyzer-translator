import os
from unittest import TestCase

import test.helper as helper
from flowtest.query_manager import QueryManager

dir_path = os.path.dirname(os.path.realpath(__file__))
query_path = os.path.join(dir_path, 'test_data', 'mock_default_query.py')
query_class = 'CustomQueryProcessor'
presets = ['custom_all', 'pentest']


class TestQueryManager(TestCase):
    def test_build(self):
        # We are not testing the constructor, but whether we are correctly loading
        # third party modules that meet the QueryProcessor interface, as the semantics
        # of this call have changed across python versions.
        qm = QueryManager.build(results=helper.DummyResult(), requested_preset=presets[0],
                                module_path=query_path, class_name=query_class,
                                parser='dummy parser')
        assert qm is not None
