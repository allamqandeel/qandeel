/**
 * COSMOS-FINAL-01 E-2 — the SYNTHETIC «فهم قنديل» / QANDEEL Understanding of the acceptance world. VALIDATION ONLY,
 * FIXTURE ONLY (COSMOS E-2 corrections, PO directive 2026-11-20 §6).
 *
 * The E-2 review on HONOR saw «تعذّر عرض فهم قنديل» / "QANDEEL Understanding couldn't be shown". The cause is a FIXTURE
 * GAP, not a Product failure: no synthetic layer answered the `/understanding/*` routes, so the strict client read the
 * proof world's 404 and reported UNAVAILABLE — exactly what the Product does when the real backend does not answer.
 *
 * This module answers the two reads wire-legally (the shapes `understanding-api.ts` decodes strictly), from the SAME
 * 13 synthetic topics the Personal conversation holds, so the Understanding the reviewer sees is about the conversation
 * the reviewer can read:
 *
 *   GET /understanding/items        — every item below (≤ 32), in this order;
 *   GET /understanding/items/:ref   — its detail; an unknown ref is 404 (GONE), as the backend would answer.
 *
 * The commands (open / close a discussion, disagree, resolve) are NOT simulated: they answer 503, which the client reports
 * as FAILED — "not known to have been recorded" — the honest outcome of a build without a backend. Nothing here pretends
 * a model interpreted anything: every statement is hand-written SYNTHETIC validation text, carries the "(E-2 synthetic)"
 * mark in both languages, and is never Product copy. One item is deliberately WITHHELD (INTEL-TM-01, evidence under
 * review) and one is deliberately UNDER REVIEW (U3, the reader disagreed), so both presentations can be reviewed.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import type {
  UnderstandingConfidence, UnderstandingEvidenceChange, UnderstandingEvolutionKind, UnderstandingTheme,
} from '../../runtime-entry';

type Bilingual = { readonly ar: string; readonly en: string };
const t = (en: string, ar: string): Bilingual => ({ ar, en });

/** The mark every synthetic statement carries, so no screen can be mistaken for a real interpretation. */
export const E2_UNDERSTANDING_MARK = t('(E-2 synthetic) ', '(E-2 تجريبي) ');

/** A wire token: 22 characters of `[A-Za-z0-9_-]`, built from a readable stem and padded with `_`. */
const token = (stem: string): string => {
  const clean = stem.replace(/[^A-Za-z0-9_-]/gu, '-');
  return (clean + '_'.repeat(22)).slice(0, 22);
};

interface SyntheticItem {
  readonly stem: string;
  readonly theme: UnderstandingTheme;
  readonly confidence: UnderstandingConfidence;
  /** Null exactly for the withheld item. */
  readonly summary: Bilingual | null;
  readonly evidenceChange: UnderstandingEvidenceChange;
  readonly underReview: boolean;
  readonly evidence: readonly Bilingual[];
  readonly contradictions: readonly Bilingual[];
  readonly alternatives: readonly Bilingual[];
  readonly unresolved: readonly Bilingual[];
  readonly evolution: readonly [UnderstandingEvolutionKind, string][];
}

const DAY = (d: number, h = 10) => `2026-11-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`;

