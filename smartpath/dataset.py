"""Generate the training / test dataset from the simulator."""

from __future__ import annotations

import pandas as pd

from .metrics import path_score
from .simulator import NetworkSimulator


def generate(ticks: int, seed: int) -> pd.DataFrame:
    sim = NetworkSimulator(seed=seed)
    sim.warm_up()
    rows = []
    for _ in range(ticks):
        tick = sim.tick
        observed = {pair: sim.observe(pair) for pair in sim.pairs}
        sim.advance()
        for pair, obs_list in observed.items():
            for obs in obs_list:
                score, true_next = sim.realised(obs.path)
                rows.append(
                    {
                        "seed": seed,
                        "tick": tick,
                        "src": pair[0],
                        "dst": pair[1],
                        "path": obs.path_id,
                        **obs.features,
                        "measured_score": path_score(obs.measured),
                        "next_latency_ms": true_next.latency_ms,
                        "next_loss_pct": true_next.loss_pct,
                        "next_avail_bw_mbps": true_next.avail_bw_mbps,
                        "next_max_utilisation": true_next.max_utilisation,
                        "target_score": score,
                    }
                )
    return pd.DataFrame(rows)
