"""Link and path performance metrics, and the path quality score.

Link behaviour is derived from utilisation u:
  queueing delay  ~ service_time * u / (1 - u)        (M/M/1 shape, capped)
  jitter          ~ proportional to queueing delay
  packet loss     ~ small floor + a sharp rise as the buffer overflows near saturation
  available bw    = capacity * (1 - u)

Quality score (0-100) of a path combines a simplified ITU-T G.107 E-model R-factor
(delay, jitter and loss impairments, Cole & Rosenbluth 2001) with a throughput
sufficiency factor for the flow's bandwidth demand.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .topology import LinkSpec

MAX_QUEUE_MS = 250.0
FLOW_DEMAND_MBPS = 150.0
PING_PROBES = 100


@dataclass(frozen=True)
class LinkState:
    latency_ms: float
    jitter_ms: float
    loss: float  # fraction 0-1
    avail_bw_mbps: float
    utilisation: float


@dataclass(frozen=True)
class PathMetrics:
    latency_ms: float
    jitter_ms: float
    loss_pct: float
    avail_bw_mbps: float
    hop_count: int
    bottleneck_capacity_mbps: float
    max_utilisation: float


def link_state(spec: LinkSpec, u: float) -> LinkState:
    service_ms = 6.5 * math.sqrt(1000.0 / spec.capacity_mbps)
    queue_ms = min(MAX_QUEUE_MS, service_ms * u / (1.0 - u))
    jitter = 0.25 * queue_ms + 0.2
    loss = 0.0005 + 0.12 / (1.0 + math.exp(-(u - 0.9) / 0.02))
    return LinkState(
        latency_ms=spec.prop_delay_ms + queue_ms,
        jitter_ms=jitter,
        loss=loss,
        avail_bw_mbps=spec.capacity_mbps * (1.0 - u),
        utilisation=u,
    )


def aggregate(states: list[LinkState], specs: list[LinkSpec]) -> PathMetrics:
    survive = 1.0
    for s in states:
        survive *= 1.0 - s.loss
    return PathMetrics(
        latency_ms=sum(s.latency_ms for s in states),
        jitter_ms=math.sqrt(sum(s.jitter_ms**2 for s in states)),
        loss_pct=100.0 * (1.0 - survive),
        avail_bw_mbps=min(s.avail_bw_mbps for s in states),
        hop_count=len(states),
        bottleneck_capacity_mbps=min(sp.capacity_mbps for sp in specs),
        max_utilisation=max(s.utilisation for s in states),
    )


def measure(true: PathMetrics, rng: np.random.Generator) -> PathMetrics:
    """What active probing would report: noisy latency/jitter/bandwidth estimates and
    loss counted over a finite number of ping probes."""
    lost = rng.binomial(PING_PROBES, min(1.0, true.loss_pct / 100.0))
    return PathMetrics(
        latency_ms=true.latency_ms * rng.lognormal(0, 0.08),
        jitter_ms=true.jitter_ms * rng.lognormal(0, 0.25),
        loss_pct=100.0 * lost / PING_PROBES,
        avail_bw_mbps=true.avail_bw_mbps * rng.lognormal(0, 0.10),
        hop_count=true.hop_count,
        bottleneck_capacity_mbps=true.bottleneck_capacity_mbps,
        max_utilisation=true.max_utilisation,
    )


def r_factor(latency_ms: float, jitter_ms: float, loss_pct: float) -> float:
    d = latency_ms + 2.0 * jitter_ms + 10.0
    i_d = 0.024 * d + (0.11 * (d - 177.3) if d > 177.3 else 0.0)
    i_e = 30.0 * math.log(1.0 + 15.0 * loss_pct / 100.0)
    return 93.2 - i_d - i_e


def quality_score(
    latency_ms: float,
    jitter_ms: float,
    loss_pct: float,
    avail_bw_mbps: float,
    demand_mbps: float = FLOW_DEMAND_MBPS,
) -> float:
    r = min(93.2, max(0.0, r_factor(latency_ms, jitter_ms, loss_pct)))
    bw = min(1.0, max(0.0, avail_bw_mbps) / demand_mbps) ** 0.5
    return 100.0 * (r / 93.2) * bw


def path_score(m: PathMetrics) -> float:
    return quality_score(m.latency_ms, m.jitter_ms, m.loss_pct, m.avail_bw_mbps)