/** Eleven items over the thirteen E-2 topics. The quoted evidence is the reader's own synthetic lines. */
const ITEMS: readonly SyntheticItem[] = [
  {
    stem: 'E2SYN-01-mother-worry', theme: 'YOU', confidence: 'CLEAR', evidenceChange: 'NONE', underReview: false,
    summary: t("Worry about your mother's tests follows you into the night and into your sleep.", 'القلق على تحاليل أمك يرافقك إلى الليل وإلى نومك.'),
    evidence: [
      t('"I keep imagining the worst at night."', '«أظل أتخيل الأسوأ في الليل.»'),
      t('"I sleep four or five hours and wake up tired." — "Since my mother\'s tests, I think."', '«أنام أربع أو خمس ساعات وأستيقظ متعبة.» — «منذ تحاليل أمي، على ما أظن.»'),
    ],
    contradictions: [], alternatives: [],
    unresolved: [t('Who goes with her to the checks.', 'من سيذهب معها إلى الفحوصات.')],
    evolution: [['FIRST_SEEN', DAY(2)], ['SUPPORT_ADDED', DAY(9)], ['STRENGTHENED', DAY(9, 11)]],
  },
  {
    stem: 'E2SYN-02-wedding-plan', theme: 'RELATIONSHIPS', confidence: 'TAKING_SHAPE', evidenceChange: 'NONE', underReview: false,
    summary: t("The wedding plan became yours by default, mostly through your aunts' expectations.", 'خطة الزفاف صارت لكِ تلقائيًا، عبر توقعات خالاتك غالبًا.'),
    evidence: [t('"Mostly my aunts. He just says do whatever you think."', '«خالاتي غالبًا. هو يقول فقط افعلي ما ترينه.»')],
    contradictions: [], alternatives: [t('You may want the plan to be yours.', 'ربما تريدين أن تكون الخطة لكِ.')],
    unresolved: [t('Whether you want it.', 'هل تريدين ذلك.')],
    evolution: [['FIRST_SEEN', DAY(3)]],
  },
  {
    stem: 'E2SYN-03-karim-space', theme: 'RELATIONSHIPS', confidence: 'TAKING_SHAPE', evidenceChange: 'NONE', underReview: false,
    summary: t("Karim's question brought happiness first, then fear of losing your own space.", 'سؤال كريم جلب السعادة أولًا، ثم الخوف من فقدان مساحتك الخاصة.'),
    evidence: [t('"Happy, then scared about losing my own space."', '«سعيدة، ثم خائفة أن أفقد مساحتي الخاصة.»')],
    contradictions: [], alternatives: [],
    unresolved: [t('What your own space means to you.', 'ماذا تعني لكِ مساحتك.')],
    evolution: [['FIRST_SEEN', DAY(4)]],
  },
  {
    stem: 'E2SYN-04-sara-anger', theme: 'RELATIONSHIPS', confidence: 'MIXED', evidenceChange: 'NONE', underReview: true,
    summary: t('You are not sure whether you are still angry with Sara.', 'لستِ متأكدة إن كنتِ ما زلتِ غاضبة من سارة.'),
    evidence: [t('"I don\'t know if I\'m still angry."', '«لا أعرف إن كنت ما زلت غاضبة.»')],
    contradictions: [t('You disagreed with this reading (synthetic disagreement).', 'لم توافقي على هذه القراءة (اعتراض تجريبي).')],
    alternatives: [t('The anger may have passed and only the surprise remains.', 'ربما زال الغضب وبقيت الدهشة وحدها.')],
    unresolved: [t('Whether you want to answer her.', 'هل تريدين أن تردّي عليها.')],
    evolution: [['FIRST_SEEN', DAY(5)], ['YOU_DISAGREED', DAY(12)]],
  },
  {
    stem: 'E2SYN-05-manager-monday', theme: 'WORK', confidence: 'CLEAR', evidenceChange: 'NONE', underReview: false,
    summary: t("The manager's Monday changes drain you because you redo work you had finished.", 'تغييرات المدير كل اثنين تستنزفك لأنك تعيدين عملًا أنهيتِه.'),
    evidence: [t('"I redo work I already finished. It drains me."', '«أعيد عملًا أنهيته. هذا يستنزفني.»')],
    contradictions: [], alternatives: [],
    unresolved: [t('Whether you have told him what the changes cost.', 'هل أخبرته بما تكلّفه هذه التغييرات.')],
    evolution: [['FIRST_SEEN', DAY(6)], ['STRENGTHENED', DAY(8)]],
  },
  {
    stem: 'E2SYN-06-team-lead', theme: 'DECISIONS', confidence: 'MIXED', evidenceChange: 'NONE', underReview: false,
    summary: t('The team-lead role pulls you with respect and salary, and would cost you your evenings.', 'دور قيادة الفريق يجذبك بالتقدير والراتب، وسيكلّفك أمسياتك.'),
    evidence: [t('"Respect, and the salary. But I would lose my evenings."', '«التقدير، والراتب. لكني سأخسر أمسياتي.»')],
    contradictions: [t('The oud lessons and the running morning are also evening and weekend time you chose.', 'دروس العود وصباح الجري وقتٌ مسائي وأسبوعي اخترته أيضًا.')],
    alternatives: [t('The hours may matter more than the title.', 'ربما تهمّ الساعات أكثر من اللقب.'), t('The salary may serve the saving year.', 'ربما يخدم الراتب سنة الادخار.')],
    unresolved: [t('What your evenings are for right now.', 'لأجل ماذا أمسياتك الآن.')],
    evolution: [['FIRST_SEEN', DAY(7)], ['CHALLENGE_ADDED', DAY(11)], ['BECAME_MIXED', DAY(11, 12)]],
  },
  {
    stem: 'E2SYN-07-bakery-dream', theme: 'GOALS', confidence: 'TAKING_SHAPE', evidenceChange: 'NONE', underReview: false,
    summary: t("For now the bakery is a memory of your grandmother's Friday bread more than a plan.", 'المخبز الآن ذكرى خبز جدتك يوم الجمعة أكثر منه خطة.'),
    evidence: [t('"The smell of bread on Fridays at my grandmother’s house."', '«رائحة الخبز أيام الجمعة في بيت جدتي.»')],
    contradictions: [], alternatives: [], unresolved: [],
    evolution: [['FIRST_SEEN', DAY(8)]],
  },
  {
    stem: 'E2SYN-08-alexandria', theme: 'DECISIONS', confidence: 'NEEDS_MORE', evidenceChange: 'NONE', underReview: false,
    summary: t('The Alexandria job is a decision for both of you that has not been talked through yet.', 'وظيفة الإسكندرية قرار لكليكما لم يُناقَش كما يجب بعد.'),
    evidence: [t('"For both of us. We haven\'t talked about it properly."', '«لكلينا. لم نتحدث عنها كما يجب.»')],
    contradictions: [], alternatives: [],
    unresolved: [t('What would make that talk easier.', 'ما الذي قد يجعل هذا الحديث أسهل.')],
    evolution: [['FIRST_SEEN', DAY(9)]],
  },
  {
    // INTEL-TM-01: a withheld item — information it relied on is under review; no statement, no context.
    stem: 'E2SYN-09-saving-year', theme: 'GOALS', confidence: 'NEEDS_MORE', evidenceChange: 'REVIEW_PENDING', underReview: false,
    summary: null, evidence: [], contradictions: [], alternatives: [], unresolved: [],
    evolution: [['FIRST_SEEN', DAY(10)], ['WEAKENED', DAY(13)]],
  },
  {
    stem: 'E2SYN-10-calm-sources', theme: 'YOU', confidence: 'CLEAR', evidenceChange: 'NONE', underReview: false,
    summary: t('Calm comes lately from the oud and from one Saturday morning that is only yours.', 'الهدوء يأتي مؤخرًا من العود ومن صباح سبتٍ واحد لكِ وحدك.'),
    evidence: [
      t('"My fingers hurt, but it calms me."', '«أصابعي تؤلمني، لكنه يهدّئني.»'),
      t('"I needed one morning that is only mine."', '«كنت أحتاج صباحًا واحدًا لي وحدي.»'),
    ],
    contradictions: [], alternatives: [], unresolved: [],
    evolution: [['FIRST_SEEN', DAY(14)], ['SUPPORT_ADDED', DAY(15)]],
  },
  {
    stem: 'E2SYN-11-how-we-talk', theme: 'HOW_WE_TALK', confidence: 'TAKING_SHAPE', evidenceChange: 'NONE', underReview: false,
    summary: t('You answer direct questions directly and tend to name the feeling before the fact.', 'تجيبين عن الأسئلة المباشرة مباشرةً وتميلين إلى تسمية الشعور قبل الواقعة.'),
    evidence: [t('"Happy, then scared …" / "Slowly. My fingers hurt, but it calms me."', '«سعيدة، ثم خائفة…» / «ببطء. أصابعي تؤلمني، لكنه يهدّئني.»')],
    contradictions: [], alternatives: [], unresolved: [],
    evolution: [['FIRST_SEEN', DAY(6)], ['SUPPORT_ADDED', DAY(14)]],
  },
];

