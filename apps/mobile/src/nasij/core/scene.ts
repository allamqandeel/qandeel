// NASIJ (experimental, isolated) — the renderer-independent scene core.
//
// Authorised entities in, a compact deterministic DRAW LIST out. Nothing here imports React, React Native, Skia or a
// DOM: the same output is drawn by the mobile Skia host, by the browser preview and by a headless Replay rasteriser.
//
// SPACE. Every coordinate is in "FAR points": canonical world units divided by the canonical FAR scale (8192 units per
// point), relative to a scene origin the adapter chose. The camera scale is therefore 1 at the first rung and 8^r at
// rung r, exactly the product's frozen x8 reinforcement. Positions are the server's; this file never moves an entity.
//
// LAYERS. One layer per semantic rung. A layer's marks are authored at that rung's size (size in points / 8^r), so a
// layer is static world-space geometry: it can be recorded once and then only transformed. Between rungs two layers
// cross-fade; at rest exactly one is drawn.

export type NasijWorldKind = 'PERSONAL' | 'SHARED' | 'PUBLIC';

/** The dye indices of `NasijPalette.dyes`. A dye is assigned from an authoritative fact only (family, section). */
export type Dye = 0 | 1 | 2 | 3 | 4 | 5;

export type NasijMarkKind = 'THREAD' | 'READING' | 'PLACE' | 'EXPERIENCE';

export interface NasijEntity {
  readonly id: string;
  readonly kind: NasijMarkKind;
  /** FAR points, from the server's exact coordinate. For a hosted mark (a Reading) this is its HOST's place. */
  readonly x: number;
  readonly y: number;
  readonly dye: Dye;
  /** Shown text, or null where the product authorises none (the Personal map draws no names). */
  readonly label: string | null;
  /** Hosted marks only: the host's id and the mark's order around it (the product's own tie-break, never a rank). */
  readonly hostId?: string;
  readonly ordinal?: number;
  /** A real state the wire carries (a Reading's `current`); false draws the mark hollow. */
  readonly solid?: boolean;
  /** The first rung (0-based) at which this entity is disclosed. */
  readonly fromRung: number;
  /** Opaque neighbourhood key (Shared / Public `region`). Never shown; decides NEAR presence only. */
  readonly region?: string;
}

/** An explicit, server-stated relation between two entities (Public relations of the focused Experience only). */
export interface NasijTie { readonly a: string; readonly b: string }

export interface NasijSceneInput {
  readonly world: NasijWorldKind;
  /** How many rungs this world has: 5 for Personal, 3 for Shared and Public. */
  readonly rungs: number;
  readonly entities: readonly NasijEntity[];
  readonly ties?: readonly NasijTie[];
  /** NEAR focus (Shared / Public) or the inspected object (Personal); null for none. */
  readonly focusId: string | null;
  /** Entities receded by a real filter (a chosen Public section). */
  readonly receded?: ReadonlySet<string>;
  /** Entities with no place at all (Personal: Emerging Focuses and ungrounded Readings). Counted, never placed. */
  readonly fringe?: number;
  /** Right-to-left: labels sit on the other side of their mark. Geometry is never mirrored: coordinates are facts. */
  readonly rtl: boolean;
}

/** Filled polygons sharing one colour: [n, x0, y0, … x(n-1), y(n-1), n, …]. */
export interface FillBatch { readonly t: 'fill'; readonly color: ColorKey; readonly alpha: number; readonly data: number[] }
/** Stroked open polylines sharing one colour and width (in layer units): same packing as a fill. */
export interface LineBatch { readonly t: 'line'; readonly color: ColorKey; readonly alpha: number; readonly width: number; readonly data: number[] }
export type Batch = FillBatch | LineBatch;

export interface NasijLabel {
  readonly id: string;
  readonly text: string;
  /** The label's anchor in FAR points and its side: the host draws it at `size` points when the layer is at rest. */
  readonly x: number;
  readonly y: number;
  readonly side: 'start' | 'end';
  readonly emphasis: boolean;
}

export interface NasijHit { readonly id: string; readonly x: number; readonly y: number; /** Radius in points at the layer's rung. */ readonly r: number }

export interface NasijLayer {
  readonly rung: number;
  readonly batches: readonly Batch[];
  readonly labels: readonly NasijLabel[];
  readonly hits: readonly NasijHit[];
}

