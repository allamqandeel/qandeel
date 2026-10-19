// S7-03 — the real-PostgreSQL proof world of the Historical Replay Composite Visual Proof. PROOF CAPTURE ONLY.
//
// It is not a verifier and asserts nothing about a migration (0169's verifier is `verify-migration-0169.mjs`). It builds
// one known history through the system's own authorities and records what the S7-01 read boundary answers about it, so
// the composite proof renders truth that came out of the real historical path rather than data drawn to look right:
//
//   1. one human, and one COVERED Personal conversation committed through the FINAL coordinator's full semantic chain
//      (`commit_finalized_exchange_with_full_semantic_chain_v1`), exactly the frozen T-03D Session 1 the 0072 verifier
//      proves: the manager Thread is established at SP(1), Ahmed is mentioned incidentally at SP(2), Ahmed's Thread is
//      established at SP(3) and the manager's goes DORMANT, the assistant attends Ahmed at SP(4) and SP(5). A quiet
//      exchange then commits SP(6) and SP(7), so SP(1) .. SP(6) are SEALED and SP(7) is the open Live Head;
//   2. two Readings staged at the substrate exactly as `replay-personal-verifier-support.mjs` stages them (the canonical
//      analytical state is a set of typed SP-native availability events): Reading A known from SP(2), Reading B from
//      SP(4), Reading A ACTIVE from SP(6). K(TC) is always computed by the canonical projection; nothing here bypasses
//      it;
//   3. the operator's Personal Replay gate switch, set the way the 0169 verifier sets it (database owner only), so the
//      existing authority path can produce PREVIEW_READY versions — never a user-facing opening;
//   4. every Replay act and read through the 0169 wrappers, called as the human (`authenticated` with the human's own
//      claims), and recorded as PostgREST would serialize the row (`to_jsonb`);
//   5. the bounded states, each produced on the real path as the 0169 verifier produces it (E05 / E06 / E07 / E08).
//
// Everything runs in ONE transaction that is ROLLED BACK: the database is left exactly as it was.
//
//   DATABASE_URL=postgres://... node database/replay-composite-proof-world.mjs <out.json>
//
// The output is the raw-row capture. `apps/api/src/replay/replay-history-proof.spec.ts` maps it through the REAL
// ReplayService into the wire answers the mobile proof renders (`apps/mobile/src/replay-composite/__fixtures__/replay-wire.json`;
// the rows stay in `tests/fixtures/s7-03-replay-history/`).
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createPersonalReplayRuntime, W } from './replay-personal-verifier-support.mjs';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node database/replay-composite-proof-world.mjs <out.json>');
const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows } = rt;
const one = async (text, values = []) => (await rows(text, values))[0];

// ------------------------------------------------------------ the frozen 0072 / T-03D provenance and identities
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const CONTINUITY_PROVENANCE = ['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1'];
const LF_REDUCER_VERSION = 'live-focus-reducer-v1';
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

