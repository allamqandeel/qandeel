/**
 * I-08B3.1-A3 - the selected direction, the two finalists, and the shared content.
 *
 * WHAT THIS FILE IS NOT. It is not a thesis file. The thesis-direction decision was made by
 * the Design Director after A2R: thesis A advances alone, thesis B is retired as challenger,
 * thesis C remains retired. Neither B nor C appears anywhere in this package, by construction,
 * and `tools/a3-package.mjs` scans the archive for their values rather than trusting that.
 *
 * NOTHING HERE IS A TOKEN AND NOTHING HERE IS CANONICAL. #101010 is the sole incumbent World
 * Base and A3 is required to preserve it unless it discovers a real contradiction; it is still
 * not frozen. P1 and P2 are two candidates for one unresolved question and A3 does not choose
 * between them. The diagnostic Subtle and the diagnostic edge are proof scaffolding carried
 * over from A2 and are explicitly NON-CANONICAL.
 */
import { srgbToOklch, hexToRgb8, resolve } from './color.mjs';

/** Frozen in I-08B3.0. Reproduced, never modified. size / leading / weight. */
export const ROLES = {
  statement:    { size: 32, leading: 52, weight: 500, label: 'Meaningful Statement' },
  compactStmt:  { size: 26, leading: 42, weight: 500, label: 'Compact Meaningful Statement' },
  screenTitle:  { size: 26, leading: 42, weight: 600, label: 'Screen Title' },
  sectionTitle: { size: 20, leading: 33, weight: 600, label: 'Section Title' },
  body:         { size: 17, leading: 30, weight: 400, label: 'Primary Body' },
  supporting:   { size: 15, leading: 25, weight: 400, label: 'Supporting Body' },
  action:       { size: 14, leading: 23, weight: 500, label: 'Action / Label' },
  metadata:     { size: 12, leading: 20, weight: 400, label: 'Metadata' },
};

/**
 * THE SELECTED WORLD DIRECTION.
 *
 * Achromatic, near-black, quiet, matte, not tech-tinted, not warm/brown. World identity is
 * not required to come from hue - which is what A2 established when swapping the World for
 * three published generic near-blacks changed nothing on the screen.
 *
 * A3 does not search for another World value and does not micro-adjust this one. The brief is
 * explicit: nearby achromatic near-blacks carry no identity advantage, so generating another
 * hex would be motion without evidence.
 */
export const WORLD = '#101010';

/** Unchanged from A1 and not under test. A3 asks whether each finalist works WITH these. */
export const SECONDARY = '#afaca3';
export const TERTIARY = '#8b8982';

/**
 * THE CONTROL. The original A1 Primary. It is on the boards only to show what was gained and
 * lost relative to A1, and it is NOT a third finalist.
 */
export const CONTROL = { key: 'C', hex: '#e1ded3', name: 'CONTROL - A1 Primary', drop: 0 };

/**
 * THE TWO FINALISTS.
 *
 * Both were generated in A2 by lowering the A1 Primary in OKLCH lightness with chroma and hue
 * held, then validating against the sRGB the browser actually paints. The hexes below are the
 * ones the A3 brief names; `derivedFinalists()` regenerates them from the control by the same
 * arithmetic so the preflight can confirm the brief's values and the OKLCH derivation agree
 * rather than assuming it.
 */
export const P1 = { key: 'P1', hex: '#d8d5ca', name: 'PRIMARY P1', drop: 0.0275 };
export const P2 = { key: 'P2', hex: '#d2cfc4', name: 'PRIMARY P2', drop: 0.0475 };
export const FINALISTS = [P1, P2];

/** Control, then the two finalists, in the order every board prints them. */
export const CANDIDATES = [CONTROL, P1, P2];

/** Measured OKLCH of a displayed hex - the authority, not the authored intent. */
export const oklchOf = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255));

/**
 * Regenerate the finalists from the control, perceptually, so the brief's hexes can be
 * checked rather than trusted. Chroma and hue are held; only lightness moves.
 */
export function derivedFinalists() {
  const [L0, C0, H0] = oklchOf(CONTROL.hex);
  return FINALISTS.map((p) => ({ ...p, derived: resolve([L0 - p.drop, C0, H0], `${p.key} derived`) }));
}

/* ------------------------------------------------- non-canonical proof scaffolding ---- */

