# DA 2 Progress Report: 50% Completion

**Project:** Intelligent Router Path Selection using Machine Learning

**Repository:** https://github.com/K-RANGARAJAN/smart-path-selector (tag `da2`)

## 1. Summary

The data and modelling half of the project is complete. A multi-AS network simulator
produces time-varying traffic with congestion episodes. RIP, OSPF and BGP path
selection run on the same topology. A 280,000-row dataset has been generated, and a
Random Forest predicts next-interval path quality on unseen traffic with
**R² = 0.897 and MAE = 4.7 quality points** (0-100 scale).

Before any ML routing, the baseline analysis already shows the gap this project
targets. On unseen traffic the static protocols deliver a mean path quality of
50-90, while the best available path each tick would deliver about 96.

## 2. Completion status

| Component | Status | Notes |
|---|---|---|
| Problem definition, architecture | Done | DA 1 |
| Topology (12 routers, 4 ASes, 17 links) | Done | `smartpath/topology.py` |
| Traffic and congestion model | Done | `smartpath/traffic.py` |
| Link/path metrics and quality score | Done | `smartpath/metrics.py` |
| RIP / OSPF / BGP decision logic | Done | `smartpath/protocols.py`, tested against Dijkstra |
| Candidate path enumeration | Done | `smartpath/paths.py` |
| Dataset generation | Done | `python -m smartpath generate` |
| Random Forest training and evaluation | Done | `python -m smartpath train` |
| Unit tests | Done (16 passing) | `pytest` |
| Recommendation engine | Remaining | Final review |
| Closed-loop routing evaluation vs protocols | Remaining | Final review |
| Live dashboard | Remaining | Final review |
| Packet Tracer validation | Remaining | Final review |

## 3. What was built

### 3.1 Topology

![Topology](../reports/figures/topology.png)

| AS | Role | Characteristics |
|---|---|---|
| AS100 | Campus (sources R1-R4) | 1 Gbps internal links |
| AS200 | ISP-A backbone | 10 Gbps, heavily shared, frequent congestion |
| AS300 | ISP-B | 1 Gbps links plus a 100 Mbps shortcut (R8-R10) |
| AS400 | Data centre (destinations R11, R12) | 10 Gbps |

The topology is built so that each protocol makes a different, defensible choice.

| Flow | RIP (hop count) | OSPF (cost) | BGP (policy) |
|---|---|---|---|
| R1→R12 | R1-R3-R8-R10-R12 (4 hops, crosses 100 Mbps) | R1-R2-R5-R6-R7-R11-R12 (cost 15) | R1-R2-R4-R9-R10-R12 (via preferred AS300) |
| R1→R11 | R1-R2-R5-R7-R11 | R1-R2-R5-R6-R7-R11 | R1-R2-R4-R9-R10-R12-R11 |
| R2→R12 | R2-R4-R9-R10-R12 | R2-R5-R6-R7-R11-R12 | R2-R4-R9-R10-R12 |
| R3→R11 | R3-R8-R10-R12-R11 | R3-R1-R2-R5-R6-R7-R11 | R3-R4-R9-R10-R12-R11 |

### 3.2 Traffic model

Each link's utilisation is a mean-reverting AR(1) process around a base load. On
top of that sit a daily cycle and randomly arriving congestion episodes (10-60
ticks, +25-60% utilisation, ramping up and fading). Episodes can also be injected
by hand for demonstrations.

### 3.3 Metrics and quality score

Per link, from utilisation *u*:

- queueing delay ∝ *u*/(1−*u*) (M/M/1 shape, capped at 250 ms)
- jitter ∝ queueing delay
- loss: 0.05% floor, rising sharply as the buffer overflows near *u* ≈ 0.9
- available bandwidth = capacity × (1−*u*)

Path metrics aggregate across links: latency sums, jitter adds in quadrature,
loss compounds, and available bandwidth is the bottleneck.

**Quality score (0-100)** = simplified ITU-T G.107 E-model R-factor (delay,
jitter, loss impairments) × √(bandwidth sufficiency for a 150 Mbps flow).

Routers observe paths through **noisy probes**: ±8% latency noise, ±25% jitter
noise, ±10% bandwidth noise, and loss counted over 100 pings. The model has to
predict the **true** quality in the **next** tick from these measurements.

### 3.4 Dataset

| | Train | Test |
|---|---|---|
| Traffic seed | 1 | 2 (independent traffic) |
| Ticks | 6,000 | 2,000 |
| Rows (tick × flow × candidate path) | 210,000 | 70,000 |
| Flows | 4 | 4 |
| Candidate paths per flow | 8-9 | 8-9 |

