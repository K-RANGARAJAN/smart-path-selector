# Smart Path Selector

Intelligent router path selection using machine learning.

RIP, OSPF and BGP choose paths from static metrics (hop count, configured cost,
policy). They cannot see congestion, packet loss or jitter. This project trains a
Random Forest on network metrics to predict the real quality of each candidate path
and routes on that prediction.

See [docs/proposal.md](docs/proposal.md) for the proposal and
[docs/DA2_Progress_Report.md](docs/DA2_Progress_Report.md) for the 50% report.

## Status

- [x] DA 1: proposal and architecture
- [x] DA 2: simulator, dataset, baselines, model
- [ ] Final: recommendation engine, evaluation, dashboard

## Results so far

| Predictor (unseen traffic) | R² | MAE |
|---|---|---|
| Random Forest | 0.897 | 4.69 |
| Scoring formula on current measurements | 0.876 | 5.56 |
| Linear regression | 0.786 | 10.30 |

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Usage

```bash
python -m smartpath generate   # simulate traffic, write data/train.csv and data/test.csv
python -m smartpath train      # train the Random Forest, write reports/model_metrics.json
pytest
```

## Layout

| Path | Contents |
|---|---|
| `smartpath/topology.py` | Routers, ASes, links, BGP policy |
| `smartpath/traffic.py` | Background traffic and congestion episodes |
| `smartpath/metrics.py` | Link/path metrics, probe noise, quality score |
| `smartpath/protocols.py` | RIP, OSPF, BGP path selection |
| `smartpath/simulator.py` | Tick-based simulator: observe, advance, realise |
| `smartpath/dataset.py` | Dataset generation |
| `smartpath/model.py` | Training, cross-validation, evaluation |
| `reports/` | Metrics and figures |
| `docs/` | Proposal, review decks, reports |
