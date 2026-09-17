const { C, F, W, H, newDeck, text, heading, footer, card, badge, network, darkSlide } = require("./theme");

const pres = newDeck("Intelligent Router Path Selection using ML — DA 1");
const LABEL = "DA 1 · Project overview";
let n = 1;

// 1. Title
{
  const s = darkSlide(pres);
  const nodes = [[6.4, 1.2], [7.6, 0.8], [8.9, 1.4], [7.2, 2.2], [8.4, 2.6], [9.4, 2.4], [6.6, 3.2], [7.9, 3.7], [9.1, 3.9]];
  const edges = [[0, 1], [1, 2], [0, 3], [1, 3], [3, 4], [2, 5], [4, 5], [3, 6], [6, 7], [4, 7], [7, 8], [5, 8]];
  network(s, nodes, edges, { edge: "2F5256", nodeFill: "2F5256" });
  // highlight an adaptive path
  network(s, [nodes[0], nodes[3], nodes[4], nodes[5]], [[0, 1, C.tealLight, 3], [1, 2, C.tealLight, 3], [2, 3, C.tealLight, 3]], { nodeFill: C.tealLight, r: 0.14 });
  text(s, "DA 1 · PROJECT OVERVIEW", { x: 0.6, y: 1.25, w: 5.5, h: 0.3, fontSize: 11, bold: true, color: C.tealLight, charSpacing: 3 });
  text(s, "Intelligent Router Path Selection using Machine Learning", { x: 0.6, y: 1.6, w: 5.6, h: 1.7, fontSize: 32, bold: true, fontFace: F.head, color: C.white });
  text(s, "Routing on predicted path quality instead of static metrics", { x: 0.6, y: 3.35, w: 5.4, h: 0.4, fontSize: 15, color: "B9CFCD" });
  text(s, "github.com/K-RANGARAJAN/smart-path-selector", { x: 0.6, y: 4.75, w: 5.5, h: 0.3, fontSize: 11, color: "8FAFAC" });
  s.addNotes("Introduce the project: traditional routing protocols pick paths from fixed numbers. This project predicts how good each path will actually be, and routes on that.");
}

// 2. How routing decides today
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Routing protocols decide on static numbers", "The problem");
  const protos = [
    ["RIP", C.rip, "Hop count", "Fewest routers wins", "Link speed, load, delay, loss"],
    ["OSPF", C.ospf, "Configured cost", "Reference bandwidth ÷ link bandwidth, Dijkstra", "Congestion — the cost never changes at runtime"],
    ["BGP", C.bgp, "Policy & AS-path", "Local preference, shortest AS path", "Performance of the path altogether"],
  ];
  const cw = 2.8, gap = 0.3;
  protos.forEach(([name, color, metric, how, ignores], i) => {
    const x = 0.5 + i * (cw + gap);
    card(s, x, y, cw, 3.3);
    badge(s, x + 0.25, y + 0.25, name[0], color, 0.5);
    text(s, name, { x: x + 0.9, y: y + 0.3, w: 1.8, h: 0.4, fontSize: 20, bold: true, fontFace: F.head });
    text(s, "DECIDES ON", { x: x + 0.25, y: y + 0.95, w: 2.3, h: 0.22, fontSize: 9, bold: true, color: C.muted, charSpacing: 1 });
    text(s, metric, { x: x + 0.25, y: y + 1.17, w: 2.3, h: 0.3, fontSize: 15, bold: true, color });
    text(s, how, { x: x + 0.25, y: y + 1.5, w: 2.35, h: 0.55, fontSize: 12, color: C.ink });
    text(s, "BLIND TO", { x: x + 0.25, y: y + 2.2, w: 2.3, h: 0.22, fontSize: 9, bold: true, color: C.muted, charSpacing: 1 });
    text(s, ignores, { x: x + 0.25, y: y + 2.42, w: 2.35, h: 0.7, fontSize: 12, color: C.red });
  });
  footer(s, LABEL, n);
  s.addNotes("RIP counts hops. OSPF uses a configured cost tied to bandwidth. BGP follows business policy. None of them measure what the path is doing right now.");
}

