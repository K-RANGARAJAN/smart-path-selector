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
    manual: bool = False  # injected by hand rather than arising at random

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
        self.random_events = True
        self.ended_manual: list[tuple[str, str]] = []  # links whose injected jam ended on the last step
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
        self.links[key].events.append(CongestionEvent(duration, duration, peak, manual=True))

    def clear_manual(self) -> list[tuple[str, str]]:
        """Remove every injected episode; returns the links that had one."""
        cleared = []
        for key, lt in self.links.items():
            if any(e.manual for e in lt.events):
                cleared.append(key)
                lt.events = [e for e in lt.events if not e.manual]
        return cleared

    def set_random_events(self, enabled: bool) -> None:
        """Turn spontaneous congestion episodes on or off. Turning them off also
        clears the ones in progress; injected episodes are kept."""
        self.random_events = enabled
        if not enabled:
            for lt in self.links.values():
                lt.events = [e for e in lt.events if e.manual]

    def step(self) -> dict[tuple[str, str], float]:
        self.tick += 1
        self.ended_manual = []
        day = 2 * math.pi * self.tick / TICKS_PER_DAY
        for key, lt in self.links.items():
            s = lt.spec
            target = s.base_util + self.DAILY_AMPLITUDE * math.sin(day + 2 * math.pi * lt.phase)
            lt.level = target + self.PHI * (lt.level - target) + self.rng.normal(0, self.NOISE)
            for e in lt.events:
                e.remaining -= 1
            had_manual = any(e.manual for e in lt.events)
            lt.events = [e for e in lt.events if e.remaining > 0]
            if had_manual and not any(e.manual for e in lt.events):
                self.ended_manual.append(key)
            if self.rng.random() < s.event_rate and self.random_events:
                duration = int(self.rng.integers(10, 60))
                lt.events.append(CongestionEvent(duration, duration, float(self.rng.uniform(0.25, 0.6))))
        return self.utilisation()
