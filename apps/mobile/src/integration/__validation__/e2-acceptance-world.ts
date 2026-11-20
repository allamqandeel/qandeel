/**
 * COSMOS-FINAL-01 E-2 — the SYNTHETIC-DATA ACCEPTANCE world. VALIDATION ONLY, FIXTURE ONLY.
 *
 * PO decision 2026-11-20 (Option 2): the populated E-2 UX build. It is the S4-01 proof world (the PRODUCTION phase surface
 * and controllers over an in-memory identity and a scripted network) with every World populated at launch:
 *
 *   Personal — 13 interconnected topics (Established Threads with their Homes), Readings hosted across the session and some
 *              shared by two topics, Emerging Focuses, a 26-exchange conversation, and a timeline of 52 Moments;
 *   Shared   — two Worlds; the first has four people (the reader, two with the same initials, one sharing the reader's
 *              initials), QANDEEL lines, short and long messages, and field places read from those lines;
 *   Public   — the 29-Experience SYNTHETIC field of `s503b-visual-field.ts`, four titled topics, and discussions with posts,
 *              comments and replies by several fictional Public IDs;
 *   Understanding — eleven labelled SYNTHETIC items over the same 13 topics (`e2-acceptance-understanding.ts`; COSMOS E-2
 *              corrections 2026-11-20 section 6: the first E-2 build answered none of these routes, which is why the
 *              surface read UNAVAILABLE). Its commands answer 503 (FAILED), never a pretended success.
 *
 * COSMOS E-2 corrections (PO decisions D-2 / D-3 / D-4 / D-5, 2026-11-20): the Personal side now has TWO seeded
 * conversations (the 26-exchange one above, and an EARLIER three-exchange one where the first three topics began), the
 * server-side conversation catalog (list, New Chat with an idempotent request id, rename), per-conversation turns, temporal
 * state and projections, every topic's served NAME (its first words in the conversation — the grounding wording — or the
 * alias the reader gives it) with WHERE it began, and the user-level CURRENT Personal World of all topics now.
 *
 * Nothing here is a backend: every write answers in memory for the current session only and the seed returns on relaunch.
 * QANDEEL's own replies are labelled stand-in lines, never a model's words. Every Name and Public ID is fictional; every
 * text is SYNTHETIC validation text, never Product copy.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import { exchange, historyBody, submitBody } from '../../conversation/__fixtures__/conversation';
import { disclosureFixture, inspectionFromQuery, type AppearanceFixture, type FocusFixture, type ReadingFixture, type ThreadFixture } from '../../map/__fixtures__/disclosure';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { ConversationExchangeView, RuntimeHttpFetch } from '../../runtime-entry';
import { answerE2Understanding } from './e2-acceptance-understanding';
import { createS401ProofWorld, type S401ProofWorld, type S401SeedPost, type S401SeedWorld } from './s401-proof-world';

type Bilingual = { readonly ar: string; readonly en: string };
const t = (en: string, ar: string): Bilingual => ({ ar, en });

const SESSION = 'e2e20000-0000-4000-8000-000000000001';
/** The earlier conversation, where the first three topics began (D-5: one World across conversations). */
const EARLIER_SESSION = 'e2e20000-0000-4000-8000-000000000002';
export const E2_SESSION_IDS = Object.freeze({ current: SESSION, earlier: EARLIER_SESSION });
/** New conversations minted by "New Chat" (idempotent on the client request id), in order. */
const NEW_SESSION_PREFIX = 'e2e20000-0000-4000-8000-0000000001';

/** The fictional people. Salma Hany and Sara Hany share initials; Mariam Ali shares the reader's (Mona Adel). */
export const E2_NAMES = Object.freeze({
  SELF: t('Mona Adel', 'منى عادل'),
  PEER: t('Salma Hany', 'سلمى هاني'),
  NEWCOMER: t('Sara Hany', 'سارة هاني'),
  GUEST: t('Mariam Ali', 'مريم علي'),
});

/** The stand-in lines that answer the reader's own new messages: labelled, so nothing pretends a model replied. */
export const E2_STAND_IN = Object.freeze({
  personal: t('(E-2 synthetic build) Your message is kept for this session only; QANDEEL’s real reply needs the backend.',
    '(نسخة E-2 التجريبية) رسالتك محفوظة في هذه الجلسة فقط؛ رد قنديل الحقيقي يحتاج الخادم.'),
  shared: t('(E-2 synthetic build) QANDEEL’s real reply in this World needs the backend.',
    '(نسخة E-2 التجريبية) رد قنديل الحقيقي في هذا العالم يحتاج الخادم.'),
});

