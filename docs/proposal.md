# Project Proposal: Intelligent Router Path Selection using Machine Learning

## Problem

Traditional routing protocols select paths with static, pre-configured metrics:

| Protocol | Decision metric | What it ignores |
|---|---|---|
| RIP | Hop count | Link speed, load, loss, delay |
| OSPF | Configured cost (usually reference bandwidth / link bandwidth), Dijkstra | Current congestion; the cost never changes at runtime |
| BGP | Policy (local preference), AS-path length | Performance altogether |

None of these react to real-time congestion, packet loss or jitter. A path can look
optimal on paper (fewest hops, lowest cost) while performing badly right now.

## Idea

Measure what paths are actually doing (latency, available bandwidth, packet loss,
jitter, hop count) and train a model that predicts how well each candidate path will
perform in the next interval. Route on the prediction instead of on configuration.

## Approach

1. **Network simulator** (Python): a multi-AS topology whose links carry time-varying
   background traffic with congestion episodes. Link metrics are derived from
   utilisation with a queueing model.
2. **Dataset**: per tick, per candidate path, the measured features and the realised
   quality score in the next tick.
3. **Model**: Random Forest regression that outputs a path quality score (0-100).
4. **Recommendation engine**: scores all candidate paths and picks the best, with
   hysteresis to avoid route flapping.
5. **Baselines**: RIP, OSPF and BGP decision logic implemented on the same topology.
6. **Dashboard**: live metrics, candidate path scores and the decisions of each
   strategy side by side.
7. **Validation (optional)**: parse ping/tracert output from Cisco Packet Tracer
   scenarios and score the measured paths with the trained model.

## Success criteria

- Model accuracy on unseen traffic: R², MAE, RMSE, compared against simple predictors.
- Routing quality: mean realised path quality, latency and loss of ML-selected paths
  versus RIP / OSPF / BGP, plus how often each strategy picks the best available path.

## Review plan

| Review | Scope |
|---|---|
| DA 1 | Problem, approach, architecture, plan |
| DA 2 (50%) | Simulator, dataset, baselines, trained model and its metrics |
| Final | Recommendation engine, full evaluation, live dashboard demo, validation |
