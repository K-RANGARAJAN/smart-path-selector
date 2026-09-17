"""Multi-AS network topology used by the simulator.

The topology is deliberately built so that the three classic protocols disagree:

* RIP (fewest hops) prefers routes through AS300 that cross a 100 Mbps link.
* OSPF (reference bandwidth / link bandwidth) prefers the 10 Gbps AS200 backbone,
  which is shared with a lot of other traffic and is where congestion happens.
* BGP prefers AS300 by local preference (the cheaper transit contract), whatever
  its performance.

Positions are only used for drawing.
"""

from __future__ import annotations

from dataclasses import dataclass

import networkx as nx

OSPF_REFERENCE_BW_MBPS = 10_000


@dataclass(frozen=True)
class LinkSpec:
    a: str
    b: str
    capacity_mbps: float
    prop_delay_ms: float
    # Long-run mean background utilisation and how often congestion episodes start.
    base_util: float
    event_rate: float

    @property
    def key(self) -> tuple[str, str]:
        return link_key(self.a, self.b)

    @property
    def ospf_cost(self) -> int:
        return max(1, round(OSPF_REFERENCE_BW_MBPS / self.capacity_mbps))


def link_key(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a < b else (b, a)


ROUTERS: dict[str, dict] = {
    # name: AS number, (x, y) drawing position in a 0-100 box
    "R1": {"asn": 100, "pos": (6, 50)},
    "R2": {"asn": 100, "pos": (20, 28)},
    "R3": {"asn": 100, "pos": (20, 72)},
    "R4": {"asn": 100, "pos": (30, 55)},
    "R5": {"asn": 200, "pos": (42, 14)},
    "R6": {"asn": 200, "pos": (60, 8)},
    "R7": {"asn": 200, "pos": (76, 20)},
    "R8": {"asn": 300, "pos": (44, 80)},
    "R9": {"asn": 300, "pos": (60, 58)},
    "R10": {"asn": 300, "pos": (74, 86)},
    "R11": {"asn": 400, "pos": (90, 34)},
    "R12": {"asn": 400, "pos": (94, 64)},
}

AS_NAMES = {
    100: "AS100 Campus",
    200: "AS200 ISP-A backbone",
    300: "AS300 ISP-B",
    400: "AS400 Data centre",
}

# BGP local preference configured on AS100 for each neighbouring AS (higher wins).
BGP_LOCAL_PREF = {200: 100, 300: 200}

LINKS: list[LinkSpec] = [
    # AS100 campus
    LinkSpec("R1", "R2", 1000, 1.0, 0.20, 0.002),
    LinkSpec("R1", "R3", 1000, 1.0, 0.20, 0.002),
    LinkSpec("R2", "R4", 1000, 1.0, 0.15, 0.002),
    LinkSpec("R3", "R4", 1000, 1.0, 0.15, 0.002),
    # AS100 uplinks
    LinkSpec("R2", "R5", 10000, 4.0, 0.30, 0.008),
    LinkSpec("R4", "R9", 1000, 7.0, 0.40, 0.006),
    LinkSpec("R3", "R8", 1000, 5.0, 0.30, 0.004),
    # AS200 backbone: fast, heavily shared, frequently congested
    LinkSpec("R5", "R6", 10000, 6.0, 0.35, 0.014),
    LinkSpec("R6", "R7", 10000, 6.0, 0.35, 0.014),
    LinkSpec("R5", "R7", 1000, 16.0, 0.40, 0.006),
    LinkSpec("R7", "R11", 10000, 3.0, 0.30, 0.008),
    # AS200 <-> AS300 peering
    LinkSpec("R6", "R9", 1000, 6.0, 0.30, 0.005),
    # AS300: slower links, quieter
    LinkSpec("R8", "R9", 1000, 6.0, 0.45, 0.007),
    LinkSpec("R9", "R10", 1000, 6.0, 0.50, 0.008),
    LinkSpec("R8", "R10", 100, 12.0, 0.40, 0.006),
    LinkSpec("R10", "R12", 1000, 4.0, 0.45, 0.008),
    # AS400 data centre
    LinkSpec("R11", "R12", 10000, 1.0, 0.25, 0.003),
]

# Source/destination pairs whose traffic we route.
FLOW_PAIRS: list[tuple[str, str]] = [
    ("R1", "R12"),
    ("R1", "R11"),
    ("R3", "R11"),
    ("R2", "R12"),
]


def build_graph() -> nx.Graph:
    g = nx.Graph()
    for name, info in ROUTERS.items():
        g.add_node(name, **info)
    for spec in LINKS:
        g.add_edge(spec.a, spec.b, spec=spec, ospf_cost=spec.ospf_cost)
    return g


def link_specs() -> dict[tuple[str, str], LinkSpec]:
    return {spec.key: spec for spec in LINKS}


def path_links(path: list[str]) -> list[tuple[str, str]]:
    return [link_key(a, b) for a, b in zip(path, path[1:])]


def as_path(path: list[str]) -> list[int]:
    """Sequence of distinct AS numbers traversed, in order."""
    out: list[int] = []
    for router in path:
        asn = ROUTERS[router]["asn"]
        if not out or out[-1] != asn:
            out.append(asn)
    return out
