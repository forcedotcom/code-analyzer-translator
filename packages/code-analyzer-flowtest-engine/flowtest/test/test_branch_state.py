from unittest import TestCase

from public.data_obj import DataInfluenceStatement
from flowtest.flows import FlowVector
import test.helper as helper
from test.helper import F

from flowtest import branch_state
from public.parse_utils import ET

A_PATH = helper.A_PATH
B_PATH = helper.B_PATH

"""
    Test harnesses
"""


def build_stmt(x, y):
    # x = influencer -> y = influenced
    return DataInfluenceStatement(
        influencer_var=x,
        influenced_var=y,
        element_name='my_el',
        comment='my comment',
        line_no=1,
        source_text='foo_source',
        flow_path=A_PATH)


def member_flow(x, y):
    return branch_state._build_path_from_history(parser=helper.SimpleParser(),
                                                 history=(build_stmt(x, y),))


FLOW_MAP = {(A_PATH, 'X'): {F('X->X'), F('Z->X')},  # will extend X
            (B_PATH, 'X'): {F('W->X', src_path=B_PATH)},  # will not extend X (path mismatch)
            (A_PATH, 'Y'): {F('V->Y'), F('U->Y')},  # will extend Y
            (A_PATH, 'Z'): {F('K->Z')},  # will not extend Z (irrelevant)
            (A_PATH, 'P'): {F('T->P')}  # no effect
            }


def make_simple_state() -> branch_state.BranchState:
    a_state = branch_state.BranchState(parser=helper.SimpleParser())
    a_state.flow_path = A_PATH
    a_state.flow_name = 'my_flow'
    a_state.load_crawl_step(helper.build_simple_crawler())
    return a_state


def make_state_with_influence_map(vector_list: [FlowVector] = None) -> branch_state.BranchState:
    s = branch_state.BranchState(parser=helper.SimpleParser())
    s.flow_path = A_PATH
    s.flow_name = 'my_flow'
    s.load_crawl_step(helper.build_simple_crawler())
    if vector_list is None:
        return s
    for vec in vector_list:
        default = list(vec.property_maps.keys())[0]
        s._set_vector(vec=vec,
                      variable_name=default.influenced_name)
    return s


"""
    
        End Test Harnesses

"""