export interface NasijBounds { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }

export interface NasijDrawList {
  readonly world: NasijWorldKind;
  readonly layers: readonly NasijLayer[];
  /** The extent of everything placed, or null when nothing is. */
  readonly bounds: NasijBounds | null;
  /** Shared only: the woven border, drawn on every rung (a closed, permissioned field has an edge). */
  readonly border: readonly Batch[];
  readonly fringe: number;
  /** A stable digest of the list: the same input gives the same digest on every host. */
  readonly digest: string;
}

export type ColorKey = 'dye0' | 'dye1' | 'dye2' | 'dye3' | 'dye4' | 'dye5' | 'ground' | 'ink' | 'undyed' | 'accent';

const dyeKey = (dye: Dye): ColorKey => (`dye${dye}` as ColorKey);

/** The x8 reinforcement, as a camera scale. */
export const rungScale = (rung: number): number => Math.pow(8, rung);

// ── motifs ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// A textile vocabulary: every mark is a lozenge, plain or stepped. All are closed polygons, so a whole layer is a few
// batched fills whatever the entity count.

function pushDiamond(out: number[], cx: number, cy: number, r: number): void {
  out.push(4, cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy);
}

/** A stepped lozenge (the kilim medallion): a diamond whose edges climb in `steps` stairs. */
function pushStepped(out: number[], cx: number, cy: number, r: number, steps: number): void {
  const pts: number[] = [];
  const u = r / steps;
  // Top → right → bottom → left, each quadrant a staircase.
  const quad = (sx: number, sy: number, startOnX: boolean) => {
    for (let i = 0; i < steps; i += 1) {
      if (startOnX) { pts.push(cx + sx * i * u, cy + sy * (r - i * u), cx + sx * (i + 1) * u, cy + sy * (r - i * u)); }
      else { pts.push(cx + sx * (r - i * u), cy + sy * i * u, cx + sx * (r - i * u), cy + sy * (i + 1) * u); }
    }
  };
  quad(1, -1, true); quad(1, 1, false);
  // Mirror for the left half, walking back up.
  const half = pts.length;
  for (let i = half - 2; i >= 0; i -= 2) pts.push(2 * cx - pts[i], pts[i + 1]);
  out.push(pts.length / 2, ...pts);
}

function batcher() {
  const fills = new Map<string, FillBatch & { z: number }>();
  const lines = new Map<string, LineBatch>();
  return {
    // `z` is the paint band: a batch groups one colour WITHIN one band, so batching never reorders what overlaps.
    fill(color: ColorKey, z: number, alpha = 1): number[] {
      const key = `${z}:${color}:${alpha}`;
      let batch = fills.get(key);
      if (!batch) { batch = { t: 'fill', color, alpha, data: [], z }; fills.set(key, batch); }
      return batch.data;
    },
    line(color: ColorKey, width: number, alpha = 1): number[] {
      const key = `${color}:${width}:${alpha}`;
      let batch = lines.get(key);
      if (!batch) { batch = { t: 'line', color, alpha, width, data: [] }; lines.set(key, batch); }
      return batch.data;
    },
    // Washes (band 0) lie under the ties; every other band lies over them, in band order.
    done(): Batch[] {
      const ordered = [...fills.values()].sort((a, b) => a.z - b.z).map(({ z, ...batch }) => ({ z, batch: batch as FillBatch }));
      return [...ordered.filter((f) => f.z === 0).map((f) => f.batch), ...lines.values(), ...ordered.filter((f) => f.z > 0).map((f) => f.batch)].filter((b) => b.data.length > 0);
    },
  };
}

