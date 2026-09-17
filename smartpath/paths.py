"""Candidate path enumeration."""

from __future__ import annotations

import networkx as nx

from .protocols import PROTOCOLS, ospf_cost
from .topology import as_path

MAX_HOPS = 7
MAX_CANDIDATES = 8


def _as_loop_free(path: list[str]) -> bool:
    ases = as_path(path)
    return len(ases) == len(set(ases))


def candidate_paths(g: nx.Graph, src: str, dst: str) -> list[list[str]]:
    """Up to MAX_CANDIDATES loop-free paths, cheapest first, always including the
    path each traditional protocol would choose so they compete on equal terms."""
    every = [
        p
        for p in nx.all_simple_paths(g, src, dst, cutoff=MAX_HOPS)
        if _as_loop_free(p)
    ]
    every.sort(key=lambda p: (ospf_cost(p), len(p)))
    chosen = every[:MAX_CANDIDATES]
    for select in PROTOCOLS.values():
        p = select(every)
        if p not in chosen:
            chosen.append(p)
    return chosen


def path_id(path: list[str]) -> str:
    return "-".join(path)
