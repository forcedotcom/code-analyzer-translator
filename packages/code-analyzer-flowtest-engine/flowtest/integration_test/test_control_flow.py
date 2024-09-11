import json
import os
import unittest
from collections.abc import Generator

import flow_parser.parse as parse
import flowtest.control_flow as crawl_spec
from flowtest.control_flow import ControlFlowGraph, CrawlEncoder
from flowtest.util import get_flows_in_dir

dir_path = os.path.dirname(os.path.realpath(__file__))


class MyTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        scan_dir = os.path.join(dir_path, 'test_data')
        flow_map = get_flows_in_dir(scan_dir)
        cls.scan_dir = scan_dir
        cls.flow_maps = flow_map
        reverse = {}
        for x, y in flow_map.items():
            reverse[y] = x[0]
        cls.path_to_name = reverse

    def test_control_flow_graph(self):
        for flow_path in self.flow_maps.values():
            print(f"generating control flow graph for {flow_path}")
            parser = parse.Parser.from_file(flow_path)
            cfg = ControlFlowGraph.from_parser(parser)
            with open(os.path.join(dir_path, 'crawl_data', f"{self.path_to_name[flow_path]}_cfg.json"), 'w') as fp:
                crawl_spec.dump_cfg(cfg, fp)
            valid = crawl_spec.validate_cfg(cfg, parser=parser)
            assert valid is True

    def test_single_cfg(self):
        # for investigation
        flow_path = os.path.join(dir_path, 'test_data', 'corpus', 'the_go_to_market_platform', 'src1',
                                 'flows', 'Add_Tags_to_Win_Loss-3.flow')
        parser = parse.Parser.from_file(flow_path)
        cfg = ControlFlowGraph.from_parser(parser)
        valid = crawl_spec.validate_cfg(cfg, parser=parser)
        assert valid is True

    def test_single_crawl(self):
        flow_path = os.path.join(
            dir_path, 'test_data', 'corpus', 'xsell_rewards', 'flows',
            'XSELL_Sample_De_Ingestion_of_Records.flow')
        parser = parse.Parser.from_file(flow_path)
        cfg = ControlFlowGraph.from_parser(parser)
        visits = crawl_spec._get_crawl_visits(cfg)
        missed, missing_inbound, report = crawl_spec.get_visits_statistics(visit_map=visits, cfg=cfg)
        print(report)
        assert len(missed) == 0
        assert len(missing_inbound) == 0

    def test_all_crawls(self):
        for flow_path in self.flow_maps.values():
            print(f"generating control flow graph for {flow_path}")
            parser = parse.Parser.from_file(flow_path)
            cfg = ControlFlowGraph.from_parser(parser)
            visits = crawl_spec._get_crawl_visits(cfg)
            missed, missing_inbound, report = crawl_spec.get_visits_statistics(visit_map=visits, cfg=cfg)
            print(report)
            assert len(missed) == 0
            assert len(missing_inbound) == 0

    def test_crawl_iter(self):
        flow_path = os.path.join(
            dir_path, 'test_data', 'corpus', 'the_go_to_market_platform',
            'src1', 'flows', 'Add_Tags_to_Win_Loss-3.flow')
        parser = parse.Parser.from_file(flow_path)
        cfg = ControlFlowGraph.from_parser(parser)
        gen = crawl_spec.crawl_iter(cfg)
        assert isinstance(gen, Generator)

    def test_get_all_crawl_schedules(self):
        for flow_path in self.flow_maps.values():
            print(f"generating crawl_schedule for {flow_path}")
            parser = parse.Parser.from_file(flow_path)
            cfg = ControlFlowGraph.from_parser(parser)
            schedule = crawl_spec.get_crawl_schedule(cfg)
            assert schedule is not None
            with open(os.path.join(dir_path, 'crawl_data', f"{self.path_to_name[flow_path]}_crawl_schedule.json"),
                      'w') as fp:
                json.dump(schedule, fp, cls=CrawlEncoder, indent=4)

    def test_get_single_crawl_schedule(self):
        # has a startElementReference
        flow_path = os.path.join(
            dir_path, 'test_data', 'corpus', 'the_go_to_market_platform', 'src1', 'flows',
            'Add_Tags_to_Win_Loss-3.flow')
        my_parser = parse.Parser.from_file(flow_path)
        cfg = ControlFlowGraph.from_parser(my_parser)
        schedule = crawl_spec.get_crawl_schedule(cfg)
        assert schedule is not None
        with open(os.path.join(dir_path, 'crawl_data', f"{self.path_to_name[flow_path]}_crawl_schedule.json"),
                  'w') as fp:
            json.dump(schedule, fp, cls=CrawlEncoder, indent=4)


if __name__ == '__main__':
    unittest.main()
