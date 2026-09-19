const path = require("path");
const fs = require("fs");
const { C, F, W, H, newDeck, text, heading, footer, card, badge, network, darkSlide } = require("./theme");

const ROOT = path.resolve(__dirname, "../..");
const readCsv = f => {
  const [hdr, ...rows] = fs.readFileSync(path.join(ROOT, f), "utf8").trim().split("\n").map(l => l.split(","));
  return rows.map(r => Object.fromEntries(hdr.map((h, i) => [h, i === 0 ? r[i] : +r[i]])));
};
const metrics = JSON.parse(fs.readFileSync(path.join(ROOT, "reports/model_metrics.json")));
const drill = JSON.parse(fs.readFileSync(path.join(ROOT, "reports/congestion_drill.json")));
const routing = Object.fromEntries(readCsv("reports/routing_comparison.csv").map(r => [r.strategy, r]));
const fig = f => path.join(ROOT, "reports/figures", f);
const T = metrics.test;

const pres = newDeck("Intelligent Router Path Selection using ML — Final Review");
const LABEL = "Final review";
let n = 1;
const ML = "ML (Random Forest)", GR = "Greedy measured";
const STRAT_COLORS = { [ML]: C.teal, [GR]: C.greedy, OSPF: C.ospf, BGP: C.bgp, RIP: C.rip, Oracle: "9AA5B1" };
const SHORT = { [ML]: "ML", [GR]: "Greedy (no ML)", Oracle: "Oracle" };
const nm = s => SHORT[s] || s;

const quietChart = extra => ({
  catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontFace: F.body, valAxisLabelFontFace: F.body,
  catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, valGridLine: { color: "E6EAED", size: 0.75 }, catGridLine: { style: "none" },
  catAxisLineShow: false, valAxisLineShow: false, dataLabelFontFace: F.body, dataLabelFontSize: 11, dataLabelColor: C.ink,
  titleFontSize: 11, titleColor: C.ink, titleFontFace: F.body, ...extra,
});

// 1. Title
{
  const s = darkSlide(pres);
  const nodes = [[6.4, 1.2], [7.6, 0.8], [8.9, 1.4], [7.2, 2.2], [8.4, 2.6], [9.4, 2.4], [6.6, 3.2], [7.9, 3.7], [9.1, 3.9]];
  const edges = [[0, 1], [1, 2], [0, 3], [1, 3], [3, 4], [2, 5], [4, 5], [3, 6], [6, 7], [4, 7], [7, 8], [5, 8]];
  network(s, nodes, edges, { edge: "2F5256", nodeFill: "2F5256" });
  network(s, [nodes[1], nodes[2]], [[0, 1, C.amber, 4]], { nodeFill: C.amber, r: 0.12 });
  network(s, [nodes[0], nodes[3], nodes[4], nodes[5]], [[0, 1, C.tealLight, 3], [1, 2, C.tealLight, 3], [2, 3, C.tealLight, 3]], { nodeFill: C.tealLight, r: 0.14 });
  text(s, "FINAL REVIEW · FULL DEMONSTRATION", { x: 0.6, y: 1.2, w: 5.6, h: 0.3, fontSize: 11, bold: true, color: C.tealLight, charSpacing: 3 });
  text(s, "Intelligent Router Path Selection using Machine Learning", { x: 0.6, y: 1.55, w: 5.6, h: 1.7, fontSize: 30, bold: true, fontFace: F.head, color: C.white });
  text(s, "97.0 path quality vs 78.3 for OSPF on unseen traffic", { x: 0.6, y: 3.3, w: 5.4, h: 0.4, fontSize: 15, color: "B9CFCD" });
  text(s, "github.com/K-RANGARAJAN/smart-path-selector", { x: 0.6, y: 4.75, w: 5.5, h: 0.3, fontSize: 11, color: "8FAFAC" });
}

