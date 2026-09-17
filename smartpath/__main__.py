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

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
