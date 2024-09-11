import unittest
from unittest import TestCase

from test import helper as helper
from test.helper import F, A_PATH, B_PATH

from flowtest import flows
from public.data_obj import DataInfluencePath, DataInfluenceStatement
from flowtest.flows import FlowVector


def pretty(mylist) -> {(str,)}:
    accum = set()
    for row in mylist:
        if isinstance(row, tuple) or isinstance(row, set):
            accum.add(tuple(l_string(x) for x in row))
        else:
            accum.add(l_string(row))
    return accum


def l_string(x):
    if isinstance(x, DataInfluencePath):
        return x.short_report(arrows=True)
    elif isinstance(x, str):
        return x
    elif x is None:
        return "None"
    else:
        return x.__str()


class TestFlowVector(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.vecB = FlowVector.from_flows({F('B->B')})
        cls.simple_vec = FlowVector.from_flows({F('A->A')})
        cls.vec = FlowVector(
            property_maps={F('A->A'): {'x': {F('C->A.x')},
                                       's': {F('G.w->A.s')}},
                           F('B->A'): None
                           }
        )
        cls.vec2 = FlowVector(
            property_maps={F('A->A'): {"x": {F("C->A.x"), F("D->A.x"), F("E->A.x")},
                                       "s": {F("G.w->A.s")}},
                           F('B->A'): None
                           }
        )

        cls.vec3 = FlowVector(
            property_maps={F('A->A'): {"x": {F("D->A.x"), F("K->A.x")},
                                       "s": None},
                           F('B->A'): {"s": {F("G.w->A.s")}},
                           F('C->A'): {"z": {F("J.x->A.x")}}
                           }
        )

    def test_new_combined_flow_no_members(self):
        start_flow = F('A->B')
        end_flow = F('B->C')
        a_flow = DataInfluencePath.combine(start_flow, end_flow)

        assert isinstance(a_flow, flows.DataInfluencePath)
        assert a_flow.influencer_name == "A"
        assert a_flow.influenced_name == "C"
        assert a_flow.influencer_filepath == start_flow.influencer_filepath
        assert a_flow.influenced_filepath == end_flow.influenced_filepath
        assert len(a_flow.history) == 2
        assert a_flow.history[0] == start_flow.history[0]
        assert a_flow.history[1] == end_flow.history[0]

    def test_new_combined_flow_mismatch_end(self):
        start_flow = F('A->B')
        end_flow = F('B->C')
        other_flow = F('C->D')

        self.assertRaises(ValueError, DataInfluencePath.combine,
                          end_flow, start_flow)
        self.assertRaises(ValueError, DataInfluencePath.combine,
                          start_flow, other_flow)

    def test_new_combined_paths_cross_flow(self):
        # Now test cross flows
        start_flow = F('A->B')
        other_path_flow = F('B->C', tgt_path=B_PATH)

        cross_flow = DataInfluencePath.combine(start_flow, other_path_flow, cross_flow=True)

        assert cross_flow.influencer_filepath == start_flow.influencer_filepath
        assert cross_flow.influenced_filepath == other_path_flow.influenced_filepath
        assert len(cross_flow.history) == 2

    def test_new_combined_flow_mismatch_end_member(self):
        start_flow = F('A->B')
        end_flow = F('B.x->C.y')
        new_flow = DataInfluencePath.combine(start_flow=start_flow, end_flow=end_flow)
        assert len(new_flow.history) == 2
        assert new_flow.influencer_property is None
        assert new_flow.influenced_property == "y"

    def test_from_flows(self):
        res = FlowVector.from_flows({F('A->A')})
        assert isinstance(res, FlowVector)
        assert res.property_maps == {F('A->A'): None}

    def test_from_flows_multiple(self):
        path1 = F('X.b->A')  # No issue with having an influencer property
        path2 = F('A->A')
        path3 = F('B->A')
        res = FlowVector.from_flows({path1, path2, path3})
        assert res.property_maps == {path1: None, path2: None, path3: None}

    def test_from_flows_no_properties(self):
        """Because this flow influences only a portion of A,
           it cannot be used to initialize the FlowVector for A.
           Initializing flows can have no influenced property"""

        bad_flow = F("X->A.b")
        self.assertRaises(ValueError, FlowVector.from_flows, {bad_flow})

    def test_from_flows_error_on_null_defaults(self):
        self.assertRaises(ValueError, FlowVector.from_flows, {})
        self.assertRaises(ValueError, FlowVector.from_flows, None)

    def test_from_flows_error_on_mismatched_names(self):
        """
        Initializer flows must all point to (influence) the same variable
        """
        self.assertRaises(ValueError, FlowVector.from_flows, {F('A->B'), F('A->C')})

    def test_data_influence_record_constructor(self):
        record1 = DataInfluenceStatement(influenced_var="A",
                                         influencer_var="B",
                                         comment="created",
                                         flow_path=A_PATH,
                                         source_text="my_text",
                                         line_no=1,
                                         element_name="my_elem"
                                         )
        record2 = DataInfluenceStatement(influenced_var="A",
                                         influencer_var="B",
                                         comment="created",
                                         flow_path=A_PATH,
                                         source_text="my_text",
                                         line_no=1,
                                         element_name="my_elem"
                                         )
        assert record1 == record2
        assert record1.influenced_var == "A"

    def test_data_influence_path(self):
        ab = F('A->B')
        ab2 = F('A->B')
        assert ab == ab2

    def test_data_influence_path_short_report(self):
        ab = F('A->B')
        res2 = ab.short_report(arrows=True, filenames=False)
        assert res2 is not None
        assert res2 == 'A->B'

    def test_data_influence_path_short_report_no_arrows_no_filenames(self):
        ab = F('A->B')
        res3 = ab.short_report(arrows=False, filenames=False)
        assert res3 == 'A,B'

    def test_data_influence_path_short_report_no_arrows_yes_filenames(self):
        ab = F('A->B')
        res4 = ab.short_report(arrows=False, filenames=True)
        assert res4 == f'A(path:{A_PATH}),B(path:{A_PATH})'

    def test_data_influence_path_get_influence_chain(self):
        ab = F('A->B')
        res = ab.report_influence_tuples()
        assert res == [(f'{A_PATH}', 'A'), (f'{A_PATH}', 'B')]

    def test_search_props_empty(self):
        vec = self.vec2
        res_ = vec._search_props()
        assert len(res_) == 4
        res = pretty(res_)
        """
        vec2 is:
            property_maps={p_AA: {"x": {F("C->A.x"), F("D->A.x"), F("E->A.x")},
                               "s": {F("G.w->A.s")}},
                           p_BA: None
                           }
        so there are 4 non-zero flows, 3 for A->A at x and one at s. 
        """
        assert res == {('A->A', 'x', 'C->A.x'),
                       ('A->A', 'x', 'D->A.x'),
                       ('A->A', 'x', 'E->A.x'),
                       ('A->A', 's', 'G.w->A.s')}

    def test_search_props_prop_name(self):
        vec = self.vec2
        res = vec._search_props(prop_matcher=lambda x: x == 's')
        assert len(res) == 1
        assert pretty(res) == {('A->A', 's', 'G.w->A.s')}

    def test_get_flows_no_prop(self):
        res = self.vec2.get_flows_by_prop()
        s = pretty(res)
        # should get all flows, including all defaults and all overrides,
        # so 6 flows.
        assert s == {'C->A.x', 'D->A.x', 'E->A.x', 'G.w->A.s',  # these are overrides
                     'A->A', 'B->A'}  # these are the defaults

    def test_get_flows_w_prop(self):
        res = self.vec2.get_flows_by_prop('s')
        s = pretty(res)
        assert s == {'G.w->A.s',  # returned directly when the first flow is queried
                     'B.s*->A.s*'}  # induced map when the second flow is queried.

    def test_add_vector_simple(self):
        vecA = FlowVector.from_flows(F('A'))
        vecBA = FlowVector.from_flows(F('B->A'))
        vecR = FlowVector.from_flows({F('B->A'), F('A')})
        res = vecA.add_vector(vecBA)
        assert vecR.short_report() == res.short_report()
        assert vecR == res

    def test_add_vector_with_properties_to_itself(self):
        vecA = self.vec2
        vecB = vecA.add_vector(vecA)
        assert vecB == vecA

    def test_add_vector_with_prop_to_another(self):
        vec3 = self.vec2.add_vector(self.vec)
        """
        vec1:              {p_AA: {"x": {F("C->A.x")},
                                  "s": {F("G.w->A.s")}},
                           p_BA: None
                           }
        )
        vec2
                           {p_AA: {"x": {F("C->A.x"), F("D->A.x"), F("E->A.x")},
                                  "s": {F("G.w->A.s")}},
                           p_BA: None
                           }
         vec1 is contained in vec2, so the addition should be vec2         
        """
        assert vec3 == self.vec2

    def test_add_vector_two_complex(self):
        res = self.vec2.add_vector(self.vec3)

        """
                cls.vec2  {F('A->A'): {"x": {F("C->A.x"), F("D->A.x"), F("E->A.x")},
                                  "s": {F("G.w->A.s")}},
                           F('B->A'): None
                           }
        

                cls.vec3   {F('A->A'): {"x": {F("D->A.x"), F("K->A.x")},
                                        "s": None},
                           F('B->A'): {"s": {F("G.w->A.s")}},
                           F('C->A'): {"z": {F("J.x->A.x")}}
                           }
        )
        =========
        To add these, first take differences: vec3 has C->A which is not in vec2, so add that
       
        F('C->A'): {"z": {F("J.x->A.x")}}
        
        Then for B->A, take vec3, and add the induced map for vec2, as vec2 is missing it.
        F('B->A'): {"s": {F("G.w->A.s"), B.s*->B.s*}},
        
        Then for A->A, start with all of vec2 and add in the missing 
        from vec3 as well as the induced map from vec3 for x (since it has no x-entries)
                {"x": {F("C->A.x"), F("D->A.x"), F("E->A.x"), F("K->A.x")},
                                  "s": {F("G.w->A.s")}},
                
        """
        # so the sum should be:
        ans = res.report_dict()
        assert set(ans['A->A']['s']) == {'G.w->A.s', 'A.s*->A.s*'}
        assert set(ans['A->A']['x']) == {'C->A.x', 'D->A.x', 'E->A.x', 'K->A.x'}

        assert set(ans['A->A']['s']) == {'G.w->A.s', 'A.s*->A.s*'}
        assert set(ans['A->A']['x']) == {'C->A.x', 'D->A.x', 'E->A.x', 'K->A.x'}
        assert set(ans['B->A']['s']) == {'G.w->A.s', 'B.s*->A.s*'}
        assert set(ans['C->A']['z']) == {'J.x->A.x'}

    def test_assign_or_add_property_flows_vector_simple(self):
        t = F('Z->A.x')
        res = self.simple_vec._assign_or_add_property_flows(flows={t})
        report = res.report_dict()
        # check that the property was added
        assert report['A->A'] == {'x': {'Z->A.x'}}
        assert len(report) == 1

    def test_assign_or_add_property_flows_vector_w_props(self):
        t = F("Z->A.x")
        res = self.vec._assign_or_add_property_flows(flows={t})

        # Only the property of x has been replaced (in both),
        # the property s is unchanged.
        report = res.report_dict()
        assert report['A->A'] == {"x": {'Z->A.x'},
                                  "s": {'G.w->A.s'}
                                  }
        assert report['B->A'] == {"x": {'Z->A.x'}}
        assert len(report) == 2

    def test_assign_or_add_property_flows_add(self):
        t = F("Z->A.x")
        res = self.vec._assign_or_add_property_flows(flows={t}, assign=False)
        report = res.report_dict()

        """
                    vec  ={'A->A': {"x": {F("C->A.x")},
                                  "s": {F("G.w->A.s")}},
                           'B->A': None
                           }
                         when we add Z-> A.x, then for B->A, there is no override
                         so we add an induced one.
        """
        # Now the property relations should be added together
        assert report == {'A->A': {"x": {'C->A.x', 'Z->A.x'},
                                   's': {'G.w->A.s'},
                                   },
                          'B->A': {'x': {'Z->A.x', 'B.x*->A.x*'}}
                          }

    def test_assign_or_add_property_flows_null(self):
        # should get same vector back if passed with null argument

        res = self.vec._assign_or_add_property_flows(flows={}, assign=False)
        assert res == self.vec

    def test_assign_or_add_property_flows_null_property(self):
        # should get an exception if influenced property is not None

        t = F("Z.b->A")
        self.assertRaises(ValueError, self.vec._assign_or_add_property_flows, flows={t})

    def test_extend_by_path_no_prop_check_defaults(self):
        t = F('A->W')
        res = self.vec._extend_by_path(flow=t)
        report = res.report_dict()
        """
        vec is:
            property_maps={A->A: {"x": {C->A.x},
                                  "s": {"G.w->A.s}},
                           B->A: None
                           }
        )
        
        So extending by A->W should yield:
             property_maps={A->A->W: {"x": {C->A.x -> W.x},
                                      "s": {G.w->A.s -> W.s}},
                            B->A->W: None
                           } 
        """
        assert report['A->A->W'] == {'x': {'C->A.x->W.x*'},
                                     's': {'G.w->A.s->W.s*'}}
        assert report['B->A->W'] is None

        assert len(res.property_maps) == 2

    def test_extend_by_path_with_prop(self):
        t = F("A.x->T")
        res = self.vec._extend_by_path(flow=t)
        report = res.report_dict()
        """
        vec is:
            property_maps={p_AA: {"x": {C->A.x},
                               "s": {"G.w->A.s}},
                           p_BA: None
                           }
        )

        So extending by A.x --> T should yield: a vec
        with properties:
                    'C --> A.x --> T': None (pick up property flow)
                    'B.x --> A.x --> T': None (restrict B default flow)
        """
        assert report['C->A.x->T'] is None
        assert report['B.x*->A->T'] is None  # Note report bug with missing B.x*->A.x*
        assert len(res.property_maps.keys()) == 2

    def test_extend_by_path_with_prop_check_prop_map(self):
        t = F("A.s->T")
        res = self.vec._extend_by_path(flow=t)
        report = res.report_dict()
        assert report['G.w->A.s->T'] is None
        """
            Below, it has 'B.s*->A->T' instead 'B.s*->A.s*->T'. 
            
            This is a limitation that when we restrict paths, we change the influence start and end
            but not the influence statements, so only the first term is reliable in the report
            when the restriction starts the flow.
            
            If we fix this bug, we should update this test case, but this is only an issue for
            reporting so far as we are not peering into influence statements yet.
        """
        assert report['B.s*->A->T'] is None
        assert len(res.property_maps) == 2

    def test_extend_by_path_with_many_props(self):
        t = F("A.x->T")
        res = self.vec2._extend_by_path(flow=t)
        report = res.report_dict()
        """
                vec2
                           {p_AA: {"x": {F("C->A.x"), F("D->A.x"), F("E->A.x")},
                                  "s": {F("G.w->A.s")}},
                           p_BA: None
                           }
        """
        self.assertCountEqual(set(report.keys()), {'C->A.x->T', 'D->A.x->T', 'E->A.x->T', 'B.x*->A->T'})
        for x in report.keys():
            assert report[x] is None
        assert len(res.property_maps.keys()) == 4  # 3 from 0 and 1 from 1

    def test_combine_via_path(self):
        vec2 = self.vecB
        res = self.simple_vec.push_via_flow(F("A->B"), assign=True, influenced_vec=vec2)
        p = DataInfluencePath.combine(start_flow=F("A"), end_flow=F("A->B"))
        assert res.property_maps == {p: None}  # A->A->B: None

    def test_combine_via_path_add(self):
        vec1 = self.simple_vec  # A-A (initialization)
        vec2 = self.vecB
        res = vec1.push_via_flow(F("A->B"), assign=False, influenced_vec=vec2)
        report = {x.short_report() for x in list(res.property_maps.keys())}
        assert report == {'B,B', 'A,A,B'}  # should include the push of A and the paths of B (add)
        assert set(res.property_maps.values()) == {None}

    def test_combine_via_path_add_crossflow(self):
        vec1 = self.simple_vec  # A-A (initialization)
        vec2 = FlowVector.from_flows({F("B", src_path=helper.B_PATH)})
        res = vec1.push_via_flow(F("A->B", src_path=helper.A_PATH, tgt_path=helper.B_PATH),
                                 assign=False, influenced_vec=vec2, cross_flow=True)
        report = {x.short_report() for x in list(res.property_maps.keys())}
        assert report == {'B,B', 'A,A,B'}  # should include the push of A and the paths of B (add)

    def test_combine_via_path_complex_src_vec(self):
        vec1 = self.vec
        vec2 = self.vecB
        """
        src_vec is:
        ----------
            defaults={0: p_AA,
                      1: p_BA},
            property_maps={0: {"x": {C->A.x},
                               "s": {"G.w->A.s}},
                           1: None
                           }
        )
            So a flow from A to B should result in:
            ---------------------------------------
                defaults: AAB, BAB,
                props: {0: {"x": C->A.x->B.x* (* for restriction of flow)
                            "s": G.w->A.s->B.s*} (* for restriction of flow)
                        1: None}
        """
        res = vec1.push_via_flow(F("A->B"), assign=True, influenced_vec=vec2)
        report = res.report_dict()
        assert report['A->A->B']['s'] == {'G.w->A.s->B.s*'}  # * for restriction
        assert report['A->A->B']['x'] == {'C->A.x->B.x*'}
        assert report['B->A->B'] is None
        assert len(report) == 2

    def test_combine_via_path_add_complex_src_vec(self):
        vec1 = self.vec
        vec2 = FlowVector.from_flows({F("D")})
        res = vec1.push_via_flow(F("A.x->D"), assign=False, influenced_vec=vec2)

        """  
            src_vec is:
             ------------
             defaults={0: p_AA,
                      1: p_BA},
             property_maps={0: {"x": {C->A.x},
                               "s": {"G.w->A.s}},
                           1: None
                           }
            )
            So a flow from A.x to D should:
                - drop the first default and replace with override:
                    C->A.x->D
                - induce a restriction on second default:
                    B->A->D.x*
                and these two flows become the new defaults, with no properties
                These are then added to D, making a third default, with no props.
                
            """
        report = res.report_dict()
        assert report == {'B.x*->A->D': None,
                          'C->A.x->D': None,
                          'D->D': None}  # D->D is inherited from the `add`

    def test_combine_via_restriction_path_no_add(self):
        vec1 = FlowVector.from_flows({F("A"), F("B->A")})

        vec2 = FlowVector.from_flows({F("D")})
        res = vec1.push_via_flow(F("A.x->D"), assign=True, influenced_vec=vec2)
        report = res.report_dict()

        assert report == {'B.x*->A->D': None,  # restriction
                          'A.x*->A->D': None,
                          }

    def test_combine_via_path_add_crossflow_src_vec_add(self):
        vec1 = self.vec
        vec2_def = F("B", src_path=helper.B_PATH)
        vec2 = FlowVector.from_flows({vec2_def})
        res = vec1.push_via_flow(F("A.s->B.w", src_path=helper.A_PATH, tgt_path=helper.B_PATH),
                                 assign=False, influenced_vec=vec2, cross_flow=True)
        report = res.report_dict()
        """
                    vec1   {A->A: {"x": {F("C->A.x")},
                                   "s": {F("G.w->A.s")}},
                           B->A: None  # will generate an induced path
                           }
                    vec2 = B->B in B_Path
        """
        self.assertCountEqual(report['B->B']['w'], {'G.w->A.s->B.w', 'B.s*->A->B.w', 'B.w*->B.w*'})

        # now check paths. E.g. the default of the result is unchanged,
        # but we added an override with a source in a different flow path
        extended_flows = list(res.property_maps[vec2_def]['w'])

        for flow in extended_flows:
            if len(flow.history) != 1:  # exclude induced map
                assert flow.influencer_filepath == helper.A_PATH
                assert flow.influenced_filepath == helper.B_PATH

    def test_combine_via_path_add_crossflow_src_vec_assign(self):
        """
        We are injecting, into B
        """
        vec1 = self.vec
        vec2_def = F("B", src_path=helper.B_PATH)
        vec2 = FlowVector.from_flows({vec2_def})
        res1 = vec1.push_via_flow(F("A.s->B.w", src_path=helper.A_PATH, tgt_path=helper.B_PATH),
                                  assign=False, influenced_vec=vec2, cross_flow=True)
        report = res1.report_dict()
        """
                    vec1   {A->A: {"x": {F("C->A.x")},
                                   "s": {F("G.w->A.s")}},
                           B->A: None  # will generate an induced path
                           }
                    vec2 = B->B in B_Path
        """
        assert set(report['B->B']['w']) == {'G.w->A.s->B.w', 'B.s*->A->B.w', 'B.w*->B.w*'}  # induced path added

        # now check paths. E.g. the default of the result is unchanged,
        # but we added an override with a source in a different flow path
        extended_flows = list(res1.property_maps[vec2_def]['w'])

        for flow in extended_flows:
            if flow.influencer_property != 'w':  # exclude induced path
                assert flow.influencer_filepath == helper.A_PATH
                assert flow.influenced_filepath == helper.B_PATH


if __name__ == '__main__':
    unittest.main(verbosity=2)
