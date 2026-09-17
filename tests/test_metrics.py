import pytest

from smartpath.metrics import link_state, quality_score
from smartpath.topology import LinkSpec

SPEC = LinkSpec("A", "B", 1000, 5.0, 0.3, 0.0)


def test_score_bounds():
    assert 0 <= quality_score(10, 1, 0, 1000) <= 100
    assert quality_score(2000, 500, 90, 0) == 0


@pytest.mark.parametrize("worse", [dict(latency_ms=300), dict(jitter_ms=60), dict(loss_pct=5), dict(avail_bw_mbps=40)])
def test_score_drops_when_any_metric_worsens(worse):
    good = dict(latency_ms=30, jitter_ms=2, loss_pct=0.1, avail_bw_mbps=800)
    assert quality_score(**{**good, **worse}) < quality_score(**good)


def test_link_degrades_with_utilisation():
    low, high = link_state(SPEC, 0.3), link_state(SPEC, 0.95)
    assert high.latency_ms > low.latency_ms
    assert high.loss > low.loss
    assert high.avail_bw_mbps < low.avail_bw_mbps
