// Real-PostgreSQL verifier for migration 0201 (S8B-07 RB-2 / S1: the semantic commit instants, under the Product Owner's
// authorization "RB-2/S1 ONLY" of 2026-11-23 — D-RB2-1, D-RB2-5a, D-RB2-7a, D-RB2-9, D-RB2-11; RB-2 Final Execution
// Contract v1.1 and its v1.1.1 addendum). No provider is called. Sections C, L and D run in transactions that are rolled
// back; section B COMMITS, because transaction identity, deferred firing and MVCC visibility exist only across real
// commits. Every committed fixture person is removed at the end THROUGH the account erasure itself.
//
// The Product Owner's ten mandatory proofs, and where each is made:
//
//   1  several clock UPDATE events in ONE semantic transaction        B-01 (the real coordinator), B-02, B-03
//   2  normal DEFERRED timing and IMMEDIATE timing                     B-01 (nothing before COMMIT), B-02 (fires per
//                                                                      statement, folds, before further updates)
//   3  savepoint rollback and transaction rollback                     B-03
//   4  concurrent transactions, serialized Session updates             B-04 (two connections; REPEATABLE READ 40001)
//   5  exactly one ledger row per committed transaction                B-05 (every committed fixture transaction, by
//                                                                      its own xid, against the ledger)
//   6  no misleading row and no unnecessary abort from a no-op UPDATE  B-06
//   7  immutable observation, idempotent observer operations          B-07 (MVCC: an uncommitted row is never stamped)
//   8  permission isolation and account erasure                       B-08
//   9  failure of every relevant planted defect                       D-* (each with its canonical control, C-*)
//  10  regression of the existing semantic commit and durability      B-01 / B-02 (the coordinator's own result, the
//                                                                      units and turns) + the existing verifiers in CI
//
// Transaction identity is ENFORCED by the ledger itself, not inferred from the order of its `through` values: L-01..L-04.
//
// Numeric clocks are DIAGNOSTICS here, never proofs: every `trigger_at` / `observed_at` difference this verifier prints is
// labelled DIAGNOSTIC and no assertion orders two events by comparing wall-clock values. The ORDER proofs are MVCC ones: a
// row written by an in-progress transaction is invisible to — and therefore never stamped by — any other transaction.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createPersonalReplayRuntime, runVerifier } from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows } = rt;

const MIGRATION = '0201_s8b_07_semantic_commit_instants_v1.sql';
const LEDGER = 'public.session_semantic_commit_instants';
const CLOCK = 'public.session_semantic_clocks';
const RECORDER = 'public.record_session_semantic_commit_instant_v1()';
const GUARD = 'public.guard_session_semantic_commit_instant_mutation_v1()';
const OBSERVE = 'public.server_observe_session_semantic_commits_v1(uuid)';
const SWEEP = 'public.server_observe_unobserved_semantic_commits_v1(integer)';
const RECORDER_TRIGGER = 'session_semantic_clocks_record_commit_instant';
const GUARD_TRIGGER = 'session_semantic_commit_instants_guard';
const CLIENT_ROLES = ['anon', 'authenticated', 'service_role'];

