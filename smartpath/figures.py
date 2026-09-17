"""Report figures."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

INK = "#1f2933"
MUTED = "#7b8794"
GRID = "#e4e7eb"
ML = "#0b7a75"
COLORS = {"ML (Random Forest)": ML, "Greedy measured": "#8e6c8a", "OSPF": "#c9621a", "RIP": "#6b7fa3", "BGP": "#a3a04d", "Oracle": "#9aa5b1"}


def _style(ax):
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(MUTED)
    ax.tick_params(colors=INK, labelsize=9)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def predicted_vs_actual(y_true, y_pred, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(5, 4.6), dpi=160)
    idx = np.random.default_rng(0).choice(len(y_true), size=min(6000, len(y_true)), replace=False)
    ax.scatter(np.asarray(y_true)[idx], np.asarray(y_pred)[idx], s=4, alpha=0.25, color=ML, linewidths=0)
    ax.plot([0, 100], [0, 100], color=MUTED, linewidth=1, linestyle="--")
    ax.set_xlabel("Actual next-tick quality score", color=INK)
    ax.set_ylabel("Predicted quality score", color=INK)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    _style(ax)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


FEATURE_LABELS = {
    "latency_ms": "Latency",
    "jitter_ms": "Jitter",
    "loss_pct": "Packet loss",
    "avail_bw_mbps": "Available bandwidth",
    "hop_count": "Hop count",
    "bottleneck_capacity_mbps": "Bottleneck capacity",
    "latency_delta_ms": "Latency trend",
    "loss_delta_pct": "Loss trend",
    "avail_bw_delta_mbps": "Bandwidth trend",
}


def feature_importance(importance: dict[str, float], path: Path) -> None:
    items = sorted(((FEATURE_LABELS.get(k, k), v) for k, v in importance.items()), key=lambda kv: kv[1])
    fig, ax = plt.subplots(figsize=(6, 3.8), dpi=160)
    ax.barh([k for k, _ in items], [v for _, v in items], color=ML, height=0.6)
    ax.set_xlabel("Permutation importance (drop in R²)", color=INK)
    _style(ax)
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def strategy_bars(summary: pd.DataFrame, column: str, label: str, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(6, 3.6), dpi=160)
    names = list(summary.index)
    vals = summary[column].to_numpy()
    ax.bar(names, vals, color=[COLORS.get(n, MUTED) for n in names], width=0.6)
    for i, v in enumerate(vals):
        ax.text(i, v, f"{v:.1f}", ha="center", va="bottom", fontsize=8, color=INK)
    ax.set_ylabel(label, color=INK)
    plt.setp(ax.get_xticklabels(), rotation=15, ha="right")
    _style(ax)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def timeline(trace: pd.DataFrame, path: Path, strategies: list[str]) -> None:
    fig, ax = plt.subplots(figsize=(9, 3.4), dpi=160)
    for s in strategies:
        series = trace[trace.strategy == s].set_index("tick")["score"].rolling(5, min_periods=1).mean()
        is_ml = s.startswith("ML")
        ax.plot(series.index, series.values, label=s, color=COLORS.get(s, MUTED),
                linewidth=2.2 if is_ml else 1.0, zorder=3 if is_ml else 2)
    ax.set_xlabel("Tick", color=INK)
    ax.set_ylabel("Realised quality (5-tick mean)", color=INK)
    ax.set_ylim(0, 102)
    ax.legend(frameon=False, fontsize=8, ncol=len(strategies), loc="lower center", bbox_to_anchor=(0.5, 1.0))
    _style(ax)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


AS_FILL = {100: "#e3eef7", 200: "#fbe9dc", 300: "#eef0dc", 400: "#e6f2ef"}


def topology_map(path: Path) -> None:
    from .topology import AS_NAMES, LINKS, ROUTERS

    fig, ax = plt.subplots(figsize=(8, 4.6), dpi=170)
    for asn, name in AS_NAMES.items():
        pts = np.array([info["pos"] for info in ROUTERS.values() if info["asn"] == asn], dtype=float)
        x0, y0 = pts.min(axis=0) - 6
        x1, y1 = pts.max(axis=0) + 6
        ax.add_patch(plt.Rectangle((x0, y0), x1 - x0, y1 - y0, color=AS_FILL[asn], zorder=0, linewidth=0))
        if asn == 400:  # links leave this box downwards, so label above it
            ax.text(x1, y0 - 1, name, fontsize=7, color=MUTED, va="bottom", ha="right")
        else:
            ax.text(x0 + 1, y1 - 1.5, name, fontsize=7, color=MUTED, va="top")
    for spec in LINKS:
        (xa, ya), (xb, yb) = ROUTERS[spec.a]["pos"], ROUTERS[spec.b]["pos"]
        width = {100: 0.8, 1000: 1.8, 10000: 3.6}[int(spec.capacity_mbps)]
        ax.plot([xa, xb], [ya, yb], color="#52606d", linewidth=width, zorder=1, solid_capstyle="round")
        label = {100: "100M", 1000: "1G", 10000: "10G"}[int(spec.capacity_mbps)]
        ax.text((xa + xb) / 2, (ya + yb) / 2, label, fontsize=5.5, color=INK, ha="center", va="center",
                bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none"), zorder=2)
    for name, info in ROUTERS.items():
        x, y = info["pos"]
        ax.scatter([x], [y], s=260, color=ML, zorder=3, edgecolors="white", linewidths=1.2)
        ax.text(x, y, name, fontsize=6.5, color="white", ha="center", va="center", zorder=4, fontweight="bold")
    ax.set_xlim(-3, 103)
    ax.set_ylim(97, -5)
    ax.axis("off")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
