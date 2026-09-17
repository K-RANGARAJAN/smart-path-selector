"""Score paths measured in Cisco Packet Tracer (or on real Cisco gear) with the model.

Expected layout, one folder per candidate path:

    <scenario>/
        <path name>/
            ping.txt         PC "ping -n N" output, or router "ping ... repeat N" output
            tracert.txt      PC "tracert" or router "traceroute" output
            interfaces.txt   optional: "show interfaces" for the links on the path
            ping_prev.txt    optional: an earlier ping, used for the trend features

Available bandwidth comes from "show interfaces" (BW × (1 − load/255), bottleneck
interface). Without it, the path is assumed to have 1 Gbps free.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .metrics import quality_score
from .simulator import FEATURES

DEFAULT_AVAIL_BW_MBPS = 1000.0


@dataclass
class PingResult:
    sent: int
    received: int
    rtts_ms: list[float]
    min_ms: float | None = None
    max_ms: float | None = None
    avg_ms: float | None = None

    @property
    def loss_pct(self) -> float:
        return 100.0 * (self.sent - self.received) / self.sent if self.sent else 100.0

    @property
    def latency_ms(self) -> float:
        if self.rtts_ms:
            return float(np.mean(self.rtts_ms))
        return float(self.avg_ms or 0.0)

    @property
    def jitter_ms(self) -> float:
        """Mean absolute difference between consecutive replies (RFC 3550 style).
        Router output has no per-packet times, so fall back to half the min-max spread."""
        if len(self.rtts_ms) >= 2:
            return float(np.mean(np.abs(np.diff(self.rtts_ms))))
        if self.min_ms is not None and self.max_ms is not None:
            return (self.max_ms - self.min_ms) / 2
        return 0.0


def parse_ping(text: str) -> PingResult:
    # Router (IOS) style: "Success rate is 80 percent (4/5), round-trip min/avg/max = 1/2/4 ms"
    m = re.search(r"Success rate is \d+ percent \((\d+)/(\d+)\)(?:, round-trip min/avg/max = (\d+)/(\d+)/(\d+) ms)?", text)
    if m:
        received, sent = int(m.group(1)), int(m.group(2))
        mn, avg, mx = (float(m.group(i)) if m.group(i) else None for i in (3, 4, 5))
        return PingResult(sent, received, [], mn, mx, avg)

    # PC (Windows) style: per-reply lines plus a statistics block
    rtts = []
    for match in re.finditer(r"Reply from [\d.]+: bytes=\d+ time([<=])(\d+)ms", text):
        value = float(match.group(2))
        rtts.append(value / 2 if match.group(1) == "<" else value)
    stats = re.search(r"Sent = (\d+), Received = (\d+)", text)
    if stats:
        sent, received = int(stats.group(1)), int(stats.group(2))
    else:
        timeouts = len(re.findall(r"Request timed out", text))
        sent, received = len(rtts) + timeouts, len(rtts)
    if sent == 0:
        raise ValueError("no ping replies or statistics found")
    return PingResult(sent, received, rtts)


def parse_hops(text: str) -> int:
    hops = [int(m.group(1)) for m in re.finditer(r"^\s*(\d+)\s+\S", text, flags=re.MULTILINE)]
    if not hops:
        raise ValueError("no hops found in traceroute output")
    return max(hops)


def parse_available_bandwidth(text: str) -> tuple[float, float] | None:
    """(bottleneck available Mbps, bottleneck configured Mbps) across all interfaces listed."""
    avail, capacity = [], []
    for block in re.split(r"\n(?=\S)", text):
        bw = re.search(r"BW (\d+) Kbit", block)
        if not bw:
            continue
        mbps = int(bw.group(1)) / 1000
        tx = re.search(r"txload (\d+)/255", block)
        rx = re.search(r"rxload (\d+)/255", block)
        load = max(int(tx.group(1)) if tx else 0, int(rx.group(1)) if rx else 0) / 255
        avail.append(mbps * (1 - load))
        capacity.append(mbps)
    if not avail:
        return None
    return min(avail), min(capacity)


def measure_path(folder: Path) -> dict[str, float]:
    ping = parse_ping((folder / "ping.txt").read_text())
    hops = parse_hops((folder / "tracert.txt").read_text())
    bw = None
    if (folder / "interfaces.txt").exists():
        bw = parse_available_bandwidth((folder / "interfaces.txt").read_text())
    avail, capacity = bw if bw else (DEFAULT_AVAIL_BW_MBPS, DEFAULT_AVAIL_BW_MBPS)
    prev = parse_ping((folder / "ping_prev.txt").read_text()) if (folder / "ping_prev.txt").exists() else ping
    return {
        "latency_ms": ping.latency_ms,
        "jitter_ms": ping.jitter_ms,
        "loss_pct": ping.loss_pct,
        "avail_bw_mbps": avail,
        "hop_count": hops,
        "bottleneck_capacity_mbps": capacity,
        "latency_delta_ms": ping.latency_ms - prev.latency_ms,
        "loss_delta_pct": ping.loss_pct - prev.loss_pct,
        "avail_bw_delta_mbps": 0.0,
    }


def score_scenario(scenario: Path, model) -> pd.DataFrame:
    rows = []
    for folder in sorted(p for p in scenario.iterdir() if p.is_dir() and (p / "ping.txt").exists()):
        feats = measure_path(folder)
        rows.append({"path": folder.name, **feats})
    if not rows:
        raise FileNotFoundError(f"no path folders with ping.txt under {scenario}")
    df = pd.DataFrame(rows)
    df["formula_score"] = [
        quality_score(r.latency_ms, r.jitter_ms, r.loss_pct, r.avail_bw_mbps) for r in df.itertuples()
    ]
    df["predicted_score"] = model.predict(df[FEATURES])
    df["recommended"] = df.predicted_score == df.predicted_score.max()
    return df.sort_values("predicted_score", ascending=False).reset_index(drop=True)