const RFC4122_URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function uuidV5(namespace, name) {
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
const FOCUS_BINDING_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-focus-binding/v1');
const LIFECYCLE_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-lifecycle-event/v1');
const LIVE_FOCUS_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/live-focus-transition/v1');
const threadIdOf = (userId, focusId) => uuidV5(THREAD_NAMESPACE, `${userId}:${focusId}`);
const focusBindingIdOf = (sessionId, focusId, threadId) => uuidV5(FOCUS_BINDING_NAMESPACE, `${sessionId}:${focusId}:${threadId}`);
const lifecycleEventIdOf = (sessionId, cuId, threadId, toState) => uuidV5(LIFECYCLE_NAMESPACE, `${sessionId}:${cuId}:${threadId}:${toState}`);
const lfEventIdOf = (sessionId, cuId, kind, ref) => uuidV5(LIVE_FOCUS_NAMESPACE, `${sessionId}:${cuId}:${kind}:${ref ?? 'NONE'}`);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// The frozen T-03D Session 1 (verify-migration-0072.mjs), word for word.
const USER_TEXT = 'المدير بقى بيتعامل معايا بشكل غريب. أحمد اللي في الفريق قالّي إن الموضوع ده عادي. أحمد نفسه بدأ يقلقني.';
const ASSISTANT_TEXT = 'تقصد إن أحمد بيتجنبك؟ وإمتى ده بدأ؟';
const U1 = 'المدير بقى بيتعامل معايا بشكل غريب.';
const U2 = 'أحمد اللي في الفريق قالّي إن الموضوع ده عادي.';
const U3 = 'أحمد نفسه بدأ يقلقني.';
const A1 = 'تقصد إن أحمد بيتجنبك؟';
const A2 = 'وإمتى ده بدأ؟';
const QUIET_TEXT = 'وكمان الشغل كتير الأيام دي.';
const QUIET_REPLY = 'فاهم، ده ضغط زيادة.';

const points = (value) => Array.from(value);
function spanOf(content, excerpt, occurrence = 1) {
  const source = points(content);
  const needle = points(excerpt);
  let seen = 0;
  for (let start = 0; start + needle.length <= source.length; start += 1) {
    if (needle.every((ch, offset) => source[start + offset] === ch)) {
      seen += 1;
      if (seen === occurrence) return { start, end: start + needle.length };
    }
  }
  throw new Error(`fixture excerpt not found: ${excerpt}`);
}
const unit = (content, excerpt, occurrence = 1, id = randomUUID()) => {
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
const NO_FOCUS = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };
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
const establish = (userId, unitId, focusId, path, evidenceCuIds, overrides = {}) => {
  const threadId = threadIdOf(userId, focusId);
  return {
    unit_id: unitId, decision: 'ESTABLISH_THREAD', no_establishment_reason: null, emerging_focus_id: focusId, path,
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
const transition = (session, cuId, threadId, toState, reasonCode) =>
  ({ thread_id: threadId, to_state: toState, reason_code: reasonCode, lifecycle_event_id: lifecycleEventIdOf(session, cuId, threadId, toState) });
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
  lifecycle_transitions: [...(overrides.lifecycle_transitions ?? [])].sort((a, b) => byText(a.thread_id, b.thread_id)),
});
const establishNew = (session, unitId, focusId, threadId, evidence, transitions = []) => lifecycle(unitId, {
  outcome: 'ESTABLISH_NEW', emerging_focus_id: focusId, thread_id: threadId, binding_kind: 'ESTABLISHMENT',
  focus_binding_id: focusBindingIdOf(session, focusId, threadId), identity_evidence: evidence, lifecycle_transitions: transitions,
});
const attendExisting = (unitId, focusId, threadId, transitions = []) => lifecycle(unitId, {
  outcome: 'ATTEND_EXISTING', emerging_focus_id: focusId, thread_id: threadId, lifecycle_transitions: transitions,
});
const noAction = (unitId, focusId = null, transitions = []) => lifecycle(unitId, { emerging_focus_id: focusId, lifecycle_transitions: transitions });
const lfChange = (session, unitId, kind, ref, reason) => ({
  unit_id: unitId, effective_kind: kind, effective_ref: ref, transition: true, reason_code: reason,
  transition_event_id: lfEventIdOf(session, unitId, kind, ref),
});
const lfSame = (unitId, kind, ref) => ({ unit_id: unitId, effective_kind: kind, effective_ref: ref, transition: false, reason_code: null, transition_event_id: null });

// ------------------------------------------------------------ the substrate primitives (the 0072 verifier's own)
async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}
/** One physical transaction stands for several logical ones: the capture context is cleared as a commit would clear it. */
async function newLogicalTransaction() {
  await identity('postgres');
  await q("SELECT set_config('qandeel.historical_capture_context', '', true)");
}
const exchange = (session, user, userTurn, userBatch, userUnits, userBundles, userThreads, userLifecycle, userLiveFocus,
  assistantTurn, assistantBatch, assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus, token) =>
  rows(`SELECT * FROM commit_finalized_exchange_with_full_semantic_chain_v1(
    $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
    $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`,
  [session, user, userTurn, userBatch, JSON.stringify(userUnits), JSON.stringify(userBundles), JSON.stringify(userThreads), JSON.stringify(userLifecycle), JSON.stringify(userLiveFocus),
    assistantTurn, assistantBatch, JSON.stringify(assistantUnits), JSON.stringify(assistantBundles), JSON.stringify(assistantThreads), JSON.stringify(assistantLifecycle), JSON.stringify(assistantLiveFocus),
    ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION, token.sp, token.seq, token.version]);
