/**
 * I-08B3.1-F1 — THE ACCESSIBLE SEMANTIC PROJECTION.
 *
 * WHAT THIS IS NOT. It is not permission to turn the Living Analysis Map into a list. The
 * visible Map stays spatial, stays atmospheric, and is not simplified by one pixel for anyone.
 * The projection is a PARALLEL semantic layer over the same objects — which is the only
 * arrangement in which both statements can be true at once: the Map is a world, and a reader
 * who cannot see it reaches the same analytical truth.
 *
 * THE FOUR DECISIONS THAT DO THE WORK, each of which is a refusal.
 *
 *   1. TRAVERSAL IS BY KIND, NOT BY GEOMETRY. VoiceOver's own default is the locale's reading
 *      order, which for an Arabic UI is right-to-left and top-to-bottom. That is a GEOMETRIC
 *      order, and geometry in QANDEEL means nothing — d2-world's PRESENTATION_CONTRACT says so
 *      for every spatial property it has. So the default must be overridden rather than
 *      inherited, and the axis it is replaced with is KIND: topics, connections, patterns,
 *      insights. A reader chooses an axis and moves within it.
 *
 *   2. NO RANKING IS INVENTED — AND I-08B3.1-F1R HAD TO CORRECT HOW THIS WAS SAID.
 *
 *      F1 described the order within an axis as "the Product's own stable identity order". No
 *      supplied Product contract establishes the authored array order as a semantic identity
 *      order, so that sentence gave a technical accident Product authority it does not have. It
 *      was a smaller version of exactly the failure this axis exists to avoid.
 *
 *      The rule now, in three steps, implemented by `neutralOrder` below:
 *
 *        a. GROUP BY KIND. Kind is a legitimate Product distinction — a topic is not a pattern —
 *           and the accessibility model needs it to offer an axis at all.
 *        b. WITHIN AN EQUAL, UNRANKED GROUP: if the disclosed view supplies a canonical order
 *           for that kind, use it. `V.canonicalOrder` is the seam and it is deliberately null
 *           today; if a runtime later has a canonical presentation order, it arrives there.
 *        c. OTHERWISE use an EXPLICITLY NON-SEMANTIC deterministic order: ascending Unicode
 *           code-point order of the object's stable id. It is stable, it is reproducible, it is
 *           independent of the order anything happened to be authored in — and it means nothing,
 *           which is the requirement. Peers stay EQUAL and UNRANKED.
 *
 *      `orderedBy` is written into the output in those terms, and check R-02 recomputes the
 *      order from the ids and compares it to what was emitted, so the declaration is verified
 *      against the algorithm rather than read as a promise.
 *
 *   3. PEERS STAY PEERS. Several legitimate readings of the same material are announced as
 *      peers. The projection may not select a main one, because no Product authority ranks them.
 *
 *   4. THE LIGHT IS NOT ANNOUNCED. It is a transient carrying nothing the settled state does not
 *      also carry — the same property that lets the settled state be read with no animation at
 *      all. What is announced is the RESULT, once.
 *
 * AND THE ONE THING THIS FILE PROVES RATHER THAN ASSERTS. The projection is rendered as a real
 * page and its ACCESSIBILITY TREE IS READ BACK OUT OF THE BROWSER over the DevTools protocol.
 * Every name, role and relationship below is taken from what the engine computed, not from what
 * the generator intended. A missing accessible name is therefore a failure this file can
 * detect, and did detect while it was being written.
 *
 * WHAT THIS IS NOT EVIDENCE OF, stated plainly: a browser accessibility tree is not VoiceOver
 * and is not TalkBack. No screen reader was run. No device was used. F1_KNOWN_LIMITATIONS.md
 * carries that, and it is the single largest gap in this package.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { truth, state } from './f1-scene.mjs';
import { syntheticView } from './f1-fixture.mjs';
/* TOPICS is imported for ONE purpose: the disclosure probe needs a name that IS recoverable from
   somewhere other than V, so that "the projection did not recover it" is a real result rather
   than a statement about a string nothing knows. The projector itself never touches it. */
import { TOPICS } from '../vendor/d2r/scene/d2-world.mjs';
import { findChrome, launch, openPage } from './f1-cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

/**
 * THE FOUR TRAVERSAL AXES. In HTML these are landmark regions with headings, which is a real
 * mechanism on both platforms: VoiceOver's heading rotor and TalkBack's heading navigation both
 * traverse them, and neither requires an API React Native does not have.
 *
 * THE PLATFORM GAP, NAMED RATHER THAN DESIGNED AROUND: Apple's VoiceOver guidance recommends
 * the CUSTOM ROTOR (UIAccessibilityCustomRotor / AccessibilityRotorEntry) for exactly this, and
 * REACT NATIVE DOES NOT EXPOSE IT. Headings are the closest mechanism RN can express today. The
 * difference matters — a rotor lets a reader jump between members of one kind from anywhere,
 * while headings require walking to the group first — and F1_PLATFORM_MAPPING.md records it as
 * NOT CURRENTLY EXPOSED with the native API it would need.
 */
export const AXES = [
  { kind: 'topic', heading: 'المواضيع', role: 'list' },
  { kind: 'connection', heading: 'العلاقات', role: 'list' },
  { kind: 'pattern', heading: 'الأنماط', role: 'list' },
  { kind: 'insight', heading: 'ما فُهِم', role: 'list' },
];

/**
 * ONE ANALYTICAL OBJECT -> ONE ACCESSIBLE ROW.
 *
 * Every field is either read from the Product's own truth or is a fixed sentence frame. Nothing
 * here computes a value the Product does not have — which is what §12's "do not invent runtime
 * data" means in practice. Where the Product has no authority for a field, the field is ABSENT
 * rather than filled with a plausible default.
 */
/**
 * THE ANNOUNCED VOCABULARY. A value the view supplies is announced in words only if the
 * projection HAS a word for it. It does not guess, and it does not read a raw enum aloud.
 *
 * This is the other half of the F1R correction: `epistemicText` used to be
 * `o.epistemic === 'hypothesis' ? 'فرضية' : 'ملاحَظ'`, an expression that announces "observed"
 * for an object whose epistemic status the view never stated. Announcing a status nobody
 * asserted is inventing runtime data, and it is the failure mode §12 of the original brief
 * names.
 */
