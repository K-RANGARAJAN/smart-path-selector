const path = require("path");
const fs = require("fs");
const { C, F, W, H, newDeck, text, heading, footer, card, badge, network, darkSlide } = require("./theme");

const ROOT = path.resolve(__dirname, "../..");
const metrics = JSON.parse(fs.readFileSync(path.join(ROOT, "reports/model_metrics.json")));
const staticCsv = fs.readFileSync(path.join(ROOT, "reports/static_protocols_vs_oracle.csv"), "utf8").trim().split("\n").map(l => l.split(","));
const fig = f => path.join(ROOT, "reports/figures", f);

const pres = newDeck("Intelligent Router Path Selection using ML — DA 2");
const LABEL = "DA 2 · 50% progress";
let n = 1;
const r2 = x => x.toFixed(3), f1 = x => x.toFixed(1);
const T = metrics.test;

const quietChart = extra => ({
  catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontFace: F.body, valAxisLabelFontFace: F.body,
  catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, valGridLine: { color: "E6EAED", size: 0.75 }, catGridLine: { style: "none" },
  catAxisLineShow: false, valAxisLineShow: false, dataLabelFontFace: F.body, dataLabelFontSize: 11, dataLabelColor: C.ink, ...extra,
});

// 1. Title
{
  const s = darkSlide(pres);
  text(s, "DA 2 · 50% PROGRESS REVIEW", { x: 0.6, y: 1.2, w: 6, h: 0.3, fontSize: 11, bold: true, color: C.tealLight, charSpacing: 3 });
  text(s, "Intelligent Router Path Selection using Machine Learning", { x: 0.6, y: 1.55, w: 5.6, h: 1.7, fontSize: 30, bold: true, fontFace: F.head, color: C.white });
  text(s, "Simulator, dataset, protocol baselines and trained model", { x: 0.6, y: 3.3, w: 5.4, h: 0.4, fontSize: 15, color: "B9CFCD" });
  text(s, "github.com/K-RANGARAJAN/smart-path-selector", { x: 0.6, y: 4.75, w: 5.5, h: 0.3, fontSize: 11, color: "8FAFAC" });
  // progress ring motif
  s.addShape("ellipse", { x: 6.9, y: 1.3, w: 2.6, h: 2.6, fill: { color: C.night }, line: { color: C.nightSoft, width: 16 } });
  s.addShape("blockArc", { x: 6.9, y: 1.3, w: 2.6, h: 2.6, fill: { color: C.tealLight }, line: { color: C.tealLight }, angleRange: [270, 90], arcThicknessRatio: 0.16 });
  text(s, "50%", { x: 6.9, y: 2.2, w: 2.6, h: 0.8, fontSize: 40, bold: true, fontFace: F.head, color: C.white, align: "center", valign: "middle" });
  s.addNotes("This review covers the data and modelling half: simulator, dataset, the RIP/OSPF/BGP baselines and the trained Random Forest with its accuracy metrics.");
}

// 2. Status
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Where the project stands", "Progress");
  const done = ["Multi-AS topology (12 routers, 17 links)", "Traffic & congestion model", "Link / path metrics, quality score", "RIP, OSPF, BGP decision logic", "Dataset: 280,000 rows", "Random Forest trained & evaluated", "16 unit tests passing"];
  const todo = ["Recommendation engine", "Closed-loop routing evaluation", "Live dashboard", "Packet Tracer validation"];
  card(s, 0.5, y, 5.1, 3.55);
  text(s, "Completed", { x: 0.75, y: y + 0.2, w: 3, h: 0.35, fontSize: 17, bold: true, fontFace: F.head, color: C.teal });
  done.forEach((t, i) => {
    const yy = y + 0.7 + i * 0.4;
    badge(s, 0.78, yy + 0.04, "✓", C.teal, 0.26);
    text(s, t, { x: 1.2, y: yy, w: 4.3, h: 0.34, fontSize: 13, valign: "middle" });
  });
  card(s, 5.9, y, 3.6, 3.55, "F6F1EA");
  text(s, "For the final review", { x: 6.15, y: y + 0.2, w: 3.2, h: 0.35, fontSize: 17, bold: true, fontFace: F.head, color: C.amber });
  todo.forEach((t, i) => {
    const yy = y + 0.7 + i * 0.4;
    s.addShape("ellipse", { x: 6.18, y: yy + 0.04, w: 0.26, h: 0.26, fill: { color: "F6F1EA" }, line: { color: C.amber, width: 1.5 } });
    text(s, t, { x: 6.6, y: yy, w: 2.8, h: 0.34, fontSize: 13, valign: "middle" });
  });
  footer(s, LABEL, n);
}

