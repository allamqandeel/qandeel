/**
 * T-08 — the ONE place any word a reader can see or hear is written, in both Product languages.
 *
 * Everything the chrome says passes through here, which is what makes the rule below checkable
 * rather than aspirational: no engineering vocabulary reaches the Product surface.
 *
 * Never spoken and never drawn:
 *
 *   - transport and projection refusal codes (`HISTORICAL_COVERAGE_UNAVAILABLE`, …). A reader is
 *     told the Product cannot show them something; the code belongs in the typed model and the logs;
 *   - raw `HistoricalFamily` tokens (`ANALYTICAL_OBJECT`, `EMERGING_FOCUS`, …) — the frozen wire
 *     vocabulary is not English, and it is not Arabic either;
 *   - raw semantic-depth enum names — the reader knows rungs as what they disclose, not as constants;
 *   - opaque identifiers of any kind: canonical ids, binding ids, locus keys, lineage tokens. None of
 *     them means anything to a reader, and several of them are internal handles.
 *
 * What IS spoken is the small set of things the frozen Product contract already treats as
 * reader-facing: a Session Position ("moment 4"), a version number of a disclosed lineage, and the
 * plain-language name of a family or a rung.
 *
 * ## Language is an input HERE, and nowhere above here
 *
 * Every function in this file takes the language as its first argument, and no function in this file
 * decides anything. Availability, membership, resolution, projection status and executor selection
 * are all settled before a word is chosen, by modules that have never heard of `ChromeLanguage`. So
 * the two languages cannot disagree about what is true — there is no code path along which they
 * could, because the answer is already computed when the wording is picked.
 *
 * The parity is structural rather than remembered: one `LanguagePack` interface holds every phrase
 * the chrome can produce, and both packs implement it. A phrase added in one language and forgotten
 * in the other is a type error.
 *
 * ## The register is VI-01's, not this task's
 *
 * T-08 establishes no language policy. It applies the frozen one.
 *
 * Every string here is **T1 · Chrome** under the VI-01 register law — navigation, controls, labels,
 * region names and accessible names — which VI-01 §3.1 assigns **neutral contemporary Arabic**, and
 * §3.2 defines as the register of a well-made contemporary Arabic product: MSA lexicon, contemporary
 * syntax, no classical particles, **no displayed case endings**, no bookish lexis. It is explicitly
 * neither فصحى تراثية nor MSA-by-default, and the warmer restrained-Egyptian register VI-01 assigns
 * to T2 voice and T3b analysis prose is not this tier and is untouched by this file.
 *
 * Two VI-01 rules do most of the work in the Arabic below:
 *
 *   - **§3.6 gender.** Fixed copy is gender-neutral wherever natural Arabic permits, and never
 *     masculine-as-default. The orthographic fact that makes this tractable is that an MSA *perfect*
 *     verb («طلبت») and a `-ك` possessive («موضعك», «لحظتك») are identical for both addressees in
 *     unvowelled script, while an MSA *imperfect* («تعاين» / «تعاينين») is not. So the addressee is
 *     carried by possessives and perfects, states are described object-first («قيد المعاينة»), and
 *     controls are verbal nouns — which VI-01 §3.6.2 names as the first tool, not as a rule.
 *   - **§7.1 retired vocabulary.** «المشهد» is deleted product-wide and is not reintroduced here.
 *
 * And two VI-01 rules do most of the work in the English:
 *
 *   - **§4 / §7.2: "context" as a noun does not ship in English.** In 2026 it reads as a model's
 *     context window, which is both wrong and the AI-dashboard register VI-01 forbids — while Arabic
 *     «سياق» is ordinary and approved. This is VI-01 §5's mandated-divergence pattern, applied: the
 *     semantic key is shared, the surface string is authored per language.
 *   - **§4 / rejection log D: "live" does not ship as user-facing English.** The concept is frozen
 *     and unchanged — this layer still consumes the Live Head and Live Focus acts by their frozen
 *     names — but the reader meets "the conversation" and "rejoin", not a realtime claim that VI-01
 *     defers to a later phase.
 *
 * ## Numerals
 *
 * Both Eastern (٠١٢٣) and Western (0123) digits are correct Arabic, and which one a reader expects
 * follows their REGION, not their language: `ar-EG` and `ar-SA` resolve Eastern, `ar-MA` and `ar-TN`
 * resolve Western. This layer's seam is a LANGUAGE and carries no region, so it has no basis on
 * which to choose Eastern digits and does not pretend to one. Western digits are used in both
 * languages, through the ONE formatter below — the point of centralising it is that a reader never
 * meets two numeral systems in one surface. **No regional numeral policy is frozen here**: a locale
 * that wants Eastern digits changes that function, and the locale provider itself is T-12's.
 *
 * A Western digit run inside Arabic is an ordinary bidi number: it renders left-to-right inside a
 * right-to-left line, which is correct, and a trailing full stop resolves to the paragraph direction,
 * which is also correct. No bidi control character is embedded in any string in this file.
 *
 * ## Type
 *
 * Arabic needs a font the app actually loads, and a line height of about 1.6 so ascenders and
 * descenders are not clipped. The line height IS set on every component that renders these words.
 * The font family is NOT set here: which families the app loads is an asset decision belonging to the
 * integration task, and this layer states the assumption rather than silently relying on it.
 *
 * The typed distinctions behind the words are untouched. Two states may legitimately share a
 * sentence — the four technical projection states say a similar thing to a reader, because to a
 * reader they ARE the same thing — while remaining different members of the union, so no code path
 * can collapse them.
 */
