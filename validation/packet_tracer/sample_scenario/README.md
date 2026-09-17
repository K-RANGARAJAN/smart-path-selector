# Sample scenario (format example)

These files are **hand-written examples in Packet Tracer's output format**. They are
not captures from a real Packet Tracer run. Their job is to show the layout
`python -m smartpath validate` expects, and to give the parser tests realistic
input. Replace them with your own captures by following
[docs/packet_tracer_guide.md](../../../docs/packet_tracer_guide.md).

The scenario is the R1→R12 flow while ISP-A's backbone is congested:

| Folder | Route | Situation shown |
|---|---|---|
| `1_isp_a_backbone` | R1-R2-R5-R6-R7-R11-R12 | OSPF's choice; R5-R6 is at 94% load and dropping packets |
| `2_isp_b` | R1-R2-R4-R9-R10-R12 | BGP's choice; moderately loaded 1 Gbps links |
| `3_isp_b_100m_shortcut` | R1-R3-R8-R10-R12 | RIP's choice; fewest hops, but a 100 Mbps link |