const clockOf = (session) => one('SELECT current_sp, same_sp_event_sequence::text seq FROM public.session_semantic_clocks WHERE session_id=$1', [session]);
const identityVersionOf = async (user) =>
  (await one('SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id=$1), 0)::text v', [user])).v;

/** A completed USER -> ASSISTANT exchange through the frozen turn authorities. */
async function completedTurns(owner, session, content, reply) {
  await identity('authenticated', owner);
  const userTurn = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [userTurn, session, content, null]);
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, userTurn, ...ROUTE]);
  const assistantTurn = randomUUID();
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [session, owner, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
  assert.equal(finalized.length, 1, 'fixture exchange finalized');
  await identity('postgres');
  return { userTurn, assistantTurn };
}

/** T-03D Session 1 (SP1 .. SP5), exactly as `verify-migration-0072.mjs` commits it. */
async function sessionOne(owner) {
  const session = randomUUID();
  await identity('postgres');
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [session, owner]);
  const turns = await completedTurns(owner, session, USER_TEXT, ASSISTANT_TEXT);
  const ids = { u1: randomUUID(), u2: randomUUID(), u3: randomUUID(), a1: randomUUID(), a2: randomUUID() };
  const handles = { manager: randomUUID(), ahmed: randomUUID() };
  const focuses = { manager: randomUUID(), ahmed: randomUUID() };
  const threads = { manager: threadIdOf(owner, focuses.manager), ahmed: threadIdOf(owner, focuses.ahmed) };
  const userUnits = [unit(USER_TEXT, U1, 1, ids.u1), unit(USER_TEXT, U2, 1, ids.u2), unit(USER_TEXT, U3, 1, ids.u3)];
  const userBundles = [
    bundle(ids.u1, { sequence_position: 'INITIATING', references: [resolved(U1, 'المدير', handles.manager, true)], attention: startFocus(focuses.manager, 0) }),
    bundle(ids.u2, { sequence_position: 'FOLLOW_UP', target_cu_id: ids.u1,
      references: [resolved(U2, 'أحمد', handles.ahmed, true)],
      claim_attributions: [claim(U2, 'إن الموضوع ده عادي', 'REFERENCE_HANDLE', handles.ahmed, 'REPORTED_SPEECH')],
      attention: NO_FOCUS }),
    bundle(ids.u3, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u2,
      references: [resolved(U3, 'أحمد', handles.ahmed, false)], attention: startFocus(focuses.ahmed, 0, 'EXPLICIT_FOCUS_SHIFT') }),
  ];
  const userThreads = [
    establish(owner, ids.u1, focuses.manager, 'TE-01', [ids.u1], { explicit_selection_grounding: anchor(U1, 'المدير') }),
    noEstablishment(ids.u2, 'NO_INDEPENDENT_FOCUS'),
    establish(owner, ids.u3, focuses.ahmed, 'TE-01', [ids.u3],
      { explicit_selection_grounding: anchor(U3, 'أحمد'), origin_state: 'RESOLVED', origin_thread_ids: [threads.manager] }),
  ];
  const userLifecycle = [
    establishNew(session, ids.u1, focuses.manager, threads.manager, [{ cu_id: ids.u1, reference_index: 0 }]),
    noAction(ids.u2),
    establishNew(session, ids.u3, focuses.ahmed, threads.ahmed, [{ cu_id: ids.u3, reference_index: 0 }],
      [transition(session, ids.u3, threads.manager, 'DORMANT', 'EXPLICIT_FOCUS_SHIFT')]),
  ];
  const userLiveFocus = [
    lfChange(session, ids.u1, 'THREAD', threads.manager, 'NEW_INDEPENDENT_FOCUS'),
    lfSame(ids.u2, 'THREAD', threads.manager),
    lfChange(session, ids.u3, 'THREAD', threads.ahmed, 'FOCUS_REPLACEMENT'),
  ];
  const assistantUnits = [unit(ASSISTANT_TEXT, A1, 1, ids.a1), unit(ASSISTANT_TEXT, A2, 1, ids.a2)];
  const assistantBundles = [
    bundle(ids.a1, { functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u3,
      references: [resolved(A1, 'أحمد', handles.ahmed, false)], attention: attendFocus(focuses.ahmed, 0, 'DIRECT_REQUEST_OR_QUESTION') }),
    bundle(ids.a2, { functions: ['ASK'], sequence_position: 'FOLLOW_UP', target_cu_id: ids.u3,
      references: [], attention: attendFocus(focuses.ahmed, null, 'LOCAL_CLARIFICATION_OR_CORRECTION') }),
  ];
  const assistantThreads = [noEstablishment(ids.a1, 'ALREADY_ESTABLISHED', focuses.ahmed), noEstablishment(ids.a2, 'ALREADY_ESTABLISHED', focuses.ahmed)];
  const assistantLifecycle = [attendExisting(ids.a1, focuses.ahmed, threads.ahmed), attendExisting(ids.a2, focuses.ahmed, threads.ahmed)];
  const assistantLiveFocus = [lfSame(ids.a1, 'THREAD', threads.ahmed), lfSame(ids.a2, 'THREAD', threads.ahmed)];
  await identity('postgres');
  const [result] = await exchange(session, owner, turns.userTurn, randomUUID(), userUnits, userBundles, userThreads, userLifecycle, userLiveFocus,
    turns.assistantTurn, randomUUID(), assistantUnits, assistantBundles, assistantThreads, assistantLifecycle, assistantLiveFocus,
    { sp: null, seq: 0, version: await identityVersionOf(owner) });
  assert.equal(result.live_head, 5, 'Session 1 committed SP1 .. SP5');
  return { session, ids, focuses, threads };
}