// 3. Topology
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Four ASes, three protocol opinions", "Topology");
  s.addImage({ path: fig("topology.png"), x: 0.4, y: y - 0.1, w: 5.6, h: 5.6 * 4.6 / 8 });
  const rows = [
    ["RIP", C.rip, "Fewest hops", "R1→R12 via the 100 Mbps R8–R10 link"],
    ["OSPF", C.ospf, "Lowest cost", "R1→R12 via the 10 Gbps AS200 backbone"],
    ["BGP", C.bgp, "Local preference", "R1→R12 via AS300, the cheaper ISP"],
  ];
  rows.forEach(([p, col, how, ex], i) => {
    const yy = y + i * 1.12;
    card(s, 6.2, yy, 3.3, 0.95);
    s.addShape("roundRect", { x: 6.35, y: yy + 0.15, w: 0.8, h: 0.32, fill: { color: col }, line: { color: col }, rectRadius: 0.05 });
    text(s, p, { x: 6.35, y: yy + 0.15, w: 0.8, h: 0.32, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle" });
    text(s, how, { x: 7.25, y: yy + 0.15, w: 2.2, h: 0.32, fontSize: 13, bold: true, valign: "middle" });
    text(s, ex, { x: 6.35, y: yy + 0.52, w: 3.05, h: 0.38, fontSize: 10.5, color: C.muted });
  });
  footer(s, LABEL, n);
  s.addNotes("The AS200 backbone is fast but shared, and it is where congestion episodes happen most. AS300 is slower but quieter and has one 100 Mbps shortcut. Each protocol picks a different route for the same flow.");
}

// 4. Simulation pipeline
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "From traffic to a quality score", "Simulation model");
  const steps = [
    ["Traffic", "Link utilisation u: AR(1) around base load + daily cycle + congestion episodes"],
    ["Link metrics", "Queue delay ∝ u/(1−u), jitter ∝ queue delay, loss spikes near u ≈ 0.9, spare bandwidth"],
    ["Path metrics", "Latency adds, loss compounds, jitter in quadrature, bandwidth = bottleneck"],
    ["Probes", "Noisy measurements: ±8% latency, ±25% jitter, loss from 100 pings"],
  ];
  steps.forEach(([t, d], i) => {
    const yy = y + i * 0.82;
    badge(s, 0.5, yy + 0.08, String(i + 1), C.teal, 0.44);
    text(s, t, { x: 1.1, y: yy, w: 1.8, h: 0.6, fontSize: 15, bold: true, valign: "middle" });
    text(s, d, { x: 2.9, y: yy, w: 3.2, h: 0.62, fontSize: 11.5, color: C.muted, valign: "middle" });
  });
  card(s, 6.4, y, 3.1, 3.2, C.night);
  text(s, "TARGET", { x: 6.65, y: y + 0.22, w: 2.6, h: 0.25, fontSize: 10, bold: true, color: C.tealLight, charSpacing: 2 });
  text(s, "Quality score, next tick", { x: 6.65, y: y + 0.5, w: 2.6, h: 0.65, fontSize: 18, bold: true, fontFace: F.head, color: C.white });
  text(s, [
    { text: "E-model R-factor", options: { bold: true, color: C.white, breakLine: true } },
    { text: "delay, jitter and loss impairments (ITU-T G.107)", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "× √ bandwidth sufficiency", options: { bold: true, color: C.white, breakLine: true } },
    { text: "for a 150 Mbps flow", options: {} },
  ], { x: 6.65, y: y + 1.3, w: 2.65, h: 1.7, fontSize: 12, color: "B9CFCD" });
  footer(s, LABEL, n);
  s.addNotes("The model sees what probes report now, and must predict the true quality the path delivers in the next tick. That makes it a forecasting task under measurement noise, not a formula lookup.");
}

