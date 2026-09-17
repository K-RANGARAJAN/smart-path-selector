"""Live dashboard: watch every strategy route the same traffic in real time."""

from __future__ import annotations

import threading
from collections import deque
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from smartpath.live import ML, ORACLE, STRATEGIES, RoutingSession
from smartpath.evaluate import POOR_QUALITY
from smartpath.model import load
from smartpath.topology import AS_NAMES, FLOW_PAIRS, LINKS, ROUTERS

HISTORY = 180
MAX_TICKS_PER_REQUEST = 50


def _flow_key(text: str | None) -> tuple[str, str]:
    if text:
        a, _, b = text.partition("->")
        if (a, b) in FLOW_PAIRS:
            return (a, b)
    return FLOW_PAIRS[0]


class LiveState:
    def __init__(self, model, seed: int):
        self.model = model
        self.lock = threading.Lock()
        self.reset(seed)

    def reset(self, seed: int) -> None:
        self.seed = seed
        self.session = RoutingSession(self.model, seed=seed)
        self.last = self.session.step()
        self.history = {p: deque(maxlen=HISTORY) for p in FLOW_PAIRS}
        self.totals = {p: {s: {"sum": 0.0, "n": 0, "poor": 0} for s in STRATEGIES} for p in FLOW_PAIRS}
        self.events: deque = deque(maxlen=40)
        self.events.appendleft({"tick": self.session.sim.tick, "kind": "info", "text": f"Session started (traffic seed {seed})"})
        self._record(self.last)

    def _record(self, flows) -> None:
        for pair, ft in flows.items():
            point = {"tick": ft.tick}
            for s in STRATEGIES:
                q = ft.result(s).realised
                point[s] = round(q, 2)
                t = self.totals[pair][s]
                t["sum"] += q
                t["n"] += 1
                t["poor"] += q < POOR_QUALITY
            self.history[pair].append(point)
            if ft.ml_switched:
                self.events.appendleft({
                    "tick": ft.tick, "kind": "switch", "flow": f"{pair[0]}->{pair[1]}",
                    "text": f"{pair[0]}→{pair[1]}: ML moved to {ft.choices[ML]}", "from": ft.previous_ml,
                })

    def advance(self, n: int) -> None:
        for _ in range(n):
            self.last = self.session.step()
            self._record(self.last)

    def congest(self, a: str, b: str, duration: int, peak: float) -> None:
        self.session.sim.inject_congestion(a, b, duration=duration, peak=peak)
        self.events.appendleft({"tick": self.session.sim.tick, "kind": "congestion",
                                "text": f"Congestion injected on {a}–{b} (+{round(peak * 100)}% load, {duration} ticks)"})

    def snapshot(self, pair: tuple[str, str]) -> dict:
        sim = self.session.sim
        ft = self.last[pair]
        congested = {}
        for key, lt in sim.traffic.links.items():
            if lt.events:
                congested["-".join(key)] = max(e.remaining for e in lt.events)
        board = []
        for s in STRATEGIES:
            c = ft.result(s)
            t = self.totals[pair][s]
            board.append({
                "strategy": s, "path": c.path_id, "quality": round(c.realised, 1),
                "latency_ms": round(c.realised_latency_ms, 1), "loss_pct": round(c.realised_loss_pct, 2),
                "mean": round(t["sum"] / t["n"], 1), "poor_pct": round(100 * t["poor"] / t["n"], 1),
            })
        return {
            "tick": ft.tick,
            "seed": self.seed,
            "flow": f"{pair[0]}->{pair[1]}",
            "links": [{"a": a, "b": b, "util": round(u, 3), "events": congested.get(f"{a}-{b}", 0)} for (a, b), u in sim.util.items()],
            "choices": ft.choices,
            "candidates": [
                {
                    "path": c.path_id, **{k: round(v, 2) for k, v in c.measured.items()},
                    "predicted": round(c.predicted, 1), "formula": round(c.formula, 1), "actual": round(c.realised, 1),
                    "chosen_by": [s for s in STRATEGIES if ft.choices[s] == c.path_id and s != ORACLE],
                    "best": ft.choices[ORACLE] == c.path_id,
                }
                for c in sorted(ft.candidates, key=lambda c: -c.predicted)
            ],
            "scoreboard": board,
            "history": list(self.history[pair]),
            "events": list(self.events)[:15],
            "poor_threshold": POOR_QUALITY,
        }


def create_app(model_path: Path, seed: int = 7) -> Flask:
    app = Flask(__name__)
    state = LiveState(load(model_path), seed)
    app.config["LIVE_STATE"] = state

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/topology")
    def topology():
        return jsonify({
            "routers": [{"name": n, "asn": i["asn"], "x": i["pos"][0], "y": i["pos"][1]} for n, i in ROUTERS.items()],
            "links": [{"a": l.a if l.a < l.b else l.b, "b": l.b if l.a < l.b else l.a, "capacity_mbps": l.capacity_mbps,
                       "ospf_cost": l.ospf_cost, "prop_delay_ms": l.prop_delay_ms} for l in LINKS],
            "ases": [{"asn": k, "name": v} for k, v in AS_NAMES.items()],
            "flows": [f"{a}->{b}" for a, b in FLOW_PAIRS],
            "strategies": STRATEGIES,
        })

    @app.get("/api/state")
    def get_state():
        with state.lock:
            return jsonify(state.snapshot(_flow_key(request.args.get("flow"))))

    @app.post("/api/tick")
    def tick():
        body = request.get_json(silent=True) or {}
        n = max(1, min(MAX_TICKS_PER_REQUEST, int(body.get("n", 1))))
        with state.lock:
            state.advance(n)
            return jsonify(state.snapshot(_flow_key(body.get("flow"))))

    @app.post("/api/congest")
    def congest():
        body = request.get_json(silent=True) or {}
        a, b = str(body.get("a", "")), str(body.get("b", ""))
        key = (a, b) if a < b else (b, a)
        if key not in state.session.sim.traffic.links:
            return jsonify({"error": f"no link {a}-{b}"}), 400
        duration = max(5, min(200, int(body.get("duration", 40))))
        peak = max(0.1, min(0.9, float(body.get("peak", 0.6))))
        with state.lock:
            state.congest(*key, duration, peak)
            return jsonify(state.snapshot(_flow_key(body.get("flow"))))

    @app.post("/api/reset")
    def reset():
        body = request.get_json(silent=True) or {}
        with state.lock:
            state.reset(int(body.get("seed", state.seed)))
            return jsonify(state.snapshot(_flow_key(body.get("flow"))))

    return app