// ── Personal ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** 13 topics, two exchanges each (the reader, then QANDEEL), in the order the conversation took them. */
const TOPICS: readonly { readonly exchanges: readonly [Bilingual, Bilingual][] }[] = [
  { exchanges: [
    [t("My mother's tests came back and the doctor wants more checks.", 'نتائج تحاليل أمي ظهرت والطبيب يريد فحوصات أكثر.'), t('That sounds worrying. What did the doctor say exactly?', 'هذا مقلق. ماذا قال الطبيب بالضبط؟')],
    [t("Nothing clear yet. I keep imagining the worst at night.", 'لا شيء واضح بعد. أظل أتخيل الأسوأ في الليل.'), t('The waiting is the hardest part. Who is going with her to the checks?', 'الانتظار أصعب جزء. من سيذهب معها إلى الفحوصات؟')],
  ] },
  { exchanges: [
    [t("My brother's wedding is in March and everyone expects me to organise it.", 'زفاف أخي في مارس والكل ينتظر أن أنظّمه أنا.'), t('Everyone, or him?', 'الكل، أم هو؟')],
    [t('Mostly my aunts. He just says do whatever you think.', 'خالاتي غالبًا. هو يقول فقط افعلي ما ترينه.'), t('So the plan is yours by default. Is that something you want?', 'إذن الخطة لكِ تلقائيًا. هل هذا ما تريدينه؟')],
  ] },
  { exchanges: [
    [t('Karim asked if we should move in together this year.', 'كريم سألني إن كنا سننتقل للعيش معًا هذا العام.'), t('How did you feel when he asked?', 'بماذا شعرتِ عندما سأل؟')],
    [t('Happy, then scared about losing my own space.', 'سعيدة، ثم خائفة أن أفقد مساحتي الخاصة.'), t('Both can be true. What does your own space mean to you?', 'يمكن أن يكون الاثنان صحيحين. ماذا تعني لكِ مساحتك؟')],
  ] },
  { exchanges: [
    [t("Sara messaged me after two years of silence.", 'سارة راسلتني بعد سنتين من الصمت.'), t('What did she say?', 'ماذا قالت؟')],
    [t("Just 'I miss you'. I don't know if I'm still angry.", 'فقط «اشتقت إليكِ». لا أعرف إن كنت ما زلت غاضبة.'), t('Do you want to answer her?', 'هل تريدين أن تردّي عليها؟')],
  ] },
  { exchanges: [
    [t('The new manager changes the plan every Monday.', 'المدير الجديد يغيّر الخطة كل يوم اثنين.'), t('What does that do to your week?', 'ماذا يفعل ذلك بأسبوعك؟')],
    [t('I redo work I already finished. It drains me.', 'أعيد عملًا أنهيته. هذا يستنزفني.'), t('Have you told him what the changes cost?', 'هل أخبرته بما تكلّفه هذه التغييرات؟')],
  ] },
  { exchanges: [
    [t("They offered me the team lead role, but it's more hours.", 'عرضوا عليّ قيادة الفريق، لكنها ساعات أكثر.'), t('What pulls you toward it?', 'ما الذي يجذبك إليها؟')],
    [t('Respect, and the salary. But I would lose my evenings.', 'التقدير، والراتب. لكني سأخسر أمسياتي.'), t('What are your evenings for right now?', 'لأجل ماذا أمسياتك الآن؟')],
  ] },
  { exchanges: [
    [t("I've been dreaming of a small bakery since university.", 'أحلم بمخبز صغير منذ الجامعة.'), t('What keeps the dream alive?', 'ما الذي يبقي هذا الحلم حيًّا؟')],
    [t('The smell of bread on Fridays at my grandmother’s house.', 'رائحة الخبز أيام الجمعة في بيت جدتي.'), t('A memory more than a plan, for now?', 'ذكرى أكثر منها خطة، حتى الآن؟')],
  ] },
  { exchanges: [
    [t('There is a job in Alexandria. Moving would change everything.', 'هناك وظيفة في الإسكندرية. الانتقال سيغيّر كل شيء.'), t('Everything for you, or for Karim too?', 'كل شيء لكِ، أم لكريم أيضًا؟')],
    [t("For both of us. We haven't talked about it properly.", 'لكلينا. لم نتحدث عنها كما يجب.'), t('What would make that talk easier?', 'ما الذي قد يجعل هذا الحديث أسهل؟')],
  ] },
  { exchanges: [
    [t('I want to save for a year without feeling poor.', 'أريد أن أدّخر لمدة سنة دون أن أشعر بالفقر.'), t('What would feeling poor look like?', 'كيف يبدو الشعور بالفقر بالنسبة لك؟')],
    [t('Saying no to friends every weekend.', 'أن أرفض دعوات أصدقائي كل نهاية أسبوع.'), t('So the plan needs room for people.', 'إذن الخطة تحتاج مساحة للناس.')],
  ] },
  { exchanges: [
    [t('I sleep four or five hours and wake up tired.', 'أنام أربع أو خمس ساعات وأستيقظ متعبة.'), t('Since when?', 'منذ متى؟')],
    [t("Since my mother's tests, I think.", 'منذ تحاليل أمي، على ما أظن.'), t('So the worry follows you to bed.', 'إذن القلق يرافقك إلى السرير.')],
  ] },
  { exchanges: [
    [t('They are selling my grandfather’s house in Tanta.', 'سيبيعون بيت جدي في طنطا.'), t('What was that house to you?', 'ماذا كان ذلك البيت بالنسبة لك؟')],
    [t('Summers, the roof, his old oud on the wall.', 'الصيف، والسطح، وعوده القديم على الحائط.'), t('Would you want to keep something from it?', 'هل تريدين أن تحتفظي بشيء منه؟')],
  ] },
  { exchanges: [
    [t('I started oud lessons last month.', 'بدأت دروس العود الشهر الماضي.'), t('How is it going?', 'كيف تسير؟')],
    [t('Slowly. My fingers hurt, but it calms me.', 'ببطء. أصابعي تؤلمني، لكنه يهدّئني.'), t('Calm seems rare in your weeks lately.', 'يبدو أن الهدوء نادر في أسابيعك مؤخرًا.')],
  ] },
  { exchanges: [
    [t('I joined a Saturday running group by the Nile.', 'انضممت إلى مجموعة جري يوم السبت على النيل.'), t('What made you join?', 'ما الذي جعلك تنضمّين؟')],
    [t('I needed one morning that is only mine.', 'كنت أحتاج صباحًا واحدًا لي وحدي.'), t('One morning that is yours. That matters.', 'صباح واحد لكِ. هذا مهم.')],
  ] },
];

