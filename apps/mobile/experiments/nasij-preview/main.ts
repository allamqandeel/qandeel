// NASIJ browser preview (experimental). The SAME scene core the mobile host uses, drawn with Canvas2D.
//
// DATA: the repository's own labelled synthetic fixtures. AUTHORITY: simulated here, following the production
// controllers' rules (whole-world read on entry, viewport reads capped at 400, panel read on focus, FAR tap → MID,
// NEAR is focus). The mobile proof build uses the production controllers themselves. Nothing here is real user data.

import { SHARED_VIS_WORLD_A } from '../../src/integration/__validation__/shared-vis-proof-field';
import { fixtureExperience, fixtureField } from '../../src/integration/__validation__/s503b-visual-field';
import { disclosureFixture } from '../../src/map/__fixtures__/disclosure';
import { deriveMapSceneFromDisclosure } from '../../src/map/projection/map-scene';
import { absenceOf, type NasijAbsence } from '../../src/nasij/core/absence';
import { FAR_UNITS_PER_POINT, PERSONAL_DEPTHS, personalDrawList, personalScene, publicScene, sharedScene } from '../../src/nasij/core/adapters';
import { approach, depthOf, layerOpacities, matrixOf, project, stepFor, unproject, weaveOctaves, zoomAbout, clampScale, type NasijCamera, type NasijView } from '../../src/nasij/core/camera';
import { DAY_CLOTH, NIGHT_CLOTH, type NasijPalette } from '../../src/nasij/core/palette';
import { compileNasij, drawOpsAtRest, rungScale, type Batch, type NasijDrawList, type NasijWorldKind } from '../../src/nasij/core/scene';

type Lang = 'ar' | 'en';
const ORIGIN = { x: 0n, y: 0n };
const SCHEME = 'QANDEEL_PREVIEW' as never;
const addr = (x: string | number, y: string | number) => ({ scheme: SCHEME, x: BigInt(x), y: BigInt(y) });

const COPY = {
  en: { PERSONAL: 'Personal', SHARED: 'Shared', PUBLIC: 'Public', fixture: 'Synthetic fixture · not real analysis', back: 'Back', overview: 'Whole cloth',
    rungs: { PERSONAL: ['World', 'Thread', 'Session', 'Object', 'Source'], SHARED: ['Far', 'Mid', 'Near'], PUBLIC: ['Far', 'Mid', 'Near'] },
    loading: 'Reading…', unavailable: 'This could not be read just now.', retry: 'Try again', refused: 'This is not available to you.',
    worldEmpty: 'Nothing has been woven here yet.', regionEmpty: 'Nothing in this part of the cloth.', nearest: 'Go to the nearest',
    absent: 'This is no longer here.', thread: 'Thread', reading: 'Reading', home: 'At its permanent place', hosted: 'Appears on a thread',
    noDetail: 'This view does not cover what you are inspecting.', fringe: (n: number) => `${n} not yet placed`, position: (a: number, b: number) => `Position ${a} of ${b}`,
    live: 'Live', by: 'By', sources: 'From', tapHint: 'Pinch, scroll or double-tap to go closer' },
  ar: { PERSONAL: 'الشخصي', SHARED: 'المشترك', PUBLIC: 'العام', fixture: 'بيانات اختبارية · ليست تحليلًا حقيقيًا', back: 'رجوع', overview: 'النسيج كله',
    rungs: { PERSONAL: ['العالم', 'الخيط', 'الجلسة', 'العنصر', 'المصدر'], SHARED: ['بعيد', 'متوسط', 'قريب'], PUBLIC: ['بعيد', 'متوسط', 'قريب'] },
    loading: 'جارٍ القراءة…', unavailable: 'تعذّرت القراءة الآن.', retry: 'حاول مجددًا', refused: 'هذا غير متاح لك.',
    worldEmpty: 'لم يُنسج شيء هنا بعد.', regionEmpty: 'لا شيء في هذا الجزء من النسيج.', nearest: 'اذهب إلى الأقرب',
    absent: 'لم يعد هذا موجودًا.', thread: 'خيط', reading: 'قراءة', home: 'في مكانه الدائم', hosted: 'يظهر على خيط',
    noDetail: 'هذا العرض لا يغطي ما تتفحّصه.', fringe: (n: number) => `${n} بلا مكان بعد`, position: (a: number, b: number) => `الموضع ${a} من ${b}`,
    live: 'مباشر', by: 'بقلم', sources: 'من', tapHint: 'قرّب بإصبعين أو بالتمرير أو بنقرتين' },
};