// 2. Problem recap
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Static metrics can’t see congestion", "Recap");
  const protos = [["RIP", C.rip, "Hop count"], ["OSPF", C.ospf, "Configured cost"], ["BGP", C.bgp, "Policy, AS path"]];
  protos.forEach(([p, col, m], i) => {
    const yy = y + i * 0.95;
    card(s, 0.5, yy, 4.2, 0.78);
    badge(s, 0.7, yy + 0.17, p[0], col, 0.44);
    text(s, p, { x: 1.3, y: yy + 0.12, w: 1.2, h: 0.55, fontSize: 18, bold: true, fontFace: F.head, valign: "middle" });
    text(s, m, { x: 2.5, y: yy + 0.12, w: 2.1, h: 0.55, fontSize: 14, color: col, bold: true, valign: "middle" });
  });
  text(s, "…none react to live congestion, loss or jitter.", { x: 0.5, y: y + 2.95, w: 4.3, h: 0.35, fontSize: 13, italic: true, color: C.muted });
  card(s, 5.1, y, 4.4, 3.3, C.night);
  text(s, "THIS PROJECT", { x: 5.35, y: y + 0.25, w: 3.9, h: 0.25, fontSize: 10, bold: true, color: C.tealLight, charSpacing: 2 });
  text(s, "Measure every candidate path, predict its quality next interval, route on the prediction.", { x: 5.35, y: y + 0.6, w: 3.95, h: 1.3, fontSize: 19, bold: true, fontFace: F.head, color: C.white });
  text(s, "Random Forest regression on latency, bandwidth, loss, jitter, hop count and their trends. Compared head-to-head with RIP, OSPF and BGP on identical traffic.", { x: 5.35, y: y + 2.0, w: 3.95, h: 1.1, fontSize: 12, color: "B9CFCD" });
  footer(s, LABEL, n);
}

// 3. Built
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Everything planned at DA 1 is built", "Completion");
  const stages = [
    ["Simulator", "12 routers · 4 ASes · congestion episodes"],
    ["Dataset", "280k rows, next-tick target"],
    ["Model", `Random Forest · R² ${T.random_forest.r2.toFixed(3)}`],
    ["Engine", "Best predicted path, anti-flapping"],
    ["Evaluation", "vs RIP, OSPF, BGP, no-ML, oracle"],
    ["Dashboard", "Live, congestion injection"],
  ];
  const bw = 1.37, gap = 0.17;
  stages.forEach(([t, d], i) => {
    const x = 0.5 + i * (bw + gap);
    card(s, x, y + 0.1, bw, 1.85, i === 2 || i === 3 ? C.teal : C.tint);
    const dark = i === 2 || i === 3;
    badge(s, x + 0.15, y + 0.25, "✓", dark ? C.night : C.teal, 0.34);
    text(s, t, { x: x + 0.15, y: y + 0.72, w: bw - 0.25, h: 0.35, fontSize: 13.5, bold: true, color: dark ? C.white : C.ink });
    text(s, d, { x: x + 0.15, y: y + 1.08, w: bw - 0.22, h: 0.8, fontSize: 10, color: dark ? "D7EFEC" : C.muted });
  });
  const extras = [["31", "automated tests passing"], ["4.4 ms", "to score 9 candidate paths"], ["PT", "Packet Tracer parser + validation workflow"]];
  extras.forEach(([v, l], i) => {
    const x = 0.5 + i * 3.07;
    text(s, v, { x, y: y + 2.3, w: 2.9, h: 0.6, fontSize: 30, bold: true, fontFace: F.head, color: C.teal });
    text(s, l, { x, y: y + 2.9, w: 2.9, h: 0.4, fontSize: 12, color: C.muted });
  });
  footer(s, LABEL, n);
}