import type { SemanticDepth } from '../state';
import type { HistoricalFamily } from '../projection';
import type {
  ChromeLanguage,
  ContextStep,
  InspectionRenderState,
  LiveChrome,
  NoncurrentVersionState,
  PreviewChrome,
  ReturnOpportunityId,
  SpatialChrome,
  TemporalChrome,
} from './types';

/** The words for one control: what it is, and what it actually promises. */
export interface ReturnWords {
  readonly label: string;
  readonly hint: string;
}

/**
 * Every phrase the chrome can produce, in one language.
 *
 * Both packs implement it, so a phrase cannot exist in one language and be missing from the other:
 * the compiler refuses the pack rather than the reader meeting an English sentence in an Arabic
 * surface.
 */
interface LanguagePack {
  /** The frozen families, in plain language. Never the wire token. */
  readonly family: Readonly<Record<HistoricalFamily, string>>;
  /** The frozen disclosure lineage, named by what each rung discloses. Never the enum. */
  readonly depth: Readonly<Record<SemanticDepth, string>>;
  /** The structural role of one route step. Never the identity it names. */
  readonly step: Readonly<Record<ContextStep['kind'], string>>;
  /** The six frozen return acts, in the reader's language. */
  readonly returns: Readonly<Record<ReturnOpportunityId, ReturnWords>>;
  /** The neutral name of the whole chrome. It names the chrome, never the world or a state of it. */
  readonly chromeLabel: string;
  /** The neutral name of the inspection region. It names the region, never the object it describes. */
  readonly inspectionLabel: string;
  /** The neutral name of the return group. It names the controls, never a place or a state. */
  readonly returnControlsLabel: string;
  readonly contextChoiceTitle: string;
  /** Says explicitly that the order carries no preference. */
  readonly contextOrderingNote: string;
  readonly inspection: (render: InspectionRenderState) => string;
  readonly temporal: (temporal: TemporalChrome) => string;
  readonly previewLine: (preview: PreviewChrome) => string | null;
  readonly spatial: (spatial: SpatialChrome) => string;
  readonly live: (live: LiveChrome) => string | null;
  readonly contextPath: (lineage: readonly ContextStep[]) => string | null;
  readonly contextChoice: (current: boolean, boundAtMoment: number) => string;
}

