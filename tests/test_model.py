from smartpath.dataset import generate
from smartpath.model import train_and_evaluate


def test_model_beats_linear_baseline_on_unseen_traffic():
    train, test = generate(600, seed=11), generate(200, seed=12)
    _, report = train_and_evaluate(train, test, cv=False)
    rf, lin = report["test"]["random_forest"], report["test"]["linear_regression"]
    assert rf["r2"] > 0.7
    assert rf["mae"] < lin["mae"]