// 3. Example
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "“Best” on paper, worst in practice", "Why it matters");
  // diagram
  const A = [1.0, 2.9], B = [4.9, 2.9];
  const top = [[1.9, 1.9], [3.0, 1.9], [4.0, 1.9]];
  const bot = [[1.6, 3.9], [2.5, 4.3], [3.4, 4.3], [4.3, 3.9]];
  const nodes = [A, ...top, B, ...bot];
  network(s, nodes, [[0, 1, C.amber, 4], [1, 2, C.amber, 4], [2, 3, C.amber, 4], [3, 4, C.amber, 4]], { r: 0.13, nodeFill: C.ink });
  network(s, nodes, [[0, 5, C.teal, 4], [5, 6, C.teal, 4], [6, 7, C.teal, 4], [7, 8, C.teal, 4], [8, 4, C.teal, 4]], { r: 0.13, nodeFill: C.ink });
  text(s, "A", { x: 0.55, y: 2.78, w: 0.3, h: 0.3, fontSize: 14, bold: true });
  text(s, "B", { x: 5.15, y: 2.78, w: 0.3, h: 0.3, fontSize: 14, bold: true });
  text(s, "4 hops · 10 Gbps · congested", { x: 1.6, y: 1.4, w: 3.2, h: 0.3, fontSize: 12, bold: true, color: C.amber, align: "center" });
  text(s, "5 hops · 1 Gbps · idle", { x: 1.6, y: 4.55, w: 3.2, h: 0.3, fontSize: 12, bold: true, color: C.teal, align: "center" });
  // right column
  const rx = 6.0;
  card(s, rx, y, 3.5, 1.45);
  text(s, "Static protocols pick", { x: rx + 0.25, y: y + 0.18, w: 3, h: 0.25, fontSize: 11, bold: true, color: C.muted });
  text(s, "The amber path", { x: rx + 0.25, y: y + 0.45, w: 3, h: 0.35, fontSize: 18, bold: true, color: C.amber, fontFace: F.head });
  text(s, "Fewer hops (RIP) and lower cost (OSPF), even while it drops packets.", { x: rx + 0.25, y: y + 0.82, w: 3.05, h: 0.55, fontSize: 11.5 });
  card(s, rx, y + 1.7, 3.5, 1.45);
  text(s, "Measurements say", { x: rx + 0.25, y: y + 1.88, w: 3, h: 0.25, fontSize: 11, bold: true, color: C.muted });
  text(s, "The teal path", { x: rx + 0.25, y: y + 2.15, w: 3, h: 0.35, fontSize: 18, bold: true, color: C.teal, fontFace: F.head });
  text(s, "Longer on paper, but lower delay and no loss right now.", { x: rx + 0.25, y: y + 2.52, w: 3.05, h: 0.55, fontSize: 11.5 });
  text(s, "Illustrative scenario", { x: 0.5, y: H - 0.62, w: 3, h: 0.2, fontSize: 9, italic: true, color: C.muted });
  footer(s, LABEL, n);
  s.addNotes("A concrete case: the 10 Gbps backbone is shorter and cheaper by OSPF cost, but it is carrying a traffic spike. Traditional routing keeps sending traffic into it.");
}

