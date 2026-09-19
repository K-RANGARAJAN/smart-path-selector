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
    link = next(l for l in snap["links"] if (l["a"], l["b"]) == ("R5", "R6"))
    assert link["manual"] == 40 and link["events"] >= 40
    assert client.post("/api/congest", json={"a": "R1", "b": "R12"}).status_code == 400


def test_demo_default_has_no_random_jams(client):
    snap = client.post("/api/reset", json={"seed": 5}).get_json()
    assert snap["random_jams"] is False
    for _ in range(10):
        snap = client.post("/api/tick", json={"n": 20}).get_json()
        assert all(l["events"] == 0 for l in snap["links"])


def test_jam_lifecycle_is_reported(client):
    client.post("/api/reset", json={"seed": 5})
    client.post("/api/congest", json={"a": "R4", "b": "R9", "duration": 5})
    snap = client.post("/api/tick", json={"n": 6}).get_json()
    assert any(e["text"] == "Jam on R4–R9 has cleared" for e in snap["events"])
    client.post("/api/congest", json={"a": "R5", "b": "R6"})
    snap = client.post("/api/clear", json={}).get_json()
    assert all(l["manual"] == 0 for l in snap["links"])
    assert snap["events"][0]["text"] == "Cleared jams on R5–R6"


def test_events_only_show_selected_flow(client):
    client.post("/api/settings", json={"random_jams": True})
    snap = client.post("/api/tick", json={"n": 50, "flow": "R3->R11"}).get_json()
    assert all(e.get("flow") in (None, "R3->R11") for e in snap["events"])
    client.post("/api/settings", json={"random_jams": False})


def test_random_jams_toggle_keeps_manual_jams(client):
    client.post("/api/settings", json={"random_jams": True})
    client.post("/api/tick", json={"n": 30})
    client.post("/api/congest", json={"a": "R8", "b": "R10"})
    snap = client.post("/api/settings", json={"random_jams": False}).get_json()
    assert snap["random_jams"] is False
    assert all(l["events"] == l["manual"] for l in snap["links"])
    assert next(l for l in snap["links"] if (l["a"], l["b"]) == ("R10", "R8"))["manual"] > 0
    for _ in range(5):
        snap = client.post("/api/tick", json={"n": 20}).get_json()
        assert all(l["events"] == l["manual"] for l in snap["links"])
    assert client.post("/api/reset", json={"seed": 3}).get_json()["random_jams"] is False
    client.post("/api/settings", json={"random_jams": True})
