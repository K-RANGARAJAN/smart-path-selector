"""Command line entry point: python -m smartpath <command>."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MODELS = ROOT / "models"
REPORTS = ROOT / "reports"
FIGURES = REPORTS / "figures"


def cmd_generate(args) -> None:
    from .dataset import generate

    DATA.mkdir(exist_ok=True)
    for name, ticks, seed in (("train", args.train_ticks, args.train_seed), ("test", args.test_ticks, args.test_seed)):
        df = generate(ticks, seed)
        out = DATA / f"{name}.csv"
        df.to_csv(out, index=False)
        print(f"{name}: {len(df):,} rows ({ticks} ticks, seed {seed}) -> {out.relative_to(ROOT)}")

    from . import figures
    from .baselines import protocol_routes, static_vs_oracle

    FIGURES.mkdir(parents=True, exist_ok=True)
    figures.topology_map(FIGURES / "topology.png")
    routes = protocol_routes()
    routes.to_csv(REPORTS / "protocol_routes.csv", index=False)
    static = static_vs_oracle(pd.read_csv(DATA / "test.csv"))
    static.round(2).to_csv(REPORTS / "static_protocols_vs_oracle.csv")
    pd.set_option("display.width", 200)
    print(routes.to_string(index=False))
    print(static.round(1))


def cmd_train(args) -> None:
    from . import figures
    from .model import FEATURES, save, train_and_evaluate

    train = pd.read_csv(DATA / "train.csv")
    test = pd.read_csv(DATA / "test.csv")
    model, report = train_and_evaluate(train, test, cv=not args.no_cv)
    save(model, report, MODELS / "path_quality_rf.joblib", REPORTS / "model_metrics.json")

    FIGURES.mkdir(parents=True, exist_ok=True)
    figures.predicted_vs_actual(test["target_score"], model.predict(test[FEATURES]), FIGURES / "predicted_vs_actual.png")
    figures.feature_importance(report["permutation_importance"], FIGURES / "feature_importance.png")
    print(json.dumps({k: report[k] for k in ("test", "cv") if k in report}, indent=2))


def cmd_evaluate(args) -> None:
    from . import figures
    from .evaluate import congestion_drill, run, summarise
    from .model import load

    model = load(MODELS / "path_quality_rf.joblib")
    trace = run(model, ticks=args.ticks, seed=args.seed, margin=args.margin)
    summary = summarise(trace)
    REPORTS.mkdir(exist_ok=True)
    FIGURES.mkdir(parents=True, exist_ok=True)
    summary.round(3).to_csv(REPORTS / "routing_comparison.csv")
    per_pair = trace.groupby(["pair", "strategy"]).score.mean().unstack()[summary.index]
    per_pair.round(2).to_csv(REPORTS / "routing_by_flow.csv")
    figures.strategy_bars(summary, "mean_quality", "Mean realised quality (0-100)", FIGURES / "routing_quality.png")
    figures.strategy_bars(summary, "poor_quality_pct", f"% of time below quality 60", FIGURES / "routing_poor_time.png")
    window = trace[(trace.pair == "R1->R12") & (trace.tick < trace.tick.min() + 400)]
    figures.timeline(window, FIGURES / "routing_timeline.png", ["ML (Random Forest)", "OSPF", "BGP", "RIP"])
    drill = congestion_drill(model)
    (REPORTS / "congestion_drill.json").write_text(json.dumps(drill, indent=2))
    pd.set_option("display.width", 200)
    print(summary.round(2))
    print()
    print(per_pair.round(1))
    print()
    print(json.dumps(drill, indent=2))


def cmd_validate(args) -> None:
    from .model import load
    from .packet_tracer import score_scenario

    model = load(MODELS / "path_quality_rf.joblib")
    df = score_scenario(Path(args.scenario), model)
    pd.set_option("display.width", 200)
    cols = ["path", "latency_ms", "jitter_ms", "loss_pct", "avail_bw_mbps", "hop_count", "formula_score", "predicted_score", "recommended"]
    print(df[cols].round(2).to_string(index=False))
    if args.out:
        df.round(3).to_csv(args.out, index=False)


def cmd_dashboard(args) -> None:
    from dashboard.app import create_app

    app = create_app(MODELS / "path_quality_rf.joblib", seed=args.seed)
    print(f"Dashboard on http://127.0.0.1:{args.port}")
    app.run(host="127.0.0.1", port=args.port, debug=False, threaded=True)


def cmd_export_site(args) -> None:
    from .site import build

    out = Path(args.out)
    full = json.loads((REPORTS / "model_metrics.json").read_text())["test"]["random_forest"]
    result = build(out, pd.read_csv(DATA / "train.csv"), pd.read_csv(DATA / "test.csv"), full)
    (out.parent / "site_parity.json").write_text(json.dumps(result["fixture"]))
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"Static site -> {out} ({size / 1e6:.1f} MB); web model test metrics {result['web_metrics']}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="smartpath")
    sub = parser.add_subparsers(dest="command", required=True)

    g = sub.add_parser("generate", help="simulate the network and write train/test datasets")
    g.add_argument("--train-ticks", type=int, default=6000)
    g.add_argument("--test-ticks", type=int, default=2000)
    g.add_argument("--train-seed", type=int, default=1)
    g.add_argument("--test-seed", type=int, default=2)
    g.set_defaults(func=cmd_generate)

    t = sub.add_parser("train", help="train the Random Forest and write metrics")
    t.add_argument("--no-cv", action="store_true", help="skip time-blocked cross-validation")
    t.set_defaults(func=cmd_train)

    e = sub.add_parser("evaluate", help="closed-loop routing comparison against RIP/OSPF/BGP")
    e.add_argument("--ticks", type=int, default=2000)
    e.add_argument("--seed", type=int, default=3, help="traffic seed; 1 and 2 are the training/test datasets")
    e.add_argument("--margin", type=float, default=None, help="hysteresis margin in quality points")
    e.set_defaults(func=cmd_evaluate)

    v = sub.add_parser("validate", help="score Packet Tracer ping/tracert measurements with the model")
    v.add_argument("scenario", help="folder with one sub-folder per measured path")
    v.add_argument("--out", help="write the scored table to this CSV")
    v.set_defaults(func=cmd_validate)

    d = sub.add_parser("dashboard", help="run the live dashboard")
    d.add_argument("--port", type=int, default=8050)
    d.add_argument("--seed", type=int, default=7)
    d.set_defaults(func=cmd_dashboard)

    x = sub.add_parser("export-site", help="build the browser-only dashboard for static hosting")
    x.add_argument("--out", default=str(ROOT / "build" / "site"))
    x.set_defaults(func=cmd_export_site)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
