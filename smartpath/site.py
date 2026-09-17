"""Build the static, browser-only version of the dashboard (for GitHub Pages).

The Flask dashboard needs a Python server. This export ships the topology, the
precomputed candidate paths and protocol choices, and a compact Random Forest as
JSON; `dashboard/static/sim.js` runs the same simulation and routing loop in the
browser.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from jinja2 import Environment, FileSystemLoader
from sklearn.ensemble import RandomForestRegressor

from . import metrics, traffic
from .engine import SWITCH_MARGIN
from .evaluate import POOR_QUALITY
from .live import STRATEGIES
from .model import make_model, regression_metrics
from .paths import candidate_paths, path_id
from .protocols import PROTOCOLS
from .simulator import FEATURES
from .topology import AS_NAMES, FLOW_PAIRS, LINKS, ROUTERS, build_graph

WEB_RF_PARAMS = dict(n_estimators=40, max_depth=10, min_samples_leaf=50)
DASHBOARD = Path(__file__).resolve().parent.parent / "dashboard"


def train_web_model(train: pd.DataFrame, test: pd.DataFrame) -> tuple[RandomForestRegressor, dict]:
    model = make_model(**WEB_RF_PARAMS).fit(train[FEATURES], train["target_score"])
    return model, regression_metrics(test["target_score"], model.predict(test[FEATURES]))


def export_forest(model: RandomForestRegressor) -> list[dict]:
    trees = []
    for est in model.estimators_:
        t = est.tree_
        leaf = t.children_left == -1
        trees.append({
            "f": [int(v) if not l else -1 for v, l in zip(t.feature, leaf)],
            "t": [float(v) if not l else 0 for v, l in zip(t.threshold, leaf)],
            "l": t.children_left.tolist(),
            "r": t.children_right.tolist(),
            "v": [round(float(v), 4) if l else 0 for v, l in zip(t.value[:, 0, 0], leaf)],
        })
    return trees


def site_data(model: RandomForestRegressor, web_metrics: dict, full_metrics: dict | None) -> dict:
    g = build_graph()
    candidates, static = {}, {}
    for src, dst in FLOW_PAIRS:
        flow = f"{src}->{dst}"
        cands = candidate_paths(g, src, dst)
        candidates[flow] = cands
        static[flow] = {name: path_id(select(cands)) for name, select in PROTOCOLS.items()}
    return {
        "routers": [{"name": n, "asn": i["asn"], "x": i["pos"][0], "y": i["pos"][1]} for n, i in ROUTERS.items()],
        "links": [{"a": min(l.a, l.b), "b": max(l.a, l.b), "capacity_mbps": l.capacity_mbps, "ospf_cost": l.ospf_cost,
                   "prop_delay_ms": l.prop_delay_ms, "base_util": l.base_util, "event_rate": l.event_rate} for l in LINKS],
        "ases": [{"asn": k, "name": v} for k, v in AS_NAMES.items()],
        "flows": [f"{a}->{b}" for a, b in FLOW_PAIRS],
        "strategies": STRATEGIES,
        "candidates": candidates,
        "static_routes": static,
        "features": FEATURES,
        "constants": {
            "phi": traffic.TrafficModel.PHI, "noise": traffic.TrafficModel.NOISE, "daily_amplitude": traffic.TrafficModel.DAILY_AMPLITUDE,
            "ticks_per_day": traffic.TICKS_PER_DAY, "max_queue_ms": metrics.MAX_QUEUE_MS, "flow_demand_mbps": metrics.FLOW_DEMAND_MBPS,
            "ping_probes": metrics.PING_PROBES, "switch_margin": SWITCH_MARGIN, "poor_quality": POOR_QUALITY,
        },
        "model": {"params": WEB_RF_PARAMS, "test_metrics": web_metrics, "full_model_test_metrics": full_metrics, "trees": export_forest(model)},
    }


def parity_fixture(model: RandomForestRegressor, test: pd.DataFrame, n: int = 400) -> dict:
    """Reference outputs from Python for tools/check_site.js to compare against."""
    rows = test.sample(n=n, random_state=0)
    rng = np.random.default_rng(0)
    score_inputs = [[float(rng.uniform(1, 400)), float(rng.uniform(0, 80)), float(rng.uniform(0, 30)), float(rng.uniform(0, 2000))] for _ in range(200)]
    link_inputs = [[spec_i, float(u)] for spec_i in range(len(LINKS)) for u in (0.05, 0.3, 0.6, 0.85, 0.9, 0.95, 0.99)]
    return {
        "features": rows[FEATURES].to_numpy().tolist(),
        "predictions": model.predict(rows[FEATURES]).tolist(),
        "score_inputs": score_inputs,
        "scores": [metrics.quality_score(*x) for x in score_inputs],
        "link_inputs": link_inputs,
        "link_states": [list(vars(metrics.link_state(LINKS[i], u)).values()) for i, u in link_inputs],
    }


def build(out: Path, train: pd.DataFrame, test: pd.DataFrame, full_metrics: dict | None = None) -> dict:
    model, web_metrics = train_web_model(train, test)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    (out / "data.json").write_text(json.dumps(site_data(model, web_metrics, full_metrics), separators=(",", ":")))
    for name in ("style.css", "app.js", "sim.js"):
        shutil.copy(DASHBOARD / "static" / name, out / name)
    env = Environment(loader=FileSystemLoader(DASHBOARD / "templates"))
    html = env.get_template("index.html").render(static_site=True, url_for=lambda _, filename: filename, web_metrics=web_metrics)
    (out / "index.html").write_text(html)
    (out / ".nojekyll").write_text("")
    return {"model": model, "web_metrics": web_metrics, "fixture": parity_fixture(model, test)}