Features (9): latency, jitter, packet loss, available bandwidth, hop count,
bottleneck capacity, and the change in latency, loss and bandwidth since the
previous measurement.
Target: realised quality score in the next tick. Mean 73.0, median 96.6.
26.5% of samples are below 60 (visibly degraded).

## 4. Model results

Random Forest: 150 trees, max depth 16, min 20 samples per leaf, 60% of features
per split. Training takes 14 s. Inference is about 0.002 ms per path (batched).

### 4.1 Accuracy on unseen traffic (test seed)

| Predictor | R² | MAE | RMSE |
|---|---|---|---|
| **Random Forest** | **0.897** | **4.69** | **10.77** |
| Scoring formula on current measurements (no ML) | 0.876 | 5.56 | 11.82 |
| Linear regression | 0.786 | 10.30 | 15.53 |

### 4.2 Cross-validation (5 folds, contiguous time blocks)

R² = **0.912 ± 0.009**, MAE = 4.50

![Predicted vs actual](../reports/figures/predicted_vs_actual.png)

Most predictions sit on the diagonal. The large errors happen when a path's state
changes sharply between the measurement and the next tick, for example when a
congestion episode starts or ends. The absolute error correlates at r = 0.92 with
the size of that change.

### 4.3 What drives the prediction (permutation importance on test data)

| Feature | Drop in R² when shuffled |
|---|---|
| Latency | 0.275 |
| Available bandwidth | 0.187 |
| Packet loss | 0.061 |
| Jitter | 0.043 |
| Bandwidth trend | 0.009 |
| Bottleneck capacity | 0.005 |
| Latency trend | 0.003 |
| Loss trend | 0.001 |
| **Hop count** | **0.0001** |

Hop count, the only metric RIP uses, carries essentially no information about
how a path will perform.

![Feature importance](../reports/figures/feature_importance.png)

## 5. Baseline analysis: static protocols on unseen traffic

Mean next-tick quality of each protocol's fixed path, compared with the best fixed
path in hindsight and with the per-tick best path (oracle):

| Flow | RIP | OSPF | BGP | Best fixed path | Oracle | Best-path changes |
|---|---|---|---|---|---|---|
| R1→R11 | 89.5 | 75.4 | 73.1 | 89.5 | 95.8 | 161 |
| R1→R12 | 50.1 | 74.9 | 73.4 | 89.0 | 96.1 | 177 |
| R2→R12 | 73.8 | 75.5 | 73.8 | 89.6 | 96.0 | 165 |
| R3→R11 | 50.0 | 75.1 | 73.3 | 89.4 | 96.4 | 395 |

Observations:

- No single fixed path is best. The best path changes 160-400 times in 2,000
  ticks. A static protocol cannot follow this, however well it is configured.
- OSPF puts traffic on the 10 Gbps backbone, which is the most congested part of
  the network.
- RIP's result depends on the topology. For R1→R11 the fewest-hop route avoids the
  congested backbone and does well (89.5). For R1→R12 and R3→R11 it crosses the
  100 Mbps link and scores about 50.
- The gap from the static protocols to the oracle (about 6-46 points) is what the ML
  engine aims to close.

## 6. Issues found and how they were resolved

| Issue | Resolution |
|---|---|
| In the first calibration the backbone was congested almost all the time, so one static path was simply best and there was nothing to learn | Retuned base loads so the backbone is usually good but has congestion bursts; the best path now changes regularly |
| BGP initially chose the same paths as OSPF | Set local preference to favour ISP-B (the cheaper contract), so BGP follows policy rather than speed, which is realistic |
| First model file was 200 MB | Limited tree depth and leaf size: 16 MB, with slightly better test accuracy (R² 0.896 → 0.897) |
| The measured-metrics formula is already a strong predictor (R² 0.876) | Kept it as a named baseline so ML gains are reported honestly rather than only against static protocols |

## 7. Remaining work (to final review)

1. Recommendation engine: score candidates each tick, add hysteresis against route
   flapping.
2. Closed-loop evaluation: ML, a non-ML adaptive router, RIP, OSPF, BGP and the oracle
   route the same flows on a fresh traffic seed. Compare quality, latency, loss,
   time degraded and route changes.
3. Live dashboard: topology with link load, candidate path scores and each
   strategy's choice, with congestion injection for the demo.
4. Packet Tracer validation: parse ping/tracert output and score measured paths.

## 8. Reproducing these results

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m smartpath generate   # datasets, topology figure, baseline tables
python -m smartpath train      # model, metrics JSON, figures
pytest
```