const EXCHANGES = TOPICS.flatMap((topic) => topic.exchanges);
const LIVE_HEAD = EXCHANGES.length * 2;
/** The SP of a topic's first Moment: exchange k holds SP 2k+1 (the reader) and 2k+2 (QANDEEL). */
const firstSp = (topic: number) => topic * 4 + 1;

const STEP = 1_000_000;
const HOMES: readonly (readonly [number, number])[] = [
  [0, 0], [1, 0], [-1, 1], [1, -1], [0, -2], [-2, 0], [2, 1], [-1, -1], [2, -1], [-2, 2], [1, 2], [-2, -2], [3, 0],
];
/**
 * The first three were established before this session. Every topic is served in its ACTIVE state: the other two
 * T-03C state names are decoded only under `projection/` and the Replay fixtures (the thread-lifecycle root contract);
 * a validation world does not spell them.
 */
const THREADS: readonly ThreadFixture[] = HOMES.map(([x, y], i) => ({
  id: `e2-topic-${String(i + 1).padStart(2, '0')}`,
  x: String(x * STEP),
  y: String(y * STEP),
  establishedSp: i < 3 ? null : firstSp(i),
  state: 'ESTABLISHED_ACTIVE',
  // Where each topic began: the first three in the EARLIER conversation (its exchanges 1 – 3), the rest here.
  origin: i < 3 ? { sessionId: EARLIER_SESSION, sp: i * 2 + 1 } : { sessionId: SESSION, sp: firstSp(i) },
}));
/** A topic's grounding wording: the reader's first words about it, whitespace-normalised, at most 80 characters (0198). */
const groundingWording = (topic: number, language: ChromeLanguage) => TOPICS[topic].exchanges[0][0][language].replace(/\s+/gu, ' ').trim().slice(0, 80);
/** The served name of every topic under the 0198 law: the reader's alias, else their grounding wording. */
function namedThreads(language: ChromeLanguage, aliases: ReadonlyMap<string, string>): ThreadFixture[] {
  return THREADS.map((thread, i) => {
    const alias = aliases.get(thread.id);
    return alias === undefined ? { ...thread, name: groundingWording(i, language), nameSource: 'GROUNDING_WORDING' } : { ...thread, name: alias, nameSource: 'USER_ALIAS' };
  });
}

/** Readings per topic (each bound inside its topic's exchanges), and the Readings two topics share (their connection). */
const HOSTED = [4, 2, 3, 2, 3, 3, 2, 3, 2, 2, 2, 2, 1];
const SHARED_READINGS: readonly { readonly id: string; readonly topics: readonly [number, number] }[] = [
  { id: 'e2-reading-worry-sleep', topics: [0, 9] },
  { id: 'e2-reading-karim-move', topics: [2, 7] },
  { id: 'e2-reading-evenings', topics: [5, 11] },
  { id: 'e2-reading-move-money', topics: [7, 8] },
  { id: 'e2-reading-grandparents', topics: [6, 10] },
  { id: 'e2-reading-oud', topics: [10, 11] },
  { id: 'e2-reading-own-time', topics: [2, 12] },
];
const APPEARANCES: readonly AppearanceFixture[] = [
  ...HOSTED.flatMap((count, topic) => Array.from({ length: count }, (_unused, index) => ({
    bindingId: `e2-binding-${topic}-${index}`,
    threadId: THREADS[topic].id,
    readingId: `e2-reading-${topic}-${index}`,
    boundSp: firstSp(topic) + (index % 4),
  }))),
  ...SHARED_READINGS.flatMap((shared, s) => shared.topics.map((topic, side) => ({
    bindingId: `e2-binding-shared-${s}-${side}`,
    threadId: THREADS[topic].id,
    readingId: shared.id,
    // Bound where the later topic of the two is spoken about, so the connection appears at that point of the timeline.
    boundSp: firstSp(Math.max(...shared.topics)) + 1,
  }))),
];
const UNGROUNDED: readonly ReadingFixture[] = [{ id: 'e2-reading-ungrounded-1', versionAtTc: 2 }, { id: 'e2-reading-ungrounded-2' }];
const READINGS: readonly ReadingFixture[] = [
  ...[...new Set(APPEARANCES.map((a) => a.readingId))].map((id, i) => ({ id, versionAtTc: i % 5 === 0 ? 2 : 1 })),
  ...UNGROUNDED,
];
const FOCUSES: readonly FocusFixture[] = [{ id: 'e2-focus-1', startedSp: 18 }, { id: 'e2-focus-2', startedSp: 34 }, { id: 'e2-focus-3', startedSp: 49 }];

