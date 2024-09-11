import unittest

from lxml import etree as ET

import flow_parser.parse as parse
import flowtest.util as util
import public.data_obj
import test.helper as helper
from public.enums import FlowType, DataType, ReferenceType
from test.helper import get_parser
import public.parse_utils as parse_utils


class TestFlowParse(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.parser = get_parser(helper.EXAMPLE_FLOW)  # also without sharing
        cls.expr_parser = get_parser(helper.ASSIGN_FLOW)  # also without sharing
        cls.null_parser = get_parser(helper.NULL_FLOW)  # use this to check handling when items are missing
        cls.sharing_parser = get_parser(helper.NULL_WITH_SHARING)
        cls.default_sharing_parser = get_parser(helper.NULL_DEFAULT)
        cls.collections_parser = get_parser(helper.COLLECTIONS1)
        cls.root = helper.get_root(helper.COLLECTIONS1)

    def test_play_area(self):
        # This test is just to experiment with the parser
        root = self.root
        assert root is not None
        parser = self.collections_parser
        el = parser.get_by_name('getaccount2')
        assert el is not None

    def test_get_flow_type_autolaunched(self):
        parser = helper.get_parser(helper.AUTOLAUNCHED)
        res = parser.get_flow_type()
        assert res is FlowType.AutoLaunched

    def test_get_flow_type_screen(self):
        parser = self.parser
        res = parser.get_flow_type()
        assert res is FlowType.Screen

    def test_get_flow_type_record(self):
        parser = helper.get_parser(helper.RECORD_TRIGGERED)
        res = parser.get_flow_type()
        assert res is FlowType.RecordTrigger

    def test_parse_get_output_variables(self):
        parser = helper.get_parser(helper.CHILD_FLOW)
        res = parser.get_output_variables()
        assert res == {('foo.flow-meta.xml', 'output_var1')}

    def test_parse_get_input_variables(self):
        parser = helper.get_parser(helper.CHILD_FLOW)
        res = parser.get_input_variables()
        assert res == {('foo.flow-meta.xml', 'input_var1')}

    def test_get_input_field_elems__null(self):
        # now test with no input fields
        res = self.null_parser.get_input_field_elems()
        assert res is None

    def test_get_input_output_elems_null(self):
        # test with no input variables
        res = self.null_parser.get_input_output_elems()
        assert len(res["input"]) == 0

    def test_get_all_variable_elems(self):
        res = self.expr_parser.get_all_variable_elems()
        assert len(res) == 4
        assert parse.get_name(res[0]) == 'var1'

    def test_get_all_variable_elems_null(self):
        # now test with no variables
        res = self.null_parser.get_all_variable_elems()
        assert res is None

    def test_get_by_name(self):
        res1 = self.parser.get_by_name('loop_over_recent_leads')
        assert parse.get_name(res1) == 'loop_over_recent_leads'
        assert res1.tag == f'{helper.ns}loops'

    def test_get_by_name_expected_tags(self):
        res2 = self.expr_parser.get_by_name('formula1')
        assert res2.tag == f'{helper.ns}formulas'

    def test_parse_get_by_name_null(self):
        res3 = self.expr_parser.get_by_name('missing')
        assert res3 is None

    def test_get_templates(self):
        templates = self.expr_parser.get_templates()
        assert len(templates) == 2
        assert ET.iselement(templates[0])
        assert templates[0].tag == f'{helper.ns}textTemplates'

    def test_get_templates__null(self):
        # test with no templates
        res = self.null_parser.get_templates()
        assert len(res) == 0

    def test_get_formulas(self):
        formulas = self.expr_parser.get_formulas()
        assert len(formulas) == 2
        assert ET.iselement(formulas[0])
        assert formulas[0].tag == f'{helper.ns}formulas'

    def test_get_formulas__null(self):
        # now test if none found (should be [], not None)
        res = self.null_parser.get_formulas()
        assert len(res) == 0

    def test_get_flow_name(self):
        assert self.expr_parser.get_flow_name() == 'assign_test'

    def test_get_api_version(self):
        res = self.expr_parser.get_api_version()
        assert isinstance(res, str)
        assert res == '58.0'

    def test_get_all_indirect_tuples(self):
        # should have both templates and formulas
        res = self.expr_parser.get_all_indirect_tuples()
        assert res is not None
        assert len(res) == 4
        assert res[0][0] == 'var1'
        assert res[0][1].tag.endswith('textTemplates')
        assert parse.get_name(res[0][1]) == 'template2'  # name of indirect variable

    def test_get_all_indirect_tuples__null(self):
        # now test with no indirect variables
        res = self.null_parser.get_all_indirect_tuples()
        assert len(res) == 0  # empty dict

    def test_get_run_mode(self):
        assert self.expr_parser.get_run_mode().name == 'SystemModeWithoutSharing'
        assert self.null_parser.get_run_mode() is util.RunMode.DefaultMode
        assert self.sharing_parser.get_run_mode() is util.RunMode.SystemModeWithSharing

    def test_parser_get_start_elem_start(self):
        tst1 = """<start>my start</start><processType>Flow</processType>"""
        parser, root = helper.build_simple_flow_elem(tst1, parser=True)
        res = parser.get_start_elem()
        assert parse_utils.get_tag(res) == 'start'

    def test_parser_get_start_elem_process_builder(self):
        tst2 = """<startElementReference>my_name</startElementReference>
        <foo>
        <name>my_name</name>
        </foo>
        """
        parser, root = helper.build_simple_flow_elem(tst2, parser=True)
        res = parser.get_start_elem()
        assert parse_utils.get_tag(res) == 'foo'

    def test_parser_update(self):
        root = helper.get_root(helper.EXAMPLE_FLOW)
        parser = parse.Parser(root)
        parser.flow_path = 'A_Path'
        parser.update(old_parser=None)
        assert parser.input_variables == frozenset({('A_Path', 'description'),
                                                    ('A_Path', 'street'),
                                                    ('A_Path', 'title')})
        assert parser.flow_type is FlowType.Screen

    def test_resolve_by_name(self):
        parser = self.parser
        res = parser.resolve_by_name('description')
        assert res[0] == 'description'
        assert res[1] is None
        assert isinstance(res[2], public.data_obj.VariableType)

    """
    VariableType tests
    
    """

    def test_VT_from_elem_record_lookups(self):
        tst = """<recordLookups>
        <name>get_recent_leads</name>
        <label>get_recent_leads</label>
        <locationX>517</locationX>
        <locationY>914</locationY>
        <assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>
        <connector>
            <targetReference>loop_over_recent_leads</targetReference>
        </connector>
        <filterLogic>1</filterLogic>
        <filters>
            <field>CreatedDate</field>
            <operator>LessThanOrEqualTo</operator>
            <value>
                <elementReference>$System.OriginDateTime</elementReference>
            </value>
        </filters>
        <object>Lead</object>
        <outputReference>obtained_leads</outputReference>
        <queriedFields>Id</queriedFields>
        <sortField>CreatedDate</sortField>
        <sortOrder>Desc</sortOrder>
        </recordLookups>"""
        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)
        assert res.tag == 'recordLookups'
        assert res.object_name == 'Lead'
        assert res.is_collection is True
        assert res.datatype is DataType.Object
        assert res.is_optional is True

    def test_VT_from_elem_record_creates(self):
        tst = """<recordCreates>
        <description>create_from_record</description>
        <name>create_case</name>
        <label>create_case</label>
        <locationX>1045</locationX>
        <locationY>224</locationY>
        <connector>
            <targetReference>press_next</targetReference>
        </connector>
        <inputReference>case_holder</inputReference>
        </recordCreates>"""

        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)
        assert res.tag == 'recordCreates'
        assert res.is_optional is False
        assert res.datatype is DataType.StringValue  # the id of created record
        # Note: we don't know the object type as it's not in the xml definition
        # but in the definition of the element reference,
        # but this is a great candidate for propagation

    def test_VT_from_elem_formulas_templates(self):
        tst = """<textTemplates>
        <name>template2</name>
        <isViewedAsPlainText>true</isViewedAsPlainText>
        <text>my template{!var1}</text>
        </textTemplates>"""

        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)
        assert res.tag == 'textTemplates'
        assert res.is_collection is False
        assert res.datatype is DataType.StringValue
        assert res.reference is ReferenceType.Formula

    def test_VT_from_elem_fields(self):
        tst = """<fields>
            <name>First_Name</name>
            <dataType>String</dataType>
            <fieldText>First Name</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
            </fields>"""
        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)
        assert res.tag == 'fields'
        assert res.datatype is DataType.StringValue
        assert res.reference is ReferenceType.ElementReference

    def test_VT_from_elem_variables(self):
        tst = """<variables>
        <name>foo</name>
        <dataType>String</dataType>
        <isCollection>true</isCollection>
        <isInput>true</isInput>
        <isOutput>true</isOutput>
        </variables>"""
        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)
        assert res.tag == 'variables'
        assert res.datatype is DataType.StringValue
        assert res.is_collection is True
        assert res.is_input is True
        assert res.is_output is True
        assert res.is_optional is True

    def test_VT_from_elem_dynamic_choice_sets(self):
        tst = """<dynamicChoiceSets>
        <name>my_collection_choice_set</name>
        <collectionReference>get_account_recs</collectionReference>
        <dataType>String</dataType>
        <displayField>Name</displayField>
        <object>Account</object>
        <valueField>Description</valueField>
        </dynamicChoiceSets>"""
        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)

        assert res.tag == 'dynamicChoiceSets'
        assert res.datatype is DataType.StringValue
        assert res.object_name == 'Account'

    def test_VT_from_elem_choices(self):
        tst = """<choices>
        <description>reason</description>
        <name>a_choice</name>
        <choiceText>Do you want this choice</choiceText>
        <dataType>String</dataType>
        <userInput>
            <isRequired>false</isRequired>
            <promptText>why?</promptText>
        </userInput>
        <value>
            <stringValue>true</stringValue>
        </value>
        </choices>"""

        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)

        assert res.tag == 'choices'
        assert res.datatype is DataType.StringValue

    def test_VT_from_elem_constants(self):
        tst = """<constants>
        <name>foo_name</name>
        <dataType>String</dataType>
        <value>
            <stringValue>bar_val</stringValue>
        </value>
        </constants>"""
        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)
        assert res.tag == 'constants'
        assert res.reference == ReferenceType.Constant
        assert res.datatype is DataType.StringValue

    def test_VT_from_elem_subflows(self):
        tst = """<subflows>
        <name>call_subflow</name>
        <label>call subflow</label>
        <locationX>520</locationX>
        <locationY>488</locationY>
        <connector>
            <targetReference>display_subflow_result_in_parent</targetReference>
        </connector>
        <flowName>inner_subflow_example</flowName>
        <inputAssignments>
            <name>input_var1</name>
            <value>
                <elementReference>parent_input_var</elementReference>
            </value>
        </inputAssignments>
        <outputAssignments>
            <assignToReference>return_from_subflow_in_parent</assignToReference>
            <name>output_var1</name>
        </outputAssignments>
        </subflows>"""
        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)
        assert res.tag == 'subflows'
        assert res.datatype is None  # no datatype for subflows

    def test_VT_from_elem_collection_processors(self):
        tst = """<collectionProcessors>
        <name>filteraccounts1</name>
        <elementSubtype>FilterCollectionProcessor</elementSubtype>
        <label>filteraccounts1</label>
        <locationX>868</locationX>
        <locationY>334</locationY>
        <assignNextValueToReference>currentItem_filteraccounts1_0</assignNextValueToReference>
        <collectionProcessorType>FilterCollectionProcessor</collectionProcessorType>
        <collectionReference>get_records_by_name_input</collectionReference>
        <conditionLogic>and</conditionLogic>
        <conditions>
            <leftValueReference>currentItem_filteraccounts1_0.CreatedDate</leftValueReference>
            <operator>GreaterThan</operator>
            <rightValue>
                <dateTimeValue>2000-10-01T07:00:00.000Z</dateTimeValue>
            </rightValue>
        </conditions>
        <connector>
            <targetReference>assign_accounts</targetReference>
        </connector>
        </collectionProcessors>"""

        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)

        assert res.tag == 'collectionProcessors'
        assert res.is_collection is True
        assert res.datatype is None  # propagate will push in the type
        assert res.object_name is None  # propagation will populate this
        assert res.reference is ReferenceType.CollectionReference

    def test_VT_from_elem_loops(self):
        tst = """<loops>
        <name>loop_get_ids_of_created_cases</name>
        <label>loop get ids of created cases</label>
        <locationX>878</locationX>
        <locationY>379</locationY>
        <collectionReference>case_holder_collection</collectionReference>
        <iterationOrder>Asc</iterationOrder>
        <nextValueConnector>
            <targetReference>add_ids_to_id_holder</targetReference>
        </nextValueConnector>
        <noMoreValuesConnector>
            <targetReference>press_next</targetReference>
        </noMoreValuesConnector>
        </loops>"""
        elem = helper.build_simple_flow_elem(tst)
        res = parse.build_vartype_from_elem(elem)

        assert res.tag == 'loops'
        assert res.is_collection is True
        assert res.is_optional is False
        assert res.reference is ReferenceType.CollectionReference