class Test(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.recordAtoA = DataInfluenceStatement(
            influencer_var='A',
            influenced_var='A',
            element_name='my_el',
            comment='my comment',
            line_no=1,
            source_text='foo_source',
            flow_path=A_PATH)

        cls.recordAtoB = DataInfluenceStatement(
            influencer_var='A',
            influenced_var='B',
            element_name='my_el',
            comment='my comment',
            line_no=1,
            source_text='foo_source',
            flow_path=A_PATH)

        cls.recordBtoC = DataInfluenceStatement(
            influencer_var='B',
            influenced_var='C',
            element_name='my_el',
            comment='my comment',
            line_no=1,
            source_text='foo_source',
            flow_path=A_PATH)

        cls.recordBtoC_other_stmt = DataInfluenceStatement(
            influencer_var='B',
            influenced_var='C',
            element_name='my_el',
            comment='my comment',
            line_no=1,
            source_text='foo_source',
            flow_path='another_flow_path.flow-meta.xml')
        cls.simple_parser = helper.SimpleParser()
        cls.simple_state = make_simple_state()

    def test_build_df_from_history_missing_history(self):
        self.assertRaises(ValueError, branch_state._build_path_from_history, history=[], parser=self.simple_parser)
        self.assertRaises(ValueError, branch_state._build_path_from_history, history=None, parser=self.simple_parser)

    def test_build_df_from_history(self):
        z = branch_state._build_path_from_history(history=(self.recordAtoB,), parser=self.simple_parser)

        assert z.influencer_name == 'A'
        assert z.influenced_name == 'B'
        assert z.influencer_filepath == z.influenced_filepath
        assert z.influencer_filepath == A_PATH
        assert z.influenced_type_info == self.simple_parser.my_type

    def test_build_df_from_history_members(self):
        z = branch_state._build_path_from_history(history=(build_stmt('A.p', 'B.q'),),
                                                  parser=self.simple_parser)
        assert z.influencer_property == 'p'
        assert z.influenced_property == 'q'
        assert z.influencer_name == 'A'
        assert z.influenced_name == 'B'
        assert z.influenced_type_info == self.simple_parser.my_type

    def test_extend_flows_by_map_no_member(self):
        start_flows = {F('X->A'), F('Y->A')}

        res = branch_state._extend_formula_map_by_flows(start_flows=start_flows, formula_map=FLOW_MAP)
        assert res is not None
        assert len(res) == 4
        s = {x.short_report(arrows=True) for x in res}
        assert s == {'U->Y->A', 'V->Y->A', 'X->X->A', 'Z->X->A'}

    def test_extend_flows_by_map_no_member_add_missing(self):
        # check add missing
        start_flows2 = {F('W->A'), F('Y->A')}
        # W is missing so this influence record should be added.
        # then the resolution of Y: is V->Y and U->Y
        res2 = branch_state._extend_formula_map_by_flows(start_flows=start_flows2, formula_map=FLOW_MAP,
                                                         add_missing=True)
        s2 = {x.short_report(arrows=True) for x in res2}
        assert s2 == {'W->A', 'U->Y->A', 'V->Y->A'}

        # But if we don't set add missing, we'll only get 2 elements:
        res3 = branch_state._extend_formula_map_by_flows(start_flows=start_flows2, formula_map=FLOW_MAP,
                                                         add_missing=False)
        s3 = {x.short_report(arrows=True) for x in res3}
        assert s3 == {'U->Y->A', 'V->Y->A'}

    def test_extend_flows_by_map_null_case(self):
        start_flows = {F('X->A'), F('Y->A')}
        # an empty flow map results in an empty set unless add_missing is set
        res4 = branch_state._extend_formula_map_by_flows(start_flows=start_flows, formula_map={}, add_missing=False)
        assert len(res4) == 0

    def test_extend_flows_by_map_null_case_add_missing(self):
        start_flows = {F('X->A'), F('Y->A')}
        # ...but with add_missing set to true, we get the original set back
        res4 = branch_state._extend_formula_map_by_flows(start_flows=start_flows, formula_map={}, add_missing=True)
        assert res4 == start_flows

    def test_build_formula_map(self):
        parser1 = helper.get_parser(helper.EXPRESSION_FLOW)
        res1 = branch_state._build_formula_map(parser1, A_PATH)
        assert len(res1[(A_PATH, 'test_formula_1')]) == 1
        df = list(res1[(A_PATH, 'test_formula_1')])[0]
        assert df.influencer_name == 'id_input'
        assert df.influenced_name == 'test_formula_1'
        assert df.influenced_filepath == A_PATH
        assert df.influencer_filepath == A_PATH

    def test_build_formula_map_no_formulas(self):
        parser2 = helper.get_parser(helper.NULL_FLOW)
        res2 = branch_state._build_formula_map(parser2, A_PATH)

        # If no formulas, we get an empty formula map
        assert res2 is not None
        assert len(res2) == 0

    def test_build_formula_map_formulas_and_templates(self):
        parser3 = helper.get_parser(helper.ASSIGN_FLOW)
        # Now make sure we handle templates and formulas correctly
        res3 = branch_state._build_formula_map(parser3, A_PATH)
        assert len(res3) == 3  # one template and 2 formulas
        assert (A_PATH, 'template2') in res3
        assert len(res3[(A_PATH, 'template2')]) == 1
        df = list(res3[(A_PATH, 'template2')])[0]
        assert df.influencer_name == 'var1'

    def test_build_formula_map_recursion(self):
        parser3 = helper.get_parser(helper.ASSIGN_FLOW)
        res3 = branch_state._build_formula_map(parser3, A_PATH)
        # Now check recursion, as formula3 depends on formula 1 which depends on Enter_Text
        assert (A_PATH, 'formula3') in res3
        assert len(res3[(A_PATH, 'formula3')]) == 2

        influencers = {x.influencer_name for x in res3[(A_PATH, 'formula3')]}
        assert influencers == {'var2', 'Enter_text'}

    """
            
                Propagate Flows Tests
    
    """

    def test_state_propagate_flows_by_stmt_null_map(self):
        # Check that starting out with no influence map and adding
        # one statement means we have an influence map with one statement.
        s = make_state_with_influence_map()
        s.propagate_flows(self.recordAtoB)
        res = s.get_or_make_vector('B')
        assert isinstance(res, branch_state.FlowVector)  # we return a FlowVector
        foo = res.get_flows_by_prop()
        assert len(foo) == 1  # foo is a set (of flows)
        assert list(foo)[0].influenced_name == 'B'
        assert list(foo)[0].influencer_name == 'A'

    def test_state_propagate_flows_by_stmt_with_member_parent_flow(self):
        # we start with a flow from taint --> Y.b
        s = make_state_with_influence_map([FlowVector(
            property_maps={F('Y->Y'): {'b': {F('taint->Y.b')}}})])
        # Our statement is Y -> Z
        # which induce Z.b <-- taint, and Z|other <-- Y
        stmt = build_stmt('Y', 'Z')
        s.propagate_flows(stmt)
        res = s.get_or_make_vector('Z')
        assert list(res.get_flows_by_prop('b'))[0].influencer_name == 'taint'
        assert list(res.get_flows_by_prop('b'))[0].influencer_property is None

    def test_state_propagate_flows_by_stmt_with_parent_flow_generic_case(self):
        # we start with a flow from taint --> Y.b
        s = make_state_with_influence_map([FlowVector(
            property_maps={F('Y->Y'): {'b': {F('taint->Y.b')}}
                           })
        ])

        # Our statement is Y -> Z
        # which induce taint --> Z.b, and default Y --> Z
        stmt = build_stmt('Y', 'Z')
        s.propagate_flows(stmt)
        res = s.get_or_make_vector('Z')
        # When we request the generic case (not prop b) we should get a restriction
        assert list(res.get_flows_by_prop('yowza'))[0].influencer_name == 'Y'
        assert list(res.get_flows_by_prop('yowza'))[0].influencer_property == 'yowza'

    def test_state_propagate_flows_by_stmt_with_member(self):
        # we start with a flow from X.a --> Y.b
        s = make_state_with_influence_map([FlowVector(
            property_maps={F('Y->Y'): {'b': {F('X.a->Y.b')}}})])
        # Our statement is Y.b -> Z.s
        # check if we can detect that Z.s is influenced by X.a
        stmt = build_stmt('Y.b', 'Z.s')
        s.propagate_flows(stmt)
        res = s.get_or_make_vector('Z')
        # When we request the generic case (not prop b) we should get a restriction
        report = res.report_dict()
        assert report == {'Z->Z': {'s': {'X.a->Y.b->Z.s'}}}
        assert list(res.get_flows_by_prop('s'))[0].influencer_name == 'X'
        assert list(res.get_flows_by_prop('s'))[0].influencer_property == 'a'

    def test_state_propagate_flows_by_stmt_with_member_generic_case(self):
        # we start with a flow from X.a --> Y.b
        s = make_state_with_influence_map([FlowVector(
            property_maps={F('Y->Y'): {'b': {F('X.a->Y.b')}}}
        )])
        # Our statement is Y -> Z
        # check if we can detect that Z.a is influenced by Y.a
        stmt = build_stmt('Y', 'Z')
        s.propagate_flows(stmt)
        res = s.get_or_make_vector('Z')
        # When we request the generic case (not prop b) we should get a restriction
        assert list(res.get_flows_by_prop('b'))[0].influencer_name == 'X'
        assert list(res.get_flows_by_prop('b'))[0].influencer_property == 'a'

    def test_state_propagate_flows_stmt_w_prop(self):
        s = make_state_with_influence_map()
        stmt = build_stmt('taint', 'T.Name')
        s.propagate_flows(stmt)
        res = s.get_or_make_vector('T')
        report = res.report_dict()
        assert report == {'T->T': {'Name': {'taint->taint->T.Name'}}}
        assert list(res.get_flows_by_prop('Name'))[0].influencer_name == 'taint'
        assert list(res.get_flows_by_prop('Name'))[0].influencer_property is None

    def test_state_propagate_flows_stmt_prop_then_whole(self):
        s = make_state_with_influence_map()
        stmt = build_stmt('taint', 'T.Name')
        s.propagate_flows(stmt)
        stmt = build_stmt('T', 'Z')
        s.propagate_flows(stmt)

        res = s.get_or_make_vector('Z').report_dict()
        assert res is not None
        assert res == {'T->T->Z': {'Name': {'taint->taint->T.Name->Z.Name*'}}}

        res2 = list(s.get_or_make_vector('Z').get_flows_by_prop('Name'))[0]
        report = res2.short_report(arrows=True)
        assert report == 'taint->taint->T.Name->Z.Name*'

    def test_state_propagate_flows_2_complex(self):
        """
        step 1:    var T.Name <-- taint
        step 2:    var Z <-- var W
        step 3:    var Z.Name <-- var T.Subject
        """
        s = make_state_with_influence_map()
        stmt = build_stmt('taint', 'T.Name')
        s.propagate_flows(stmt)
        stmt = build_stmt('W', 'Z')
        s.propagate_flows(stmt)
        stmt = build_stmt('T.Subject', 'Z.Name')
        s.propagate_flows(stmt)
        vec = s.get_or_make_vector('Z')
        report = vec.report_dict()
        # Z is influenced by W except for T, which is influenced by Z
        assert report == {'W->W->Z': {'Name': {'T.Subject*->T->Z.Name'}}}
        assert list(vec.get_flows_by_prop('Name'))[0].influencer_name == 'T'
        assert list(vec.get_flows_by_prop('Name'))[0].influencer_property == 'Subject'

    def test_state_propagate_flows_by_stmt_complex_case(self):
        """
        step 1:    var T.Name <-- user input
        step 2:    var Z <-- var W
        step 3:    var Z.Name <-- var T.Subject
        step 4:    var2 <-- var1
        step 5:    var2.Name <-- Z.Name
        """
        s = make_state_with_influence_map()
        stmt = build_stmt('taint', 'T.Name')
        s.propagate_flows(stmt)
        stmt = build_stmt('W', 'Z')
        s.propagate_flows(stmt)
        stmt = build_stmt('T.Subject', 'Z.Name')
        s.propagate_flows(stmt)
        stmt = build_stmt('var1', 'var2')
        s.propagate_flows(stmt)
        stmt = build_stmt('Z.Name', 'var2.Name')
        s.propagate_flows(stmt)

        """
            var2.Name <-- T.Subject
        """
        res = s.get_or_make_vector('var2')
        report = res.report_dict()
        assert report == {'var1->var1->var2': {'Name': {'T.Subject*->T->Z.Name->var2.Name'}}}

    """
        Now test additions rather than assignments
    """

    def test_state_propagate_flows_by_stmt_null_map_add(self):
        # Check that starting out with no influence map and adding
        # one statement means we have an influence map with one statement.
        s = make_state_with_influence_map()
        s.propagate_flows(self.recordAtoB, assign=False)
        res = s.get_or_make_vector('B')
        assert isinstance(res, branch_state.FlowVector)  # we return a FlowVector
        foo = res.get_flows_by_prop()
        assert len(foo) == 2  # foo is a set (of flows)
        assert {x.influencer_name for x in list(foo)} == {'A', 'B'}
        assert {x.influencer_property for x in list(foo)} == {None}

    def test_state_propagate_flows_member_add(self):
        # we start with a flow from X.a --> Y.b
        s = make_state_with_influence_map()
        # Our statement is Y -> Z
        # check if we can detect that Z.b is influenced by X.a
        stmt = build_stmt('Y.a', 'Z.b')
        s.propagate_flows(stmt, assign=False)
        res = s.get_or_make_vector('Z')
        t = res.get_flows_by_prop('b')
        assert {x.influencer_name for x in t} == {'Y', 'Z'}
        assert {x.influencer_property for x in t} == {'a', 'b'}

    def test_state_propagate_flows_by_stmt_with_member_generic_case_add(self):
        # we start with a flow from X.a --> Y.b
        s = make_state_with_influence_map([FlowVector(
            property_maps={F('Y->Y'): {'b': {F('X.a->Y.b')}}
                           }
        )])
        # Our statement is Y -> Z
        # check if we can detect that Z.a is influenced by X.a
        stmt = build_stmt('Y', 'Z')
        s.propagate_flows(stmt, assign=False)
        res = s.get_or_make_vector('Z')
        report = res.report_dict()
        assert report == {'Y->Y->Z': {'b': {'X.a->Y.b->Z.b*'}},
                          'Z->Z': None}  # as we are adding

    """
            Now test formula maps
        
    """

    def test_state_propagate_flows_by_record_simple_with_formula(self):
        s = make_simple_state()
        record = self.recordAtoB
        flow_path = A_PATH
        s.formula_map = {(flow_path, 'A'): {F('X->A'), F('Y->A')}}
        cs = s.current_crawl_step
        s._test_only_set_influence_map({cs: {
            (flow_path, 'B'): FlowVector.from_flows({F('Z->B'), F('W->B')}),
            (flow_path, 'X'): FlowVector.from_flows({F('N->X')}),
            (flow_path, 'Y'): FlowVector.from_flows({F('M->Y')})
        }})

        res = s.propagate_flows(statement=record, assign=True)
        """
            In this case, the resolved flows influencing would be computed as follows:
            A -> B
            Because A is a formula field (it's in the formula map), we first evaluate the formula:
            to get 2 flows to B: X -> A -> B, Y -> A -> B
            now we look for the current influence map for X and Y, yielding
                N -> X -> A -> B, M -> Y -> A -> B
            
            thus the A -> B flow induces the following change to the influence map:
            
            new map: 
            set_of_new_flows = {N -> X -> A -> B, M -> Y -> A -> B}
            (flow_path, 'B'): set_of_new_flows,
            (flow_path, 'X'): {flow('N', 'X')},
            (flow_path, 'Y'): {flow('M', 'Y')}    
            
            ..because it is an assignment. If it was an addition, we'd keep our existing
            flows for B and add the two new branch_state. If update is False, we only
            return the new flows but don't update the influence map. The latter
            is used when doing local analysis on, say, a sink element.
        """
        readable = {x.short_report(arrows=True) for x in res.get_flows_by_prop()}
        assert readable is not None
        assert readable == {'N->X->A->B', 'M->Y->A->B'}

    def test_state_propagate_flows_by_record_simple_add_no_update(self):
        s = make_simple_state()
        record = self.recordAtoB
        flow_path = A_PATH
        s.formula_map = {(flow_path, 'A'): {F('X->A'), F('Y->A')}}
        cs = s.current_crawl_step
        s._test_only_set_influence_map({cs: {
            (flow_path, 'B'): FlowVector.from_flows({F('Z->B'), F('W->B')}),
            (flow_path, 'X'): FlowVector.from_flows({F('N->X')}),
            (flow_path, 'Y'): FlowVector.from_flows({F('M->Y')})
        }})
        res2 = s.propagate_flows(statement=record, assign=False, store=False)
        readable = {x.short_report(arrows=True) for x in res2.get_flows_by_prop()}
        assert readable == {'N->X->A->B', 'M->Y->A->B', 'Z->B', 'W->B'}

    def test_state_propagate_flows_by_record_simple_add_with_update(self):
        s = make_simple_state()
        record = self.recordAtoB
        flow_path = A_PATH
        s.formula_map = {(flow_path, 'A'): {F('X->A'), F('Y->A')}}
        cs = s.current_crawl_step
        s._test_only_set_influence_map({cs: {
            (flow_path, 'B'): FlowVector.from_flows({F('Z->B'), F('W->B')}),
            (flow_path, 'X'): FlowVector.from_flows({F('N->X')}),
            (flow_path, 'Y'): FlowVector.from_flows({F('M->Y')})
        }})
        res2 = s.propagate_flows(statement=record, assign=False, store=False)

        cs = s.current_crawl_step
        res = s._test_only_get_influence_map()[cs]

        # now test update
        res3 = s.propagate_flows(statement=record, assign=False, store=True)

        # return values should be unchanged from before (but now it's an update)
        assert res3.get_flows_by_prop() == res2.get_flows_by_prop()

        assert res[(flow_path, 'B')].get_flows_by_prop() == res3.get_flows_by_prop()  # {'N->X->A->B', 'M->Y->A->B'}
        assert res[(flow_path, 'X')].get_flows_by_prop() == {F('N->X')}
        assert res[(flow_path, 'Y')].get_flows_by_prop() == {F('M->Y')}

    def test_state_propagate_flows_by_record_simple_missing_influencer(self):
        s = make_simple_state()
        stmt = self.recordBtoC
        flow_path = A_PATH
        s.formula_map = {}
        cs = s.current_crawl_step
        s._test_only_set_influence_map({cs: {
            (flow_path, 'X'): FlowVector.from_flows({F('N->X')}),
            (flow_path, 'Y'): FlowVector.from_flows({F('M->Y')})
        }})
        # Now add a case where the influencer is missing:
        res = s.propagate_flows(statement=stmt, assign=True, store=True)
        assert len(res.get_flows_by_prop()) == 1

        # check that the influencer has *not* been added
        assert (flow_path, 'B') in s._test_only_get_influence_map()[cs]

        # check that the influenced *has* been added and is influenced by C:
        df = list(s._test_only_get_influence_map()[cs][(flow_path, 'C')].get_flows_by_prop())[0]
        assert df.influencer_name == 'B'
        assert df.influenced_name == 'C'

    def test_state_propagate_flows_by_record_simple_missing_influencer_store(self):
        s = make_simple_state()
        stmt = self.recordBtoC
        flow_path = A_PATH
        s.formula_map = {}
        cs = s.current_crawl_step
        s._test_only_set_influence_map({cs: {
            (flow_path, 'X'): FlowVector.from_flows({F('N->X')}),
            (flow_path, 'Y'): FlowVector.from_flows({F('M->Y')})
        }})
        # Now add a case where the influencer is missing:
        res = s.propagate_flows(statement=stmt, assign=True, store=True)
        assert len(res.get_flows_by_prop()) == 1

        # check that the influencer has *not* been added
        assert (flow_path, 'B') in s._test_only_get_influence_map()[cs]

        # check that the influenced has been added and is influenced by C:
        df = list(s._test_only_get_influence_map()[cs][(flow_path, 'C')].get_flows_by_prop())[0]
        assert df.influencer_name == 'B'
        assert df.influenced_name == 'C'

        assert len(s._test_only_get_influence_map()[cs]) == 4

    """
    
                End of Propagate Flows Tests
    
    """

    def test_state_initialize_variables_from_elems(self):
        a_state = self.simple_state
        a_state.flow_path = 'foo'
        ns = 'http://soap.sforce.com/2006/04/metadata'
        my_xml = f'<variables xmlns="{ns}"><name>a_name</name><code>test_source</code></variables>'
        el = ET.fromstring(my_xml)
        a_state._initialize_variables_from_elems({el})
        cs = a_state.current_crawl_step
        assert ('foo', 'a_name') in a_state._test_only_get_influence_map()[cs]
        vec = a_state._test_only_get_influence_map()[cs][('foo', 'a_name')]
        dfs = list(vec.get_flows_by_prop())
        assert dfs[0].influencer_name == dfs[0].influenced_name
        assert dfs[0].influencer_name == 'a_name'
        assert dfs[0].influenced_filepath == 'foo'
        assert dfs[0].influencer_filepath == 'foo'
        assert len(dfs[0].history) == 1

    def test_get_flows_from_sources_member(self):
        s = make_state_with_influence_map([FlowVector(
            property_maps={F('Y->Y'): {'b': {F('taint->Y.b')}}})])
        res = s.get_flows_from_sources(influenced_var='Y.b', source_vars={(A_PATH, 'taint')})
        assert len(res) == 1
        assert list(res)[0].short_report(arrows=True) == 'taint->Y.b'

    def test_get_flows_from_sources_obj(self):
        s = make_state_with_influence_map([FlowVector(
            property_maps={F('W->Z'): {'b': {F('taint->Z.b')}}})])
        s.formula_map = FLOW_MAP
        res = s.get_flows_from_sources(influenced_var='X', source_vars={(A_PATH, 'taint')})
        assert len(res) == 1
        assert list(res)[0].short_report(arrows=True) == 'taint->Z.b->X.b*'

    def test_get_flows_from_sources_null(self):
        s = make_state_with_influence_map()
        s.formula_map = FLOW_MAP
        res = s.get_flows_from_sources(influenced_var='W', source_vars={(A_PATH, 'taint')})
        assert res is None

    def test_get_flows_from_sources_null_infl(self):
        s = make_state_with_influence_map()
        s.formula_map = FLOW_MAP
        res = s.get_flows_from_sources(influenced_var=None, source_vars={(A_PATH, 'taint')})
        assert res is None

    def test_get_flows_from_sources_null_src(self):
        s = make_state_with_influence_map()
        s.formula_map = FLOW_MAP
        res = s.get_flows_from_sources(influenced_var='foo', source_vars=None)
        assert res is None

    def test_get_flows_from_sources_empty_set_src(self):
        s = make_state_with_influence_map()
        s.formula_map = FLOW_MAP
        res = s.get_flows_from_sources(influenced_var='foo', source_vars={})
        assert res is None

    def test_get_or_add_vector_not_present_in_arg(self):
        s = make_simple_state()
        res = s.get_or_make_vector('not_present')
        assert isinstance(res, branch_state.FlowVector)
        assert list(res.property_maps.keys())[0].influenced_name == 'not_present'
        vec = s.get_or_make_vector('not_present')
        assert vec == res

    def test_get_or_add_vector_not_present_in_arg_idempotent(self):
        s = make_simple_state()
        res = s.get_or_make_vector('not_present')
        vec = s.get_or_make_vector('not_present')
        assert vec == res

    def test_get_or_add_vector_not_present_unparseable(self):
        s = make_simple_state()
        s.parser = helper.BadParser()
        res = s.get_or_make_vector('present')
        assert res is None
        res = s.get_or_make_vector('good_name')
        assert res is not None

    def test_get_all_output_vectors(self):
        vec = FlowVector(property_maps={F('A->A'): None})
        s = make_state_with_influence_map([vec])
        s.parser.output_variables = frozenset({(s.parser.flow_path, 'A')})
        res = s.get_all_output_vectors()
        assert res == [((s.flow_path, 'A'), vec)]

    def test_get_all_output_vectors_null(self):
        vec = FlowVector(property_maps={F('A->A'): None})
        s = make_state_with_influence_map([vec])
        s.parser.output_variables = None
        res = s.get_all_output_vectors()
        assert res == []

    def test_get_all_output_vectors_empty_set(self):
        vec = FlowVector(property_maps={F('A->A'): None})
        s = make_state_with_influence_map([vec])
        s.parser.output_variables = {}
        res = s.get_all_output_vectors()
        assert res == []