/** Where a hosted mark sits around its host, in points at the layer's rung. Presentation only; carries no meaning. */
export function hostedOffset(ordinal: number): { dx: number; dy: number } {
  const perRing = 8;
  const ring = Math.floor(ordinal / perRing);
  const slot = ordinal % perRing;
  const radius = 34 + ring * 20;
  // Eight lozenge directions; alternate rings are turned half a slot so marks never stack.
  const angle = ((slot + (ring % 2) * 0.5) / perRing) * Math.PI * 2 - Math.PI / 2;
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

function buildLayer(input: NasijSceneInput, rung: number): NasijLayer {
  const k = 1 / rungScale(rung); // points → layer units
  const b = batcher();
  const labels: NasijLabel[] = [];
  const hits: NasijHit[] = [];
  const last = input.rungs - 1;
  const field = input.world !== 'PERSONAL';
  const byId = new Map(input.entities.map((e) => [e.id, e] as const));
  const focus = input.focusId === null ? null : byId.get(input.focusId) ?? null;
  const side = input.rtl ? 'start' : 'end';

  // Explicit relations: thin threads under everything, on the last rung only (they belong to the focused entity).
  if (rung === last && input.ties) {
    const tie = b.line('ink', 1.2 * k, 0.5);
    for (const t of input.ties) {
      const a = byId.get(t.a); const c = byId.get(t.b);
      if (a && c) tie.push(2, a.x, a.y, c.x, c.y);
    }
  }

  for (const e of input.entities) {
    if (e.fromRung > rung) continue;
    const dye = dyeKey(e.dye);
    if (e.kind === 'READING') {
      // The one relation the Personal map is authorised to draw: a Thread hosts this Reading.
      const o = hostedOffset(e.ordinal ?? 0);
      const x = e.x + o.dx * k; const y = e.y + o.dy * k;
      b.line('ink', 1 * k, 0.35).push(2, e.x, e.y, x, y);
      const selected = focus?.id === e.id;
      if (selected) pushDiamond(b.fill('accent', 1), x, y, 12.5 * k);
      pushDiamond(b.fill(dye, 3), x, y, 8 * k);
      if (e.solid === false) pushDiamond(b.fill('ground', 4), x, y, 4.6 * k);
      hits.push({ id: e.id, x, y, r: 22 });
      continue;
    }
    if (e.kind === 'THREAD') {
      const selected = focus?.id === e.id;
      const r = rung === 0 ? 11 : 15;
      pushDiamond(b.fill(dye, 0, 0.09), e.x, e.y, (rung === 0 ? 46 : 64) * k);
      if (selected) { pushStepped(b.fill('accent', 1), e.x, e.y, (r + 7) * k, 4); pushStepped(b.fill('ground', 2), e.x, e.y, (r + 3.5) * k, 4); }
      pushStepped(b.fill(dye, 3), e.x, e.y, r * k, 3);
      pushDiamond(b.fill('ground', 4), e.x, e.y, r * 0.5 * k);
      pushDiamond(b.fill(dye, 5), e.x, e.y, r * 0.22 * k);
      hits.push({ id: e.id, x: e.x, y: e.y, r: 24 });
      continue;
    }
    // Shared places and Public experiences: FAR is mass, MID is place, NEAR is the focus and its neighbourhood.
    const receded = input.receded?.has(e.id) === true;
    if (field && rung === 0) {
      // The wash is the field's mass: each real entry stains the cloth a little, so a cluster reads as a dyed region.
      if (!receded) pushDiamond(b.fill(dye, 0, 0.07), e.x, e.y, 30 * k);
      pushDiamond(b.fill(receded ? 'undyed' : dye, 3, receded ? 0.6 : 1), e.x, e.y, 5.5 * k);
      if (!receded) pushDiamond(b.fill('ground', 4), e.x, e.y, 2 * k);
      continue; // FAR has no object hit: a tap discloses the place under it, by the controller's own rule.
    }
    const selected = focus?.id === e.id;
    const near = rung === last && focus !== null;
    const neighbour = near && !selected && e.region !== undefined && e.region === focus.region;
    const quiet = receded || (near && !selected && !neighbour);
    if (quiet) {
      pushDiamond(b.fill('undyed', 3, 0.8), e.x, e.y, 7 * k);
      pushDiamond(b.fill('ground', 4), e.x, e.y, 4 * k);
      hits.push({ id: e.id, x: e.x, y: e.y, r: 22 });
      continue;
    }
    const r = selected ? 30 : 13;
    pushDiamond(b.fill(dye, 0, selected ? 0.1 : 0.07), e.x, e.y, (selected ? 110 : 44) * k);
    if (selected) {
      pushStepped(b.fill('accent', 1), e.x, e.y, (r + 9) * k, 6);
      pushStepped(b.fill('ground', 2), e.x, e.y, (r + 5) * k, 6);
    }
    pushStepped(b.fill(dye, 3), e.x, e.y, r * k, selected ? 5 : 3);
    pushDiamond(b.fill('ground', 4), e.x, e.y, r * 0.52 * k);
    pushDiamond(b.fill(selected ? 'accent' : dye, 5), e.x, e.y, r * 0.24 * k);
    hits.push({ id: e.id, x: e.x, y: e.y, r: selected ? 40 : 24 });
    if (e.label !== null) labels.push({ id: e.id, text: e.label, x: e.x, y: e.y + (r + 8) * k, side, emphasis: selected });
  }
  return { rung, batches: b.done(), labels, hits };
}

function buildBorder(bounds: NasijBounds): Batch[] {
  // A woven border well outside the field: two bands and a run of lozenges. Authored at FAR size.
  const b = batcher();
  const m = 46;
  const x0 = bounds.minX - m; const y0 = bounds.minY - m; const x1 = bounds.maxX + m; const y1 = bounds.maxY + m;
  const rect = (x: number, y: number, w: number, h: number, out: number[]) => out.push(4, x, y, x + w, y, x + w, y + h, x, y + h);
  const frame = (inset: number, thick: number, out: number[]) => {
    rect(x0 + inset, y0 + inset, x1 - x0 - 2 * inset, thick, out);
    rect(x0 + inset, y1 - inset - thick, x1 - x0 - 2 * inset, thick, out);
    rect(x0 + inset, y0 + inset, thick, y1 - y0 - 2 * inset, out);
    rect(x1 - inset - thick, y0 + inset, thick, y1 - y0 - 2 * inset, out);
  };
  frame(0, 3, b.fill('dye0', 1));
  frame(16, 1.5, b.fill('dye1', 1));
  const step = 14;
  const lozenges = b.fill('dye2', 1);
  for (let x = x0 + 14; x <= x1 - 14; x += step) { pushDiamond(lozenges, x, y0 + 9.5, 3.5); pushDiamond(lozenges, x, y1 - 9.5, 3.5); }
  for (let y = y0 + 28; y <= y1 - 28; y += step) { pushDiamond(lozenges, x0 + 9.5, y, 3.5); pushDiamond(lozenges, x1 - 9.5, y, 3.5); }
  return b.done();
}

function digestOf(layers: readonly NasijLayer[], border: readonly Batch[]): string {
  // FNV-1a over the numbers and keys, rounded to 1/64 point so it is stable across float formatting.
  let h = 0x811c9dc5;
  const eat = (n: number) => { h ^= n & 0xff; h = Math.imul(h, 0x01000193); h ^= (n >>> 8) & 0xff; h = Math.imul(h, 0x01000193); h ^= (n >>> 16) & 0xff; h = Math.imul(h, 0x01000193); };
  const eatStr = (s: string) => { for (let i = 0; i < s.length; i += 1) eat(s.charCodeAt(i)); };
  const eatBatches = (batches: readonly Batch[], scale: number) => {
    for (const batch of batches) { eatStr(batch.color); eatStr(batch.t); for (const v of batch.data) eat(Math.round(v * scale * 64)); }
  };
  for (const layer of layers) { eat(layer.rung); eatBatches(layer.batches, rungScale(layer.rung)); for (const l of layer.labels) eatStr(l.id + l.text); }
  eatBatches(border, 1);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Compile the draw list. Pure and deterministic: no clock, no randomness, no host. */
export function compileNasij(input: NasijSceneInput): NasijDrawList {
  const layers: NasijLayer[] = [];
  for (let rung = 0; rung < input.rungs; rung += 1) layers.push(buildLayer(input, rung));
  let bounds: NasijBounds | null = null;
  for (const e of input.entities) {
    bounds = bounds === null
      ? { minX: e.x, minY: e.y, maxX: e.x, maxY: e.y }
      : { minX: Math.min(bounds.minX, e.x), minY: Math.min(bounds.minY, e.y), maxX: Math.max(bounds.maxX, e.x), maxY: Math.max(bounds.maxY, e.y) };
  }
  const border = input.world === 'SHARED' && bounds !== null ? buildBorder(bounds) : [];
  return { world: input.world, layers, bounds, border, fringe: input.fringe ?? 0, digest: digestOf(layers, border) };
}

/** How many draw operations one frame costs at rest: the ground, the border's batches and one layer's batches. */
export function drawOpsAtRest(list: NasijDrawList, rung: number): number {
  return 1 + list.border.length + (list.layers[rung]?.batches.length ?? 0);
}