export const E2_UNDERSTANDING_COUNTS = Object.freeze({
  items: ITEMS.length,
  withheld: ITEMS.filter((item) => item.evidenceChange !== 'NONE').length,
  underReview: ITEMS.filter((item) => item.underReview).length,
});

const pick = (text: Bilingual, language: ChromeLanguage) => text[language];
const marked = (text: Bilingual | null, language: ChromeLanguage) => (text === null ? null : E2_UNDERSTANDING_MARK[language] + text[language]);

const summaryBody = (item: SyntheticItem, language: ChromeLanguage) => ({
  ref: token(item.stem), revision: token(item.stem.replace('E2SYN', 'E2REV')), theme: item.theme,
  summary: marked(item.summary, language), evidenceChange: item.evidenceChange, confidence: item.confidence, underReview: item.underReview,
});

const detailBody = (item: SyntheticItem, language: ChromeLanguage) => ({
  ...summaryBody(item, language),
  evidence: item.evidence.map((e) => pick(e, language)),
  contradictions: item.contradictions.map((e) => pick(e, language)),
  alternatives: item.alternatives.map((e) => pick(e, language)),
  unresolved: item.unresolved.map((e) => pick(e, language)),
  evolution: item.evolution.map(([kind, at]) => ({ kind, at })),
});

export interface SyntheticAnswer { readonly status: number; readonly body: unknown }

const ROUTE = '/understanding/items';

/**
 * Answers one `/understanding/*` request of the E-2 world, or `null` when the path is not an Understanding route.
 * Reads answer wire-legally; every command answers 503 (the client's FAILED), never a fabricated success.
 */
export function answerE2Understanding(method: string, path: string, language: ChromeLanguage): SyntheticAnswer | null {
  const at = path.indexOf(ROUTE);
  if (at < 0) return null;
  const rest = path.slice(at + ROUTE.length);
  if (method === 'GET' && rest === '') return { status: 200, body: { items: ITEMS.map((item) => summaryBody(item, language)) } };
  const [, ref, command] = /^\/([^/]+)(?:\/(.+))?$/u.exec(rest) ?? [];
  if (ref === undefined) return { status: 404, body: {} };
  const item = ITEMS.find((each) => token(each.stem) === ref);
  if (item === undefined) return { status: 404, body: {} };
  if (method === 'GET' && command === undefined) return { status: 200, body: detailBody(item, language) };
  // discussion / disagreement / disagreement/resolve: no backend answers in this build, and none is pretended.
  return { status: 503, body: { code: 'E2_SYNTHETIC_NO_BACKEND', message: 'E-2 synthetic build: this command needs the backend.' } };
}