export const EPISTEMIC_WORDS = Object.freeze({ observed: 'ملاحَظ', hypothesis: 'فرضية' });
export const TEMPORAL_WORDS = Object.freeze({ current: 'الآن', historical: 'سابق' });

/**
 * THE DISCLOSURE BOUNDARY (I-08B3.1-F1R2, REV-03) — AND THE FALLBACK IT REPLACES.
 *
 * This function used to be `(id) => T.objects.find(x => x.id === id)?.name ?? id`. The `?? id` is
 * the defect. An undisclosed reference would have been announced to a screen-reader user as its
 * RAW TECHNICAL IDENTIFIER — content the visual expression, which simply draws nothing there,
 * never shows. An accessible expression that discloses MORE than the default is as serious a
 * failure as one that discloses less, and it is the harder one to notice because every test that
 * looks for loss passes.
 *
 * So: a name resolves only from the SAME disclosed V, and resolves to `null` otherwise. There is
 * no other source. It does not reach into d2-world's TOPICS, it does not reach into the visual
 * scene, and it does not fall back to anything.
 */
const disclosedIndex = (T) => new Map((T.objects ?? []).map((x) => [x.id, x]));
const disclosedName = (id, index) => (index.has(id) ? index.get(id).name : null);

/**
 * WHAT CANONICAL V IS REQUIRED TO GUARANTEE, AND WHY THE PROJECTOR DOES NOT RELY ON IT.
 */
export const REFERENTIAL_INTEGRITY = Object.freeze({
  upstreamInvariant:
    'Canonical V is required to be referentially closed: every id a disclosed object references — a Connection endpoint, a Pattern member — must itself be disclosed in the SAME V. A view that references an object it does not disclose is malformed.',
  projectorBehaviour:
    'FAIL CLOSED, AND DO NOT RELY ON THE INVARIANT. Where a reference is not disclosed, the projection announces no substitute: no raw id, no name recovered from any other source, no member count, and no prose describing the relation. The inconsistency is recorded as a detectable referential-integrity failure instead of being turned into a sentence.',
  why:
    'A projector that trusts an invariant it cannot check leaks the first time the invariant is broken — and the thing it leaks is precisely the content the disclosure model was built to withhold.',
  contractToken: 'qandeel.accessibility.projection.disclosure-boundary',
});

export function row(o, T, index = disclosedIndex(T)) {
  /* every reference below resolves through THIS and through nothing else */
  const nameOf = (id) => disclosedName(id, index);
  const base = {
    id: o.id,
    kind: o.kind,
    /* ACCESSIBLE NAME — the object's own name, never a description of its appearance. */
    name: o.kind === 'insight' ? o.text : o.name,
    /* ROLE — what it IS, in the projection's vocabulary. A Product role, not an ARIA role;
       the ARIA mapping is a separate column so the two can never be confused for each other. */
    productRole: { topic: 'موضوع', connection: 'علاقة', pattern: 'نمط', insight: 'فهم' }[o.kind],
    ariaRole: 'listitem',
  };
  /* EVERY SEMANTIC FIELD BELOW IS CARRIED ONLY IF THE VIEW SUPPLIED IT. There is no `??` and no
     ternary default here, which is what makes "the projection preserves V" checkable: check A-02
     supplies a view with a field missing and requires the field to be missing here too. */
  if (o.epistemic !== undefined) {
    base.epistemic = o.epistemic;
    if (EPISTEMIC_WORDS[o.epistemic]) base.epistemicText = EPISTEMIC_WORDS[o.epistemic];
  } else {
    /**
     * ABSENCE REMAINS ABSENCE (I-08B3.1-F1R2, REV-02).
     *
     * F1R announced «غير مُحدَّد» — UNSPECIFIED — here, and defended it as reporting the absence
     * of a status rather than being one. The independent review was right that this contradicts
     * the rule in the same document: WHERE V SAYS NOTHING, THE PROJECTION SAYS NOTHING.
     *
     * «غير مُحدَّد» is an authored semantic statement. It says the Product state is UNSPECIFIED,
     * and the absence of a field does not mean that. The field may be not applicable to this
     * object family, not disclosed at this depth, unavailable, or simply not supplied — and the
     * accessibility layer has no authority to choose among those meanings. Choosing one was a
     * smaller version of exactly the invention this layer exists to prevent.
     *
     * So NOTHING is announced. The row records that V supplied no value, as METADATA about the
     * view — never spoken, never rendered, and not readable as a status — because the parity
     * matrix has to be able to tell "the view stated nothing" from "the projection lost it".
     *
     * IF QANDEEL EVER NEEDS AN EXPLICIT UNKNOWN / UNSPECIFIED / NOT DETERMINED STATE, CANONICAL V
     * SUPPLIES IT AS A VALUE and the projection carries it like any other. It is not the
     * projection's to manufacture from a gap.
     */
    base.epistemicSuppliedByV = false;
  }
  if (o.temporal !== undefined) {
    base.temporal = o.temporal;
    if (TEMPORAL_WORDS[o.temporal]) base.temporalText = TEMPORAL_WORDS[o.temporal];
  }
  if (o.actionable !== undefined) base.actionable = o.actionable;
  /* RELATIONSHIP — stated in words wherever it is carried visually by adjacency, a line or a
     shared mark. Apple: "Examine your app for places where relationships among elements are
     visual only. Then, describe these relationships to VoiceOver." */
  if (o.kind === 'connection') {
    const fromName = nameOf(o.from), toName = nameOf(o.to);
    if (fromName !== null && toName !== null) {
      base.relationship = `علاقة بين «${fromName}» و«${toName}»`;
      base.from = o.from;
      base.to = o.to;
    } else {
      /* FAIL CLOSED. No sentence, and the undisclosed endpoint's id does not travel: only an
         endpoint V actually discloses is carried. The failure is COUNTED so it is detectable,
         and the count is of undisclosed references, never a list of them. */
      if (fromName !== null) base.from = o.from;
      if (toName !== null) base.to = o.to;
      base.referenceIntegrity = {
        complete: false,
        undisclosedReferences: (fromName === null ? 1 : 0) + (toName === null ? 1 : 0),
        withheld: 'RELATIONSHIP NOT DESCRIBED. One or both endpoints are not disclosed in V, and the projection may not name, identify, count or paraphrase an object the view did not disclose.',
      };
    }
  }
  if (o.kind === 'pattern') {
    /* THE LARGEST ACCESSIBILITY OBLIGATION THE SYSTEM CREATES. A locus and four links is not
       readable to anyone who cannot see them, so it has to become a sentence — and the sentence
       has to name a SET rather than a sequence, because membership is unordered and a sentence
       that reads them out in an order is a sentence that has invented one. «تجمع» + a list
       joined by و carries no ordinal reading in Arabic. */
    const names = o.members.map(nameOf);
    if (names.every((n) => n !== null)) {
      base.relationship = `نمط يجمع ${arabicCount(o.members.length, { one: 'موضوعًا', two: 'موضوعين', plural: 'مواضيع', many: 'موضوعًا' })}: ${names.map((n) => `«${n}»`).join(' و')}`;
      base.members = [...o.members];
      base.membersAreASet = true;
    } else {
      /* FAIL CLOSED, AND THE COUNT GOES TOO. Naming three members of a four-member set discloses
         that a fourth exists, which is the membership the disclosure boundary withholds. So the
         sentence is not written at all, and only members V actually discloses are carried. */
      base.members = o.members.filter((id) => nameOf(id) !== null);
      base.membersAreASet = true;
      base.referenceIntegrity = {
        complete: false,
        undisclosedReferences: names.filter((n) => n === null).length,
        withheld: 'MEMBERSHIP NOT DESCRIBED. At least one member is not disclosed in V, and a sentence naming the rest would disclose that the undisclosed one exists.',
      };
    }
  }
  if (o.kind === 'insight') {
    base.sublabel = o.name;
  }
  return base;
}

