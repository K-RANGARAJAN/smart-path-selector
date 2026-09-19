// Browser port of smartpath's simulator, engine and live session (see smartpath/*.py).
// Loaded only by the static site; exposes window.SmartPathLocal with the same
// request/response shapes as the Flask API in dashboard/app.py.
(function (root) {
  "use strict";

  // ---------- random numbers ----------
  function makeRng(seed) {
    let a = seed >>> 0;
    const rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let spare = null;
    const normal = (mu, sigma) => {
      if (spare !== null) { const z = spare; spare = null; return mu + sigma * z; }
      let u = 0; while (u === 0) u = rand();
      const v = rand(), r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return mu + sigma * r * Math.cos(2 * Math.PI * v);
    };
    return {
      random: rand,
      uniform: (lo, hi) => lo + (hi - lo) * rand(),
      integers: (lo, hi) => lo + Math.floor(rand() * (hi - lo)),
      normal,
      lognormal: (mu, sigma) => Math.exp(normal(mu, sigma)),
      binomial: (n, p) => { let k = 0; for (let i = 0; i < n; i++) if (rand() < p) k++; return k; },
    };
  }

  const keyOf = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const pathId = p => p.join("-");
  const pathLinks = p => p.slice(1).map((r, i) => keyOf(p[i], r));

  // ---------- traffic (traffic.py) ----------
  class TrafficModel {
    constructor(links, K, rng) {
      this.K = K; this.rng = rng; this.tick = 0;
      this.links = new Map(links.map(s => [keyOf(s.a, s.b), { spec: s, phase: rng.uniform(0, 0.25), level: s.base_util, events: [] }]));
      this.randomEvents = true;
      this.endedManual = [];
    }
    clearManual() {
      const cleared = [];
      for (const [k, lt] of this.links) {
        if (lt.events.some(e => e.manual)) { cleared.push(k); lt.events = lt.events.filter(e => !e.manual); }
      }
      return cleared;
    }
    setRandomEvents(enabled) {
      this.randomEvents = enabled;
      if (!enabled) for (const lt of this.links.values()) lt.events = lt.events.filter(e => e.manual);
    }
    static boost(e) {
      const elapsed = e.duration - e.remaining;
      return e.peak * Math.min(Math.min(1, (elapsed + 1) / 4), Math.min(1, e.remaining / 4));
    }
    utilisation() {
      const out = new Map();
      for (const [k, lt] of this.links) {
        const u = lt.level + lt.events.reduce((s, e) => s + TrafficModel.boost(e), 0);
        out.set(k, Math.min(0.995, Math.max(0.01, u)));
      }
      return out;
    }
    inject(key, duration, peak) { this.links.get(key).events.push({ remaining: duration, duration, peak, manual: true }); }
    step() {
      this.tick++;
      this.endedManual = [];
      const K = this.K, day = 2 * Math.PI * this.tick / K.ticks_per_day;
      for (const [key, lt] of this.links) {
        const s = lt.spec;
        const target = s.base_util + K.daily_amplitude * Math.sin(day + 2 * Math.PI * lt.phase);
        lt.level = target + K.phi * (lt.level - target) + this.rng.normal(0, K.noise);
        lt.events.forEach(e => e.remaining--);
        const hadManual = lt.events.some(e => e.manual);
        lt.events = lt.events.filter(e => e.remaining > 0);
        if (hadManual && !lt.events.some(e => e.manual)) this.endedManual.push(key);
        if (this.rng.random() < s.event_rate && this.randomEvents) {
          const d = this.rng.integers(10, 60);
          lt.events.push({ remaining: d, duration: d, peak: this.rng.uniform(0.25, 0.6) });
        }
      }
      return this.utilisation();
    }
  }

  // ---------- metrics (metrics.py) ----------
  function linkState(spec, u, K) {
    const service = 6.5 * Math.sqrt(1000 / spec.capacity_mbps);
    const queue = Math.min(K.max_queue_ms, service * u / (1 - u));
    return {
      latency_ms: spec.prop_delay_ms + queue,
      jitter_ms: 0.25 * queue + 0.2,
      loss: 0.0005 + 0.12 / (1 + Math.exp(-(u - 0.9) / 0.02)),
      avail_bw_mbps: spec.capacity_mbps * (1 - u),
      utilisation: u,
    };
  }
  function aggregate(states, specs) {
    let survive = 1;
    states.forEach(s => { survive *= 1 - s.loss; });
    return {
      latency_ms: states.reduce((a, s) => a + s.latency_ms, 0),
      jitter_ms: Math.sqrt(states.reduce((a, s) => a + s.jitter_ms ** 2, 0)),
      loss_pct: 100 * (1 - survive),
      avail_bw_mbps: Math.min(...states.map(s => s.avail_bw_mbps)),
      hop_count: states.length,
      bottleneck_capacity_mbps: Math.min(...specs.map(s => s.capacity_mbps)),
      max_utilisation: Math.max(...states.map(s => s.utilisation)),
    };
  }
  function measure(t, rng, K) {
    const lost = rng.binomial(K.ping_probes, Math.min(1, t.loss_pct / 100));
    return {
      latency_ms: t.latency_ms * rng.lognormal(0, 0.08),
      jitter_ms: t.jitter_ms * rng.lognormal(0, 0.25),
      loss_pct: 100 * lost / K.ping_probes,
      avail_bw_mbps: t.avail_bw_mbps * rng.lognormal(0, 0.1),
      hop_count: t.hop_count,
      bottleneck_capacity_mbps: t.bottleneck_capacity_mbps,
      max_utilisation: t.max_utilisation,
    };
  }
  function rFactor(lat, jit, loss) {
    const d = lat + 2 * jit + 10;
    const id = 0.024 * d + (d > 177.3 ? 0.11 * (d - 177.3) : 0);
    const ie = 30 * Math.log(1 + 15 * loss / 100);
    return 93.2 - id - ie;
  }
  function qualityScore(lat, jit, loss, bw, demand) {
    const r = Math.min(93.2, Math.max(0, rFactor(lat, jit, loss)));
    const f = Math.min(1, Math.max(0, bw) / demand) ** 0.5;
    return 100 * (r / 93.2) * f;
  }

  // ---------- model ----------
  function predictOne(trees, x) {
    const xf = x.map(v => Math.fround(v)); // sklearn compares float32 features
    let sum = 0;
    for (const t of trees) {
      let n = 0;
      while (t.l[n] !== -1) n = xf[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n];
      sum += t.v[n];
    }
    return sum / trees.length;
  }

  // ---------- simulator (simulator.py) ----------
  class Simulator {
    constructor(D, seed) {
      this.D = D; this.K = D.constants; this.rng = makeRng(seed);
      this.specs = new Map(D.links.map(l => [keyOf(l.a, l.b), l]));
      this.traffic = new TrafficModel(D.links, this.K, this.rng);
      this.flows = D.flows;
      this.last = new Map();
      this.util = this.traffic.utilisation();
    }
    get tick() { return this.traffic.tick; }
    trueMetrics(path) {
      const keys = pathLinks(path), specs = keys.map(k => this.specs.get(k));
      return aggregate(keys.map((k, i) => linkState(specs[i], this.util.get(k), this.K)), specs);
    }
    observe(flow) {
      return this.D.candidates[flow].map(path => {
        const m = measure(this.trueMetrics(path), this.rng, this.K);
        const pid = pathId(path), prev = this.last.get(pid) || m;
        this.last.set(pid, m);
        const features = {
          latency_ms: m.latency_ms, jitter_ms: m.jitter_ms, loss_pct: m.loss_pct, avail_bw_mbps: m.avail_bw_mbps,
          hop_count: m.hop_count, bottleneck_capacity_mbps: m.bottleneck_capacity_mbps,
          latency_delta_ms: m.latency_ms - prev.latency_ms, loss_delta_pct: m.loss_pct - prev.loss_pct,
          avail_bw_delta_mbps: m.avail_bw_mbps - prev.avail_bw_mbps,
        };
        return { flow, path, pid, measured: m, features };
      });
    }
    advance() { this.util = this.traffic.step(); }
    realised(path) {
      const m = this.trueMetrics(path);
      return [qualityScore(m.latency_ms, m.jitter_ms, m.loss_pct, m.avail_bw_mbps, this.K.flow_demand_mbps), m];
    }
    warmUp(ticks) { for (let i = 0; i < ticks; i++) { this.flows.forEach(f => this.observe(f)); this.advance(); } }
  }

  // ---------- engine (engine.py) ----------
  class Engine {
    constructor(scoreFn, margin) { this.scoreFn = scoreFn; this.margin = margin; this.current = new Map(); }
    recommend(obs) {
      const flow = obs[0].flow, scores = new Map(obs.map(o => [o.pid, this.scoreFn(o)]));
      let best = obs[0].pid;
      for (const [pid, s] of scores) if (s > scores.get(best)) best = pid;
      const cur = this.current.get(flow);
      let chosen = best;
      if (cur !== undefined && scores.has(cur) && scores.get(best) - scores.get(cur) < this.margin) chosen = cur;
      const switched = cur !== undefined && chosen !== cur;
      this.current.set(flow, chosen);
      return { pid: chosen, scores, switched, previous: cur };
    }
  }

  const ML = "ML (Random Forest)", GREEDY = "Greedy measured", ORACLE = "Oracle";

  // ---------- live session (live.py + dashboard/app.py) ----------
  class LiveState {
    // Demo default: jams happen only where the presenter clicks.
    constructor(D, seed) { this.D = D; this.reset(seed, false); }
    reset(seed, randomJams) {
      const D = this.D, K = D.constants;
      this.seed = seed;
      this.randomJams = randomJams;
      this.sim = new Simulator(D, seed);
      this.sim.traffic.setRandomEvents(randomJams);
      this.sim.warmUp(50);
      const feats = D.features;
      this.ml = new Engine(o => predictOne(D.model.trees, feats.map(f => o.features[f])), K.switch_margin);
      this.greedy = new Engine(o => qualityScore(o.measured.latency_ms, o.measured.jitter_ms, o.measured.loss_pct, o.measured.avail_bw_mbps, K.flow_demand_mbps), K.switch_margin);
      this.history = new Map(D.flows.map(f => [f, []]));
      this.totals = new Map(D.flows.map(f => [f, Object.fromEntries(D.strategies.map(s => [s, { sum: 0, n: 0, poor: 0 }]))]));
      this.events = [{ tick: this.sim.tick, kind: "info", text: `Session started (traffic seed ${seed})` }];
      this.last = this.step();
    }
    step() {
      const sim = this.sim, D = this.D, K = D.constants, tick = sim.tick, pending = [];
      for (const flow of D.flows) {
        const obs = sim.observe(flow);
        const ml = this.ml.recommend(obs), gr = this.greedy.recommend(obs);
        pending.push([flow, obs, ml, { [ML]: ml.pid, [GREEDY]: gr.pid, ...D.static_routes[flow] }]);
      }
      sim.advance();
      const out = new Map();
      for (const [flow, obs, ml, choices] of pending) {
        const candidates = obs.map(o => {
          const [score, m] = sim.realised(o.path);
          return { path: o.pid, measured: o.measured, predicted: ml.scores.get(o.pid),
                   formula: qualityScore(o.measured.latency_ms, o.measured.jitter_ms, o.measured.loss_pct, o.measured.avail_bw_mbps, K.flow_demand_mbps),
                   realised: score, latency: m.latency_ms, loss: m.loss_pct };
        });
        choices[ORACLE] = candidates.reduce((b, c) => (c.realised > b.realised ? c : b)).path;
        const ft = { tick, flow, candidates, choices, ml };
        out.set(flow, ft);
        // record
        const byId = new Map(candidates.map(c => [c.path, c]));
        const point = { tick };
        for (const s of D.strategies) {
          const q = byId.get(choices[s]).realised, t = this.totals.get(flow)[s];
          point[s] = Math.round(q * 100) / 100;
          t.sum += q; t.n += 1; t.poor += q < K.poor_quality ? 1 : 0;
        }
        const h = this.history.get(flow);
        h.push(point); if (h.length > 180) h.shift();
        if (ml.switched) this.pushEvent({ tick, flow, kind: "switch", text: `${flow.replace("->", "→")}: ML moved to ${ml.pid}` });
      }
      for (const k of sim.traffic.endedManual) this.pushEvent({ tick: sim.tick, kind: "cleared", text: `Jam on ${k.replace("-", "–")} has cleared` });
      return out;
    }
    clearJams() {
      const cleared = this.sim.traffic.clearManual();
      this.pushEvent({ tick: this.sim.tick, kind: "cleared",
        text: cleared.length ? "Cleared jams on " + cleared.map(k => k.replace("-", "–")).join(", ") : "No jams to clear" });
    }
    setRandomJams(enabled) {
      this.randomJams = enabled;
      this.sim.traffic.setRandomEvents(enabled);
      this.pushEvent({ tick: this.sim.tick, kind: "info", text: "Random jams switched " + (enabled ? "on" : "off: only jams you add will happen") });
    }
    pushEvent(e) { this.events.unshift(e); if (this.events.length > 40) this.events.pop(); }
    congest(a, b, duration, peak) {
      const key = keyOf(a, b);
      this.sim.traffic.inject(key, duration, peak);
      const [x, y] = key.split("-");
      this.pushEvent({ tick: this.sim.tick, kind: "congestion", text: `You jammed ${x}–${y} for ${duration} steps (+${Math.round(peak * 100)}% traffic)` });
    }
    snapshot(flow) {
      const D = this.D, K = D.constants, ft = this.last.get(flow), sim = this.sim;
      const byId = new Map(ft.candidates.map(c => [c.path, c]));
      const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
      return {
        tick: ft.tick, seed: this.seed, flow, random_jams: this.randomJams,
        links: [...sim.util].map(([k, u]) => {
          const lt = sim.traffic.links.get(k), [a, b] = k.split("-");
          const mine = lt.events.filter(e => e.manual).map(e => e.remaining);
          return { a, b, util: Math.round(u * 1000) / 1000, events: lt.events.length ? Math.max(...lt.events.map(e => e.remaining)) : 0,
                   manual: mine.length ? Math.max(...mine) : 0 };
        }),
        choices: ft.choices,
        candidates: [...ft.candidates].sort((x, y) => y.predicted - x.predicted).map(c => ({
          path: c.path, latency_ms: r2(c.measured.latency_ms), jitter_ms: r2(c.measured.jitter_ms), loss_pct: r2(c.measured.loss_pct),
          avail_bw_mbps: r2(c.measured.avail_bw_mbps), hop_count: c.measured.hop_count,
          predicted: r1(c.predicted), formula: r1(c.formula), actual: r1(c.realised),
          chosen_by: D.strategies.filter(s => s !== ORACLE && ft.choices[s] === c.path), best: ft.choices[ORACLE] === c.path,
        })),
        scoreboard: D.strategies.map(s => {
          const c = byId.get(ft.choices[s]), t = this.totals.get(flow)[s];
          return { strategy: s, path: c.path, quality: r1(c.realised), latency_ms: r1(c.latency), loss_pct: r2(c.loss),
                   mean: r1(t.sum / t.n), poor_pct: r1(100 * t.poor / t.n) };
        }),
        history: this.history.get(flow),
        events: this.events.filter(e => !e.flow || e.flow === flow).slice(0, 15),
        poor_threshold: K.poor_quality,
      };
    }
  }

  function createLocalApi(D, seed) {
    const state = new LiveState(D, seed);
    const flowOf = f => (D.flows.includes(f) ? f : D.flows[0]);
    return {
      state,
      async request(path, body) {
        const [route, query] = path.split("?");
        const params = new URLSearchParams(query || "");
        body = body || {};
        switch (route) {
          case "/api/topology":
            return { routers: D.routers, links: D.links, ases: D.ases, flows: D.flows, strategies: D.strategies };
          case "/api/state":
            return state.snapshot(flowOf(params.get("flow")));
          case "/api/tick": {
            const n = Math.max(1, Math.min(50, parseInt(body.n || 1, 10)));
            for (let i = 0; i < n; i++) state.last = state.step();
            return state.snapshot(flowOf(body.flow));
          }
          case "/api/congest": {
            const key = keyOf(String(body.a), String(body.b));
            if (!state.sim.traffic.links.has(key)) throw new Error(`no link ${body.a}-${body.b}`);
            state.congest(body.a, body.b, Math.max(5, Math.min(200, body.duration || 40)), Math.max(0.1, Math.min(0.9, body.peak || 0.6)));
            return state.snapshot(flowOf(body.flow));
          }
          case "/api/clear":
            state.clearJams();
            return state.snapshot(flowOf(body.flow));
          case "/api/settings":
            if ("random_jams" in body) state.setRandomJams(!!body.random_jams);
            return state.snapshot(flowOf(body.flow));
          case "/api/reset":
            state.reset(parseInt(body.seed ?? state.seed, 10), state.randomJams);
            return state.snapshot(flowOf(body.flow));
          default:
            throw new Error(`unknown route ${route}`);
        }
      },
    };
  }

  const api = { makeRng, linkState, aggregate, qualityScore, predictOne, Simulator, LiveState, createLocalApi };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SmartPathSim = api;
})(typeof window !== "undefined" ? window : globalThis);
