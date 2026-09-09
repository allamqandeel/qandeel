/**
 * T-12 Phase M — the deterministic canonical-world fixture. VALIDATION TOOLING ONLY.
 *
 * ## What this is, and what it is emphatically not
 *
 * `QAN-BL-MOT-03` and `QAN-BL-MOT-04` need a world: Moments to scrub, destinations to travel between,
 * objects to carry in under a finger. An empty Session reaches `READY` and shows none of that.
 *
 * In production that world is produced by the conversational intelligence runtime. QANDEEL's
 * production provider choice is deliberately still open, and nothing may select one to finish a
 * validation phase. So this fixture produces the same world the other way: **the semantics are
 * supplied, and the DATABASE decides everything else.** Every Moment, Session Position, Thread, Home
 * placement, lifecycle transition and Live-Focus transition below is computed by the canonical
 * authorities under their own invariants — this module only states the decisions a segmentation and
 * focus/thread/continuity evaluator would have stated.
 *
 * > **This seed validates runtime consumption and visual/navigation behaviour only. It is not
 * > evidence of AI semantic quality or provider integration.**
 *
 * ## Why the payload shapes are copied rather than designed
 *
 * Every builder here is the shape `database/verify-migration-0064.mjs` … `0071.mjs` already prove
 * against live PostgreSQL. Nothing is guessed: the exchange scenario is the repository's own
 * `sessionOne` fixture, extended with two further exchanges that reuse ONLY patterns that scenario
 * already exercises. A shape invented here would be a shape no contract has ever validated.
 *
 * ## Determinism, and why identity is still per-run
 *
 * Every identifier is derived — `uuidV5(namespace, "<sessionId>:<label>")` — so one Session id
 * reproduces byte-identical payloads, and two runs never collide. That is what makes a failed or
 * repeated seed harmless: a fresh validation Session yields a fresh world rather than mutating an
 * existing one. The only inputs are the Session id and the owning user id.
 *
 * The Arabic content is the repository's own canonical fixture text, kept deliberately: it satisfies
 * the frozen code-point span contract, and it means the seeded world exercises RTL wording — which
 * `QAN-BL-RSP-01`'s Arabic rows and `QAN-BL-MOT-03`'s RTL Timeline scrub both need anyway.
 *
 * Pure. No database, no network, no filesystem. That is what lets the focused tests check it.
 */

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------------------------
// Provider-neutral provenance.
//
// The live schema constrains these by LENGTH and non-emptiness only — `conversation_unit_commit_batches`
// allows any provider ≤64, model ≤128, prompt version ≤64 — with no vocabulary CHECK. So the labels
// are free, and they are chosen to be impossible to mistake for a model's output. The verifiers use
// `OPENAI` / `gpt-5-mini` as their fixture values; naming a real provider on synthetic semantics
// would be a false provenance record in a durable table, which is worse than useless.
// ---------------------------------------------------------------------------------------------

/** The one neutral provider identity every layer of this fixture records. */
export const NEUTRAL_PROVIDER = 'PHASE_M_VALIDATION';
/** The one neutral model identity. There is no model. */
export const NEUTRAL_MODEL = 'DETERMINISTIC_FIXTURE';

/** Names no real provider may contain. Asserted by the focused tests over every provenance value. */
export const FORBIDDEN_PROVENANCE_TOKENS = Object.freeze([
  'openai', 'gpt', 'anthropic', 'claude', 'gemini', 'google', 'mistral', 'llama', 'cohere', 'deepseek', 'grok', 'qwen',
]);