// 4. Topology
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Test network: each protocol disagrees", "Setup");
  s.addImage({ path: fig("topology.png"), x: 0.4, y: y - 0.1, w: 5.6, h: 5.6 * 4.6 / 8 });
  const rows = [
    ["RIP", C.rip, "4 hops over the 100 Mbps R8–R10 link"],
    ["OSPF", C.ospf, "Cheapest cost: the busy 10 Gbps AS200 backbone"],
    ["BGP", C.bgp, "Local preference: AS300, the cheaper ISP"],
  ];
  text(s, "Flow R1 → R12", { x: 6.2, y: y - 0.05, w: 3.3, h: 0.3, fontSize: 12, bold: true, color: C.muted });
  rows.forEach(([p, col, d], i) => {
    const yy = y + 0.35 + i * 0.95;
    card(s, 6.2, yy, 3.3, 0.8);
    s.addShape("roundRect", { x: 6.35, y: yy + 0.22, w: 0.75, h: 0.34, fill: { color: col }, line: { color: col }, rectRadius: 0.05 });
    text(s, p, { x: 6.35, y: yy + 0.22, w: 0.75, h: 0.34, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle" });
    text(s, d, { x: 7.22, y: yy + 0.08, w: 2.2, h: 0.64, fontSize: 11, valign: "middle" });
  });
  footer(s, LABEL, n);
}

// 5. Model accuracy + importance
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "The model: accurate, and it ignores hop count", "Model");
  s.addChart(pres.charts.BAR, [{ name: "MAE", labels: ["Linear regression", "Formula (no ML)", "Random Forest"], values: [T.linear_regression.mae, T.measured_score_formula.mae, T.random_forest.mae] }],
    quietChart({ x: 0.4, y: y - 0.1, w: 4.4, h: 2.6, barDir: "bar", chartColors: [C.muted, C.greedy, C.teal], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0",
      valAxisHidden: true, valGridLine: { style: "none" }, showTitle: true, title: "Mean absolute error on unseen traffic (lower is better)", barGapWidthPct: 55, valAxisMinVal: 0, valAxisMaxVal: 12 }));
  text(s, [
    { text: `R² ${T.random_forest.r2.toFixed(3)}`, options: { bold: true, color: C.teal, fontSize: 20, fontFace: F.head } },
    { text: `   test  ·  ${metrics.cv.r2_mean.toFixed(3)} ± ${metrics.cv.r2_std.toFixed(3)} in 5-fold CV`, options: { color: C.muted, fontSize: 12 } },
  ], { x: 0.5, y: y + 2.7, w: 4.4, h: 0.45, valign: "middle" });
  const nice = { latency_ms: "Latency", avail_bw_mbps: "Available bw", loss_pct: "Packet loss", jitter_ms: "Jitter", avail_bw_delta_mbps: "Bw trend", bottleneck_capacity_mbps: "Bottleneck cap.", latency_delta_ms: "Latency trend", loss_delta_pct: "Loss trend", hop_count: "Hop count" };
  const imp = Object.entries(metrics.permutation_importance).reverse();
  s.addChart(pres.charts.BAR, [{ name: "Importance", labels: imp.map(([k]) => nice[k]), values: imp.map(([, v]) => v) }],
    quietChart({ x: 5.0, y: y - 0.1, w: 4.6, h: 3.4, barDir: "bar", chartColors: [C.teal], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", dataLabelFontSize: 9,
      valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 10, showTitle: true, title: "Permutation importance", barGapWidthPct: 35 }));
  footer(s, LABEL, n);
  s.addNotes("Hop count, the one metric RIP uses, contributes essentially nothing (0.0001) to predicting how a path will actually perform.");
}

// 6. Headline routing result
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "ML routing nearly matches the hindsight-best path", "Routing results");
  const order = [ML, GR, "OSPF", "BGP", "RIP", "Oracle"];
  s.addChart(pres.charts.BAR, [{ name: "Mean quality", labels: order.map(nm), values: order.map(k => routing[k].mean_quality) }],
    quietChart({ x: 0.4, y: y - 0.1, w: 5.9, h: 3.6, barDir: "col", chartColors: order.map(k => STRAT_COLORS[k]), showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0",
      valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, showTitle: true, title: "Mean realised quality · 4 flows × 2,000 ticks of unseen traffic", barGapWidthPct: 45, catAxisLabelFontSize: 10 }));
  const o = routing.OSPF, m = routing[ML], orc = routing.Oracle;
  const stats = [
    [`+${(m.mean_quality - o.mean_quality).toFixed(1)}`, "quality points over OSPF"],
    [`${Math.round((m.mean_quality - o.mean_quality) / (orc.mean_quality - o.mean_quality) * 100)}%`, "of the gap from OSPF to the best possible path closed"],
    [`${m.poor_quality_pct.toFixed(1)}%`, `of time degraded (OSPF ${o.poor_quality_pct.toFixed(0)}%, RIP ${routing.RIP.poor_quality_pct.toFixed(0)}%)`],
  ];
  stats.forEach(([v, l], i) => {
    const yy = y + i * 1.13;
    card(s, 6.6, yy, 2.9, 0.98);
    text(s, v, { x: 6.8, y: yy + 0.06, w: 2.6, h: 0.5, fontSize: 26, bold: true, fontFace: F.head, color: C.teal });
    text(s, l, { x: 6.8, y: yy + 0.55, w: 2.6, h: 0.4, fontSize: 10.5, color: C.muted });
  });
  footer(s, LABEL, n);
}

