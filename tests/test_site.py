import json
import shutil
import subprocess
from pathlib import Path

import pytest

from smartpath.dataset import generate
from smartpath.site import build

ROOT = Path(__file__).resolve().parent.parent


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_browser_port_matches_python(tmp_path):
    result = build(tmp_path / "site", generate(300, seed=41), generate(100, seed=42))
    fixture = tmp_path / "parity.json"
    fixture.write_text(json.dumps(result["fixture"]))
    for name in ("index.html", "app.js", "sim.js", "style.css", "data.json", ".nojekyll"):
        assert (tmp_path / "site" / name).exists()
    proc = subprocess.run(["node", str(ROOT / "tools" / "check_site.js"), str(tmp_path / "site" / "data.json"), str(fixture)],
                          capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
