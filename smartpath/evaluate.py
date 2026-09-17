"""Closed-loop routing comparison on unseen traffic.

Every strategy routes the same flows through the same simulated network, tick by
tick. A strategy decides from what is observable now; it is scored on what its
chosen path actually delivers in the next tick.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .live import ML, ORACLE, STRATEGIES, RoutingSession
from .topology import link_key, path_links

POOR_QUALITY = 60.0  # below this a video call / interactive session is visibly degraded
STRATEGY_ORDER = STRATEGIES


def run(model, ticks: int = 2000, seed: int = 3, margin: float | None = None) -> pd.DataFrame:
    session = RoutingSession(model, seed=seed, margin=margin)
    rows = []
    for _ in range(ticks):
        for pair, ft in session.step().items():
            best = ft.result(ORACLE).realised
            for strategy in STRATEGIES:
                c = ft.result(strategy)
                rows.append(
                    {
                        "tick": ft.tick,
                        "pair": f"{pair[0]}->{pair[1]}",
                        "strategy": strategy,
                        "path": c.path_id,
                        "score": c.realised,
                        "latency_ms": c.realised_latency_ms,
                        "loss_pct": c.realised_loss_pct,
                        "avail_bw_mbps": c.realised_avail_bw_mbps,
                        "regret": best - c.realised,
                        "optimal": c.realised >= best - 1.0,
                    }
                )
    return pd.DataFrame(rows)


def summarise(trace: pd.DataFrame) -> pd.DataFrame:
    trace = trace.sort_values(["strategy", "pair", "tick"])
    changed = trace.groupby(["strategy", "pair"]).path.transform(lambda p: p.ne(p.shift()) & p.shift().notna())
    trace = trace.assign(changed=changed)
    flows = trace.groupby("strategy")
    n_flow_ticks = trace[trace.strategy == ORACLE].shape[0]
    summary = pd.DataFrame(
        {
            "mean_quality": flows.score.mean(),
            "p10_quality": flows.score.quantile(0.10),
            "mean_latency_ms": flows.latency_ms.mean(),
            "p95_latency_ms": flows.latency_ms.quantile(0.95),
            "mean_loss_pct": flows.loss_pct.mean(),
            "poor_quality_pct": flows.score.apply(lambda s: 100 * (s < POOR_QUALITY).mean()),
            "near_optimal_pct": flows.optimal.mean() * 100,
            "mean_regret": flows.regret.mean(),
            "route_changes_per_1000": flows.changed.sum() / n_flow_ticks * 1000,
        }
    )
    return summary.reindex([s for s in STRATEGY_ORDER if s in summary.index])


def congestion_drill(
    model,
    seeds: range = range(100, 120),
    link: tuple[str, str] = ("R5", "R6"),
    pair: tuple[str, str] = ("R1", "R12"),
    lead_in: int = 30,
    duration: int = 40,
    peak: float = 0.6,
) -> dict:
    """Inject a congestion episode on one backbone link and measure how each
    strategy's flow fares while it lasts, and how fast ML moves off the link."""
    key = link_key(*link)
    quality = {s: [] for s in STRATEGIES}
    reaction = []
    for seed in seeds:
        session = RoutingSession(model, seed=seed)
        for _ in range(lead_in):
            ft = session.step()[pair]
        on_link = key in path_links(ft.result(ML).path)
        session.sim.inject_congestion(*link, duration=duration, peak=peak)
        left_at = None
        for t in range(duration):
            ft = session.step()[pair]
            for s in STRATEGIES:
                quality[s].append(ft.result(s).realised)
            if on_link and left_at is None and key not in path_links(ft.result(ML).path):
                left_at = t + 1
        if on_link and left_at is not None:
            reaction.append(left_at)
    return {
        "link": "-".join(link),
        "flow": f"{pair[0]}->{pair[1]}",
        "runs": len(seeds),
        "duration_ticks": duration,
        "peak_added_utilisation": peak,
        "mean_quality_during_event": {s: float(np.mean(v)) for s, v in quality.items()},
        "poor_quality_pct_during_event": {s: float(100 * np.mean(np.array(v) < POOR_QUALITY)) for s, v in quality.items()},
        "ml_runs_on_link_at_injection": len(reaction),
        "ml_ticks_to_leave_link": {"mean": float(np.mean(reaction)) if reaction else None,
                                   "max": int(max(reaction)) if reaction else None},
    }
