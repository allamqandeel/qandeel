/**
 * S5-03B — the Product Visual Review fixture of the Public semantic field. VALIDATION ONLY.
 *
 * A SYNTHETIC set of Public Experiences, each with a place, a reviewed meaning, a semantic region and a panel, answered
 * as `apps/api/src/public-world` answers the three field reads (`GET /public/field`, `/public/field/search`,
 * `/public/field/experiences/:id`). It exists so the Product Owner can see the field render on a device with enough
 * Experiences to judge it. It is reachable only from the S4-01 proof world (`s401-proof-world.ts`), only after
 * `qandeel://s401-proof/public/seed`, and the proof world is reachable only through `select-s401-proof-entry.mjs --apply`
 * with `S401_SHARED_PROOF=1`: no Product module imports it, and nothing here is published, ranked or counted.
 *
 * Every meaning, theme, pseudonym and line below is SYNTHETIC validation text — never Product copy, never a real person.
 */

/** One synthetic semantic region: its centre (in REGION_UNIT world units) and its Experiences' meanings. */
interface FixtureRegion {
  readonly region: string;
  readonly cx: number;
  readonly cy: number;
  readonly themes: readonly [string, string];
  readonly meanings: readonly string[];
}

/**
 * S5-03B Phase 2 — the fixture at the World's own presentation convention (D1): the Public field is seen at the Map's
 * default scale, where the canonical step of 1,000,000 world units is about 122 points. Regions sit 1.2–1.6 million
 * units apart and an Experience's neighbours 25–110 thousand units from it, so the synthetic field has a shape at FAR,
 * MID and NEAR. A presentation spacing for validation only — semantic nearness is the placer's, never this file's.
 */
const REGION_UNIT = 45_000;
const OFFSET_UNIT = 12_500;

const REGIONS: readonly FixtureRegion[] = [
  { region: 'family.fear', cx: -22, cy: 30, themes: ['الخوف', 'العائلة'], meanings: [
    'خوف من أن أخذل أهلي', 'القلق على صحة أمي', 'لا أعرف كيف أتكلم مع أبي', 'أحمل همّ إخوتي الصغار', 'أخاف أن أكرر أخطاء والديّ', 'بيت مزدحم وقلب وحيد'] },
  { region: 'work.pressure', cx: 26, cy: 22, themes: ['العمل', 'الضغط'], meanings: [
    'إرهاق لا ينتهي في العمل', 'أشعر أن جهدي غير مرئي', 'خوف من فقدان وظيفتي', 'مدير لا يسمع', 'أعمل كثيرًا ولا أتقدّم'] },
  { region: 'loss.grief', cx: -30, cy: -18, themes: ['الفقد', 'الحزن'], meanings: [
    'فقدت صديقًا ولم أودّعه', 'سنة على رحيل جدتي', 'الحزن يأتي في أوقات غريبة', 'أتذكّر صوته كل مساء', 'كيف أعيش بعد الفقد'] },
  { region: 'hope.waiting', cx: 18, cy: -28, themes: ['الأمل', 'الانتظار'], meanings: [
    'أنتظر نتيجة تغيّر حياتي', 'بداية جديدة في مدينة أخرى', 'أتعلّم الصبر ببطء', 'شيء صغير جعلني أبتسم اليوم', 'أؤمن أن الغد أهدأ'] },
  { region: 'self.worth', cx: 2, cy: 4, themes: ['الذات', 'القيمة'], meanings: [
    'لا أشعر أنني كافٍ', 'أقارن نفسي بالآخرين دائمًا', 'تعلّمت أن أقول لا', 'أحاول أن أسامح نفسي', 'صوت داخلي قاسٍ'] },
  { region: 'love.distance', cx: 34, cy: -4, themes: ['الحب', 'البُعد'], meanings: [
    'حب بعيد عبر الشاشات', 'انتهت علاقة طويلة', 'أخاف من التعلّق'] },
];

/** A deterministic scatter inside a region (no randomness: the same field on every run). */
const OFFSETS: ReadonlyArray<readonly [number, number]> = [[0, 0], [1.6, 2.0], [-6.4, 3.4], [5.2, -5.6], [-4.0, -7.2], [7.6, 4.4]];

export interface FixtureEntry { readonly id: string; readonly x: string; readonly y: string; readonly meaning: string; readonly region: string }
interface FixtureExperience extends FixtureEntry { readonly themes: readonly [string, string]; readonly pseudonym: string }

const EXPERIENCES: readonly FixtureExperience[] = REGIONS.flatMap((r, ri) => r.meanings.map((meaning, mi) => {
  const [dx, dy] = OFFSETS[mi % OFFSETS.length];
  const x = BigInt(Math.round(r.cx * REGION_UNIT + dx * OFFSET_UNIT));
  const y = BigInt(Math.round(r.cy * REGION_UNIT + dy * OFFSET_UNIT));
  const n = ri * 10 + mi + 1;
  return { id: `5503b000-0000-4000-8000-${String(n).padStart(12, '0')}`, x: x.toString(), y: y.toString(), meaning, region: r.region,
    themes: r.themes, pseudonym: `fixture-lamp-${String(n).padStart(2, '0')}` };
}));

const entryOf = ({ id, x, y, meaning, region }: FixtureExperience): FixtureEntry => ({ id, x, y, meaning, region });

/** `GET /public/field?minX&minY&maxX&maxY`: the Experiences inside the rectangle. */
export function fixtureField(query: string): { experiences: FixtureEntry[] } | null {
  const params = new Map(query.split('&').map((pair) => pair.split('=') as [string, string]));
  const bound = (key: string) => { const v = params.get(key); return v !== undefined && /^-?\d+$/u.test(v) ? BigInt(v) : null; };
  const [minX, minY, maxX, maxY] = ['minX', 'minY', 'maxX', 'maxY'].map(bound);
  if (minX === null || minY === null || maxX === null || maxY === null) return null;
  return { experiences: EXPERIENCES.filter((e) => BigInt(e.x) >= minX && BigInt(e.x) <= maxX && BigInt(e.y) >= minY && BigInt(e.y) <= maxY).map(entryOf) };
}

/** `GET /public/field/search?q`: the Experiences whose meaning or themes contain the query (at most 20). */
export function fixtureSearch(q: string): { results: FixtureEntry[] } {
  const needle = q.trim();
  return { results: EXPERIENCES.filter((e) => e.meaning.includes(needle) || e.themes.some((t) => t.includes(needle))).slice(0, 20).map(entryOf) };
}

/** `GET /public/field/experiences/:id`: the contextual panel, with at most three nearby Experiences of the same region. */
export function fixtureExperience(id: string): unknown {
  const e = EXPERIENCES.find((x) => x.id === id);
  if (!e) return { state: 'UNAVAILABLE' };
  return {
    state: 'SERVED',
    experience: { id: e.id, x: e.x, y: e.y, meaning: e.meaning, region: e.region, primaryThemes: [e.themes[0]], secondaryThemes: [e.themes[1]],
      publisher: { mode: 'PSEUDONYM', label: e.pseudonym }, publishedAt: '2026-10-01T12:00:00.000Z', discussionCount: 0, qandeelResponseCount: 0 },
    content: [
      { ordinal: 1, kind: 'SOURCE_CONTENT', text: `نص اختباري للتجربة: ${e.meaning}.` },
      { ordinal: 2, kind: 'ANALYSIS', text: 'قراءة اختبارية من قنديل لهذه التجربة.' },
    ],
    nearby: EXPERIENCES.filter((x) => x.region === e.region && x.id !== e.id).slice(0, 3).map(entryOf),
  };
}