// 4. Proposed idea
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Predict each path’s real quality, then route on it", "Proposed solution");
  const inputs = ["Latency", "Available bandwidth", "Packet loss", "Jitter", "Hop count"];
  inputs.forEach((t, i) => {
    const yy = y + 0.1 + i * 0.66;
    card(s, 0.5, yy, 2.4, 0.5);
    text(s, t, { x: 0.7, y: yy, w: 2.1, h: 0.5, fontSize: 13, bold: true, valign: "middle" });
  });
  text(s, "Live metrics per candidate path", { x: 0.5, y: y + 3.45, w: 2.6, h: 0.25, fontSize: 10, color: C.muted });
  // arrow
  s.addShape("rightArrow", { x: 3.1, y: y + 1.35, w: 0.6, h: 0.45, fill: { color: C.line }, line: { color: C.line } });
  // model
  s.addShape("roundRect", { x: 3.9, y: y + 0.6, w: 2.3, h: 1.95, fill: { color: C.teal }, line: { color: C.teal }, rectRadius: 0.1 });
  text(s, "Random Forest regression", { x: 4.05, y: y + 0.85, w: 2.0, h: 0.8, fontSize: 18, bold: true, fontFace: F.head, color: C.white, align: "center" });
  text(s, "learns how metrics translate into next-interval quality", { x: 4.05, y: y + 1.65, w: 2.0, h: 0.7, fontSize: 11, color: "D7EFEC", align: "center" });
  s.addShape("rightArrow", { x: 6.4, y: y + 1.35, w: 0.6, h: 0.45, fill: { color: C.line }, line: { color: C.line } });
  // output
  text(s, "Quality score per path", { x: 7.2, y: y + 0.35, w: 2.4, h: 0.3, fontSize: 12, bold: true, color: C.muted });
  [["Path 1", 91, C.teal], ["Path 2", 74, C.muted], ["Path 3", 38, C.amber]].forEach(([p, v, col], i) => {
    const yy = y + 0.8 + i * 0.62;
    text(s, p, { x: 7.2, y: yy, w: 0.7, h: 0.4, fontSize: 11, valign: "middle" });
    s.addShape("rect", { x: 7.9, y: yy + 0.08, w: 1.5 * v / 100, h: 0.24, fill: { color: col }, line: { color: col } });
    text(s, String(v), { x: 7.95 + 1.5 * v / 100, y: yy, w: 0.4, h: 0.4, fontSize: 11, bold: true, valign: "middle", color: col });
  });
  text(s, "Highest score is recommended", { x: 7.2, y: y + 2.75, w: 2.4, h: 0.3, fontSize: 12, bold: true, color: C.teal });
  footer(s, LABEL, n);
  s.addNotes("Instead of a fixed metric, a model trained on measured metrics outputs a 0–100 quality score per candidate path. The recommendation engine picks the best one. Scores shown are an example.");
}

// 5. Architecture
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "System architecture", "Design");
  const boxes = [
    ["Network simulator", "Multi-AS topology, time-varying traffic, congestion events"],
    ["Dataset", "Measured metrics now → realised quality next interval"],
    ["ML model", "Random Forest regressor, quality score 0–100"],
    ["Path recommender", "Scores candidates, picks best, avoids flapping"],
    ["Dashboard", "Live metrics, scores and decisions"],
  ];
  const bw = 1.62, gap = 0.2;
  boxes.forEach(([t, d], i) => {
    const x = 0.5 + i * (bw + gap);
    card(s, x, y + 0.2, bw, 1.9, i === 2 ? C.teal : C.tint);
    badge(s, x + 0.15, y + 0.35, String(i + 1), i === 2 ? C.night : C.teal, 0.36);
    text(s, t, { x: x + 0.15, y: y + 0.85, w: bw - 0.3, h: 0.5, fontSize: 13, bold: true, color: i === 2 ? C.white : C.ink });
    text(s, d, { x: x + 0.15, y: y + 1.35, w: bw - 0.28, h: 0.7, fontSize: 10, color: i === 2 ? "D7EFEC" : C.muted });
    if (i < boxes.length - 1) s.addShape("rightArrow", { x: x + bw + 0.02, y: y + 1.05, w: 0.16, h: 0.2, fill: { color: C.muted }, line: { color: C.muted } });
  });
  // baselines + validation
  card(s, 0.5, y + 2.4, 5.4, 1.1);
  text(s, "Baselines on the same topology", { x: 0.7, y: y + 2.52, w: 5, h: 0.3, fontSize: 13, bold: true });
  [["RIP", C.rip], ["OSPF", C.ospf], ["BGP", C.bgp]].forEach(([p, col], i) => {
    s.addShape("roundRect", { x: 0.7 + i * 1.2, y: y + 2.95, w: 1.0, h: 0.38, fill: { color: col }, line: { color: col }, rectRadius: 0.06 });
    text(s, p, { x: 0.7 + i * 1.2, y: y + 2.95, w: 1.0, h: 0.38, fontSize: 12, bold: true, color: C.white, align: "center", valign: "middle" });
  });
  text(s, "compared on identical traffic", { x: 4.35, y: y + 2.95, w: 1.5, h: 0.4, fontSize: 10, color: C.muted, valign: "middle" });
  card(s, 6.1, y + 2.4, 3.4, 1.1);
  text(s, "Validation (optional)", { x: 6.3, y: y + 2.52, w: 3, h: 0.3, fontSize: 13, bold: true });
  text(s, "Cisco Packet Tracer ping / tracert outputs scored by the trained model", { x: 6.3, y: y + 2.85, w: 3.05, h: 0.55, fontSize: 11, color: C.muted });
  footer(s, LABEL, n);
  s.addNotes("Five stages from simulation to dashboard. RIP, OSPF and BGP decision logic run on the same topology and traffic so the comparison is fair. Packet Tracer is used to sanity-check on a real configuration.");
}

