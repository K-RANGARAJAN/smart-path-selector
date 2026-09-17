import pytest

from smartpath.dataset import generate
from smartpath.evaluate import run, summarise
from smartpath.live import ML, ORACLE, STRATEGIES
from smartpath.model import make_model
from smartpath.simulator import FEATURES


@pytest.fixture(scope="module")
def model():
    df = generate(300, seed=21)
    return make_model(n_estimators=30).fit(df[FEATURES], df.target_score)


def test_oracle_is_an_upper_bound(model):
    summary = summarise(run(model, ticks=60, seed=5))
    assert list(summary.index) == STRATEGIES
    assert (summary.mean_quality <= summary.loc[ORACLE, "mean_quality"] + 1e-9).all()
    assert summary.loc[ORACLE, "mean_regret"] == 0


def test_ml_beats_static_protocols(model):
    summary = summarise(run(model, ticks=150, seed=6))
    for protocol in ("RIP", "OSPF", "BGP"):
        assert summary.loc[ML, "mean_quality"] > summary.loc[protocol, "mean_quality"]


def test_static_protocols_never_change_route(model):
    summary = summarise(run(model, ticks=40, seed=7))
    assert (summary.loc[["RIP", "OSPF", "BGP"], "route_changes_per_1000"] == 0).all()
