/**
 * SHARED-VIS-01 — the Product Visual Review fixture of the Shared World's Living Analysis field. VALIDATION ONLY.
 *
 * Two SYNTHETIC Shared Worlds, each with a short human conversation and the semantic places a reading of it produced —
 * each place a meaning, its themes, its semantic region, its place in THAT World's own geography and the exact lines it
 * was read from. It exists so the Product Owner can see a Shared World render on a device with enough places to judge it,
 * while no production provider exists (Stage 8A): the readings below are fixed validation text standing in for the
 * provider-neutral interpreter and placer, exactly as the S5-03B Public fixture stands in for the Public field.
 *
 * The S4-01 proof world answers the two field reads from it as `apps/api/src/shared-world` and migration 0148 do: only
 * after `qandeel://s401-proof/shared-field/seed`, only to a current member, and a place only while EVERY line it was read
 * from still exists and is visible to the reader (one place below rests on a line the reader cannot see, and is therefore
 * never served; deleting one's own line removes every place read from it).
 *
 * The two Worlds' coordinates share nothing: World B's regions sit elsewhere, because each World is its own geography.
 * Regions sit about a million world units apart and a region's places 25–110 thousand units from each other — the S5-03B
 * presentation spacing — so the field has a shape at FAR, MID and NEAR. Presentation spacing for validation only.
 *
 * Every line, meaning, theme and name here is SYNTHETIC validation text — never Product copy, never a real person.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

type Bilingual = { readonly ar: string; readonly en: string };
/** Who said a line: the reader, the other person, or (hidden) the other person before the reader could see it. */
export type FixtureSpeaker = 'SELF' | 'PEER' | 'PEER_HIDDEN';

export interface SharedVisFixtureLine { readonly speaker: FixtureSpeaker; readonly text: Bilingual }
export interface SharedVisFixturePlace {
  readonly meaning: Bilingual;
  readonly region: string;
  readonly themes: readonly [Bilingual, Bilingual];
  readonly x: number;
  readonly y: number;
  /** The exact lines (indices into the World's lines) the place was read from. */
  readonly sources: readonly number[];
}
export interface SharedVisFixtureWorld { readonly name: Bilingual; readonly lines: readonly SharedVisFixtureLine[]; readonly places: readonly SharedVisFixturePlace[] }

const REGION_UNIT = 45_000;
const OFFSET_UNIT = 12_500;
const at = (cx: number, cy: number, dx: number, dy: number) => ({ x: Math.round(cx * REGION_UNIT + dx * OFFSET_UNIT), y: Math.round(cy * REGION_UNIT + dy * OFFSET_UNIT) });
const t = (ar: string, en: string): Bilingual => ({ ar, en });

const HOME = [t('البيت', 'home'), t('التأجيل', 'postponing')] as const;
const TIME = [t('الوقت', 'time'), t('الاتفاق', 'agreement')] as const;
const CARE = [t('الأهل', 'family'), t('الرعاية', 'care')] as const;
const MEMORY = [t('الذكريات', 'memories'), t('البدايات', 'beginnings')] as const;