/** The world as known at `tc`: nothing is disclosed before the Moment it began at. */
function worldAt(tc: number, named: readonly ThreadFixture[] = THREADS) {
  const threads = named.filter((thread) => thread.establishedSp === null || thread.establishedSp === undefined || thread.establishedSp <= tc);
  const kept = new Set(threads.map((thread) => thread.id));
  const appearances = APPEARANCES.filter((a) => a.boundSp <= tc && kept.has(a.threadId));
  const bound = new Set(appearances.map((a) => a.readingId));
  const readings = READINGS.filter((r) => bound.has(r.id) || (UNGROUNDED.includes(r) && tc >= 10));
  return { threads, appearances, readings, focuses: FOCUSES.filter((f) => f.startedSp <= tc) };
}

/** Exported for the E-2 decoding test: the disclosure every (tc, depth) answers. */
export function e2Disclosure(tc: number, depth: HistoricalSemanticDepth, inspection?: Parameters<typeof disclosureFixture>[0]['inspection'], named: readonly ThreadFixture[] = THREADS) {
  return disclosureFixture({ depth, sessionId: SESSION, tc, liveHead: LIVE_HEAD, ...worldAt(tc, named), inspection });
}
/** The EARLIER conversation's disclosure: its three topics, established there at SP 1, 3 and 5; no Reading is drawn there. */
function earlierDisclosure(tc: number, liveHead: number, depth: HistoricalSemanticDepth, inspection: Parameters<typeof disclosureFixture>[0]['inspection'], named: readonly ThreadFixture[]) {
  const threads = named.slice(0, 3).map((thread, i) => ({ ...thread, establishedSp: i * 2 + 1 })).filter((thread) => (thread.establishedSp ?? 1) <= tc);
  return disclosureFixture({ depth, sessionId: EARLIER_SESSION, tc, liveHead, threads, appearances: [], readings: [], focuses: [], inspection });
}
/** A NEW conversation's disclosure (D-5): the whole accumulated world is known from its first Moment, nothing established here. */
function newConversationDisclosure(sessionId: string, tc: number, liveHead: number, depth: HistoricalSemanticDepth, inspection: Parameters<typeof disclosureFixture>[0]['inspection'], named: readonly ThreadFixture[]) {
  return disclosureFixture({ depth, sessionId, tc, liveHead, threads: named.map((thread) => ({ ...thread, establishedSp: null })), appearances: [], readings: [], focuses: [], inspection });
}

export const E2_PERSONAL_COUNTS = Object.freeze({ topics: THREADS.length, exchanges: EXCHANGES.length, moments: LIVE_HEAD, readings: READINGS.length, conversations: 2, earlierExchanges: 3 });

// ── Shared ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const REGION_UNIT = 45_000;
const OFFSET_UNIT = 12_500;
const place = (cx: number, cy: number, dx: number, dy: number) => ({ x: Math.round(cx * REGION_UNIT + dx * OFFSET_UNIT), y: Math.round(cy * REGION_UNIT + dy * OFFSET_UNIT) });

type Speaker = S401SeedWorld['lines'][number]['speaker'];
interface E2SharedWorld {
  readonly name: Bilingual;
  readonly people: S401SeedWorld['people'];
  readonly lines: readonly { readonly speaker: Speaker; readonly text: Bilingual }[];
  readonly places: readonly { readonly meaning: Bilingual; readonly region: string; readonly themes: readonly [Bilingual, Bilingual]; readonly at: { x: number; y: number }; readonly sources: readonly number[] }[];
}
const TRIP = [t('trip', 'الرحلة'), t('planning', 'التخطيط')] as const;
const CARE = [t('family', 'العائلة'), t('care', 'الرعاية')] as const;
const MONEY = [t('money', 'المال'), t('fairness', 'العدل')] as const;
const MEMORY = [t('memories', 'الذكريات'), t('childhood', 'الطفولة')] as const;