// ── simulated authority over the labelled fixtures ────────────────────────────────────────────────────────────────
interface Entry { id: string; address: { x: bigint; y: bigint }; meaning: string; region: string; title?: string; section?: never }
type Fault = 'NONE' | 'SLOW' | 'FAIL' | 'REFUSED' | 'EMPTY_WORLD';
const WHOLE = `minX=${-(2n ** 62n)}&minY=${-(2n ** 62n)}&maxX=${2n ** 62n - 1n}&maxY=${2n ** 62n - 1n}`;

/** A deterministic stress field for volume tests only: 400 entries (the server's read bound) on a seeded lattice. */
function denseField(): Entry[] {
  let seed = 20261114;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const out: Entry[] = [];
  for (let i = 0; i < 400; i += 1) {
    const cluster = i % 16; const cx = (cluster % 4 - 1.5) * 1_500_000; const cy = (Math.floor(cluster / 4) - 1.5) * 1_500_000;
    out.push({ id: `dense-${i}`, address: { x: BigInt(Math.round(cx + (rnd() - 0.5) * 900_000)), y: BigInt(Math.round(cy + (rnd() - 0.5) * 900_000)) }, meaning: `Stress entry ${i + 1}`, region: `c${cluster}` });
  }
  return out;
}
const DENSE = denseField();

function publicRead(rect: string, dense: boolean, fault: Fault): Entry[] {
  if (fault === 'EMPTY_WORLD') return [];
  if (dense) {
    const p = new Map(rect.split('&').map((s) => s.split('=') as [string, string])); const g = (k: string) => BigInt(p.get(k) as string);
    return DENSE.filter((e) => e.address.x >= g('minX') && e.address.x <= g('maxX') && e.address.y >= g('minY') && e.address.y <= g('maxY')).slice(0, 400);
  }
  return (fixtureField(rect)?.experiences ?? []).slice(0, 400).map((e) => ({ id: e.id, address: addr(e.x, e.y), meaning: e.meaning, region: e.region }));
}

const SHARED_ENTRIES = (lang: Lang): Entry[] => SHARED_VIS_WORLD_A.places.map((p, i) => ({ id: `shared-${i}`, address: addr(p.x, p.y), meaning: p.meaning[lang], region: p.region }));

const STEP = 1_000_000; const LIVE_HEAD = 12; const SESSION = 'preview-session';
const THREADS = [[0, 0, 1], [1, 0, 2], [-1, 1, 3], [1, -1, 4], [0, -2, 6], [-2, 0, 7], [2, 1, 9], [-1, -1, 11]].map(([x, y, sp], i) => ({ id: `p-thread-${i}`, x: String(x * STEP), y: String(y * STEP), establishedSp: sp }));
const HOSTED = [5, 2, 3, 1, 2, 1, 2, 1];
const APPEARANCES = HOSTED.flatMap((count, t) => Array.from({ length: count }, (_u, i) => ({ bindingId: `p-binding-${t}-${i}`, threadId: `p-thread-${t}`, readingId: `p-reading-${t}-${i}`, boundSp: Math.min(LIVE_HEAD, THREADS[t].establishedSp + i), current: i !== 1 })));
const FOCUSES = [{ id: 'p-focus-1', startedSp: 3 }, { id: 'p-focus-2', startedSp: 9 }];

/** The server's rule, simulated: only what is anchored at a position <= TC is known at TC. */
function personalAt(tc: number, depthIndex: number) {
  const threads = THREADS.filter((t) => t.establishedSp <= tc);
  const appearances = APPEARANCES.filter((a) => a.boundSp <= tc);
  const disclosure = disclosureFixture({ depth: PERSONAL_DEPTHS[depthIndex], sessionId: SESSION, tc, liveHead: LIVE_HEAD, threads, appearances,
    readings: appearances.map((a) => ({ id: a.readingId })), focuses: FOCUSES.filter((f) => f.startedSp <= tc) });
  const derived = deriveMapSceneFromDisclosure(disclosure, { sessionId: SESSION, tc, depth: PERSONAL_DEPTHS[depthIndex] } as never);
  return derived.status === 'SCENE' ? derived.scene : null;
}

// ── state ─────────────────────────────────────────────────────────────────────────────────────────────────────────
type Panel = { s: 'LOADING' } | { s: 'SERVED'; title: string; lines: string[]; meta: string } | { s: 'ABSENT' } | { s: 'UNAVAILABLE' };
const S = {
  world: 'PUBLIC' as NasijWorldKind, lang: (new URLSearchParams(location.search).get('lang') === 'ar' ? 'ar' : 'en') as Lang, night: false, dense: false, fault: 'NONE' as Fault, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
  status: 'LOADING' as 'LOADING' | 'READY' | 'UNAVAILABLE' | 'REFUSED',
  shown: [] as Entry[], worldIndex: null as Entry[] | null, rung: 0, focusId: null as string | null, panel: null as Panel | null, tc: LIVE_HEAD, pinned: false,
  list: null as NasijDrawList | null, held: null as boolean[] | null, related: [] as string[],
  camera: { cx: 0, cy: 0, scale: 1 } as NasijCamera, target: { cx: 0, cy: 0, scale: 1 } as NasijCamera, focusY: 0, focusYTarget: 0, moving: false,
};
let visit = 0;
const rungsOf = (w: NasijWorldKind) => (w === 'PERSONAL' ? 5 : 3);
const pal = (): NasijPalette => (S.night ? NIGHT_CLOTH : DAY_CLOTH);

