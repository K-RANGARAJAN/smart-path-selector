// Shared look for the three review decks.
const pptxgen = require("pptxgenjs");

const C = {
  night: "0E2326",    // dark slides
  nightSoft: "173437",
  ink: "1F2933",
  muted: "5F6B76",
  line: "D5DBE0",
  tint: "EEF4F3",     // card background on light slides
  white: "FFFFFF",
  teal: "0B7A75",     // ML / primary
  tealLight: "7FD1C7",
  amber: "D9822B",    // congestion / warning accent
  red: "B83A3A",
  rip: "6B7FA3",
  ospf: "C9621A",
  bgp: "8C8A3E",
  greedy: "8E6C8A",
};
const F = { head: "Cambria", body: "Calibri" };
const W = 10, H = 5.625;

function newDeck(title) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = title;
  return pres;
}

function text(slide, t, o) {
  slide.addText(t, { isTextBox: true, fontFace: F.body, color: C.ink, margin: 0, valign: "top", ...o });
}

// Title of a light content slide. Returns y where content can start.
function heading(slide, title, kicker) {
  slide.background = { color: C.white };
  if (kicker) text(slide, kicker.toUpperCase(), { x: 0.5, y: 0.32, w: 9, h: 0.25, fontSize: 10, bold: true, color: C.teal, charSpacing: 2 });
  text(slide, title, { x: 0.5, y: kicker ? 0.55 : 0.4, w: 9, h: 0.65, fontSize: 28, bold: true, fontFace: F.head, color: C.ink });
  return 1.4;
}

function footer(slide, label, n) {
  text(slide, label, { x: 0.5, y: H - 0.38, w: 6, h: 0.22, fontSize: 9, color: C.muted });
  text(slide, String(n), { x: W - 1.0, y: H - 0.38, w: 0.5, h: 0.22, fontSize: 9, color: C.muted, align: "right" });
}

function card(slide, x, y, w, h, fill) {
  slide.addShape("roundRect", { x, y, w, h, fill: { color: fill || C.tint }, line: { color: fill || C.tint }, rectRadius: 0.08 });
}

function badge(slide, x, y, label, fill, size) {
  const d = size || 0.42;
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: fill || C.teal }, line: { color: fill || C.teal } });
  text(slide, label, { x, y, w: d, h: d, fontSize: d * 30, bold: true, color: C.white, align: "center", valign: "middle" });
}

// Motif: a small router graph. nodes: [[x,y],...] in inches, edges: [[i,j,color?],...]
function network(slide, nodes, edges, opts) {
  const o = { r: 0.12, nodeFill: C.tealLight, edge: "4A6B6E", width: 1.5, ...opts };
  edges.forEach(([i, j, color, width]) => {
    const [x1, y1] = nodes[i], [x2, y2] = nodes[j];
    slide.addShape("line", {
      x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
      flipH: (x2 < x1) !== (y2 < y1),
      line: { color: color || o.edge, width: width || o.width },
    });
  });
  nodes.forEach(([x, y], k) => {
    const fill = (o.fills && o.fills[k]) || o.nodeFill;
    slide.addShape("ellipse", { x: x - o.r, y: y - o.r, w: 2 * o.r, h: 2 * o.r, fill: { color: fill }, line: { color: fill } });
  });
}

function darkSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: C.night };
  return s;
}

module.exports = { pptxgen, C, F, W, H, newDeck, text, heading, footer, card, badge, network, darkSlide };
