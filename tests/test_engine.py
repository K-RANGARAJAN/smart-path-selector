import numpy as np

from smartpath.engine import GreedyMeasuredEngine, RecommendationEngine
from smartpath.simulator import NetworkSimulator


class FixedModel:
    """Predicts whatever score list it is given, in candidate order."""

    def __init__(self, scores):
        self.scores = scores

    def predict(self, X):
        return np.array(self.scores[: len(X)])


def observations():
    return NetworkSimulator(seed=0).observe(("R1", "R12"))


def test_picks_highest_predicted_path():
    obs = observations()
    scores = [10.0] * len(obs)
    scores[3] = 90.0
    rec = RecommendationEngine(FixedModel(scores)).recommend(obs)
    assert rec.path_id == obs[3].path_id
    assert rec.predicted == 90.0


def test_hysteresis_keeps_current_path_on_small_gain():
    obs = observations()
    engine = RecommendationEngine(FixedModel([90.0] + [50.0] * (len(obs) - 1)), margin=3.0)
    assert engine.recommend(obs).path_id == obs[0].path_id

    engine.model = FixedModel([90.0, 92.0] + [50.0] * (len(obs) - 2))
    rec = engine.recommend(obs)
    assert rec.path_id == obs[0].path_id and not rec.switched

    engine.model = FixedModel([90.0, 95.0] + [50.0] * (len(obs) - 2))
    rec = engine.recommend(obs)
    assert rec.path_id == obs[1].path_id and rec.switched


def test_greedy_engine_needs_no_model():
    rec = GreedyMeasuredEngine().recommend(observations())
    assert 0 <= rec.predicted <= 100