// 5. Dataset
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Dataset", "Data");
  const stats = [["280k", "rows"], ["9", "features"], ["4", "flows"], ["8–9", "candidate paths per flow"]];
  stats.forEach(([v, l], i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, y, 2.1, 1.45);
    text(s, v, { x: x + 0.2, y: y + 0.15, w: 1.8, h: 0.75, fontSize: 38, bold: true, fontFace: F.head, color: C.teal });
    text(s, l, { x: x + 0.2, y: y + 0.9, w: 1.8, h: 0.45, fontSize: 12, color: C.muted });
  });
  const hdr = { bold: true, color: C.white, fill: { color: C.teal }, fontSize: 12, fontFace: F.body };
  const cell = t => ({ text: t, options: { fontSize: 12, fontFace: F.body, color: C.ink } });
  s.addTable([
    [{ text: "", options: hdr }, { text: "Train", options: hdr }, { text: "Test", options: hdr }],
    [cell("Traffic seed"), cell("1"), cell("2 (independent)")],
    [cell("Ticks"), cell("6,000"), cell("2,000")],
    [cell("Rows"), cell("210,000"), cell("70,000")],
  ], { x: 0.5, y: y + 1.75, w: 5.2, colW: [1.7, 1.5, 2.0], rowH: 0.38, border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.04, 0.1, 0.04, 0.1] });
  text(s, [
    { text: "Target distribution", options: { bold: true, breakLine: true, fontSize: 14 } },
    { text: "Mean 73.0 · median 96.6", options: { breakLine: true } },
    { text: "26.5% of samples below 60 (degraded)", options: {} },
  ], { x: 6.1, y: y + 1.8, w: 3.4, h: 1.2, fontSize: 12.5, color: C.ink });
  footer(s, LABEL, n);
  s.addNotes("Train and test come from different random traffic, so test accuracy measures generalisation to traffic the model has never seen.");
}

// 6. Accuracy
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Random Forest predicts next-tick quality best", "Model accuracy");
  s.addChart(pres.charts.BAR, [{ name: "R²", labels: ["Linear regression", "Formula (no ML)", "Random Forest"], values: [T.linear_regression.r2, T.measured_score_formula.r2, T.random_forest.r2] }],
    quietChart({ x: 0.4, y, w: 5.3, h: 3.4, barDir: "bar", chartColors: [C.muted, C.greedy, C.teal], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
      valAxisMinVal: 0, valAxisMaxVal: 1, valAxisHidden: true, valGridLine: { style: "none" }, showTitle: true, title: "R² on unseen traffic (higher is better)", titleFontSize: 12, titleColor: C.ink, titleFontFace: F.body, barGapWidthPct: 60 }));
  const stats = [[r2(T.random_forest.r2), "test R²"], [f1(T.random_forest.mae), "MAE (quality points)"], [`${r2(metrics.cv.r2_mean)} ± ${metrics.cv.r2_std.toFixed(3)}`, "5-fold time-blocked CV R²"]];
  stats.forEach(([v, l], i) => {
    const yy = y + i * 1.13;
    card(s, 6.0, yy, 3.5, 0.98);
    text(s, v, { x: 6.2, y: yy + 0.08, w: 3.2, h: 0.55, fontSize: 26, bold: true, fontFace: F.head, color: C.teal });
    text(s, l, { x: 6.2, y: yy + 0.6, w: 3.2, h: 0.3, fontSize: 11.5, color: C.muted });
  });
  footer(s, LABEL, n);
  s.addNotes(`Random Forest MAE ${f1(T.random_forest.mae)} vs ${f1(T.measured_score_formula.mae)} for the formula applied to current measurements and ${f1(T.linear_regression.mae)} for linear regression. The formula baseline is strong; the Random Forest improves on it by learning how noisy, trending measurements translate into next-tick quality.`);
}

