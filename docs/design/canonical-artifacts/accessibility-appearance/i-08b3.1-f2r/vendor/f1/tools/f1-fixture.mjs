/**
 * I-08B3.1-F1R — THE DISCLOSED VIEW, AND THE LINE BETWEEN A FIXTURE AND A CONTRACT.
 *
 * WHAT THE INDEPENDENT REVIEW FOUND, AND IT WAS RIGHT.
 *
 * F1's scene builder AUTHORED semantic fields. It wrote `epistemic: 'observed'` onto every topic,
 * `epistemic: 'hypothesis'` onto the insight, `temporal: 'current'` onto everything and
 * `actionable: true` onto everything — and none of those values is established by the inherited
 * I-08B3.1-D2R scene. They were the renderer's invention, and the parity matrix then proved they
 * survived every accessibility expression, which is a true statement about invented data.
 *
 * The canonical architecture is that the visual renderer, the accessible semantic surface and
 * field navigation all operate from the SAME disclosed view, V. So:
 *
 *      ACCESSIBLE SEMANTICS = PROJECT(V)
 *
 * and never
 *
 *      ACCESSIBLE SEMANTICS = INFER FROM VISUAL GEOMETRY / F1 RENDERER.
 *
 * THIS FILE IS THE FIXTURE HALF OF THAT SEPARATION. It supplies, as explicit INPUT with explicit
 * provenance, exactly the fields the renderer used to invent. Nothing downstream may add one.
 * `project()` copies a fixed field list off each supplied object and refuses to substitute a
 * plausible default for an absent one — because a field the Product has no authority for must be
 * ABSENT, not filled in.
 *
 * WHAT THESE VALUES ARE NOT. They are not QANDEEL Product semantics and this package does not
 * propose them as any. `epistemic: 'observed'` is not a claim that QANDEEL's topics are observed;
 * it is a claim that IF a view supplies that value, the accessible projection carries it through
 * unchanged. Every object below therefore carries `$provenance`, and the value is stamped into
 * the rendered document and into the projection JSON so that no reader of either can mistake a
 * test input for a decision.
 *
 * THE FIXTURE DELIBERATELY DOES NOT SAY THE SAME THING TWICE. If every object were `observed`,
 * `current` and `actionable`, a projection that hardcoded those three values would pass the
 * preservation test perfectly. So the fixture varies them — one topic is `historical`, one is not
 * actionable, one carries no epistemic status at all — and the projection has to follow.
 */
import { TOPICS, WORLDS } from '../vendor/d2r/scene/d2-world.mjs';
import { PATTERN_MEMBERS, PATTERN_LABEL, PATTERN_SUBLABEL, INSIGHT_TEXT, INSIGHT_LABEL } from '../vendor/d2r/scene/d2-events.mjs';

export const FIXTURE_PROVENANCE = 'SYNTHETIC TEST FIXTURE — NOT PRODUCT DATA';

/**
 * THE SEMANTIC FIELDS THIS SYNTHETIC FIXTURE SUPPLIES. NOT the complete semantic model of
 * canonical V, and I-08B3.1-F1R2 had to correct that sentence.
 *
 * F1R described this array as "the complete list of what a projection may carry". It is nothing
 * of the sort. It is a TEST ALLOWLIST: three dimensions a synthetic view happens to supply so that
 * preservation across an accessibility boundary can be proved at all. Describing it as the
 * complete model let a bounded proof read as exhaustive Product truth — the same class of mistake
 * as the fixture's own values reading as Product semantics, one level up.
 *
 * The list is here rather than spread through the renderer so that "the renderer invents nothing"
 * is a property of ONE array. A field on it reaches the projection only if the view supplied it;
 * a field NOT on it is reported by `project()` as UNMAPPED rather than dropped in silence, because
 * silently dropping a disclosed fact is the exact failure the completeness contract forbids.
 */
export const SEMANTIC_FIELDS = Object.freeze(['epistemic', 'temporal', 'actionable']);

/**
 * WHAT THE PROOF COVERS, AND WHAT IT DOES NOT — as DATA, so a check can assert the disclaimer
 * exists and a document cannot quietly outgrow it.
 *
 * `kindsOfFactTheContractCovers` is deliberately a list of KINDS OF ANALYTICAL FACT and NOT a list
 * of runtime field names. Inventing canonical field names in order to make this look exhaustive
 * would be the same failure as inventing semantic values: it would put words in the Product's
 * mouth about a schema that does not exist here yet.
 */
