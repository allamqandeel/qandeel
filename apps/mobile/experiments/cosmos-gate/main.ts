// COSMOS Visual Gate (experimental). The proposed rendering architecture, executable in a browser: a deterministic
// stage (src/cosmos/core/stage.ts), prepared atmosphere plates and light sprites baked once (atmosphere.ts), and a
// camera that only transforms them. Canvas2D stands in for Skia here; every draw has a direct Skia equivalent.
//
// DATA: the repository's own labelled synthetic fixtures. AUTHORITY: simulated here, following the production
// controllers' rules. Nothing here is real user data. Frame rates seen in a browser are not phone measurements.

import { SHARED_VIS_WORLD_A } from '../../src/integration/__validation__/shared-vis-proof-field';
import { fixtureExperience, fixtureField } from '../../src/integration/__validation__/s503b-visual-field';
import { disclosureFixture } from '../../src/map/__fixtures__/disclosure';
import { deriveMapSceneFromDisclosure } from '../../src/map/projection/map-scene';
import { absenceOf, type NasijAbsence } from '../../src/cosmos/core/absence';
import { FAR_UNITS_PER_POINT, PERSONAL_DEPTHS, personalDrawList, personalScene, publicScene, sharedScene } from '../../src/cosmos/core/adapters';
import { approach, depthOf, layerOpacities, matrixOf, project, stepFor, unproject, zoomAbout, clampScale, type NasijCamera, type NasijView } from '../../src/cosmos/core/camera';
import { ATMOSPHERES, bakeFibre, bakePlate, bakeSprite, plateStars, TINTS, type PlateKind } from '../../src/cosmos/core/atmosphere';
import { compileStage, drawOpsAtRest, rungScale, SPRITE_STRIDE, TINT, type Hairlines, type Stage, type StageLabel, type WorldKind } from '../../src/cosmos/core/stage';

type Lang = 'ar' | 'en';
const ORIGIN = { x: 0n, y: 0n };
const SCHEME = 'QANDEEL_PREVIEW' as never;
const addr = (x: string | number, y: string | number) => ({ scheme: SCHEME, x: BigInt(x), y: BigInt(y) });