// 7. Detailed table
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Lower latency, far less loss", "Routing results");
  const order = [ML, GR, "OSPF", "BGP", "RIP", "Oracle"];
  const hdr = t => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.teal }, fontSize: 11, fontFace: F.body, align: "center", valign: "middle" } });
  const cell = (t, strat, first) => ({ text: t, options: { fontSize: 12, fontFace: F.body, color: first ? STRAT_COLORS[strat] : C.ink, bold: strat === ML || first, align: first ? "left" : "center", fill: { color: strat === ML ? "DFF1EF" : C.white }, valign: "middle" } });
  const rows = [[hdr("Strategy"), hdr("Quality"), hdr("Latency ms"), hdr("p95 latency ms"), hdr("Loss %"), hdr("Near-optimal %"), hdr("Route changes /1k")]];
  order.forEach(k => {
    const r = routing[k];
    rows.push([cell(k === "Oracle" ? "Oracle (hindsight)" : nm(k), k, true), cell(r.mean_quality.toFixed(1), k), cell(r.mean_latency_ms.toFixed(1), k), cell(r.p95_latency_ms.toFixed(0), k),
      cell(r.mean_loss_pct.toFixed(2), k), cell(r.near_optimal_pct.toFixed(1), k), cell(r.route_changes_per_1000.toFixed(0), k)]);
  });
  s.addTable(rows, { x: 0.5, y, w: 9, colW: [1.9, 1.0, 1.1, 1.3, 1.0, 1.3, 1.4], rowH: 0.44, border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.03, 0.08, 0.03, 0.08] });
  const o = routing.OSPF, m = routing[ML];
  text(s, [
    { text: `vs OSPF: `, options: { bold: true } },
    { text: `${Math.round((1 - m.mean_latency_ms / o.mean_latency_ms) * 100)}% lower mean latency, ${Math.round((1 - m.p95_latency_ms / o.p95_latency_ms) * 100)}% lower tail latency, ${Math.round((1 - m.mean_loss_pct / o.mean_loss_pct) * 100)}% less packet loss.` },
  ], { x: 0.5, y: y + 3.25, w: 9, h: 0.35, fontSize: 13 });
  footer(s, LABEL, n);
  s.addNotes("Near-optimal: realised quality within 1 point of the best candidate at that tick. Oracle route changes show how often the true best path moves.");
}

// 8. Timeline
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Static routes ride every congestion episode", "Over time · flow R1 → R12");
  s.addImage({ path: fig("routing_timeline.png"), x: 0.5, y: y - 0.1, w: 9.0, h: 9.0 * 3.4 / 9 });
  text(s, "OSPF and BGP collapse to 5–20 whenever their fixed path is congested; RIP is stuck near 60 on its 100 Mbps link. ML stays near 97 by moving away in time.",
    { x: 0.5, y: y + 3.35, w: 9, h: 0.5, fontSize: 12, color: C.muted });
  footer(s, LABEL, n);
}

// 9. Drill
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Congestion drill on the backbone", "Stress test");
  const order = [ML, GR, "OSPF", "BGP", "RIP", "Oracle"];
  const q = drill.mean_quality_during_event;
  s.addChart(pres.charts.BAR, [{ name: "Quality", labels: order.map(nm), values: order.map(k => q[k]) }],
    quietChart({ x: 0.4, y: y - 0.1, w: 5.9, h: 3.6, barDir: "col", chartColors: order.map(k => STRAT_COLORS[k]), showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0",
      valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, showTitle: true, title: `Mean quality of flow R1→R12 while ${drill.link} is congested (${drill.runs} runs)`, barGapWidthPct: 45, catAxisLabelFontSize: 10 }));
  card(s, 6.6, y, 2.9, 1.45);
  text(s, "Injected", { x: 6.8, y: y + 0.12, w: 2.5, h: 0.3, fontSize: 11, bold: true, color: C.muted });
  text(s, `+${Math.round(drill.peak_added_utilisation * 100)}% load on ${drill.link} for ${drill.duration_ticks} ticks, ${drill.runs} independent traffic runs`, { x: 6.8, y: y + 0.42, w: 2.55, h: 0.95, fontSize: 12 });
  card(s, 6.6, y + 1.65, 2.9, 1.7, C.night);
  text(s, `${drill.ml_ticks_to_leave_link.mean.toFixed(1)} ticks`, { x: 6.8, y: y + 1.8, w: 2.5, h: 0.55, fontSize: 26, bold: true, fontFace: F.head, color: C.white });
  text(s, `for ML to leave the link when it was on it (${drill.ml_runs_on_link_at_injection} of ${drill.runs} runs; otherwise it was already elsewhere). The episode itself ramps up over 4 ticks.`, { x: 6.8, y: y + 2.35, w: 2.55, h: 0.95, fontSize: 10.5, color: "B9CFCD" });
  footer(s, LABEL, n);
}