/**
 * DIAGNOSTIC SURFACE - NON-CANONICAL.
 *
 * The A3 brief permits A2's diagnostic Subtle to be reused "for proof structure only" at
 * approximately World + dL 0.035. It exists so a reading value can be judged on the two
 * surfaces it will really land on rather than on one. It is not a token, no Subtle ladder is
 * being designed here, and nothing about surface hierarchy is being decided.
 */
export const DIAG_SUBTLE_DELTA_L = 0.035;
export const diagSubtle = () => {
  const [L0, C0, H0] = oklchOf(WORLD);
  return resolve([L0 + DIAG_SUBTLE_DELTA_L, C0, H0], 'diagnostic subtle');
};

/**
 * TEMPORARY ACHROMATIC DIAGNOSTIC PROBE - NON-CANONICAL.
 *
 * Carried unchanged from A2. This is NOT QANDEEL Light and must never be read as a proposal
 * for it. Chroma is exactly 0, so it carries no hue at all and cannot be mistaken for a brand
 * value; there is no glow, no bloom, no gradient and no aura. Its only job is to occupy the
 * lightness band ABOVE the reading and show whether anything perceptible is still available
 * up there once the Primary has come down.
 *
 * Its entitlement stops at what it renders: four solid fills. It says nothing about levels
 * for text, nothing about small marks, and nothing about a token ladder.
 */
export const PROBE_L = [0.92, 0.95, 0.98, 1.00];
export const probeSwatches = () => PROBE_L.map((L) => resolve([L, 0, NaN], `probe L${L}`));

/* ------------------------------------------------------------------ shared copy ------ */
/**
 * ONE body of Arabic, used identically by the control and both finalists in every board and
 * every environment. A difference between a P1 board and a P2 board can therefore only be the
 * Primary colour.
 *
 * Carried from A2 with two paragraphs added to `deep`, because A3.3 asks for SUSTAINED
 * analytical reading and four paragraphs is a sample rather than a session. The addition is
 * applied identically to both finalists and to the control, so fairness is unaffected.
 *
 * Digits are Arabic-Indic throughout: `designing-arabic-frontends` section 3 requires one
 * numeral system per user per view and names the mixed case as the observed failure.
 */