const canvas = document.getElementById('cloth') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
let W = 0; let H = 0; let DPR = 1;
const CARD_PEEK = 156;
const view = (): NasijView => ({ width: W, height: H, focusX: W / 2, focusY: S.focusY });

function recompile(): void {
  const rtl = S.lang === 'ar';
  if (S.world === 'PERSONAL') {
    const scenes = PERSONAL_DEPTHS.map((_d, i) => { const scene = S.status === 'READY' ? personalAt(S.tc, i) : null; return scene === null ? null : personalScene(scene, S.focusId, rtl, ORIGIN); });
    const out = personalDrawList(scenes); S.list = out.list; S.held = out.held;
  } else if (S.world === 'SHARED') {
    S.list = compileNasij(sharedScene(S.shown as never, S.focusId, rtl, ORIGIN)); S.held = null;
  } else {
    S.list = compileNasij(publicScene({ entries: S.shown as never, focusId: S.focusId, relatedIds: S.related, section: null, rtl }, ORIGIN)); S.held = null;
  }
  paths.clear(); wake();
}

function enter(world: NasijWorldKind): void {
  visit += 1; const mine = visit;
  Object.assign(S, { world, status: 'LOADING', shown: [], worldIndex: null, rung: 0, focusId: null, panel: null, related: [], tc: LIVE_HEAD, pinned: false });
  S.camera = { cx: 0, cy: 0, scale: 1 }; S.target = S.camera; S.focusYTarget = H / 2; S.focusY = H / 2;
  recompile(); ui();
  setTimeout(() => {
    if (mine !== visit) return;
    if (S.fault === 'REFUSED') { S.status = 'REFUSED'; } else if (S.fault === 'FAIL' && world !== 'PERSONAL') { S.status = 'UNAVAILABLE'; }
    else {
      S.status = 'READY';
      if (world === 'PUBLIC') { S.worldIndex = publicRead(WHOLE, S.dense, S.fault); S.shown = S.worldIndex; }
      if (world === 'SHARED') { S.worldIndex = S.fault === 'EMPTY_WORLD' ? [] : SHARED_ENTRIES(S.lang); S.shown = S.worldIndex; }
    }
    recompile(); ui();
  }, S.reduce ? 0 : 180);
}

/** Public only: after the camera settles, the glass is read again by rectangle (the production rule). */
function viewportRead(): void {
  if (S.world !== 'PUBLIC' || S.status !== 'READY') return;
  const v = view(); const a = unproject(S.target, v, 0, 0); const b = unproject(S.target, v, W, H);
  const u = (n: number) => BigInt(Math.round(n * FAR_UNITS_PER_POINT));
  const rect = `minX=${u(a.x)}&minY=${u(-b.y)}&maxX=${u(b.x)}&maxY=${u(-a.y)}`;
  const served = publicRead(rect, S.dense, S.fault);
  const keep = S.focusId === null ? [] : S.shown.filter((e) => e.id === S.focusId || S.related.includes(e.id));
  S.shown = [...served, ...keep.filter((k) => !served.some((e) => e.id === k.id))];
  recompile(); ui();
}

function goTo(target: NasijCamera, rung: number): void {
  S.target = target; S.rung = rung; S.focusYTarget = S.focusId !== null && S.world !== 'PERSONAL' ? (H - CARD_PEEK) / 2 : H / 2;
  if (S.reduce) { S.camera = target; S.focusY = S.focusYTarget; }
  wake(); ui();
  if (S.world === 'PUBLIC') setTimeout(viewportRead, 0);
}