export const FIXTURE_SCOPE = Object.freeze({
  exhaustive: false,
  fieldsSuppliedByThisFixture: SEMANTIC_FIELDS,
  productContract:
    'Every user-exposable semantic fact legitimately disclosed in canonical V and required for understanding or operation must have an equivalent accessible expression. No accessibility projection may silently drop such a fact.',
  kindsOfFactTheContractCovers: Object.freeze([
    'evidence', 'provenance', 'uncertainty / qualification', 'epistemic status', 'temporal truth',
    'relationships', 'actions', 'any other user-exposable semantic field canonical V discloses',
  ]),
  whatTheProofEstablishes:
    'A BOUNDED PROOF. Every parity cell and every projection row is evidence about the dimensions this fixture supplies — epistemic status, temporal truth and actionability — plus structure, relationships and rendered presence. It is not evidence about a dimension the fixture does not supply.',
  whatTheProofDoesNotEstablish: Object.freeze([
    'that the projection carries every semantic field a real canonical V may expose — no such V exists in this package',
    'that the production mapping is exhaustive — it cannot be written until the canonical V schema is integrated',
    'that three dimensions are the right number of dimensions for anything',
  ]),
  implementationDependency:
    'PRODUCTION ACCESSIBILITY MAPPING MUST BE EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V SCHEMA.',
  contractToken: 'qandeel.accessibility.projection.completeness',
});

/** Structural fields — what the object IS and what it is made of. Also supplied, never inferred. */
export const STRUCTURAL_FIELDS = Object.freeze(['kind', 'id', 'name', 'sublabel', 'text', 'from', 'to', 'members', 'relation']);

/**
 * THE INHERITED HALF: identity and geometry come from D2R and are not invented here either.
 * A topic's id and its written name are the frozen package's own; what the fixture adds is only
 * the semantic status that D2R never stated.
 */
const TOPIC_SEMANTICS = {
  /* the ordinary case */
  $default: { epistemic: 'observed', temporal: 'current', actionable: true },
  /* ONE TOPIC IS NOT CURRENT. If the projection hardcoded 'current' this row would catch it. */
  'fear-shortfall': { epistemic: 'observed', temporal: 'historical', actionable: true },
  /* ONE TOPIC CANNOT BE OPENED. If the projection hardcoded `actionable: true` — which it did —
     this row catches it, and it also exercises the non-actionable branch of the SR row, where the
     control must become a non-interactive element rather than a button nobody can use. */
  'energy-decline': { epistemic: 'observed', temporal: 'current', actionable: false },
  /* ONE TOPIC HAS NO EPISTEMIC STATUS AT ALL. The projection must OMIT the field rather than
     announce a plausible default, which is the §12 rule "do not invent runtime data" in its
     sharpest form: the absence of authority is itself a fact a reader is entitled to. */
  'comparison': { temporal: 'current', actionable: true },
};

/** An override REPLACES the default rather than merging into it. Merging would quietly restore
 *  `epistemic` to the one topic that is supposed to lack it, and the absent-field case is the
 *  whole point of having it. */
const topicSemantics = (id) => TOPIC_SEMANTICS[id] ?? TOPIC_SEMANTICS.$default;

/**
 * V — THE DISCLOSED VIEW this package's proofs run against.
 *
 * `canonicalOrder` IS THE IMPLEMENTATION SEAM AND IT IS DELIBERATELY NULL. If a runtime later
 * supplies a canonical presentation order for a kind, it arrives here and the projection uses it.
 * Until one exists, the projection falls back to an explicitly NON-SEMANTIC deterministic order
 * — see `neutralOrder` in tools/f1-sr.mjs — and says so in words. Inventing an order here and
 * calling it the Product's would be the same mistake this file exists to undo.
 */