/**
 * The ONE numeral formatter of the layer.
 *
 * Every reader-facing number in both languages goes through it, so a reader can never meet two
 * numeral systems in one surface — the failure this centralisation exists to prevent. Changing the
 * policy is changing this function, and a regional policy would arrive with T-12's locale provider.
 */
const digits = (value: number): string => String(value);

// ------------------------------------------------------------------------------------------
// English
// ------------------------------------------------------------------------------------------

const EN_VERSION = (versionIntent: number | null, noncurrent: NoncurrentVersionState): string => {
  const asked = versionIntent === null ? '' : ` You asked for version ${digits(versionIntent)} of it.`;
  if (noncurrent === 'SUPERSEDED') return `${asked} It had already been replaced by this moment.`;
  if (noncurrent === 'PREVALID') return `${asked} It was not yet in use at this moment.`;
  return asked;
};

// The explicit type argument is load-bearing: without it `Object.freeze` infers the literal's own
// shape first and the sentence builders below lose their contextual parameter types.
const EN: LanguagePack = Object.freeze<LanguagePack>({
  family: Object.freeze({
    THREAD: 'a thread',
    EMERGING_FOCUS: 'an emerging focus',
    MOMENT: 'a moment',
    READING: 'a reading',
    // VI-01 §8: "material" is engineering vocabulary and does not ship. The honest description is
    // the one that carries its own provenance.
    MATERIAL: 'something you said',
    GAP: 'a gap',
    QUESTION: 'a question',
    CONFIDENCE: 'a confidence',
  }),
  depth: Object.freeze({
    WORLD: 'the whole world',
    THREAD: 'threads',
    SESSION: 'the conversation',
    ANALYTICAL_OBJECT: 'readings and findings',
    SOURCE_PROVENANCE: 'sources',
  }),
  step: Object.freeze({
    WORLD: 'the world',
    RUNG: 'a rung',
    THREAD: 'a thread',
    // VI-01 §4 / §7.2: English does not ship "context" as a noun. The place is what it is.
    THREAD_READING: 'a place',
    QUESTION_TURN: 'a question',
    OBJECT: 'here',
  }),
  returns: Object.freeze({
    BACK_ONE_STEP: Object.freeze({
      label: 'Back one step',
      // Restores a captured viewpoint. It does not claim any of the three fields will differ.
      hint: 'Restores the viewpoint your most recent step came from. It does not rejoin the conversation.',
    }),
    EXACT_RETURN: Object.freeze({
      label: 'Return to the original inspection',
      hint: 'Restores exactly the viewpoint this inspection started from.',
    }),
    RETURN_LIVE_HEAD: Object.freeze({
      label: 'Rejoin the conversation',
      hint: 'Follows the conversation as it continues. The view does not move.',
    }),
    RETURN_LIVE_FOCUS: Object.freeze({
      // One shot, from here. It is never a way to rejoin, so it promises nothing about the moment.
      label: 'Move to where attention is now',
      hint: 'Goes once to where attention is now. The moment you are reading does not change.',
    }),
    RETURN_WORLD: Object.freeze({
      label: 'Return to the whole world',
      hint: 'Returns to the world viewpoint at the same moment you are reading.',
    }),
    GO_LIVE_AND_LOCATE: Object.freeze({
      label: 'Rejoin the conversation and move there',
      // The temporal half is owned; the spatial half is CONDITIONAL and says so. Nothing here names
      // the target, its thread, a direction, a distance, or whether a landing will exist at all.
      hint: 'Rejoins the conversation and, if its current attention can be located there, moves the view to it in the same step.',
    }),
  }),
  chromeLabel: 'Where you are',
  inspectionLabel: 'What you are inspecting',
  returnControlsLabel: 'Ways back',
  contextChoiceTitle: 'This appears in more than one place',
  contextOrderingNote: 'Listed in the order the map discloses them. The order is not a ranking.',
  inspection: (render) => {
    switch (render.kind) {
      case 'NO_INSPECTION':
        return 'Nothing is being inspected.';
      case 'RENDERABLE':
        return `You are inspecting ${EN.family[render.family]}.${EN_VERSION(render.versionIntent, render.noncurrent)}`;
      case 'IDENTITY_UNKNOWN_AT_TC':
        // No family, no name, no shape. This moment simply does not know it.
        return 'This moment does not know what you asked to inspect.';
      case 'CONTEXT_UNAVAILABLE_AT_TC':
        return `You are inspecting ${EN.family[render.family]}.${EN_VERSION(render.versionIntent, render.noncurrent)} Where you asked to see it is not part of this moment.`;
      case 'DEPTH_WITHHELD':
        // Withheld, not absent. The reader is told where it would be disclosed, in plain language.
        return `You are inspecting ${EN.family[render.family]}. Go deeper to see it: it is disclosed with ${EN.depth[render.requiredDepth]}.`;
      case 'PROJECTION_NOT_FETCHED':
        // The subject is the SHOWING, never the moment. "Has not arrived" made the sentence assert
        // that the moment itself had not happened — world truth that `NOT_FETCHED` cannot support,
        // because it means only that the client has not obtained the disclosure for this viewpoint.
        return 'This moment is not ready to show yet.';
      case 'PROJECTION_UNAVAILABLE':
        // The typed code stays in the model. A reader is never shown a transport code.
        return 'This moment cannot be shown right now.';
      case 'PROJECTION_STALE':
        return 'Catching up with where you are.';
      case 'PROJECTION_INCOHERENT':
        return 'This moment cannot be shown right now.';
      case 'INSPECTION_NOT_RESOLVED':
        return 'This view does not cover what you are inspecting.';
      case 'RESOLUTION_MALFORMED':
        return 'What you are inspecting cannot be described here.';
      default: {
        const exhaustive: never = render;
        return exhaustive;
      }
    }
  },
  temporal: (temporal) => {
    if (temporal.mode === 'FOLLOW_LIVE') {
      return temporal.liveHeadEstablished ? 'Following the conversation as it continues.' : 'The conversation has not started yet.';
    }
    return `Reading at moment ${digits(temporal.at ?? 0)}.`;
  },
  // Says two things at once, because a preview that does not deny being a commitment reads as one.
  previewLine: (preview) => (preview.status === 'IDLE' ? null : `A temporary look at moment ${digits(preview.at)}. Your position has not changed.`),
  spatial: (spatial) => (spatial.atWorldViewpoint ? 'Looking at the whole world.' : `Showing ${EN.depth[spatial.depth]}.`),
  live: (live) => (live.advancedWhileHistorical ? 'The conversation has continued since this moment.' : null),
  contextPath: (lineage) => {
    const inside = lineage.filter((step) => step.kind !== 'OBJECT' && step.kind !== 'WORLD');
    if (inside.length === 0) return null;
    return `Inside ${inside.map((step) => EN.step[step.kind]).join(', inside ')}.`;
  },
  contextChoice: (current, boundAtMoment) => (current ? 'The one you are looking through now' : `Since moment ${digits(boundAtMoment)}`),
});