// 6. Features & target
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "What the model sees, and what it predicts", "Data");
  const rows = [
    ["Latency (ms)", "End-to-end delay: propagation + queueing"],
    ["Available bandwidth (Mbps)", "Spare capacity at the path’s bottleneck"],
    ["Packet loss (%)", "Probes lost along the path"],
    ["Jitter (ms)", "Variation in delay"],
    ["Hop count", "Number of links — what RIP uses"],
    ["Trends", "Change since the last measurement"],
  ];
  const hdr = { bold: true, color: C.white, fill: { color: C.teal }, fontSize: 12, fontFace: F.body };
  const body = (t, b) => ({ text: t, options: { fontSize: 12, fontFace: F.body, color: C.ink, bold: !!b } });
  s.addTable(
    [[{ text: "Feature", options: hdr }, { text: "Meaning", options: hdr }], ...rows.map(([a, b]) => [body(a, true), body(b)])],
    { x: 0.5, y, w: 5.6, colW: [2.2, 3.4], rowH: 0.42, border: { type: "solid", color: C.line, pt: 0.75 }, fill: { color: C.white }, margin: [0.04, 0.1, 0.04, 0.1] }
  );
  card(s, 6.4, y, 3.1, 2.95, C.night);
  text(s, "TARGET", { x: 6.65, y: y + 0.25, w: 2.6, h: 0.25, fontSize: 10, bold: true, color: C.tealLight, charSpacing: 2 });
  text(s, "0–100", { x: 6.65, y: y + 0.55, w: 2.6, h: 0.8, fontSize: 44, bold: true, fontFace: F.head, color: C.white });
  text(s, "Path quality score in the next interval", { x: 6.65, y: y + 1.4, w: 2.6, h: 0.5, fontSize: 13, bold: true, color: C.white });
  text(s, "Combines delay, jitter and loss (ITU-T G.107 E-model) with whether the path has enough bandwidth for the flow.", { x: 6.65, y: y + 1.95, w: 2.65, h: 0.9, fontSize: 10.5, color: "B9CFCD" });
  footer(s, LABEL, n);
  s.addNotes("Inputs are the metrics a router can measure with probes. The target is the quality the path actually delivers in the next interval, so the model is predicting, not just re-computing.");
}

// 7. Why Random Forest
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Why a Random Forest", "Model choice");
  const reasons = [
    ["Non-linear", "Loss and delay explode as a link nears saturation; trees capture thresholds without hand-tuning."],
    ["Robust to noise", "Averaging many trees smooths noisy probe measurements."],
    ["Fast", "Scoring a handful of paths takes well under a millisecond."],
    ["Explainable", "Feature importance shows which metrics drive decisions."],
  ];
  reasons.forEach(([t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6, yy = y + row * 1.75;
    card(s, x, yy, 4.4, 1.5);
    badge(s, x + 0.25, yy + 0.3, String(i + 1), C.teal, 0.45);
    text(s, t, { x: x + 0.9, y: yy + 0.3, w: 3.3, h: 0.4, fontSize: 17, bold: true, fontFace: F.head });
    text(s, d, { x: x + 0.9, y: yy + 0.72, w: 3.3, h: 0.7, fontSize: 12, color: C.muted });
  });
  footer(s, LABEL, n);
  s.addNotes("Linear regression will be used as a comparison point; it cannot represent the sharp degradation near saturation.");
}

