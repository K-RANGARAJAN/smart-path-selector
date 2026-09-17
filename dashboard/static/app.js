(() => {
  const COLORS = {
    "ML (Random Forest)": "#0b7a75", "Greedy measured": "#8e6c8a", OSPF: "#c9621a", BGP: "#8c8a3e", RIP: "#6b7fa3", Oracle: "#9aa5b1",
  };
  const SHORT = { "ML (Random Forest)": "ML", "Greedy measured": "Greedy" };
  const AS_FILL = { 100: "#e3eef7", 200: "#fbe9dc", 300: "#eef0dc", 400: "#e6f2ef" };
  const CHART_SERIES = ["ML (Random Forest)", "OSPF", "BGP", "RIP"];
  const SVGNS = "http://www.w3.org/2000/svg";

  const $ = id => document.getElementById(id);
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const px = x => 40 + x * 9.2;
  const py = y => 20 + y * 5.9;

  let topo = null, snap = null, playing = false, timer = null, busy = false;

  async function api(path, body) {
    if (window.SmartPathLocal) return window.SmartPathLocal.request(path, body);
    const opts = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
    const r = await fetch(path, opts);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  function utilColor(u) {
    const stops = [[0, [184, 194, 201]], [0.55, [184, 194, 201]], [0.78, [224, 165, 60]], [0.95, [194, 59, 46]], [1, [194, 59, 46]]];
    for (let i = 1; i < stops.length; i++) {
      if (u <= stops[i][0]) {
        const [u0, c0] = stops[i - 1], [u1, c1] = stops[i];
        const t = (u - u0) / (u1 - u0 || 1);
        return `rgb(${c0.map((c, k) => Math.round(c + t * (c1[k] - c))).join(",")})`;
      }
    }
    return "rgb(194,59,46)";
  }

  function drawTopology() {
    const svg = $("topology");
    svg.innerHTML = "";
    const pos = Object.fromEntries(topo.routers.map(r => [r.name, [px(r.x), py(r.y)]]));
    const layers = { as: el("g", {}, svg), links: el("g", {}, svg), paths: el("g", {}, svg), routers: el("g", {}, svg) };
    for (const as of topo.ases) {
      const pts = topo.routers.filter(r => r.asn === as.asn).map(r => pos[r.name]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs) - 42, y0 = Math.min(...ys) - 38, x1 = Math.max(...xs) + 42, y1 = Math.max(...ys) + 38;
      el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 14, fill: AS_FILL[as.asn], class: "as-box" }, layers.as);
      const label = el("text", as.asn === 400 ? { x: x1, y: y0 - 8, "text-anchor": "end", class: "as-label" } : { x: x0 + 10, y: y1 - 10, class: "as-label" }, layers.as);
      label.textContent = as.name;
    }
    for (const l of topo.links) {
      const [x1, y1] = pos[l.a], [x2, y2] = pos[l.b];
      const g = el("g", { "data-link": `${l.a}-${l.b}` }, layers.links);
      const hit = el("line", { x1, y1, x2, y2, class: "link-hit" }, g);
      const width = { 100: 3, 1000: 6, 10000: 11 }[l.capacity_mbps];
      el("line", { x1, y1, x2, y2, class: "link", "stroke-width": width, stroke: "#b8c2c9" }, g);
      const cap = el("text", { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 9, class: "cap" }, g);
      cap.textContent = { 100: "100M", 1000: "1G", 10000: "10G" }[l.capacity_mbps];
      const title = el("title", {}, hit);
      title.textContent = `${l.a}–${l.b}`;
      hit.addEventListener("click", () => congest(l.a, l.b));
    }
    for (const r of topo.routers) {
      const [x, y] = pos[r.name];
      const g = el("g", { class: "router", "data-router": r.name }, layers.routers);
      el("circle", { cx: x, cy: y, r: 19 }, g);
      el("text", { x, y }, g).textContent = r.name;
    }
    svg._pos = pos;
    svg._paths = layers.paths;
  }

  function updateTopology() {
    const svg = $("topology");
    const pos = svg._pos;
    const cap = Object.fromEntries(topo.links.map(l => [`${l.a}-${l.b}`, l.capacity_mbps]));
    for (const l of snap.links) {
      const g = svg.querySelector(`[data-link="${l.a}-${l.b}"]`);
      if (!g) continue;
      const line = g.querySelector(".link");
      line.setAttribute("stroke", utilColor(l.util));
      line.classList.toggle("congested", l.events > 0);
      g.querySelector("title").textContent =
        `${l.a}–${l.b} · ${cap[`${l.a}-${l.b}`] >= 1000 ? cap[`${l.a}-${l.b}`] / 1000 + " Gbps" : cap[`${l.a}-${l.b}`] + " Mbps"} · load ${(l.util * 100).toFixed(0)}%` +
        (l.events ? ` · congestion episode (${l.events} ticks left)` : "") + "\nClick to inject congestion";
    }
    const [src, dst] = snap.flow.split("->");
    svg.querySelectorAll(".router").forEach(g => g.classList.toggle("endpoint", g.dataset.router === src || g.dataset.router === dst));
    const layer = svg._paths;
    layer.innerHTML = "";
    const pts = p => p.split("-").map(r => pos[r].join(",")).join(" ");
    el("polyline", { points: pts(snap.choices["ML (Random Forest)"]), class: "ml-path" }, layer);
    const cmp = $("compare").value;
    el("polyline", { points: pts(snap.choices[cmp]), class: "cmp-path", stroke: COLORS[cmp] }, layer);
  }

  function updateScoreboard() {
    $("poor-th").textContent = snap.poor_threshold;
    $("scoreboard").innerHTML = snap.scoreboard.map(r => {
      const cls = r.strategy.startsWith("ML") ? "ml" : r.strategy === "Oracle" ? "oracle" : "";
      const name = r.strategy === "Oracle" ? "Oracle (hindsight best)" : r.strategy;
      return `<div class="row ${cls}">
        <span class="dot" style="background:${COLORS[r.strategy]}"></span>
        <span class="name">${name}</span>
        <span class="nums"><span class="q ${r.quality < snap.poor_threshold ? "bad" : ""}">${r.quality.toFixed(0)}</span>
          <span class="m" title="session mean">${r.mean.toFixed(1)}</span><span class="p" title="% of ticks below ${snap.poor_threshold}">${r.poor_pct.toFixed(1)}%</span></span>
        <span class="path">${r.path}</span>
      </div>`;
    }).join("");
  }

  function updateChart() {
    const canvas = $("chart");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = 220;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 30, r: 8, t: 8, b: 20 };
    const data = snap.history;
    const X = i => pad.l + (i / Math.max(1, 179)) * (w - pad.l - pad.r);
    const Y = v => pad.t + (1 - v / 100) * (h - pad.t - pad.b);
    ctx.font = "11px -apple-system, Segoe UI, sans-serif";
    ctx.fillStyle = "#5f6b76";
    ctx.strokeStyle = "#e6eaed";
    ctx.lineWidth = 1;
    for (const v of [0, 25, 50, 75, 100]) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(v, 4, Y(v) + 4);
    }
    ctx.fillStyle = "rgba(184,58,58,.06)";
    ctx.fillRect(pad.l, Y(snap.poor_threshold), w - pad.l - pad.r, Y(0) - Y(snap.poor_threshold));
    if (data.length) {
      ctx.fillStyle = "#5f6b76";
      ctx.fillText(`tick ${data[0].tick}`, pad.l, h - 4);
      const last = `tick ${data[data.length - 1].tick}`;
      ctx.fillText(last, X(data.length - 1) - ctx.measureText(last).width, h - 4);
    }
    for (const s of [...CHART_SERIES].reverse()) {
      ctx.beginPath();
      ctx.strokeStyle = COLORS[s];
      ctx.lineWidth = s.startsWith("ML") ? 2.6 : 1.4;
      data.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p[s])) : ctx.moveTo(X(i), Y(p[s]))));
      ctx.stroke();
    }
    $("chart-legend").innerHTML = CHART_SERIES.map(s => `<span><i style="background:${COLORS[s]}"></i>${SHORT[s] || s}</span>`).join("");
  }

  function updateEvents() {
    $("events").innerHTML = snap.events.map(e => `<li><span class="t">${e.tick}</span><span class="${e.kind}">${e.text}</span></li>`).join("");
  }

  function updateCandidates() {
    const mlPath = snap.choices["ML (Random Forest)"];
    const bar = v => `<span class="bar-cell">${v.toFixed(1)}<i class="mini ${v < snap.poor_threshold ? "bad" : ""}" style="width:${Math.max(2, v * 0.5)}px"></i></span>`;
    $("candidates").innerHTML = snap.candidates.map(c => `
      <tr class="${c.path === mlPath ? "ml-choice" : ""}">
        <td class="path">${c.path}</td>
        <td class="num">${c.latency_ms.toFixed(1)}</td><td class="num">${c.jitter_ms.toFixed(1)}</td>
        <td class="num">${c.loss_pct.toFixed(0)}</td><td class="num">${c.avail_bw_mbps.toFixed(0)}</td>
        <td class="num">${c.hop_count}</td>
        <td class="num">${bar(c.predicted)}</td><td class="num">${bar(c.actual)}${c.best ? '<span class="best">best</span>' : ""}</td>
        <td>${c.chosen_by.map(s => `<span class="badge" style="background:${COLORS[s]}">${SHORT[s] || s}</span>`).join("")}</td>
      </tr>`).join("");
  }

  function render(s) {
    snap = s;
    $("tick").textContent = s.tick;
    updateTopology();
    updateScoreboard();
    updateChart();
    updateEvents();
    updateCandidates();
  }

  const flow = () => $("flow").value;

  async function step(n = 1) {
    if (busy) return;
    busy = true;
    try { render(await api("/api/tick", { n, flow: flow() })); } finally { busy = false; }
  }

  async function congest(a, b) {
    render(await api("/api/congest", { a, b, duration: 40, peak: 0.6, flow: flow() }));
  }

  function setPlaying(on) {
    playing = on;
    $("play").textContent = on ? "Pause" : "Play";
    clearInterval(timer);
    if (on) timer = setInterval(() => step(1).catch(console.error), +$("speed").value);
  }

  async function init() {
    if (window.SMARTPATH_STATIC) {
      const data = await fetch("data.json").then(r => r.json());
      window.SmartPathLocal = window.SmartPathSim.createLocalApi(data, 7);
    }
    topo = await api("/api/topology");
    $("flow").innerHTML = topo.flows.map(f => `<option value="${f}">${f.replace("->", " → ")}</option>`).join("");
    drawTopology();
    render(await api(`/api/state?flow=${encodeURIComponent(flow())}`));
    // Fill the chart with some history so the page is informative immediately.
    await step(40);

    $("play").addEventListener("click", () => setPlaying(!playing));
    $("step").addEventListener("click", () => step(1));
    $("speed").addEventListener("change", () => playing && setPlaying(true));
    $("flow").addEventListener("change", async () => render(await api(`/api/state?flow=${encodeURIComponent(flow())}`)));
    $("compare").addEventListener("change", () => {
      $("cmp-name").textContent = $("compare").value;
      document.querySelector(".swatch.cmp").style.borderTopColor = COLORS[$("compare").value];
      updateTopology();
    });
    $("congest-backbone").addEventListener("click", async () => {
      await api("/api/congest", { a: "R5", b: "R6", duration: 40, peak: 0.6, flow: flow() });
      render(await api("/api/congest", { a: "R6", b: "R7", duration: 40, peak: 0.6, flow: flow() }));
    });
    $("reset").addEventListener("click", async () => {
      setPlaying(false);
      render(await api("/api/reset", { seed: Math.floor(Math.random() * 10000), flow: flow() }));
      await step(40);
    });
    document.addEventListener("keydown", e => {
      if (e.code === "Space" && !["SELECT", "BUTTON"].includes(document.activeElement.tagName)) { e.preventDefault(); setPlaying(!playing); }
    });
    window.addEventListener("resize", () => snap && updateChart());
  }

  init().catch(err => { document.body.insertAdjacentHTML("afterbegin", `<pre style="color:#b83a3a;padding:12px">${err}</pre>`); });
})();
