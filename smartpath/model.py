"""Train and evaluate the path quality model."""

from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold

from .simulator import FEATURES

TARGET = "target_score"
RF_PARAMS = dict(n_estimators=150, max_depth=16, min_samples_leaf=20, max_features=0.6, n_jobs=-1, random_state=42)


def make_model(**overrides) -> RandomForestRegressor:
    return RandomForestRegressor(**{**RF_PARAMS, **overrides})


def regression_metrics(y_true, y_pred) -> dict[str, float]:
    return {
        "r2": float(r2_score(y_true, y_pred)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
    }


def cross_validate(df: pd.DataFrame, folds: int = 5) -> list[dict[str, float]]:
    """K-fold over contiguous time blocks, so neighbouring ticks never straddle folds."""
    groups = df["tick"] // 250
    out = []
    for train_idx, val_idx in GroupKFold(n_splits=folds).split(df, groups=groups):
        m = make_model(n_estimators=100)
        m.fit(df.iloc[train_idx][FEATURES], df.iloc[train_idx][TARGET])
        pred = m.predict(df.iloc[val_idx][FEATURES])
        out.append(regression_metrics(df.iloc[val_idx][TARGET], pred))
    return out


def train_and_evaluate(train: pd.DataFrame, test: pd.DataFrame, cv: bool = True) -> tuple[RandomForestRegressor, dict]:
    report: dict = {
        "train_rows": len(train),
        "test_rows": len(test),
        "features": FEATURES,
        "rf_params": {k: v for k, v in RF_PARAMS.items() if k != "n_jobs"},
    }

    if cv:
        folds = cross_validate(train)
        report["cv"] = {
            "folds": folds,
            "r2_mean": float(np.mean([f["r2"] for f in folds])),
            "r2_std": float(np.std([f["r2"] for f in folds])),
            "mae_mean": float(np.mean([f["mae"] for f in folds])),
        }

    t0 = time.perf_counter()
    model = make_model()
    model.fit(train[FEATURES], train[TARGET])
    report["train_seconds"] = round(time.perf_counter() - t0, 2)

    t0 = time.perf_counter()
    rf_pred = model.predict(test[FEATURES])
    report["predict_ms_per_path"] = round(1000 * (time.perf_counter() - t0) / len(test), 4)

    linear = LinearRegression().fit(train[FEATURES], train[TARGET])
    report["test"] = {
        "random_forest": regression_metrics(test[TARGET], rf_pred),
        "linear_regression": regression_metrics(test[TARGET], linear.predict(test[FEATURES])),
        # Non-ML reference: apply the scoring formula to the current measurements.
        "measured_score_formula": regression_metrics(test[TARGET], test["measured_score"]),
    }

    report["feature_importance"] = dict(
        sorted(zip(FEATURES, map(float, model.feature_importances_)), key=lambda kv: -kv[1])
    )
    sample = test.sample(n=min(20_000, len(test)), random_state=0)
    perm = permutation_importance(model, sample[FEATURES], sample[TARGET], n_repeats=5, random_state=0)
    report["permutation_importance"] = dict(
        sorted(zip(FEATURES, map(float, perm.importances_mean)), key=lambda kv: -kv[1])
    )
    return model, report


def save(model, report: dict, model_path: Path, report_path: Path) -> None:
    model_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path, compress=3)
    report_path.write_text(json.dumps(report, indent=2))


def load(model_path: Path) -> RandomForestRegressor:
    return joblib.load(model_path)