/**
 * ARABIC COUNTED NOUNS, BECAUSE A SUMMARY LINE IS COPY AND COPY IS A CARRIER HERE.
 *
 * The first version of this file wrote «١ علاقة، ١ نمط» by concatenating a number and a noun,
 * which is an English sentence in Arabic words: Arabic does not put a numeral before a single
 * thing. The rules applied are the ordinary ones — 1 takes the noun alone (or with واحد/واحدة
 * agreeing in gender), 2 takes the dual, 3–10 take the PLURAL, and 11+ take the singular
 * accusative. Only the first three cases can arise in a summary of one world's objects, and
 * the fourth is implemented rather than left to fail silently if a world ever gets large.
 *
 * `f` marks a feminine noun. Getting that wrong is the failure the Arabic guidance names for
 * validation copy — «كلمة المرور مطلوبة» against «رقم الهاتف مطلوب» — and it is the same
 * failure here.
 */
export function arabicCount(n, { one, two, plural, many, f = false }) {
  if (n === 1) return `${one} ${f ? 'واحدة' : 'واحد'}`;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${plural}`;
  return `${n} ${many ?? one}`;
}

/**
 * THE DETERMINISTIC NEUTRAL ORDER, as an algorithm rather than as a sentence.
 *
 * `codePointCompare` is used rather than `localeCompare` on purpose: a locale collation is a
 * reading convention, it differs between platforms and ICU versions, and it would make the order
 * of an Arabic id set depend on which device the reader is holding. A code-point comparison is
 * the same everywhere and claims nothing about the objects.
 *
 * Returns the ordered items AND the rule that produced them, so the caller cannot describe the
 * order in words this function did not choose.
 */
export const ORDER_RULES = Object.freeze({
  canonical: 'a canonical presentation order supplied by the disclosed view V for this kind',
  neutral: 'NON-SEMANTIC: ascending Unicode code-point order of the object\'s stable id. Deterministic and reproducible, and it carries NO Product meaning — these items are EQUAL and UNRANKED. It is not importance, not confidence, not merit, not truth, not priority, not recency, not position, not size.',
});

const codePointCompare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function neutralOrder(items, kind, view) {
  const canonical = view?.canonicalOrder?.[kind];
  if (Array.isArray(canonical) && canonical.length) {
    const rank = new Map(canonical.map((id, i) => [id, i]));
    /* anything the canonical order does not mention keeps the neutral rule, after the rest —
       silently dropping it would be the projection deciding an object is not worth reading */
    const known = items.filter((o) => rank.has(o.id)).sort((x, y) => rank.get(x.id) - rank.get(y.id));
    const rest = items.filter((o) => !rank.has(o.id)).sort((x, y) => codePointCompare(x.id, y.id));
    return { items: [...known, ...rest], rule: 'canonical', orderedBy: ORDER_RULES.canonical, unmentionedFellBackToNeutral: rest.length };
  }
  return { items: [...items].sort((x, y) => codePointCompare(x.id, y.id)), rule: 'neutral', orderedBy: ORDER_RULES.neutral, unmentionedFellBackToNeutral: 0 };
}

export function projection(st = {}, view = null) {
  const S = state(st);
  const T = truth(S, view);
  const index = disclosedIndex(T);
  const axes = AXES.map((a) => {
    const ord = neutralOrder(T.objects.filter((o) => o.kind === a.kind), a.kind, T);
    return {
      ...a,
      peers: 'EQUAL, UNRANKED',
      orderRule: ord.rule,
      orderedBy: ord.orderedBy,
      items: ord.items.map((o) => row(o, T, index)),
    };
  });
  /* REFERENTIAL INTEGRITY, REPORTED AT THE TOP so an inconsistent V is DETECTABLE rather than
     silently becoming prose. It names the DISCLOSED objects that carry a broken reference — which
     V discloses anyway — and never the undisclosed target. */
  const withBrokenRefs = axes.flatMap((a) => a.items).filter((i) => i.referenceIntegrity?.complete === false);
  return {
    provenance: T.provenance,
    /* the bounded-proof scope travels with the projection too (REV-01) */
    scope: T.scope ?? null,
    unmappedFieldsDetected: T.unmappedFields ?? [],
    referentialIntegrity: {
      complete: withBrokenRefs.length === 0,
      upstreamInvariant: REFERENTIAL_INTEGRITY.upstreamInvariant,
      projectorBehaviour: REFERENTIAL_INTEGRITY.projectorBehaviour,
      disclosedObjectsWithUndisclosedReferences: withBrokenRefs.map((i) => i.id),
      undisclosedReferenceCount: withBrokenRefs.reduce((n, i) => n + i.referenceIntegrity.undisclosedReferences, 0),
    },
    canonicalOrderSuppliedByV: T.canonicalOrder,
    implementationSeam: 'If a runtime later supplies a canonical presentation order for a kind, it arrives as V.canonicalOrder[kind] and neutralOrder() uses it. Until then the order is the declared non-semantic one. I-08B3.1-F1R does not invent a canonical order here.',
    world: { name: T.worldName, key: T.world, role: 'region' },
    /* the first thing a reader receives, per Apple's VoiceOver guidance that "the title is the
       first information someone receives from an assistive technology when arriving on a page" */
    title: `${T.worldName} — خريطة التحليل`,
    summary: [
      arabicCount(T.counts.topic, { one: 'موضوع', two: 'موضوعان', plural: 'مواضيع', many: 'موضوعًا' }),
      arabicCount(T.counts.connection, { one: 'علاقة', two: 'علاقتان', plural: 'علاقات', many: 'علاقةً', f: true }),
      arabicCount(T.counts.pattern, { one: 'نمط', two: 'نمطان', plural: 'أنماط', many: 'نمطًا' }),
      'و' + arabicCount(T.counts.insight, { one: 'فهم جديد', two: 'فهمان جديدان', plural: 'مفاهيم جديدة', many: 'فهمًا جديدًا' }),
    ].join('، ') + '.',
    axes,
    notAnnounced: [
      ['QANDEEL LIGHT', 'a transient that carries nothing the settled state does not also carry'],
      ['the ambient contours', 'atmosphere — PRESENTATION_CONTRACT declares every one of their properties `encodes: null`'],
      ['depth planes and positions', 'geometry carries no analytical meaning in QANDEEL, so announcing it would invent one'],
      ['hue', 'the six atmosphere hues are isoluminant by construction and measure 1.02:1 against each other — colour distinguishes nothing here even visually'],
      /* added by I-08B3.1-F1R2 */
      /* THE WITHDRAWN WORD IS DELIBERATELY NOT QUOTED HERE. It is named in the source, in the
         revision record and in the docs; inside the SHIPPED PAGE it appears nowhere at all, so
         check A-05 can assert exactly that — the strongest form of "it is not announced" is that
         the string is not in the document. */
      ['a semantic value V did not supply', 'ABSENCE REMAINS ABSENCE. A field the view did not supply is not announced in any form. I-08B3.1-F1R announced an UNSPECIFIED word here and I-08B3.1-F1R2 withdrew it: the absence of a field does not mean the Product state is unspecified, and the projection has no authority to choose among not-applicable, not-disclosed-at-this-depth, unavailable and not-supplied. An explicit unknown state, if QANDEEL needs one, is supplied by canonical V as a value'],
      ['anything V does not disclose', 'a Connection endpoint or a Pattern member that is not in V is not named, not identified, not counted and not paraphrased — and never announced as a raw id'],
    ],
  };
}

/* ---------------------------------------------------------------- the rendered page ----- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * «غير مُحدَّد» — UNSPECIFIED. THIS STRING EXISTS HERE ONLY SO THAT A CHECK CAN PROVE IT IS NOT
 * ANNOUNCED ANYWHERE.
 *
 * I-08B3.1-F1R announced it for an object whose epistemic status the view never supplied, and
 * argued that reporting an absence is not asserting a status. It is. It asserts that the Product
 * state is UNSPECIFIED, when the field may equally be not applicable, not disclosed at this depth,
 * unavailable, absent from this object family, or simply not supplied — and the accessibility
 * layer may not choose among those. Withdrawn in I-08B3.1-F1R2. If QANDEEL needs an explicit
 * unknown state, canonical V supplies it as a VALUE.
 *
 * The constant is kept, unused by the composer, because a forbidden string with exactly one home
 * is a string a guard can look for. Check A-05 requires it to appear in no accessible label and
 * nowhere in the rendered projection page.
 */
export const FORBIDDEN_UNSPECIFIED_ANNOUNCEMENT = 'غير مُحدَّد';
/** «لا يمكن فتحه» — cannot be opened. A reader who cannot see that a row is inert must be told,
 *  or they will spend their attention trying to activate it. This one IS a supplied value:
 *  `actionable: false` is a fact the view asserted, not a gap the projection filled. */
export const NOT_ACTIONABLE = 'لا يمكن فتحه';

/** ONE composer for the accessible name, used by the page that writes it AND by the check that
 *  looks for it in the engine's tree. Two copies of this expression is how a page and its
 *  verifier end up agreeing about a sentence neither of them produces.
 *
 *  A value is spoken only if the view SUPPLIED it and the projection HAS a word for it. There is
 *  no `??` tail here any more, and that missing tail is REV-02. */
export const epistemicSpoken = (it) => it.epistemicText ?? null;
export const accessibleLabel = (it) =>
  [it.productRole, it.name, it.relationship, epistemicSpoken(it), it.temporalText, it.actionable === false ? NOT_ACTIONABLE : null]
    .filter(Boolean).join('، ');

export function projectionPage(st = {}, view = null) {
  const P = projection(st, view);
  const item = (it) => {
    const bits = [];
    bits.push(`<span class="pr">${esc(it.productRole)}</span>`);
    bits.push(`<span class="nm">${esc(it.name)}</span>`);
    if (it.relationship) bits.push(`<span class="rel">${esc(it.relationship)}</span>`);
    const epText = epistemicSpoken(it);
    if (epText) bits.push(`<span class="ep">${esc(epText)}</span>`);
    if (it.temporalText) bits.push(`<span class="tm">${esc(it.temporalText)}</span>`);
    if (it.actionable === false) bits.push(`<span class="na">${esc(NOT_ACTIONABLE)}</span>`);
    /* The accessible name is composed EXPLICITLY rather than left to the engine's default
       concatenation, so that what a reader hears is what this file decided they hear. */
    const label = accessibleLabel(it);
    const tag = it.actionable === true ? 'button type="button"' : 'span';
    const close = it.actionable === true ? 'button' : 'span';
    return `      <li role="listitem"><${tag} aria-label="${esc(label)}" data-qandeel-object-id="${esc(it.id)}" data-qandeel-kind="${esc(it.kind)}">${bits.join(' ')}</${close}></li>`;
  };
  return `<!doctype html>
<html dir="rtl" lang="ar" data-qd-ready="0">
<head><meta charset="utf-8"><title>${esc(P.title)}</title>
<style>
@font-face{font-family:'Estedad';src:url('file:///${join(PKG, 'fonts', 'Estedad[wght].ttf').replace(/\\/g, '/')}') format('truetype');font-weight:100 900;font-display:block}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#101010;color:#d8d5ca;font-family:'Estedad',sans-serif;line-height:1.7;width:390px;padding:16px}
h1{font-size:15px;font-weight:700;margin-block-end:4px}
p.sum{font-size:12px;color:#afaca3;margin-block-end:14px}
h2{font-size:13px;font-weight:600;color:#d8d5ca;margin-block:14px 6px}
ul{list-style:none}
li{padding-block:7px;border-block-end:1px solid #181818}
button{all:unset;display:block;cursor:pointer}
span[aria-label]{all:unset;display:block}
.pr{font-size:10px;color:#8b8982}
.nm{display:block;font-size:12px;font-weight:600;color:#d8d5ca}
.rel{display:block;font-size:11px;color:#afaca3}
.ep,.tm,.na{font-size:10px;color:#8b8982;margin-inline-end:8px}
</style></head>
<body>
<main aria-labelledby="h1">
  <h1 id="h1">${esc(P.title)}</h1>
  <p class="sum">${esc(P.summary)}</p>
${P.axes.map((a) => `  <section aria-labelledby="ax-${a.kind}">
    <h2 id="ax-${a.kind}">${esc(a.heading)}</h2>
    <ul role="list">
${a.items.map(item).join('\n')}
    </ul>
  </section>`).join('\n')}
</main>
<script type="application/json" id="qd-projection">${JSON.stringify(P)}</script>
<script>document.fonts.ready.then(function(){document.documentElement.setAttribute('data-qd-ready','1');});</script>
</body></html>
`;
}

/* ------------------------------------------------------- read the tree back out of Chrome */
export async function readAXTree(outDir) {
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, 'projection.html');
  writeFileSync(file, projectionPage());
  const chrome = findChrome();
  if (!chrome) return { state: 'UNVERIFIABLE — no Chrome on this host' };
  const browser = await launch({ chrome, port: 9437 });
  try {
    const p = await openPage(browser, { url: pathToFileURL(file).href, width: 390, height: 1400, dpr: 2 });
    await browser.send('Accessibility.enable', {}, p.sessionId);
    const { nodes } = await browser.send('Accessibility.getFullAXTree', {}, p.sessionId);
    const png = await p.shot({ full: true });
    writeFileSync(join(outDir, 'projection.png'), png);
    await p.close();
    return { state: 'READ', nodes };
  } finally {
    await browser.close();
  }
}

/**
 * THE CHECKS. Each one is a statement about the tree the ENGINE produced.
 */
export function checkTree(nodes, P) {
  const named = nodes.filter((n) => n.name && n.name.value && String(n.name.value).trim());
  const byName = new Set(named.map((n) => String(n.name.value)));
  const expected = P.axes.flatMap((a) => a.items).map((it) => ({
    id: it.id,
    kind: it.kind,
    label: accessibleLabel(it),
  }));
  const missing = expected.filter((e) => !byName.has(e.label));

  const headings = nodes.filter((n) => n.role?.value === 'heading').map((n) => String(n.name?.value ?? ''));
  const axisHeadings = P.axes.map((a) => a.heading);
  const missingHeadings = axisHeadings.filter((h) => !headings.includes(h));

  /* THE RELATIONSHIP CHECK. A pattern must reach the reader as a SENTENCE naming its members,
     not as a node with four invisible links. This asserts the members' names are inside the
     accessible name the engine computed. */
  const pattern = expected.find((e) => e.kind === 'pattern');
  const patternNode = pattern ? named.find((n) => String(n.name.value) === pattern.label) : null;
  const patternMembers = P.axes.find((a) => a.kind === 'pattern')?.items[0]?.members ?? [];
  const memberNames = P.axes.find((a) => a.kind === 'topic')?.items.filter((t) => patternMembers.includes(t.id)).map((t) => t.name) ?? [];
  const patternStatesMembers = patternNode ? memberNames.every((m) => String(patternNode.name.value).includes(m)) : false;

  /* THE CONNECTION CHECK. Source and destination, both named, in the accessible name. */
  const conn = expected.find((e) => e.kind === 'connection');
  const connNode = conn ? named.find((n) => String(n.name.value) === conn.label) : null;

  /* THE ORDER, VERIFIED AGAINST THE ALGORITHM RATHER THAN AGAINST ITS DESCRIPTION.
     The emitted order is recomputed here from the ids alone and compared. A projection that
     declared the neutral rule and then emitted authored array order would fail this. */
  const orderAgrees = P.axes.map((a) => {
    const emitted = a.items.map((it) => it.id);
    const recomputed = a.orderRule === 'neutral'
      ? [...emitted].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
      : emitted;
    return { kind: a.kind, rule: a.orderRule, emitted, recomputed, agrees: emitted.join('|') === recomputed.join('|') };
  });

  /* NO RANK MAY APPEAR, under any name. The projection is checked for the vocabulary of ranking
     rather than for one field, because the failure this forbids is a value, not a spelling. */
  const RANK_WORDS = ['rank', 'score', 'weight', 'confidence', 'priority', 'importance', 'strength', 'relevance', 'position', 'index'];
  const rankFields = [];
  for (const a of P.axes) for (const it of a.items) {
    for (const k of Object.keys(it)) if (RANK_WORDS.some((w) => k.toLowerCase().includes(w))) rankFields.push({ kind: a.kind, id: it.id, field: k });
  }

  /* PEERS ARE DECLARED EQUAL AND UNRANKED, and the wording gives the order no Product meaning:
     the old "the Product's own stable identity order" is forbidden by name. */
  const orderWordingClean = P.axes.every((a) =>
    a.peers === 'EQUAL, UNRANKED' &&
    !/identity order/i.test(a.orderedBy) &&
    !/Product's own/i.test(a.orderedBy) &&
    (a.orderRule === 'canonical' || /NON-SEMANTIC/.test(a.orderedBy)));

  /* THE PROBE. A deliberately wrong expectation, so the "missing" branch is demonstrated on
     every run rather than only when something breaks. */
  const probe = { label: 'THIS ACCESSIBLE NAME DOES NOT EXIST', detectedAsMissing: !byName.has('THIS ACCESSIBLE NAME DOES NOT EXIST') };

  return {
    axNodes: nodes.length,
    namedNodes: named.length,
    orderAgrees,
    orderWordingClean,
    rankFieldsFound: rankFields,
    expectedObjects: expected.length,
    missingAccessibleNames: missing,
    headingsFound: headings,
    missingAxisHeadings: missingHeadings,
    patternStatesItsMembersInWords: patternStatesMembers,
    connectionStatesSourceAndDestination: !!connNode,
    probe,
    pass:
      missing.length === 0 &&
      missingHeadings.length === 0 &&
      patternStatesMembers &&
      !!connNode &&
      orderAgrees.every((o) => o.agrees) &&
      orderWordingClean &&
      rankFields.length === 0 &&
      probe.detectedAsMissing,
  };
}

/* ============================================================ THE ORDERING PLANTED TESTS == */
/**
 * PERTURB THE SOURCE ARRAY AND PROVE NOTHING MOVES.
 *
 * The concern the independent review raised is that authored array order was being described as
 * Product meaning. The strongest answer is not a better sentence; it is a projection whose output
 * does not depend on that order at all. So: reverse the view's object array, project it, and
 * require the emitted traversal order and every semantic fact to be unchanged.
 *
 * And the probe underneath it, because a test that only ever sees a correct implementation is a
 * sentence: the SAME comparison is run against an ordering function that sorts by a fabricated
 * strength, and it must be rejected. If reversing the array could not change anything at all, the
 * first half would pass for the wrong reason.
 */
export function orderingProbes() {
  const base = syntheticView();
  const reversed = { ...base, objects: [...base.objects].reverse() };
  const shuffled = { ...base, objects: [...base.objects].sort((a, b) => (a.id > b.id ? -1 : 1)) };

  const emitted = (v) => projection({}, v).axes.map((a) => ({ kind: a.kind, ids: a.items.map((i) => i.id).join('|') }));
  const facts = (v) => projection({}, v).axes.flatMap((a) => a.items).map((i) =>
    `${i.id}:${i.epistemic ?? 'ABSENT'}:${i.temporal ?? 'ABSENT'}:${i.actionable ?? 'ABSENT'}:${i.relationship ?? ''}`).sort().join('\n');

  const b = emitted(base), r = emitted(reversed), s = emitted(shuffled);
  const orderStable = JSON.stringify(b) === JSON.stringify(r) && JSON.stringify(b) === JSON.stringify(s);
  const factsStable = facts(base) === facts(reversed) && facts(base) === facts(shuffled);

  /* THE PROBE: an ordering that IS a ranking, fed to the same comparison. A fabricated strength
     is attached to each object and the items are sorted by it descending — the exact thing the
     projection may never do — and the comparison must notice the order changed. */
  const ranked = (v) => {
    const strength = (id) => [...id].reduce((n, c) => n + c.codePointAt(0), 0);
    return AXES.map((a) => ({
      kind: a.kind,
      ids: v.objects.filter((o) => o.kind === a.kind).sort((x, y) => strength(y.id) - strength(x.id)).map((o) => o.id).join('|'),
    }));
  };
  const probeRejected = JSON.stringify(b) !== JSON.stringify(ranked(base));

  return {
    what: 'The source array is reversed and re-sorted, and the projection is recomputed.',
    traversalOrderUnchanged: orderStable,
    semanticFactsUnchanged: factsStable,
    emitted: b,
    probe: {
      input: 'the same comparison against an order sorted by a fabricated per-object strength',
      rejected: probeRejected,
    },
    pass: orderStable && factsStable && probeRejected,
  };
}

/**
 * THE ABSENT-FIELD TEST for REV-02: a view that omits a semantic field must produce a projection
 * that omits it, and a view that supplies a DIFFERENT value must produce a projection carrying
 * that different value. Both halves are needed — a projection that dropped every field would
 * pass the first alone.
 */
export function fixturePreservationProbes() {
  const v = syntheticView();
  const P = projection({}, v);
  const items = new Map(P.axes.flatMap((a) => a.items).map((i) => [i.id, i]));
  const supplied = new Map(v.objects.map((o) => [o.id, o]));

  const rows = [...supplied.keys()].map((id) => {
    const s = supplied.get(id), i = items.get(id);
    return {
      id,
      epistemic: { supplied: s.epistemic ?? 'ABSENT', projected: i?.epistemic ?? 'ABSENT' },
      temporal: { supplied: s.temporal ?? 'ABSENT', projected: i?.temporal ?? 'ABSENT' },
      actionable: { supplied: s.actionable ?? 'ABSENT', projected: i?.actionable ?? 'ABSENT' },
    };
  });
  const preserved = rows.every((r) =>
    r.epistemic.supplied === r.epistemic.projected &&
    r.temporal.supplied === r.temporal.projected &&
    r.actionable.supplied === r.actionable.projected);

  /* the fixture must actually VARY, or "preserved" is satisfied by a hardcode */
  const varies = {
    epistemic: new Set(rows.map((r) => r.epistemic.supplied)).size > 1,
    temporal: new Set(rows.map((r) => r.temporal.supplied)).size > 1,
    actionable: new Set(rows.map((r) => r.actionable.supplied)).size > 1,
  };

  /* THE PROBE: a view in which one object's epistemic status is CHANGED. The projection must
     follow it. If the projection were still hardcoding 'observed', this would fail. */
  const flipped = {
    ...v,
    objects: v.objects.map((o) => (o.kind === 'insight' ? { ...o, epistemic: 'observed' } : o)), // V-INPUT: constructs an alternative view for the probe
  };
  const flippedItem = projection({}, flipped).axes.flatMap((a) => a.items).find((i) => i.kind === 'insight');
  const probeFollowed = flippedItem?.epistemic === 'observed' && flippedItem?.epistemicText === EPISTEMIC_WORDS.observed;

  /* AND THE ABSENT CASE, which stays absent. Whether it is also SILENT is check A-05's job. */
  const unstated = P.axes.flatMap((a) => a.items).filter((i) => i.epistemicSuppliedByV === false);

  return {
    rows,
    allSuppliedValuesPreserved: preserved,
    fixtureVaries: varies,
    objectsWithNoEpistemicStatusAsserted: unstated.map((i) => i.id),
    probe: { input: 'a view with the insight\'s epistemic status changed to observed', followed: probeFollowed },
    pass: preserved && varies.epistemic && varies.temporal && varies.actionable && probeFollowed && unstated.length > 0,
  };
}

/* ================================================ REV-02: ABSENCE REMAINS ABSENCE ========= */
/**
 * A FIELD THE VIEW DID NOT SUPPLY PRODUCES NO ANNOUNCEMENT OF ANY KIND.
 *
 * Three things have to be true at once, and each was false in at least one version of this file:
 *
 *   1. the absent field does not become `observed`, does not become `hypothesis`, and does not
 *      become any other status — the value stays ABSENT in the data;
 *   2. nothing is SPOKEN in its place. Not «غير مُحدَّد», not an epistemic word, not a paraphrase.
 *      The accessible label of the unstated object carries no epistemic vocabulary at all, and
 *      the string «غير مُحدَّد» appears nowhere in the rendered page;
 *   3. the test can tell the difference. A view that DOES supply the value must produce the word,
 *      or point 2 is satisfied by a projection that says nothing about anything.
 *
 * And the planted probe underneath: the WITHDRAWN composer — the one with the `?? 'غير مُحدَّد'`
 * tail — run against the same row, which must be detected as announcing a status.
 */
export function absenceProbes() {
  const v = syntheticView();
  const P = projection({}, v);
  const items = P.axes.flatMap((a) => a.items);
  const unstated = items.filter((i) => i.epistemicSuppliedByV === false);
  const VOCABULARY = [FORBIDDEN_UNSPECIFIED_ANNOUNCEMENT, ...Object.values(EPISTEMIC_WORDS)];

  const rows = unstated.map((i) => {
    const label = accessibleLabel(i);
    return {
      id: i.id,
      valueInData: i.epistemic ?? 'ABSENT',
      spokenLabel: label,
      epistemicVocabularyInLabel: VOCABULARY.filter((w) => label.includes(w)),
    };
  });
  const absentStaysAbsent = rows.every((r) => r.valueInData === 'ABSENT');
  const nothingIsSpoken = rows.every((r) => r.epistemicVocabularyInLabel.length === 0);

  /* «غير مُحدَّد» must not survive anywhere in the shipped document — not in a label, not in a
     visible span, not in the embedded projection JSON. */
  const html = projectionPage({}, v);
  const unspecifiedAnywhereInThePage = html.includes(FORBIDDEN_UNSPECIFIED_ANNOUNCEMENT);

  /* THE SENSITIVITY HALF. Supply the value and the word must appear, or "nothing is spoken" is
     being satisfied by a projection that is silent about everything. */
  const supplied = {
    ...v,
    objects: v.objects.map((o) => (o.kind === 'topic' && o.epistemic === undefined ? { ...o, epistemic: 'observed' } : o)), // V-INPUT: constructs an alternative view for the probe
  };
  const suppliedItem = projection({}, supplied).axes.flatMap((a) => a.items).find((i) => rows.some((r) => r.id === i.id));
  const suppliedIsSpoken = !!suppliedItem && accessibleLabel(suppliedItem).includes(EPISTEMIC_WORDS.observed);

  /* THE PLANTED PROBE: the withdrawn composer, applied to the same unstated row. */
  const withdrawnComposer = (it) =>
    [it.productRole, it.name, it.relationship,
      it.epistemicText ?? (it.epistemicSuppliedByV === false ? FORBIDDEN_UNSPECIFIED_ANNOUNCEMENT : null),
      it.temporalText, it.actionable === false ? NOT_ACTIONABLE : null].filter(Boolean).join('، ');
  const probeLabel = unstated.length ? withdrawnComposer(unstated[0]) : '';
  const probeDetected = VOCABULARY.some((w) => probeLabel.includes(w));

  return {
    what: 'A semantic field canonical V did not supply produces no value and no announcement.',
    rows,
    absentDidNotBecomeAStatus: absentStaysAbsent,
    nothingIsAnnouncedInItsPlace: nothingIsSpoken,
    theWithdrawnStringAppearsNowhereInTheRenderedPage: !unspecifiedAnywhereInThePage,
    aSuppliedValueIsStillAnnounced: suppliedIsSpoken,
    probe: { input: 'the WITHDRAWN composer, with its «غير مُحدَّد» fallback, applied to the same unstated row', label: probeLabel, detected: probeDetected },
    pass: unstated.length > 0 && absentStaysAbsent && nothingIsSpoken && !unspecifiedAnywhereInThePage && suppliedIsSpoken && probeDetected,
  };
}

/* ============================== REV-03: THE PROJECTION MAY NOT EXPAND DISCLOSURE ========== */
/**
 * THREE PLANTED FIXTURES, EACH A REFERENTIALLY BROKEN V, AND WHAT EACH ONE IS FOR.
 *
 *   1. a CONNECTION whose destination is not in V — the endpoint case;
 *   2. a PATTERN whose one member is not in V — the membership case;
 *   3. a CONNECTION pointing at a REAL I-08B3.1-D2R TOPIC that V does not disclose — which is the
 *      only one of the three that can catch a projector reaching outside V for a name. The first
 *      two use a marker id no other source has ever heard of, so a leak there could only be the
 *      id itself; this one exists because the name is recoverable, from `TOPICS`, by any code that
 *      decides to look.
 *
 * What must hold in every case: the undisclosed id appears NOWHERE — not in a row, not in a
 * label, not in the rendered page; the undisclosed NAME is not recovered; no relationship prose
 * is written; and the projection REPORTS the broken reference rather than swallowing it.
 *
 * And the negative probe, because a leak test that can never see a leak is a sentence: the OLD
 * `?? id` fallback is run over the same fixture and must produce the marker in the label.
 */
const HIDDEN_MARKER_ID = 'undisclosed-object-7f3a2c';

export function disclosureProbes() {
  const base = syntheticView();
  /* a real D2R topic, removed from V while the connection still points at it */
  const realButUndisclosed = base.objects.find((o) => o.kind === 'connection').to;
  const realName = TOPICS.find((t) => t.id === realButUndisclosed)?.label ?? null;

  const CASES = [
    {
      what: 'a CONNECTION whose destination is absent from V',
      hiddenId: HIDDEN_MARKER_ID,
      hiddenName: null,
      view: { ...base, objects: base.objects.map((o) => (o.kind === 'connection' ? { ...o, to: HIDDEN_MARKER_ID } : o)) },
    },
    {
      what: 'a PATTERN one of whose members is absent from V',
      hiddenId: HIDDEN_MARKER_ID,
      hiddenName: null,
      view: { ...base, objects: base.objects.map((o) => (o.kind === 'pattern' ? { ...o, members: [...o.members.slice(0, -1), HIDDEN_MARKER_ID] } : o)) },
    },
    {
      what: 'a CONNECTION pointing at a REAL D2R topic that V does not disclose — the name is recoverable from TOPICS, and must not be recovered',
      hiddenId: realButUndisclosed,
      hiddenName: realName,
      view: { ...base, objects: base.objects.filter((o) => o.id !== realButUndisclosed) },
    },
  ];

  const results = CASES.map((c) => {
    const P = projection({}, c.view);
    const items = P.axes.flatMap((a) => a.items);
    const broken = items.filter((i) => i.referenceIntegrity?.complete === false);
    const labels = items.map(accessibleLabel);
    const html = projectionPage({}, c.view);

    /* the id must not appear in any row's own FIELDS (its own object id is excluded: an object's
       identity is not a reference, and in case 3 the connection's id legitimately embeds the
       endpoint's, which is D2R's naming and not a disclosure this layer made) */
    const idInARowField = items.some((i) =>
      Object.entries(i).some(([k, val]) => k !== 'id' && JSON.stringify(val ?? null).includes(c.hiddenId)));
    const idInALabel = labels.some((l) => l.includes(c.hiddenId));
    const nameRecovered = c.hiddenName ? labels.some((l) => l.includes(c.hiddenName)) || html.includes(c.hiddenName) : false;
    const prosePresent = broken.some((i) => typeof i.relationship === 'string');

    return {
      what: c.what,
      brokenReferencesReported: broken.map((i) => ({ id: i.id, undisclosedReferences: i.referenceIntegrity.undisclosedReferences })),
      detected: broken.length > 0 && P.referentialIntegrity.complete === false,
      rawIdInARowField: idInARowField,
      rawIdInAnAccessibleLabel: idInALabel,
      hiddenNameRecovered: nameRecovered,
      relationshipProseWritten: prosePresent,
      /* every other object must be unharmed — fail-closed is not fail-everything */
      objectsStillProjected: items.length,
      pass: broken.length > 0 && P.referentialIntegrity.complete === false &&
        !idInARowField && !idInALabel && !nameRecovered && !prosePresent,
    };
  });

  /* THE PROBE: the withdrawn `?? id` resolver, over case 1. It must produce the marker. */
  const c1 = CASES[0];
  const leakyIndex = new Map(c1.view.objects.map((o) => [o.id, o]));
  const leakyName = (id) => (leakyIndex.has(id) ? leakyIndex.get(id).name : id);
  const conn = c1.view.objects.find((o) => o.kind === 'connection');
  const leakedLabel = `علاقة بين «${leakyName(conn.from)}» و«${leakyName(conn.to)}»`;
  const probeLeaks = leakedLabel.includes(HIDDEN_MARKER_ID);

  return {
    upstreamInvariant: REFERENTIAL_INTEGRITY.upstreamInvariant,
    projectorBehaviour: REFERENTIAL_INTEGRITY.projectorBehaviour,
    cases: results,
    probe: { input: 'the WITHDRAWN `disclosed name ?? raw id` resolver, over the same broken view', label: leakedLabel, leaks: probeLeaks },
    pass: results.every((r) => r.pass) && probeLeaks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const P = projection();
  const out = join(PKG, 'review', 'sr');
  const res = await readAXTree(out);
  const ord = orderingProbes();
  const fix = fixturePreservationProbes();
  const abs = absenceProbes();
  const dis = disclosureProbes();
  const report = { generatedBy: 'tools/f1-sr.mjs', projection: P, tree: res.state, ordering: ord, fixturePreservation: fix, absence: abs, disclosure: dis };
  if (res.state === 'READ') Object.assign(report, { checks: checkTree(res.nodes, P) });
  writeFileSync(join(PKG, 'data/F1_SCREEN_READER.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('axes:', P.axes.map((a) => `${a.kind}:${a.items.length}`).join(' '));
  console.log('tree:', res.state);
  console.log('ordering — order stable under permutation:', ord.traversalOrderUnchanged, '| facts stable:', ord.semanticFactsUnchanged, '| probe rejected a ranked order:', ord.probe.rejected);
  console.log('fixture  — every supplied value preserved:', fix.allSuppliedValuesPreserved, '| fixture varies:', JSON.stringify(fix.fixtureVaries), '| unstated:', fix.objectsWithNoEpistemicStatusAsserted.join(','));
  console.log('absence  — absent stayed absent:', abs.absentDidNotBecomeAStatus, '| nothing announced:', abs.nothingIsAnnouncedInItsPlace,
    '| «غير مُحدَّد» nowhere in the page:', abs.theWithdrawnStringAppearsNowhereInTheRenderedPage,
    '| a supplied value is still spoken:', abs.aSuppliedValueIsStillAnnounced, '| probe detected the withdrawn composer:', abs.probe.detected);
  for (const c of dis.cases) {
    console.log('disclosure —', c.what);
    console.log('             detected:', String(c.detected).padEnd(5), '| raw id in a field:', String(c.rawIdInARowField).padEnd(5),
      '| raw id in a label:', String(c.rawIdInAnAccessibleLabel).padEnd(5), '| hidden name recovered:', String(c.hiddenNameRecovered).padEnd(5),
      '| prose written:', String(c.relationshipProseWritten).padEnd(5), '=>', c.pass ? 'FAIL-CLOSED' : 'LEAKED');
  }
  console.log('             probe: the withdrawn `?? id` resolver leaks the marker:', dis.probe.leaks);
  if (report.checks) {
    const c = report.checks;
    console.log('  AX nodes', c.axNodes, '| named', c.namedNodes, '| expected objects', c.expectedObjects);
    console.log('  missing accessible names:', c.missingAccessibleNames.length ? JSON.stringify(c.missingAccessibleNames) : 'none');
    console.log('  axis headings:', c.headingsFound.join(' · '), c.missingAxisHeadings.length ? 'MISSING ' + c.missingAxisHeadings.join(',') : '');
    console.log('  traversal order agrees with the declared rule:', c.orderAgrees.every((o) => o.agrees), '| wording clean:', c.orderWordingClean, '| rank fields:', c.rankFieldsFound.length);
    console.log('  pattern states its members in words:', c.patternStatesItsMembersInWords);
    console.log('  connection states source and destination:', c.connectionStatesSourceAndDestination);
    console.log('  probe rejected a fabricated name:', c.probe.detectedAsMissing);
    console.log('  PASS:', c.pass && ord.pass && fix.pass && abs.pass && dis.pass);
    if (!(c.pass && ord.pass && fix.pass && abs.pass && dis.pass)) process.exit(1);
  }
}