export const COPY = {
  /* 1. THE QUIET CORE - a calm personal conversation */
  quiet: {
    title: 'محادثة هادئة',
    turns: [
      { who: 'ana', text: 'حاسس إني بعيد القرار ده في دماغي أكتر من اللازم، رغم إني خلاص اخترت.' },
      { who: 'qandeel', text: 'اللي بيتكرر هنا مش مجرد تردد قبل الاختيار.\nأنت غالبًا بتكون أهدأ قبل القرار، وبعد ما القرار يبقى حقيقي يبدأ عقلك يدور على الاحتمالات اللي ممكن تكون فاتتك.' },
      { who: 'ana', text: 'وده معناه إن القرار غلط؟' },
      { who: 'qandeel', text: 'لا. معناه إن طريقة تقييمك للقرار اتغيرت بعد الالتزام بيه، مش إن القرار نفسه اتغير.' },
    ],
    meta: 'آخر تحديث ١٤ سبتمبر، ٨:٣٤ م',
    metaSecond: 'قبل ١٢ دقيقة',
  },

  /* 2. THE PROPRIETARY WORLD - living analysis map.
     Every label restates something the conversation above actually contains. No relationship
     is invented and nothing is asserted that the reader has not already seen said. */
  map: {
    title: 'خريطة التحليل',
    lede: 'ما ظهر عبر المحادثات الأخيرة، موضوعًا كما ورد.',
    nodes: [
      { t: 'التقييم بعد الالتزام', s: 'ظهر في أربع محادثات', d: 'سبتمبر' },
      { t: 'الهدوء قبل الاختيار', s: 'ظهر في ثلاث محادثات', d: 'سبتمبر' },
      { t: 'البحث عن الاحتمالات الفائتة', s: 'ظهر في أربع محادثات', d: 'أغسطس وسبتمبر' },
      { t: 'قابلية التراجع', s: 'ظهر في محادثتين', d: 'أغسطس' },
      { t: 'إعادة فتح السؤال نفسه', s: 'ظهر في ثلاث محادثات', d: 'سبتمبر' },
      { t: 'غياب معلومات جديدة', s: 'ظهر في محادثة واحدة', d: 'سبتمبر' },
    ],
    edgeNote: 'الخطوط تصل ما ورد في المحادثة نفسها.',
    foot: 'ستة موضوعات، من إحدى عشرة محادثة',
  },

  /* 3. THE INTELLECTUAL TEST - long-form Arabic analytical reading */
  deep: {
    title: 'قراءة تحليلية',
    statement: 'أنت لا تتردد قبل القرار.\nأنت تتردد بعد أن يصبح حقيقيًا.',
    section: 'ما الذي يتغير بعد الالتزام',
    paras: [
      'خلال المحادثات الأخيرة ظهر نمط متكرر: عندما يكون القرار قابلًا للتراجع، يظل التوتر منخفضًا نسبيًا. لكن عندما يصبح القرار نهائيًا، يبدأ تركيزك ينتقل من تقييم القرار نفسه إلى البحث عن الاحتمالات التي ربما لم تنتبه لها.',
      'هذا لا يعني أن القرار صحيح أو خاطئ. الأهم أن طريقة تقييمك للقرار تتغير بعد الالتزام به، وهذا قد يدفعك إلى إعادة فتح السؤال نفسه أكثر من مرة حتى لو لم تظهر معلومات جديدة.',
      'الفرق بين الحالتين ليس في كمية المعلومات المتاحة، بل في الكلفة التي صار عليك أن تتحملها إن تبين أن الاختيار لم يكن الأفضل. قبل الالتزام كانت الاحتمالات الأخرى مجانية؛ بعده صار لكل احتمال منها ثمن.',
      'ولهذا فإن عودتك إلى السؤال بعد إغلاقه ليست بالضرورة ترددًا. في كثير من الأحيان هي محاولة لتسعير ما فات، لا لإعادة الاختيار.',
      /* These two paragraphs are NEW at A3 - see the header note. They were composed in Arabic
         structure and then checked against `writing-eloquent-arabic`'s eight failure modes,
         which changed both of them: the trailing time adverbial (ولا تكلف شيئًا الآن) became
         ولا ثمن لها بعد, the English-shaped conditional (حين يظل / أما حين) became ما دام /
         فإذا with the verb leading, and the bare-pronoun opening (هو وصف) became the idiomatic
         ليس ... وإنما, which also bound two sentences the full stop had left choppy. */
      'ويمكن ملاحظة الأثر نفسه في الاتجاه المعاكس: ما دام الباب مفتوحًا فنادرًا ما تعود إلى السؤال، لأن إعادة النظر متاحة في أي وقت ولا ثمن لها بعد. فإذا أُغلق الباب صارت إعادة النظر هي الشيء الوحيد المتبقي، فتشغل المساحة التي كان يشغلها الاختيار.',
      'وما تقدّم ليس حكمًا على قرار بعينه، وإنما وصفٌ لنمط ظهر في إحدى عشرة محادثة خلال شهرين، وقد يتغيّر إذا تغيّرت الشروط التي أنتجته. والغرض منه أن يظلّ قابلًا للمراجعة، لا أن يكون خلاصة نهائية.',
    ],
    supporting: 'القراءة الحالية مرتبطة بسياق من محادثة سابقة، لكنها ما زالت قابلة للمراجعة.',
    meta: 'أحد عشر مصدرًا من المحادثات',
  },

  /* 4. THE BORING-SCREEN TEST - ordinary utility content, deliberately undramatic */
  util: {
    title: 'الإعدادات',
    groups: [
      {
        name: 'الحساب',
        rows: [
          { l: 'الاسم', v: 'محمد علام' },
          { l: 'البريد', v: 'mohamed@example.com', ltr: true },
          { l: 'اللغة', v: 'العربية' },
        ],
      },
      {
        name: 'البيانات',
        rows: [
          { l: 'المحادثات المحفوظة', v: 'إحدى عشرة محادثة' },
          { l: 'آخر نسخة احتياطية', v: '١٤ سبتمبر، ٨:٣٤ م' },
          { l: 'حذف كل المحادثات', v: 'غير متاح الآن', disabled: true, note: 'يتم إعداد نسخة احتياطية' },
        ],
      },
      {
        name: 'عن التطبيق',
        rows: [
          { l: 'الإصدار', v: '١٫٠٫٠' },
          { l: 'شروط الاستخدام', v: '' },
        ],
      },
    ],
    foot: 'التغييرات تُحفظ تلقائيًا.',
  },
};