/** A quiet USER -> ASSISTANT exchange with no focus change: SP6 and SP7, the Live Focus unchanged (Ahmed's Thread). */
async function quietExchange(owner, world) {
  const turns = await completedTurns(owner, world.session, QUIET_TEXT, QUIET_REPLY);
  const ids = { u: randomUUID(), a: randomUUID() };
  const clock = await clockOf(world.session);
  const version = await identityVersionOf(owner);
  await identity('postgres');
  const [result] = await exchange(world.session, owner, turns.userTurn, randomUUID(),
    [unit(QUIET_TEXT, QUIET_TEXT, 1, ids.u)],
    [bundle(ids.u, { sequence_position: 'FOLLOW_UP', references: [], attention: NO_FOCUS })],
    [noEstablishment(ids.u, 'NO_INDEPENDENT_FOCUS')], [noAction(ids.u)], [lfSame(ids.u, 'THREAD', world.threads.ahmed)],
    turns.assistantTurn, randomUUID(),
    [unit(QUIET_REPLY, QUIET_REPLY, 1, ids.a)],
    [bundle(ids.a, { functions: ['ACKNOWLEDGE'], sequence_position: 'RESPONSIVE', target_cu_id: ids.u, references: [], attention: NO_FOCUS })],
    [noEstablishment(ids.a, 'NO_INDEPENDENT_FOCUS')], [noAction(ids.a)], [lfSame(ids.a, 'THREAD', world.threads.ahmed)],
    { sp: clock.current_sp, seq: Number(clock.seq), version });
  assert.equal(result.live_head, 7, 'the quiet exchange committed SP6 and SP7');
  return { liveHead: result.live_head };
}

/** Readings staged as SP-native availability events, as `replay-personal-verifier-support.mjs` stages them. */
async function stageReadings(owner, session) {
  await identity('postgres');
  const [{ v }] = await rows('SELECT COALESCE((SELECT current_version FROM public.historical_world_semantic_clocks WHERE user_id=$1), 0)::bigint v', [owner]);
  const world = Number(v);
  const readingA = randomUUID();
  const readingB = randomUUID();
  await rt.asReplica(async () => {
    const hypothesis = (id, statement) => q(
      `INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, version)
       VALUES ($1, $2, $3, 'CAUSAL', 'GENERAL', $4, 'SYSTEM_GENERATED', 'CANDIDATE', 1)`,
      [id, owner, statement, `CONVERSATION_SESSION:${session}`]);
    await hypothesis(readingA, 'تعامل المدير تغيّر منذ وقت قريب.');
    await hypothesis(readingB, 'قلق المتحدث من أحمد أصبح هو الموضوع الأقرب.');
    const event = (hypothesisId, kind, fromStatus, toStatus, fromVersion, toVersion, at, worldVersion) => q(
      `INSERT INTO public.historical_reading_events
         (event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
          session_id, session_position, same_sp_event_sequence, world_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11)`,
      [randomUUID(), owner, hypothesisId, kind, fromStatus, toStatus, fromVersion, toVersion, session, at, worldVersion]);
    await event(readingA, 'CREATED', null, 'CANDIDATE', null, 1, 2, world + 1);
    await event(readingB, 'CREATED', null, 'CANDIDATE', null, 1, 4, world + 2);
    await event(readingA, 'STATUS_TRANSITION', 'CANDIDATE', 'ACTIVE', 1, 1, 6, world + 3);
    await q('UPDATE public.historical_world_semantic_clocks SET current_version = $2 WHERE user_id = $1', [owner, world + 3]);
  });
  await identity('postgres');
  return { readingA, readingB, world };
}

