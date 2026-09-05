import { RFC4122_URL_NAMESPACE, uuidV5 } from '../runtime-identity/uuid-v5';
import {
  canonicalizePreparedThreadLayerDecision,
  canonicalizePreparedThreadLayerSequence,
  durableThreadFocusBindingId,
  durableThreadLifecycleEventId,
  THREAD_FOCUS_BINDING_NAMESPACE,
  THREAD_LIFECYCLE_EVENT_NAMESPACE,
  type PreparedThreadLayerDecision,
} from './durable-thread-lifecycle-canonicalizer';
import { ThreadLifecycleCanonicalizationError } from './durable-thread-lifecycle-payload.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const CU = '11111111-2222-4333-8444-555555555555';
const CU2 = '11111111-2222-4333-8444-666666666666';
const FOCUS = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
const THREAD = 'afc4fd81-fe54-5738-9545-e1053044d919';
const OTHER = '11111111-1111-4111-8111-111111111111';
const THIRD = '22222222-2222-4222-8222-222222222222';

const decision = (overrides: Partial<PreparedThreadLayerDecision> = {}): PreparedThreadLayerDecision => ({
  cuId: CU, outcome: 'NO_THREAD_ACTION', emergingFocusId: null, threadId: null,
  identityEvidence: [], priorIdentityEvidence: [], candidateThreadIds: [], transitions: [], ...overrides,
});
const fails = (input: PreparedThreadLayerDecision, reason: string) => {
  expect(() => canonicalizePreparedThreadLayerDecision(input, { sessionId: SESSION })).toThrow(ThreadLifecycleCanonicalizationError);
  try { canonicalizePreparedThreadLayerDecision(input, { sessionId: SESSION }); } catch (error) { expect((error as ThreadLifecycleCanonicalizationError).reason).toBe(reason); }
};

