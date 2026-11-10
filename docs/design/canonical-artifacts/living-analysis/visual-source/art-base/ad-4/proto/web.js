// MAP-VISUAL-REFRESH-01 AD-3 — VISUAL GROUPING on top of AD-2 (PO AD-2 review): same style, same data, same coordinates.
// A group-cohesion field is built from the DECLARED SYNTHETIC membership of each element (data mode only): the group's
// colour, light and branches gather around ITS OWN elements, transitions between different groups are calmer/darker, and
// cross-group relations are quieter than internal ones. Nothing moves; the world layer (world-only) is untouched.
// PRODUCT LIMIT: Personal carries no group membership today (PT-01/PT-10) — this field is evaluable in the mock only (PT-13).
//
// MAP-VISUAL-REFRESH-01 AD-2 — evolves AD-1 (PO: "keep the progress, do not rebuild"). REVIEW MATERIAL ONLY, outside the product tree.
// AD-2 adds LIGHT DEPTH to the same particle web: world-anchored light sources of varied size/strength with bounded warm
// halos, illumination that lights and darkens the web, graded branches (few bright main filaments, many faint), relations
// whose light enters the same buffer, decorative latent material in the empty right half, and a stricter name placement.
// Node positions are those of AD-1: the graph is built from AD-1's exact region table and seed; art never moves data.
//
// (AD-1 header follows)
// Every name, node and relation is a DECLARED SYNTHETIC example. Colours are DESIGN colours of this mock, not meanings.
//
// METHOD CHANGE (PO R2 review §5: "change the design method instead of patching"): R2 painted a low-resolution per-pixel
// field (soft => fog) and elliptical cells (=> rings). AD-1 builds the world the way Dashboard01 reads: a COSMIC WEB made
// of ~1M particles accumulated at full device resolution, luminous branches that walk along the web's ridges, and a glow
// derived from the particles themselves (no independent fog layer). Regions are irregular unions of blobs of the same
// web, denser and coloured — never outlined. Relations form a network (trees + bridges), never a closed ring.
(function (G) {
  'use strict';
  // ---------- deterministic noise ----------
  function h2(ix, iy, s) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vn(x, y, s) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
  function fbm(x, y, s, n) { let f = 1, a = 1, sum = 0, nr = 0; for (let o = 0; o < n; o += 1) { sum += a * vn(x * f, y * f, s + o * 17); nr += a; f *= 2.03; a *= 0.5; } return sum / nr; }
  const rng = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  function hsl(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)]; }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a) => `rgba(${Math.round(Math.min(1, c[0]) * 255)},${Math.round(Math.min(1, c[1]) * 255)},${Math.round(Math.min(1, c[2]) * 255)},${a})`;
  const WHITE = [1, 1, 1];

  // ---------- the declared synthetic world (CSS px = world units of this mock) ----------
  // Design palette of the mock, spread so that no family dominates (PO: gold, orange, red, blue, green, turquoise, violet).
  const HUE = { gold: 41, orange: 22, red: 354, blue: 214, green: 140, turq: 176, violet: 272, magenta: 316, amber: 34, teal: 196, rose: 8, lime: 112 };
  const REGIONS_AD1 = [
    { key: 'rel', title: 'العلاقات', hue: HUE.gold, c: [215, 330], size: 205, subs: ['الحب', 'الثقة', 'الخذلان', 'التواصل', 'الصداقة'] },
    { key: 'work', title: 'العمل', hue: HUE.green, c: [655, 135], size: 175, subs: ['الضغوط', 'التوازن', 'الطموح', 'الإنجاز'] },
    { key: 'fear', title: 'الخوف', hue: HUE.red, c: [655, 395], size: 185, subs: ['القلق', 'المجهول', 'فقدان السيطرة', 'المستقبل'] },
    { key: 'par', title: 'الأبوة', hue: HUE.blue, c: [455, 585], size: 180, subs: ['تربية الأبناء', 'المسؤولية', 'الحنان', 'التوازن الأسري'] },
    { key: 'dec', title: 'القرارات', hue: HUE.violet, c: [985, 560], size: 170, subs: ['الاختيار', 'الندم', 'المفترقات', 'بداية جديدة'] },
    { key: 'id', title: 'الهوية', hue: HUE.orange, c: [250, 785], size: 150, subs: ['من أنا؟', 'القيم', 'الغرض', 'الثقة بالنفس'] },
    { key: 'calm', title: 'الصحة النفسية', hue: HUE.turq, c: [95, 585], size: 120, subs: ['التعافي', 'السلام الداخلي', 'الوعي'] },
    { key: 'one', title: 'الوحدة', hue: HUE.magenta, c: [330, 95], size: 140, subs: ['الاغتراب', 'الانتماء', 'البحث عن الذات', 'العزلة'] },
    // LATENT structure (PO PT-10: approved in principle): part of the visual world, NEVER named, NEVER holds nodes or relations
    { key: 'L1', hue: HUE.amber, c: [1080, 150], size: 160, latent: true },
    { key: 'L2', hue: HUE.teal, c: [1100, 335], size: 115, latent: true },
    { key: 'L3', hue: HUE.lime, c: [720, 800], size: 150, latent: true },
    { key: 'L4', hue: HUE.rose, c: [1060, 815], size: 130, latent: true },
    { key: 'L5', hue: HUE.blue, c: [880, 285], size: 85, latent: true },
    { key: 'L6', hue: HUE.orange, c: [520, 300], size: 70, latent: true },
  ];
  // AD-2 ART world (decoration only): the same 14 regions with identical random draws; latent clouds larger and stronger,
  // plus three more latent clouds where AD-1 left the right half empty. They hold no node, no relation and no name.
  const ART = { L1: { size: 205, lw: 0.92 }, L2: { size: 170, lw: 0.95 }, L5: { size: 150, lw: 0.95 } };
  const REGIONS = REGIONS_AD1.map((R) => ({ ...R, lw: R.latent ? 0.84 : 1, ...(ART[R.key] || {}) })).concat([
    { key: 'L7', hue: HUE.violet, c: [925, 80], size: 125, latent: true, lw: 0.84 },
    { key: 'L8', hue: HUE.teal, c: [1150, 485], size: 140, latent: true, lw: 0.95 },
    { key: 'L9', hue: HUE.gold, c: [1170, 690], size: 90, latent: true, lw: 0.7 },
  ]);
  const WARM = [1, 0.8, 0.56];
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function buildRegions(seed, table) {
    const r = rng(seed);
    return table.map((R, i) => {
      // an irregular union of blobs: varied count, size, offset and elongation — no ellipse, no ring
      const n = R.latent ? 3 + Math.floor(r() * 3) : 4 + Math.floor(r() * 4), blobs = [];
      for (let j = 0; j < n; j += 1) {
        const ang = r() * Math.PI * 2, dist = (j === 0 ? 0.1 : 0.25 + r() * 0.55) * R.size, sc = R.size * (j === 0 ? 0.62 : 0.28 + r() * 0.38);
        blobs.push({ x: R.c[0] + Math.cos(ang) * dist, y: R.c[1] + Math.sin(ang) * dist * 0.85, rx: sc * (0.75 + r() * 0.6), ry: sc * (0.55 + r() * 0.5), rot: r() * Math.PI, w: (j === 0 ? 1 : 0.55 + r() * 0.45) });
      }
      for (const b of blobs) { b.c = Math.cos(b.rot); b.s = Math.sin(b.rot); }
      return { ...R, i, blobs, col: hsl(R.hue, 92, R.hue === HUE.red ? 52 : 60), deep: hsl(R.hue, 80, 22), pale: mix(hsl(R.hue, 90, 72), WHITE, 0.35) };
    });
  }
  // per-region membership at (x, y) on domain-warped coordinates (organic edges)
  const MEM = new Float64Array(64);
  function membership(regions, x, y) {
    const wx = x + 38 * (fbm(x / 160, y / 160, 3, 3) - 0.5), wy = y + 38 * (fbm(x / 160 + 9, y / 160 - 4, 4, 3) - 0.5);
    let sum = 0;
    for (let k = 0; k < regions.length; k += 1) {
      let m = 0; const R = regions[k];
      for (const b of R.blobs) { const dx = wx - b.x, dy = wy - b.y, u = (dx * b.c + dy * b.s) / b.rx, v = (-dx * b.s + dy * b.c) / b.ry, d = u * u + v * v; if (d < 9) m += b.w * Math.exp(-d); }
      m = Math.min(1, m) * (R.lw ?? (R.latent ? 0.62 : 1)); MEM[k] = m; sum += m;
    }
    if (regions.GF) { // AD-3: data mode only
      const gmax = regions.GF.at(x, y); sum = 0;
      for (let k = 0; k < regions.length; k += 1) { const R = regions[k]; MEM[k] = R.latent ? MEM[k] * (1 - 0.9 * sstep(0, 0.3, gmax)) : Math.max(MEM[k] * 0.45, GV[k]); sum += MEM[k]; }
    }
    return sum;
  }
  const GV = new Float64Array(64);
  function colourAt(regions, x, y, u) {
    membership(regions, x, y); let tw = 0; const c = [0, 0, 0];
    for (let k = 0; k < regions.length; k += 1) { const w = MEM[k] ** 3; if (w < 1e-5) continue; tw += w; c[0] += regions[k].col[0] * w; c[1] += regions[k].col[1] * w; c[2] += regions[k].col[2] * w; }
    const voidC = [0.42, 0.5, 0.95]; // the web between regions: cool, dim
    if (tw < 1e-6) return voidC;
    const t = Math.min(1, tw * 6); const out = mix(voidC, [c[0] / tw, c[1] / tw, c[2] / tw], t);
    return regions.GF ? groupTone(regions, x, y, out, u) : out;
  }
  // AD-4 (data mode): where groups meet, colour is INTERLEAVED, not blended — each particle, dust grain or whole thread takes
  // ONE group's own colour (u = its own hash), the second group's share rising across the meeting zone; only the faint colour
  // body (u undefined) blends smoothly. RGB blending made a third,
  // false hue (fear red + parenthood blue read as decisions violet). In a transition between two DIFFERENT groups the tone
  // also drifts toward the world's neutral thread colour: a shared connective texture, not a dark void.
  const NEUT = [0.6, 0.66, 0.92];
  function groupTone(regions, x, y, out, u) {
    let i1 = -1, g1 = 0, i2 = -1, g2 = 0;
    for (let k = 0; k < regions.length; k += 1) { if (regions[k].latent) continue; const v = GV[k]; if (v > g1) { i2 = i1; g2 = g1; i1 = k; g1 = v; } else if (v > g2) { i2 = k; g2 = v; } }
    if (g1 < 0.04) return out;
    if (u >= 2) { const k = u - 2; return mix(out, regions[k].col, 0.8 * sstep(0, 0.3, GV[k] + 0.12)); }
    let gc = regions[i1].col; if (g2 >= 0.04) { const p = g2 ** 4 / (g1 ** 4 + g2 ** 4); gc = u === undefined ? mix(gc, regions[i2].col, p) : u < p ? regions[i2].col : gc; }
    out = mix(out, gc, 0.8 * sstep(0.04, 0.38, g1));
    if (g2 >= 0.05) { const tr = (g2 / g1) ** 1.3 * sstep(0.06, 0.35, g2) * (1 - 0.85 * regions.GF.shared(x, y)); out = mix(out, NEUT, 0.32 * tr); }
    return out;
  }
  // the cosmic web: sharp ridges of warped noise at two scales (filaments) + speckle
  function web(x, y) {
    const qx = fbm(x / 230, y / 230, 21, 4), qy = fbm(x / 230 + 5.2, y / 230 + 1.3, 22, 4);
    const r1 = 1 - Math.abs(2 * fbm(x / 150 + 1.7 * qx, y / 150 + 1.7 * qy, 25, 5) - 1);
    const r2 = 1 - Math.abs(2 * fbm(x / 58 + 2.4 * qx, y / 58 + 2.4 * qy, 27, 4) - 1);
    // AD-2: the fine ridge set is halved and the web is CLUMPED (patches of web, not contour lines of equal weight everywhere)
    const clump = 0.28 + 0.72 * sstep(0.36, 0.68, fbm(x / 125 + 3.1, y / 125 - 2.7, 61, 3));
    return Math.max(r1 ** 9, 0.45 * r2 ** 12) * clump;
  }
  function webAxis(x, y) { // tangent of the large-scale ridge field: luminous branches walk along it
    const e = 1.5, f = (a, b) => { const qx = fbm(a / 230, b / 230, 21, 4), qy = fbm(a / 230 + 5.2, b / 230 + 1.3, 22, 4); return fbm(a / 150 + 1.7 * qx, b / 150 + 1.7 * qy, 25, 5); };
    const gx = f(x + e, y) - f(x - e, y), gy = f(x, y + e) - f(x, y - e), L = Math.hypot(gx, gy) || 1; return [-gy / L, gx / L];
  }

  // ---------- semantic layer (synthetic) ----------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function segBoxHit(p, q, box, pad) { for (let t = 0; t <= 1; t += 0.05) { const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t; if (Math.abs(x - box.x) < box.w / 2 + pad && Math.abs(y - box.y) < box.h / 2 + pad) return true; } return false; }
  function buildGraph(regions, measure, seed) {
    const r = rng(seed), nodes = [], edges = [], titles = [];
    for (const R of regions) {
      if (R.latent) continue;
      const tm = measure(R.title, 'title'); const tbox = { x: R.c[0], y: R.c[1], w: tm.w + 26, h: tm.h + 16 };
      titles.push({ R, text: R.title, ...tbox, tw: tm.w, th: tm.h });
      const own = (x, y) => { membership(regions, x, y); let best = -1, bm = 0; for (let k = 0; k < regions.length; k += 1) if (MEM[k] > bm) { bm = MEM[k]; best = k; } return best === R.i ? MEM[R.i] : 0; };
      const pts = [];
      // hub: the region's heart, set apart from its name (a synthetic tier of this mock)
      for (let tries = 0; tries < 400 && pts.length < 1; tries += 1) { const a = r() * Math.PI * 2, d = R.size * (0.32 + r() * 0.3), x = R.c[0] + Math.cos(a) * d, y = R.c[1] + Math.sin(a) * d * 0.8; if (own(x, y) > 0.55 && Math.abs(x - tbox.x) > tbox.w / 2 + 22) pts.push({ x, y, tier: 'hub' }); }
      for (let tries = 0; tries < 3000 && pts.length < R.subs.length + 1; tries += 1) {
        const a = r() * Math.PI * 2, d = R.size * (0.25 + r() * 0.75), x = R.c[0] + Math.cos(a) * d, y = R.c[1] + Math.sin(a) * d * 0.85;
        if (x < 30 || y < 24 || x > 1170 || y > 870 || own(x, y) < 0.42) continue;
        if (Math.abs(x - tbox.x) < tbox.w / 2 + 34 && Math.abs(y - tbox.y) < tbox.h / 2 + 22) continue;
        if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 62) || nodes.some((p) => Math.hypot(p.x - x, p.y - y) < 62)) continue;
        pts.push({ x, y, tier: 'sub' });
      }
      const local = pts.map((p, k) => ({ id: `${R.key}-${k}`, R, x: p.x, y: p.y, tier: p.tier, label: p.tier === 'hub' ? null : R.subs[k - 1] }));
      nodes.push(...local);
      // a TREE inside the region (minimum spanning tree, edges through the name penalised): a network, never a ring
      const inT = [local[0]], out = local.slice(1);
      while (out.length) { let best = null; for (const a of inT) for (const b of out) { const w = dist(a, b) + (segBoxHit(a, b, tbox, 6) ? 1e4 : 0); if (!best || w < best.w) best = { a, b, w }; } edges.push({ a: best.a, b: best.b, kind: 'tree' }); inT.push(best.b); out.splice(out.indexOf(best.b), 1); }
      R.hub = local[0]; R.tbox = tbox;
    }
    // bridges between neighbouring regions (synthetic): hub-to-hub spanning tree + two sub-to-sub links
    const named = regions.filter((R) => !R.latent), inT = [named[0]], out = named.slice(1);
    while (out.length) { let best = null; for (const a of inT) for (const b of out) { const w = dist(a.hub, b.hub); if (!best || w < best.w) best = { a, b, w }; } edges.push({ a: best.a.hub, b: best.b.hub, kind: 'bridge' }); inT.push(best.b); out.splice(out.indexOf(best.b), 1); }
    const nearestPair = (k1, k2) => { let best = null; for (const a of nodes.filter((n) => n.R.key === k1 && n.tier === 'sub')) for (const b of nodes.filter((n) => n.R.key === k2 && n.tier === 'sub')) { const d = dist(a, b); if (!best || d < best.d) best = { a, b, d }; } return best; };
    for (const [k1, k2] of [['rel', 'one'], ['fear', 'dec'], ['par', 'id']]) { const p = nearestPair(k1, k2); if (p) edges.push({ a: p.a, b: p.b, kind: 'bridge' }); }
    // an element where two regions meet, related to both (declared synthetic)
    const F = regions.find((R) => R.key === 'fear'), P = regions.find((R) => R.key === 'par');
    const ov = { id: 'overlap', R: F, R2: P, x: (F.hub.x + P.hub.x) / 2 + 18, y: (F.hub.y + P.hub.y) / 2 + 6, tier: 'sub', label: 'القلق على الأبناء' };
    nodes.push(ov); edges.push({ a: ov, b: F.hub, kind: 'bridge' }, { a: ov, b: P.hub, kind: 'bridge' });
    return { nodes, edges, titles };
  }
  function edgePath(e) { // AD-2: a cubic curve; long bridges take a gentle S (organic sweep) instead of a straight constellation stroke
    const { a, b } = e, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), side = h2(Math.round(a.x), Math.round(b.y), 91) < 0.5 ? -1 : 1;
    const long = e.kind === 'bridge' && len > 230, s1 = side * (long ? 0.2 : e.kind === 'bridge' ? 0.16 : 0.17), s2 = long ? -side * 0.1 : s1;
    const c1 = [a.x + dx / 3 - dy * s1, a.y + dy / 3 + dx * s1], c2 = [a.x + 2 * dx / 3 - dy * s2, a.y + 2 * dy / 3 + dx * s2], pts = [];
    for (let i = 0; i <= 32; i += 1) { const t = i / 32, u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, D = t * t * t; pts.push([A * a.x + B * c1[0] + C * c2[0] + D * b.x, A * a.y + B * c1[1] + C * c2[1] + D * b.y]); }
    return pts;
  }

  // ---------- labels: placed BESIDE their node, never dropped ----------
  function layoutLabels(graph, measure, fieldCost) {
    const placed = graph.titles.map((t) => ({ kind: 'title', text: t.text, x: t.x, y: t.y, w: t.tw, h: t.th, R: t.R }));
    const pts = []; for (const e of graph.edges) for (const p of edgePath(e)) pts.push(p);
    const dense = []; for (let i = 1; i < pts.length; i += 1) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2.5)); for (let j = 0; j < n; j += 1) dense.push([x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n]); }
    const cost = (x, y, w, h, self) => {
      let c = 0;
      for (const o of placed) { const ox = Math.max(0, (o.w + w) / 2 + 8 - Math.abs(o.x - x)), oy = Math.max(0, (o.h + h) / 2 + 3 - Math.abs(o.y - y)); if (ox > 0 && oy > 0) c += 600 + ox * oy; if (o.kind === 'sub') { const gg = Math.hypot(Math.max(0, Math.abs(o.x - x) - (o.w + w) / 2), Math.max(0, Math.abs(o.y - y) - (o.h + h) / 2)); if (gg < 40) c += 45 * (40 - gg); } }
      for (const p of dense) if (Math.abs(p[0] - x) < w / 2 + 3 && Math.abs(p[1] - y) < h / 2 + 2) c += 30;
      for (const n of graph.nodes) if (Math.abs(n.x - x) < w / 2 + (n.tier === 'hub' ? 14 : 8) && Math.abs(n.y - y) < h / 2 + (n.tier === 'hub' ? 14 : 8)) c += 400;
      if (x - w / 2 < 6 || x + w / 2 > 1194 || y - h / 2 < 4 || y + h / 2 > 890) c += 1e4;
      // belonging by proximity: a name must sit nearer to its own node than to any other node (else it is ambiguous)
      if (self) { const near = (n) => Math.max(0, Math.abs(n.x - x) - w / 2) + Math.max(0, Math.abs(n.y - y) - h / 2); const mine = near(self); for (const n of graph.nodes) if (n !== self && near(n) < mine + 6) c += 250; }
      return c;
    };
    // AD-2: a name sits CLOSE to its node (at most 18 pt beyond the base offset — AD-1 let three names drift ~50 pt), an
    // ambiguous position (nearer to another node) is nearly forbidden, and among the close positions the one crossing the
    // fewest relation points wins. Where a node is hemmed in by its own relations, the line is cut behind the name (knockout
    // drawn with the name), so text and line never touch. Two passes: the second re-places each name against all others.
    const cost2 = (x, y, w, h, self) => {
      let c = 0;
      for (const o of placed) { if (o.node === self) continue; const ox = Math.max(0, (o.w + w) / 2 + 8 - Math.abs(o.x - x)), oy = Math.max(0, (o.h + h) / 2 + 3 - Math.abs(o.y - y)); if (ox > 0 && oy > 0) c += 600 + ox * oy; if (o.kind === 'sub') { const gg = Math.hypot(Math.max(0, Math.abs(o.x - x) - (o.w + w) / 2), Math.max(0, Math.abs(o.y - y) - (o.h + h) / 2)); if (gg < 40) c += 45 * (40 - gg); } }
      for (const p of dense) if (Math.abs(p[0] - x) < w / 2 + 3 && Math.abs(p[1] - y) < h / 2 + 2) c += 90;
      // (AD-1 also counted the name's OWN node here, which pushed every above/below position away: fixed — own node needs 7 pt clearance only)
      for (const n of graph.nodes) { const pad = n === self ? 7 : n.tier === 'hub' ? 16 : 9; if (Math.abs(n.x - x) < w / 2 + pad && Math.abs(n.y - y) < h / 2 + pad) c += 400; }
      if (x - w / 2 < 6 || x + w / 2 > 1194 || y - h / 2 < 4 || y + h / 2 > 890) c += 1e4;
      const near = (n) => Math.hypot(Math.max(0, Math.abs(n.x - x) - w / 2), Math.max(0, Math.abs(n.y - y) - h / 2)); const mine = near(self);
      for (const n of graph.nodes) if (n !== self && near(n) < mine + 6) c += 1e4; // belonging first: never nearer to another node
      if (fieldCost) { c += fieldCost(x, y, w, h, self); // AD-4: prefer the side of the node that lies inside its OWN group (never at the cost of belonging)
        const gs = (n) => (n.R2 ? [n.R.i, n.R2.i] : [n.R.i]), mine2 = gs(self);
        for (const o of placed) { if (o.node === self) continue; const gg = Math.hypot(Math.max(0, Math.abs(o.x - x) - (o.w + w) / 2), Math.max(0, Math.abs(o.y - y) - (o.h + h) / 2));
          if (o.kind === 'title') { if (gg < 14) c += 30 * (14 - gg); } else if (!gs(o.node).some((g) => mine2.includes(g)) && gg < 60) c += 30 * (60 - gg); } }
      return c;
    };
    const DIRS = [[1, 0], [-1, 0], [0.7, -1], [-0.7, -1], [0.7, 1], [-0.7, 1], [0, -1], [0, 1], [1, -0.5], [-1, -0.5], [1, 0.5], [-1, 0.5], [0.35, -1], [-0.35, -1], [0.35, 1], [-0.35, 1]];
    const report = { moved: 0, collided: [], audit: {} };
    const place = (n, m) => { let best = null; for (const d of [0, 2, 4, 6, 9, 12, 15, 18]) for (const [ax, ay] of DIRS) { const x = n.x + ax * (m.w / 2 + 10 + d), y = n.y + ay * (m.h / 2 + 8 + d * 0.5), c = cost2(x, y, m.w, m.h, n) + d * 8; if (!best || c < best.c) best = { x, y, c, d }; } return best; };
    // a long multi-word name may also take a compact two-line form (nothing dropped, nothing abbreviated); it is chosen only
    // when it is cheaper by more than a fixed preference for the single line
    const forms = (text) => { const one = measure(text, 'sub'), out = [{ w: one.w, h: one.h, lines: null, pref: 0 }], ws = text.split(' ');
      if (ws.length >= 2 && one.w > 70) { let bestSplit = null; for (let k = 1; k < ws.length; k += 1) { const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' '), wa = measure(a, 'sub').w, wb = measure(b, 'sub').w, mw = Math.max(wa, wb); if (!bestSplit || mw < bestSplit.w) bestSplit = { w: mw, lines: [a, b] }; } out.push({ w: bestSplit.w, h: one.h * 1.9, lines: bestSplit.lines, pref: 150 }); }
      return out; };
    const placeBest = (n, text) => { let pick = null; for (const fm of forms(text)) { const b = place(n, fm); if (!pick || b.c + fm.pref < pick.b.c + pick.fm.pref) pick = { b, fm }; } return pick; };
    for (const n of graph.nodes) { if (!n.label) continue; const { b, fm } = placeBest(n, n.label); placed.push({ kind: 'sub', text: n.label, x: b.x, y: b.y, w: fm.w, h: fm.h, lines: fm.lines, node: n }); }
    for (let pass = 0; pass < 2; pass += 1) for (const l of placed) { if (l.kind !== 'sub') continue; const { b, fm } = placeBest(l.node, l.text); Object.assign(l, { x: b.x, y: b.y, d: b.d, w: fm.w, h: fm.h, lines: fm.lines }); }
    // audit every name: gap to its own node, gap to the nearest other node, relation points under it
    for (const l of placed) {
      if (l.kind !== 'sub') continue; const n = l.node;
      const gap = (q) => Math.hypot(Math.max(0, Math.abs(q.x - l.x) - l.w / 2), Math.max(0, Math.abs(q.y - l.y) - l.h / 2));
      let other = 1e9, otherName = ''; for (const q of graph.nodes) if (q !== n) { const g = gap(q); if (g < other) { other = g; otherName = q.label || `${q.R.title} (hub)`; } }
      let hits = 0; for (const p of dense) if (Math.abs(p[0] - l.x) < l.w / 2 + 1 && Math.abs(p[1] - l.y) < l.h / 2 + 1) hits += 1;
      report.audit[l.text] = { ownGap: +gap(n).toFixed(1), nearestOtherGap: +other.toFixed(1), nearestOther: otherName, relationPointsUnder: hits, ambiguous: other <= gap(n) };
      if (l.d > 0) report.moved += 1; if (hits > 0 || other <= gap(n)) report.collided.push(l.text);
    }
    return { labels: placed, report, dense };
  }

  // ---------- the image ----------
  function render(canvas, opts) {
    const W = opts.W, H = opts.H, DPR = opts.dpr, Wd = W * DPR, Hd = H * DPR, T = {};
    canvas.width = Wd; canvas.height = Hd; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    const FONT = 'Estedad, sans-serif';
    const measure = (text, kind) => { ctx.font = kind === 'title' ? `500 ${opts.titleSize}px ${FONT}` : `400 ${opts.subSize}px ${FONT}`; ctx.direction = 'rtl'; const m = ctx.measureText(text); return { w: m.width, h: (kind === 'title' ? opts.titleSize : opts.subSize) * 1.35 }; };
    let t = performance.now();
    // the art world (AD-2) and, separately, AD-1's exact world for the graph: data positions are never moved by art
    const regions = buildRegions(opts.seed, REGIONS), graph = opts.data ? buildGraph(buildRegions(opts.seed, REGIONS_AD1), measure, opts.seed + 7) : { nodes: [], edges: [], titles: [] };
    const nearNode = (x, y, r) => { for (const n of graph.nodes) if (Math.abs(n.x - x) < r && Math.abs(n.y - y) < r) return true; return false; };
    const nodeColOf = (n) => (n.R2 ? mix(mix(n.R.col, n.R2.col, 0.5), WHITE, 0.5) : n.R.col); // AD-4: the shared element is not given a blended third hue
    // AD-3 GROUP-COHESION FIELD (data mode): per declared group, a soft union of kernels around ITS elements, its title and
    // along its internal relations, on domain-warped coordinates with noisy amplitude (organic, never an ellipse or outline).
    // An element declared in two groups («القلق على الأبناء») feeds both, plus a SHARED field that keeps their meeting zone alive.
    const groupsOf = (n) => (n.R2 ? [n.R.i, n.R2.i] : [n.R.i]);
    const isInternal = (e) => groupsOf(e.a).some((g) => groupsOf(e.b).includes(g));
    const edgeGroup = (e) => regions[groupsOf(e.a).find((q) => groupsOf(e.b).includes(q))];
    // AD-4 TITLE PLACEMENT (presentation only: the titles are mock-chosen, not data). Each title moves to its group's visual
    // centre — the centroid of its OWN elements (hub weighted x2, a shared element x0.5) — at the nearest spot covering no
    // relation and no node. Nodes and relations never move.
    const titleShift = {};
    if (opts.data && opts.group !== false) {
      const dpts = []; for (const e of graph.edges) { const p = edgePath(e); for (let i = 1; i < p.length; i += 1) { const [x0, y0] = p[i - 1], [x1, y1] = p[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3)); for (let j = 0; j < n; j += 1) dpts.push([x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n]); } }
      const done = [];
      for (const t of graph.titles) {
        let sx = 0, sy = 0, sw = 0; for (const n of graph.nodes) if (groupsOf(n).includes(t.R.i)) { const w = n.tier === 'hub' ? 2 : n.R2 ? 0.5 : 1; sx += n.x * w; sy += n.y * w; sw += w; }
        const cx = sx / sw, cy = sy / sw, w = t.tw + 18, h = t.th + 6; let best = null;
        for (let dy = -80; dy <= 80; dy += 4) for (let dx = -100; dx <= 100; dx += 4) {
          const x = cx + dx, y = cy + dy; let c = Math.hypot(dx, dy) * 1.2;
          if (x - w / 2 < 8 || x + w / 2 > 1192 || y - h / 2 < 6 || y + h / 2 > 888) continue;
          for (const p of dpts) if (Math.abs(p[0] - x) < w / 2 + 3 && Math.abs(p[1] - y) < h / 2 + 3) c += 40;
          for (const n of graph.nodes) if (Math.abs(n.x - x) < w / 2 + 16 && Math.abs(n.y - y) < h / 2 + 14) c += 900;
          for (const o of done) if (Math.abs(o.x - x) < (o.w + w) / 2 + 20 && Math.abs(o.y - y) < (o.h + h) / 2 + 10) c += 1e4;
          if (!best || c < best.c) best = { x, y, c };
        }
        titleShift[t.text] = [+(best.x - t.x).toFixed(1), +(best.y - t.y).toFixed(1), +Math.hypot(best.x - cx, best.y - cy).toFixed(1)]; t.x = best.x; t.y = best.y; done.push({ x: t.x, y: t.y, w, h });
      }
    }
    if (opts.data && opts.group !== false) {
      const GG = 4, fw = Math.ceil(W / GG) + 2, fh = Math.ceil(H / GG) + 2, named = regions.filter((R) => !R.latent).map((R) => R.i);
      const F = {}; for (const k of named) F[k] = new Float32Array(fw * fh); const S = new Float32Array(fw * fh), WX = new Float32Array(fw * fh), WY = new Float32Array(fw * fh), AMP = new Float32Array(fw * fh);
      for (let gy = 0; gy < fh; gy += 1) for (let gx = 0; gx < fw; gx += 1) { const x = gx * GG, y = gy * GG, o = gy * fw + gx; WX[o] = x + 30 * (fbm(x / 120 + 3, y / 120, 81, 3) - 0.5); WY[o] = y + 30 * (fbm(x / 120, y / 120 + 5, 82, 3) - 0.5); AMP[o] = 0.72 + 0.5 * fbm(x / 85, y / 85, 83, 3); }
      const kern = (A, x0, y0, r, w) => { const R3 = r * 2.4, ax = Math.max(0, Math.floor((x0 - R3 - 20) / GG)), bx = Math.min(fw - 1, Math.ceil((x0 + R3 + 20) / GG)), ay = Math.max(0, Math.floor((y0 - R3 - 20) / GG)), by = Math.min(fh - 1, Math.ceil((y0 + R3 + 20) / GG)); for (let gy = ay; gy <= by; gy += 1) for (let gx = ax; gx <= bx; gx += 1) { const o = gy * fw + gx, d = Math.hypot(WX[o] - x0, WY[o] - y0) / r; if (d > 2.4) continue; const v = w * Math.exp(-d * d); A[o] = 1 - (1 - A[o]) * (1 - v); } };
      for (const n of graph.nodes) { const gs = groupsOf(n), hub = n.tier === 'hub'; for (const g of gs) kern(F[g], n.x, n.y, hub ? 100 : 64, gs.length > 1 ? 0.8 : hub ? 1 : 0.92); if (gs.length > 1) kern(S, n.x, n.y, 70, 1); }
      for (const t of graph.titles) kern(F[t.R.i], t.x, t.y, 72, 0.7);
      for (const e of graph.edges) { if (!isInternal(e)) continue; const g = groupsOf(e.a).find((q) => groupsOf(e.b).includes(q)), p = edgePath(e); for (let i = 0; i < p.length; i += 3) kern(F[g], p[i][0], p[i][1], 36, 0.62); }
      for (const k of named) for (let o = 0; o < fw * fh; o += 1) F[k][o] = Math.min(1, F[k][o] * AMP[o]);
      const bil = (A, x, y) => { const fx = x / GG, fy = y / GG, ix = Math.max(0, Math.min(fw - 2, Math.floor(fx))), iy = Math.max(0, Math.min(fh - 2, Math.floor(fy))), tx = fx - ix, ty = fy - iy, a = A[iy * fw + ix], b = A[iy * fw + ix + 1], c = A[(iy + 1) * fw + ix], d = A[(iy + 1) * fw + ix + 1]; return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty; };
      regions.GF = { at: (x, y) => { let m = 0; for (let k = 0; k < regions.length; k += 1) GV[k] = 0; for (const k of named) { const v = bil(F[k], x, y); GV[k] = v; if (v > m) m = v; } return m; }, shared: (x, y) => bil(S, x, y) };
    }
    const named0 = regions.filter((R) => !R.latent).map((R) => R.i);
    const gcen = {}; for (const k of named0) { let sx = 0, sy = 0, sw = 0; for (const n of graph.nodes) if (groupsOf(n).includes(k)) { sx += n.x; sy += n.y; sw += 1; } if (sw) gcen[k] = [sx / sw, sy / sw]; }
    const fieldCost = regions.GF ? (x, y, w, h, self) => { let c = 0; const own = groupsOf(self);
      if (self.tier !== 'hub' && !self.R2) { const g = gcen[self.R.i], ax = g[0] - self.x, ay = g[1] - self.y, bx = x - self.x, by = y - self.y, cs = (ax * bx + ay * by) / ((Math.hypot(ax, ay) * Math.hypot(bx, by)) || 1); c += 45 * (1 - cs) / 2; } for (const sx of [-0.4, 0, 0.4]) { regions.GF.at(x + sx * w, y); let o = 0, q = 0; for (const k of named0) { if (own.includes(k)) o = Math.max(o, GV[k]); else q = Math.max(q, GV[k]); } c += 240 * Math.max(0, q - o + 0.05); } return c; } : null;
    const lay = opts.data ? layoutLabels(graph, measure, fieldCost) : { labels: [], report: { moved: 0, collided: [] } };
    const quiet = opts.names === false ? [] : lay.labels.map((l) => ({ x: l.x, y: l.y, w: l.w + (l.kind === 'title' ? 26 : 10), h: l.h + (l.kind === 'title' ? 14 : 4) }));
    const inQuiet = (x, y) => { for (const q of quiet) if (Math.abs(x - q.x) < q.w / 2 && Math.abs(y - q.y) < q.h / 2) return true; return false; };
    // soft, elliptical quiet zone for the particle web (a hard rectangle showed as a dark box behind each name)
    const quietK = (x, y) => { let k = 1; for (const q of quiet) { const dx = (x - q.x) / (q.w * 0.62), dy = (y - q.y) / (q.h * 0.7), d = dx * dx + dy * dy; if (d < 3) k = Math.min(k, 1 - 0.78 * Math.exp(-d * 1.6)); } return k; };
    // SOFT SEPARATION: where two DIFFERENT groups are both present (and no shared element binds them), the web is calmer and
    // darker — a transition, not a border. 1 = no change.
    const sepAt = (x, y) => {
      if (!regions.GF) return 1; regions.GF.at(x, y); let g1 = 0, g2 = 0; for (let k = 0; k < regions.length; k += 1) { const v = GV[k]; if (v > g1) { g2 = g1; g1 = v; } else if (v > g2) g2 = v; }
      if (g2 < 0.05) return 1; const t = (g2 / g1) ** 1.3 * sstep(0.06, 0.35, g2); return 1 - 0.22 * t * (1 - 0.85 * regions.GF.shared(x, y)); // AD-4: at most -22% (AD-3: -50%) — groups part by colour identity and inner light, not by dark voids
    };
    T.layout = performance.now() - t;

    // 0. LIGHT SOURCES (AD-2). (a) The WORLD's own lights: placed by seed inside the clouds, identical with or without data;
    // under a name or beside a node they are dimmed (never moved). (b) One light per data node: hub vs element is the only
    // tier difference; within a tier, size and strength come from a hash of the node's world position — not from any data
    // value, rank or importance. Some world lights are larger than some hubs, so light never reads as a measure.
    const lights = [], rl = rng(opts.seed + 404), GFsaved = regions.GF; regions.GF = null; // world lights see the world only
    for (let i = 0, made = 0; i < 8000 && made < 44; i += 1) {
      const x = 20 + rl() * (W - 40), y = 20 + rl() * (H - 40), m = Math.min(1, membership(regions, x, y)), u = rl(), v = rl(), w = rl();
      if (m < 0.5 || w > m * (0.25 + 0.75 * web(x, y) * 3)) continue; // only inside the dense web: a light alone in the void read as a flat disc
      if (lights.some((l) => Math.hypot(l.x - x, l.y - y) < 80)) continue;
      const dim = quietK(x, y) * (graph.nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 46) ? 0.25 : 1);
      lights.push({ world: true, x, y, r: 12 + 36 * u ** 2.4, I: (0.2 + 0.6 * v ** 2) * dim * Math.min(1, m * 1.25), c: mix(colourAt(regions, x, y), WARM, 0.5) }); made += 1;
    }
    regions.GF = GFsaved; for (const l of lights) l.I *= sepAt(l.x, l.y); // in a transition between groups a world light is dimmed
    for (const n of graph.nodes) {
      const hub = n.tier === 'hub', s = h2(Math.round(n.x), Math.round(n.y), 77), s2 = h2(Math.round(n.y), Math.round(n.x), 78);
      lights.push({ x: n.x, y: n.y, r: hub ? 44 + 40 * s : 12 + 9 * s, I: hub ? 1.0 + 0.7 * s2 : 0.45 + 0.3 * s2, c: mix(nodeColOf(n), WARM, hub ? 0.5 : 0.3) });
    }
    // AD-4 INTERNAL LIGHT (data mode): a faint LIT AREA along each INTERNAL relation — it only brightens the group's own texture
    // between its elements (no visible halo, no disc), the same for every group (never a measure). Cross-group relations get
    // none, so they recede when they are not the focus.
    if (regions.GF) for (const e of graph.edges) { if (!isInternal(e)) continue; const g = edgeGroup(e), p = edgePath(e), len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) * 1.05; for (let i = 2; i < p.length - 1; i += 2) lights.push({ lit: true, x: p[i][0], y: p[i][1], r: 20, I: 0.085 * (len / 16) / 12, c: mix(g.col, WARM, 0.3) }); }
    // illumination on a 2-pt grid: a bounded gaussian core (the visible warm halo) + a wider, weak tail (the lit area)
    const GS = 2, gw = Math.ceil(W / GS) + 2, gh = Math.ceil(H / GS) + 2, Ecore = new Float32Array(gw * gh * 3), Ecol = new Float32Array(gw * gh * 3), Elit = new Float32Array(gw * gh);
    for (const l of lights) {
      const R3 = l.r * 4.2, x0 = Math.max(0, Math.floor((l.x - R3) / GS)), x1 = Math.min(gw - 1, Math.ceil((l.x + R3) / GS)), y0 = Math.max(0, Math.floor((l.y - R3) / GS)), y1 = Math.min(gh - 1, Math.ceil((l.y + R3) / GS));
      for (let gy = y0; gy <= y1; gy += 1) for (let gx = x0; gx <= x1; gx += 1) {
        const d = Math.hypot(gx * GS - l.x, gy * GS - l.y) / l.r, core = l.I * Math.exp(-d * d), tail = 0.32 * l.I * Math.exp(-d * d / 4), o = gy * gw + gx, vis = l.lit ? 0 : l.I * Math.exp(-d * d * 4.5);
        Ecore[3 * o] += l.c[0] * vis; Ecore[3 * o + 1] += l.c[1] * vis; Ecore[3 * o + 2] += l.c[2] * vis; Elit[o] += core + tail; Ecol[3 * o] += l.c[0] * (core + tail); Ecol[3 * o + 1] += l.c[1] * (core + tail); Ecol[3 * o + 2] += l.c[2] * (core + tail);
      }
    }
    const gsamp = (A, ch, stride, x, y) => { const fx = x / GS, fy = y / GS, ix = Math.max(0, Math.min(gw - 2, Math.floor(fx))), iy = Math.max(0, Math.min(gh - 2, Math.floor(fy))), tx = fx - ix, ty = fy - iy, a = A[stride * (iy * gw + ix) + ch], b = A[stride * (iy * gw + ix + 1) + ch], c = A[stride * ((iy + 1) * gw + ix) + ch], d = A[stride * ((iy + 1) * gw + ix + 1) + ch]; return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty; };
    const litAt = (x, y) => Math.min(1.6, gsamp(Elit, 0, 1, x, y));
    const warmAt = (x, y) => { const e = gsamp(Elit, 0, 1, x, y) + 1e-6; return [gsamp(Ecol, 0, 3, x, y) / e, gsamp(Ecol, 1, 3, x, y) / e, gsamp(Ecol, 2, 3, x, y) / e]; };

    // accumulation buffer at full device resolution
    const acc = new Float32Array(Wd * Hd * 3);
    const dep = (x, y, c, k) => { const fx = x * DPR - 0.5, fy = y * DPR - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; const put = (px, py, w) => { if (px < 0 || py < 0 || px >= Wd || py >= Hd) return; const o = 3 * (py * Wd + px), s = w * k; acc[o] += c[0] * s; acc[o + 1] += c[1] * s; acc[o + 2] += c[2] * s; }; put(ix, iy, (1 - tx) * (1 - ty)); put(ix + 1, iy, tx * (1 - ty)); put(ix, iy + 1, (1 - tx) * ty); put(ix + 1, iy + 1, tx * ty); };
    const splat = (x, y, c, k, rad) => { const cx = x * DPR, cy = y * DPR, R = Math.ceil(rad * 2.5); for (let j = -R; j <= R; j += 1) for (let i = -R; i <= R; i += 1) { const px = Math.round(cx) + i, py = Math.round(cy) + j; if (px < 0 || py < 0 || px >= Wd || py >= Hd) continue; const d2 = ((px - cx) ** 2 + (py - cy) ** 2) / (rad * rad), w = Math.exp(-d2); if (w < 0.01) continue; const o = 3 * (py * Wd + px); acc[o] += c[0] * k * w; acc[o + 1] += c[1] * k * w; acc[o + 2] += c[2] * k * w; } };

    // 1. particles of the web (rejection sampling on density)
    t = performance.now();
    const r = rng(opts.seed + 101); let kept = 0;
    const NC = opts.particles;
    for (let i = 0; i < NC; i += 1) {
      const x = r() * W, y = r() * H, msum = Math.min(1.25, membership(regions, x, y)), f = web(x, y);
      // AD-2: darker pockets INSIDE the clouds (depth), so a cloud has a lit rim and shadowed hollows instead of uniform hair
      const pocket = sstep(0.5, 0.72, fbm(x / 85 + 11, y / 85 - 3, 43, 3)) * Math.min(1, msum);
      const dens = (0.012 + 0.5 * msum ** 1.6 * (0.1 + 0.9 * f) + 0.26 * f * (0.12 + 0.88 * Math.min(1, msum * 1.8))) * (1 - 0.55 * pocket);
      const sp = sepAt(x, y), gm = regions.GF ? regions.GF.at(x, y) : 0, shz = regions.GF ? regions.GF.shared(x, y) : 0; if (r() > (dens + 0.07 * gm * gm * (0.35 + 0.65 * f) + 0.1 * shz * shz * (0.3 + 0.7 * f)) * sp) continue; // same candidates, density redistributed toward a group's own elements
      if (r() > quietK(x, y)) continue;
      const lit = litAt(x, y);
      let col = mix(colourAt(regions, x, y, h2(i, 7, 501)), WHITE, 0.04 + 0.3 * r() ** 2.5); col = mix(col, warmAt(x, y), 0.28 * Math.min(1, lit));
      const b = (0.25 + 0.75 * r() ** 2.2) * (0.55 + 0.45 * f) * (0.5 + 0.7 * Math.min(1, msum)) * (0.62 + 0.95 * lit) * (1 - 0.4 * pocket);
      dep(x, y, col, b * 0.9 * (0.6 + 0.4 * sp)); kept += 1;
    }
    T.particles = performance.now() - t; T.kept = kept;

    // 2. luminous branches walking along the ridges, forking; never ending on a node, never crossing a name
    t = performance.now();
    const rw = rng(opts.seed + 202); let walkers = 0;
    // AD-2 GRADED branches: ~7% are MAIN filaments (long, bright, high inertia so they sweep ACROSS the ridge contours and
    // fork into a tree); the rest are faint. Every branch is brighter where the world is lit, dimmer in the dark.
    let mains = 0, wu = 0;
    const walk = (x, y, dir, steps, k, depth, main) => {
      let [tx, ty] = webAxis(x, y); if (tx * dir[0] + ty * dir[1] < 0) { tx = -tx; ty = -ty; }
      let vx = main ? dir[0] : tx, vy = main ? dir[1] : ty; { const L0 = Math.hypot(vx, vy) || 1; vx /= L0; vy /= L0; }
      const inert = main ? 0.93 : 0.82, jit = main ? 0.14 : 0.24; let turn = 0;
      for (let s = 0; s < steps; s += 1) {
        const pvx = vx, pvy = vy;
        let [ax, ay] = webAxis(x, y); if (ax * vx + ay * vy < 0) { ax = -ax; ay = -ay; }
        vx = vx * inert + ax * (1 - inert) + (rw() - 0.5) * jit; vy = vy * inert + ay * (1 - inert) + (rw() - 0.5) * jit; const L = Math.hypot(vx, vy) || 1; vx /= L; vy /= L;
        turn += Math.atan2(pvx * vy - pvy * vx, pvx * vx + pvy * vy); if (Math.abs(turn) > 3.6) break; // a branch never curls into a ring
        x += vx * 0.6; y += vy * 0.6;
        if (x < 0 || y < 0 || x > W || y > H || inQuiet(x, y) || nearNode(x, y, 11)) break;
        const fade = Math.sin(Math.PI * (s + 1) / (steps + 1)) ** (main ? 1.3 : 1), lit = litAt(x, y), kk = 0.6 * k * fade * (0.35 + 1.1 * lit) * sepAt(x, y) ** 0.6; // threads still cross a transition: one world, not islands
        const col = mix(mix(colourAt(regions, x, y, wu), WHITE, main ? 0.2 : 0.14), warmAt(x, y), 0.25 * Math.min(1, lit));
        dep(x, y, col, kk);
        if (main) { dep(x - vy * 0.45, y + vx * 0.45, col, kk * 0.45); dep(x + vy * 0.45, y - vx * 0.45, col, kk * 0.45); }
        else if (rw() < 0.35) dep(x + (rw() - 0.5) * 1.6, y + (rw() - 0.5) * 1.6, col, kk * 0.5);
        const pf = main ? 0.016 : 0.01;
        if (depth < (main ? 3 : 2) && rw() < pf) { const a = (rw() < 0.5 ? -1 : 1) * (0.45 + rw() * 0.6), ca = Math.cos(a), sa = Math.sin(a); walk(x, y, [vx * ca - vy * sa, vx * sa + vy * ca], Math.floor(steps * (0.25 + rw() * 0.35)), k * (main ? 0.55 : 0.75), depth + 1, main && depth < 1); }
      }
    };
    for (let i = 0; i < opts.walkers * 6 && walkers < opts.walkers; i += 1) {
      const x = rw() * W, y = rw() * H, m = Math.min(1, membership(regions, x, y)), f = web(x, y);
      if (rw() > (0.08 + 0.92 * m) * f * 1.4) continue;
      const main = m > 0.3 && rw() < 0.06; if (main) mains += 1; wu = h2(i, 11, 502);
      walk(x, y, [rw() - 0.5, rw() - 0.5], main ? 160 + Math.floor(rw() * 250) : 36 + Math.floor(rw() * 140), (main ? 0.85 + 0.5 * rw() : 0.15 + 0.45 * rw() ** 2) * (0.22 + 0.78 * m) * 0.9, 0, main); walkers += 1;
    }
    // AD-4 SHARED THREADS (data mode): around an element declared in two groups, a few branches start at the meeting zone,
    // half in each group's colour, so the two textures visibly interweave there (a deliberate overlap, not a void)
    if (regions.GF) for (const n of graph.nodes) { if (!n.R2) continue; const rsd = rng(opts.seed + 606);
      for (let k = 0; k < 28; k += 1) { const a = rsd() * Math.PI * 2, d = 6 + 34 * rsd(); wu = 2 + (k % 2 ? n.R.i : n.R2.i); // u >= 2: the whole thread keeps that one group's colour
        walk(n.x + Math.cos(a) * d, n.y + Math.sin(a) * d, [Math.cos(a), Math.sin(a)], 50 + Math.floor(rsd() * 90), 0.32 + 0.25 * rsd(), 1, false); } }
    T.mainBranches = mains;
    T.walkers = performance.now() - t; T.walkerCount = walkers;
    // AD-4 BELONGING VEINS (data mode): along each INTERNAL relation a few fine fibres of the group's own colour braid around
    // the line (broken, crossing, converging at the nodes) — the web itself carries the group from its centre out to its
    // farthest element. Cross-group relations get none. Nothing new is related: fibres follow existing relations only.
    let veinPts = 0;
    if (regions.GF) for (const e of graph.edges) {
      if (!isInternal(e)) continue; const g = edgeGroup(e), p = edgePath(e);
      let L = 0; const cum = [0]; for (let i = 1; i < p.length; i += 1) { L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); cum.push(L); }
      const sd = Math.round(e.a.x * 7 + e.b.y * 13);
      for (let f = 0; f < 5; f += 1) {
        const amp = 3 + 5 * h2(sd, f, 61), ph = h2(sd, f, 62) * 50, kf = 0.75 + 0.5 * h2(sd, f, 63);
        for (let sx = 0, i = 1; sx < L; sx += 0.5) {
          while (i < p.length - 1 && cum[i] < sx) i += 1; const u = (sx - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), x0 = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u, y0 = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u;
          let tx = p[i][0] - p[i - 1][0], ty = p[i][1] - p[i - 1][1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          const off = amp * (2 * fbm(sx / 38 + ph, f * 3.1, 64 + f, 2) - 1) * 1.6 * (0.35 + 0.65 * Math.sin(Math.PI * sx / L)), x = x0 - ty * off, y = y0 + tx * off;
          const end = sstep(0, 22, sx) * sstep(0, 22, L - sx), brk = sstep(0.38, 0.6, fbm(sx / 26 + ph * 2, f * 1.7, 65, 2));
          if (end * brk < 0.01 || inQuiet(x, y) || nearNode(x, y, 9)) continue;
          const lit = litAt(x, y), col = mix(mix(g.col, WHITE, 0.12), warmAt(x, y), 0.22 * Math.min(1, lit));
          dep(x, y, col, 0.1 * kf * end * brk * (0.4 + 0.9 * Math.min(1, lit))); veinPts += 1;
        }
      }
    }
    T.veinPts = veinPts;

    // 3. stars: crisp, sharp, independent of data
    t = performance.now(); const rs = rng(opts.seed + 303); const glints = [];
    for (let i = 0; i < 2600; i += 1) { const x = rs() * W, y = rs() * H; if (rs() > quietK(x, y)) continue; const c = rs() < 0.15 ? [1, 0.88, 0.75] : rs() < 0.4 ? [0.75, 0.82, 1] : [1, 1, 1]; dep(x, y, c, 0.25 + 0.9 * rs() ** 3); }
    // bright knots of the web (DECORATION: no ring, no core disc, not tappable) — denser inside regions, like the reference
    for (let i = 0, made = 0; i < 20000 && made < 520; i += 1) { const x = rs() * W, y = rs() * H, m = Math.min(1, membership(regions, x, y)); if (rs() > 0.06 + 0.94 * m * web(x, y) * 3) continue; if (inQuiet(x, y) || nearNode(x, y, 16)) continue; const lit = litAt(x, y), c = mix(mix(colourAt(regions, x, y, h2(i, 13, 503)), WHITE, 0.45 + 0.3 * rs()), WARM, 0.3 * Math.min(1, lit)); splat(x, y, c, (0.3 + 1.1 * rs() ** 2) * (0.45 + 0.8 * lit) * sepAt(x, y), 0.8 + rs() * 1.3); if (rs() < 0.07) glints.push({ x, y, c, L: 5 + rs() * 10 }); made += 1; }
    // AD-2: the world lights' own small cores (DECORATION: soft, no ring, no disc edge) — strong ones also get a faint glint
    for (const l of lights) if (l.world && l.I > 0.12) { splat(l.x, l.y, mix(l.c, WHITE, 0.55), 1.2 + 3.2 * l.I, 1.1 + 1.6 * Math.min(1, l.r / 40)); if (l.I > 0.6) glints.push({ x: l.x, y: l.y, c: mix(l.c, WHITE, 0.5), L: 8 + 10 * l.I }); }
    for (const n of graph.nodes) { const L = lights.find((q) => q.x === n.x && q.y === n.y); if (n.tier === 'hub') splat(n.x, n.y, mix(L.c, WHITE, 0.6), 1.6 * L.I, 4.5); else splat(n.x, n.y, mix(L.c, WHITE, 0.5), 0.5 * L.I, 2.2); }
    // AD-2: relations put their light into the SAME buffer (so the derived glow binds them into the world); the crisp
    // vector core drawn later keeps them readable and distinct from decoration
    if (opts.data) for (const e of graph.edges) {
      const inn = isInternal(e), gc = inn ? edgeGroup(e).col : null, p = edgePath(e), ca = mix(inn ? gc : nodeColOf(e.a), WHITE, 0.35), cb = mix(inn ? gc : nodeColOf(e.b), WHITE, 0.35), len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y), mid = inn ? (len > 230 ? 0.6 : 0.9) : (len > 230 ? 0.3 : 0.55), kd = inn ? 0.26 : 0.07; // AD-3: internal relations carry the group's light; cross-group ones are quieter
      for (let i = 1; i < p.length; i += 1) { const [x0, y0] = p[i - 1], [x1, y1] = p[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.5)); for (let j = 0; j < n; j += 1) { const tt = (i - 1 + j / n) / (p.length - 1), prof = 1 - (1 - mid) * Math.sin(Math.PI * tt); dep(x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n, mix(ca, cb, tt), kd * prof); } }
    }
    T.stars = performance.now() - t;

    // 4. glow derived from the light itself (no independent fog): two blurred, downsampled copies of the accumulation
    t = performance.now();
    const glow = (f, passes, rad) => { const w = Math.ceil(Wd / f), h = Math.ceil(Hd / f), g = new Float32Array(w * h * 3); for (let y = 0; y < Hd; y += 1) for (let x = 0; x < Wd; x += 1) { const o = 3 * (y * Wd + x), p = 3 * (Math.floor(y / f) * w + Math.floor(x / f)); g[p] += acc[o]; g[p + 1] += acc[o + 1]; g[p + 2] += acc[o + 2]; } for (let i = 0; i < g.length; i += 1) g[i] /= f * f; const tmp = new Float32Array(g.length); for (let pass = 0; pass < passes; pass += 1) { for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) for (let ch = 0; ch < 3; ch += 1) { let s = 0, n = 0; for (let d = -rad; d <= rad; d += 1) { const xx = x + d; if (xx < 0 || xx >= w) continue; s += g[3 * (y * w + xx) + ch]; n += 1; } tmp[3 * (y * w + x) + ch] = s / n; } for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) for (let ch = 0; ch < 3; ch += 1) { let s = 0, n = 0; for (let d = -rad; d <= rad; d += 1) { const yy = y + d; if (yy < 0 || yy >= h) continue; s += tmp[3 * (yy * w + x) + ch]; n += 1; } g[3 * (y * w + x) + ch] = s / n; } } return { g, w, h, f }; };
    const G1 = glow(4, 3, 3), G2 = glow(16, 3, 3);
    const sample = (Gx, x, y, ch) => { const fx = x / Gx.f - 0.5, fy = y / Gx.f - 0.5, ix = Math.max(0, Math.min(Gx.w - 2, Math.floor(fx))), iy = Math.max(0, Math.min(Gx.h - 2, Math.floor(fy))), tx = Math.min(1, Math.max(0, fx - ix)), ty = Math.min(1, Math.max(0, fy - iy)), g = Gx.g, w = Gx.w; const a = g[3 * (iy * w + ix) + ch], b = g[3 * (iy * w + ix + 1) + ch], c = g[3 * ((iy + 1) * w + ix) + ch], d = g[3 * ((iy + 1) * w + ix + 1) + ch]; return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty; };
    // AD-2: fine cosmic DUST deposited AFTER the glow (so it never becomes haze): sparse points in patchy clouds that fill
    // the voids between regions — texture of the background, below the threads in the hierarchy
    const rd = rng(opts.seed + 505); let dust = 0;
    for (let i = 0; i < (opts.dust ?? 1400000); i += 1) {
      const x = rd() * W, y = rd() * H, cl = sstep(0.38, 0.72, fbm(x / 260 + 7, y / 260 + 2, 71, 4)), m = Math.min(1, membership(regions, x, y));
      if (rd() > 0.18 + 0.5 * cl + 0.5 * m) continue; if (rd() > quietK(x, y)) continue;
      dep(x, y, mix([0.5, 0.58, 1], colourAt(regions, x, y, h2(i, 17, 504)), 0.3 + 0.6 * m), (0.05 + 0.15 * rd() ** 2) * (0.7 + 0.6 * litAt(x, y)) * (1 + 0.5 * m) * (0.45 + 0.55 * sepAt(x, y))); dust += 1;
    }
    T.dust = dust;
    T.glow = performance.now() - t;

    // 5. compose: ground + region body (very low, darker pockets) + particles + glow, filmic tone map
    t = performance.now();
    const img = ctx.createImageData(Wd, Hd), px = img.data, body = new Float32Array(3);
    for (let y = 0; y < Hd; y += 1) {
      for (let x = 0; x < Wd; x += 1) {
        const o = 3 * (y * Wd + x), p = 4 * (y * Wd + x);
        if ((x & 3) === 0) { // region body sampled every 4 device px (smooth by nature), with dark pockets inside
          const cx = x / DPR, cy = y / DPR, m = Math.min(1, membership(regions, cx, cy)), pocket = fbm(cx / 70, cy / 70, 41, 3), c = colourAt(regions, cx, cy);
          const grain = fbm(cx / 9, cy / 9, 47, 2), k = 0.045 * m ** 2.1 * (0.35 + 1.1 * Math.max(0, pocket - 0.4)) * (0.6 + 0.8 * grain) * sepAt(cx, cy);
          body[0] = 0.006 + c[0] * k; body[1] = 0.008 + c[1] * k; body[2] = 0.02 + c[2] * k;
        }
        for (let ch = 0; ch < 3; ch += 1) {
          // + the bounded warm halo of each light source (local, not a global glow layer)
          const v = body[ch] + acc[o + ch] * 0.95 + sample(G1, x, y, ch) * 0.75 + sample(G2, x, y, ch) * 0.55 + gsamp(Ecore, ch, 3, x / DPR, y / DPR) * 0.42;
          px[p + ch] = 255 * (1 - Math.exp(-1.85 * v));
        }
        px[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    T.compose = performance.now() - t;

    // 6. vector: glints (decor), relations, nodes, names
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const g of glints) for (const [dx, dy] of [[1, 0], [0, 1]]) { const gr = ctx.createLinearGradient(g.x - dx * g.L, g.y - dy * g.L, g.x + dx * g.L, g.y + dy * g.L); gr.addColorStop(0, css(g.c, 0)); gr.addColorStop(0.5, css(g.c, 0.75)); gr.addColorStop(1, css(g.c, 0)); ctx.strokeStyle = gr; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(g.x - dx * g.L, g.y - dy * g.L); ctx.lineTo(g.x + dx * g.L, g.y + dy * g.L); ctx.stroke(); }
    const nodeCol = nodeColOf;
    if (opts.data) {
      for (const e of graph.edges) {
        // AD-3 hierarchy of relations: INTERNAL (both ends share a declared group) = the group's own colour, firmer line;
        // CROSS-GROUP = thinner, cooler, fading mid-span — still continuous and traceable end to end, never removed
        const inn = isInternal(e), SIL = [0.78, 0.8, 0.9], len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
        const p = edgePath(e), gc = inn ? edgeGroup(e).col : null, ca = inn ? mix(gc, WHITE, 0.4) : mix(mix(nodeCol(e.a), SIL, 0.45), WHITE, 0.2), cb = inn ? mix(gc, WHITE, 0.4) : mix(mix(nodeCol(e.b), SIL, 0.45), WHITE, 0.2); // AD-4: an internal relation is drawn in its group's colour end to end
        const mid = inn ? (len > 230 ? 0.6 : 1) : (len > 230 ? 0.45 : len > 140 ? 0.55 : 0.7);
        for (const [w, a] of (inn ? [[1.7, 0.16], [0.9, 0.92]] : [[0.62, 0.62]])) { const gr = ctx.createLinearGradient(p[0][0], p[0][1], p[32][0], p[32][1]); for (const st of [0, 0.25, 0.5, 0.75, 1]) gr.addColorStop(st, css(mix(ca, cb, st), a * (1 - (1 - mid) * Math.sin(Math.PI * st)))); ctx.strokeStyle = gr; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (const q of p.slice(1)) ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      }
      for (const n of graph.nodes) {
        const c = nodeCol(n), hub = n.tier === 'hub', halo = (rad, a, cc) => { const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, rad); g.addColorStop(0, css(cc, a)); g.addColorStop(0.25, css(cc, a * 0.4)); g.addColorStop(1, css(cc, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, Math.PI * 2); ctx.fill(); };
        ctx.globalCompositeOperation = 'lighter';
        // AD-2: the wide cool halo is gone (the warm, bounded light halo comes from the raster); only a tight inner bloom remains
        halo(hub ? 15 : 7, 1, mix(c, WHITE, 0.6)); if (!hub) halo(12, 0.35, c);
        const rr = rng(Math.round(n.x * 13 + n.y)); for (let i = 0; i < (hub ? 9 : 4); i += 1) { const a = rr() * Math.PI * 2, L = hub ? 10 + rr() * 20 : 4 + rr() * 6, g = ctx.createLinearGradient(n.x, n.y, n.x + Math.cos(a) * L, n.y + Math.sin(a) * L); g.addColorStop(0, css(mix(c, WHITE, 0.5), 0.6)); g.addColorStop(1, css(c, 0)); ctx.strokeStyle = g; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.x + Math.cos(a) * L, n.y + Math.sin(a) * L); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over';
        if (n.R2) { // AD-4: a declared DUAL belonging drawn as such — the half of the ring facing each group's hub takes that group's colour
          for (const G2 of [n.R, n.R2]) { const a0 = Math.atan2(G2.hub.y - n.y, G2.hub.x - n.x); ctx.strokeStyle = css(mix(G2.col, WHITE, 0.3), 0.98); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.x, n.y, 4.8, a0 - Math.PI / 2 + 0.14, a0 + Math.PI / 2 - 0.14); ctx.stroke(); }
        } else { ctx.strokeStyle = css(mix(c, WHITE, 0.45), 0.95); ctx.lineWidth = hub ? 1.6 : 1.05; ctx.beginPath(); ctx.arc(n.x, n.y, hub ? 8 : 4.3, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(n.x, n.y, hub ? 4.2 : 2.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    if (opts.names !== false) for (const l of lay.labels) {
      const title = l.kind === 'title', sz = title ? opts.titleSize : opts.subSize;
      ctx.save(); ctx.translate(l.x, l.y); ctx.scale(l.w / 2 + (title ? 22 : 10), l.h / 2 + (title ? 10 : 4)); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(2,3,8,${title ? 0.55 : 0.42})`); g.addColorStop(1, 'rgba(2,3,8,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.font = `${title ? 500 : 400} ${sz}px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // AD-2 knockout: a dark halo around the glyphs cuts any relation passing behind the name, so text never touches a line
      const rows = l.lines ? l.lines.map((tx, k) => [tx, l.y + (k - 0.5) * sz * 1.22 + 0.5]) : [[l.text, l.y + (title ? 1 : 0.5)]];
      ctx.lineJoin = 'round'; ctx.strokeStyle = title ? 'rgba(2,3,8,0.5)' : 'rgba(2,3,8,0.8)'; ctx.lineWidth = title ? 5 : 4; // lighter knockout (PO AD-2 review §7) for (const [tx, ty] of rows) ctx.strokeText(tx, l.x, ty);
      ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = title ? 10 : 5;
      let fsty = title ? css(mix(l.R.pale, WHITE, 0.72), 0.98) : css(mix(l.node.R.col, WHITE, 0.4), 0.95);
      if (!title && l.node.R2) { // AD-4: the dual name carries both identities, each toward its own group's side (no blended third hue)
        const A = l.node.R, B = l.node.R2, lf = A.hub.x < B.hub.x ? A : B, rt = lf === A ? B : A, gr = ctx.createLinearGradient(l.x - l.w / 2, 0, l.x + l.w / 2, 0);
        gr.addColorStop(0.12, css(mix(lf.col, WHITE, 0.35), 0.97)); gr.addColorStop(0.88, css(mix(rt.col, WHITE, 0.35), 0.97)); fsty = gr; }
      ctx.fillStyle = fsty; for (const [tx, ty] of rows) ctx.fillText(tx, l.x, ty); ctx.shadowBlur = 0;
    }
    if (opts.watermark !== false) { ctx.font = `400 10px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText('SYNTHETIC · بيانات وأسماء وألوان تجريبية معلنة', 10, H - 9); }
    return { titleShift, timings: Object.fromEntries(Object.entries(T).map(([a, b]) => [a, Math.round(b)])), nodes: graph.nodes.length, edges: graph.edges.length, labels: lay.labels.length, labelsMoved: lay.report.moved, labelsCollided: lay.report.collided, labelAudit: lay.report.audit, twoLine: lay.labels.filter((l) => l.lines).map((l) => l.text), nodeGroups: graph.nodes.map((n) => [n.label || n.R.title, n.x, n.y, n.R.i, n.R2 ? n.R2.i : -1, n.tier]), groupCols: regions.filter((R) => !R.latent).map((R) => [R.i, R.title, R.col]), edgeClass: graph.edges.map((e) => isInternal(e) ? 'in' : 'cross'), regions: regions.length, lights: { world: lights.filter((l) => l.world).length, node: lights.filter((l) => !l.world && !l.lit).length, innerLit: lights.filter((l) => l.lit).length, worldR: lights.filter((l) => l.world).map((l) => Math.round(l.r)), worldI: lights.filter((l) => l.world).map((l) => +l.I.toFixed(2)) }, nodeXY: graph.nodes.map((n) => [n.label || n.R.title, Math.round(n.x * 10) / 10, Math.round(n.y * 10) / 10]) };
  }
  G.WEB = { render };
})(window);