export const E2_SHARED_FAMILY: E2SharedWorld = {
  name: t('Family Weekend', 'عطلة العائلة'),
  people: ['SELF', 'PEER', 'NEWCOMER', 'GUEST'],
  lines: [
    { speaker: 'PEER', text: t('Can we finally plan the weekend at the coast for Mama?', 'هل يمكن أن نخطط أخيرًا لعطلة الساحل من أجل ماما؟') },
    { speaker: 'SELF', text: t('Yes, but after her checks on Thursday.', 'نعم، لكن بعد فحوصاتها يوم الخميس.') },
    { speaker: 'NEWCOMER', text: t('I can drive. My car fits five if nobody brings big bags.', 'أستطيع القيادة. سيارتي تتسع لخمسة إن لم يحضر أحد حقائب كبيرة.') },
    { speaker: 'GUEST', text: t('I found a quiet place in Ras El Bar, close to the sea, with a ground-floor room so Mama does not need the stairs. It costs a bit more than the others but I think it is worth it.', 'وجدت مكانًا هادئًا في رأس البر قريبًا من البحر، فيه غرفة في الدور الأرضي حتى لا تحتاج ماما إلى السلالم. سعره أعلى قليلًا من غيره لكني أظنه يستحق.') },
    { speaker: 'QANDEEL', text: t('Two things are still open: the date after Thursday, and how to split the cost.', 'أمران ما زالا مفتوحين: الموعد بعد الخميس، وكيف تُقسم التكلفة.') },
    { speaker: 'PEER', text: t('Split equally?', 'نقسمها بالتساوي؟') },
    { speaker: 'NEWCOMER', text: t("I'm driving, so maybe I pay less?", 'أنا سأقود، فربما أدفع أقل؟') },
    { speaker: 'SELF', text: t("That's fair. Petrol counts.", 'هذا عادل. البنزين يُحسب.') },
    { speaker: 'GUEST', text: t('Okay with me.', 'موافقة.') },
    { speaker: 'QANDEEL', text: t('So: equal shares, with Sara’s petrol counted toward hers. Does anyone see it differently?', 'إذن: حصص متساوية، مع احتساب بنزين سارة من حصتها. هل يرى أحد الأمر بشكل مختلف؟') },
    { speaker: 'SELF', text: t("I'm worried Mama will get tired on the road.", 'أخاف أن تتعب ماما في الطريق.') },
    { speaker: 'PEER', text: t('We can stop halfway, at the place with the mango juice.', 'نتوقف في منتصف الطريق، عند مكان عصير المانجو.') },
    { speaker: 'NEWCOMER', text: t('The one from when we were kids! Baba always ordered two.', 'المكان الذي كنا نذهب إليه ونحن صغار! بابا كان يطلب كوبين دائمًا.') },
    { speaker: 'GUEST', text: t("I'll book the room for Friday and Saturday if the checks go well.", 'سأحجز الغرفة الجمعة والسبت إن مرّت الفحوصات بخير.') },
    { speaker: 'QANDEEL', text: t('Friday and Saturday, booked after Thursday’s checks, with a stop halfway. That covers what was open.', 'الجمعة والسبت، والحجز بعد فحوصات الخميس، مع توقف في منتصف الطريق. هذا يغطي ما كان مفتوحًا.') },
    { speaker: 'SELF', text: t('Thank you all. This means a lot to me.', 'شكرًا لكم جميعًا. هذا يعني لي الكثير.') },
  ],
  places: [
    { meaning: t('Planning the coast weekend for Mama', 'التخطيط لعطلة الساحل من أجل ماما'), region: 'trip.plan', themes: TRIP, at: place(-14, 12, 0, 0), sources: [0, 1] },
    { meaning: t('A quiet room without stairs', 'غرفة هادئة بلا سلالم'), region: 'trip.plan', themes: TRIP, at: place(-14, 12, 3.4, -2.2), sources: [3] },
    { meaning: t('Booking after the checks', 'الحجز بعد الفحوصات'), region: 'trip.plan', themes: TRIP, at: place(-14, 12, -3.8, 3.2), sources: [1, 13] },
    { meaning: t("Worry about Mama's health", 'القلق على صحة ماما'), region: 'family.care', themes: CARE, at: place(-4, -18, 0, 0), sources: [1, 10] },
    { meaning: t('Resting on the road', 'الراحة في الطريق'), region: 'family.care', themes: CARE, at: place(-4, -18, 4.4, 2.6), sources: [10, 11] },
    { meaning: t('Splitting the cost fairly', 'تقسيم التكلفة بعدل'), region: 'money.fair', themes: MONEY, at: place(18, 8, 0, 0), sources: [5, 6, 7] },
    { meaning: t('Counting the driver’s petrol', 'احتساب بنزين السائقة'), region: 'money.fair', themes: MONEY, at: place(18, 8, -3.0, 3.6), sources: [6, 7, 8] },
    { meaning: t('The mango juice stop from childhood', 'محطة عصير المانجو من الطفولة'), region: 'memories', themes: MEMORY, at: place(20, -16, 0, 0), sources: [11, 12] },
    { meaning: t('Feeling supported by the family', 'الشعور بسند العائلة'), region: 'family.care', themes: CARE, at: place(-4, -18, -3.2, -4.0), sources: [15] },
  ],
};