/** `p_evaluator_version, p_policy_version, p_segmentation_provider, p_segmentation_model, p_segmentation_prompt_version` */
export const PROVENANCE = Object.freeze([
  'phase-m-deterministic-fixture-v1', 'phase-m-canonical-world-v1', NEUTRAL_PROVIDER, NEUTRAL_MODEL, 'phase-m-no-provider-segmentation-v1',
]);
/** `…focus_evaluator_version, …policy_version, …provider, …model, …prompt_version, …schema_version` */
export const FOCUS_PROVENANCE = Object.freeze([
  'phase-m-deterministic-focus-v1', 'phase-m-canonical-world-v1', NEUTRAL_PROVIDER, NEUTRAL_MODEL, 'phase-m-no-provider-focus-v1', 1,
]);
export const THREAD_PROVENANCE = Object.freeze([
  'phase-m-deterministic-thread-v1', 'phase-m-canonical-world-v1', NEUTRAL_PROVIDER, NEUTRAL_MODEL, 'phase-m-no-provider-thread-v1', 1,
]);
export const CONTINUITY_PROVENANCE = Object.freeze([
  'phase-m-deterministic-continuity-v1', 'phase-m-canonical-world-v1', NEUTRAL_PROVIDER, NEUTRAL_MODEL, 'phase-m-no-provider-continuity-v1', 1,
  'phase-m-deterministic-lifecycle-reducer-v1',
]);
export const LF_REDUCER_VERSION = 'phase-m-deterministic-live-focus-reducer-v1';
/** `claim_conversation_turn`'s route arguments. The frozen FAST default; this fixture routes nothing. */
export const ROUTE = Object.freeze(['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);

// ---------------------------------------------------------------------------------------------
// Canonical identity derivation — the exact vectors of durable-thread-canonicalizer.ts,
// durable-thread-lifecycle-canonicalizer.ts and durable-live-focus-canonicalizer.ts.
// ---------------------------------------------------------------------------------------------

const RFC4122_URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

export function uuidV5(namespace, name) {
  const digest = createHash('sha1').update(Buffer.from(namespace.replace(/-/gu, ''), 'hex')).update(Buffer.from(name, 'utf8')).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const THREAD_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/thread/v1');
const HOME_ANCHOR_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/home-anchor/v1');
const THREAD_EVENT_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-established/v1');
const BINDING_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-focus-binding/v1');
const LIFECYCLE_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-lifecycle-event/v1');
const LIVE_FOCUS_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/live-focus-transition/v1');
/**
 * This fixture's OWN namespace, for the identifiers a runtime would have minted at random — CU ids,
 * batch ids, turn ids, focus ids, reference handles. Deriving them from the Session id is what makes
 * one Session reproduce byte-identical payloads while two Sessions never collide.
 */
const FIXTURE_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/phase-m/deterministic-validation-fixture/v1');

export const threadIdOf = (userId, focusId) => uuidV5(THREAD_NAMESPACE, `${userId}:${focusId}`);
const bindingIdOf = (sessionId, focusId, threadId) => uuidV5(BINDING_NAMESPACE, `${sessionId}:${focusId}:${threadId}`);
const lifecycleEventIdOf = (sessionId, cuId, threadId, toState) => uuidV5(LIFECYCLE_NAMESPACE, `${sessionId}:${cuId}:${threadId}:${toState}`);
const lfEventIdOf = (sessionId, cuId, kind, ref) => uuidV5(LIVE_FOCUS_NAMESPACE, `${sessionId}:${cuId}:${kind}:${ref ?? 'NONE'}`);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------------------------------------
// Span and payload builders — the verifiers' shapes, unchanged.
// ---------------------------------------------------------------------------------------------

const points = (value) => Array.from(value);

/** Code-point span of `excerpt` inside `content`. The frozen contract counts code points, not units. */
export function spanOf(content, excerpt, occurrence = 1) {
  const source = points(content);
  const needle = points(excerpt);
  let seen = 0;
  for (let start = 0; start + needle.length <= source.length; start += 1) {
    if (needle.every((ch, offset) => source[start + offset] === ch)) {
      seen += 1;
      if (seen === occurrence) return { start, end: start + needle.length };
    }
  }
  throw new Error(`fixture excerpt not found in its own source text: ${excerpt}`);
}

const unit = (content, excerpt, id, occurrence = 1) => {
  const { start, end } = spanOf(content, excerpt, occurrence);
  return { unit_id: id, span_start: start, span_end: end };
};
const anchor = (cuText, excerpt, occurrence = 1) => {
  const { start, end } = spanOf(cuText, excerpt, occurrence);
  return { anchor_text: excerpt, anchor_occurrence: occurrence, span_start: start, span_end: end };
};
const resolved = (cuText, excerpt, handle, creates = false, occurrence = 1) =>
  ({ ...anchor(cuText, excerpt, occurrence), state: 'RESOLVED', resolved_handle_id: handle, creates_handle: creates, candidate_handle_ids: [] });
const claim = (cuText, excerpt, kind, handle, frame, occurrence = 1) =>
  ({ ...anchor(cuText, excerpt, occurrence), claimant_kind: kind, claimant_handle_id: handle, claim_frame: frame });

const NO_FOCUS = Object.freeze({ kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null });
const startFocus = (focusId, index, reason = 'DIRECT_SUBJECT') =>
  ({ kind: 'START_NEW_FOCUS', reason, emerging_focus_id: focusId, creates_focus: true, grounding_reference_index: index });
const attendFocus = (focusId, index, reason = 'SUBSTANTIVE_ELABORATION') =>
  ({ kind: 'ATTEND_EXISTING_FOCUS', reason, emerging_focus_id: focusId, creates_focus: false, grounding_reference_index: index });

const bundle = (unitId, overrides = {}) => ({
  unit_id: unitId,
  functions: overrides.functions ?? ['INFORM_REPORT'],
  sequence_position: overrides.sequence_position ?? 'UNMARKED',
  target_cu_id: overrides.target_cu_id ?? null,
  references: (overrides.references ?? []).map((reference, index) => ({ reference_index: index, ...reference })),
  claim_attributions: (overrides.claim_attributions ?? []).map((attribution, index) => ({ attribution_index: index, ...attribution })),
  attention: overrides.attention ?? NO_FOCUS,
});

const noEstablishment = (unitId, reason, focusId = null) => ({
  unit_id: unitId, decision: 'NO_ESTABLISHMENT', no_establishment_reason: reason,
  emerging_focus_id: focusId, path: null, thread_id: null, home_anchor_id: null,
  thread_established_event_id: null, evidence: [], explicit_selection_grounding: null,
  origin_state: 'NONE', origin_thread_ids: [],
});

const establish = (userId, unitId, focusId, evidenceCuIds, overrides = {}) => {
  const threadId = threadIdOf(userId, focusId);
  return {
    unit_id: unitId, decision: 'ESTABLISH_THREAD', no_establishment_reason: null, emerging_focus_id: focusId, path: 'TE-01',
    thread_id: threadId,
    home_anchor_id: uuidV5(HOME_ANCHOR_NAMESPACE, threadId),
    thread_established_event_id: uuidV5(THREAD_EVENT_NAMESPACE, threadId),
    evidence: evidenceCuIds.map((cuId, index) => ({
      evidence_ordinal: index, cu_id: cuId,
      evidence_role: index === evidenceCuIds.length - 1 ? 'ESTABLISHING_CU' : 'PRIOR_EVIDENCE',
    })),
    explicit_selection_grounding: overrides.explicit_selection_grounding ?? null,
    origin_state: overrides.origin_state ?? 'NONE',
    origin_thread_ids: [...(overrides.origin_thread_ids ?? [])].sort(byText),
  };
};

const transition = (sessionId, cuId, threadId, toState, reasonCode) =>
  ({ thread_id: threadId, to_state: toState, reason_code: reasonCode, lifecycle_event_id: lifecycleEventIdOf(sessionId, cuId, threadId, toState) });
const sortTransitions = (transitions) => [...transitions].sort((a, b) => byText(a.thread_id, b.thread_id));

const lifecycle = (unitId, overrides = {}) => ({
  unit_id: unitId,
  outcome: overrides.outcome ?? 'NO_THREAD_ACTION',
  emerging_focus_id: overrides.emerging_focus_id ?? null,
  thread_id: overrides.thread_id ?? null,
  binding_kind: overrides.binding_kind ?? null,
  focus_binding_id: overrides.focus_binding_id ?? null,
  identity_evidence: overrides.identity_evidence ?? [],
  prior_identity_evidence: overrides.prior_identity_evidence ?? [],
  candidate_thread_ids: [...(overrides.candidate_thread_ids ?? [])].sort(byText),
  lifecycle_transitions: sortTransitions(overrides.lifecycle_transitions ?? []),
});
const establishNew = (sessionId, unitId, focusId, threadId, evidence, transitions = []) => lifecycle(unitId, {
  outcome: 'ESTABLISH_NEW', emerging_focus_id: focusId, thread_id: threadId, binding_kind: 'ESTABLISHMENT',
  focus_binding_id: bindingIdOf(sessionId, focusId, threadId), identity_evidence: evidence, lifecycle_transitions: transitions,
});
const attendExisting = (unitId, focusId, threadId) => lifecycle(unitId, { outcome: 'ATTEND_EXISTING', emerging_focus_id: focusId, thread_id: threadId });
const noAction = (unitId, focusId = null) => lifecycle(unitId, { emerging_focus_id: focusId });

const lfChange = (sessionId, unitId, kind, ref, reason) => ({
  unit_id: unitId, effective_kind: kind, effective_ref: ref, transition: true, reason_code: reason,
  transition_event_id: lfEventIdOf(sessionId, unitId, kind, ref),
});
const lfSame = (unitId, kind, ref) => ({ unit_id: unitId, effective_kind: kind, effective_ref: ref, transition: false, reason_code: null, transition_event_id: null });

// ---------------------------------------------------------------------------------------------
// The fixture text.
//
// Exchange 1 is the repository's own `sessionOne` scenario, verbatim: the manager as an explicit
// selection, an incidental mention of Ahmed inside a reported claim, then Ahmed as a direct concern
// with the manager as a RESOLVED origin. Exchanges 2 and 3 add one destination each and reuse ONLY
// the decision shapes exchange 1 already exercises — an explicit focus shift that establishes a new
// Thread and sends the previous one dormant, an incidental subordinate CU, and two attending
// assistant CUs.
// ---------------------------------------------------------------------------------------------

const E1_USER = 'المدير بقى بيتعامل معايا بشكل غريب. أحمد اللي في الفريق قالّي إن الموضوع ده عادي. أحمد نفسه بدأ يقلقني.';
const E1_U1 = 'المدير بقى بيتعامل معايا بشكل غريب.';
const E1_U2 = 'أحمد اللي في الفريق قالّي إن الموضوع ده عادي.';
const E1_U3 = 'أحمد نفسه بدأ يقلقني.';
const E1_ASSISTANT = 'تقصد إن أحمد بيتجنبك؟ وإمتى ده بدأ؟';
const E1_A1 = 'تقصد إن أحمد بيتجنبك؟';
const E1_A2 = 'وإمتى ده بدأ؟';

const E2_USER = 'موضوع السفر لسه معلق وبيضايقني. والتذاكر غالية الفترة دي.';
const E2_U1 = 'موضوع السفر لسه معلق وبيضايقني.';
const E2_U2 = 'والتذاكر غالية الفترة دي.';
const E2_ASSISTANT = 'السفر ده مرتبط بشغلك؟ وإيه اللي معلقه؟';
const E2_A1 = 'السفر ده مرتبط بشغلك؟';
const E2_A2 = 'وإيه اللي معلقه؟';

const E3_USER = 'نومي بقى وحش من كام أسبوع. وبصحى مرهق كل يوم.';
const E3_U1 = 'نومي بقى وحش من كام أسبوع.';
const E3_U2 = 'وبصحى مرهق كل يوم.';
const E3_ASSISTANT = 'النوم ده اتغير من إمتى بالظبط؟ وبتنام كام ساعة؟';
const E3_A1 = 'النوم ده اتغير من إمتى بالظبط؟';
const E3_A2 = 'وبتنام كام ساعة؟';

/** Every conversational text this fixture commits, so a test can assert the spans resolve. */
export const FIXTURE_TEXTS = Object.freeze({
  E1_USER, E1_U1, E1_U2, E1_U3, E1_ASSISTANT, E1_A1, E1_A2,
  E2_USER, E2_U1, E2_U2, E2_ASSISTANT, E2_A1, E2_A2,
  E3_USER, E3_U1, E3_U2, E3_ASSISTANT, E3_A1, E3_A2,
});

/**
 * The world this fixture is sized to produce, and why each number is the minimum rather than a round
 * one. Asserted by the focused tests against the built payloads, so the shape cannot drift silently.
 */
export const EXPECTED_WORLD = Object.freeze({
  /** 13 committed CUs — 13 Moments, so a pinned TC can sit well inside history rather than beside the head. */
  committedUnits: 13,
  /** The Live Head after the third exchange. Session Positions are 1..13, strictly monotonic. */
  liveHead: 13,
  /**
   * FOUR spatial destinations. Three would give one short and one long hop; four gives a short, a
   * medium and a long one without inventing a Product concept to justify the fourth — each is an
   * ordinary explicit focus shift, which is the same decision exchange 1 already makes twice.
   */
  threads: 4,
  /** One Live-Focus change per established Thread. The intervening CUs sustain it unchanged. */
  liveFocusTransitions: 4,
  /** Three coordinator calls. Each is one finalized user/assistant exchange. */
  exchanges: 3,
});

// ---------------------------------------------------------------------------------------------
// The builder.
// ---------------------------------------------------------------------------------------------

/**
 * Builds the whole deterministic world for one validation Session.
 *
 * Returns an ORDERED list of exchanges. Each carries exactly the sixteen payload arguments
 * `commit_finalized_exchange_with_full_semantic_chain_v1` takes before its provenance, plus the two
 * source texts the caller must have committed as real conversation turns first.
 *
 * It writes nothing and knows nothing about a database.
 */
export function buildCanonicalWorld({ sessionId, userId }) {
  if (typeof sessionId !== 'string' || typeof userId !== 'string' || sessionId === '' || userId === '') {
    throw new Error('buildCanonicalWorld requires a sessionId and a userId');
  }
  const id = (label) => uuidV5(FIXTURE_NAMESPACE, `${sessionId}:${label}`);

  const focus = { manager: id('focus:manager'), ahmed: id('focus:ahmed'), travel: id('focus:travel'), sleep: id('focus:sleep') };
  const thread = {
    manager: threadIdOf(userId, focus.manager), ahmed: threadIdOf(userId, focus.ahmed),
    travel: threadIdOf(userId, focus.travel), sleep: threadIdOf(userId, focus.sleep),
  };
  const handle = { manager: id('handle:manager'), ahmed: id('handle:ahmed'), travel: id('handle:travel'), sleep: id('handle:sleep') };
  const cu = Object.fromEntries(
    ['u1', 'u2', 'u3', 'a1', 'a2', 'u4', 'u5', 'a3', 'a4', 'u6', 'u7', 'a5', 'a6'].map((k) => [k, id(`cu:${k}`)]),
  );

  /**
   * One later exchange: an explicit shift to a new destination, then two attending assistant CUs.
   *
   * `subject` carries the anchor text for EACH side separately, because the two sides say it
   * differently — the reader writes «نومي» and the assistant answers «النوم». Both resolve to the
   * same reference handle, which is what a handle is for; forcing one surface form on both would be
   * inventing wording neither speaker used, and the span contract would reject it anyway.
   */
  const shiftExchange = (label, texts, units, priorThread, newFocus, newThread, newHandle, subject) => ({
    label,
    userText: texts.user,
    assistantText: texts.assistant,
    userTurnId: id(`turn:${label}:user`),
    assistantTurnId: id(`turn:${label}:assistant`),
    userBatchId: id(`batch:${label}:user`),
    assistantBatchId: id(`batch:${label}:assistant`),
    userUnits: [unit(texts.user, texts.u1, units.first), unit(texts.user, texts.u2, units.second)],
    userBundles: [
      bundle(units.first, {
        functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequence_position: 'INITIATING',
        references: [resolved(texts.u1, subject.user, newHandle, true)],
        attention: startFocus(newFocus, 0, 'EXPLICIT_FOCUS_SHIFT'),
      }),
      bundle(units.second, { sequence_position: 'FOLLOW_UP', target_cu_id: units.first, attention: NO_FOCUS }),
    ],
    userThreads: [
      establish(userId, units.first, newFocus, [units.first], {
        explicit_selection_grounding: anchor(texts.u1, subject.user),
        origin_state: 'RESOLVED', origin_thread_ids: [priorThread],
      }),
      noEstablishment(units.second, 'NO_INDEPENDENT_FOCUS'),
    ],
    userLifecycle: [
      establishNew(sessionId, units.first, newFocus, newThread, [{ cu_id: units.first, reference_index: 0 }],
        [transition(sessionId, units.first, priorThread, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
      noAction(units.second),
    ],
    userLiveFocus: [
      lfChange(sessionId, units.first, 'THREAD', newThread, 'FOCUS_REPLACEMENT'),
      lfSame(units.second, 'THREAD', newThread),
    ],
    assistantUnits: [unit(texts.assistant, texts.a1, units.thirdA), unit(texts.assistant, texts.a2, units.fourthA)],
    assistantBundles: [
      bundle(units.thirdA, {
        functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: units.first,
        references: [resolved(texts.a1, subject.assistant, newHandle, false)],
        attention: attendFocus(newFocus, 0, 'DIRECT_REQUEST_OR_QUESTION'),
      }),
      bundle(units.fourthA, {
        functions: ['ASK'], sequence_position: 'FOLLOW_UP', target_cu_id: units.first,
        attention: attendFocus(newFocus, null, 'LOCAL_CLARIFICATION_OR_CORRECTION'),
      }),
    ],
    assistantThreads: [
      noEstablishment(units.thirdA, 'ALREADY_ESTABLISHED', newFocus),
      noEstablishment(units.fourthA, 'ALREADY_ESTABLISHED', newFocus),
    ],
    assistantLifecycle: [attendExisting(units.thirdA, newFocus, newThread), attendExisting(units.fourthA, newFocus, newThread)],
    assistantLiveFocus: [lfSame(units.thirdA, 'THREAD', newThread), lfSame(units.fourthA, 'THREAD', newThread)],
  });

  const exchanges = [
    // Exchange 1 — the repository's own proven scenario. Two destinations, one incidental CU.
    {
      label: 'exchange-1',
      userText: E1_USER,
      assistantText: E1_ASSISTANT,
      userTurnId: id('turn:exchange-1:user'),
      assistantTurnId: id('turn:exchange-1:assistant'),
      userBatchId: id('batch:exchange-1:user'),
      assistantBatchId: id('batch:exchange-1:assistant'),
      userUnits: [unit(E1_USER, E1_U1, cu.u1), unit(E1_USER, E1_U2, cu.u2), unit(E1_USER, E1_U3, cu.u3)],
      userBundles: [
        bundle(cu.u1, { sequence_position: 'INITIATING', references: [resolved(E1_U1, 'المدير', handle.manager, true)], attention: startFocus(focus.manager, 0) }),
        bundle(cu.u2, {
          sequence_position: 'FOLLOW_UP', target_cu_id: cu.u1,
          references: [resolved(E1_U2, 'أحمد', handle.ahmed, true)],
          claim_attributions: [claim(E1_U2, 'إن الموضوع ده عادي', 'REFERENCE_HANDLE', handle.ahmed, 'REPORTED_SPEECH')],
          attention: NO_FOCUS,
        }),
        bundle(cu.u3, {
          functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: cu.u2,
          references: [resolved(E1_U3, 'أحمد', handle.ahmed, false)],
          attention: startFocus(focus.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT'),
        }),
      ],
      userThreads: [
        establish(userId, cu.u1, focus.manager, [cu.u1], { explicit_selection_grounding: anchor(E1_U1, 'المدير') }),
        noEstablishment(cu.u2, 'NO_INDEPENDENT_FOCUS'),
        establish(userId, cu.u3, focus.ahmed, [cu.u3], {
          explicit_selection_grounding: anchor(E1_U3, 'أحمد'), origin_state: 'RESOLVED', origin_thread_ids: [thread.manager],
        }),
      ],
      userLifecycle: [
        establishNew(sessionId, cu.u1, focus.manager, thread.manager, [{ cu_id: cu.u1, reference_index: 0 }]),
        noAction(cu.u2),
        establishNew(sessionId, cu.u3, focus.ahmed, thread.ahmed, [{ cu_id: cu.u3, reference_index: 0 }],
          [transition(sessionId, cu.u3, thread.manager, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
      ],
      userLiveFocus: [
        lfChange(sessionId, cu.u1, 'THREAD', thread.manager, 'NEW_INDEPENDENT_FOCUS'),
        lfSame(cu.u2, 'THREAD', thread.manager),
        lfChange(sessionId, cu.u3, 'THREAD', thread.ahmed, 'FOCUS_REPLACEMENT'),
      ],
      assistantUnits: [unit(E1_ASSISTANT, E1_A1, cu.a1), unit(E1_ASSISTANT, E1_A2, cu.a2)],
      assistantBundles: [
        bundle(cu.a1, {
          functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: cu.u3,
          references: [resolved(E1_A1, 'أحمد', handle.ahmed, false)],
          attention: attendFocus(focus.ahmed, 0, 'DIRECT_REQUEST_OR_QUESTION'),
        }),
        bundle(cu.a2, { functions: ['ASK'], sequence_position: 'FOLLOW_UP', target_cu_id: cu.u3, attention: attendFocus(focus.ahmed, null, 'LOCAL_CLARIFICATION_OR_CORRECTION') }),
      ],
      assistantThreads: [noEstablishment(cu.a1, 'ALREADY_ESTABLISHED', focus.ahmed), noEstablishment(cu.a2, 'ALREADY_ESTABLISHED', focus.ahmed)],
      assistantLifecycle: [attendExisting(cu.a1, focus.ahmed, thread.ahmed), attendExisting(cu.a2, focus.ahmed, thread.ahmed)],
      assistantLiveFocus: [lfSame(cu.a1, 'THREAD', thread.ahmed), lfSame(cu.a2, 'THREAD', thread.ahmed)],
    },
    // Exchange 2 — a third destination.
    shiftExchange('exchange-2',
      { user: E2_USER, u1: E2_U1, u2: E2_U2, assistant: E2_ASSISTANT, a1: E2_A1, a2: E2_A2 },
      { first: cu.u4, second: cu.u5, thirdA: cu.a3, fourthA: cu.a4 },
      thread.ahmed, focus.travel, thread.travel, handle.travel, { user: 'السفر', assistant: 'السفر' }),
    // Exchange 3 — a fourth destination.
    shiftExchange('exchange-3',
      { user: E3_USER, u1: E3_U1, u2: E3_U2, assistant: E3_ASSISTANT, a1: E3_A1, a2: E3_A2 },
      { first: cu.u6, second: cu.u7, thirdA: cu.a5, fourthA: cu.a6 },
      thread.travel, focus.sleep, thread.sleep, handle.sleep, { user: 'نومي', assistant: 'النوم' }),
  ];

  return { sessionId, userId, focus, thread, handle, cu, exchanges };
}