// 8. Evaluation plan
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "How success will be measured", "Evaluation plan");
  const cols = [
    ["Prediction accuracy", C.teal, ["R² on unseen traffic", "Mean absolute error", "Root mean squared error", "vs linear regression and a no-ML formula"]],
    ["Routing quality", C.amber, ["Mean realised path quality", "Latency and packet loss", "% of time with poor quality", "Route changes (stability)"]],
  ];
  cols.forEach(([t, col, items], i) => {
    const x = 0.5 + i * 4.6;
    card(s, x, y, 4.4, 2.9);
    s.addShape("ellipse", { x: x + 0.25, y: y + 0.28, w: 0.22, h: 0.22, fill: { color: col }, line: { color: col } });
    text(s, t, { x: x + 0.6, y: y + 0.2, w: 3.6, h: 0.4, fontSize: 18, bold: true, fontFace: F.head });
    text(s, items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })), { x: x + 0.3, y: y + 0.8, w: 3.9, h: 1.9, fontSize: 14, paraSpaceAfter: 8 });
  });
  text(s, "Every strategy — ML, RIP, OSPF, BGP — routes the same flows through the same simulated traffic.", { x: 0.5, y: y + 3.1, w: 9, h: 0.3, fontSize: 12, italic: true, color: C.muted });
  footer(s, LABEL, n);
}

// 9. Stack & timeline
{
  const s = pres.addSlide(); n++;
  const y = heading(s, "Tools and plan", "Execution");
  const stack = [["Python", "simulator & pipeline"], ["NetworkX", "topology, paths"], ["scikit-learn", "Random Forest"], ["pandas / NumPy", "data"], ["Flask", "dashboard"], ["Packet Tracer", "validation"]];
  text(s, "Stack", { x: 0.5, y, w: 3, h: 0.35, fontSize: 16, bold: true, fontFace: F.head });
  stack.forEach(([a, b], i) => {
    const yy = y + 0.5 + i * 0.48;
    text(s, a, { x: 0.5, y: yy, w: 1.6, h: 0.4, fontSize: 13, bold: true, valign: "middle" });
    text(s, b, { x: 2.1, y: yy, w: 1.9, h: 0.4, fontSize: 12, color: C.muted, valign: "middle" });
  });
  const steps = [
    ["DA 1", "Now", "Problem, design, plan"],
    ["DA 2", "50%", "Simulator, dataset, protocol baselines, trained model & metrics"],
    ["Final", "100%", "Recommendation engine, full evaluation, live dashboard demo"],
  ];
  const tx = 4.6;
  text(s, "Milestones", { x: tx, y, w: 3, h: 0.35, fontSize: 16, bold: true, fontFace: F.head });
  s.addShape("line", { x: tx + 0.21, y: y + 0.75, w: 0, h: 2.3, line: { color: C.line, width: 2 } });
  steps.forEach(([t, pct, d], i) => {
    const yy = y + 0.55 + i * 1.05;
    badge(s, tx, yy, String(i + 1), i === 0 ? C.teal : C.muted, 0.42);
    text(s, `${t}  ·  ${pct}`, { x: tx + 0.65, y: yy - 0.02, w: 4, h: 0.3, fontSize: 15, bold: true, color: i === 0 ? C.teal : C.ink });
    text(s, d, { x: tx + 0.65, y: yy + 0.3, w: 4.2, h: 0.5, fontSize: 12, color: C.muted });
  });
  footer(s, LABEL, n);
}

// 10. Closing
{
  const s = darkSlide(pres); n++;
  text(s, "EXPECTED OUTCOME", { x: 0.6, y: 1.1, w: 8, h: 0.3, fontSize: 11, bold: true, color: C.tealLight, charSpacing: 3 });
  text(s, "Routes that follow real network conditions, with measurable gains over RIP, OSPF and BGP", { x: 0.6, y: 1.45, w: 8.6, h: 1.4, fontSize: 28, bold: true, fontFace: F.head, color: C.white });
  const items = ["Higher average path quality", "Less time on congested paths", "Stable routing without flapping"];
  items.forEach((t, i) => {
    const x = 0.6 + i * 3.0;
    s.addShape("ellipse", { x, y: 3.45, w: 0.18, h: 0.18, fill: { color: C.tealLight }, line: { color: C.tealLight } });
    text(s, t, { x: x + 0.3, y: 3.33, w: 2.6, h: 0.45, fontSize: 14, color: "D7EFEC", valign: "middle" });
  });
  text(s, "Thank you", { x: 0.6, y: 4.6, w: 4, h: 0.4, fontSize: 16, bold: true, color: C.white });
}

pres.writeFile({ fileName: "../DA1_Project_Overview.pptx" }).then(f => console.log("wrote", f));
