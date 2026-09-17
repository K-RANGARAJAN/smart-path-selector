from smartpath.dataset import generate
from smartpath.simulator import FEATURES, NetworkSimulator


def test_same_seed_same_data():
    a, b = generate(30, seed=7), generate(30, seed=7)
    assert a.equals(b)


def test_different_seed_different_traffic():
    assert not generate(30, seed=7).target_score.equals(generate(30, seed=8).target_score)


def test_dataset_columns_and_ranges():
    df = generate(40, seed=3)
    assert set(FEATURES) <= set(df.columns)
    assert df.target_score.between(0, 100).all()
    assert df.loss_pct.between(0, 100).all()
    assert (df.hop_count >= 1).all()


def test_injected_congestion_hurts_the_path():
    sim = NetworkSimulator(seed=0)
    path = sim.candidates[("R1", "R12")][0]
    before, _ = sim.realised(path)
    a, b = path[2], path[3]
    sim.inject_congestion(a, b, duration=30, peak=0.9)
    for _ in range(6):
        sim.advance()
    after, _ = sim.realised(path)
    assert after < before
