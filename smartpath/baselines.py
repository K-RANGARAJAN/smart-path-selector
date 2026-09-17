"""Offline analysis: how the static protocol choices perform on recorded traffic."""

from __future__ import annotations

import pandas as pd

from .paths import candidate_paths, path_id
from .protocols import PROTOCOLS, ospf_cost
from .topology import as_path, build_graph


def protocol_routes() -> pd.DataFrame:
    g = build_graph()
    rows = []
    for pair in sorted({(s, d) for s, d in [("R1", "R12"), ("R1", "R11"), ("R3", "R11"), ("R2", "R12")]}):
        cands = candidate_paths(g, *pair)
        for name, select in PROTOCOLS.items():
            p = select(cands)
            rows.append({"flow": f"{pair[0]}->{pair[1]}", "protocol": name, "path": path_id(p), "hops": len(p) - 1,
                         "ospf_cost": ospf_cost(p), "as_path": " ".join(map(str, as_path(p)))})
    return pd.DataFrame(rows)


def static_vs_oracle(df: pd.DataFrame) -> pd.DataFrame:
    """Mean next-tick quality of each protocol's fixed path, the best fixed path in
    hindsight, and the per-tick best path (oracle), per flow."""
    routes = protocol_routes()
    out = []
    for (src, dst), g in df.groupby(["src", "dst"]):
        flow = f"{src}->{dst}"
        row = {"flow": flow}
        for _, r in routes[routes.flow == flow].iterrows():
            row[r.protocol] = g.loc[g.path == r.path, "target_score"].mean()
        row["Best fixed path"] = g.groupby("path").target_score.mean().max()
        row["Oracle (per tick)"] = g.loc[g.groupby("tick").target_score.idxmax(), "target_score"].mean()
        row["Best path changes"] = int((g.loc[g.groupby("tick").target_score.idxmax(), "path"].pipe(lambda s: s.ne(s.shift())).sum()) - 1)
        out.append(row)
    return pd.DataFrame(out).set_index("flow")