describe('the durable Thread-layer canonicalizer (cases 21-32)', () => {
  it('21. the namespaces and identities are the frozen RFC 4122 version-5 derivations, pinned exactly', () => {
    expect(THREAD_FOCUS_BINDING_NAMESPACE).toBe('194bb7c5-906f-5228-8116-b4c99b34bd76');
    expect(THREAD_LIFECYCLE_EVENT_NAMESPACE).toBe('9fbd9e6c-f8a4-529b-bd97-46f75cb068d3');
    expect(THREAD_FOCUS_BINDING_NAMESPACE).toBe(uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-focus-binding/v1'));
    expect(THREAD_LIFECYCLE_EVENT_NAMESPACE).toBe(uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-lifecycle-event/v1'));
    expect(durableThreadFocusBindingId(SESSION, FOCUS, THREAD)).toBe('81db0320-39e5-5053-adc5-6d9c993f5ec7');
    expect(durableThreadLifecycleEventId(SESSION, CU, THREAD, 'DORMANT')).toBe('3150f4a8-1f76-5ed4-9936-53dc2d72ee78');
    expect(durableThreadLifecycleEventId(SESSION, CU, THREAD, 'REOPENED')).toBe('45873543-9eb6-5679-ae70-befb05f4ee86');
    // Deterministic across calls and sensitive to every input.
    expect(durableThreadFocusBindingId(SESSION, FOCUS, THREAD)).toBe(durableThreadFocusBindingId(SESSION, FOCUS, THREAD));
    expect(durableThreadFocusBindingId(SESSION, FOCUS, OTHER)).not.toBe(durableThreadFocusBindingId(SESSION, FOCUS, THREAD));
    expect(durableThreadLifecycleEventId(SESSION, CU, THREAD, 'ACTIVE')).not.toBe(durableThreadLifecycleEventId(SESSION, CU, THREAD, 'DORMANT'));
  });

  it('22. ESTABLISH_NEW carries an ESTABLISHMENT binding with the derived binding id and its evidence', () => {
    const payload = canonicalizePreparedThreadLayerDecision(decision({
      outcome: 'ESTABLISH_NEW', emergingFocusId: FOCUS, threadId: THREAD, identityEvidence: [{ cuId: CU, referenceIndex: 0 }],
    }), { sessionId: SESSION });
    expect(payload).toEqual({
      unit_id: CU, outcome: 'ESTABLISH_NEW', emerging_focus_id: FOCUS, thread_id: THREAD, binding_kind: 'ESTABLISHMENT',
      focus_binding_id: '81db0320-39e5-5053-adc5-6d9c993f5ec7', identity_evidence: [{ cu_id: CU, reference_index: 0 }],
      prior_identity_evidence: [], candidate_thread_ids: [], lifecycle_transitions: [],
    });
    expect(Object.keys(payload)).toHaveLength(10);
    expect(Object.isFrozen(payload)).toBe(true);
  });

  it('23. ACTIVATE_EXISTING_IN_SESSION carries a SESSION_CONTINUITY binding, current evidence and prior dossier refs', () => {
    const payload = canonicalizePreparedThreadLayerDecision(decision({
      outcome: 'ACTIVATE_EXISTING_IN_SESSION', emergingFocusId: FOCUS, threadId: THREAD,
      identityEvidence: [{ cuId: CU, referenceIndex: 0 }, { cuId: CU, referenceIndex: 2 }], priorIdentityEvidence: [{ cuId: CU2, exactSurface: 'أحمد' }],
    }), { sessionId: SESSION });
    expect(payload.binding_kind).toBe('SESSION_CONTINUITY');
    expect(payload.focus_binding_id).toBe(durableThreadFocusBindingId(SESSION, FOCUS, THREAD));
    expect(payload.prior_identity_evidence).toEqual([{ cu_id: CU2, exact_surface: 'أحمد' }]);
    expect(payload.identity_evidence).toEqual([{ cu_id: CU, reference_index: 0 }, { cu_id: CU, reference_index: 2 }]);
  });

  it('24. ATTEND_EXISTING and REOPEN_EXISTING create no binding; the reopening transition is derived onto the own Thread', () => {
    const attend = canonicalizePreparedThreadLayerDecision(decision({ outcome: 'ATTEND_EXISTING', emergingFocusId: FOCUS, threadId: THREAD }), { sessionId: SESSION });
    expect([attend.binding_kind, attend.focus_binding_id, attend.lifecycle_transitions]).toEqual([null, null, []]);
    const reopen = canonicalizePreparedThreadLayerDecision(decision({
      outcome: 'REOPEN_EXISTING', emergingFocusId: FOCUS, threadId: THREAD,
      transitions: [{ threadId: THREAD, fromState: 'DORMANT', toState: 'REOPENED', reasonCode: 'GENUINE_RETURN' }],
    }), { sessionId: SESSION });
    expect(reopen.lifecycle_transitions).toEqual([{ thread_id: THREAD, to_state: 'REOPENED', reason_code: 'GENUINE_RETURN', lifecycle_event_id: '45873543-9eb6-5679-ae70-befb05f4ee86' }]);
    // from_state never crosses the boundary: the database derives it.
    expect(JSON.stringify(reopen)).not.toContain('from_state');
    expect(JSON.stringify(reopen)).not.toContain('fromState');
  });

  it('25. IDENTITY_AMBIGUOUS carries at least two candidates in canonical textual order and nothing else', () => {
    const payload = canonicalizePreparedThreadLayerDecision(decision({ outcome: 'IDENTITY_AMBIGUOUS', emergingFocusId: FOCUS, candidateThreadIds: [THREAD, OTHER, THIRD] }), { sessionId: SESSION });
    expect(payload.candidate_thread_ids).toEqual([OTHER, THIRD, THREAD]);
    expect([payload.thread_id, payload.binding_kind, payload.focus_binding_id]).toEqual([null, null, null]);
    fails(decision({ outcome: 'IDENTITY_AMBIGUOUS', emergingFocusId: FOCUS, candidateThreadIds: [THREAD] }), 'INVALID_CANDIDATE_CARDINALITY');
    fails(decision({ outcome: 'IDENTITY_AMBIGUOUS', emergingFocusId: FOCUS, candidateThreadIds: [THREAD, THREAD] }), 'DUPLICATE_CANDIDATE_THREAD');
    fails(decision({ outcome: 'IDENTITY_AMBIGUOUS', emergingFocusId: null, candidateThreadIds: [THREAD, OTHER] }), 'INVALID_OUTCOME_SHAPE');
    fails(decision({ outcome: 'IDENTITY_AMBIGUOUS', emergingFocusId: FOCUS, threadId: THREAD, candidateThreadIds: [THREAD, OTHER] }), 'INVALID_OUTCOME_SHAPE');
  });

  it('26. NO_THREAD_ACTION is a typed no-op payload, with or without an (unbound) focus', () => {
    const none = canonicalizePreparedThreadLayerDecision(decision(), { sessionId: SESSION });
    expect(none).toMatchObject({ outcome: 'NO_THREAD_ACTION', emerging_focus_id: null, thread_id: null, binding_kind: null, focus_binding_id: null });
    expect(canonicalizePreparedThreadLayerDecision(decision({ emergingFocusId: FOCUS }), { sessionId: SESSION }).emerging_focus_id).toBe(FOCUS);
    fails(decision({ threadId: THREAD }), 'INVALID_OUTCOME_SHAPE');
    fails(decision({ candidateThreadIds: [THREAD, OTHER] }), 'INVALID_CANDIDATE_CARDINALITY');
  });

  it('27. several transitions of one CU are ordered canonically and share nothing but the CU', () => {
    const payload = canonicalizePreparedThreadLayerDecision(decision({
      outcome: 'ATTEND_EXISTING', emergingFocusId: FOCUS, threadId: THREAD,
      transitions: [
        { threadId: THIRD, fromState: 'ACTIVE', toState: 'DORMANT', reasonCode: 'EXPLICIT_FOCUS_SHIFT' },
        { threadId: THREAD, fromState: 'REOPENED', toState: 'ACTIVE', reasonCode: 'CONTINUED_ANCHORING' },
        { threadId: OTHER, fromState: 'REOPENED', toState: 'DORMANT', reasonCode: 'SUSTAINED_DEPARTURE' },
      ],
    }), { sessionId: SESSION });
    expect(payload.lifecycle_transitions.map((t) => t.thread_id)).toEqual([OTHER, THIRD, THREAD]);
    expect(new Set(payload.lifecycle_transitions.map((t) => t.lifecycle_event_id)).size).toBe(3);
  });

  it('28. an illegal, duplicated, self-reopening or foreign-reopening transition never crosses the boundary', () => {
    const base = { outcome: 'ATTEND_EXISTING' as const, emergingFocusId: FOCUS, threadId: THREAD };
    fails(decision({ ...base, transitions: [{ threadId: OTHER, fromState: 'DORMANT', toState: 'ACTIVE', reasonCode: 'CONTINUED_ANCHORING' }] }), 'INVALID_TRANSITION');
    fails(decision({ ...base, transitions: [{ threadId: OTHER, fromState: 'ACTIVE', toState: 'REOPENED', reasonCode: 'GENUINE_RETURN' }] }), 'INVALID_TRANSITION');
    fails(decision({ ...base, transitions: [{ threadId: OTHER, fromState: 'ACTIVE', toState: 'DORMANT', reasonCode: 'GENUINE_RETURN' }] }), 'INVALID_TRANSITION');
    fails(decision({ ...base, transitions: [
      { threadId: OTHER, fromState: 'ACTIVE', toState: 'DORMANT', reasonCode: 'EXPLICIT_FOCUS_SHIFT' },
      { threadId: OTHER, fromState: 'ACTIVE', toState: 'DORMANT', reasonCode: 'SUSTAINED_DEPARTURE' },
    ] }), 'DUPLICATE_TRANSITION_THREAD');
    // A reopening belongs to the own Thread only; a Thread bound at this CU cannot transition.
    fails(decision({ ...base, transitions: [{ threadId: OTHER, fromState: 'DORMANT', toState: 'REOPENED', reasonCode: 'GENUINE_RETURN' }] }), 'INVALID_TRANSITION');
    fails(decision({ outcome: 'ESTABLISH_NEW', emergingFocusId: FOCUS, threadId: THREAD, identityEvidence: [{ cuId: CU, referenceIndex: 0 }],
      transitions: [{ threadId: THREAD, fromState: 'ACTIVE', toState: 'DORMANT', reasonCode: 'EXPLICIT_FOCUS_SHIFT' }] }), 'INVALID_TRANSITION');
    fails(decision({ outcome: 'REOPEN_EXISTING', emergingFocusId: FOCUS, threadId: THREAD, transitions: [] }), 'INVALID_TRANSITION');
  });

  it('29. evidence shape is enforced per outcome: required where a binding is made, forbidden elsewhere', () => {
    fails(decision({ outcome: 'ESTABLISH_NEW', emergingFocusId: FOCUS, threadId: THREAD }), 'INVALID_EVIDENCE_SHAPE');
    fails(decision({ outcome: 'ACTIVATE_EXISTING_IN_SESSION', emergingFocusId: FOCUS, threadId: THREAD, identityEvidence: [{ cuId: CU, referenceIndex: 0 }] }), 'INVALID_EVIDENCE_SHAPE');
    fails(decision({ outcome: 'ESTABLISH_NEW', emergingFocusId: FOCUS, threadId: THREAD, identityEvidence: [{ cuId: CU, referenceIndex: 0 }], priorIdentityEvidence: [{ cuId: CU2, exactSurface: 'x' }] }), 'INVALID_EVIDENCE_SHAPE');
    fails(decision({ outcome: 'ATTEND_EXISTING', emergingFocusId: FOCUS, threadId: THREAD, identityEvidence: [{ cuId: CU, referenceIndex: 0 }] }), 'INVALID_EVIDENCE_SHAPE');
    fails(decision({ outcome: 'ESTABLISH_NEW', emergingFocusId: FOCUS, threadId: THREAD, identityEvidence: [{ cuId: CU, referenceIndex: 1 }, { cuId: CU, referenceIndex: 0 }] }), 'INVALID_EVIDENCE_SHAPE');
    fails(decision({ outcome: 'ACTIVATE_EXISTING_IN_SESSION', emergingFocusId: FOCUS, threadId: THREAD, identityEvidence: [{ cuId: CU, referenceIndex: 0 }], priorIdentityEvidence: [{ cuId: CU2, exactSurface: '' }] }), 'INVALID_EVIDENCE_SHAPE');
  });

  it('30. every identity is a canonical UUID and no transient prepared identity survives', () => {
    fails(decision({ cuId: 'prepared:cu' }), 'INVALID_CANONICAL_UNIT_ID');
    fails(decision({ outcome: 'ATTEND_EXISTING', emergingFocusId: 'prepared:focus', threadId: THREAD }), 'INVALID_DURABLE_IDENTITY');
    fails(decision({ outcome: 'ATTEND_EXISTING', emergingFocusId: FOCUS, threadId: 'not-a-uuid' }), 'INVALID_DURABLE_IDENTITY');
    expect(() => canonicalizePreparedThreadLayerDecision(decision(), { sessionId: 'prepared:session' })).toThrow(ThreadLifecycleCanonicalizationError);
    expect(() => canonicalizePreparedThreadLayerSequence([decision()], { sessionId: SESSION })).not.toThrow();
  });

  it('31. a sequence canonicalizes in order, one payload per CU, frozen', () => {
    const sequence = canonicalizePreparedThreadLayerSequence([
      decision(), decision({ cuId: CU2, outcome: 'ATTEND_EXISTING', emergingFocusId: FOCUS, threadId: THREAD }),
    ], { sessionId: SESSION });
    expect(sequence.units.map((u) => [u.unit_id, u.outcome])).toEqual([[CU, 'NO_THREAD_ACTION'], [CU2, 'ATTEND_EXISTING']]);
    expect(Object.isFrozen(sequence.units)).toBe(true);
    expect(JSON.stringify(sequence)).not.toContain('prepared:');
  });

  it('32. nothing spatial, graded, temporal or global is representable in the boundary', () => {
    const payload = canonicalizePreparedThreadLayerDecision(decision({
      outcome: 'ACTIVATE_EXISTING_IN_SESSION', emergingFocusId: FOCUS, threadId: THREAD,
      identityEvidence: [{ cuId: CU, referenceIndex: 0 }], priorIdentityEvidence: [{ cuId: CU2, exactSurface: 'أحمد' }],
      transitions: [{ threadId: OTHER, fromState: 'ACTIVE', toState: 'DORMANT', reasonCode: 'EXPLICIT_FOCUS_SHIFT' }],
    }), { sessionId: SESSION });
    const wire = JSON.stringify(payload);
    for (const forbidden of ['placement', 'home_anchor', 'score', 'confidence', 'similarity', 'rank', 'importance', 'created_at', 'session_position', 'same_sp', 'from_state', 'global', 'merge']) {
      expect(wire.includes(forbidden)).toBe(false);
    }
    expect(Object.keys(payload).sort()).toEqual(['binding_kind', 'candidate_thread_ids', 'emerging_focus_id', 'focus_binding_id', 'identity_evidence', 'lifecycle_transitions', 'outcome', 'prior_identity_evidence', 'thread_id', 'unit_id']);
  });
});
