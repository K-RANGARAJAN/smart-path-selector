"""One routing session: every strategy routes the same flows, tick by tick.

Used by both the offline evaluation and the live dashboard, so what the dashboard
shows is exactly what the evaluation measures.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .engine import GreedyMeasuredEngine, RecommendationEngine
from .metrics import path_score
from .paths import path_id
from .protocols import PROTOCOLS
from .simulator import NetworkSimulator

ML = "ML (Random Forest)"
GREEDY = "Greedy measured"
ORACLE = "Oracle"
STRATEGIES = [ML, GREEDY, "OSPF", "BGP", "RIP", ORACLE]


@dataclass
class CandidateResult:
    path: list[str]
    path_id: str
    measured: dict[str, float]
    predicted: float
    formula: float
    realised: float
    realised_latency_ms: float
    realised_loss_pct: float
    realised_avail_bw_mbps: float
    max_utilisation: float


@dataclass
class FlowTick:
    tick: int
    pair: tuple[str, str]
    candidates: list[CandidateResult]
    choices: dict[str, str]  # strategy -> path_id
    ml_switched: bool = False
    previous_ml: str | None = None

    def result(self, strategy: str) -> CandidateResult:
        pid = self.choices[strategy]
        return next(c for c in self.candidates if c.path_id == pid)


@dataclass
class RoutingSession:
    model: object
    seed: int = 0
    margin: float | None = None
    warm_up: int = 50
    sim: NetworkSimulator = field(init=False)

    def __post_init__(self):
        self.sim = NetworkSimulator(seed=self.seed)
        self.sim.warm_up(self.warm_up)
        kwargs = {} if self.margin is None else {"margin": self.margin}
        self.ml = RecommendationEngine(self.model, **kwargs)
        self.greedy = GreedyMeasuredEngine(**kwargs)
        self.static = {
            name: {pair: path_id(select(self.sim.candidates[pair])) for pair in self.sim.pairs}
            for name, select in PROTOCOLS.items()
        }

    def step(self) -> dict[tuple[str, str], FlowTick]:
        tick = self.sim.tick
        pending = {}
        for pair in self.sim.pairs:
            obs = self.sim.observe(pair)
            previous = self.ml.current.get(pair)
            ml_rec = self.ml.recommend(obs)
            gr_rec = self.greedy.recommend(obs)
            choices = {ML: ml_rec.path_id, GREEDY: gr_rec.path_id, **{n: self.static[n][pair] for n in PROTOCOLS}}
            pending[pair] = (obs, ml_rec, choices, previous)

        self.sim.advance()

        out = {}
        for pair, (obs, ml_rec, choices, previous) in pending.items():
            candidates = []
            for o in obs:
                score, m = self.sim.realised(o.path)
                candidates.append(
                    CandidateResult(
                        path=o.path,
                        path_id=o.path_id,
                        measured={
                            "latency_ms": o.measured.latency_ms,
                            "jitter_ms": o.measured.jitter_ms,
                            "loss_pct": o.measured.loss_pct,
                            "avail_bw_mbps": o.measured.avail_bw_mbps,
                            "hop_count": o.measured.hop_count,
                        },
                        predicted=ml_rec.scores[o.path_id],
                        formula=path_score(o.measured),
                        realised=score,
                        realised_latency_ms=m.latency_ms,
                        realised_loss_pct=m.loss_pct,
                        realised_avail_bw_mbps=m.avail_bw_mbps,
                        max_utilisation=m.max_utilisation,
                    )
                )
            choices[ORACLE] = max(candidates, key=lambda c: c.realised).path_id
            out[pair] = FlowTick(tick, pair, candidates, choices, ml_switched=ml_rec.switched, previous_ml=previous)
        return out
