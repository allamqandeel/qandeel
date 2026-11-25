/**
 * INTEL-LIVE-01 CP1 — the pre-annotated corpus (A1 §6, A2 §2 / §3): synthetic Egyptian speech, no real person. Each
 * scenario is a sequence of FINAL segments (the recognizer's evidence unit) on the call clock, and an ANNOTATION of every
 * important development, written BEFORE any evaluator ran. The fake evaluator answers exactly the annotation (it proves
 * the mechanism); the real evaluator is judged against it by a human reviewer (A8′).
 *
 * Timing is derived, never tuned: a segment lasts its word count at 2.4 words per second, segments of one turn are
 * separated by 350 ms, a turn is committed 800 ms after its last word (the endpointer), QANDEEL's reply pieces follow.
 */

export type Track = 'USER' | 'QANDEEL';
export type Kind = 'TOPIC' | 'PERSON' | 'PLACE' | 'EXPERIENCE' | 'CONCERN' | 'PLAN';

/** One annotated development: what a correct reader of the speech must emit on this segment. */
export interface Development {
  readonly op: 'SET' | 'WITHDRAW';
  readonly key: string;
  readonly label: string;
  readonly kind: Kind;
  /** The scenario's existing Thread this development refers to (scenario e). */
  readonly thread?: boolean;
  /** The subject this development corrects or negates (for the reviewer). */
  readonly note?: string;
}

export interface Segment {
  readonly track: Track;
  readonly text: string;
  readonly devs: readonly Development[];
  /** Filled by `timeline`. */
  t0: number;
  t1: number;
  turn: number;
}

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly segments: Segment[];
  /** Per turn: the end of the person's speech and the commit instant (USER turns only). */
  readonly turns: Array<{ readonly index: number; readonly speechStart: number; readonly speechEnd: number; readonly commitAt: number }>;
  /** Normal operation (counted in the recall gate) or failure injection (h, i, k: misses are honest, never success). */
  readonly kind: 'NORMAL' | 'FAILURE_INJECTION';
  /** Scenario-specific facts the proof asserts. */
  readonly expect?: Record<string, unknown>;
  /** The scenario's existing Thread (scenario e): its name as COSMOS shows it. */
  readonly threadName?: string;
}

const WORDS_PER_SECOND = 2.4;
const INTRA_TURN_GAP_MS = 350;
const COMMIT_AFTER_MS = 800;
const REPLY_GAP_MS = 1_400;

const u = (text: string, ...devs: Development[]): Segment => ({ track: 'USER', text, devs, t0: 0, t1: 0, turn: 0 });
const q = (text: string, ...devs: Development[]): Segment => ({ track: 'QANDEEL', text, devs, t0: 0, t1: 0, turn: 0 });
const set = (key: string, label: string, kind: Kind, extra: Partial<Development> = {}): Development => ({ op: 'SET', key, label, kind, ...extra });
const withdraw = (key: string, label: string, kind: Kind, note?: string): Development => ({ op: 'WITHDRAW', key, label, kind, note });
const words = (text: string) => text.trim().split(/\s+/u).length;

/**
 * Lays the turns on the call clock. `turns` alternates USER turns and QANDEEL replies; a USER turn may be split by a
 * `pauseMs` (a breath inside the same turn, shorter than the endpointer's commit silence).
 */
function timeline(id: string, title: string, kind: Scenario['kind'], blocks: Array<{ readonly track: Track; readonly segs: Segment[]; readonly gaps?: Record<number, number> }>,
  extra: Partial<Scenario> = {}): Scenario {
  let clock = 1_000;
  const segments: Segment[] = [];
  const turns: Scenario['turns'] = [];
  let turnIndex = 0;
  for (const block of blocks) {
    if (block.track === 'USER') turnIndex += 1;
    const start = clock;
    block.segs.forEach((seg, i) => {
      if (i > 0) clock += block.gaps?.[i] ?? INTRA_TURN_GAP_MS;
      seg.t0 = clock;
      seg.t1 = clock + Math.round((words(seg.text) / WORDS_PER_SECOND) * 1_000);
      seg.turn = turnIndex;
      clock = seg.t1;
      segments.push(seg);
    });
    if (block.track === 'USER') {
      turns.push({ index: turnIndex, speechStart: start, speechEnd: clock, commitAt: clock + COMMIT_AFTER_MS });
      clock += REPLY_GAP_MS;
    } else {
      clock += 1_200;
    }
  }
  return { id, title, kind, segments, turns, ...extra };
}