const COPY = {
  en: { PERSONAL: 'Personal', SHARED: 'Shared', PUBLIC: 'Public', fixture: 'Synthetic fixture · not real analysis', back: 'Back', overview: 'Whole world',
    rungs: { PERSONAL: ['World', 'Thread', 'Session', 'Object', 'Source'], SHARED: ['Far', 'Mid', 'Near'], PUBLIC: ['Far', 'Mid', 'Near'] },
    loading: 'Reading…', unavailable: 'This could not be read just now.', retry: 'Try again', refused: 'This is not available to you.',
    worldEmpty: 'Nothing is here yet.', regionEmpty: 'Nothing in this region.', nearest: 'Go to the nearest',
    absent: 'This is no longer here.', thread: 'Thread', reading: 'Reading', home: 'At its permanent place', hosted: 'Appears on a thread',
    noDetail: 'This view does not cover what you are inspecting.', fringe: (n: number) => `${n} not yet placed`, position: (a: number, b: number) => `Position ${a} of ${b}`,
    live: 'Live', by: 'By', sources: 'From', tapHint: 'Pinch, scroll or double-tap to go closer' },
  ar: { PERSONAL: 'الشخصي', SHARED: 'المشترك', PUBLIC: 'العام', fixture: 'بيانات اختبارية · ليست تحليلًا حقيقيًا', back: 'رجوع', overview: 'العالم كله',
    rungs: { PERSONAL: ['العالم', 'الخيط', 'الجلسة', 'العنصر', 'المصدر'], SHARED: ['بعيد', 'متوسط', 'قريب'], PUBLIC: ['بعيد', 'متوسط', 'قريب'] },
    loading: 'جارٍ القراءة…', unavailable: 'تعذّرت القراءة الآن.', retry: 'حاول مجددًا', refused: 'هذا غير متاح لك.',
    worldEmpty: 'لا شيء هنا بعد.', regionEmpty: 'لا شيء في هذه المنطقة.', nearest: 'اذهب إلى الأقرب',
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
  return (fixtureField(rect)?.experiences ?? []).slice(0, 400).map((e) => ({ id: e.id, address: addr(e.x, e.y), meaning: e.meaning, region: e.region, section: sectionOf(e.region) as never }));
}

// The Public fixture carries no `section`. For the gate each fixture region is given one real section key, in order of
// first appearance. SYNTHETIC: a real entry's section comes from the server, and sections need not be regions.
const SECTION_KEYS = ['people', 'work_money', 'family', 'loss_crisis', 'inner_self', 'life_changes', 'love', 'faith_meaning'];
const SECTION_NAMES: Record<string, { ar: string; en: string }> = { people: { ar: 'العلاقات', en: 'Relationships' }, work_money: { ar: 'العمل', en: 'Work' }, family: { ar: 'الأسرة', en: 'Family' }, loss_crisis: { ar: 'الخوف', en: 'Fear' }, inner_self: { ar: 'الذات', en: 'Inner self' }, life_changes: { ar: 'القرارات', en: 'Decisions' }, love: { ar: 'الحب', en: 'Love' }, faith_meaning: { ar: 'المعنى', en: 'Meaning' } };
const regionSection = new Map<string, string>();
const sectionOf = (region: string): string => { if (!regionSection.has(region)) regionSection.set(region, SECTION_KEYS[regionSection.size % SECTION_KEYS.length]); return regionSection.get(region) as string; };
// CONCEPT ONLY: names for the Personal world. The Personal map may draw no names today (N4 is not authorised).
const THREAD_NAMES: Array<{ ar: string; en: string; sub: Array<[string, string]> }> = [
  { ar: 'العلاقات', en: 'Relationships', sub: [['الثقة', 'Trust'], ['الحب', 'Love'], ['التواصل', 'Communication'], ['الخلافات', 'Conflict'], ['الصداقة', 'Friendship']] },
  { ar: 'العمل', en: 'Work', sub: [['الضغوط', 'Pressure'], ['الطموح', 'Ambition']] },
  { ar: 'الوحدة', en: 'Loneliness', sub: [['الانتماء', 'Belonging'], ['العزلة', 'Isolation'], ['الاعتراف', 'Recognition']] },
  { ar: 'الخوف', en: 'Fear', sub: [['المجهول', 'The unknown']] },
  { ar: 'الأبوة', en: 'Parenthood', sub: [['المسؤولية', 'Responsibility'], ['الحنان', 'Tenderness']] },
  { ar: 'القرارات', en: 'Decisions', sub: [['الندم', 'Regret']] },
  { ar: 'الصحة النفسية', en: 'Wellbeing', sub: [['التعافي', 'Recovery'], ['الوعي', 'Awareness']] },
  { ar: 'الهوية', en: 'Identity', sub: [['القيم', 'Values']] },
];
function personalName(id: string, lang: Lang): string | null {
  const t = /^THREAD:p-thread-(\d+)$/u.exec(id); if (t) return THREAD_NAMES[Number(t[1])][lang];
  const r = /^READING:p-reading-(\d+)-(\d+)@/u.exec(id); if (r) { const sub = THREAD_NAMES[Number(r[1])].sub[Number(r[2])]; return sub ? sub[lang === 'ar' ? 0 : 1] : null; }
  return null;
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
  world: 'PUBLIC' as WorldKind, lang: (new URLSearchParams(location.search).get('lang') === 'ar' ? 'ar' : 'en') as Lang, names: true, dense: false, fault: 'NONE' as Fault, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
  status: 'LOADING' as 'LOADING' | 'READY' | 'UNAVAILABLE' | 'REFUSED',
  shown: [] as Entry[], worldIndex: null as Entry[] | null, rung: 0, focusId: null as string | null, panel: null as Panel | null, tc: LIVE_HEAD, pinned: false,
  list: null as Stage | null, held: null as boolean[] | null, related: [] as string[], motes: undefined as number | undefined,
  camera: { cx: 0, cy: 0, scale: 1 } as NasijCamera, target: { cx: 0, cy: 0, scale: 1 } as NasijCamera, focusY: 0, focusYTarget: 0, moving: false,
};
let visit = 0;
const rungsOf = (w: WorldKind) => (w === 'PERSONAL' ? 5 : 3);

const canvas = document.getElementById('sky') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
let W = 0; let H = 0; let DPR = 1;
const CARD_PEEK = 156;
const view = (): NasijView => ({ width: W, height: H, focusX: W / 2, focusY: S.focusY });

function recompile(): void {
  const rtl = S.lang === 'ar';
  if (S.world === 'PERSONAL') {
    const scenes = PERSONAL_DEPTHS.map((_d, i) => { const scene = S.status === 'READY' ? personalAt(S.tc, i) : null; if (scene === null) return null; const input = personalScene(scene, S.focusId, rtl, ORIGIN); return S.names ? { ...input, entities: input.entities.map((e) => ({ ...e, label: personalName(e.id, S.lang) })) } : input; });
    const out = personalDrawList(scenes); S.list = out.list; S.held = out.held;
  } else if (S.world === 'SHARED') {
    S.list = compileStage(sharedScene(S.shown as never, S.focusId, rtl, ORIGIN, S.motes)); S.held = null;
  } else {
    S.list = compileStage(publicScene({ entries: S.shown as never, focusId: S.focusId, relatedIds: S.related, section: null, focusMotes: S.motes, rtl }, ORIGIN)); S.held = null;
    // CONCEPT: a section's name at the centre of its entries in view, at FAR only. Position is presentation, not a fact.
    const groups = new Map<string, { x: number; y: number; n: number }>();
    for (const e of S.shown) { const key = (e as { section?: string }).section; if (!key) continue; const g = groups.get(key) ?? { x: 0, y: 0, n: 0 }; g.x += Number(e.address.x) / FAR_UNITS_PER_POINT; g.y += -Number(e.address.y) / FAR_UNITS_PER_POINT; g.n += 1; groups.set(key, g); }
    for (const [key, g] of groups) (S.list.layers[0].labels as StageLabel[]).push({ id: `section:${key}`, text: SECTION_NAMES[key][S.lang], x: g.x / g.n, y: g.y / g.n - 13, emphasis: false, major: true, tint: -1 });
  }
  linePaths.clear(); wake();
}

function enter(world: WorldKind): void {
  visit += 1; const mine = visit;
  Object.assign(S, { world, status: 'LOADING', shown: [], worldIndex: null, rung: 0, focusId: null, panel: null, related: [], motes: undefined, tc: LIVE_HEAD, pinned: false });
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
    if (S.panel.s === 'SERVED') { S.motes = S.panel.lines.length; recompile(); }
    ui();
  }, delay);
}

