# Final review: demonstration script (about 10 minutes)

## Before the review

```bash
source .venv/bin/activate
python -m smartpath generate && python -m smartpath train && python -m smartpath evaluate   # once, about 5 min
pytest -q                                                                                     # 31 tests
python -m smartpath dashboard                                                                 # http://127.0.0.1:8050
```

Open the dashboard and the Final Review deck side by side.

## 1. Problem (1 min, slides 1-2)

RIP counts hops, OSPF uses a configured cost, and BGP follows policy. None of them
see congestion.

## 2. The live network (2 min, dashboard)

- Point at the topology: four ASes. AS200 is the fast shared backbone, AS300 the
  slower ISP with a 100 Mbps shortcut.
- Link colour is current load. The teal band is the ML route; the dashed line is
  the protocol chosen in *Compare with*.
- Press **Play**. The scoreboard shows the realised quality of every strategy on
  the same traffic, with a session mean and the % of time below 60.

## 3. Congestion drill (3 min, dashboard)

1. Flow **R1 → R12**, compare with **OSPF**.
2. Click **Congest AS200 backbone**.
3. Within a few ticks, the backbone turns red and OSPF's quality drops toward 15.
   OSPF keeps its route because the configured cost has not changed.
4. The Events panel shows *ML moved to …*, and the teal band leaves the backbone.
5. Scroll to **Candidate paths**: measured metrics, predicted score, and what
   actually happened next tick for every path. Point out the backbone paths:
   loss up, predicted score collapsed.
6. Switch *Compare with* to **RIP**. It stays on the 100 Mbps link, and its free
   bandwidth is too low for the flow.
7. Switch the flow to **R3 → R11** to show the same behaviour on another pair.

## 4. Offline results (3 min, slides)

- Model accuracy on unseen traffic: R² 0.897, MAE 4.7.
- Routing comparison over 2,000 ticks × 4 flows: ML 97.0 vs OSPF 78.3, BGP 76.7,
  RIP 64.7. The oracle is 97.3.
- The no-ML greedy router is close on quality (96.7) but changes route 8× more
  often. Be upfront about this: measuring paths gives most of the gain, and the
  model adds stability and slightly better picks.
- Drill across 20 runs: during backbone congestion OSPF averages 28.7, ML 95.9.

## 5. Validation and limits (1 min)

- Run `python -m smartpath validate validation/packet_tracer/sample_scenario` to
  show the Packet Tracer parser. Say clearly that the sample files are format
  examples.
- Limitations: synthetic traffic; the chosen path does not add load back into the
  simulation; enforcing an end-to-end path needs SDN or segment routing in practice.

## Likely questions

- **Why not just use the formula on measurements?** It works well here because the
  simulator and the score share a model. The Random Forest has to learn that
  mapping from data. It is more accurate (MAE 4.7 vs 5.6) and much more stable
  (30 vs 243 route changes per 1,000 decisions).
- **How fast is it?** 4.4 ms to score 9 candidate paths on a laptop.
- **What would change in a real network?** Probes add overhead, and routing
  decisions change the load itself. Online retraining would be needed as traffic
  patterns drift.