// ------------------------------------------------------------------------------------------------------------- (a)
const a = timeline('a', 'early, middle and late developments, and QANDEEL\'s side', 'NORMAL', [
  { track: 'USER', segs: [
    u('بص يا قنديل، الأسبوع ده كان صعب عليا أوي في الشغل', set('work-pressure', 'ضغط الشغل', 'CONCERN')),
    u('المدير بقى بيطلب مني حاجات كتير في نفس الوقت'),
    u('وكل يوم بقعد لحد الساعة تسعة بالليل في المكتب'),
    u('وأنا حاسس إني مش ملاحق على أي حاجة خالص'),
    u('حتى الأكل بقيت باكله على المكتب وأنا شغال'),
    u('والزمايل كمان مضغوطين زيي بالظبط فمحدش فاضي لحد'),
    u('وبرجع البيت مش قادر أتكلم مع حد'),
    u('وأول ما بحط راسي على المخدة بنام على طول'),
    u('وبصحى الصبح وأنا لسه تعبان كأني ما نمتش'),
    u('المهم يعني، الحمد لله على كل حال'),
    u('وعلى فكرة، أختي الصغيرة فرحها الشهر الجاي', set('sister-wedding', 'فرح الأخت الشهر الجاي', 'EXPERIENCE')),
    u('وماما مشغولة جدًا في التحضيرات بتاعة الفرح'),
    u('وطالبة مني أساعدها في حجز القاعة والمصور'),
    u('وأنا مش عارف هلاقي وقت لده إمتى أصلًا'),
    u('بس طبعًا لازم أكون جنبهم في الموضوع ده'),
    u('هي أختي الوحيدة وفرحانين بيها جدًا'),
    u('والعريس راجل محترم وعيلته ناس كويسين'),
    u('وكلنا مبسوطين بيه الحمد لله'),
    u('فاليومين دول دماغي رايحة جاية بين الشغل والفرح'),
    u('ومش لاقي وقت أقعد فيه مع نفسي شوية'),
    u('وبصراحة بقالي فترة بفكر أسيب القاهرة وأعيش في إسكندرية', set('move-alexandria', 'الانتقال لإسكندرية', 'PLAN')),
    u('الحياة هناك أهدى والبحر قريب'),
  ] },
  { track: 'QANDEEL', segs: [
    q('فاهمك، أسبوع مزدحم بالشغل وتحضيرات فرح أختك في نفس الوقت.'),
    q('وفكرة إسكندرية دي جديدة، إيه اللي بيشدك ليها أكتر؟', set('alexandria-question', 'سؤال عن إسكندرية', 'PLAN')),
  ] },
]);

// ------------------------------------------------------------------------------------------------------------- (b)
const b = timeline('b', 'more than 40 seconds without a meaningful change', 'NORMAL', [
  { track: 'USER', segs: [
    u('النهارده عملت أكل في البيت لأول مرة من فترة طويلة', set('home-cooking', 'الطبخ في البيت', 'EXPERIENCE')),
    u('عملت رز ومكرونة وفراخ في الفرن'),
    u('وكان الأكل طعمه حلو الحمد لله'),
    u('يعني مش أحسن حاجة في الدنيا بس كويس'),
    u('الرز كان مستوي مظبوط المرة دي'),
    u('والفراخ اتحمرت حلو من برة'),
    u('والمكرونة كانت عادية يعني'),
    u('أنا مش طباخ شاطر أوي بس بحاول'),
    u('وبحب أعمل الأكل بإيدي ساعات'),
    u('خصوصًا لما يكون عندي وقت زي النهارده'),
    u('فقضيت حوالي ساعتين في المطبخ'),
    u('وكان الموضوع لطيف ومريح'),
    u('وبعد ما خلصت أكلت وأنا بتفرج على التليفزيون'),
    u('وكان يوم هادي يعني'),
    u('ده كل اللي حصل تقريبًا'),
    u('أكلة حلوة في البيت ويوم هادي'),
    u('مفيش حاجة تانية مهمة'),
    u('بس حبيت أحكيلك'),
    u('عشان كان يوم لطيف بصراحة'),
    u('وأنا مبسوط إني عملت الأكل بنفسي'),
  ] },
]);

