"""Background traffic model.

Each link's utilisation follows a mean-reverting AR(1) process around its base level,
plus a slow daily cycle, plus congestion episodes (e.g. a backup job or flash crowd)
that ramp up, persist for a while and fade. Episodes can also be injected by hand.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .topology import LinkSpec

TICKS_PER_DAY = 480  # one tick is three simulated minutes


@dataclass
class CongestionEvent:
    remaining: int
    duration: int
    peak: float

    def boost(self) -> float:
        elapsed = self.duration - self.remaining
        ramp = min(1.0, (elapsed + 1) / 4)
        fade = min(1.0, self.remaining / 4)
        return self.peak * min(ramp, fade)


@dataclass
class LinkTraffic:
    spec: LinkSpec
    phase: float
    level: float
    events: list[CongestionEvent] = field(default_factory=list)


class TrafficModel:
    PHI = 0.85
    NOISE = 0.035
    DAILY_AMPLITUDE = 0.10

    def __init__(self, specs: list[LinkSpec], rng: np.random.Generator):
        self.rng = rng
        self.tick = 0
        self.links = {
            s.key: LinkTraffic(spec=s, phase=rng.uniform(0, 0.25), level=s.base_util)
            for s in specs
        }

    def utilisation(self) -> dict[tuple[str, str], float]:
        out = {}
        for key, lt in self.links.items():
            u = lt.level + sum(e.boost() for e in lt.events)
            out[key] = float(np.clip(u, 0.01, 0.995))
        return out

    def inject(self, key: tuple[str, str], duration: int = 40, peak: float = 0.5) -> None:
        self.links[key].events.append(CongestionEvent(duration, duration, peak))

    def step(self) -> dict[tuple[str, str], float]:
        self.tick += 1
        day = 2 * math.pi * self.tick / TICKS_PER_DAY
        for lt in self.links.values():
            s = lt.spec
            target = s.base_util + self.DAILY_AMPLITUDE * math.sin(day + 2 * math.pi * lt.phase)
            lt.level = target + self.PHI * (lt.level - target) + self.rng.normal(0, self.NOISE)
            for e in lt.events:
                e.remaining -= 1
            lt.events = [e for e in lt.events if e.remaining > 0]
            if self.rng.random() < s.event_rate:
                duration = int(self.rng.integers(10, 60))
                lt.events.append(CongestionEvent(duration, duration, float(self.rng.uniform(0.25, 0.6))))
        return self.utilisation()
