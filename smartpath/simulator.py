"""Tick-based network simulator.

At each tick the simulator can *observe* every candidate path (noisy active
measurements, as a router's probes would see them) and, after advancing time,
report the *true* performance each path delivered over the next tick. Models are
trained to predict the latter from the former.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

from .metrics import PathMetrics, aggregate, link_state, measure, path_score
from .paths import candidate_paths, path_id
from .topology import FLOW_PAIRS, LINKS, build_graph, link_specs, path_links
from .traffic import TrafficModel

FEATURES = [
    "latency_ms",
    "jitter_ms",
    "loss_pct",
    "avail_bw_mbps",
    "hop_count",
    "bottleneck_capacity_mbps",
    "latency_delta_ms",
    "loss_delta_pct",
    "avail_bw_delta_mbps",
]


@dataclass
class Observation:
    pair: tuple[str, str]
    path: list[str]
    measured: PathMetrics
    features: dict[str, float]

    @property
    def path_id(self) -> str:
        return path_id(self.path)


class NetworkSimulator:
    def __init__(self, seed: int = 0, pairs: list[tuple[str, str]] | None = None):
        self.rng = np.random.default_rng(seed)
        self.graph = build_graph()
        self.specs = link_specs()
        self.traffic = TrafficModel(LINKS, self.rng)
        self.pairs = pairs or list(FLOW_PAIRS)
        self.candidates = {p: candidate_paths(self.graph, *p) for p in self.pairs}
        self._last: dict[str, PathMetrics] = {}
        self.util = self.traffic.utilisation()

    @property
    def tick(self) -> int:
        return self.traffic.tick

    def true_metrics(self, path: list[str]) -> PathMetrics:
        keys = path_links(path)
        specs = [self.specs[k] for k in keys]
        states = [link_state(s, self.util[k]) for s, k in zip(specs, keys)]
        return aggregate(states, specs)

    def observe(self, pair: tuple[str, str]) -> list[Observation]:
        out = []
        for path in self.candidates[pair]:
            m = measure(self.true_metrics(path), self.rng)
            pid = path_id(path)
            prev = self._last.get(pid, m)
            self._last[pid] = m
            feats = {
                "latency_ms": m.latency_ms,
                "jitter_ms": m.jitter_ms,
                "loss_pct": m.loss_pct,
                "avail_bw_mbps": m.avail_bw_mbps,
                "hop_count": m.hop_count,
                "bottleneck_capacity_mbps": m.bottleneck_capacity_mbps,
                "latency_delta_ms": m.latency_ms - prev.latency_ms,
                "loss_delta_pct": m.loss_pct - prev.loss_pct,
                "avail_bw_delta_mbps": m.avail_bw_mbps - prev.avail_bw_mbps,
            }
            out.append(Observation(pair, path, m, feats))
        return out

    def advance(self) -> None:
        self.util = self.traffic.step()

    def realised(self, path: list[str]) -> tuple[float, PathMetrics]:
        m = self.true_metrics(path)
        return path_score(m), m

    def inject_congestion(self, a: str, b: str, duration: int = 40, peak: float = 0.5) -> None:
        key = (a, b) if a < b else (b, a)
        self.traffic.inject(key, duration, peak)

    def warm_up(self, ticks: int = 50) -> None:
        for _ in range(ticks):
            for pair in self.pairs:
                self.observe(pair)
            self.advance()


def metrics_dict(m: PathMetrics) -> dict[str, float]:
    return asdict(m)