const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const FOCUS_PROVENANCE = ['conversational-focus-evaluator-v1', 'stage-1.2-1.3-reference-attention-v1', 'OPENAI', 'gpt-5-mini', 'focus-resolution-anchored-v2', 1];
const THREAD_PROVENANCE = ['thread-establishment-evaluator-v1', 'stage-1.3-thread-establishment-v1', 'OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1];
const CONTINUITY_PROVENANCE = ['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1'];
const LF_REDUCER_VERSION = 'live-focus-reducer-v1';

const diagnostics = [];
const diagnostic = (line) => { diagnostics.push(line); console.log(`0201 DIAGNOSTIC ${line}`); };
const fixtureHumans = [];
const erasedHumans = new Set();
/** session -> the xids of the committed transactions that moved its clock, in commit order (proof 5). */
const committedMoves = new Map();
const track = (session, xid) => { committedMoves.set(session, [...(committedMoves.get(session) ?? []), xid]); };

// ------------------------------------------------------------------ transaction and role helpers
async function tx(work) {
  await q('BEGIN');
  try {
    const result = await work();
    await q('COMMIT');
    return result;
  } catch (error) {
    await q('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
async function asRoleLocal(role, work) {
  await q(`SET LOCAL ROLE ${role}`);
  try { return await work(); } finally { await q('RESET ROLE').catch(() => undefined); }
}
/** Expects a refusal inside the open transaction, without aborting it. */
async function refused(operation, codes, message = null) {
  await q('SAVEPOINT refusal');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT refusal');
    await q('RELEASE SAVEPOINT refusal');
  }
  assert.ok(error, 'the operation was unexpectedly admitted');
  assert.ok(codes.includes(error.code), `unexpected SQLSTATE ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
  if (message) assert.match(error.message, message);
  return error;
}

// ------------------------------------------------------------------ fixtures
async function human() {
  const id = randomUUID();
  await tx(() => rt.provisionHumans([id]));
  fixtureHumans.push(id);
  return id;
}
async function person() {
  const user = await human();
  const session = randomUUID();
  await tx(() => q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]));
  return { user, session };
}
const points = (value) => Array.from(value);
/** One whole-content CU with no focus, no Thread, no lifecycle action and an unchanged NONE Live Focus (the 0191 shape). */
function payload(content) {
  const id = randomUUID();
  return {
    units: [{ unit_id: id, span_start: 0, span_end: points(content).length }],
    bundles: [{ unit_id: id, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null, references: [], claim_attributions: [],
      attention: { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null } }],
    threads: [{ unit_id: id, decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'NO_INDEPENDENT_FOCUS', emerging_focus_id: null, path: null,
      thread_id: null, home_anchor_id: null, thread_established_event_id: null, evidence: [], explicit_selection_grounding: null, origin_state: 'NONE', origin_thread_ids: [] }],
    lifecycles: [{ unit_id: id, outcome: 'NO_THREAD_ACTION', emerging_focus_id: null, thread_id: null, binding_kind: null, focus_binding_id: null,
      identity_evidence: [], prior_identity_evidence: [], candidate_thread_ids: [], lifecycle_transitions: [] }],
    live: [{ unit_id: id, effective_kind: 'NONE', effective_ref: null, transition: false, reason_code: null, transition_event_id: null }],
  };
}
/** A completed USER -> ASSISTANT text exchange through the text path's own commands, each in its own transaction. */
async function completedTurns(x, content = 'كان يوم طويل في الشغل.', reply = 'إيه اللي خلاه طويل؟') {
  const userTurn = randomUUID();
  const assistantTurn = randomUUID();
  await tx(async () => {
    await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: x.user, role: 'authenticated' })]);
    await rows('SELECT * FROM public.create_user_conversation_turn($1, $2, $3, $4)', [userTurn, x.session, content, null]);
  });
  await tx(() => asRoleLocal('service_role', async () => {
    await rows('SELECT * FROM public.claim_conversation_turn($1, $2, $3, $4, $5)', [x.session, x.user, userTurn, ...ROUTE]);
    await rows('SELECT * FROM public.finalize_conversation_turn_v2($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [x.session, x.user, userTurn, assistantTurn, reply, 'ALLOW', randomUUID(), null, null, null]);
  }));
  return { userTurn, assistantTurn, content, reply };
}
const clockOf = async (session) =>
  (await rows(`SELECT current_sp AS sp, same_sp_event_sequence::text AS seq FROM ${CLOCK} WHERE session_id = $1`, [session]))[0];
const versionOf = async (user) =>
  (await rows('SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id = $1), 0)::text AS v', [user]))[0].v;
const tokenOf = async (x) => ({ ...(await clockOf(x.session)), version: await versionOf(x.user) });
const EXCHANGE_SQL = `SELECT * FROM public.commit_finalized_exchange_with_full_semantic_chain_v1(
  $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
  $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`;
/** The real semantic commit (the FINAL coordinator, as the server calls it), inside the caller's open transaction. */
async function exchangeIn(x, turns, token = null) {
  const t = token ?? await tokenOf(x);
  const u = payload(turns.content);
  const a = payload(turns.reply);
  return asRoleLocal('service_role', async () => (await rows(EXCHANGE_SQL, [x.session, x.user, turns.userTurn, randomUUID(),
    JSON.stringify(u.units), JSON.stringify(u.bundles), JSON.stringify(u.threads), JSON.stringify(u.lifecycles), JSON.stringify(u.live),
    turns.assistantTurn, randomUUID(), JSON.stringify(a.units), JSON.stringify(a.bundles), JSON.stringify(a.threads),
    JSON.stringify(a.lifecycles), JSON.stringify(a.live), ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE,
    ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION, t.sp, t.seq, t.version]))[0]);
}
/** A person whose Session holds one committed semantic exchange (so the clock has an SP and the ledger one row). */
async function established() {
  const x = await person();
  const turns = await completedTurns(x);
  const xid = await tx(async () => { const id = await currentXact(); await exchangeIn(x, turns); return id; });
  track(x.session, xid);
  return x;
}

// ------------------------------------------------------------------ ledger helpers
const LEDGER_COLUMNS = `from_sp, from_event_sequence::text AS from_seq, through_sp, through_event_sequence::text AS through_seq,
  covers_from_sp1, xact_id::text AS xact, trigger_at, observed_at`;
const ledgerOf = (session) => rows(`SELECT ${LEDGER_COLUMNS} FROM ${LEDGER} WHERE session_id = $1 ORDER BY through_sp, through_event_sequence`, [session]);
const rowsOfXact = async (session, xid) => (await ledgerOf(session)).filter((r) => r.xact === xid);
const currentXact = async () => (await rows('SELECT pg_current_xact_id()::text AS x'))[0].x;
/** Clock UPDATE events this transaction has made so far (the statistics are per transaction; nothing is installed). */
const clockUpdates = async () =>
  Number((await rows(`SELECT coalesce(sum(n_tup_upd), 0)::int AS n FROM pg_stat_xact_user_tables WHERE relid = '${CLOCK}'::regclass`))[0].n);
const reserve = (x) => rows('SELECT * FROM public.reserve_session_same_sp_event_v1($1, $2)', [x.session, x.user]);
const immediate = () => q(`SET CONSTRAINTS public.${RECORDER_TRIGGER} IMMEDIATE`);
const deferred = () => q(`SET CONSTRAINTS public.${RECORDER_TRIGGER} DEFERRED`);
const observe = (session) => asRoleLocal('service_role', async () =>
  (await rows('SELECT public.server_observe_session_semantic_commits_v1($1) AS n', [session]))[0].n);
const sweep = (limit) => asRoleLocal('service_role', async () =>
  (await rows('SELECT public.server_observe_unobserved_semantic_commits_v1($1) AS n', [limit]))[0].n);
const through = (r) => [r.through_sp, r.through_seq];
const clockPair = (c) => [c.sp, c.seq];
/** The ledger of a Session is one contiguous chain of distinct transactions ending at the clock. */
function assertChain(ledger, clock, label) {
  assert.ok(ledger.length > 0, `${label}: the ledger holds a row`);
  for (let i = 1; i < ledger.length; i += 1) {
    assert.deepEqual([ledger[i].from_sp, ledger[i].from_seq], through(ledger[i - 1]), `${label}: row ${i} starts where row ${i - 1} ends`);
  }
  assert.equal(new Set(ledger.map((r) => r.xact)).size, ledger.length, `${label}: every row is a distinct transaction`);
  assert.deepEqual(through(ledger.at(-1)), clockPair(clock), `${label}: the chain ends at the clock`);
}
const definitionOf = async (signature) =>
  (await rows('SELECT pg_get_functiondef(to_regprocedure($1)) AS d', [signature]))[0].d;

// ------------------------------------------------------------------ C: catalogue (rolled back)
async function verifyCatalogue(report) {
  await q('BEGIN');
  try {
    await report.isolated('C-01 the ledger: postgres-owned, RLS with no policy, no client grant, cascades from its Session, one row per Session and transaction', async () => {
      const [t] = await rows(`SELECT pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
          (SELECT count(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies FROM pg_class c WHERE c.oid = to_regclass($1)`, [LEDGER]);
      assert.ok(t, `${LEDGER} exists`);
      assert.deepEqual(t, { owner: 'postgres', rls: true, policies: 0 });
      const grants = await rows(`SELECT grantee, privilege_type FROM information_schema.role_table_grants
          WHERE table_schema = 'public' AND table_name = 'session_semantic_commit_instants'
            AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC', 'qandeel_replay_media')`);
      assert.deepEqual(grants, [], 'no client role holds any privilege on the ledger');
      const defs = (await rows(`SELECT contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname`, [LEDGER]))
        .map((c) => `${c.contype} ${c.def}`);
      const has = (pattern, what) => assert.ok(defs.some((d) => pattern.test(d)), `${what}: ${defs.join(' | ')}`);
      has(/^p PRIMARY KEY \(session_id, through_sp, through_event_sequence\)$/u, 'the primary key is the Session and the through position');
      has(/^u UNIQUE \(session_id, xact_id\)$/u, 'one row per Session and transaction');
      has(/^u UNIQUE \(session_id, from_sp, from_event_sequence\)$/u, 'no two rows start at the same position (no fork)');
      has(/^f FOREIGN KEY \(session_id, user_id\) REFERENCES (?:public\.)?conversation_sessions\(id, user_id\) ON DELETE CASCADE$/u, 'the row leaves with its Session');
      has(/^c CHECK .*from_sp.*from_event_sequence.*<.*through_sp.*through_event_sequence/u, 'a row covers a non-empty range');
      assert.equal(defs.filter((d) => d.startsWith('f ')).length, 1, 'exactly one reference');
      const columns = Object.fromEntries((await rows(`SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS nn, a.attgenerated AS gen
          FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`, [LEDGER])).map((c) => [c.attname, c]));
      assert.deepEqual(Object.keys(columns).sort(), ['covers_from_sp1', 'from_event_sequence', 'from_sp', 'observed_at', 'session_id',
        'through_event_sequence', 'through_sp', 'trigger_at', 'user_id', 'xact_id'], 'the column set');
      assert.deepEqual([columns.xact_id.type, columns.xact_id.nn], ['xid8', true], 'the transaction identity is a non-null xid8');
      assert.equal(columns.observed_at.nn, false, 'observed_at is NULL until observed');
      assert.equal(columns.covers_from_sp1.gen, 's', 'covers_from_sp1 is derived, never written');
    });
    await report.isolated('C-02 the recorder is a DEFERRABLE INITIALLY DEFERRED row constraint trigger AFTER UPDATE on the clock; the guard BEFORE every row write', async () => {
      const [rec] = await rows(`SELECT pg_get_triggerdef(t.oid) AS def, t.tgenabled AS enabled FROM pg_trigger t
          WHERE t.tgrelid = $1::regclass AND t.tgname = $2`, [CLOCK, RECORDER_TRIGGER]);
      assert.ok(rec, 'the recorder trigger exists');
      assert.match(rec.def, new RegExp(`^CREATE CONSTRAINT TRIGGER ${RECORDER_TRIGGER} AFTER UPDATE ON public\\.session_semantic_clocks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION (?:public\\.)?record_session_semantic_commit_instant_v1\\(\\)$`, 'u'));
      assert.equal(rec.enabled, 'O', 'enabled in origin mode');
      const [guard] = await rows(`SELECT pg_get_triggerdef(t.oid) AS def, t.tgenabled AS enabled FROM pg_trigger t
          WHERE t.tgrelid = $1::regclass AND t.tgname = $2`, [LEDGER, GUARD_TRIGGER]);
      assert.ok(guard, 'the guard trigger exists');
      assert.match(guard.def, /BEFORE INSERT OR DELETE OR UPDATE ON public\.session_semantic_commit_instants FOR EACH ROW EXECUTE FUNCTION (?:public\.)?guard_session_semantic_commit_instant_mutation_v1\(\)$/u);
      assert.equal(guard.enabled, 'O');
      const others = await rows(`SELECT t.tgname FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal
          AND t.tgfoid = to_regprocedure($2)`, [CLOCK, RECORDER]);
      assert.equal(others.length, 1, 'the recorder is attached once');
    });
    await report.isolated('C-03 every new function is postgres-owned and search_path-pinned; the observer and the sweeper are service_role only; the recorder and the guard nobody\'s', async () => {
      for (const [fn, definer, service] of [[RECORDER, true, false], [GUARD, false, false], [OBSERVE, true, true], [SWEEP, true, true]]) {
        const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.proconfig AS config, p.prosecdef AS definer,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
            has_function_privilege('service_role', p.oid, 'EXECUTE') AS service FROM pg_proc p WHERE p.oid = to_regprocedure($1)`, [fn]);
        assert.ok(p, `${fn} exists`);
        assert.equal(p.owner, 'postgres', `${fn}: owner`);
        assert.deepEqual(p.config, ['search_path=""'], `${fn}: pinned`);
        assert.equal(p.definer, definer, `${fn}: SECURITY ${definer ? 'DEFINER' : 'INVOKER'}`);
        assert.deepEqual([p.anon, p.auth, p.service], [false, false, service], `${fn}: roles`);
      }
    });
    await report.isolated('C-04 forward-only, one transaction; no handler, no dynamic SQL, no retryable SQLSTATE in any new body', async () => {
      const text = readFileSync(new URL(`./migrations/${MIGRATION}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
      const code = text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
      assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
      assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
      assert.doesNotMatch(code, /CREATE OR REPLACE|DROP\s+(?:TABLE|FUNCTION|TRIGGER|INDEX)/u, 'nothing existing is replaced or dropped');
      assert.deepEqual([...code.matchAll(/ALTER TABLE (\S+)/gu)].map((m) => m[1]), [LEDGER], 'no existing table is altered');
      for (const fn of [RECORDER, GUARD, OBSERVE, SWEEP]) {
        const [{ src }] = await rows('SELECT prosrc AS src FROM pg_proc WHERE oid = to_regprocedure($1)', [fn]);
        assert.doesNotMatch(src, /\bEXCEPTION\s+WHEN\b/iu, `${fn}: no handler can swallow a failure`);
        assert.doesNotMatch(src, /\bEXECUTE\b/u, `${fn}: no dynamic SQL`);
        const codes = [...src.matchAll(/ERRCODE\s*=\s*'([^']+)'/gu)].map((m) => m[1]);
        assert.ok(codes.every((c) => ['55000', '22023'].includes(c)), `${fn}: raises only 55000 / 22023, got ${codes}`);
        assert.doesNotMatch(src, /40001|40P01|PT409/u, `${fn}: no retryable SQLSTATE`);
      }
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ B: real commits
async function verifyCommits(report, fixtures) {
  await report.section('B-01 proof 1/2/10: one real exchange moves the clock several times in ONE transaction, records nothing before COMMIT and exactly one row after', async () => {
    const x = await person();
    fixtures.a = x;
    const turns = await completedTurns(x);
    let xid; let updates; let inside; let clock; let result; let lastStatementAt;
    await tx(async () => {
      xid = await currentXact();
      result = await exchangeIn(x, turns);
      updates = await clockUpdates();
      inside = await ledgerOf(x.session);
      clock = await clockOf(x.session);
      lastStatementAt = (await rows('SELECT clock_timestamp() AS t'))[0].t;
    });
    track(x.session, xid);
    diagnostic(`B-01 clock UPDATE events in one exchange transaction: ${updates}`);
    assert.ok(updates >= 2, `the exchange moved the clock ${updates} time(s) in one transaction`);
    assert.deepEqual(inside, [], 'DEFERRED: nothing is recorded before COMMIT, even to the writing transaction itself');
    const after = await ledgerOf(x.session);
    assert.equal(after.length, 1, 'exactly one row for the committed transaction');
    const [r] = after;
    assert.deepEqual([r.from_sp, r.from_seq, ...through(r), r.covers_from_sp1, r.xact, r.observed_at],
      [0, '0', ...clockPair(clock), true, xid, null], 'the row covers the origin through the final clock, under the transaction\'s own identity');
    diagnostic(`B-01 trigger_at - last in-transaction statement = ${r.trigger_at - lastStatementAt} ms (numeric, not an order proof)`);
    assert.equal(result.live_head, clock.sp, 'regression: the coordinator answers the Live Head it committed');
    const turns2 = await completedTurns(x, 'وبعدين روحت البيت.', 'وصلت إمتى؟');
    const xid2 = await tx(async () => { const id = await currentXact(); await exchangeIn(x, turns2); return id; });
    track(x.session, xid2);
    assertChain(await ledgerOf(x.session), await clockOf(x.session), 'B-01');
    const units = await rows('SELECT source_role FROM public.conversation_units WHERE session_id = $1 ORDER BY session_position', [x.session]);
    assert.deepEqual(units.map((u) => u.source_role), ['USER', 'ASSISTANT', 'USER', 'ASSISTANT'], 'regression: every committed unit is durable');
    const turnStates = await rows('SELECT role, status FROM public.conversation_turns WHERE session_id = $1 ORDER BY created_at, id', [x.session]);
    assert.deepEqual(turnStates.map((t) => `${t.role}:${t.status}`), ['USER:COMPLETED', 'ASSISTANT:COMPLETED', 'USER:COMPLETED', 'ASSISTANT:COMPLETED'],
      'regression: conversation durability is unchanged');
  });

  await report.section('B-02 proof 2: IMMEDIATE timing fires per statement and FOLDS into the transaction\'s one row, before further updates', async () => {
    const x = fixtures.a;
    const turns = await completedTurns(x, 'الجو كان حر.', 'شربت مية كفاية؟');
    let xid; let updates; let mine; let clock;
    await tx(async () => {
      await q('SET CONSTRAINTS ALL IMMEDIATE');
      xid = await currentXact();
      await exchangeIn(x, turns);
      updates = await clockUpdates();
      mine = await rowsOfXact(x.session, xid);
      clock = await clockOf(x.session);
    });
    track(x.session, xid);
    assert.ok(updates >= 2, `several UPDATE events (${updates}) fired immediately in one transaction`);
    assert.equal(mine.length, 1, 'IMMEDIATE: one row already inside the transaction, never one per firing');
    assert.deepEqual(through(mine[0]), clockPair(clock), 'the row was folded forward to the final clock');
    assert.deepEqual(await rowsOfXact(x.session, xid), mine.map((r) => ({ ...r })), 'COMMIT changes nothing in it');
    // Mixed: one event deferred, then forced, then a further immediate move folded, then a deferred one at COMMIT.
    let c1; let c2; let c3; let mixed;
    const xid2 = await tx(async () => {
      const id = await currentXact();
      await reserve(x);
      assert.deepEqual(await rowsOfXact(x.session, id), [], 'the deferred event has not fired');
      await immediate();
      c1 = await clockOf(x.session);
      const first = await rowsOfXact(x.session, id);
      assert.equal(first.length, 1, 'forcing the deferred event records the transaction');
      assert.deepEqual(through(first[0]), clockPair(c1));
      await reserve(x);
      c2 = await clockOf(x.session);
      const folded = await rowsOfXact(x.session, id);
      assert.equal(folded.length, 1, 'the immediate firing folds');
      assert.deepEqual(through(folded[0]), clockPair(c2));
      assert.deepEqual([folded[0].from_sp, folded[0].from_seq], [first[0].from_sp, first[0].from_seq], 'the fold keeps where it started');
      await deferred();
      await reserve(x);
      c3 = await clockOf(x.session);
      assert.deepEqual(through((await rowsOfXact(x.session, id))[0]), clockPair(c2), 'the deferred move waits for COMMIT');
      return id;
    });
    track(x.session, xid2);
    mixed = await rowsOfXact(x.session, xid2);
    assert.equal(mixed.length, 1);
    assert.deepEqual(through(mixed[0]), clockPair(c3), 'at COMMIT the deferred event folds the last move');
    assertChain(await ledgerOf(x.session), await clockOf(x.session), 'B-02');
  });

  await report.section('B-03 proof 3: savepoint rollback, IMMEDIATE savepoints, transaction rollback, a stale-token abort and its retry', async () => {
    const x = fixtures.a;
    const start = await clockOf(x.session);
    let final;
    const xid = await tx(async () => {
      const id = await currentXact();
      await reserve(x);
      await q('SAVEPOINT s');
      await reserve(x);
      await reserve(x);
      await q('ROLLBACK TO SAVEPOINT s');
      await reserve(x);
      final = await clockOf(x.session);
      return id;
    });
    track(x.session, xid);
    assert.deepEqual(clockPair(final), [start.sp, String(Number(start.seq) + 2)], 'the rolled-back moves left the clock');
    const mine = await rowsOfXact(x.session, xid);
    assert.equal(mine.length, 1);
    assert.deepEqual([mine[0].from_sp, mine[0].from_seq, ...through(mine[0])], [...clockPair(start), ...clockPair(final)], 'and the ledger');

    let kept;
    const xid2 = await tx(async () => {
      const id = await currentXact();
      await immediate();
      await q('SAVEPOINT a');
      await reserve(x);
      assert.equal((await rowsOfXact(x.session, id)).length, 1, 'recorded inside the savepoint');
      await q('ROLLBACK TO SAVEPOINT a');
      assert.deepEqual(await rowsOfXact(x.session, id), [], 'the rolled-back savepoint takes its row with it');
      await reserve(x);
      kept = await clockOf(x.session);
      await q('SAVEPOINT b');
      await reserve(x);
      assert.notDeepEqual(through((await rowsOfXact(x.session, id))[0]), clockPair(kept), 'folded inside the savepoint');
      await q('ROLLBACK TO SAVEPOINT b');
      assert.deepEqual(through((await rowsOfXact(x.session, id))[0]), clockPair(kept), 'the rolled-back fold is undone');
      return id;
    });
    track(x.session, xid2);
    const mine2 = await rowsOfXact(x.session, xid2);
    assert.equal(mine2.length, 1);
    assert.deepEqual(through(mine2[0]), clockPair(kept));

    const before = await ledgerOf(x.session);
    const beforeClock = await clockOf(x.session);
    await q('BEGIN');
    await reserve(x);
    await reserve(x);
    await q('ROLLBACK');
    assert.deepEqual(await ledgerOf(x.session), before, 'a rolled-back transaction records nothing');
    assert.deepEqual(await clockOf(x.session), beforeClock);

    const turns = await completedTurns(x, 'نمت متأخر.', 'كام ساعة؟');
    const stale = { ...(await tokenOf(x)), seq: '0' };
    assert.notEqual(beforeClock.seq, '0', 'the token is genuinely stale');
    let error;
    try { await tx(() => exchangeIn(x, turns, stale)); } catch (caught) { error = caught; }
    assert.ok(error && ['PT409', '40001'].includes(error.code), `a stale token aborts the commit: ${error?.code} ${error?.message}`);
    assert.deepEqual(await ledgerOf(x.session), before, 'the aborted commit records nothing');
    const xid3 = await tx(async () => { const id = await currentXact(); await exchangeIn(x, turns); return id; });
    track(x.session, xid3);
    assertChain(await ledgerOf(x.session), await clockOf(x.session), 'B-03 after the retry');
  });

  await report.section('B-04 proof 4: concurrent transactions on one Session serialize, each recorded once in commit order; REPEATABLE READ cannot record a stale chain; two Sessions are independent', async () => {
    const x = fixtures.a;
    const y = await established();
    fixtures.b = y;
    const { q2, close } = await rt.openSecondary();
    const xact2 = async () => (await q2('SELECT pg_current_xact_id()::text AS x')).rows[0].x;
    const reserve2 = (z) => q2('SELECT * FROM public.reserve_session_same_sp_event_v1($1, $2)', [z.session, z.user]);
    try {
      for (const mode of ['DEFERRED', 'IMMEDIATE']) {
        const before = (await ledgerOf(x.session)).length;
        await q('BEGIN');
        await q2('BEGIN');
        if (mode === 'IMMEDIATE') {
          await immediate();
          await q2(`SET CONSTRAINTS public.${RECORDER_TRIGGER} IMMEDIATE`);
        }
        const xa = await currentXact();
        const xb = await xact2();
        await reserve(x);
        const blocked = reserve2(x);
        assert.equal(await rt.stillPending(blocked), true, `${mode}: the second writer waits on the clock`);
        await q('COMMIT');
        track(x.session, xa);
        await blocked;
        await q2('COMMIT');
        track(x.session, xb);
        const ledger = await ledgerOf(x.session);
        assert.equal(ledger.length, before + 2, `${mode}: two transactions, two rows`);
        assert.deepEqual(ledger.slice(-2).map((r) => r.xact), [xa, xb], `${mode}: in commit order, each under its own identity`);
        assertChain(ledger, await clockOf(x.session), `B-04 ${mode}`);
      }
      const before = await ledgerOf(x.session);
      await q2('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await q2('SELECT 1');
      const xa = await tx(async () => { const id = await currentXact(); await reserve(x); return id; });
      track(x.session, xa);
      let error;
      try { await reserve2(x); } catch (caught) { error = caught; }
      await q2('ROLLBACK');
      assert.equal(error?.code, '40001', `a REPEATABLE READ writer behind the commit is refused before recording: ${error?.code}`);
      assert.equal((await ledgerOf(x.session)).length, before.length + 1, 'only the committed writer is recorded');
      await q('BEGIN');
      await q2('BEGIN');
      const xs = await currentXact();
      const xt = await xact2();
      await reserve(x);
      const other = reserve2(y);
      assert.equal(await rt.stillPending(other), false, 'a different Session does not wait');
      await other;
      await q2('COMMIT');
      track(y.session, xt);
      await q('COMMIT');
      track(x.session, xs);
      assertChain(await ledgerOf(x.session), await clockOf(x.session), 'B-04 x');
      assertChain(await ledgerOf(y.session), await clockOf(y.session), 'B-04 y');
    } finally {
      await close();
    }
  });

  await report.section('B-06 proof 6: a no-op UPDATE records nothing and aborts nothing — alone, before a real move, with no ledger yet, at the deploy boundary', async () => {
    const x = fixtures.a;
    const before = await ledgerOf(x.session);
    await tx(() => q(`UPDATE ${CLOCK} SET current_sp = current_sp WHERE session_id = $1`, [x.session]));
    assert.deepEqual(await ledgerOf(x.session), before, 'a no-op transaction leaves no row');
    const start = await clockOf(x.session);
    const xid = await tx(async () => {
      const id = await currentXact();
      await q(`UPDATE ${CLOCK} SET same_sp_event_sequence = same_sp_event_sequence WHERE session_id = $1`, [x.session]);
      await reserve(x);
      return id;
    });
    track(x.session, xid);
    const mine = await rowsOfXact(x.session, xid);
    assert.equal(mine.length, 1);
    assert.deepEqual([mine[0].from_sp, mine[0].from_seq], clockPair(start), 'a no-op before a move does not misplace its start');
    const fresh = await person();
    await tx(() => q(`UPDATE ${CLOCK} SET current_sp = current_sp WHERE session_id = $1`, [fresh.session]));
    assert.deepEqual(await ledgerOf(fresh.session), [], 'a Session with no Position records nothing');
    await q('BEGIN');
    try {
      await q("SET LOCAL session_replication_role = 'replica'");
      await q(`UPDATE ${CLOCK} SET current_sp = 3, same_sp_event_sequence = 1 WHERE session_id = $1`, [fresh.session]);
      await q("SET LOCAL session_replication_role = 'origin'");
      await q(`UPDATE ${CLOCK} SET current_sp = current_sp WHERE session_id = $1`, [fresh.session]);
      await immediate();
      assert.deepEqual(await ledgerOf(fresh.session), [], 'a no-op at the deploy boundary records nothing');
      await reserve(fresh);
      const [boundary] = await ledgerOf(fresh.session);
      assert.deepEqual([boundary.from_sp, boundary.from_seq, ...through(boundary), boundary.covers_from_sp1], [3, '1', 3, '2', false],
        'the first row after the deploy starts at the clock it found, and says it does not cover the origin');
    } finally {
      await q('ROLLBACK');
    }
  });

  await report.section('B-07 proof 7: observation is MVCC-ordered, exactly once, immutable; the observer and the sweeper are idempotent', async () => {
    const x = fixtures.a;
    const stamped = await tx(() => observe(x.session));
    assert.ok(stamped >= 1, `the committed rows are observed (${stamped})`);
    const observed = await ledgerOf(x.session);
    assert.ok(observed.every((r) => r.observed_at !== null), 'every committed row of the Session is observed');
    const committed = await rows(`SELECT count(*)::int AS n FROM ${LEDGER} WHERE session_id = $1 AND pg_xact_status(xact_id) = 'committed'`, [x.session]);
    assert.equal(committed[0].n, observed.length, 'every observed row\'s writer committed');
    diagnostic(`B-07 observed_at - trigger_at, ms: ${observed.map((r) => r.observed_at - r.trigger_at).join(', ')} (numeric, not an order proof)`);
    assert.equal(await tx(() => observe(x.session)), 0, 'a second observation stamps nothing');
    assert.deepEqual(await ledgerOf(x.session), observed, 'and changes nothing');

    const { q2, close } = await rt.openSecondary();
    try {
      await q('BEGIN');
      await immediate();
      const xid = await currentXact();
      await reserve(x);
      assert.equal((await rowsOfXact(x.session, xid)).length, 1, 'the row exists, uncommitted');
      assert.equal(await observe(x.session), 0, 'the writing transaction cannot observe its own row');
      await refused(() => q(`UPDATE ${LEDGER} SET observed_at = clock_timestamp() WHERE session_id = $1 AND xact_id = $2::xid8`, [x.session, xid]),
        ['55000'], /SEMANTIC_COMMIT_INSTANT_IMMUTABLE/u);
      await q2('BEGIN');
      await q2('SET LOCAL ROLE service_role');
      const early = q2('SELECT public.server_observe_session_semantic_commits_v1($1) AS n', [x.session]);
      assert.equal(await rt.stillPending(early), false, 'another transaction is not blocked by the invisible row');
      assert.equal((await early).rows[0].n, 0, 'and cannot observe it: an uncommitted row is invisible');
      const swept = (await q2('SELECT public.server_observe_unobserved_semantic_commits_v1(1000) AS n')).rows[0].n;
      await q2('COMMIT');
      await q('COMMIT');
      track(x.session, xid);
      assert.equal((await rowsOfXact(x.session, xid))[0].observed_at, null, `nothing stamped the row before it was visible (the sweeper stamped ${swept} other rows)`);
      await q2('BEGIN');
      await q2('SET LOCAL ROLE service_role');
      const after = (await q2('SELECT public.server_observe_session_semantic_commits_v1($1) AS n', [x.session])).rows[0].n;
      await q2('COMMIT');
      assert.equal(after, 1, 'once committed it is observed, by a later transaction, once');
    } finally {
      await close();
    }

    const y = fixtures.b;
    await tx(() => observe(y.session));
    const xid = await tx(async () => { const id = await currentXact(); await reserve(y); return id; });
    track(y.session, xid);
    assert.ok(await tx(() => sweep(1000)) >= 1, 'the sweeper observes what no Session observer has');
    const row = (await rowsOfXact(y.session, xid))[0];
    assert.notEqual(row.observed_at, null);
    await tx(() => sweep(1000));
    assert.deepEqual((await rowsOfXact(y.session, xid))[0], row, 'a second sweep changes nothing');

    await tx(async () => {
      for (const [sql, what] of [
        [`UPDATE ${LEDGER} SET observed_at = observed_at + interval '1 second' WHERE session_id = $1`, 'a re-observation'],
        [`UPDATE ${LEDGER} SET observed_at = NULL WHERE session_id = $1`, 'an un-observation'],
        [`UPDATE ${LEDGER} SET trigger_at = trigger_at - interval '1 second' WHERE session_id = $1`, 'a moved trigger instant'],
        [`UPDATE ${LEDGER} SET user_id = gen_random_uuid() WHERE session_id = $1`, 'a moved owner'],
      ]) await refused(() => q(sql, [x.session]), ['55000'], /SEMANTIC_COMMIT_INSTANT_IMMUTABLE/u).catch((e) => { throw new Error(`${what}: ${e.message}`); });
      await refused(() => observe(null), ['22023']);
      for (const limit of [null, 0, 1001]) await refused(() => sweep(limit), ['22023']);
    });
  });

  await report.section('B-08 proof 8: no client role reaches the ledger or the observers it may not; the recorder writes under its own authority; only the governed erasure deletes', async () => {
    const x = fixtures.a;
    await tx(async () => {
      for (const role of CLIENT_ROLES) {
        for (const sql of [`SELECT * FROM ${LEDGER}`, `INSERT INTO ${LEDGER} (session_id) VALUES (gen_random_uuid())`,
          `UPDATE ${LEDGER} SET observed_at = NULL`, `DELETE FROM ${LEDGER}`]) {
          await refused(() => asRoleLocal(role, () => q(sql)), ['42501']).catch((e) => { throw new Error(`${role} ${sql.split(' ')[0]}: ${e.message}`); });
        }
        const [p] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') AS s, has_table_privilege($1, $2, 'INSERT') AS i,
            has_table_privilege($1, $2, 'UPDATE') AS u, has_table_privilege($1, $2, 'DELETE') AS d`, [role, LEDGER]);
        assert.deepEqual(p, { s: false, i: false, u: false, d: false }, `${role} holds no table privilege`);
      }
      for (const role of ['anon', 'authenticated']) {
        await refused(() => asRoleLocal(role, () => q('SELECT public.server_observe_session_semantic_commits_v1($1)', [x.session])), ['42501']);
        await refused(() => asRoleLocal(role, () => q('SELECT public.server_observe_unobserved_semantic_commits_v1(1)')), ['42501']);
      }
      await refused(() => q(`DELETE FROM ${LEDGER} WHERE session_id = $1`, [x.session]), ['55000'], /SEMANTIC_COMMIT_INSTANT_IMMUTABLE/u);
      await q("SELECT set_config('qandeel.personal_erasure', txid_current()::text, true)");
      await refused(() => q(`DELETE FROM ${LEDGER} WHERE session_id = $1`, [x.session]), ['55000'], /SEMANTIC_COMMIT_INSTANT_IMMUTABLE/u);
    });
    assert.ok((await ledgerOf(x.session)).length >= 2, 'service_role commits were recorded although service_role holds no ledger privilege');
    const z = await established();
    await tx(async () => { await reserve(z); });
    assert.ok((await ledgerOf(z.session)).length >= 1);
    await erase(z.user);
    const [left] = await rows(`SELECT (SELECT count(*) FROM ${LEDGER} WHERE user_id = $1)::int AS ledger,
        (SELECT count(*) FROM public.conversation_sessions WHERE user_id = $1)::int AS sessions,
        (SELECT count(*) FROM ${CLOCK} WHERE user_id = $1)::int AS clocks`, [z.user]);
    assert.deepEqual(left, { ledger: 0, sessions: 0, clocks: 0 }, 'the account erasure removes every row of the person');
    committedMoves.delete(z.session);
  });

  await report.section('B-05 proof 5: every committed fixture transaction that moved a clock is exactly one ledger row, by its own transaction identity', async () => {
    assert.ok(committedMoves.size >= 2, 'the proof covers several Sessions');
    for (const [session, xids] of committedMoves) {
      const ledger = await ledgerOf(session);
      assert.deepEqual(ledger.map((r) => r.xact), xids, `${session}: one row per committed transaction, in commit order`);
      assertChain(ledger, await clockOf(session), `B-05 ${session}`);
    }
  });
}

// ------------------------------------------------------------------ L: the ledger enforces transaction identity (rolled back)
async function verifyIdentity(report, fixtures) {
  const x = fixtures.a;
  await q('BEGIN');
  try {
    const [latest] = (await ledgerOf(x.session)).slice(-1);
    const forge = (xact, from = through(latest), to = [latest.through_sp + 1, '0']) => q(`INSERT INTO ${LEDGER}
        (session_id, user_id, from_sp, from_event_sequence, through_sp, through_event_sequence, xact_id, trigger_at)
        VALUES ($1, $2, $3, $4, $5, $6, ${xact}, clock_timestamp())`, [x.session, x.user, ...from, ...to]);
    await report.isolated('L-01 a chain-correct row under any identity but the writing transaction\'s is refused', async () => {
      await refused(() => forge(`'${latest.xact}'::xid8`), ['55000', '23505'], /SEMANTIC_COMMIT_INSTANT|unique/u);
      await refused(() => forge("'3'::xid8"), ['55000'], /SEMANTIC_COMMIT_INSTANT_IDENTITY/u);
    });
    await report.isolated('L-02 a transaction never holds two rows of one Session, whatever their order', async () => {
      await immediate();
      await reserve(x);
      const [mine] = await rowsOfXact(x.session, await currentXact());
      await refused(() => forge('pg_current_xact_id()', through(mine), [mine.through_sp + 1, '0']), ['55000', '23505'], /SEMANTIC_COMMIT_INSTANT|unique/u);
    });
    await report.isolated('L-03 a later transaction cannot fold into, or move, an earlier transaction\'s row', async () => {
      await refused(() => q(`UPDATE ${LEDGER} SET through_event_sequence = through_event_sequence + 1 WHERE session_id = $1 AND xact_id = $2::xid8`,
        [x.session, latest.xact]), ['55000'], /SEMANTIC_COMMIT_INSTANT_IMMUTABLE/u);
    });
    await report.isolated('L-04 a row that does not continue the chain is refused (no fork, no gap)', async () => {
      await refused(() => forge('pg_current_xact_id()', [latest.from_sp, latest.from_seq]), ['55000', '23505'], /SEMANTIC_COMMIT_INSTANT_CHAIN|unique/u);
      await refused(() => forge('pg_current_xact_id()', [latest.through_sp + 1, '0'], [latest.through_sp + 2, '0']), ['55000'], /SEMANTIC_COMMIT_INSTANT_CHAIN/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ D: planted defects, each against its canonical control
async function verifyPlantedDefects(report, fixtures) {
  const x = fixtures.a;
  // The state the next semantic commit usually meets in production: the Session's latest row committed, not yet observed.
  await tx(() => reserve(x));
  assert.equal((await ledgerOf(x.session)).at(-1).observed_at, null, 'the latest row is unobserved');
  const checks = {
    fold: async () => {
      await immediate();
      await reserve(x); await reserve(x); await reserve(x);
      const mine = await rowsOfXact(x.session, await currentXact());
      assert.equal(mine.length, 1, 'one row for the transaction');
      assert.deepEqual(through(mine[0]), clockPair(await clockOf(x.session)));
    },
    newTransaction: async () => {
      const before = (await ledgerOf(x.session)).length;
      await immediate();
      await reserve(x);
      const ledger = await ledgerOf(x.session);
      assert.equal(ledger.length, before + 1, 'a new transaction is a new row');
      assert.equal(ledger.at(-1).xact, await currentXact());
    },
    noop: async () => {
      const before = await ledgerOf(x.session);
      await q(`UPDATE ${CLOCK} SET current_sp = current_sp WHERE session_id = $1`, [x.session]);
      await immediate();
      assert.deepEqual(await ledgerOf(x.session), before);
    },
    failurePropagates: async () => {
      const guard = await definitionOf(GUARD);
      const faulty = guard.replace("IF TG_OP = 'INSERT' THEN", "IF TG_OP = 'INSERT' THEN\n    RAISE EXCEPTION 'PLANTED_LEDGER_WRITE_FAILURE' USING ERRCODE = '55000';");
      assert.notEqual(faulty, guard, 'the fault injection matched');
      await q(faulty);
      const before = await clockOf(x.session);
      await reserve(x);
      await refused(() => immediate(), ['55000'], /PLANTED_LEDGER_WRITE_FAILURE/u);
      assert.notDeepEqual(await clockOf(x.session), before, 'the move itself happened; only its recording failed, and the failure surfaced');
    },
    deferred: async () => {
      await reserve(x);
      assert.deepEqual(await rowsOfXact(x.session, await currentXact()), [], 'nothing before COMMIT');
    },
    ownObservation: async () => {
      await observe(x.session); // what is already committed is observed first, legitimately
      await immediate();
      await reserve(x);
      assert.equal(await observe(x.session), 0);
      assert.equal((await rowsOfXact(x.session, await currentXact()))[0].observed_at, null);
    },
    immutableObservation: async () => {
      await refused(() => q(`UPDATE ${LEDGER} SET observed_at = observed_at + interval '1 second' WHERE session_id = $1 AND observed_at IS NOT NULL`, [x.session]), ['55000']);
    },
    governedDelete: async () => {
      await refused(() => q(`DELETE FROM ${LEDGER} WHERE session_id = $1`, [x.session]), ['55000']);
    },
    isolation: async () => {
      const [p] = await rows("SELECT has_table_privilege('authenticated', $1, 'SELECT') AS s", [LEDGER]);
      assert.equal(p.s, false);
    },
    identity: async () => {
      const [latest] = (await ledgerOf(x.session)).slice(-1);
      await refused(() => q(`INSERT INTO ${LEDGER} (session_id, user_id, from_sp, from_event_sequence, through_sp, through_event_sequence, xact_id, trigger_at)
          VALUES ($1, $2, $3, $4, $5, 0, '3'::xid8, clock_timestamp())`, [x.session, x.user, latest.through_sp, latest.through_seq, latest.through_sp + 1]), ['55000']);
    },
    erasure: async () => {
      const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
          VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [x.user]);
      assert.equal(await asRoleLocal('service_role', async () => (await rows('SELECT public.server_erase_account_v1($1) AS outcome', [del.id]))[0].outcome), 'ERASED');
      assert.equal((await rows(`SELECT count(*)::int AS n FROM ${LEDGER} WHERE user_id = $1`, [x.user]))[0].n, 0);
    },
  };
  const replaceFn = (signature, from, to) => async () => {
    const pristine = await definitionOf(signature);
    const weakened = pristine.replace(from, to);
    assert.notEqual(weakened, pristine, `the planted defect matched nothing in ${signature}`);
    await q(weakened);
  };
  /** The recorder folds whenever a later position arrives, into the latest row by its key: through order, not identity. */
  const foldByThroughOrder = async () => {
    const pristine = await definitionOf(RECORDER);
    const weakened = pristine
      .replace('IF has_latest AND latest.xact_id = this_xact THEN', 'IF has_latest THEN')
      .replace('WHERE l.session_id = clock_row.session_id AND l.xact_id = this_xact;',
        'WHERE l.session_id = clock_row.session_id AND l.through_sp = latest.through_sp AND l.through_event_sequence = latest.through_event_sequence;');
    assert.ok(!weakened.includes('latest.xact_id = this_xact'), 'the identity test was removed');
    assert.ok(weakened.includes('l.through_sp = latest.through_sp'), 'the fold targets the latest row by its key');
    await q(weakened);
  };
  const defects = [
    ['D-01 no fold: every firing inserts', 'fold', [replaceFn(RECORDER, 'IF has_latest AND latest.xact_id = this_xact THEN', 'IF false THEN')]],
    ['D-02 fold by through order instead of transaction identity', 'newTransaction', [foldByThroughOrder]],
    ['D-02b the same with the guard\'s identity check removed too', 'newTransaction', [
      foldByThroughOrder, replaceFn(GUARD, 'IF OLD.xact_id = this_xact AND NEW.xact_id = this_xact', 'IF true')]],
    ['D-03 no no-op suppression', 'noop', [replaceFn(RECORDER, 'IF (final_sp, final_sequence) = (start_sp, start_sequence) THEN', 'IF false THEN')]],
    ['D-04 a handler swallows the ledger write failure', 'failurePropagates', [replaceFn(RECORDER, 'END$function$', 'EXCEPTION WHEN OTHERS THEN RETURN NULL;\nEND$function$')]],
    ['D-05 the recorder is not deferred', 'deferred', [async () => {
      const [{ def }] = await rows('SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = $1::regclass AND tgname = $2', [CLOCK, RECORDER_TRIGGER]);
      const weakened = def.replace(' DEFERRABLE INITIALLY DEFERRED', ' NOT DEFERRABLE INITIALLY IMMEDIATE');
      assert.notEqual(weakened, def);
      await q(`DROP TRIGGER ${RECORDER_TRIGGER} ON ${CLOCK}`);
      await q(weakened);
    }]],
    ['D-06a the observer stamps its own transaction\'s row', 'ownObservation', [replaceFn(OBSERVE, ' AND l.xact_id <> pg_catalog.pg_current_xact_id()', '')]],
    ['D-06b the same with the guard\'s visibility check removed too', 'ownObservation', [
      replaceFn(OBSERVE, ' AND l.xact_id <> pg_catalog.pg_current_xact_id()', ''),
      replaceFn(GUARD, ' AND OLD.xact_id <> this_xact', '')]],
    ['D-07 the guard admits a re-observation', 'immutableObservation', [replaceFn(GUARD, 'IF OLD.observed_at IS NULL AND NEW.observed_at IS NOT NULL', 'IF NEW.observed_at IS NOT NULL')]],
    ['D-08 the guard admits an ungoverned DELETE', 'governedDelete', [replaceFn(GUARD, "IF TG_OP = 'DELETE' THEN", "IF TG_OP = 'DELETE' THEN\n    RETURN OLD;")]],
    ['D-09 a client role is granted the ledger', 'isolation', [() => q(`GRANT SELECT ON ${LEDGER} TO authenticated`)]],
    ['D-10 the guard drops the transaction identity check', 'identity', [replaceFn(GUARD, 'NEW.xact_id IS DISTINCT FROM this_xact OR ', '')]],
    ['D-11 the ledger stops cascading from its Session', 'erasure', [async () => {
      const [{ name }] = await rows("SELECT conname AS name FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'", [LEDGER]);
      // NOT VALID: a shared CI database may hold rows of Sessions other verifiers removed in replica mode (no cascade there)
      await q(`ALTER TABLE ${LEDGER} DROP CONSTRAINT ${name}`);
      await q(`ALTER TABLE ${LEDGER} ADD CONSTRAINT ${name} FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT NOT VALID`);
    }]],
  ];
  await q('BEGIN');
  try {
    for (const [check, body] of Object.entries(checks)) {
      await report.isolated(`C-${check} canonical control passes`, body);
    }
    for (const [name, check, plants] of defects) {
      await report.isolated(name, async () => {
        for (const plant of plants) await plant();
        await q('SAVEPOINT planted_check');
        let detection = null;
        try { await checks[check](); } catch (error) { detection = error; }
        await q('ROLLBACK TO SAVEPOINT planted_check');
        assert.ok(detection, `the ${check} proof ACCEPTED the planted defect`);
        console.log(`0201 ${name.split(' ')[0]} detected by the ${check} proof: ${detection.code ?? 'assertion'} ${String(detection.message).split(String.fromCharCode(10))[0]}${
          detection.actual !== undefined ? ` (actual ${JSON.stringify(detection.actual)}, expected ${JSON.stringify(detection.expected)})` : ''}`);
      });
    }
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ P-05: latency (DIAGNOSTIC only)
async function measureLatency(report) {
  await report.section('P-05 DIAGNOSTIC commit latency of a clock move with and without the recorder', async () => {
    const x = await established();
    const once = async (replica) => {
      const t0 = process.hrtime.bigint();
      await q('BEGIN');
      // replica mode is the one way to move the clock with the recorder standing aside
      if (replica) await q("SET LOCAL session_replication_role = 'replica'");
      await reserve(x);
      await q('COMMIT');
      return Number(process.hrtime.bigint() - t0) / 1e6;
    };
    const stat = (times) => {
      const t = [...times].sort((a, b) => a - b);
      return `median ${t[Math.floor(t.length / 2)].toFixed(2)} / p95 ${t[Math.ceil(t.length * 0.95) - 1].toFixed(2)}`;
    };
    for (let i = 0; i < 20; i += 1) { await once(true); await once(false); } // warm-up, discarded
    const without = [];
    const recorded = [];
    for (let i = 0; i < 100; i += 1) { without.push(await once(true)); recorded.push(await once(false)); } // interleaved
    diagnostic(`P-05 reserve + COMMIT, ms (100 interleaved each, local PostgreSQL, one connection): without the recorder ${stat(without)}; with it ${stat(recorded)}`);
    const observing = [];
    for (let i = 0; i < 20; i += 1) {
      await tx(() => reserve(x));
      const t0 = process.hrtime.bigint();
      await tx(() => observe(x.session));
      observing.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    diagnostic(`P-05 one-Session observer transaction stamping one row, ms (20, local): ${stat(observing)}`);
    committedMoves.delete(x.session); // the replica-mode moves are deliberately unrecorded: this Session is not a chain proof
  });
}

// ------------------------------------------------------------------ fixture removal through the account erasure itself
async function erase(user) {
  await tx(async () => {
    const [del] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [user]);
    const outcome = await asRoleLocal('service_role', async () => (await rows('SELECT public.server_erase_account_v1($1) AS outcome', [del.id]))[0].outcome);
    assert.equal(outcome, 'ERASED');
  });
  erasedHumans.add(user);
}
async function removeFixtures() {
  await q('ROLLBACK').catch(() => undefined);
  await q('RESET ROLE').catch(() => undefined);
  for (const user of fixtureHumans) if (!erasedHumans.has(user)) await erase(user);
  await tx(async () => {
    await q("SET LOCAL session_replication_role = 'replica'");
    await q('DELETE FROM personal_data_private.account_deletions WHERE user_id = ANY($1::uuid[])', [fixtureHumans]);
  });
  await rt.removeFixtureHumans(fixtureHumans);
  const [{ n }] = await rows(`SELECT count(*)::int AS n FROM ${LEDGER} WHERE user_id = ANY($1::uuid[])`, [fixtureHumans]);
  assert.equal(n, 0, 'no fixture ledger row is left behind');
}

runVerifier('0201', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0201', { query: q, restore: async () => { await q('RESET ROLE').catch(() => undefined); } });
  const fixtures = {};
  try {
    setStage('C catalogue');
    await verifyCatalogue(report);
    setStage('B real commits');
    await verifyCommits(report, fixtures);
    if (fixtures.a) {
      setStage('L transaction identity');
      await verifyIdentity(report, fixtures);
      setStage('D planted defects');
      await verifyPlantedDefects(report, fixtures);
    } else {
      report.record('L/D need the B-01 fixture', false, 'B-01 did not establish its Session: L and D NOT RUN');
    }
    setStage('P-05 latency diagnostic');
    await measureLatency(report);
  } finally {
    setStage('fixture removal');
    await removeFixtures();
  }
  report.print();
  if (diagnostics.length) console.log(`0201 diagnostics (not proofs):\n  ${diagnostics.join('\n  ')}`);
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