// ------------------------------------------------------------------------------------------------------------- (c)
const c = timeline('c', 'three developments within six seconds', 'NORMAL', [
  { track: 'USER', segs: [
    u('امبارح بالليل كنت قاعد لوحدي في البيت'),
    u('وكنت بتفرج على ماتش الكورة'),
    u('وفجأة أخويا جه من السفر', set('brother-returned', 'رجوع الأخ من السفر', 'PERSON')),
    u('ومعاه خطيبته', set('brother-fiancee', 'خطيبة الأخ', 'PERSON')),
    u('وقالوا الفرح في الصيف', set('brother-wedding-summer', 'فرح الأخ في الصيف', 'PLAN')),
    u('وقعدنا نتكلم للصبح تقريبًا'),
    u('وكانت قعدة حلوة أوي'),
  ], gaps: { 3: 250, 4: 250 } },
]);

// ------------------------------------------------------------------------------------------------------------- (d)
const d = timeline('d', 'a correction and a negation', 'NORMAL', [
  { track: 'USER', segs: [
    u('عندي مقابلة شغل الأسبوع الجاي'),
    u('وهسافر القاهرة عشانها يوم الحد', set('interview-trip-cairo', 'سفر للقاهرة لمقابلة شغل', 'PLAN')),
    u('وحاجز القطر من دلوقتي'),
    u('ولسه بجهز الورق المطلوب'),
    u('لا استنى، غلطت، المقابلة مش في القاهرة، المقابلة في إسكندرية',
      withdraw('interview-trip-cairo', 'سفر للقاهرة لمقابلة شغل', 'PLAN', 'correction: the city was wrong'),
      set('interview-trip-alexandria', 'سفر لإسكندرية لمقابلة شغل', 'PLAN')),
    u('فلازم أغير حجز القطر'),
    u('وكمان كنت ناوي أروح الجيم بكرة الصبح', set('gym-tomorrow', 'الجيم بكرة', 'PLAN')),
    u('بقالي أسبوعين ما رحتش'),
    u('بس لأ، مش هروح الجيم خلاص، رجلي بتوجعني من امبارح',
      withdraw('gym-tomorrow', 'الجيم بكرة', 'PLAN', 'negation'),
      set('leg-pain', 'وجع في الرجل', 'CONCERN')),
    u('فهرتاح الكام يوم دول'),
  ] },
]);

// ------------------------------------------------------------------------------------------------------------- (e)
const e = timeline('e', 'a reference to an existing Thread and a new subject', 'NORMAL', [
  { track: 'USER', segs: [
    u('صباح الخير يا قنديل'),
    u('النهارده الدنيا هادية شوية'),
    u('رجعت أفكر تاني في موضوع الشغل الجديد في البنك', set('bank-job', 'الشغل الجديد في البنك', 'TOPIC', { thread: true })),
    u('لسه ما ردوش عليا لحد دلوقتي'),
    u('بس قلبي حاسس إن فيه أمل'),
    u('وعلى فكرة، بدأت أتعلم عزف الجيتار من أسبوع', set('learning-guitar', 'تعلم الجيتار', 'EXPERIENCE')),
    u('بتعلم من فيديوهات على النت'),
    u('وصوابعي بتوجعني شوية بس مبسوط'),
  ] },
], { threadName: 'الشغل الجديد في البنك' });