export const E2_SHARED_BOOKS: E2SharedWorld = {
  name: t('Book Club', 'نادي الكتاب'),
  people: ['SELF', 'PEER', 'GUEST'],
  lines: [
    { speaker: 'GUEST', text: t('Next book: something short, please. Last month nearly broke me.', 'الكتاب القادم: شيء قصير من فضلكم. الشهر الماضي كاد يهزمني.') },
    { speaker: 'PEER', text: t('A novella then. I vote for Season of Migration to the North.', 'رواية قصيرة إذن. أصوّت لـ«موسم الهجرة إلى الشمال».') },
    { speaker: 'SELF', text: t('I have read it twice. Happy to read it again.', 'قرأتها مرتين. يسعدني أن أقرأها مرة أخرى.') },
    { speaker: 'QANDEEL', text: t('One choice so far, and no one against it. Meeting date is still open.', 'اختيار واحد حتى الآن، ولا أحد يعترض. موعد اللقاء ما زال مفتوحًا.') },
  ],
  places: [
    { meaning: t('Choosing a shorter book', 'اختيار كتاب أقصر'), region: 'books.choice', themes: [t('books', 'الكتب'), t('choice', 'الاختيار')], at: place(24, 22, 0, 0), sources: [0, 1] },
    { meaning: t('Rereading an old favourite', 'إعادة قراءة كتاب محبوب'), region: 'books.choice', themes: [t('books', 'الكتب'), t('memory', 'الذاكرة')], at: place(24, 22, 3.0, 2.8), sources: [2] },
  ],
};

function seedWorld(world: E2SharedWorld, language: ChromeLanguage): S401SeedWorld {
  return {
    name: world.name[language],
    people: world.people,
    lines: world.lines.map((line) => ({ speaker: line.speaker, text: line.text[language] })),
    places: world.places.map((p) => ({ meaning: p.meaning[language], region: p.region, themes: [p.themes[0][language], p.themes[1][language]], x: p.at.x, y: p.at.y, sources: p.sources })),
  };
}

// ── Public ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const experience = (n: number) => `5503b000-0000-4000-8000-${String(n).padStart(12, '0')}`;
interface E2Post { readonly by: string | null; readonly text: Bilingual; readonly replyTo: number | null }
/** Discussions of six fixture Experiences (one per region). `by` is a fictional Public ID; null is the reader. */
export const E2_DISCUSSIONS: readonly { readonly experienceId: string; readonly posts: readonly E2Post[] }[] = [
  { experienceId: experience(1), posts: [
    { by: 'noor.sky.21', text: t('I felt this exactly when I failed my first year. My parents never said a word, and that was worse.', 'شعرت بهذا تمامًا حين رسبت في سنتي الأولى. أهلي لم يقولوا كلمة، وكان ذلك أسوأ.'), replyTo: null },
    { by: 'calm.river.08', text: t('Silence can be their way of not knowing what to say.', 'الصمت قد يكون طريقتهم حين لا يعرفون ماذا يقولون.'), replyTo: 0 },
    { by: 'noor.sky.21', text: t('Maybe. I only understood that years later.', 'ربما. لم أفهم ذلك إلا بعد سنوات.'), replyTo: 1 },
    { by: null, text: t('Thank you for writing this. It helps to know I am not the only one.', 'شكرًا لكتابة هذا. يساعدني أن أعرف أنني لست الوحيدة.'), replyTo: null },
    { by: 'olive.tree.15', text: t('Same here. Reading the comments made me call my dad.', 'وأنا أيضًا. قراءة التعليقات جعلتني أتصل بأبي.'), replyTo: 3 },
  ] },
  { experienceId: experience(11), posts: [
    { by: 'sea.wind.33', text: t('A year of burnout sounds long. What finally changed for you?', 'سنة من الإرهاق تبدو طويلة. ما الذي تغيّر أخيرًا بالنسبة لك؟'), replyTo: null },
    { by: 'calm.river.08', text: t('For me it was saying no to one meeting a day. Small, but it added up.', 'بالنسبة لي كان رفض اجتماع واحد يوميًا. شيء صغير لكنه تراكم.'), replyTo: 0 },
    { by: 'olive.tree.15', text: t('My manager only listened when I wrote things down.', 'مديري لم يستمع إلا عندما كتبت الأمور.'), replyTo: null },
  ] },
  { experienceId: experience(21), posts: [
    { by: 'olive.tree.15', text: t("I never said goodbye to my best friend either. I write him letters I don't send.", 'أنا أيضًا لم أودّع صديقي المقرب. أكتب له رسائل لا أرسلها.'), replyTo: null },
    { by: 'noor.sky.21', text: t('That is a beautiful way to keep talking to him.', 'هذه طريقة جميلة لتظل تتحدث معه.'), replyTo: 0 },
  ] },
  { experienceId: experience(31), posts: [
    { by: 'sea.wind.33', text: t('Moving cities at thirty was the best scary thing I did.', 'الانتقال إلى مدينة أخرى في الثلاثين كان أجمل شيء مخيف فعلته.'), replyTo: null },
    { by: null, text: t('I am thinking about moving to Alexandria. What was hardest?', 'أفكر في الانتقال إلى الإسكندرية. ما كان الأصعب؟'), replyTo: 0 },
    { by: 'sea.wind.33', text: t('The first three weekends alone. After that it became home.', 'أول ثلاث عطلات وحدي. بعدها صارت بيتًا.'), replyTo: 1 },
  ] },
  { experienceId: experience(41), posts: [
    { by: 'calm.river.08', text: t('Comparing myself to others stopped when I deleted two apps.', 'توقفت عن مقارنة نفسي بالآخرين حين حذفت تطبيقين.'), replyTo: null },
    { by: 'noor.sky.21', text: t('Which two? Asking for myself.', 'أي تطبيقين؟ أسأل لنفسي.'), replyTo: 0 },
  ] },
  { experienceId: experience(51), posts: [
    { by: 'olive.tree.15', text: t('Long distance taught me to say what I need clearly.', 'الحب عن بُعد علّمني أن أقول ما أحتاجه بوضوح.'), replyTo: null },
  ] },
];

