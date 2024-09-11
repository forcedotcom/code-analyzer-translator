import os
import unittest

import flowtest.util as util
import public.parse_utils as parse_utils

dir_path = os.path.dirname(os.path.realpath(__file__))


class MyTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        corpus_dir = os.path.join(dir_path, 'test_data', 'corpus')
        cls.corpus_dir = corpus_dir
        cls.all_flows = util.get_flows_in_dir(corpus_dir)
        cls.ET = parse_utils.ET

    def test_all_subflow_resolution(self):
        for labels, path_ in self.all_flows.items():
            root = self.ET.parse(path_).getroot()
            subflow_elems = parse_utils.get_by_tag(root, 'subflows')
            if len(subflow_elems) == 0:
                continue
            for el in subflow_elems:
                sub_name = parse_utils.get_subflow_name(el)
                target = util.resolve_name(self.all_flows, sub_name)

                # Two of the files in the corpus are missing subflow targets
                missing = ['OCE__OCEPortalCreateRegistrationRecords', 'runtime_industries_lending__BrwSub']
                if sub_name not in missing:
                    assert target is not None


if __name__ == '__main__':
    unittest.main()
