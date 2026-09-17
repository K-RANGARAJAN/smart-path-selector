# Smart Path Selector

Intelligent router path selection using machine learning.

RIP, OSPF and BGP choose paths from static metrics (hop count, configured cost,
policy). They cannot see congestion, packet loss or jitter. This project trains a
Random Forest on network metrics to predict the real quality of each candidate path
and routes on that prediction.

See [docs/proposal.md](docs/proposal.md) for the full proposal.

## Status

- [x] DA 1: proposal and architecture
- [ ] DA 2: simulator, dataset, baselines, model
- [ ] Final: recommendation engine, evaluation, dashboard
