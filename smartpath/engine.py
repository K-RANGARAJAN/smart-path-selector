"""Recommendation engine: score every candidate path and pick one."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .metrics import path_score
from .simulator import FEATURES, Observation

SWITCH_MARGIN = 3.0  # quality points a new path must win by before we move traffic


@dataclass
class Recommendation:
    path: list[str]
    path_id: str
    predicted: float
    scores: dict[str, float]
    switched: bool


class RecommendationEngine:
    """Picks the path with the highest predicted quality.

    Hysteresis: the current path is kept unless another path is predicted to be
    better by at least `margin` points, which stops traffic flapping between
    near-equal paths on measurement noise.
    """

    def __init__(self, model, margin: float = SWITCH_MARGIN):
        if hasattr(model, "set_params") and "n_jobs" in model.get_params():
            # Scoring a handful of paths: thread start-up would dominate the latency.
            model.set_params(n_jobs=1)
        self.model = model
        self.margin = margin
        self.current: dict[tuple[str, str], str] = {}

    def score(self, observations: list[Observation]) -> list[float]:
        X = pd.DataFrame([o.features for o in observations], columns=FEATURES)
        return [float(v) for v in self.model.predict(X)]

    def recommend(self, observations: list[Observation]) -> Recommendation:
        return self._choose(observations, self.score(observations))

    def _choose(self, observations: list[Observation], scores: list[float]) -> Recommendation:
        pair = observations[0].pair
        by_id = {o.path_id: (o, s) for o, s in zip(observations, scores)}
        best_id = max(by_id, key=lambda pid: by_id[pid][1])
        current = self.current.get(pair)
        chosen = best_id
        if current in by_id and by_id[best_id][1] - by_id[current][1] < self.margin:
            chosen = current
        switched = current is not None and chosen != current
        self.current[pair] = chosen
        obs, predicted = by_id[chosen]
        return Recommendation(obs.path, chosen, predicted, {pid: s for pid, (_, s) in by_id.items()}, switched)


class GreedyMeasuredEngine(RecommendationEngine):
    """Non-ML adaptive baseline: plug the latest measurements straight into the
    quality formula (assumes the next tick looks exactly like this one)."""

    def __init__(self, margin: float = SWITCH_MARGIN):
        super().__init__(model=None, margin=margin)

    def score(self, observations: list[Observation]) -> list[float]:
        return [path_score(o.measured) for o in observations]
