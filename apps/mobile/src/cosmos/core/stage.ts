// COSMOS (experimental, isolated) — the renderer-independent stage.
//
// Authorised entities in, a compact deterministic STAGE out: per semantic rung, a list of sprite instances (prepared
// light assets placed, sized and tinted), a few batched hairlines, labels and hit targets. Nothing here imports React,
// React Native, Skia or a DOM. A host draws a rung with one atlas draw and a handful of strokes, whatever the count.
//
// SPACE: "FAR points" (canonical world units / 8192) from a scene origin; camera scale is 8^rung. Positions are the
// server's. This file never moves an entity and never draws a relation the authority did not state.
//
// TRUTH RULES carried by construction:
//  - Light is only ever emitted by a real entity. A luminous cloud at FAR is the sum of the real entries under it.
//  - Lines exist for exactly three facts: a Thread hosting a Reading, an explicit served relation of the focused
//    Experience, and the instrument rings of the ONE focused entity. Nearness never draws a line.
//  - Motes around a focused entity are counted from a served detail (sources, content items); absent until served.

export type WorldKind = 'PERSONAL' | 'SHARED' | 'PUBLIC';
export type Dye = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MarkKind = 'THREAD' | 'READING' | 'PLACE' | 'EXPERIENCE';

export interface Entity {
  readonly id: string; readonly kind: MarkKind;
  readonly x: number; readonly y: number;
  readonly dye: Dye;
  readonly label: string | null;
  readonly hostId?: string; readonly ordinal?: number; readonly solid?: boolean;
  readonly fromRung: number;
  readonly region?: string;
}
export interface Tie { readonly a: string; readonly b: string }
export interface SceneInput {
  readonly world: WorldKind; readonly rungs: number;
  readonly entities: readonly Entity[]; readonly ties?: readonly Tie[];
  readonly focusId: string | null;
  readonly receded?: ReadonlySet<string>;
  readonly fringe?: number;
  /** A served count for the focused entity (its sources or content items); undefined until the authority serves it. */
  readonly focusMotes?: number;
  readonly rtl: boolean;
}

/** Prepared light assets a host bakes once. FIBRE_A–C are three fibrous nebula bodies, tinted and turned per use. */
export const SPRITE = { PUFF: 0, HALO: 1, CORE: 2, SPARK: 3, MOTE: 4, FIBRE_A: 5, FIBRE_B: 6, FIBRE_C: 7 } as const;
/** Tints a host resolves from its palette. 0–7 are the eight dyes; the rest are roles. */
export const TINT = { WARM: 8, PALE: 9, GOLD: 10 } as const;

/** One sprite instance: x, y (FAR points), diameter (layer units), sprite id, tint id, alpha, rotation. 7 per instance. */
export type Sprites = number[];
export const SPRITE_STRIDE = 7;
export interface Hairlines { readonly tint: number; readonly alpha: number; /** Width in points at the layer's rung. */ readonly width: number; /** [n, x0, y0, …] polylines. */ readonly data: number[] }
/** `tint` -1 is the bright title colour; `major` is a hub's large title. */
export interface StageLabel { readonly id: string; readonly text: string; readonly x: number; readonly y: number; readonly emphasis: boolean; readonly major: boolean; readonly tint: number }
export interface StageHit { readonly id: string; readonly x: number; readonly y: number; readonly r: number }
export interface StageLayer { readonly rung: number; readonly sprites: Sprites; readonly lines: readonly Hairlines[]; readonly labels: readonly StageLabel[]; readonly hits: readonly StageHit[] }
export interface Stage {
  readonly world: WorldKind; readonly layers: readonly StageLayer[];
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  /** Shared only: the membership horizon, a circle that encloses every served place. Nothing is drawn outside it. */
  readonly horizon: { cx: number; cy: number; r: number } | null;
  readonly fringe: number; readonly digest: string;
}

/** A stable dye from an identity, for worlds where an entity carries no category. It means "this one", nothing else. */
export function dyeOfId(id: string): Dye { let h = 2166136261; for (let i = 0; i < id.length; i += 1) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 8) as Dye; }
const turnOf = (id: string): number => { let h = 7; for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 2654435761); return ((h >>> 0) / 4294967296) * Math.PI * 2; };

export const rungScale = (rung: number): number => Math.pow(8, rung);