function focus(id: string): void {
  const e = S.list?.layers.flatMap((l) => l.hits).find((h) => h.id === id);
  if (!e) return;
  S.focusId = id; S.motes = undefined;
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
  if (S.world !== 'PERSONAL' && S.rung === 2) { S.focusId = null; S.panel = null; S.related = []; S.motes = undefined; recompile(); }
  goTo(zoomAbout(from, v, about.x, about.y, rungScale(next)), next);
}

function back(): void {
  // Personal inspection writes no camera, so closing it releases the inspection and moves nothing.
  if (S.world === 'PERSONAL' && S.focusId !== null) { S.focusId = null; recompile(); ui(); return; }
  if (S.rung > 0) step('OUT', null, null); else if (S.focusId !== null) { S.focusId = null; recompile(); ui(); }
}

// ── prepared assets: baked once per world, then only transformed ───────────────────────────────────────────────────
const TILE = 1024;
interface Plates { deep: CanvasPattern; gas: CanvasPattern; veil: CanvasPattern }
const plateCache = new Map<WorldKind, Plates>();
function platesOf(world: WorldKind): Plates {
  let plates = plateCache.get(world);
  if (!plates) {
    // Soft gas is baked small and enlarged; filaments are baked at full size; stars are stamped crisply on top.
    const make = (kind: PlateKind, bake: number): CanvasPattern => {
      const small = document.createElement('canvas'); small.width = bake; small.height = bake;
      (small.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(bakePlate(world, kind, bake), bake, bake), 0, 0);
      const tile = document.createElement('canvas'); tile.width = TILE; tile.height = TILE; const t = tile.getContext('2d') as CanvasRenderingContext2D;
      t.imageSmoothingQuality = 'high'; t.drawImage(small, 0, 0, TILE, TILE); t.globalCompositeOperation = 'lighter';
      const star = ATMOSPHERES[world].star;
      for (const st of plateStars(world, kind)) for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
        const x = (st.x + ox) * TILE; const y = (st.y + oy) * TILE; const R = st.r * 3.2; if (x < -R || x > TILE + R || y < -R || y > TILE + R) continue;
        const g = t.createRadialGradient(x, y, 0, x, y, R); const c = `${Math.round(star[0] * (0.88 + st.warm * 0.12))},${Math.round(star[1] * 0.96)},${Math.round(star[2] * (1 - st.warm * 0.18))}`;
        g.addColorStop(0, `rgba(${c},${st.a})`); g.addColorStop(0.3, `rgba(${c},${st.a * 0.32})`); g.addColorStop(1, `rgba(${c},0)`); t.fillStyle = g; t.fillRect(x - R, y - R, R * 2, R * 2);
      }
      return ctx.createPattern(tile, 'repeat') as CanvasPattern;
    };
    plates = { deep: make('DEEP', 512), gas: make('GAS', 1024), veil: make('VEIL', 256) }; plateCache.set(world, plates);
  }
  return plates;
}
const SPRITE_PX = [160, 128, 128, 64, 48, 512, 512, 512];
const fibres = [0, 1, 2].map((v) => bakeFibre(v, 512));
const sprites: HTMLCanvasElement[][] = TINTS.map((tint) => SPRITE_PX.map((size, id) => {
  const px = id >= 5 ? fibres[id - 5].slice() : bakeSprite(id, size);
  for (let i = 0; i < px.length; i += 4) { const a = px[i + 3] / 255; const hot = id === 2 || id === 3 ? a * a * a : id === 4 ? a * a : id >= 5 ? a * a * 0.55 : 0; px[i] = tint[0] + (255 - tint[0]) * hot; px[i + 1] = tint[1] + (255 - tint[1]) * hot; px[i + 2] = tint[2] + (255 - tint[2]) * hot; }
  const c = document.createElement('canvas'); c.width = size; c.height = size; (c.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(px, size, size), 0, 0); return c;
}));
const cssLight = (tint: number) => `rgb(${TINTS[tint].map((c) => Math.round(c + (255 - c) * 0.42)).join(',')})`;
const css = (tint: number) => `rgb(${TINTS[tint][0]},${TINTS[tint][1]},${TINTS[tint][2]})`;
const linePaths = new Map<Hairlines, Path2D>();
function pathOf(set: Hairlines): Path2D {
  let p = linePaths.get(set);
  if (!p) { p = new Path2D(); const d = set.data; for (let i = 0; i < d.length;) { const n = d[i]; p.moveTo(d[i + 1], d[i + 2]); for (let j = 1; j < n; j += 1) p.lineTo(d[i + 1 + j * 2], d[i + 2 + j * 2]); i += 1 + n * 2; } linePaths.set(set, p); }
  return p;
}