// 10. ML vs greedy
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Is it the ML, or just measuring?", "Honest comparison");
  text(s, "A no-ML router that plugs current measurements into the quality formula already gets close. What the model adds:", { x: 0.5, y, w: 9, h: 0.5, fontSize: 13, color: C.muted });
  const g = routing[GR], m = routing[ML];
  const cmp = [
    ["Route changes per 1,000 decisions", m.route_changes_per_1000, g.route_changes_per_1000, "0", "8× more stable: less reordering and control-plane churn"],
    ["Near-optimal picks", m.near_optimal_pct, g.near_optimal_pct, "0.0", "Better at choosing among close paths"],
    ["Prediction error (MAE)", T.random_forest.mae, T.measured_score_formula.mae, "0.0", "Learns how noisy, trending probes translate into next-tick quality"],
  ];
  cmp.forEach(([t, mv, gv, fmt, d], i) => {
    const x = 0.5 + i * 3.07;
    card(s, x, y + 0.7, 2.9, 2.75);
    text(s, t, { x: x + 0.2, y: y + 0.85, w: 2.5, h: 0.5, fontSize: 13, bold: true });
    const f = v => fmt === "0" ? Math.round(v).toString() : v.toFixed(1);
    text(s, [{ text: f(mv), options: { color: C.teal } }, { text: "  vs  ", options: { color: C.muted, fontSize: 14 } }, { text: f(gv), options: { color: C.greedy } }],
      { x: x + 0.2, y: y + 1.4, w: 2.6, h: 0.6, fontSize: 26, bold: true, fontFace: F.head });
    text(s, [{ text: "ML", options: { color: C.teal, bold: true } }, { text: "   vs   ", options: { color: C.muted } }, { text: "no ML", options: { color: C.greedy, bold: true } }], { x: x + 0.2, y: y + 2.0, w: 2.6, h: 0.3, fontSize: 10 });
    text(s, d, { x: x + 0.2, y: y + 2.4, w: 2.55, h: 0.9, fontSize: 11, color: C.muted });
  });
  footer(s, LABEL, n);
  s.addNotes(`Mean quality is close: ML ${m.mean_quality.toFixed(1)} vs ${g.mean_quality.toFixed(1)}. Most of the gain over OSPF comes from being measurement-driven at all; the Random Forest adds stability and accuracy, and it learns the quality mapping from data instead of needing a hand-written formula.`);
}

// 11. Dashboard
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Live dashboard", "Demonstration");
  // Top of the dashboard screenshot, pre-cropped to this 5.6 x 3.6 frame
  s.addImage({ path: path.join(ROOT, "docs/images/dashboard_top.png"), x: 0.5, y: y - 0.1, w: 5.6, h: 3.6 });
  const steps = [
    ["Play", "All strategies route the same live traffic"],
    ["Jam backbone (or click a link)", "Only that road turns red; OSPF’s quality collapses"],
    ["Watch ML reroute", "Teal route moves; event log records it"],
    ["Candidate table", "Measured → predicted → what actually happened"],
  ];
  steps.forEach(([t, d], i) => {
    const yy = y + i * 0.88;
    badge(s, 6.4, yy + 0.02, String(i + 1), C.teal, 0.4);
    text(s, t, { x: 6.95, y: yy - 0.02, w: 2.6, h: 0.3, fontSize: 13, bold: true });
    text(s, d, { x: 6.95, y: yy + 0.28, w: 2.6, h: 0.5, fontSize: 11, color: C.muted });
  });
  footer(s, LABEL, n);
  s.addNotes("Switch to the running dashboard (python -m smartpath dashboard) and follow docs/demo_script.md.");
}