function openPanel(id: string): void {
  const mine = visit; S.panel = { s: 'LOADING' }; ui();
  const lang = S.lang; const delay = S.fault === 'SLOW' ? 2200 : 320;
  setTimeout(() => {
    if (mine !== visit || S.focusId !== id) return;
    if (S.fault === 'FAIL') { S.panel = { s: 'UNAVAILABLE' }; ui(); return; }
    const entry = S.shown.find((e) => e.id === id);
    if (!entry) { S.panel = { s: 'ABSENT' }; ui(); return; }
    if (S.world === 'PUBLIC') {
      const served = S.dense ? null : (fixtureExperience(id) as { state: string; experience: { publisher: { label: string } }; content: { text: string }[] });
      S.panel = served && served.state === 'SERVED'
        ? { s: 'SERVED', title: entry.meaning, lines: served.content.map((c) => c.text), meta: `${COPY[lang].by} ${served.experience.publisher.label}` }
        : { s: 'SERVED', title: entry.meaning, lines: ['Stress fixture: no content.'], meta: '' };
    } else {
      const place = SHARED_VIS_WORLD_A.places[Number(id.split('-')[1])];
      const lines = place.sources.map((i) => SHARED_VIS_WORLD_A.lines[i]).filter((l) => l.speaker !== 'PEER_HIDDEN').map((l) => l.text[lang]);
      S.panel = { s: 'SERVED', title: entry.meaning, lines, meta: `${COPY[lang].sources} ${place.themes.map((t) => t[lang]).join(' · ')}` };
    }
    ui();
  }, delay);
}

function focus(id: string): void {
  const e = S.list?.layers.flatMap((l) => l.hits).find((h) => h.id === id);
  if (!e) return;
  S.focusId = id;
  if (S.world === 'PERSONAL') { S.panel = null; recompile(); ui(); return; } // inspection writes no camera (production rule)
  recompile(); openPanel(id);
  goTo({ cx: e.x, cy: e.y, scale: rungScale(2) }, 2);
}

/** One canonical step. `sx, sy`: the screen point the fingers were at, or null for the accessible route. */
function step(dir: 'IN' | 'OUT', sx: number | null, sy: number | null): void {
  const rungs = rungsOf(S.world); const v = view();
  const next = S.rung + (dir === 'IN' ? 1 : -1);
  if (next < 0 || next >= rungs || S.status !== 'READY') { goTo({ ...S.target }, S.rung); return; }
  const from: NasijCamera = sx === null ? S.target : S.camera;
  const about = sx === null ? { x: v.focusX, y: v.focusY } : { x: sx, y: sy as number };
  if (S.world !== 'PERSONAL' && next === 2) {
    // NEAR is focus: the place nearest the fingers among those in view; with none there is no act.
    const w = unproject(from, v, about.x, about.y);
    const a = unproject(from, v, 0, 0); const b = unproject(from, v, W, H);
    let best: { id: string; d: number } | null = null;
    for (const h of S.list?.layers[1].hits ?? []) {
      if (h.x < a.x || h.x > b.x || h.y < a.y || h.y > b.y) continue;
      const d = (h.x - w.x) ** 2 + (h.y - w.y) ** 2; if (best === null || d < best.d) best = { id: h.id, d };
    }
    if (best === null) { goTo({ ...S.target, scale: rungScale(S.rung) }, S.rung); return; }
    focus(best.id); return;
  }
  if (S.world !== 'PERSONAL' && S.rung === 2) { S.focusId = null; S.panel = null; S.related = []; recompile(); }
  goTo(zoomAbout(from, v, about.x, about.y, rungScale(next)), next);
}

function back(): void {
  if (S.rung > 0) step('OUT', null, null); else if (S.focusId !== null) { S.focusId = null; recompile(); ui(); }
}

// ── drawing ───────────────────────────────────────────────────────────────────────────────────────────────────────
const paths = new Map<Batch, Path2D>();
function pathOf(batch: Batch): Path2D {
  let p = paths.get(batch);
  if (!p) {
    p = new Path2D(); const d = batch.data;
    for (let i = 0; i < d.length;) { const n = d[i]; p.moveTo(d[i + 1], d[i + 2]); for (let j = 1; j < n; j += 1) p.lineTo(d[i + 1 + j * 2], d[i + 2 + j * 2]); if (batch.t === 'fill') p.closePath(); i += 1 + n * 2; }
    paths.set(batch, p);
  }
  return p;
}
function drawBatches(batches: readonly Batch[], alpha: number, colors: NasijPalette['colors']): number {
  for (const b of batches) {
    ctx.globalAlpha = alpha * b.alpha;
    if (b.t === 'fill') { ctx.fillStyle = colors[b.color]; ctx.fill(pathOf(b)); } else { ctx.strokeStyle = colors[b.color]; ctx.lineWidth = b.width; ctx.stroke(pathOf(b)); }
  }
  return batches.length;
}