// ------------------------------------------------------------------------------------------------------------- (f)
// The development arrives while the previous admission is in flight (350 ms after the segment before it).
const f = timeline('f', 'important evidence arriving during an in-flight evaluation', 'NORMAL', [
  { track: 'USER', segs: [
    u('كنت بكلم صاحبي محمد امبارح في التليفون'),
    u('وكنا بنتكلم عن الدراسة والامتحانات'),
    u('وقالي إنه'),
    u('اتقبل في منحة في ألمانيا', set('friend-scholarship-germany', 'منحة صاحبي في ألمانيا', 'EXPERIENCE')),
    u('وهيسافر بعد شهرين'),
    u('وأنا فرحتله جدًا'),
  ] },
]);

// ------------------------------------------------------------------------------------------------------------- (g)
const g = timeline('g', 'important evidence in the last FINAL before the commit', 'NORMAL', [
  { track: 'USER', segs: [
    u('رحت للدكتور النهارده عشان الضهر'),
    u('وكشف عليا وطلب أشعة'),
    u('وعملت الأشعة في نفس اليوم'),
    u('وأهم حاجة إن الدكتور قال لازم أعمل عملية في الضهر', set('back-surgery', 'عملية في الضهر', 'CONCERN')),
  ] },
], { expect: { tail: true } });

// ------------------------------------------------------------------------------------------------------------- (h)
const h = timeline('h', 'a resume mid-turn (another instance, then the same instance)', 'FAILURE_INJECTION', [
  { track: 'USER', segs: [
    u('عايز أحكيلك عن جارنا الجديد', set('new-neighbour', 'الجار الجديد', 'PERSON')),
    u('هو لسه ساكن جنبنا من أسبوع'),
    u('وطلع بيشتغل مهندس في نفس شركتي', set('neighbour-same-company', 'الجار في نفس الشركة', 'TOPIC')),
    u('وده كان صدفة غريبة جدًا'),
    u('وعزمني على قهوة يوم الخميس', set('coffee-thursday', 'قهوة يوم الخميس', 'PLAN')),
    u('وأنا وافقت طبعًا'),
    u('وناوي أخد معايا كيكة من عند ماما'),
  ] },
], { expect: { handoverAfterSegment: 2, sameInstanceAfterSegment: 4 } });

// ------------------------------------------------------------------------------------------------------------- (i)
const i = timeline('i', 'the evaluator fails for fifteen seconds, then recovers', 'FAILURE_INJECTION', [
  { track: 'USER', segs: [
    u('الصبح صحيت متأخر النهارده'),
    u('وكان عندي اجتماع مهم الساعة عشرة', set('important-meeting', 'اجتماع مهم الساعة عشرة', 'PLAN')),
    u('فلبست بسرعة ونزلت جري'),
    u('والمواصلات كانت زحمة جدًا'),
    u('ووصلت متأخر ربع ساعة'),
    u('والمدير اتضايق مني قدام الناس', set('manager-upset', 'المدير اتضايق', 'CONCERN')),
    u('وأنا اتكسفت جدًا'),
    u('بس بعد الاجتماع اعتذرتله'),
    u('وقالي خلاص ولا يهمك'),
    u('فارتحت شوية الحمد لله'),
    u('وبعدين قررت أنام بدري النهارده', set('sleep-early', 'النوم بدري', 'PLAN')),
    u('عشان ما يتكررش تاني'),
  ] },
], { expect: { outageFrom: 'segment 1 arrival', outageMs: 15_000 } });