// 12. Packet Tracer
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Packet Tracer validation workflow", "Validation");
  const steps = [
    ["Build", "Same 12-router topology; interface bandwidth set so OSPF costs match"],
    ["Verify protocols", "tracert under RIP and OSPF matches the simulator’s chosen routes"],
    ["Capture", "ping, tracert, show interfaces per candidate path"],
    ["Score", "python -m smartpath validate <folder>"],
  ];
  steps.forEach(([t, d], i) => {
    const yy = y + i * 0.82;
    badge(s, 0.5, yy + 0.05, String(i + 1), C.teal, 0.42);
    text(s, t, { x: 1.1, y: yy, w: 3.6, h: 0.3, fontSize: 14, bold: true });
    text(s, d, { x: 1.1, y: yy + 0.3, w: 3.8, h: 0.45, fontSize: 11, color: C.muted });
  });
  const hdr = t => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.teal }, fontSize: 10, fontFace: F.body } });
  const c = (t, b) => ({ text: t, options: { fontSize: 10.5, fontFace: F.body, color: C.ink, bold: !!b } });
  s.addTable([
    [hdr("Sample path"), hdr("Latency"), hdr("Loss"), hdr("Free bw"), hdr("Predicted")],
    [c("ISP-B", true), c("37 ms"), c("0%"), c("502 Mbps"), c("97.1", true)],
    [c("100 Mbps shortcut"), c("31 ms"), c("0%"), c("56 Mbps"), c("59.7")],
    [c("AS200 backbone"), c("119 ms"), c("20%"), c("588 Mbps"), c("45.4")],
  ], { x: 5.2, y: y + 0.05, w: 4.3, colW: [1.35, 0.7, 0.55, 0.9, 0.8], rowH: 0.38, border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.03, 0.06, 0.03, 0.06] });
  card(s, 5.2, y + 1.85, 4.3, 1.45, "F6F1EA");
  text(s, "Scope", { x: 5.4, y: y + 1.97, w: 3.9, h: 0.3, fontSize: 12, bold: true, color: C.amber });
  text(s, "Sample files are hand-written in Packet Tracer’s output format to exercise the parser. Packet Tracer can confirm protocol choices, not congestion behaviour.", { x: 5.4, y: y + 2.27, w: 3.95, h: 0.95, fontSize: 11 });
  footer(s, LABEL, n);
}

// 13. Limitations & future
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Limitations and next steps", "Outlook");
  const lim = ["Synthetic traffic; quality score is a modelling choice", "Chosen routes don’t add load back (no herd effects)", "Probe overhead not modelled", "Enforcing end-to-end paths needs SDN / segment routing", "No link failures or convergence delays"];
  const fut = ["Load feedback and many-flow stability", "Failures and protocol convergence", "Online retraining as traffic drifts", "SDN controller on Mininet to enforce paths", "Reinforcement learning for multi-flow placement"];
  [[lim, "Limitations", C.amber, "F6F1EA"], [fut, "Future work", C.teal, C.tint]].forEach(([items, t, col, bg], i) => {
    const x = 0.5 + i * 4.6;
    card(s, x, y, 4.4, 3.4, bg);
    text(s, t, { x: x + 0.25, y: y + 0.2, w: 3.9, h: 0.4, fontSize: 18, bold: true, fontFace: F.head, color: col });
    text(s, items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })), { x: x + 0.25, y: y + 0.75, w: 3.95, h: 2.5, fontSize: 13, paraSpaceAfter: 7 });
  });
  footer(s, LABEL, n);
}

// 14. Conclusion
{
  const s = darkSlide(pres); n++;
  text(s, "CONCLUSION", { x: 0.6, y: 0.85, w: 8, h: 0.3, fontSize: 11, bold: true, color: C.tealLight, charSpacing: 3 });
  text(s, "Routing on predicted quality beats routing on static metrics", { x: 0.6, y: 1.2, w: 8.8, h: 1.1, fontSize: 30, bold: true, fontFace: F.head, color: C.white });
  const m = routing[ML], o = routing.OSPF;
  const stats = [[m.mean_quality.toFixed(1), `path quality (OSPF ${o.mean_quality.toFixed(1)})`], [`${Math.round((1 - m.mean_loss_pct / o.mean_loss_pct) * 100)}%`, "less packet loss than OSPF"], [T.random_forest.r2.toFixed(3), "R² on unseen traffic"]];
  stats.forEach(([v, l], i) => {
    const x = 0.6 + i * 3.0;
    text(s, v, { x, y: 2.75, w: 2.8, h: 0.8, fontSize: 40, bold: true, fontFace: F.head, color: C.tealLight });
    text(s, l, { x, y: 3.55, w: 2.7, h: 0.5, fontSize: 13, color: "D7EFEC" });
  });
  text(s, "Thank you · Questions", { x: 0.6, y: 4.6, w: 5, h: 0.4, fontSize: 16, bold: true, color: C.white });
}

pres.writeFile({ fileName: path.join(ROOT, "docs/Final_Review.pptx") }).then(f => console.log("wrote", f));