// One weave repeat: a 2x2 basket weave. Each cell is a thread lying over its neighbours, lit along its length.
const TILE_PX = 96; const tiles = new Map<NasijPalette, CanvasPattern>();
function weaveTile(p: NasijPalette): CanvasPattern {
  let pattern = tiles.get(p);
  if (!pattern) {
    const c = document.createElement('canvas'); c.width = TILE_PX; c.height = TILE_PX; const t = c.getContext('2d') as CanvasRenderingContext2D; const h = TILE_PX / 2;
    for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1) {
      const horizontal = (i + j) % 2 === 0; const x = i * h; const y = j * h;
      const g = horizontal ? t.createLinearGradient(0, y, 0, y + h) : t.createLinearGradient(x, 0, x + h, 0);
      g.addColorStop(0, p.weave); g.addColorStop(0.16, 'rgba(0,0,0,0)'); g.addColorStop(0.5, S.night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.4)'); g.addColorStop(0.84, 'rgba(0,0,0,0)'); g.addColorStop(1, p.weave);
      if (i + j === 0) { t.globalAlpha = 1; t.fillStyle = p.colors.ground; t.fillRect(0, 0, TILE_PX, TILE_PX); }
      t.globalAlpha = 0.3; t.fillStyle = g; t.fillRect(x, y, h, h);
    }
    pattern = ctx.createPattern(c, 'repeat') as CanvasPattern; tiles.set(p, pattern);
  }
  return pattern;
}

let lastOps = 0; let lanternY = -1; let hudTick = 0;
const lantern = document.getElementById('lantern') as HTMLElement;
function draw(): void {
  const p = pal(); const v = view(); const cam = S.camera; let ops = 1; // the lantern overlay counts as one
  // FILL-RATE BUDGET (measured: frame cost follows full-screen passes, not entity count). At rest and while panning the
  // cloth is ONE opaque full-screen pass: the weave tile carries the ground colour. A second pass exists only while a
  // rung transition cross-fades two weave gauges. The lantern is a static overlay the compositor owns (see shell.html).
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const tile = weaveTile(p); const octaves = weaveOctaves(cam.scale);
  if (octaves.length === 0 || octaves[0].alpha < 0.999) { ctx.globalAlpha = 1; ctx.fillStyle = p.colors.ground; ctx.fillRect(0, 0, W, H); ops += 1; }
  for (const o of octaves) {
    const k = (o.spacing * cam.scale) / TILE_PX;
    tile.setTransform(new DOMMatrix([k, 0, 0, k, v.focusX - cam.cx * cam.scale, v.focusY - cam.cy * cam.scale]));
    ctx.globalAlpha = o.alpha; ctx.fillStyle = tile; ctx.fillRect(0, 0, W, H); ops += 1;
  }
  if (lanternY !== v.focusY) { lanternY = v.focusY; lantern.style.setProperty('--fy', `${v.focusY}px`); }

  const list = S.list;
  if (list) {
    const m = matrixOf(cam, v);
    ctx.setTransform(m[0] * DPR, 0, 0, m[3] * DPR, m[4] * DPR, m[5] * DPR);
    ops += drawBatches(list.border, 1, p.colors);
    const alphas = layerOpacities(depthOf(cam.scale), list.layers.length, S.held);
    list.layers.forEach((layer, r) => { if (alphas[r] > 0.01) ops += drawBatches(layer.batches, alphas[r], p.colors); });
    // Labels, in screen space so the text is always crisp; they scale with their layer while it moves.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const taken: [number, number, number, number][] = [];
    list.layers.forEach((layer, r) => {
      const a = alphas[r]; if (a <= 0.05) return;
      const k = cam.scale / rungScale(r); const size = Math.max(9, Math.min(22, 13 * k));
      for (const label of [...layer.labels].sort((x, y) => Number(y.emphasis) - Number(x.emphasis))) {
        const s = project(cam, v, label.x, label.y);
        if (s.x < -80 || s.x > W + 80 || s.y < -20 || s.y > H + 20) continue;
        ctx.font = `${label.emphasis ? 600 : 500} ${label.emphasis ? size + 2 : size}px ${S.lang === 'ar' ? '"Noto Naskh Arabic","Geeza Pro",Tahoma,serif' : 'Georgia,"Iowan Old Style",serif'}`;
        const text = label.text.length > 34 ? `${label.text.slice(0, 33)}…` : label.text; const w = ctx.measureText(text).width;
        if (s.x > 0 && s.x < W) s.x = Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, s.x));
        const box: [number, number, number, number] = [s.x - w / 2 - 4, s.y - 2, s.x + w / 2 + 4, s.y + size + 6];
        if (!label.emphasis && taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) continue;
        taken.push(box);
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.direction = S.lang === 'ar' ? 'rtl' : 'ltr';
        ctx.globalAlpha = a * 0.9; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = p.colors.ground; ctx.strokeText(text, s.x, s.y);
        ctx.globalAlpha = a; ctx.fillStyle = p.text; ctx.fillText(text, s.x, s.y);
      }
    });
  }
  ctx.globalAlpha = 1; lastOps = ops;
}

