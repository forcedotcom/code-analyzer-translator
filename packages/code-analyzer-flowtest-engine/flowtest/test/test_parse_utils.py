"""Low level parser for Flow XML format.

    Notes:

        * operators for assignmentItems: Assign, Add,

        * operators for filters: Contains, Add, IsNull, StartsWith,
          EndsWith, EqualTo, LessThanOrEqualTo, GreaterThanOrEqualTo

        * datatypes available for formulas, templates, variables, fields, constants, choices, recordChoiceSets

    `   * object names available for recordLookups and <start> elem in triggers

        * isInput/isOutput available for variables only

"""
from unittest import TestCase

from test.helper import get_parser, build_simple_flow_elem
from public import parse_utils
from public.enums import DataType
from public.parse_utils import ET
from test import helper


class Test(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.parser = get_parser(helper.EXAMPLE_FLOW)  # also without sharing
        cls.expr_parser = get_parser(helper.ASSIGN_FLOW)  # also without sharing
        cls.subflow_parser = get_parser(helper.SUBFLOW_AUTO)
        cls.null_parser = get_parser(helper.NULL_FLOW)
        cls.subflow1_parent_parser = get_parser(helper.SUBFLOW_AUTO)
        cls.subflow2_parent_parser = get_parser(helper.SUBFLOW_MANUAL)

    def test_parse_expression(self):
        tst1 = 'A{!A.bar__c.zoom}+CASE({!$foo.bar}) + IF({!val},{!baz},"2")'
        res = parse_utils.parse_expression(tst1)
        assert res == ['A.bar__c.zoom', '$foo.bar', 'val', 'baz']

    def test_parse_expression__null_handling(self):
        tst2 = 'foobar'  # check if no matches, it returns None
        res = parse_utils.parse_expression(tst2)
        assert res == []

    def test_get_tag(self):
        parser = self.expr_parser
        assert parse_utils.get_tag(parser.all_named_elems[0]) == 'assignments'

    def test_get_tag_start(self):
        start = self.expr_parser.get_start_elem()
        assert parse_utils.get_tag(start) == 'start'

    def test_is_subflow(self):
        parser = self.subflow_parser
        found = False
        for x in parser.all_named_elems:
            if parse_utils.get_tag(x) != 'subflows':
                assert parse_utils.is_subflow(x) is False
            else:
                assert parse_utils.is_subflow(x) is True
                found = True
        assert found is True

    def test_is_loop(self):
        parser = self.parser
        assert parser is not None
        assert parse_utils.is_loop(parser.all_named_elems[7]) is True
        assert parse_utils.is_loop(parser.all_named_elems[8]) is False

    def test_get_by_tag__no_results(self):
        res = parse_utils.get_by_tag(self.expr_parser.root, 'filters')
        assert len(res) == 0  # because these are not top level

    def test_get_by_tag__top_level(self):
        res = parse_utils.get_by_tag(self.expr_parser.root, 'recordLookups')
        assert len(res) == 1

    def test_is_goto_connector(self):
        xml_str = f'<Flow xmlns="{helper.raw_ns}"><foo><connector><isGoTo>true</isGoTo></connector></foo></Flow>'
        y = ET.fromstring(xml_str)
        conn = y.find(f'.//{helper.ns}connector')
        assert parse_utils.is_goto_connector(conn) is True

    def test_is_goto_connector_null(self):
        xml_str = f'<Flow xmlns="{helper.raw_ns}"><foo>some text</foo></Flow>'
        y = ET.fromstring(xml_str)
        assert parse_utils.is_goto_connector(y) is False

    def test_is_decision(self):
        xml_str = f'<Flow xmlns="{helper.raw_ns}"><decisions>my_decision</decisions></Flow>'
        y = ET.fromstring(xml_str)
        d = y.find(f'.//{helper.ns}decisions')
        assert parse_utils.is_decision(d) is True

    def test_get_by_tag(self):
        xml_str = f'<Flow xmlns="{helper.raw_ns}"><decisions>my_decision</decisions></Flow>'
        y = ET.fromstring(xml_str)
        assert parse_utils.get_by_tag(y, 'decisions')[0] == y.find(f'.//{helper.ns}decisions')

    def test_get_by_tag_nested(self):
        res = parse_utils.get_by_tag(self.expr_parser.root, 'recordLookups')
        res = parse_utils.get_by_tag(res[0], 'filters')
        assert len(res) == 5  # now we see the filters

    def test_get_by_tag_null(self):
        xml_str = f'<Flow xmlns="{helper.raw_ns}"><decisions>my_decision</decisions></Flow>'
        y = ET.fromstring(xml_str)
        assert parse_utils.get_by_tag(y, 'foo') == []

    def test_get_named_elems(self):
        xml_str = f'<Flow xmlns="{helper.raw_ns}"><decisions><name>a name</name></decisions></Flow>'
        y = ET.fromstring(xml_str)
        res = parse_utils.get_named_elems(y)
        assert len(res) == 1
        assert res == parse_utils.get_by_tag(y, 'decisions')

    def test_get_name_elem__null_flow(self):
        res = parse_utils.get_named_elems(self.null_parser.root)
        assert len(res) == 4

    def test_get_name_no_name(self):
        res2 = parse_utils.get_name(self.expr_parser.root)
        assert res2 is None  # the root element has no Name, subfield

    def test_get_by_name_and_get_name_consistency(self):
        elem = self.expr_parser.get_by_name('var3')
        assert parse_utils.get_name(elem) == 'var3'

    def test_get_name(self):
        xml_str = f'<Flow xmlns="{helper.raw_ns}"><decisions><name>a name</name></decisions></Flow>'
        y = ET.fromstring(xml_str)
        x = parse_utils.get_by_tag(y, 'decisions')[0]
        assert parse_utils.get_name(x) == 'a name'

    def test_get_elem_string(self):
        el = self.expr_parser.get_by_name('formula1')
        s = parse_utils.get_elem_string(el)
        assert s == ('<formulas xmlns="http://soap.sforce.com/2006/04/metadata">\n        <name>formula1</name>\n'
                     '        <dataType>String</dataType>\n        <expression>"%" + {!Enter_text}</expression>\n'
                     '    </formulas>'
                     )

    def test_get_line_no(self):
        xml_str = f'<Flow xmlns="{helper.raw_ns}">\n<decisions>\n<name>a name</name>\n</decisions>\n</Flow>'
        y = ET.fromstring(xml_str)
        el = parse_utils.get_by_tag(y, 'decisions')[0]
        assert parse_utils.get_line_no(el) == 2

    def test_get_subflow_name(self):
        root = get_parser(helper.SUBFLOW_AUTO).root
        subflow = parse_utils.get_by_tag(root, 'subflows')[0]
        res = parse_utils.get_subflow_name(subflow)
        assert res == 'inner_subflow_example'  # note the name of the flow being referenced, not the subflow elem

    def test_get_assignment_statement_dicts(self):
        tst1 = """<assignmentItems>
            <assignToReference>tgt</assignToReference>
            <operator>Assign</operator>
            <value>
                <elementReference>src</elementReference>
            </value>
        </assignmentItems>
        """
        el = build_simple_flow_elem(tst1, el_tag="assignments")
        operator, entry = parse_utils.get_assignment_statement_dicts(el)[0]

        assert operator == 'Assign'
        assert entry['comment'] == 'Variable Assignment'
        assert entry['element_name'] == 'my_name'
        assert entry['influenced_var'] == 'tgt'
        assert entry['influencer_var'] == 'src'
        assert entry['line_no'] == 1
        assert '<assignToReference>tgt</assignToReference>' in entry['source_text']

    def test_get_assignment_statement_dicts_add(self):
        tst2 = """<assignmentItems>
                    <assignToReference>tgt</assignToReference>
                    <operator>Add</operator>
                    <value>
                        <elementReference>src</elementReference>
                    </value>
                </assignmentItems>
                """
        el = build_simple_flow_elem(tst2, el_tag="assignments")
        operator, entry = parse_utils.get_assignment_statement_dicts(el)[0]

        assert operator == 'Add'
        assert entry['comment'] == 'Variable Assignment'
        assert entry['element_name'] == 'my_name'
        assert entry['influenced_var'] == 'tgt'
        assert entry['influencer_var'] == 'src'
        assert entry['line_no'] == 1
        assert '<assignToReference>tgt</assignToReference>' in entry['source_text']

    def test_get_assignment_statement_dicts_literal(self):
        tst_literal = """<assignmentItems>
                    <assignToReference>tgt</assignToReference>
                    <operator>Assign</operator>
                    <value>
                        <stringValue>src</stringValue>
                    </value>
                </assignmentItems>"""
        el = build_simple_flow_elem(tst_literal, el_tag="assignments")
        operator, entry = parse_utils.get_assignment_statement_dicts(el)[0]

        assert operator == 'Assign'
        assert entry['comment'] == 'Variable Assignment'
        assert entry['element_name'] == 'my_name'
        assert entry['influenced_var'] == 'tgt'
        assert entry['influencer_var'] == parse_utils.STRING_LITERAL_TOKEN
        assert entry['line_no'] == 1
        assert '<assignToReference>tgt</assignToReference>' in entry['source_text']

    def test_get_assignment_statement_dicts_null(self):
        tst_missing = """<somethingElse>foo</somethingElse>"""
        el = build_simple_flow_elem(tst_missing, el_tag="assignments")
        res = parse_utils.get_assignment_statement_dicts(el)
        assert res is None

    def test_get_connector_target_map(self):
        tst = """<connector>
            <targetReference>my_ref</targetReference>
            </connector>"""
        el = build_simple_flow_elem(tst, el_tag="screens")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 1
        conn_el = list(conn_map.keys())[0]
        assert parse_utils.get_tag(conn_el) == 'connector'

        val = conn_map[conn_el]
        assert val == ('my_ref',  # name of target
                       parse_utils.ConnType.Other,  # not a goto or loop
                       False  # not optional
                       )

    def test_get_connector_target_map_goto(self):
        tst_goto = """<connector><isGoTo>true</isGoTo>
            <targetReference>my_ref</targetReference>
            </connector>"""

        el = build_simple_flow_elem(tst_goto, el_tag="screens")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 1
        conn_el = list(conn_map.keys())[0]
        assert parse_utils.get_tag(conn_el) == 'connector'

        val = conn_map[conn_el]
        assert val == ('my_ref',  # name of target
                       parse_utils.ConnType.Goto,  # a goto connector
                       False  # not optional
                       )

    def test_get_connector_target_map_loop_next(self):
        tst_loop = """<nextValueConnector>
            <targetReference>my_ref_next</targetReference>
        </nextValueConnector>
        <noMoreValuesConnector>
            <targetReference>my_ref_no_more</targetReference>
        </noMoreValuesConnector>"""

        el = build_simple_flow_elem(tst_loop, el_tag="loops")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 2
        conn_el1 = list(conn_map.keys())[0]

        assert parse_utils.get_tag(conn_el1) == 'nextValueConnector'

        val1 = conn_map[conn_el1]

        assert val1 == ('my_ref_next',  # name of target
                        parse_utils.ConnType.Loop,  # a loop connector
                        False  # not optional
                        )

    def test_get_connector_target_map_loop_no_more(self):
        tst_loop = """<nextValueConnector>
            <targetReference>my_ref_next</targetReference>
        </nextValueConnector>
        <noMoreValuesConnector>
            <targetReference>my_ref_no_more</targetReference>
        </noMoreValuesConnector>"""

        el = build_simple_flow_elem(tst_loop, el_tag="loops")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 2
        conn_el2 = list(conn_map.keys())[1]

        assert parse_utils.get_tag(conn_el2) == 'noMoreValuesConnector'

        val2 = conn_map[conn_el2]

        assert val2 == ('my_ref_no_more',  # name of target
                        parse_utils.ConnType.Other,  # not a loop
                        False  # not optional
                        )

    def test_loop_missing_next(self):
        tst_loop_missing = """<nextValueConnector>
            <targetReference>my_ref_next</targetReference>
        </nextValueConnector>"""

        el = build_simple_flow_elem(tst_loop_missing, el_tag="loops")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 1
        conn_el1 = list(conn_map.keys())[0]

        assert parse_utils.get_tag(conn_el1) == 'nextValueConnector'

        val1 = conn_map[conn_el1]

        assert val1 == ('my_ref_next',  # name of target
                        parse_utils.ConnType.Loop,  # a loop connector
                        False  # not optional
                        )

    def test_get_connector_target_map_loop_no_more_goto(self):
        tst_loop_goto = """<nextValueConnector>
            <targetReference>my_ref_next</targetReference>
        </nextValueConnector>
        <noMoreValuesConnector>
            <isGoTo>true</isGoTo>
            <targetReference>my_ref_no_more</targetReference>
        </noMoreValuesConnector>"""

        el = build_simple_flow_elem(tst_loop_goto, el_tag="loops")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 2
        conn_el2 = list(conn_map.keys())[1]

        assert parse_utils.get_tag(conn_el2) == 'noMoreValuesConnector'

        val2 = conn_map[conn_el2]

        assert val2 == ('my_ref_no_more',  # name of target
                        parse_utils.ConnType.Goto,  # Goto takes priority
                        False  # not optional
                        )

    def test_connector_target_map_default(self):
        tst_default = """<defaultConnector>
                    <targetReference>my_ref</targetReference>
                </defaultConnector>"""
        el = build_simple_flow_elem(tst_default, el_tag="decisions")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 1
        conn_el = list(conn_map.keys())[0]
        assert parse_utils.get_tag(conn_el) == 'defaultConnector'

        val = conn_map[conn_el]
        assert val == ('my_ref',  # name of target
                       parse_utils.ConnType.Other,  # not a goto or loop
                       False  # not optional
                       )

    def test_connector_target_map_default_goto(self):
        tst_default_goto = """<defaultConnector><isGoTo>true</isGoTo>
                    <targetReference>my_ref</targetReference>
                </defaultConnector>"""
        el = build_simple_flow_elem(tst_default_goto, el_tag="decisions")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 1
        conn_el = list(conn_map.keys())[0]
        assert parse_utils.get_tag(conn_el) == 'defaultConnector'

        val = conn_map[conn_el]
        assert val == ('my_ref',  # name of target
                       parse_utils.ConnType.Goto,  # goto connector
                       False  # not optional
                       )

    def test_connector_target_map_fault(self):
        tst_fault = """<connector>
            <targetReference>my_ref</targetReference>
        </connector>
        <faultConnector>
            <targetReference>my_ref_fault</targetReference>
        </faultConnector>"""

        el = build_simple_flow_elem(tst_fault, el_tag="decisions")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 2
        conn_el = list(conn_map.keys())[1]
        assert parse_utils.get_tag(conn_el) == 'faultConnector'

        val = conn_map[conn_el]
        assert val == ('my_ref_fault',  # name of target
                       parse_utils.ConnType.Other,  # not a goto or loop
                       True  # optional
                       )

    def test_connector_target_map_fault_goto(self):
        tst_fault_goto = """<faultConnector><isGoTo>true</isGoTo><targetReference>my_ref_fault</targetReference>
        </faultConnector>"""

        el = build_simple_flow_elem(tst_fault_goto, el_tag="decisions")
        conn_map = parse_utils.get_conn_target_map(el)

        assert conn_map is not None
        assert len(conn_map) == 1
        conn_el = list(conn_map.keys())[0]
        assert parse_utils.get_tag(conn_el) == 'faultConnector'

        val = conn_map[conn_el]
        assert val == ('my_ref_fault',  # name of target
                       parse_utils.ConnType.Goto,  # goto connector
                       True  # optional
                       )

    def test_is_assign_null_false(self):
        tst = """<assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>"""
        el = build_simple_flow_elem(tst, el_tag="recordLookups")
        res = parse_utils.is_assign_null(el)
        assert res is False

    def test_is_assign_null_true(self):
        tst = """<assignNullValuesIfNoRecordsFound>true</assignNullValuesIfNoRecordsFound>"""
        el = build_simple_flow_elem(tst, el_tag="recordLookups")
        res = parse_utils.is_assign_null(el)
        assert res is True

    def test_is_assign_null_missing(self):
        tst = """<other>true</other>"""
        el = build_simple_flow_elem(tst, el_tag='recordLookups')
        res = parse_utils.is_assign_null(el)
        assert res is None

    def test_is_auto_store(self):
        tst = '<storeOutputAutomatically>true</storeOutputAutomatically>'
        el = build_simple_flow_elem(tst, el_tag='recordLookups')
        res = parse_utils.is_auto_store(el)
        assert res is True

    def test_is_auto_store_missing(self):
        tst = '<other>true</other>'
        el = build_simple_flow_elem(tst, el_tag='recordLookups')
        res = parse_utils.is_auto_store(el)
        assert res is None

    def test_is_collection_false(self):
        tst = '<isCollection>false</isCollection>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_collection(el)
        assert res is False

    def test_is_collection_true(self):
        tst = '<isCollection>true</isCollection>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_collection(el)
        assert res is True

    def test_is_collection_missing(self):
        tst = '<other>true</other>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_collection(el)
        assert res is None

    def test_get_obj_name(self):
        tst = '<object>Lead</object>'
        el = build_simple_flow_elem(tst, el_tag='recordCreates')
        res = parse_utils.get_obj_name(el)
        assert res == 'Lead'

    def test_get_obj_name_missing(self):
        tst = '<other>Lead</other>'
        el = build_simple_flow_elem(tst, el_tag='recordCreates')
        res = parse_utils.get_obj_name(el)
        assert res is None

    def test_get_datatype_fields_string(self):
        tst = '<dataType>String</dataType>'
        el = build_simple_flow_elem(tst, el_tag='fields')
        res = parse_utils.get_datatype(el)
        assert res is DataType.StringValue

    def test_get_datatype_fields_missing(self):
        tst = '<other>String</other>'
        el = build_simple_flow_elem(tst, el_tag='fields')
        res = parse_utils.get_datatype(el)
        assert res is None

    def test_get_datatype_fields_sobject(self):
        tst = '<dataType>SObject</dataType>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.get_datatype(el)
        assert res is DataType.Object

    def test_get_datatype_fields_literal(self):
        tst = '<dataType>Number</dataType>'
        el = build_simple_flow_elem(tst, el_tag='formulas')
        res = parse_utils.get_datatype(el)
        assert res is DataType.Literal

    def test_is_get_first_record_only_true(self):
        tst = '<getFirstRecordOnly>true</getFirstRecordOnly>'
        el = build_simple_flow_elem(tst, el_tag='recordLookups')
        res = parse_utils.is_get_first_record_only(el)
        assert res is True

    def test_is_get_first_record_only_false(self):
        tst = '<getFirstRecordOnly>false</getFirstRecordOnly>'
        el = build_simple_flow_elem(tst, el_tag='recordLookups')
        res = parse_utils.is_get_first_record_only(el)
        assert res is False

    def test_is_get_first_record_only_missing(self):
        tst = '<other>false</other>'
        el = build_simple_flow_elem(tst, el_tag='recordLookups')
        res = parse_utils.is_get_first_record_only(el)
        assert res is None

    def test_is_input_false(self):
        tst = '<isInput>false</isInput>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_input(el)
        assert res is False

    def test_is_input_true(self):
        tst = '<isInput>true</isInput>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_input(el)
        assert res is True

    def test_is_input_missing(self):
        tst = '<other>true</other>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_input(el)
        assert res is False

    def test_is_output_false(self):
        tst = '<isOutput>false</isOutput>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_output(el)
        assert res is False

    def test_is_output_true(self):
        tst = '<isOutput>true</isOutput>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_output(el)
        assert res is True

    def test_is_output_missing(self):
        tst = '<other>true</other>'
        el = build_simple_flow_elem(tst, el_tag='variables')
        res = parse_utils.is_output(el)
        assert res is False

    def test_get_subflow_output_map__explicit_mappings(self):
        root = self.subflow1_parent_parser.root
        subflow = parse_utils.get_by_tag(root, 'subflows')[0]
        res = parse_utils.get_subflow_output_map(subflow)
        assert res == (True, {})

    def test_get_subflow_output_map__implicit_mappings(self):
        root = self.subflow2_parent_parser.root
        subflow = parse_utils.get_by_tag(root, 'subflows')[0]
        res = parse_utils.get_subflow_output_map(subflow)
        assert res == (False, {'output_var1': 'return_from_subflow_in_parent'})

    def test_get_subflow_input_map(self):
        root = self.subflow1_parent_parser.root
        subflow = parse_utils.get_by_tag(root, 'subflows')[0]
        res = parse_utils.get_subflow_input_map(subflow)
        assert res == {'parent_input_var': 'input_var1'}