// ------------------------------------------------------------------------------------------
// Arabic
// ------------------------------------------------------------------------------------------

// Perfect verbs and `-ك` possessives only: both are identical for either addressee in unvowelled
// script, which is what VI-01 §3.6.1 makes the gender policy tractable with.
const AR_VERSION = (versionIntent: number | null, noncurrent: NoncurrentVersionState): string => {
  // No back-reference pronoun («منه»): the families this follows differ in gender, so any pronoun
  // pointing back at the inspected thing would be wrong for half of them.
  const asked = versionIntent === null ? '' : ` طلبت النسخة ${digits(versionIntent)}.`;
  // «كانت قد» is the bookish pluperfect; the plain perfect carries the same fact and reads lived.
  if (noncurrent === 'SUPERSEDED') return `${asked} استبدلت قبل هذه اللحظة.`;
  if (noncurrent === 'PREVALID') return `${asked} لم تكن مستخدمة بعد عند هذه اللحظة.`;
  return asked;
};

const AR: LanguagePack = Object.freeze<LanguagePack>({
  // Nominative and undetermined: every one of these follows «قيد المعاينة:» below, so none of them
  // ever carries a displayed case ending.
  family: Object.freeze({
    THREAD: 'خيط',
    EMERGING_FOCUS: 'تركيز ناشئ',
    MOMENT: 'لحظة',
    READING: 'قراءة',
    // VI-01 §8: the provenance lives inside the name rather than in an engineering noun.
    MATERIAL: 'شيء من كلامك',
    GAP: 'فجوة',
    QUESTION: 'سؤال',
    CONFIDENCE: 'ثقة',
  }),
  depth: Object.freeze({
    WORLD: 'العالم كله',
    THREAD: 'الخيوط',
    SESSION: 'المحادثة',
    ANALYTICAL_OBJECT: 'القراءات والنتائج',
    SOURCE_PROVENANCE: 'المصادر',
  }),
  step: Object.freeze({
    WORLD: 'العالم',
    RUNG: 'درجة',
    THREAD: 'خيط',
    // VI-01 §7.2: «سياق» is ordinary Arabic and approved, where English must diverge.
    THREAD_READING: 'سياق',
    QUESTION_TURN: 'سؤال',
    OBJECT: 'هنا',
  }),
  // Verbal nouns throughout: VI-01 §3.6.2 reaches for the masdar first because it carries no
  // addressee inflection at all, and here it is also the natural word for every one of the six.
  returns: Object.freeze({
    BACK_ONE_STEP: Object.freeze({
      label: 'الرجوع خطوة واحدة',
      // The relative clause compresses to a possessive, which is what Arabic actually does here.
      hint: 'يستعيد موضعك قبل خطوتك الأخيرة. لا يعيدك إلى المحادثة الجارية.',
    }),
    EXACT_RETURN: Object.freeze({
      label: 'العودة إلى المعاينة الأصلية',
      hint: 'يستعيد بالضبط الموضع الذي بدأت منه هذه المعاينة.',
    }),
    RETURN_LIVE_HEAD: Object.freeze({
      label: 'العودة إلى المحادثة الجارية',
      hint: 'يتابع المحادثة وهي تستمر. لا يتحرك العرض.',
    }),
    RETURN_LIVE_FOCUS: Object.freeze({
      label: 'الانتقال إلى موضع الاهتمام الآن',
      hint: 'ينتقل مرة واحدة إلى موضع الاهتمام الآن. لا تتغير لحظتك.',
    }),
    RETURN_WORLD: Object.freeze({
      label: 'العودة إلى العالم كله',
      hint: 'يعود إلى العالم كله عند اللحظة نفسها.',
    }),
    GO_LIVE_AND_LOCATE: Object.freeze({
      label: 'العودة إلى المحادثة والانتقال إلى موضعها',
      hint: 'يعود إلى المحادثة الجارية، وإذا أمكن تحديد موضع الاهتمام هناك، ينقل العرض إليه في الخطوة نفسها.',
    }),
  }),
  // A region NAME, not a question: «أين أنت» is the English noun phrase read back as an
  // interrogative, which is not what a region is called in Arabic.
  chromeLabel: 'موضعك',
  inspectionLabel: 'قيد المعاينة',
  returnControlsLabel: 'طرق العودة',
  contextChoiceTitle: 'يظهر هذا في أكثر من سياق',
  // «مرتبة بالترتيب» stutters on ر-ت-ب; two distinct roots say it once and deny the ranking.
  contextOrderingNote: 'معروضة كما تكشفها الخريطة، لا حسب أفضلية.',
  inspection: (render) => {
    switch (render.kind) {
      case 'NO_INSPECTION':
        return 'لا شيء قيد المعاينة.';
      case 'RENDERABLE':
        return `قيد المعاينة: ${AR.family[render.family]}.${AR_VERSION(render.versionIntent, render.noncurrent)}`;
      case 'IDENTITY_UNKNOWN_AT_TC':
        // A moment does not "know" things — that is the English conceit read back literally. VI-01's
        // own unknown vocabulary is «غير معروف», and it states the gap without an agent.
        return 'ما طلبت معاينته غير معروف عند هذه اللحظة.';
      case 'CONTEXT_UNAVAILABLE_AT_TC':
        return `قيد المعاينة: ${AR.family[render.family]}.${AR_VERSION(render.versionIntent, render.noncurrent)} السياق الذي طلبته غير موجود في هذه اللحظة.`;
      case 'DEPTH_WITHHELD':
        // No pronoun points back at the inspected thing, so the sentence is correct whatever the
        // family's gender. Withheld, not absent: it says where disclosure begins.
        return `قيد المعاينة: ${AR.family[render.family]}. يبدأ الكشف من ${AR.depth[render.requiredDepth]}.`;
      case 'PROJECTION_NOT_FETCHED':
        // «لم تصل هذه اللحظة» made the MOMENT the subject that had not arrived. The incompleteness
        // belongs to «عرض» — the showing — and the verbal shape keeps it distinct from the nominal
        // «غير معروف» of unknown-at-TC and from «تعذّر» of a refusal.
        return 'لم يكتمل عرض هذه اللحظة بعد.';
      case 'PROJECTION_UNAVAILABLE':
        return 'تعذّر عرض هذه اللحظة الآن.';
      case 'PROJECTION_STALE':
        return 'جاري اللحاق بموضعك.';
      case 'PROJECTION_INCOHERENT':
        return 'تعذّر عرض هذه اللحظة الآن.';
      case 'INSPECTION_NOT_RESOLVED':
        return 'لا يشمل هذا العرض معاينتك.';
      case 'RESOLUTION_MALFORMED':
        return 'لا يمكن وصف معاينتك هنا.';
      default: {
        const exhaustive: never = render;
        return exhaustive;
      }
    }
  },
  temporal: (temporal) => {
    if (temporal.mode === 'FOLLOW_LIVE') {
      // Parallel to the pinned line below — «عند آخر المحادثة» against «عند اللحظة N» — so the two
      // committed stances read as two positions rather than as two different kinds of sentence.
      return temporal.liveHeadEstablished ? 'أنت عند آخر المحادثة.' : 'لم تبدأ المحادثة بعد.';
    }
    return `أنت عند اللحظة ${digits(temporal.at ?? 0)}.`;
  },
  // Bound with «و» rather than split by a full stop: the two halves are one statement, and the
  // denial is the half that stops a preview being read as a commitment.
  previewLine: (preview) => (preview.status === 'IDLE' ? null : `نظرة مؤقتة على اللحظة ${digits(preview.at)}، ولم يتغير موضعك.`),
  spatial: (spatial) => (spatial.atWorldViewpoint ? 'المعروض الآن: العالم كله.' : `المعروض الآن: ${AR.depth[spatial.depth]}.`),
  live: (live) => (live.advancedWhileHistorical ? 'استمرت المحادثة بعد هذه اللحظة.' : null),
  contextPath: (lineage) => {
    const inside = lineage.filter((step) => step.kind !== 'OBJECT' && step.kind !== 'WORLD');
    if (inside.length === 0) return null;
    // «ثم» sequences the descent. Repeating «داخل» at every step is the English shape, not the
    // Arabic one.
    return `داخل ${inside.map((step) => AR.step[step.kind]).join('، ثم ')}.`;
  },
  contextChoice: (current, boundAtMoment) => (current ? 'السياق الحالي' : `منذ اللحظة ${digits(boundAtMoment)}`),
});

