import joblib
import pytest

from dashboard.app import create_app
from smartpath.dataset import generate
from smartpath.model import make_model
from smartpath.simulator import FEATURES


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    df = generate(200, seed=31)
    path = tmp_path_factory.mktemp("m") / "model.joblib"
    joblib.dump(make_model(n_estimators=20).fit(df[FEATURES], df.target_score), path)
    return create_app(path, seed=1).test_client()


def test_page_and_topology(client):
    assert client.get("/").status_code == 200
    topo = client.get("/api/topology").get_json()
    assert len(topo["routers"]) == 12 and len(topo["links"]) == 17


def test_tick_advances_and_reports_all_strategies(client):
    before = client.get("/api/state?flow=R1->R12").get_json()["tick"]
    snap = client.post("/api/tick", json={"n": 3, "flow": "R3->R11"}).get_json()
    assert snap["tick"] == before + 3
    assert snap["flow"] == "R3->R11"
    assert {r["strategy"] for r in snap["scoreboard"]} == set(snap["choices"])
    assert any(c["chosen_by"] for c in snap["candidates"])


def test_congestion_injection(client):
    snap = client.post("/api/congest", json={"a": "R6", "b": "R5"}).get_json()
    assert next(l for l in snap["links"] if (l["a"], l["b"]) == ("R5", "R6"))["events"] > 0
    assert client.post("/api/congest", json={"a": "R1", "b": "R12"}).status_code == 400