// 7. Predicted vs actual
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Predictions track reality across the range", "Model accuracy");
  s.addImage({ path: fig("predicted_vs_actual.png"), x: 0.5, y: y - 0.1, w: 3.8 * 5 / 4.6, h: 3.8 });
  const pts = [
    ["Healthy paths", "Tight cluster at 95–98: the model is confident when paths are clean."],
    ["Congested paths", "Clusters near 5–20 are saturated and 100 Mbps paths; predictions land close by."],
    ["Largest errors", "When a path’s state changes sharply before the next tick (error vs. size of change: r = 0.92)."],
  ];
  pts.forEach(([t, d], i) => {
    const yy = y + i * 1.15;
    text(s, t, { x: 5.0, y: yy, w: 4.5, h: 0.35, fontSize: 15, bold: true, fontFace: F.head });
    text(s, d, { x: 5.0, y: yy + 0.38, w: 4.5, h: 0.65, fontSize: 12, color: C.muted });
  });
  footer(s, LABEL, n);
}

// 8. Feature importance
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Latency and bandwidth matter; hop count doesn’t", "Explainability");
  const imp = Object.entries(metrics.permutation_importance);
  const nice = { latency_ms: "Latency", avail_bw_mbps: "Available bandwidth", loss_pct: "Packet loss", jitter_ms: "Jitter", avail_bw_delta_mbps: "Bandwidth trend", bottleneck_capacity_mbps: "Bottleneck capacity", latency_delta_ms: "Latency trend", loss_delta_pct: "Loss trend", hop_count: "Hop count" };
  const ordered = imp.slice().reverse();
  s.addChart(pres.charts.BAR, [{ name: "Importance", labels: ordered.map(([k]) => nice[k]), values: ordered.map(([, v]) => v) }],
    quietChart({ x: 0.4, y: y - 0.1, w: 5.8, h: 3.7, barDir: "bar", chartColors: [C.teal], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", dataLabelFontSize: 9,
      valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 10, showTitle: true, title: "Permutation importance (drop in R² when shuffled)", titleFontSize: 11, titleColor: C.ink, titleFontFace: F.body, barGapWidthPct: 40 }));
  card(s, 6.5, y + 0.2, 3.0, 2.6, C.night);
  text(s, "HOP COUNT", { x: 6.75, y: y + 0.4, w: 2.6, h: 0.25, fontSize: 10, bold: true, color: C.tealLight, charSpacing: 2 });
  text(s, metrics.permutation_importance.hop_count.toFixed(4), { x: 6.75, y: y + 0.68, w: 2.6, h: 0.7, fontSize: 34, bold: true, fontFace: F.head, color: C.white });
  text(s, "The only metric RIP uses tells the model almost nothing about how a path will perform.", { x: 6.75, y: y + 1.45, w: 2.55, h: 1.2, fontSize: 12.5, color: "D7EFEC" });
  footer(s, LABEL, n);
}