const PACKS: Readonly<Record<ChromeLanguage, LanguagePack>> = Object.freeze({ ar: AR, en: EN });

/** The whole vocabulary of one language. The only way any word leaves this module. */
const pack = (language: ChromeLanguage): LanguagePack => PACKS[language];

// ------------------------------------------------------------------------------------------
// The reader-facing surface
// ------------------------------------------------------------------------------------------

/**
 * What the reader is inspecting, in one sentence.
 *
 * The branch structure is the firewall, and it is the SAME structure in both languages: only a state
 * that carries an identity can say anything about one, and the identity it says is the plain-language
 * family, never the id.
 */
export const inspectionSentence = (language: ChromeLanguage, render: InspectionRenderState): string => pack(language).inspection(render);

/** Where the reader stands in conversational time. A Session Position is reader-facing Product truth. */
export const temporalSentence = (language: ChromeLanguage, temporal: TemporalChrome): string => pack(language).temporal(temporal);

/**
 * The transient preview, or nothing at all while none is open.
 *
 * It says two things deliberately: that this is a temporary look, and that the reader's own position
 * has NOT moved. Saying only the first would let a reader conclude they had travelled.
 */
export const previewSentence = (language: ChromeLanguage, preview: PreviewChrome): string | null => pack(language).previewLine(preview);