/** Where a hosted mark sits about its host, in points at the layer's rung. Presentation only; it carries no meaning. */
export function orbitOf(ordinal: number, turn = 0): { radius: number; angle: number } {
  // Golden-angle placement with a varied reach: an organic constellation, never spokes or rings that could read as rank.
  return { radius: 62 + ((ordinal * 37) % 5) * 13 + Math.floor(ordinal / 6) * 26, angle: turn + ordinal * 2.399963 };
}

function arc(out: number[], cx: number, cy: number, r: number, from: number, to: number): void {
  const n = Math.max(8, Math.ceil(Math.abs(to - from) * 14));
  out.push(n + 1);
  for (let i = 0; i <= n; i += 1) { const a = from + ((to - from) * i) / n; out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
}
/** A graceful curve between two points: a quadratic bowed to one side by `bow` of its length. */
function curve(out: number[], x0: number, y0: number, x1: number, y1: number, bow: number): void {
  const mx = (x0 + x1) / 2 - (y1 - y0) * bow; const my = (y0 + y1) / 2 + (x1 - x0) * bow; const n = 18; out.push(n + 1);
  for (let i = 0; i <= n; i += 1) { const t = i / n; const u = 1 - t; out.push(u * u * x0 + 2 * u * t * mx + t * t * x1, u * u * y0 + 2 * u * t * my + t * t * y1); }
}

function buildLayer(input: SceneInput, rung: number): StageLayer {
  const k = 1 / rungScale(rung);
  const sprites: Sprites = []; const labels: StageLabel[] = []; const hits: StageHit[] = [];
  const lineSets = new Map<string, Hairlines>();
  const line = (tint: number, alpha: number, width: number): number[] => {
    const key = `${tint}:${alpha}:${width}`; let set = lineSets.get(key);
    if (!set) { set = { tint, alpha, width, data: [] }; lineSets.set(key, set); }
    return set.data;
  };
  const put = (x: number, y: number, size: number, sprite: number, tint: number, alpha: number, rot = 0) => sprites.push(x, y, size * k, sprite, tint, alpha, rot);
  /** A luminous strand: a soft wide stroke under a fine bright one. */
  const strand = (tint: number, x0: number, y0: number, x1: number, y1: number, bow: number) => { curve(line(tint, 0.22, 5), x0, y0, x1, y1, bow); curve(line(tint, 0.95, 1.3), x0, y0, x1, y1, bow); };
  /** A fibrous nebula body: two turned plates of the same dye, so no two bodies look alike. */
  const nebula = (id: string, x: number, y: number, size: number, tint: number, alpha: number) => {
    const turn = turnOf(id); const v = Math.floor((turn / (Math.PI * 2)) * 3) % 3;
    put(x, y, size, SPRITE.FIBRE_A + v, tint, alpha, turn); put(x, y, size * 0.8, SPRITE.FIBRE_A + ((v + 1) % 3), tint, alpha * 0.8, -turn * 1.7);
    put(x, y, size * 0.55, SPRITE.PUFF, tint, alpha * 0.16);
  };
  const node = (x: number, y: number, size: number, tint: number) => { put(x, y, size * 3.6, SPRITE.HALO, tint, 0.7); put(x, y, size, SPRITE.CORE, tint, 1); };
  const last = input.rungs - 1; const field = input.world !== 'PERSONAL';
  const byId = new Map(input.entities.map((e) => [e.id, e] as const));
  const focus = input.focusId === null ? null : byId.get(input.focusId) ?? null;
  const TAU = Math.PI * 2;

  /** The instrument: fine rings, a graduated scale and counted motes around the ONE focused entity. */
  const instrument = (x: number, y: number, base: number, motes: number | undefined) => {
    arc(line(TINT.GOLD, 0.7, 0.9), x, y, base * k, 0, TAU);
    arc(line(TINT.GOLD, 0.4, 0.7), x, y, base * 1.42 * k, -2.2, 1.1);
    arc(line(TINT.GOLD, 0.4, 0.7), x, y, base * 1.42 * k, 1.5, 3.7);
    const ticks = line(TINT.GOLD, 0.45, 0.7);
    for (let i = 0; i < 72; i += 1) {
      const a = (i / 72) * TAU; const r0 = base * 1.9; const r1 = r0 + (i % 6 === 0 ? 7 : 3.2);
      ticks.push(2, x + Math.cos(a) * r0 * k, y + Math.sin(a) * r0 * k, x + Math.cos(a) * r1 * k, y + Math.sin(a) * r1 * k);
    }
    for (let i = 0; i < (motes ?? 0); i += 1) {
      const a = -Math.PI / 2 + (i / Math.max(1, motes ?? 1)) * TAU; const r = base * 1.42;
      put(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k, 9, SPRITE.MOTE, TINT.WARM, 0.95);
    }
  };

  // An explicit, served relation of the focused Experience: the only strand a field world may draw.
  if (rung === last && input.ties && focus) for (const t of input.ties) { const a = byId.get(t.a); const c = byId.get(t.b); if (a && c) strand(a.dye, a.x, a.y, c.x, c.y, 0.16); }

  for (const e of input.entities) {
    if (e.fromRung > rung) continue;
    const selected = focus?.id === e.id;
    if (e.kind === 'READING') {
      const host = e.hostId === undefined ? undefined : byId.get(e.hostId);
      const o = orbitOf(e.ordinal ?? 0, turnOf(e.hostId ?? e.id));
      const x = e.x + Math.cos(o.angle) * o.radius * k; const y = e.y + Math.sin(o.angle) * o.radius * k;
      // The one relation the Personal world may draw: this Thread hosts this Reading.
      strand(e.dye, e.x, e.y, x, y, ((e.ordinal ?? 0) % 2 === 0 ? 0.2 : -0.2));
      // Entity-type and state, by material alone: a current Reading is a lit body; one that is no longer current is an
      // open ring. Both facts are on the wire; nothing here is a score.
      if (e.solid === false) { put(x, y, 30, SPRITE.HALO, e.dye, 0.45); arc(line(e.dye, 1, 1.3), x, y, 5 * k, 0, TAU); }
      else { put(x, y, 96, SPRITE.FIBRE_A + ((e.ordinal ?? 0) % 3), e.dye, 0.55, (e.ordinal ?? 0) * 1.9); node(x, y, 10.5, e.dye); }
      if (selected) arc(line(TINT.GOLD, 0.9, 0.9), x, y, 12 * k, 0, TAU);
      hits.push({ id: e.id, x, y, r: 22 });
      if (e.label !== null) labels.push({ id: e.id, text: e.label, x: x + Math.cos(o.angle) * 10 * k, y: y + (Math.sin(o.angle) > 0 ? 9 : -24) * k, emphasis: selected, major: false, tint: e.dye });
      void host;
      continue;
    }
    if (e.kind === 'THREAD') {
      nebula(e.id, e.x, e.y, rung === 0 ? 300 : 420, e.dye, rung === 0 ? 0.95 : 0.85);
      node(e.x, e.y, rung === 0 ? 13 : 15, e.dye);
      if (selected) instrument(e.x, e.y, 24, undefined);
      hits.push({ id: e.id, x: e.x, y: e.y, r: 26 });
      // AMENDED (PO directive 'COSMOS E-2 Final Corrections', 2026-11-21, §2): a topic's name speaks Public's label language —
      // an ordinary label in its own body's hue, and the selected subject's bright title — instead of a hub title for every
      // topic. Sizes, colours and the contrast treatment are the canvas's, shared with Public; nothing else here changes.
      if (e.label !== null) labels.push({ id: e.id, text: e.label, x: e.x, y: e.y + 20 * k, emphasis: selected, major: selected, tint: selected ? -1 : e.dye });
      continue;
    }
    const receded = input.receded?.has(e.id) === true;
    if (field && rung === 0) {
      // FAR: mass. Each real entry lends a little fibre and light; together they are the region's nebula.
      if (!receded) { const turn = turnOf(e.id); put(e.x + Math.cos(turn) * 16 * k, e.y + Math.sin(turn) * 16 * k, 250, SPRITE.FIBRE_A + (Math.floor(turn * 3) % 3), e.dye, 0.34, turn); }
      put(e.x, e.y, receded ? 7 : 22, SPRITE.HALO, receded ? TINT.PALE : e.dye, receded ? 0.3 : 0.8);
      put(e.x, e.y, receded ? 5 : 7, SPRITE.CORE, receded ? TINT.PALE : e.dye, receded ? 0.4 : 1);
      continue;
    }
    const near = rung === last && focus !== null;
    const neighbour = near && !selected && e.region !== undefined && e.region === focus.region;
    if (receded || (near && !selected && !neighbour)) {
      put(e.x, e.y, 9, SPRITE.SPARK, TINT.PALE, 0.4);
      hits.push({ id: e.id, x: e.x, y: e.y, r: 22 });
      continue;
    }
    if (selected) {
      nebula(e.id, e.x, e.y, 620, e.dye, 0.95);
      put(e.x, e.y, 170, SPRITE.HALO, e.dye, 0.7);
      put(e.x, e.y, 34, SPRITE.CORE, e.dye, 1);
      instrument(e.x, e.y, 40, input.focusMotes);
      hits.push({ id: e.id, x: e.x, y: e.y, r: 44 });
      if (e.label !== null) labels.push({ id: e.id, text: e.label, x: e.x, y: e.y + 96 * k, emphasis: true, major: true, tint: -1 });
      continue;
    }
    // MID: each place is its own body. Kept compact, with a bright rim of halo, so neighbours stay separate lights
    // instead of pooling into one mass; the label takes the body's own hue so text and light read as one thing.
    nebula(e.id, e.x, e.y, 200, e.dye, 0.85);
    put(e.x, e.y, 70, SPRITE.HALO, e.dye, 0.45);
    node(e.x, e.y, 12, e.dye);
    hits.push({ id: e.id, x: e.x, y: e.y, r: 24 });
    if (e.label !== null) labels.push({ id: e.id, text: e.label, x: e.x, y: e.y + 16 * k, emphasis: false, major: false, tint: e.dye });
  }
  return { rung, sprites, lines: [...lineSets.values()].filter((l) => l.data.length > 0), labels, hits };
}

function digestOf(layers: readonly StageLayer[]): string {
  let h = 0x811c9dc5;
  const eat = (n: number) => { for (let s = 0; s < 24; s += 8) { h ^= (n >>> s) & 0xff; h = Math.imul(h, 0x01000193); } };
  for (const layer of layers) {
    const s = rungScale(layer.rung); eat(layer.rung);
    for (let i = 0; i < layer.sprites.length; i += SPRITE_STRIDE) { eat(Math.round(layer.sprites[i] * s * 64)); eat(Math.round(layer.sprites[i + 1] * s * 64)); eat(Math.round(layer.sprites[i + 2] * s * 64)); eat(layer.sprites[i + 3] * 16 + layer.sprites[i + 4]); eat(Math.round(layer.sprites[i + 5] * 255)); eat(Math.round(layer.sprites[i + 6] * 1024)); }
    for (const l of layer.lines) for (const v of l.data) eat(Math.round(v * s * 64));
    for (const l of layer.labels) for (let i = 0; i < l.text.length; i += 1) eat(l.text.charCodeAt(i));
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Compile the stage. Pure and deterministic: no clock, no randomness, no host. */
export function compileStage(input: SceneInput): Stage {
  const layers: StageLayer[] = [];
  for (let rung = 0; rung < input.rungs; rung += 1) layers.push(buildLayer(input, rung));
  let bounds: Stage['bounds'] = null;
  for (const e of input.entities) bounds = bounds === null ? { minX: e.x, minY: e.y, maxX: e.x, maxY: e.y } : { minX: Math.min(bounds.minX, e.x), minY: Math.min(bounds.minY, e.y), maxX: Math.max(bounds.maxX, e.x), maxY: Math.max(bounds.maxY, e.y) };
  let horizon: Stage['horizon'] = null;
  if (input.world === 'SHARED' && bounds !== null) {
    const cx = (bounds.minX + bounds.maxX) / 2; const cy = (bounds.minY + bounds.maxY) / 2;
    horizon = { cx, cy, r: Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 + 58 };
  }
  return { world: input.world, layers, bounds, horizon, fringe: input.fringe ?? 0, digest: digestOf(layers) };
}

/** Draw operations of one resting frame, excluding the prepared atmosphere: one atlas draw plus the hairline sets. */
export function drawOpsAtRest(stage: Stage, rung: number): number {
  const layer = stage.layers[rung]; return layer ? (layer.sprites.length > 0 ? 1 : 0) + layer.lines.length + (stage.horizon ? 1 : 0) : 0;
}
