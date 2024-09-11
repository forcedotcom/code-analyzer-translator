"""Helper utilities to be used in tests

"""
from __future__ import annotations

import os
import pkgutil
from dataclasses import dataclass

from lxml import etree as ET

import flow_parser.parse as parse
import flowtest.flows as flows
from flowtest.control_flow import Crawler
from public.data_obj import DataInfluenceStatement, DataInfluencePath, CrawlStep, BranchVisitor

A_PATH = "foo.flow-meta.xml"
B_PATH = "bar.flow-meta.xml"

ns = '{http://soap.sforce.com/2006/04/metadata}'
raw_ns = 'http://soap.sforce.com/2006/04/metadata'

EXAMPLE_FLOW = os.path.join('test_data', 'flows', 'Example_CreateLead.flow-meta.xml')
DELETE_FLOW = os.path.join('test_data', 'flows', 'delete_example.flow-meta.xml')
ASSIGN_FLOW = os.path.join('test_data', 'flows', 'assign_test.flow-meta.xml')
EXPRESSION_FLOW = os.path.join('test_data', 'flows', 'expression_example.flow-meta.xml')
LOOKUP_FLOW = os.path.join('test_data', 'flows', 'simpleContactEmailLookup.flow-meta.xml')
SUBFLOW_AUTO = os.path.join('test_data', 'flows', 'subflow_test1.flow-meta.xml')
SUBFLOW_MANUAL = os.path.join('test_data', 'flows', 'subflowtest2.flow-meta.xml')
CHILD_FLOW = os.path.join('test_data', 'flows', 'inner_subflow_example.flow-meta.xml')
NULL_FLOW = os.path.join('test_data', 'flows', 'null.flow-meta.xml')
NULL_DEFAULT = os.path.join('test_data', 'flows', 'null_user_or_system_mode.flow-meta.xml')
NULL_WITH_SHARING = os.path.join('test_data', 'flows', 'null_missing_sharing.flow-meta.xml')
COLLECTIONS1 = os.path.join('test_data', 'flows', 'collections_example1.flow-meta.xml')
AUTOLAUNCHED = os.path.join('test_data', 'flows', 'test_sharing_system_mode.flow-meta.xml')
RECORD_TRIGGERED = os.path.join('test_data', 'flows', 'record_triggered_flow_example.flow-meta.xml')


def get_parser(flow_path: str, dummy_file_path=A_PATH) -> ET.Element:
    byte_data = pkgutil.get_data(__name__, flow_path)
    return parse.Parser.from_string(byte_data, filepath_to_use=dummy_file_path)


def get_root(flow_path: str) -> ET.Element:
    byte_data = pkgutil.get_data(__name__, flow_path)
    return ET.fromstring(byte_data)  # fromstring returns the root


def build_simple_flow_elem(xml_str: str, el_tag: str = None, parser=False):
    """create flow xml element

    Args:
        parser: whether to return a parser
        xml_str: xml string to create (body of element or entire element)
        el_tag: Flow elem tag (optional)

    Returns:
        xml element
    """
    xml_str = xml_str.replace("\n", "")
    if el_tag is None:
        xml = f'<Flow xmlns="{raw_ns}">{xml_str}</Flow>'
    else:
        xml = f'<Flow xmlns="{raw_ns}"><{el_tag}><name>my_name</name>{xml_str}</{el_tag}></Flow>'

    root = ET.fromstring(xml)

    if el_tag is not None:
        el = root.find(f'{ns}{el_tag}')
        return el
    elif parser is False:
        for child in root:
            return child
    else:
        return parse.Parser.from_string(xml.encode(), 'A_Path'), root


def build_simple_branch_visitors():
    bvA = BranchVisitor(
        current_label="*",
        previous_label=None,
        token=None,
        history=((),)
    )
    bvB = BranchVisitor(
        current_label="B",
        previous_label="*",
        token=None,
        history=(("*", "B"),)
    )
    return [bvA, bvB]


def build_simple_crawl_schedule():
    bv_star, bv_B = build_simple_branch_visitors()
    return (CrawlStep(element_name="*",
                      step=0,
                      visitor=bv_star),
            CrawlStep(element_name="a",
                      step=1,
                      visitor=bv_star),
            CrawlStep(element_name="B",
                      step=2,
                      visitor=bv_B))