/** The camera's own orientation, named by what the rung discloses rather than by its constant. */
export const spatialSentence = (language: ChromeLanguage, spatial: SpatialChrome): string => pack(language).spatial(spatial);

/** Everything a historical reader may be told about Live: that it moved on, and nothing about where. */
export const liveSentence = (language: ChromeLanguage, live: LiveChrome): string | null => pack(language).live(live);

/** One step of the disclosed route, as its structural role. The identity it names is never spoken. */
export const contextStepWord = (language: ChromeLanguage, step: ContextStep): string => pack(language).step[step.kind];

/**
 * The route in words: what the reader is inside, without naming anything inside it.
 *
 * The terminal step is dropped — it is the object itself, which the inspection sentence has already
 * named — so this answers "what contextualizes this" and nothing else. An empty route says nothing.
 */
export const contextPathSentence = (language: ChromeLanguage, lineage: readonly ContextStep[]): string | null =>
  pack(language).contextPath(lineage);

/**
 * How one disclosed appearance is offered.
 *
 * The only distinguishers are ones the reader already has: whether this is the one they are looking
 * through now, and the Moment the appearance was taken up at. No binding id, no Thread id, no locus
 * key. Which options can be told apart is decided from those two values in `context-orientation.ts`,
 * so it is a semantic answer and not a property of these strings.
 */