// ── The world ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const respond = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

export interface E2AcceptanceWorld extends Pick<S401ProofWorld, 'config' | 'auth' | 'fetch'> {
  readonly counts: {
    readonly personalTopics: number; readonly personalExchanges: number; readonly sharedWorlds: number; readonly sharedPeople: number;
    readonly sharedMessages: number; readonly publicExperiences: number; readonly publicDiscussions: number; readonly publicPosts: number;
  };
}

export function createE2AcceptanceWorld(language: ChromeLanguage): E2AcceptanceWorld {
  const proof = createS401ProofWorld(language, { names: E2_NAMES, publicHeld: false, sharedReply: E2_STAND_IN.shared });
  // Personal: TWO seeded conversations (the reader's current one, and the earlier one where the first three topics began),
  // plus what the reader sends in any of them (answered by the labelled stand-in line) and any New Chat they open.
  interface E2Conversation { readonly id: string; readonly createdAt: string; lastTurnAt: string | null; title: string | null; readonly history: ConversationExchangeView[]; order: number }
  const seeded = (id: string, createdAt: string, lastTurnAt: string, exchanges: readonly (readonly [Bilingual, Bilingual])[]): E2Conversation => ({
    id, createdAt, lastTurnAt, title: null, order: exchanges.length,
    history: exchanges.map(([mine, reply], index) => exchange(mine[language], { reply: reply[language], order: index + 1 })),
  });
  const conversations = new Map<string, E2Conversation>([
    [SESSION, seeded(SESSION, '2026-11-19T18:00:00.000Z', '2026-11-19T21:40:00.000Z', EXCHANGES)],
    [EARLIER_SESSION, seeded(EARLIER_SESSION, '2026-11-18T19:00:00.000Z', '2026-11-18T19:30:00.000Z', TOPICS.slice(0, 3).map((topic) => topic.exchanges[0]))],
  ]);
  const minted = new Map<string, string>();
  const aliases = new Map<string, string>();
  const now = () => new Date().toISOString();
  const liveHeadOf = (c: E2Conversation) => (c.history.length === 0 ? null : c.history.length * 2);
  const catalogRow = (c: E2Conversation) => ({
    id: c.id, status: 'ACTIVE', created_at: c.createdAt, title: c.title, opening: c.history[0]?.userTurn.content ?? null, last_turn_at: c.lastTurnAt, turn_count: c.history.length * 2,
  });
  const catalog = () => Array.from(conversations.values()).sort((a, b) => (b.lastTurnAt ?? b.createdAt).localeCompare(a.lastTurnAt ?? a.createdAt)).map(catalogRow);
  const currentWorld = () => ({
    asOf: now(),
    threads: namedThreads(language, aliases).map((thread) => ({
      id: thread.id, home: { x: thread.x, y: thread.y }, name: { text: thread.name ?? null, source: thread.nameSource ?? 'NONE' }, origin: thread.origin,
    })).sort((a, b) => a.id.localeCompare(b.id)),
  });
  // Shared and Public, seeded once at launch through the proof world's own state.
  proof.seedSharedWorld(seedWorld(E2_SHARED_FAMILY, language));
  proof.seedSharedWorld(seedWorld(E2_SHARED_BOOKS, language));
  proof.publicSeed();
  proof.topics();
  for (const d of E2_DISCUSSIONS) {
    proof.seedDiscussion(d.experienceId, d.posts.map((p): S401SeedPost => ({ by: p.by, text: p.text[language], replyTo: p.replyTo })));
  }

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const [path, query = ''] = input.replace(/^https?:\/\/[^/]+/u, '').split('?');
    const params = Object.fromEntries(query.split('&').filter(Boolean).map((pair) => pair.split('=').map(decodeURIComponent) as [string, string]));
    // The conversation catalog (Slice B): the list, New Chat (idempotent on the client request id), rename.
    if (path === '/conversation/sessions' && method === 'GET') return respond(200, catalog());
    if (path === '/conversation/sessions' && method === 'POST') {
      const body = JSON.parse(init?.body ?? '{}') as { clientRequestId?: string };
      // The LAUNCH (a FRESH bootstrap) asks for its Session WITHOUT a request id. As in every earlier proof world, the
      // synthetic launch opens the reader's seeded current conversation; only New Chat (which always carries a request id)
      // makes a new one. (HONOR acceptance 2026-11-20: minting here opened an empty conversation at every launch.)
      if (body.clientRequestId === undefined) {
        const current = conversations.get(SESSION)!;
        return respond(201, { id: SESSION, status: 'ACTIVE', channel: 'TEXT', created_at: current.createdAt, updated_at: current.createdAt, last_activity_at: current.lastTurnAt ?? current.createdAt, closed_at: null });
      }
      const key = body.clientRequestId;
      let id = minted.get(key);
      if (id === undefined) {
        id = `${NEW_SESSION_PREFIX}${String(minted.size + 1).padStart(2, '0')}`;
        minted.set(key, id);
        conversations.set(id, { id, createdAt: now(), lastTurnAt: null, title: null, history: [], order: 0 });
      }
      const c = conversations.get(id)!;
      return respond(201, { id, status: 'ACTIVE', channel: 'TEXT', created_at: c.createdAt, updated_at: c.createdAt, last_activity_at: c.lastTurnAt ?? c.createdAt, closed_at: null });
    }
    const session = /^\/conversation\/sessions\/([^/]+)(\/.*)?$/u.exec(path);
    if (session !== null) {
      const [, sessionId, rest = ''] = session;
      const c = conversations.get(decodeURIComponent(sessionId));
      if (c === undefined) return respond(404, { code: 'SESSION_NOT_VISIBLE' });
      const liveHead = liveHeadOf(c);
      if (rest === '/title' && method === 'PATCH') {
        const title = ((JSON.parse(init?.body ?? '{}') as { title?: string }).title ?? '').replace(/\s+/gu, ' ').trim();
        if (title.length < 1 || title.length > 80) return respond(400, { code: 'INVALID_TITLE' });
        c.title = title;
        return respond(200, { session_id: c.id, title });
      }
      if (rest === '/turns') {
        if (method === 'GET') return respond(200, historyBody(c.history));
        const body = JSON.parse(init?.body ?? '{}') as { content?: string; idempotencyKey?: string };
        const already = c.history.find((each) => each.userTurn.idempotencyKey === body.idempotencyKey);
        if (already !== undefined) return respond(201, submitBody(already, c.id));
        c.order += 1;
        const answered = exchange(body.content ?? '', { key: body.idempotencyKey ?? null, reply: E2_STAND_IN.personal[language], order: c.order });
        c.history.push(answered);
        c.lastTurnAt = now();
        return respond(201, submitBody(answered, c.id));
      }
      if (rest === '/historical-projection') {
        if (liveHead === null) return respond(404, { code: 'SESSION_NOT_VISIBLE' });
        const tc = Math.min(liveHead, Math.max(1, Number(params.tc ?? liveHead)));
        const depth = (params.depth ?? 'WORLD') as HistoricalSemanticDepth;
        const inspection = inspectionFromQuery((name) => params[name] ?? null);
        const named = namedThreads(language, aliases);
        if (c.id === SESSION) return respond(200, e2Disclosure(tc, depth, inspection, named));
        if (c.id === EARLIER_SESSION) return respond(200, earlierDisclosure(tc, liveHead, depth, inspection, named));
        return respond(200, newConversationDisclosure(c.id, tc, liveHead, depth, inspection, named));
      }
      if (rest === '/temporal/events' || rest === '/temporal/live-focus-events') return respond(200, { sessionId: c.id, events: [] });
      if (rest === '/temporal') return respond(200, { sessionId: c.id, liveHead, liveFocus: { kind: 'NONE' }, liveFocusAtSp: null });
    }
    // Topic names (Slice A): the reader's alias, kept for this launch and served by every projection from then on.
    const alias = /^\/conversation\/threads\/([^/]+)\/alias$/u.exec(path);
    if (alias !== null && method === 'PATCH') {
      const threadId = decodeURIComponent(alias[1]);
      if (!THREADS.some((thread) => thread.id === threadId)) return respond(404, { code: 'THREAD_NOT_VISIBLE' });
      const words = ((JSON.parse(init?.body ?? '{}') as { alias?: string }).alias ?? '').replace(/\s+/gu, ' ').trim();
      if (words.length < 1 || words.length > 60) return respond(400, { code: 'INVALID_ALIAS' });
      aliases.set(threadId, words);
      return respond(200, { thread_id: threadId, alias: words });
    }
    // The CURRENT Personal World (Slice C, D-5 Option U): every topic the reader has now, wherever it began.
    if (path === '/conversation/personal-world' && method === 'GET') return respond(200, currentWorld());
    if (path.endsWith('/account/first-use')) {
      return respond(200, { displayName: E2_NAMES.SELF[language], welcomePending: false, firstConversationOpening: false });
    }
    const understanding = answerE2Understanding(method, path, language);
    if (understanding !== null) return respond(understanding.status, understanding.body);
    return proof.fetch(input, init);
  };

  return {
    config: proof.config,
    auth: proof.auth,
    fetch,
    counts: {
      personalTopics: THREADS.length,
      personalExchanges: EXCHANGES.length,
      sharedWorlds: 2,
      sharedPeople: E2_SHARED_FAMILY.people.length,
      sharedMessages: E2_SHARED_FAMILY.lines.length + E2_SHARED_BOOKS.lines.length,
      publicExperiences: 29,
      publicDiscussions: E2_DISCUSSIONS.length,
      publicPosts: E2_DISCUSSIONS.reduce((sum, d) => sum + d.posts.length, 0),
    },
  };
}