// ── frame loop: runs only while something moves ───────────────────────────────────────────────────────────────────
const frames: number[] = []; let raf = 0; let last = 0; let gesturing = false;
function wake(): void { if (raf === 0) { last = 0; raf = requestAnimationFrame(tick); } }
function tick(now: number): void {
  const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
  if (last !== 0) { frames.push(now - last); if (frames.length > 240) frames.shift(); }
  last = now;
  let rest = true;
  if (!gesturing) {
    const step1 = approach(S.camera, S.target, dt); S.camera = step1.camera; rest = step1.atRest;
    const dy = S.focusYTarget - S.focusY; if (Math.abs(dy) > 0.3) { S.focusY += dy * (1 - Math.pow(0.5, (dt * 1000) / 90)); rest = false; } else S.focusY = S.focusYTarget;
  } else rest = false;
  draw(); if ((hudTick += 1) % 12 === 0) hud();
  if (S.moving !== !rest) { S.moving = !rest; if (rest) ui(); }
  raf = rest ? 0 : requestAnimationFrame(tick);
}

// ── input ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const pointers = new Map<number, { x: number; y: number }>();
let pinch: { d: number; scale: number; mx: number; my: number } | null = null; let dragged = 0; let downAt = 0;
const mid = () => { const [a, b] = [...pointers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); gesturing = true; dragged = 0; downAt = performance.now();
  if (pointers.size === 2) { const m = mid(); pinch = { d: m.d, scale: S.camera.scale, mx: m.x, my: m.y }; }
  wake();
});
canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId); if (!prev) return;
  const next = { x: e.offsetX, y: e.offsetY }; pointers.set(e.pointerId, next);
  if (pointers.size === 1) {
    const dx = next.x - prev.x; const dy = next.y - prev.y; dragged += Math.abs(dx) + Math.abs(dy);
    S.camera = { ...S.camera, cx: S.camera.cx - dx / S.camera.scale, cy: S.camera.cy - dy / S.camera.scale };
  } else if (pinch && pointers.size === 2) {
    const m = mid(); dragged += 10;
    S.camera = zoomAbout(S.camera, view(), m.x, m.y, clampScale(pinch.scale * (m.d / pinch.d), rungsOf(S.world)));
    pinch.mx = m.x; pinch.my = m.y;
  }
});
const up = (e: PointerEvent) => {
  if (!pointers.has(e.pointerId)) return; pointers.delete(e.pointerId);
  if (pointers.size > 0) return;
  gesturing = false;
  if (pinch) { const dir = stepFor(S.camera.scale / pinch.scale); const { mx, my } = pinch; pinch = null; if (dir) step(dir, mx, my); else goTo({ ...S.camera, scale: rungScale(S.rung) }, S.rung); return; }
  if (dragged < 6 && performance.now() - downAt < 400) { tap(e.offsetX, e.offsetY); return; }
  goTo({ ...S.camera, scale: rungScale(S.rung) }, S.rung); // one completed drag is one pan
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
let wheelStart: number | null = null; let wheelTimer = 0; let wheelAt = { x: 0, y: 0 };
canvas.addEventListener('wheel', (e) => {
  e.preventDefault(); if (wheelStart === null) wheelStart = S.camera.scale;
  gesturing = true; wheelAt = { x: e.offsetX, y: e.offsetY };
  S.camera = zoomAbout(S.camera, view(), e.offsetX, e.offsetY, clampScale(S.camera.scale * Math.exp(-e.deltaY * 0.0045), rungsOf(S.world))); wake();
  clearTimeout(wheelTimer);
  wheelTimer = window.setTimeout(() => { gesturing = false; const dir = stepFor(S.camera.scale / (wheelStart as number)); wheelStart = null; if (dir) step(dir, wheelAt.x, wheelAt.y); else goTo({ ...S.camera, scale: rungScale(S.rung) }, S.rung); }, 140);
}, { passive: false });
let lastTap = 0;
function tap(x: number, y: number): void {
  const v = view(); const w = unproject(S.camera, v, x, y); const now = performance.now();
  const layer = S.list?.layers[S.rung];
  let hit: string | null = null; let bestD = Infinity;
  for (const h of layer?.hits ?? []) { const d = Math.hypot(h.x - w.x, h.y - w.y) * S.camera.scale; if (d <= h.r && d < bestD) { bestD = d; hit = h.id; } }
  if (hit !== null) { focus(hit); lastTap = 0; return; }
  if (S.world !== 'PERSONAL' && S.rung === 0 && S.status === 'READY') { goTo({ cx: w.x, cy: w.y, scale: rungScale(1) }, 1); return; } // FAR tap discloses that place at MID
  if (now - lastTap < 320) { step('IN', x, y); lastTap = 0; return; }
  lastTap = now;
}
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') step('IN', null, null); else if (e.key === '-') step('OUT', null, null); else if (e.key === 'Escape') back();
  else if (e.key.startsWith('Arrow')) { const d = e.key === 'ArrowLeft' ? [-1, 0] : e.key === 'ArrowRight' ? [1, 0] : e.key === 'ArrowUp' ? [0, -1] : [0, 1]; goTo({ ...S.target, cx: S.target.cx + (d[0] * W) / 3 / S.target.scale, cy: S.target.cy + (d[1] * H) / 3 / S.target.scale }, S.rung); }
});