export const contextChoiceLabel = (language: ChromeLanguage, current: boolean, boundAtMoment: number): string =>
  pack(language).contextChoice(current, boundAtMoment);

export const contextChoiceTitle = (language: ChromeLanguage): string => pack(language).contextChoiceTitle;

export const contextOrderingNote = (language: ChromeLanguage): string => pack(language).contextOrderingNote;

export const orientationChromeLabel = (language: ChromeLanguage): string => pack(language).chromeLabel;

export const inspectionOrientationLabel = (language: ChromeLanguage): string => pack(language).inspectionLabel;

export const returnControlsLabel = (language: ChromeLanguage): string => pack(language).returnControlsLabel;

/**
 * The words for one return act.
 *
 * A constant of the identity in each language: no state can move them, and in particular nothing the
 * reader's own position cannot disclose can change what an act claims. Each states its OWN effect and
 * borrows no other's, because the six differ in what they do and a reader who cannot tell which one
 * they pressed has been misled. Rejoining the conversation promises no movement and moving to where
 * attention is now promises no change of moment, because those two acts are opposites; and the
 * composite states its spatial half as conditional, because at activation nobody can know whether it
 * will land.
 */
export const returnActWords = (language: ChromeLanguage, id: ReturnOpportunityId): ReturnWords => pack(language).returns[id];