// 9. Baseline gap
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Static protocols leave a large gap to the best path", "Baseline analysis");
  const hdrRow = staticCsv[0], data = staticCsv.slice(1);
  const col = name => data.map(r => +r[hdrRow.indexOf(name)]);
  const flows = data.map(r => r[0].replace("->", "→"));
  s.addChart(pres.charts.BAR, ["RIP", "OSPF", "BGP", "Oracle (per tick)"].map(k => ({ name: k === "Oracle (per tick)" ? "Best path each tick" : k, labels: flows, values: col(k) })),
    quietChart({ x: 0.4, y: y - 0.1, w: 6.1, h: 3.75, barDir: "col", chartColors: [C.rip, C.ospf, C.bgp, C.teal], showValue: false, valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25,
      showLegend: true, legendPos: "b", legendFontSize: 10, legendFontFace: F.body, legendColor: C.ink, showTitle: true, title: "Mean next-tick quality on unseen traffic", titleFontSize: 11, titleColor: C.ink, titleFontFace: F.body, barGapWidthPct: 50 }));
  const changes = col("Best path changes");
  const ospf = col("OSPF"), orc = col("Oracle (per tick)");
  const gap = Math.round(orc.reduce((a, v, i) => a + v - ospf[i], 0) / orc.length);
  text(s, `${Math.min(...changes)}–${Math.max(...changes)}`, { x: 6.8, y: y + 0.05, w: 2.7, h: 0.65, fontSize: 32, bold: true, fontFace: F.head, color: C.amber });
  text(s, "times the best path changes in 2,000 ticks — no fixed route can keep up", { x: 6.8, y: y + 0.7, w: 2.7, h: 0.7, fontSize: 12, color: C.muted });
  text(s, `~${gap} pts`, { x: 6.8, y: y + 1.65, w: 2.7, h: 0.65, fontSize: 32, bold: true, fontFace: F.head, color: C.ospf });
  text(s, "average gap between OSPF and the best path each tick", { x: 6.8, y: y + 2.3, w: 2.7, h: 0.6, fontSize: 12, color: C.muted });
  footer(s, LABEL, n);
  s.addNotes("RIP is good for R1→R11 only because the fewest-hop route happens to skip the congested backbone; for R1→R12 and R3→R11 it crosses the 100 Mbps link. Closing this gap is the goal of the recommendation engine in the final phase.");
}

// 10. Challenges
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Challenges and fixes", "Lessons so far");
  const items = [
    ["Nothing to learn", "The first calibration congested the backbone permanently, so one fixed path was always best.", "Retuned loads: backbone usually good, with bursts."],
    ["BGP = OSPF", "Both protocols initially picked identical routes.", "Local preference now favours the cheaper ISP."],
    ["200 MB model", "Fully grown trees were too large to ship.", "Depth/leaf limits: 16 MB, same accuracy."],
    ["Strong no-ML baseline", "The formula on current measurements already reaches R² 0.876.", "Kept as a named baseline for honest comparison."],
  ];
  items.forEach(([t, prob, fix], i) => {
    const colI = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + colI * 4.6, yy = y + row * 1.75;
    card(s, x, yy, 4.4, 1.55);
    text(s, t, { x: x + 0.25, y: yy + 0.15, w: 3.9, h: 0.35, fontSize: 16, bold: true, fontFace: F.head });
    text(s, prob, { x: x + 0.25, y: yy + 0.52, w: 3.9, h: 0.5, fontSize: 11.5, color: C.muted });
    text(s, "→ " + fix, { x: x + 0.25, y: yy + 1.05, w: 3.9, h: 0.4, fontSize: 11.5, bold: true, color: C.teal });
  });
  footer(s, LABEL, n);
}

// 11. Next
{
  const s = darkSlide(pres); n++;
  text(s, "NEXT: FINAL REVIEW", { x: 0.6, y: 0.8, w: 8, h: 0.3, fontSize: 11, bold: true, color: C.tealLight, charSpacing: 3 });
  text(s, "Put the model in the routing loop", { x: 0.6, y: 1.15, w: 8.6, h: 0.8, fontSize: 30, bold: true, fontFace: F.head, color: C.white });
  const next = [
    ["Recommendation engine", "Score all candidates every tick, switch only on a clear win"],
    ["Closed-loop evaluation", "ML vs RIP, OSPF, BGP and a non-ML adaptive router on fresh traffic"],
    ["Live dashboard", "Link load, path scores and decisions, with congestion injection"],
    ["Packet Tracer check", "Score real ping / tracert measurements with the model"],
  ];
  next.forEach(([t, d], i) => {
    const colI = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + colI * 4.5, yy = 2.35 + row * 1.25;
    badge(s, x, yy, String(i + 1), C.teal, 0.42);
    text(s, t, { x: x + 0.6, y: yy - 0.02, w: 3.7, h: 0.35, fontSize: 15, bold: true, color: C.white });
    text(s, d, { x: x + 0.6, y: yy + 0.34, w: 3.7, h: 0.6, fontSize: 12, color: "B9CFCD" });
  });
}

pres.writeFile({ fileName: path.join(ROOT, "docs/DA2_Progress_Review.pptx") }).then(f => console.log("wrote", f));