export function syntheticView({ world = 'personal' } = {}) {
  const objects = [];
  for (const t of TOPICS) {
    const s = topicSemantics(t.id);
    const o = { kind: 'topic', id: t.id, name: t.label, $provenance: FIXTURE_PROVENANCE };
    for (const f of SEMANTIC_FIELDS) if (s[f] !== undefined) o[f] = s[f];
    objects.push(o);
  }
  objects.push({
    kind: 'connection',
    id: 'connection:task-delay~comparison',
    name: 'علاقة',
    from: 'task-delay',
    to: 'comparison',
    relation: 'directed relation between two topics',
    epistemic: 'observed',
    temporal: 'current',
    actionable: true,
    $provenance: FIXTURE_PROVENANCE,
  });
  objects.push({
    kind: 'pattern',
    id: 'pattern:four-topics',
    name: PATTERN_LABEL,
    sublabel: PATTERN_SUBLABEL,
    members: [...PATTERN_MEMBERS],
    relation: 'membership — an unordered SET, no member ranked above another',
    epistemic: 'observed',
    temporal: 'current',
    actionable: true,
    $provenance: FIXTURE_PROVENANCE,
  });
  objects.push({
    kind: 'insight',
    id: 'insight:mastery-precedes-sleep',
    name: INSIGHT_LABEL,
    text: INSIGHT_TEXT,
    epistemic: 'hypothesis',
    temporal: 'current',
    actionable: true,
    $provenance: FIXTURE_PROVENANCE,
  });
  return Object.freeze({
    $provenance: FIXTURE_PROVENANCE,
    $why: 'Supplied as INPUT so that the accessible projection can be proved to PRESERVE a semantic value rather than to AUTHOR one. These values are not QANDEEL Product semantics and I-08B3.1-F1R proposes none.',
    world,
    worldName: WORLDS[world].name,
    canonicalOrder: null,
    objects,
  });
}

export const SYNTHETIC_VIEW = syntheticView();

/**
 * PROJECT(V) — the one door between a disclosed view and everything this package renders.
 *
 * It copies. It does not compute, default, infer or complete. The two guards below are what make
 * that checkable rather than promised:
 *
 *   - a field not in SEMANTIC_FIELDS or STRUCTURAL_FIELDS cannot pass, so a later edit that adds
 *     an invented field to an object is dropped here and caught by check A-03;
 *   - a SEMANTIC field the view did not supply is ABSENT downstream. There is no `?? 'current'`
 *     anywhere in this function, and check A-02 feeds it a view with a missing field to prove it.
 *
 * AND IT DOES NOT DROP ANYTHING IN SILENCE, which is I-08B3.1-F1R2's addition. A field the view
 * supplies that this projector has no mapping for is collected into `$unmappedFields` and carried
 * out with the result. The completeness contract says no accessibility projection may SILENTLY
 * drop a disclosed user-exposable fact; a bounded projector cannot carry a field it has no
 * vocabulary for, but it can refuse to be quiet about it, and that is the difference between a
 * known limit and an undetected loss. Check B-02 feeds it a view carrying an unmapped field.
 */
export function project(view) {
  if (!view || !Array.isArray(view.objects)) throw new Error('f1-fixture: project(V) needs a view with an objects array');
  const unmapped = [];
  const objects = view.objects.map((o) => {
    const out = {};
    for (const f of STRUCTURAL_FIELDS) if (o[f] !== undefined) out[f] = Array.isArray(o[f]) ? [...o[f]] : o[f];
    for (const f of SEMANTIC_FIELDS) if (o[f] !== undefined) out[f] = o[f];
    for (const f of Object.keys(o)) {
      if (f.startsWith('$') || STRUCTURAL_FIELDS.includes(f) || SEMANTIC_FIELDS.includes(f)) continue;
      unmapped.push({ object: o.id ?? null, field: f });
    }
    out.$provenance = o.$provenance ?? view.$provenance ?? null;
    return out;
  });
  return {
    $provenance: view.$provenance ?? null,
    /* the bounded-proof disclaimer travels WITH the projection, not only in a document */
    $scope: FIXTURE_SCOPE,
    /* empty for the shipped fixture; non-empty is a DETECTED loss, never a silent one */
    $unmappedFields: unmapped,
    world: view.world,
    worldName: view.worldName,
    canonicalOrder: view.canonicalOrder ?? null,
    objects,
    counts: {
      topic: objects.filter((o) => o.kind === 'topic').length,
      connection: objects.filter((o) => o.kind === 'connection').length,
      pattern: objects.filter((o) => o.kind === 'pattern').length,
      insight: objects.filter((o) => o.kind === 'insight').length,
    },
  };
}