// ------------------------------------------------------------------------------------------------------------- (j)
// A turn longer than the 600-word window whose last FINAL corrects a subject introduced in its first 20 s.
const ELABORATION = [
  'وكان فرحان جدًا بالموضوع ده', 'وكل يوم كان بيحكي عنه تقريبًا', 'وأنا كنت بسمعه وأقول له ربنا يوفقك',
  'وهو كان بيجهز ورقه بالراحة', 'وكان بيسأل كل الناس اللي يعرفهم', 'وكنا بنتكلم في الموضوع ده كتير',
  'يعني الموضوع كان واخد كل تفكيره', 'وكان بيقول إن دي فرصة كبيرة', 'وأنا كنت بشجعه على طول',
  'وبقول له إن ربنا هيكرمه', 'وهو كان بيضحك ويقول إن شاء الله', 'وكان كل حاجة ماشية تمام لحد قريب',
  'وهو كان مستني الرد بفارغ الصبر', 'وكان بيشيك على الإيميل كل ساعة', 'والعيلة كلها كانت عارفة بالموضوع',
  'وكلنا كنا مستنيين معاه', 'وكان بيحلم باليوم اللي هيسافر فيه', 'وبيتخيل الحياة هناك هتبقى عاملة إزاي',
  'وكان بيتكلم عن الموضوع ده في كل قعدة', 'وأنا كنت بسمعه وأنا مبسوط عشانه', 'يعني بجد كان متحمس جدًا',
  'وكان مخطط لكل حاجة بالتفصيل', 'وكان بيقول هيبعتلنا صور أول ما يوصل', 'وكنا بنهزر معاه ونقول متنساناش',
  'وهو يقول مستحيل أنساكم', 'والموضوع ده فضل كده شهور', 'وكل شوية يحكيلنا حاجة جديدة عن التحضيرات بتاعته',
  'يعني ورق وتحاليل ومقابلات وكده', 'وكان صابر على كل ده', 'وكان مقتنع إن الموضوع يستاهل',
  'وأنا كنت معجب بصبره ده جدًا', 'لأني أنا مكنتش هستحمل كل ده',
];
const jSegs: Segment[] = [
  u('خليني أحكيلك عن ابن خالتي أحمد'),
  u('أحمد كان ناوي يهاجر كندا السنة دي', set('ahmed-canada', 'هجرة أحمد لكندا', 'PLAN')),
];
for (let n = 0; jSegs.length < 66; n += 1) {
  const one = ELABORATION[n % ELABORATION.length]!;
  // Every pair differs (the second index is offset by 5, then by 3 more each time the first wraps), so each FINAL is unique.
  const two = ELABORATION[(n + 5 + Math.floor(n / ELABORATION.length) * 3) % ELABORATION.length]!;
  jSegs.push(u(`${one} ${two}`));
}
jSegs.push(u('بس امبارح عرفنا إن أحمد مش مسافر كندا خلاص، الفيزا بتاعته اترفضت',
  withdraw('ahmed-canada', 'هجرة أحمد لكندا', 'PLAN', 'the early subject is negated beyond the window'),
  set('ahmed-visa-refused', 'رفض فيزا أحمد', 'CONCERN')));
const j = timeline('j', 'a late correction of an early subject beyond the 600-word window', 'NORMAL', [{ track: 'USER', segs: jSegs }],
  { expect: { windowWords: 600 } });

// ------------------------------------------------------------------------------------------------------------- (k)
const k = timeline('k', 'the emergency spend guard (set low for the test): DEGRADED, recorded as a product failure', 'FAILURE_INJECTION', [
  { track: 'USER', segs: [
    u('عايز أحكيلك عن رحلتي لأسوان', set('aswan-trip', 'رحلة أسوان', 'EXPERIENCE')),
    u('كانت أحلى رحلة عملتها في حياتي'),
    u('ركبنا مركب في النيل', set('nile-boat', 'مركب في النيل', 'EXPERIENCE')),
    u('وشفنا معبد فيلة بالليل'),
    u('وناوي أرجع هناك تاني السنة الجاية', set('aswan-return', 'الرجوع لأسوان السنة الجاية', 'PLAN')),
  ] },
], { expect: { emergencyCallSpendUsd: 0.0002 } });

export const CORPUS: readonly Scenario[] = [a, b, c, d, e, f, g, h, i, j, k];
/** The normal-operation corpus of the A8′ recall gate (A2 §2): a – g and j. */
export const RECALL_GATE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'j'];
export const corpusWords = (s: Scenario, track: Track = 'USER') => s.segments.filter((x) => x.track === track).reduce((n, x) => n + words(x.text), 0);