// ── drawing: three plate fills, one sprite pass per visible rung, a few hairlines, labels ──────────────────────────
let lastOps = 0; let hudTick = 0; let clock = 0; let frozenClock: number | null = null;
function draw(): void {
  const v = view(); const cam = S.camera; const t = frozenClock ?? clock; let ops = 0;
  const maxScale = rungScale(rungsOf(S.world) - 1); const plates = platesOf(S.world);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1;
  // Each plate is a distant plane: it magnifies and slides far less than the world, by its depth. Zooming therefore
  // moves THROUGH the atmosphere instead of scaling a picture.
  const zGas = Math.log(2.3) / Math.log(maxScale);
  const plate = (pattern: CanvasPattern, zExp: number, pan: number, driftX: number, driftY: number, mode: GlobalCompositeOperation, alpha: number) => {
    const k = (1.05 * Math.pow(cam.scale, zExp) * 900) / TILE;
    const shift = Math.pow(cam.scale, 0.55);
    // The plate's centre sits at the view's focus when the camera is at the origin: the composition is framed, not cropped.
    pattern.setTransform(new DOMMatrix([k, 0, 0, k, v.focusX - TILE * k * 0.5 - cam.cx * shift * pan + driftX * t, v.focusY - TILE * k * 0.5 - cam.cy * shift * pan + driftY * t]));
    ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha; ctx.fillStyle = pattern; ctx.fillRect(0, 0, W, H); ops += 1;
  };
  plate(plates.deep, zGas * 0.45, 0.35, 0, 0, 'source-over', 1);
  plate(plates.gas, zGas, 0.9, 1.1, 0.45, 'lighter', 0.9);

  const stage = S.list;
  if (stage) {
    const m = matrixOf(cam, v); const alphas = layerOpacities(depthOf(cam.scale), stage.layers.length, S.held);
    const a0 = unproject(cam, v, 0, 0); const b0 = unproject(cam, v, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // The Shared horizon: a membership edge, drawn in screen space so it stays a hairline at every depth.
    if (stage.horizon) {
      const c = project(cam, v, stage.horizon.cx, stage.horizon.cy); const r = stage.horizon.r * cam.scale;
      if (r < 60000) {
        ctx.strokeStyle = css(TINT.GOLD); ctx.lineWidth = 1; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(c.x, c.y, r + 7, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.42; ctx.beginPath();
        for (let i = 0; i < 180; i += 1) { const a = (i / 180) * Math.PI * 2; const r1 = r + (i % 15 === 0 ? 14 : i % 5 === 0 ? 10 : 7.5); const x = c.x + Math.cos(a) * r; const y = c.y + Math.sin(a) * r; if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue; ctx.moveTo(x, y); ctx.lineTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1); }
        ctx.stroke(); ops += 1;
      }
    }
    ctx.setTransform(m[0] * DPR, 0, 0, m[3] * DPR, m[4] * DPR, m[5] * DPR);
    stage.layers.forEach((layer, r) => {
      const la = alphas[r]; if (la <= 0.01) return;
      const sp = layer.sprites;
      if (sp.length > 0) ops += 1; // one atlas draw on a host that has one
      for (let i = 0; i < sp.length; i += SPRITE_STRIDE) {
        const x = sp[i]; const y = sp[i + 1]; const d = sp[i + 2]; const rot = sp[i + 6];
        if (x + d < a0.x || x - d > b0.x || y + d < a0.y || y - d > b0.y) continue;
        ctx.globalAlpha = Math.min(1, la * sp[i + 5]);
        if (rot === 0) { ctx.setTransform(m[0] * DPR, 0, 0, m[3] * DPR, m[4] * DPR, m[5] * DPR); ctx.drawImage(sprites[sp[i + 4]][sp[i + 3]], x - d / 2, y - d / 2, d, d); }
        else { const c = Math.cos(rot) * m[0] * DPR; const sn = Math.sin(rot) * m[0] * DPR; ctx.setTransform(c, sn, -sn, c, (x * m[0] + m[4]) * DPR, (y * m[3] + m[5]) * DPR); ctx.drawImage(sprites[sp[i + 4]][sp[i + 3]], -d / 2, -d / 2, d, d); }
      }
      ctx.setTransform(m[0] * DPR, 0, 0, m[3] * DPR, m[4] * DPR, m[5] * DPR); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const set of layer.lines) { ctx.globalAlpha = la * set.alpha; ctx.strokeStyle = css(set.tint); ctx.lineWidth = set.width / rungScale(r); ctx.stroke(pathOf(set)); ops += 1; }
    });
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // The veil passes in FRONT of the world, nearer than anything in it: the sense of being inside the medium.
    plate(plates.veil, zGas * 1.7, 2.4, -2.6, 1.2, 'lighter', 1);
    ctx.globalCompositeOperation = 'source-over';
    const taken: [number, number, number, number][] = [];
    stage.layers.forEach((layer, r) => {
      const a = alphas[r]; if (a <= 0.05) return;
      const k = cam.scale / rungScale(r);
      for (const label of [...layer.labels].sort((x, y) => Number(y.emphasis) + Number(y.major) * 2 - Number(x.emphasis) - Number(x.major) * 2)) {
        const s = project(cam, v, label.x, label.y);
        if (s.x < -80 || s.x > W + 80 || s.y < -20 || s.y > H + 20) continue;
        const size = label.major ? Math.max(15, Math.min(30, 23 * Math.pow(k, 0.6))) : Math.max(10.5, Math.min(17, 12.5 * Math.pow(k, 0.6)));
        const arabic = /[\u0600-\u06FF]/u.test(label.text);
        ctx.font = `${label.major ? 700 : 500} ${size}px ${arabic ? '"Tajawal","IBM Plex Sans Arabic","Geeza Pro",sans-serif' : '"Inter",system-ui,sans-serif'}`;
        const text = label.text.length > 34 ? `${label.text.slice(0, 33)}…` : label.text; const w = ctx.measureText(text).width;
        const railL = S.lang === 'ar' ? 50 : 10; const railR = S.lang === 'ar' ? 10 : 50;
        if (s.x > 0 && s.x < W) s.x = Math.min(W - w / 2 - railR, Math.max(w / 2 + railL, s.x));
        const box: [number, number, number, number] = [s.x - w / 2 - 5, s.y - 2, s.x + w / 2 + 5, s.y + size + 5];
        if (!label.emphasis && !label.major && taken.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) continue;
        taken.push(box);
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.direction = arabic ? 'rtl' : 'ltr';
        ctx.shadowColor = 'rgba(2,3,10,0.95)'; ctx.shadowBlur = label.major ? 12 : 7; ctx.globalAlpha = a * (label.major ? 1 : 0.95);
        ctx.fillStyle = label.tint < 0 ? '#FFFFFF' : cssLight(label.tint); ctx.fillText(text, s.x, s.y); ctx.fillText(text, s.x, s.y);
        ctx.shadowBlur = 0;
      }
    });
  } else { ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; lastOps = ops;
}

// ── frame loop: runs only while something moves ───────────────────────────────────────────────────────────────────
const frames: number[] = []; let raf = 0; let last = 0; let gesturing = false;
function wake(): void { if (raf === 0) { last = 0; raf = requestAnimationFrame(tick); } }
function tick(now: number): void {
  const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
  if (last !== 0 && (S.moving || gesturing)) { frames.push(now - last); if (frames.length > 240) frames.shift(); }
  last = now; clock += dt;
  let rest = true;
  if (!gesturing) {
    const step1 = approach(S.camera, S.target, dt); S.camera = step1.camera; rest = step1.atRest;
    const dy = S.focusYTarget - S.focusY; if (Math.abs(dy) > 0.3) { S.focusY += dy * (1 - Math.pow(0.5, (dt * 1000) / 90)); rest = false; } else S.focusY = S.focusYTarget;
  } else rest = false;
  draw(); if ((hudTick += 1) % 12 === 0) hud();
  if (S.moving !== !rest) { S.moving = !rest; if (rest) ui(); }
  // The atmosphere drifts very slowly at rest; under Reduce Motion the world is still and the loop stops.
  raf = (rest && S.reduce) || frozenClock !== null ? 0 : requestAnimationFrame(tick);
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
  const c = COPY[S.lang]; const root = document.documentElement;
  root.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; root.lang = S.lang; root.dataset.world = S.world;
  $('tabs').innerHTML = (['PERSONAL', 'SHARED', 'PUBLIC'] as const).map((w) => `<button role="tab" aria-selected="${w === S.world}" data-world="${w}">${c[w]}</button>`).join('');
  $('fixture').textContent = c.fixture + (S.world === 'PERSONAL' && S.names ? (S.lang === 'ar' ? ' · تصوّر: الأسماء تحتاج N4' : ' · concept: names need N4') : '');
  $('names').setAttribute('aria-pressed', String(S.names));
  const names = c.rungs[S.world];
  $('rail').innerHTML = names.map((n, i) => `<button class="bead${i === S.rung ? ' on' : ''}${i < S.rung ? ' past' : ''}" data-rung="${i}" aria-current="${i === S.rung ? 'step' : 'false'}" ${i > S.rung ? 'disabled' : ''}><i></i><span>${n}</span></button>`).join('');
  $('back').textContent = S.rung > 0 ? `${S.lang === 'ar' ? '→' : '←'} ${names[S.rung - 1]}` : c.overview; ($('back') as HTMLButtonElement).disabled = S.rung === 0 && S.camera.cx === 0 && S.camera.cy === 0;
  // The five absences, never one sentence.
  const absence: NasijAbsence = S.moving ? { kind: 'NONE' } : absenceOf({ status: S.status, shown: (S.list ? S.list.layers[S.rung].hits.map((h) => ({ ...h })) : []).concat(S.shown.map((e) => ({ id: e.id, x: Number(e.address.x) / FAR_UNITS_PER_POINT, y: -Number(e.address.y) / FAR_UNITS_PER_POINT, r: 0 }))), worldIndex: S.world === 'PERSONAL' ? null : S.worldIndex?.map((e) => ({ id: e.id, x: Number(e.address.x) / FAR_UNITS_PER_POINT, y: -Number(e.address.y) / FAR_UNITS_PER_POINT })) ?? null }, S.target, view());
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
  if (d.world) enter(d.world as WorldKind);
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
  else if (t.id === 'labtoggle') { document.body.classList.toggle('lab'); }
  else if (t.id === 'names') { S.names = !S.names; recompile(); ui(); }
  else if (t.id === 'dense') { S.dense = !S.dense; t.setAttribute('aria-pressed', String(S.dense)); enter('PUBLIC'); }
});
($('fault') as HTMLSelectElement).addEventListener('change', (e) => { S.fault = (e.target as HTMLSelectElement).value as Fault; enter(S.world); });