// ── chrome (DOM) ──────────────────────────────────────────────────────────────────────────────────────────────────
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
function hud(): void {
  if (frames.length < 5) return; const sorted = [...frames].sort((a, b) => a - b);
  $('hud').textContent = `frame p50 ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} ms · p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)} ms · ${lastOps} draw ops · ${S.shown.length || (S.list?.layers[S.list.layers.length - 1].hits.length ?? 0)} entities`;
}
function ui(): void {
  const c = COPY[S.lang]; const p = pal(); const root = document.documentElement;
  root.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; root.lang = S.lang;
  root.style.setProperty('--card', p.card); root.style.setProperty('--text', p.text); root.style.setProperty('--quiet', p.textQuiet); root.style.setProperty('--accent', p.colors.accent); root.style.setProperty('--ground', p.colors.ground); root.style.setProperty('--line', p.colors.undyed);
  $('tabs').innerHTML = (['PERSONAL', 'SHARED', 'PUBLIC'] as const).map((w) => `<button role="tab" aria-selected="${w === S.world}" data-world="${w}">${c[w]}</button>`).join('');
  $('fixture').textContent = c.fixture;
  const names = c.rungs[S.world];
  $('rail').innerHTML = names.map((n, i) => `<button class="bead${i === S.rung ? ' on' : ''}${i < S.rung ? ' past' : ''}" data-rung="${i}" aria-current="${i === S.rung ? 'step' : 'false'}" ${i > S.rung ? 'disabled' : ''}><i></i><span>${n}</span></button>`).join('');
  $('back').textContent = S.rung > 0 ? `${S.lang === 'ar' ? '→' : '←'} ${names[S.rung - 1]}` : c.overview; ($('back') as HTMLButtonElement).disabled = S.rung === 0 && S.camera.cx === 0 && S.camera.cy === 0;
  // The five absences, never one sentence.
  const absence: NasijAbsence = S.moving ? { kind: 'NONE' } : absenceOf({ status: S.status, shown: (S.list?.layers[0].batches.length ? S.list.layers.flatMap((l) => l.hits.length ? l.hits : []) : []).concat(S.shown.map((e) => ({ id: e.id, x: Number(e.address.x) / FAR_UNITS_PER_POINT, y: -Number(e.address.y) / FAR_UNITS_PER_POINT, r: 0 }))), worldIndex: S.world === 'PERSONAL' ? null : S.worldIndex?.map((e) => ({ id: e.id, x: Number(e.address.x) / FAR_UNITS_PER_POINT, y: -Number(e.address.y) / FAR_UNITS_PER_POINT })) ?? null }, S.target, view());
  const note = $('absence'); note.hidden = absence.kind === 'NONE'; note.className = `absence ${absence.kind}`;
  if (absence.kind === 'LOADING') note.innerHTML = `<span class="pulse"></span>${c.loading}`;
  if (absence.kind === 'UNAVAILABLE') note.innerHTML = `${c.unavailable} <button data-act="retry">${c.retry}</button>`;
  if (absence.kind === 'REFUSED') note.textContent = c.refused;
  if (absence.kind === 'WORLD_EMPTY') note.textContent = c.worldEmpty;
  if (absence.kind === 'REGION_EMPTY') {
    const b = absence.bearing; const angle = b ? Math.atan2(b.dy, b.dx) * 180 / Math.PI : 0;
    note.innerHTML = `${c.regionEmpty}${b ? ` <button data-act="nearest" data-x="${b.dx + S.target.cx}" data-y="${b.dy + S.target.cy}"><i class="arrow" style="transform:rotate(${angle}deg)">➤</i> ${c.nearest}</button>` : ''}`;
  }
  // The lantern card: a fixed peek height from the first frame, whatever the read does.
  const card = $('card'); const open = S.focusId !== null;
  card.classList.toggle('open', open);
  if (open && S.world === 'PERSONAL') {
    const isThread = (S.focusId as string).startsWith('THREAD');
    card.innerHTML = `<header><b>${isThread ? c.thread : c.reading}</b><button data-act="close" aria-label="${c.back}">×</button></header><p class="meta">${isThread ? c.home : c.hosted}</p><p class="quiet">${c.noDetail}</p>`;
  } else if (open && S.panel) {
    const pn = S.panel;
    const body = pn.s === 'LOADING' ? `<div class="sk"></div><div class="sk s"></div><div class="sk"></div>` : pn.s === 'UNAVAILABLE' ? `<p class="quiet">${c.unavailable}</p><button data-act="reload">${c.retry}</button>` : pn.s === 'ABSENT' ? `<p class="quiet">${c.absent}</p>` : `<p class="meta">${esc(pn.meta)}</p>${pn.lines.map((l) => `<p dir="auto">${esc(l)}</p>`).join('')}`;
    card.innerHTML = `<header><b dir="auto">${pn.s === 'SERVED' ? esc(pn.title) : esc(S.shown.find((e) => e.id === S.focusId)?.meaning ?? '')}</b><button data-act="close" aria-label="${c.back}">×</button></header><div class="body" aria-busy="${pn.s === 'LOADING'}">${body}</div>`;
  }
  // Personal: the selvedge (time) and the fringe (unplaced).
  const sel = $('selvedge'); sel.hidden = S.world !== 'PERSONAL';
  if (S.world === 'PERSONAL') {
    sel.innerHTML = `<div class="ticks">${Array.from({ length: LIVE_HEAD }, (_u, i) => `<button class="${i + 1 <= S.tc ? 'woven' : ''}${i + 1 === S.tc ? ' at' : ''}" data-tc="${i + 1}" aria-label="${c.position(i + 1, LIVE_HEAD)}"></button>`).join('')}</div><span>${S.pinned ? c.position(S.tc, LIVE_HEAD) : c.live}</span>${S.list && S.list.fringe > 0 ? `<span class="fringe">${c.fringe(S.list.fringe)}</span>` : ''}${S.pinned ? `<button data-act="live">${c.live}</button>` : ''}`;
  }
  $('hint').textContent = c.tapHint;
  // Screen-reader projection of the same scene: the current rung's entities as a list of buttons.
  const hits = S.list?.layers[Math.max(S.world === 'PERSONAL' ? 0 : 1, S.rung)]?.hits ?? [];
  $('sr').innerHTML = hits.slice(0, 60).map((h) => `<li><button data-focus="${esc(h.id)}">${esc(S.shown.find((e) => e.id === h.id)?.meaning ?? (h.id.startsWith('THREAD') ? c.thread : c.reading))}</button></li>`).join('');
}
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button'); if (!t) return; const d = t.dataset;
  if (d.world) enter(d.world as NasijWorldKind);
  else if (d.rung) { let n = S.rung - Number(d.rung); while (n-- > 0) step('OUT', null, null); }
  else if (d.focus) focus(d.focus);
  else if (d.tc) { S.tc = Number(d.tc); S.pinned = true; S.focusId = null; recompile(); ui(); }
  else if (d.act === 'live') { S.tc = LIVE_HEAD; S.pinned = false; recompile(); ui(); }
  else if (d.act === 'close') back();
  else if (d.act === 'retry') enter(S.world);
  else if (d.act === 'reload' && S.focusId) openPanel(S.focusId);
  else if (d.act === 'nearest') goTo({ cx: Number(d.x), cy: Number(d.y), scale: rungScale(Math.max(1, S.rung)) }, Math.max(1, S.rung));
  else if (t.id === 'back') { if (S.rung > 0) back(); else goTo({ cx: 0, cy: 0, scale: 1 }, 0); }
  else if (t.id === 'lang') { S.lang = S.lang === 'ar' ? 'en' : 'ar'; enter(S.world); }
  else if (t.id === 'night') { S.night = !S.night; document.body.classList.toggle('night', S.night); wake(); ui(); }
  else if (t.id === 'labtoggle') { document.body.classList.toggle('lab'); }
  else if (t.id === 'dense') { S.dense = !S.dense; t.setAttribute('aria-pressed', String(S.dense)); enter('PUBLIC'); }
});
($('fault') as HTMLSelectElement).addEventListener('change', (e) => { S.fault = (e.target as HTMLSelectElement).value as Fault; enter(S.world); });

function resize(): void {
  DPR = Math.min(3, window.devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  S.focusYTarget = S.focusId !== null && S.world !== 'PERSONAL' ? (H - CARD_PEEK) / 2 : H / 2; S.focusY = S.focusYTarget; wake();
}
window.addEventListener('resize', resize);
resize(); enter((new URLSearchParams(location.search).get('world') as NasijWorldKind) || 'PUBLIC');

// A handle for automated measurement (Playwright): state, a programmatic step and the frame log.
(window as unknown as Record<string, unknown>).__nasij = { S, step, enter, focus, frames, goTo, ops: () => lastOps, digest: () => S.list?.digest, drawOpsAtRest: () => (S.list ? drawOpsAtRest(S.list, S.rung) : 0) };
