import networkx as nx

from smartpath.paths import candidate_paths
from smartpath.protocols import bgp_select, ospf_cost, ospf_select, rip_select
from smartpath.topology import FLOW_PAIRS, as_path, build_graph


def test_ospf_matches_dijkstra():
    g = build_graph()
    for src, dst in FLOW_PAIRS:
        expected = nx.dijkstra_path_length(g, src, dst, weight="ospf_cost")
        assert ospf_cost(ospf_select(candidate_paths(g, src, dst))) == expected


def test_rip_picks_fewest_hops():
    g = build_graph()
    for src, dst in FLOW_PAIRS:
        assert len(rip_select(candidate_paths(g, src, dst))) - 1 == nx.shortest_path_length(g, src, dst)


def test_bgp_prefers_local_pref_neighbour():
    g = build_graph()
    for src, dst in FLOW_PAIRS:
        assert as_path(bgp_select(candidate_paths(g, src, dst)))[1] == 300


def test_protocols_disagree_somewhere():
    g = build_graph()
    choices = {tuple(tuple(f(candidate_paths(g, s, d))) for f in (rip_select, ospf_select, bgp_select)) for s, d in FLOW_PAIRS}
    assert any(len(set(c)) == 3 for c in choices)


def test_candidates_are_as_loop_free_and_unique():
    g = build_graph()
    for src, dst in FLOW_PAIRS:
        cands = candidate_paths(g, src, dst)
        assert len({tuple(p) for p in cands}) == len(cands)
        for p in cands:
            ases = as_path(p)
            assert len(ases) == len(set(ases))
            assert p[0] == src and p[-1] == dst
