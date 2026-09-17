from pathlib import Path

import numpy as np
import pytest

from smartpath.packet_tracer import measure_path, parse_available_bandwidth, parse_hops, parse_ping, score_scenario
from smartpath.simulator import FEATURES

SAMPLE = Path(__file__).resolve().parent.parent / "validation" / "packet_tracer" / "sample_scenario"

PC_PING = """
Reply from 10.0.0.2: bytes=32 time=10ms TTL=254
Request timed out.
Reply from 10.0.0.2: bytes=32 time<1ms TTL=254
Reply from 10.0.0.2: bytes=32 time=20ms TTL=254

Ping statistics for 10.0.0.2:
    Packets: Sent = 4, Received = 3, Lost = 1 (25% loss),
"""


def test_pc_ping():
    p = parse_ping(PC_PING)
    assert (p.sent, p.received) == (4, 3)
    assert p.loss_pct == 25
    assert p.rtts_ms == [10, 0.5, 20]
    assert p.jitter_ms == pytest.approx((9.5 + 19.5) / 2)


def test_router_ping():
    p = parse_ping("Success rate is 80 percent (4/5), round-trip min/avg/max = 1/3/9 ms")
    assert p.loss_pct == 20
    assert p.latency_ms == 3
    assert p.jitter_ms == 4


def test_hops_from_pc_and_router_traceroute():
    assert parse_hops("  1   0 ms  0 ms  0 ms  192.168.1.1\n  2   1 ms  1 ms  1 ms  10.0.0.2\n") == 2
    assert parse_hops("  1 10.0.13.3 0 msec 0 msec 1 msec\n  2 10.0.38.8 5 msec 6 msec 5 msec\n  3 10.0.1.1 4 msec\n") == 3


def test_bottleneck_bandwidth_uses_busiest_interface():
    text = (SAMPLE / "1_isp_a_backbone" / "interfaces.txt").read_text()
    avail, capacity = parse_available_bandwidth(text)
    assert capacity == 10_000
    assert avail == pytest.approx(10_000 * (1 - 240 / 255))


def test_sample_scenario_features_are_complete():
    feats = measure_path(SAMPLE / "1_isp_a_backbone")
    assert set(feats) == set(FEATURES)
    assert feats["latency_delta_ms"] > 0


class LatencyModel:
    def predict(self, X):
        return np.asarray(100 - X["latency_ms"] - X["loss_pct"])


def test_score_scenario_recommends_one_path():
    df = score_scenario(SAMPLE, LatencyModel())
    assert df.recommended.sum() == 1
    assert df.iloc[0].recommended
    assert df.predicted_score.is_monotonic_decreasing
    assert df.iloc[0].path == "3_isp_b_100m_shortcut"  # lowest latency, no loss under the stub model