// ------------------------------------------------------------ the read boundary, as the Data API serializes it
/** One 0169 wrapper called as exactly `uid`; each row as PostgREST would serialize it (`to_jsonb`). */
async function wire(uid, fn, args = []) {
  await identity('authenticated', uid);
  const name = fn.replace(/\(.*$/u, '');
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  const result = (await rows(`SELECT to_jsonb(r) AS row FROM ${name}(${params}) r`, args)).map((r) => r.row);
  await identity('postgres');
  return result;
}

async function readVersion(uid, replay, version, ordinals) {
  const analysis = {};
  for (const ordinal of ordinals) analysis[String(ordinal)] = await wire(uid, W.ANALYSIS, [replay, version, ordinal]);
  return {
    replayId: replay,
    versionId: version,
    version: await wire(uid, W.VERSION, [replay, version]),
    moments: await wire(uid, W.MOMENTS, [replay, version]),
    analysis,
  };
}

async function main() {
  await rt.client.connect();
  await q('BEGIN');
  try {
    const owner = randomUUID();
    await rt.provisionHumans([owner]);
    const world = await sessionOne(owner);
    await newLogicalTransaction();
    await quietExchange(owner, world);
    await newLogicalTransaction();
    const readings = await stageReadings(owner, world.session);
    await newLogicalTransaction();
    await rt.setGate();

    const capture = { scenes: {}, commands: {} };
    const command = async (label, fn, args) => {
      const [row] = await wire(owner, fn, args);
      capture.commands[label] = row;
      return row;
    };

    // The main version: the three sealed messages, SP1 .. SP6.
    const created = await command('mainDraft', W.CREATE, [randomUUID(), world.session, 1, 6]);
    assert.equal(created.outcome, 'CREATED', `the main draft is created (${created.outcome})`);
    const previewed = await command('mainPreview', W.PREVIEW, [randomUUID(), created.replay_id, created.draft_revision]);
    assert.equal(previewed.outcome, 'PREVIEW_READY', `the main draft previews (${previewed.outcome})`);
    capture.scenes.main = await readVersion(owner, created.replay_id, previewed.replay_version_id, [1, 2, 3, 4, 5, 6]);

    // A part of the conversation: its second and third messages only (SP4 .. SP6).
    const part = await command('partDraft', W.CREATE, [randomUUID(), world.session, 4, 6]);
    const partPreview = await command('partPreview', W.PREVIEW, [randomUUID(), part.replay_id, part.draft_revision]);
    assert.equal(partPreview.outcome, 'PREVIEW_READY', `the part previews (${partPreview.outcome})`);
    capture.scenes.part = await readVersion(owner, part.replay_id, partPreview.replay_version_id, [1, 2, 3]);

    // E05 — the open Live Head: the whole conversation includes SP7, which is not sealed.
    const open = await command('openHeadDraft', W.CREATE, [randomUUID(), world.session, 1, 7]);
    await command('openHeadPreview', W.PREVIEW, [randomUUID(), open.replay_id, open.draft_revision]);

    // E06 — a LEGACY UNCOVERED conversation: the draft is real, no historical analysis exists to replay.
    const legacy = await rt.provisionLegacySession(owner);
    await identity('postgres');
    const legacyDraft = await command('legacyDraft', W.CREATE, [randomUUID(), legacy.session, 1, 2]);
    await command('legacyPreview', W.PREVIEW, [randomUUID(), legacyDraft.replay_id, legacyDraft.draft_revision]);

    // E07 — a changed source: a FINALIZED version of the first message becomes NOT_VIEWABLE, with no text and no
    // analysis; the source is restored afterwards.
    const first = await command('firstDraft', W.CREATE, [randomUUID(), world.session, 1, 3]);
    const firstPreview = await command('firstPreview', W.PREVIEW, [randomUUID(), first.replay_id, first.draft_revision]);
    const finalized = await command('firstFinalize', W.FINALIZE, [randomUUID(), first.replay_id, firstPreview.replay_version_id]);
    assert.equal(finalized.outcome, 'FINALIZED', `the first message's version is finalized (${finalized.outcome})`);
    const [changed] = await rows('SELECT id, committed_text FROM public.conversation_units WHERE session_id = $1 AND session_position = 2', [world.session]);
    await rt.asReplica(() => q('UPDATE public.conversation_units SET committed_text = $2 WHERE id = $1', [changed.id, `${changed.committed_text.slice(0, -1)}X`]));
    await identity('postgres');
    capture.scenes.notViewable = await readVersion(owner, first.replay_id, firstPreview.replay_version_id, [1]);
    await rt.asReplica(() => q('UPDATE public.conversation_units SET committed_text = $2 WHERE id = $1', [changed.id, changed.committed_text]));
    await identity('postgres');

    // E08 — a moved analysis: Reading A is rejected at SP2 after the main version froze; the frozen analysis at SP2 and
    // later is no longer re-derived exactly, and is withheld (the earlier moment, SP1, is unaffected).
    await rt.asReplica(() => q(
      `INSERT INTO public.historical_reading_events
         (event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
          session_id, session_position, same_sp_event_sequence, world_version)
       VALUES (gen_random_uuid(), $1, $2, 'STATUS_TRANSITION', 'CANDIDATE', 'REJECTED', 1, 1, $3, 2, 1, $4)`,
      [owner, readings.readingA, world.session, readings.world + 10]));
    await identity('postgres');
    capture.scenes.analysisMoved = await readVersion(owner, created.replay_id, previewed.replay_version_id, [1, 2]);

    // The canonical K(TC) of every main moment, straight from the projection, for the no-hindsight cross-check.
    // (Taken AFTER the E08 surgery would be wrong; it is the pre-surgery truth the version froze that matters, and the
    // frozen answers above already re-derived to the version's own digest. So this cross-check is recorded only as the
    // set of Thread ids known at each TC, which the E08 Reading event does not touch.)
    capture.canonicalThreadsAtTc = {};
    for (const tc of [1, 2, 3, 4, 5, 6]) {
      await identity('authenticated', owner);
      const [k] = await rows('SELECT to_jsonb(p) AS row FROM public.get_session_historical_projection_v1($1, $2) p', [world.session, tc]);
      capture.canonicalThreadsAtTc[String(tc)] = k.row.threads.map((thread) => thread.id).sort();
    }
    await identity('postgres');

    capture.provenance = {
      task: 'S7-03',
      generator: 'database/replay-composite-proof-world.mjs',
      migrations: '0001 .. 0169 (the merged main), applied to a fresh PostgreSQL 17 database',
      scenario: 'the frozen T-03D Session 1 (verify-migration-0072.mjs) + one quiet exchange; Readings staged as SP-native events',
      states: 'E05 MOMENT_NOT_SEALED, E06 ANALYSIS_UNAVAILABLE, E07 NOT_VIEWABLE (SOURCE_NOT_CURRENTLY_AVAILABLE), E08 ANALYSIS_NOT_CURRENTLY_AVAILABLE',
      transaction: 'ROLLED BACK: the database is left exactly as it was',
      capturedAt: new Date().toISOString(),
    };
    writeFileSync(OUT, `${JSON.stringify(capture, null, 2)}\n`);
    console.log(`captured ${Object.keys(capture.scenes).length} scenes and ${Object.keys(capture.commands).length} command answers into ${OUT}`);
  } finally {
    await q('ROLLBACK');
    await rt.client.end();
  }
}

await main();