function resize(): void {
  DPR = Math.min(3, window.devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  S.focusYTarget = S.focusId !== null && S.world !== 'PERSONAL' ? (H - CARD_PEEK) / 2 : H / 2; S.focusY = S.focusYTarget; wake();
}
window.addEventListener('resize', resize);
resize(); enter((new URLSearchParams(location.search).get('world') as WorldKind) || 'PUBLIC');

// A handle for automated measurement (Playwright): state, a programmatic step and the frame log.
(window as unknown as Record<string, unknown>).__cosmos = { S, step, enter, focus, frames, goTo, advance: (dt: number) => { clock += dt; if (!gesturing) { S.camera = approach(S.camera, S.target, dt).camera; const dy = S.focusYTarget - S.focusY; S.focusY = Math.abs(dy) > 0.3 ? S.focusY + dy * (1 - Math.pow(0.5, (dt * 1000) / 75)) : S.focusYTarget; } frozenClock = clock; draw(); }, setCam: (c: NasijCamera) => { S.camera = c; S.target = c; }, zoomAbout, view, freeze: (t: number | null) => { frozenClock = t; if (t === null) wake(); }, paint: () => draw(), tap, ui, ops: () => lastOps, digest: () => S.list?.digest, drawOpsAtRest: () => (S.list ? drawOpsAtRest(S.list, S.rung) : 0) };
