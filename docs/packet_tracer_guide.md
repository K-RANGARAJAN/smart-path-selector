# Packet Tracer validation guide

This guide explains how to check the project against a Cisco Packet Tracer build of
the same network, and how to score real measurements with the trained model.

## What Packet Tracer can and cannot validate

| Can validate | Cannot validate |
|---|---|
| That the simulator's RIP and OSPF path choices match real IOS behaviour on this topology | Congestion behaviour. Packet Tracer does not model queueing delay or loss under load realistically, so it cannot confirm the traffic model |
| That `smartpath validate` parses real `ping`, `tracert`/`traceroute` and `show interfaces` output | Model accuracy at scale |
| That the model ranks measured paths sensibly | |

Keep the right-hand column in mind when presenting results. The congestion results
come from the simulator.

## 1. Build the topology

Use 12 routers (2911 or PT-Router) named R1-R12 and wire them as in
[`reports/figures/topology.png`](../reports/figures/topology.png) and
`smartpath/topology.py`. Put a PC on R1's LAN and a server on R12's LAN.

Addressing plan: one /30 per link, `10.0.<a><b>.0/30`, where the lower-numbered
router takes `.1`. Example: R5-R6 uses `10.0.56.0/30`, with R5 at `10.0.56.1`.

Match link capacities with the `bandwidth` interface command, so that OSPF costs
match the simulator:

| Simulator capacity | Interface command |
|---|---|
| 10 Gbps (R2-R5, R5-R6, R6-R7, R7-R11, R11-R12) | `bandwidth 10000000` |
| 1 Gbps | `bandwidth 1000000` |
| 100 Mbps (R8-R10) | `bandwidth 100000` |

## 2. Check the protocol choices

The expected routes are in [`reports/protocol_routes.csv`](../reports/protocol_routes.csv).

**OSPF**, on every router:

```
router ospf 1
 auto-cost reference-bandwidth 10000
 network 10.0.0.0 0.255.255.255 area 0
```

From the PC run `tracert <server IP>`. The hops should follow
R1-R2-R5-R6-R7-R11-R12, the lowest cost (15).

**RIP**, on every router (remove OSPF first):

```
router rip
 version 2
 no auto-summary
 network 10.0.0.0
```

`tracert` should now follow a 4-hop route through R3-R8-R10. With equal-cost
routes IOS may load-balance, so check `show ip route` on R1 for all equal-hop
next hops.

**BGP.** Packet Tracer's BGP support is limited. If your version accepts
`route-map` with `set local-preference`, configure AS100 to prefer AS300 and confirm
the route goes through R4-R9-R10. If not, validate only RIP and OSPF, and say so
in the report.

## 3. Capture measurements per candidate path

For each path you want to compare:

1. Pin traffic to that path with static routes, or by shutting the interfaces
   of the alternatives.
2. Optionally generate load. Add PCs that send continuous traffic across one link
   (Simulation mode → *Add Complex PDU* with a periodic interval), and record
   `show interfaces` on that link.
3. Save these outputs in a folder named after the path:

```
validation/packet_tracer/my_scenario/
    ospf_backbone/
        ping.txt         # C:\> ping -n 20 <server>
        tracert.txt      # C:\> tracert <server>
        interfaces.txt   # show interfaces for the links on the path (optional)
        ping_prev.txt    # an earlier ping of the same path (optional, for trends)
    isp_b/
        ...
```

Router output works too: `ping <ip> repeat 20` and `traceroute <ip>`.

## 4. Score them

```bash
python -m smartpath validate validation/packet_tracer/my_scenario --out reports/pt_my_scenario.csv
```

The table shows the measured features, the formula score, the model's predicted
score, and which path it recommends.

`validation/packet_tracer/sample_scenario` contains hand-written example files in
this layout. They show the expected format; they are not real captures.
