"""Decision logic of the traditional protocols, applied to the same candidate paths.

These are faithful to each protocol's *path selection metric*; they do not model
message exchange or convergence (the topology does not fail in these experiments,
so every protocol has converged).
"""

from __future__ import annotations

import networkx as nx

from .topology import BGP_LOCAL_PREF, ROUTERS, as_path, link_specs, path_links


def _router_ids(path: list[str]) -> tuple[int, ...]:
    return tuple(int(r[1:]) for r in path)


def ospf_cost(path: list[str]) -> int:
    specs = link_specs()
    return sum(specs[k].ospf_cost for k in path_links(path))


def rip_select(paths: list[list[str]]) -> list[str]:
    """RIP: minimum hop count. Ties go to the route with the lowest router IDs,
    standing in for 'first route learned'."""
    return min(paths, key=lambda p: (len(p) - 1, _router_ids(p)))


def ospf_select(paths: list[list[str]]) -> list[str]:
    """OSPF: minimum sum of configured interface costs (Dijkstra result)."""
    return min(paths, key=lambda p: (ospf_cost(p), len(p), _router_ids(p)))


def bgp_select(paths: list[list[str]]) -> list[str]:
    """BGP best-path selection, simplified to the steps that matter here:
    1. highest local preference (set per neighbouring AS),
    2. shortest AS path,
    3. lowest IGP cost to the exit (OSPF cost),
    4. lowest router ID.
    """

    def key(p: list[str]):
        ases = as_path(p)
        neighbour = ases[1] if len(ases) > 1 else ases[0]
        local_pref = BGP_LOCAL_PREF.get(neighbour, 100)
        return (-local_pref, len(ases), ospf_cost(p), _router_ids(p))

    return min(paths, key=key)


def dijkstra_ospf_path(g: nx.Graph, src: str, dst: str) -> list[str]:
    return nx.dijkstra_path(g, src, dst, weight="ospf_cost")


PROTOCOLS = {"RIP": rip_select, "OSPF": ospf_select, "BGP": bgp_select}