def build_simple_crawler():
    schedule = build_simple_crawl_schedule()
    return Crawler(
        crawl_schedule=schedule,
        total_steps=len(schedule),
        terminal_steps=schedule[2],
        history_maps={((),): schedule[1].visitor,
                      (("*", "B"),): schedule[2].visitor
                      },
    )


@dataclass
class DummyResult:
    preset: str = ''


class SimpleParser:
    # test harness
    flow_path = A_PATH
    my_type: parse.VariableType = parse.VariableType(tag="variables")
    xtra_xml: str = ''

    def resolve_by_name(self, name, **kwargs):
        splits = name.split(".")
        if len(splits) == 1:
            return splits[0], None, self.my_type
        else:
            return splits[0], ".".join(splits[1:]), self.my_type

    def get_by_name(self, name):
        return ET.fromstring(
            f'<variables xmlns="{raw_ns}"><name>{name}</name>{self.xtra_xml}<dataType>SObject</dataType></variables>')


class BadParser(SimpleParser):
    # test harness
    def resolve_by_name(self, name):
        if name == 'good_name':
            return super().resolve_by_name(name)
        else:
            return None

    def get_by_name(self, name):
        if name == 'good_name':
            return super().get_by_name(name)
        else:
            return None


def read_file(path: str) -> str:
    return pkgutil.get_data(__name__, path).decode()


def V(vec_dict: {}) -> flows.FlowVector:
    """builds a flow vector from the json string

    For testing, to rapidly create sample flow vectors
    sufficiently complex for thorough testing of flow surgeries.

    example of string::
            '{"A->B": {"s": ["G.w->A.s"], "x": ["C->A.x"]}, "B->B": null}'

    Notes:
        * must have no stars and only simple defaults::
            A->B is allowed, but A->B->C is not.
            A.x->B.y is allowed, but A.x ->B.y* is not
        * Use ``null`` instead of None as this will be json loaded

    Args:
        vec_dict: string in short_report format

    Returns:
        flow vector

    Raises:
        Assertion error if string conditions not satisfied
        JSONDecodeError if invalid string

    """

    vec_prop_maps = {}

    for curr_def, prop_map in vec_dict.items():
        curr_default = F(curr_def)

        if prop_map is None:
            vec_prop_maps[curr_default] = None

        else:
            for prop in prop_map:
                if prop_map[prop] is not None and len(prop_map[prop]) > 0:
                    prop_map[prop] = set([F(x) for x in prop_map[prop]])

            vec_prop_maps[curr_default] = prop_map

    return flows.FlowVector(property_maps=vec_prop_maps)


def F(arrow_str: str, src_path: str = A_PATH, tgt_path: str = A_PATH) -> flows.DataInfluencePath:
    splits = arrow_str.split('->')
    assert '*' not in arrow_str

    if len(splits) == 1:
        return flow(splits[0], splits[0], src_path=src_path, tgt_path=tgt_path)
    if len(splits) == 2:
        return flow(splits[0], splits[1], src_path=src_path, tgt_path=tgt_path)
    raise ValueError("only a single arrow is allowed")


def flow(x: str, y: str, src_path: str = A_PATH, tgt_path: str | None = None) -> flows.DataInfluencePath:
    if tgt_path is None:
        tgt_path = src_path
    x_splits = x.split('.')
    if len(x_splits) > 1:
        x_name = x_splits[0]
        x_member = '.'.join(x_splits[1:])
    else:
        x_name = x
        x_member = None

    y_splits = y.split('.')
    if len(y_splits) > 1:
        y_name = y_splits[0]
        y_member = '.'.join(y_splits[1:])
    else:
        y_name = y
        y_member = None

    return DataInfluencePath(history=(DataInfluenceStatement(
        influencer_var=x,
        influenced_var=y,
        element_name=f"foo",
        comment=f"autogen",
        line_no=1,
        source_text=f"<a>foo</a>",
        flow_path=src_path
    ),), influenced_name=y_name, influencer_name=x_name, influenced_property=y_member, influencer_property=x_member,
        influenced_type_info=parse.VariableType(tag="variables"), influenced_filepath=tgt_path,
        influencer_filepath=src_path
    )
