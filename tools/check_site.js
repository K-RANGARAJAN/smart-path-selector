// Verifies the browser port against Python reference outputs.
//   node tools/check_site.js build/site/data.json build/site_parity.json
const fs = require("fs");
const sim = require("../dashboard/static/sim.js");

const [dataPath, fixturePath] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const X = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
let failures = 0;
const check = (name, got, want, tol) => {
  const worst = got.reduce((m, g, i) => Math.max(m, Math.abs(g - want[i])), 0);
  const ok = worst <= tol;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got.length} values, max abs diff ${worst.toExponential(2)}`);
};

check("forest predictions", X.features.map(x => sim.predictOne(D.model.trees, x)), X.predictions, 1e-3);
check("quality score", X.score_inputs.map(([l, j, p, b]) => sim.qualityScore(l, j, p, b, D.constants.flow_demand_mbps)), X.scores, 1e-9);
const got = [], want = [];
X.link_inputs.forEach(([i, u], k) => {
  const s = sim.linkState(D.links[i], u, D.constants);
  got.push(s.latency_ms, s.jitter_ms, s.loss, s.avail_bw_mbps, s.utilisation);
  want.push(...X.link_states[k]);
});
check("link states", got, want, 1e-9);

// Smoke-run the live session through the same API the page uses.
(async () => {
  const api = sim.createLocalApi(D, 3);
  let snap;
  for (let i = 0; i < 300; i++) snap = await api.request("/api/tick", { n: 1, flow: "R1->R12" });
  await api.request("/api/congest", { a: "R5", b: "R6", flow: "R1->R12" });
  for (let i = 0; i < 20; i++) snap = await api.request("/api/tick", { n: 1, flow: "R1->R12" });
  const board = Object.fromEntries(snap.scoreboard.map(r => [r.strategy, r.mean]));
  console.log("session means after 320 ticks:", board);
  if (!(board["ML (Random Forest)"] > board.OSPF && board["ML (Random Forest)"] > board.RIP && board["ML (Random Forest)"] > board.BGP)) {
    failures++;
    console.log("FAIL ML does not beat static protocols in the browser session");
  }
  process.exit(failures ? 1 : 0);
})();