/** World A — the map World of the visual review. */
export const SHARED_VIS_WORLD_A: SharedVisFixtureWorld = {
  name: t('عالم الخريطة الاختباري', 'Fixture Map World'),
  lines: [
    { speaker: 'SELF', text: t('نؤجّل الحديث عن الانتقال كل أسبوع', 'We keep postponing the talk about moving') },
    { speaker: 'PEER', text: t('لأن كل مرة نبدأ يتحوّل إلى خلاف', 'Because every time we start, it turns into a fight') },
    { speaker: 'SELF', text: t('أخاف أن نقرّر بسرعة ثم نندم', "I'm afraid we'll decide fast and regret it") },
    { speaker: 'PEER', text: t('ربما نتفق على وقت محدد للحديث', 'Maybe we agree on a set time to talk') },
    { speaker: 'SELF', text: t('الأسبوع مزدحم ولا يبقى لنا وقت معًا', "The week is full and we're left with no time together") },
    { speaker: 'PEER', text: t('يوم الجمعة صباحًا قد يناسبنا', 'Friday morning might work for us') },
    { speaker: 'SELF', text: t('أنا قلق على صحة أمي هذه الأيام', "I'm worried about my mother's health these days") },
    { speaker: 'PEER', text: t('يمكن أن نتقاسم زيارتها بيننا', 'We can share visiting her between us') },
    { speaker: 'SELF', text: t('أحتاج أن أشعر أنني لست وحدي في هذا', "I need to feel I'm not alone in this") },
    { speaker: 'PEER', text: t('أتذكّر أول بيت سكنّاه معًا', 'I remember the first home we lived in together') },
    { speaker: 'PEER_HIDDEN', text: t('كلام قيل قبل أن يرى القارئ هذا العالم', 'Words said before the reader could see this World') },
  ],
  places: [
    { meaning: t('تأجيل الحديث عن الانتقال', 'Postponing the talk about moving'), region: 'home.move', themes: HOME, ...at(-16, 14, 0, 0), sources: [0, 1] },
    { meaning: t('الخوف من قرار متسرّع', 'Fear of a hasty decision'), region: 'home.move', themes: HOME, ...at(-16, 14, 3.2, -2.4), sources: [0, 2] },
    { meaning: t('خلاف يبدأ كلما فُتح الموضوع', 'A fight starts whenever it is opened'), region: 'home.move', themes: HOME, ...at(-16, 14, -4.4, 3.6), sources: [1] },
    { meaning: t('الاتفاق على وقت للحديث', 'Agreeing on a time to talk'), region: 'time.together', themes: TIME, ...at(18, 10, 0, 0), sources: [3, 5] },
    { meaning: t('قلّة الوقت المشترك', 'Too little time together'), region: 'time.together', themes: TIME, ...at(18, 10, -3.6, 4.0), sources: [4] },
    { meaning: t('القلق على صحة الأم', "Worry about the mother's health"), region: 'family.care', themes: CARE, ...at(-6, -20, 0, 0), sources: [6] },
    { meaning: t('تقاسم رعاية الأهل', 'Sharing the care of family'), region: 'family.care', themes: CARE, ...at(-6, -20, 4.8, 2.2), sources: [6, 7] },
    { meaning: t('الحاجة إلى ألّا يكون المرء وحده', 'Needing not to be alone in it'), region: 'family.care', themes: CARE, ...at(-6, -20, -2.8, -4.6), sources: [7, 8] },
    { meaning: t('ذكرى البيت الأول', 'The memory of the first home'), region: 'memories', themes: MEMORY, ...at(22, -18, 0, 0), sources: [9] },
    // Rests on a line the reader cannot see: never served to the reader (D3).
    { meaning: t('معنى لا يراه القارئ', 'A meaning the reader cannot see'), region: 'memories', themes: MEMORY, ...at(22, -18, 3.0, 3.0), sources: [9, 10] },
  ],
};

/** World B — a second World of the reader, for the isolation leg: its own lines, regions and geography. */
export const SHARED_VIS_WORLD_B: SharedVisFixtureWorld = {
  name: t('العالم الاختباري الثاني', 'Fixture Second World'),
  lines: [
    { speaker: 'PEER', text: t('المشروع الجديد يحتاج قرارًا هذا الشهر', 'The new project needs a decision this month') },
    { speaker: 'SELF', text: t('أفضّل أن نبدأ صغيرًا', "I'd rather we start small") },
    { speaker: 'PEER', text: t('لنكتب ما نخاف منه أولًا', "Let's write down what we're afraid of first") },
  ],
  places: [
    { meaning: t('قرار المشروع الجديد', 'Deciding on the new project'), region: 'work.project', themes: [t('العمل', 'work'), t('القرار', 'decision')], ...at(30, 26, 0, 0), sources: [0, 1] },
    { meaning: t('البدء بخطوة صغيرة', 'Starting with a small step'), region: 'work.project', themes: [t('العمل', 'work'), t('البدايات', 'beginnings')], ...at(30, 26, -3.4, 2.8), sources: [1] },
    { meaning: t('تسمية المخاوف قبل القرار', 'Naming the fears before deciding'), region: 'fear.naming', themes: [t('الخوف', 'fear'), t('الوضوح', 'clarity')], ...at(-28, -8, 0, 0), sources: [2] },
  ],
};

export const pick = (text: Bilingual, language: ChromeLanguage): string => text[language];
