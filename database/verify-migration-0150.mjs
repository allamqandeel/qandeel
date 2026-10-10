// Real-PostgreSQL verifier for migration 0150 - PROD-RETRY-01: Data API stale-state refusals answered with a SQLSTATE
// PostgREST never re-runs (QAN-BL-PROD-06).
//
// Runs against a FULLY migrated database and proves, from live catalogs and real role-switched sessions:
//
//   BODY_EXACT            each of the twelve bodies is its defining migration's body with exactly the approved
//                         substitution (23 x ERRCODE 40001 -> PT409; one batch handler that also accepts PT409), and the
//                         0150 statement is the defining statement with exactly that substitution
//   POSTURE               owner, SECURITY DEFINER / INVOKER, search_path and who may EXECUTE are the frozen ones
//   PT409_CENSUS          PT409 is raised by exactly the eleven and 0135's two AI-usage conflicts, nothing else
//   SELF_CHECK p0..p6     the migration's own pre-condition and terminal self-check, re-run over the restored 0149
//                         bodies: the honest file applies, and six weakened files are refused
//   GUARD                 the cross-schema analysis of data-api-retry-hazard-guard.mjs: the twelve entry points let no
//                         40001 / 40P01 escape (and do let the exact PT409 refusal escape); every entry point that still
//                         lets a 40001 escape is one of the three classified in C1 and is discharged by a proof below;
//                         every absorbing handler is named; nothing raises 40P01; nothing raises the isolation level;
//                         every finding of the analysis is discharged or fails the run
//   GUARD g1..g5          the guard refuses five weakenings: a deterministic body restored to 40001, the batch catcher
//                         restored to 40001-only (CATCH_TRAP), a new client wrapper around a 40001 raiser, a handler that
//                         re-raises, and a raised isolation level
//   RACE_CONVERGING       ensure_public_identity_v1's first-creation race: structurally the only 40001 is the
//                         unique_violation answer behind a locked lookup; live, the loser's re-run (what PostgREST < v16
//                         does) answers ALREADY_PRESENT after exactly one re-run
//   REPLAY_GUARDED        commit_own_public_experience_ready_v1's replay branch reaches the core only for a committed
//                         command, and the core answers ALREADY_COMMITTED before any stale check: structurally and live
//   DYNAMIC_SQL           historical_event_identity_conflict_v1's one EXECUTE is a read-only SELECT of an ordinary table
//                         named by a literal at every call site
//   STALE_NO_WRITE        through Data-API-shaped sessions: Hypothesis (authenticated and service_role), the Thread
//                         identity dossier, both retained Matching reducers and the sealed Shared ID rotation answer
//                         PT409 with the exact message and DETAIL, and a stale request commits nothing - including the
//                         Matching lock row a command writes before it compares
//   SHARED_ID_RACES       two rotations from the same epoch: one ROTATED, one PT409, one current state; the same command
//                         twice at once: both answer the one committed epoch
//
// Compare-and-swap, idempotent replay and the remaining stale paths of the changed functions (Standing Context, the
// FINAL coordinator, the Matching revocations, the core credential races) are proven by the verifiers re-anchored to
// PT409 by this task (0027 / 0028 / 0032 / 0036 / 0070 / 0071 / 0078 / 0081 / 0109 / 0138 / 0149), and the batch's
// all-or-nothing UPDATES_REJECTED by verify-migration-0034.mjs, unchanged. Every scenario reports INDEPENDENTLY and the
// run fails ONCE at the end. Every committed fixture is removed; every probe rolls back.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { analyseRetryHazard, entryPoints, isWord, raiseCensus } from './data-api-retry-hazard-guard.mjs';
import { createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, actAs } = rt;

// ------------------------------------------------------------------ the frozen change set
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const migrationText = (prefix) => {
  const file = readdirSync(MIGRATIONS).find((name) => name.startsWith(prefix) && name.endsWith('.sql'));
  assert.ok(file, `migration ${prefix} exists`);
  return readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
};
const M0150 = migrationText('0150_');
const OLD_HANDLER = "WHEN SQLSTATE '40001' OR SQLSTATE '22023' THEN";
const NEW_HANDLER = "WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' OR SQLSTATE '22023' THEN";
const STALE_DETAIL = 'The user/world Thread identity dossiers changed after the runtime context was read; re-read the context and screen again.';

/** The twelve bodies: [live name, name in its defining migration, defining migration, sites | 'CATCHER', SECURITY DEFINER]. */
const TARGETS = [
  ['transition_hypothesis_core_v1', 'transition_hypothesis_core_v1', '0036', 2, true],
  ['apply_hypothesis_evidence_update_core_v1', 'apply_hypothesis_evidence_update_core_v1', '0032', 2, false],
  ['execute_post_response_hypothesis_update_batch_v1_core', 'execute_post_response_hypothesis_update_batch_v1', '0034', 'CATCHER', true],
  ['commit_finalized_exchange_with_full_semantic_chain_v1', 'commit_finalized_exchange_with_full_semantic_chain_v1', '0071', 2, true],
  ['get_conversation_thread_identity_dossier_page_v1', 'get_conversation_thread_identity_dossier_page_v1', '0070', 1, true],
  ['grant_shared_world_standing_context_v1', 'grant_shared_world_standing_context_v1', '0078', 2, true],
  ['revoke_shared_world_standing_context_v1', 'revoke_shared_world_standing_context_v1', '0078', 2, true],
  ['rotate_shared_world_invite_credential_v1', 'rotate_shared_world_invite_credential_v1', '0081', 4, true],
  ['pause_matching_participation_v1', 'pause_matching_participation_v1', '0109', 2, true],
  ['turn_off_matching_participation_v1', 'turn_off_matching_participation_v1', '0109', 2, true],
  ['revoke_matching_context_v1', 'revoke_matching_context_v1', '0109', 2, true],
  ['revoke_pre_match_disclosure_authority_v1', 'revoke_pre_match_disclosure_authority_v1', '0109', 2, true],
].map(([live, origin, migration, sites, secdef]) => ({ live, origin, migration, sites, secdef }));

/** The CREATE [OR REPLACE] FUNCTION statement of public.<name> in a migration text, through its closing `$$;`. */
function statementOf(text, name) {
  const start = Math.max(text.indexOf(`CREATE FUNCTION public.${name}(`), text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`));
  assert.ok(start >= 0, `public.${name} is created`);
  const open = text.indexOf('AS $$', start) + 'AS $$'.length;
  const close = text.indexOf('$$;', open);
  return { statement: text.slice(start, close + '$$;'.length), body: text.slice(open, close) };
}
const transform = (t, text) => (t.sites === 'CATCHER' ? text.replace(OLD_HANDLER, NEW_HANDLER) : text.replaceAll("ERRCODE='40001'", "ERRCODE='PT409'"));
/** The defining statement, re-pointed at the live name as CREATE OR REPLACE: the exact pre-0150 definition. */
function originalStatement(t) {
  const { statement } = statementOf(migrationText(t.migration), t.origin);
  return statement.replace(/^CREATE (OR REPLACE )?FUNCTION public\.\w+\(/u, `CREATE OR REPLACE FUNCTION public.${t.live}(`);
}

/** The twelve deterministic entry points and the exact stale messages each lets escape as PT409. */
const DETERMINISTIC = {
  transition_hypothesis_v2: ['Stale hypothesis version.'],
  apply_hypothesis_evidence_update: ['Stale hypothesis version.'],
  background_apply_hypothesis_evidence_update_v1: ['Stale hypothesis version.'],
  commit_finalized_exchange_with_full_semantic_chain_v1: ['STALE_CONVERSATIONAL_FOCUS_CONTEXT', 'STALE_THREAD_IDENTITY_CONTEXT'],
  get_conversation_thread_identity_dossier_page_v1: ['STALE_THREAD_IDENTITY_CONTEXT'],
  grant_shared_world_standing_context_v1: ['STANDING_CONTEXT_STALE_STATE'],
  revoke_shared_world_standing_context_v1: ['STANDING_CONTEXT_STALE_STATE'],
  pause_matching_participation_v1: ['MATCHING_STALE_STATE'],
  turn_off_matching_participation_v1: ['MATCHING_STALE_STATE'],
  revoke_matching_context_v1: ['MATCHING_STALE_STATE'],
  revoke_pre_match_disclosure_authority_v1: ['MATCHING_STALE_STATE'],
  rotate_own_sealed_shared_id_v1: ['SHARED_INVITE_CREDENTIAL_STALE_STATE'],
};
/** The entry points that still let a 40001 escape, each with the ONE raise it reaches and the proof that discharges it. */
const RETAINED = {
  start_own_public_experience_draft_v1: ['40001|PUBLIC_EXPERIENCE_STALE|public.ensure_public_identity_v1(uuid,uuid,text,text)', 'RACE_CONVERGING'],
  post_own_public_discussion_v1: ['40001|PUBLIC_EXPERIENCE_STALE|public.ensure_public_identity_v1(uuid,uuid,text,text)', 'RACE_CONVERGING'],
  commit_own_public_experience_ready_v1: ['40001|PUBLIC_EXPERIENCE_STALE|public.commit_public_experience_ready_for_review_v1(uuid,uuid,uuid)', 'REPLAY_GUARDED'],
};
/** The entry points that reach a 40001 raise and absorb every one of them in a handler. */
const ABSORBED = [
  'complete_shared_world_qandeel_reply_v1', 'approve_shared_world_proposal_v1', 'accept_shared_membership_request_v1',
  'approve_shared_world_history_share_v1', 'complete_shared_semantic_place_v1', 'approve_own_public_package_v1',
];
/** PT409 before 0150: 0135's AI-usage ledger conflicts. */
const PRIOR_PT409 = ['public.begin_ai_provider_call_v1', 'public.settle_ai_provider_call_v1'];

// ------------------------------------------------------------------ session helpers
/** A Data-API-shaped session inside the caller's transaction: the role PostgREST switches to, with its claims. */
async function asClient(role, uid = null, on = q) {
  await on('RESET ROLE');
  await on("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
  if (role !== 'postgres') await on(`SET LOCAL ROLE ${role}`);
}
/** The refusal of `operation`, inside a savepoint so the caller's transaction survives it. */
async function refusal(operation) {
  await q('SAVEPOINT r');
  let error = null;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT r');
    await q('RELEASE SAVEPOINT r');
  }
  assert.ok(error, 'the operation was refused');
  return error;
}
const assertStale = (error, message, detail = undefined) => {
  assert.equal(error.code, 'PT409', `${message} is answered with PT409 (got ${error.code}: ${error.message})`);
  assert.equal(error.message, message, 'the semantic message is byte-identical');
  assert.equal(error.detail, detail, 'the DETAIL is the frozen one');
  assert.equal(error.hint, undefined, 'no HINT is disclosed');
};
/** Applies migration text inside the caller's transaction (its own BEGIN / COMMIT removed). */
const applyInline = (text) => {
  const inline = text.replace(/^BEGIN;$/mu, '').replace(/^COMMIT;$/mu, '');
  assert.equal(text.length - inline.length, 'BEGIN;'.length + 'COMMIT;'.length, 'exactly one BEGIN; and one COMMIT;');
  return q(inline);
};
/** A transform that must change the text, so a probe can never pass by matching nothing. */
const mutated = (text, from, to) => {
  assert.ok(text.includes(from), `the probe's anchor exists: ${from.slice(0, 60)}`);
  const out = text.replace(from, () => to);
  assert.notEqual(out, text, 'the probe changed the text');
  return out;
};
/** Requires `operation` to be refused with a message matching `pattern`. */
async function refusedWith(operation, pattern) {
  const error = await refusal(operation);
  assert.match(error.message, pattern, `refused for the right reason (got ${error.code}: ${error.message})`);
}

// ------------------------------------------------------------------ 1. catalog
async function verifyCatalog(report) {
  await report.section('BODY_EXACT each body is its defining body with exactly the approved substitution, and so is 0150', async () => {
    for (const t of TARGETS) {
      const origin = statementOf(migrationText(t.migration), t.origin);
      const [live] = await rows(`SELECT prosrc FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace`, [t.live]);
      if (t.sites === 'CATCHER') {
        assert.equal(origin.body.split(OLD_HANDLER).length - 1, 1, `${t.live}: the defining body holds the one batch handler`);
      } else {
        assert.equal(origin.body.split("ERRCODE='40001'").length - 1, t.sites, `${t.live}: the defining body holds ${t.sites} sites`);
        assert.equal(origin.body.split('40001').length - 1, t.sites, `${t.live}: and no other 40001`);
      }
      assert.equal(live.prosrc.replace(/\r\n/gu, '\n'), transform(t, origin.body), `${t.live}: the live body is the approved substitution`);
      if (t.sites !== 'CATCHER') assert.equal(live.prosrc.includes("ERRCODE='40001'"), false, `${t.live}: no 40001 refusal remains`);
      assert.equal(statementOf(M0150, t.live).statement, transform(t, originalStatement(t)), `${t.live}: 0150 is the defining statement, substituted`);
    }
  });
  await report.section('POSTURE owners, security mode, search_path and EXECUTE are the frozen ones', async () => {
    const entryRoles = {
      transition_hypothesis_v2: 'authenticated', apply_hypothesis_evidence_update: 'authenticated',
      grant_shared_world_standing_context_v1: 'authenticated', revoke_shared_world_standing_context_v1: 'authenticated',
      pause_matching_participation_v1: 'authenticated', turn_off_matching_participation_v1: 'authenticated',
      revoke_matching_context_v1: 'authenticated', revoke_pre_match_disclosure_authority_v1: 'authenticated',
      rotate_own_sealed_shared_id_v1: 'authenticated', background_apply_hypothesis_evidence_update_v1: 'service_role',
      get_conversation_thread_identity_dossier_page_v1: 'service_role', commit_finalized_exchange_with_full_semantic_chain_v1: 'service_role',
    };
    for (const t of TARGETS) {
      const [p] = await rows(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig::text AS config
                                FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                               WHERE n.nspname = 'public' AND p.proname = $1`, [t.live]);
      assert.equal(p.owner, 'postgres', `${t.live} is postgres-owned`);
      assert.equal(p.prosecdef, t.secdef, `${t.live} keeps its security mode`);
      assert.equal(p.config, '{"search_path=\\"\\""}', `${t.live} keeps search_path=''`);
      assert.equal(await executes('anon', t.live), false, `anon cannot execute ${t.live}`);
    }
    for (const core of ['transition_hypothesis_core_v1', 'apply_hypothesis_evidence_update_core_v1',
      'execute_post_response_hypothesis_update_batch_v1_core', 'rotate_shared_world_invite_credential_v1']) {
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await executes(role, core), false, `${role} cannot execute the core ${core}`);
    }
    for (const [entry, role] of Object.entries(entryRoles)) {
      assert.equal(await executes(role, entry), true, `${role} still executes ${entry}`);
      assert.equal(await executes('anon', entry), false, `anon cannot execute ${entry}`);
      if (role === 'service_role') assert.equal(await executes('authenticated', entry), false, `authenticated cannot execute ${entry}`);
    }
  });
  await report.section('PT409_CENSUS PT409 is raised by exactly the eleven and the two 0135 AI-usage conflicts', async () => {
    const analysis = await analyse();
    const raisers = [...new Set(raiseCensus(analysis).filter((r) => r.code === 'PT409').map((r) => r.signature.slice(0, r.signature.indexOf('('))))].sort();
    const expected = [...PRIOR_PT409, ...TARGETS.filter((t) => t.sites !== 'CATCHER').map((t) => `public.${t.live}`)].sort();
    assert.deepEqual(raisers, expected);
    assert.equal(raiseCensus(analysis).filter((r) => r.code === 'PT409' && !PRIOR_PT409.some((p) => r.signature.startsWith(`${p}(`))).length, 23, '23 stale-state sites');
  });
}
const executes = async (role, name) => (await rows(`SELECT bool_or(has_function_privilege($1, p.oid, 'EXECUTE')) AS x
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $2`, [role, name]))[0].x;

// ------------------------------------------------------------------ 2. the migration's own self-check
async function verifySelfCheck(report) {
  const restore = async () => { for (const t of TARGETS) await q(originalStatement(t)); };
  const transition = TARGETS.find((t) => t.live === 'transition_hypothesis_core_v1');
  await q('BEGIN');
  try {
    const probe = async (name, body) => {
      await report.section(name, async () => {
        await q('SAVEPOINT probe');
        try { await body(); } finally { await q('ROLLBACK TO SAVEPOINT probe'); await q('RELEASE SAVEPOINT probe'); }
      });
    };
    await probe('SELF_CHECK p0 over the restored 0149 bodies the honest 0150 applies and lands exactly the approved bodies', async () => {
      await restore();
      const [{ prosrc }] = await rows(`SELECT prosrc FROM pg_proc WHERE proname = 'transition_hypothesis_core_v1'`);
      assert.equal(prosrc.split("ERRCODE='40001'").length - 1, 2, 'the restoration really is the pre-0150 body');
      await applyInline(M0150);
      for (const t of TARGETS) {
        const [live] = await rows(`SELECT prosrc FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace`, [t.live]);
        assert.equal(live.prosrc, transform(t, statementOf(migrationText(t.migration), t.origin).body), `${t.live} lands exactly`);
      }
    });
    await probe('SELF_CHECK p1 a body that changes anything beyond the SQLSTATE is refused', async () => {
      await restore();
      await refusedWith(() => applyInline(mutated(M0150, "RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409'; END IF;",
        "RAISE EXCEPTION 'MATCHING_STALE_STATE ' USING ERRCODE='PT409'; END IF;")), /PROD_RETRY_01_0150_SELF_CHECK: the body of/u);
    });
    await probe('SELF_CHECK p2 a grant hidden in the migration is refused', async () => {
      await restore();
      await refusedWith(() => applyInline(mutated(M0150, '-- 4. Terminal self-check, from the catalog.',
        'GRANT EXECUTE ON FUNCTION public.transition_hypothesis_core_v1(uuid,uuid,integer,text,text) TO authenticated;\n-- 4. Terminal self-check, from the catalog.')),
      /PROD_RETRY_01_0150_SELF_CHECK: the posture of public\.transition_hypothesis_core_v1/u);
    });
    await probe('SELF_CHECK p3 a change to any other application function is refused', async () => {
      await restore();
      await refusedWith(() => applyInline(mutated(M0150, '-- 4. Terminal self-check, from the catalog.',
        "COMMENT ON FUNCTION public.ensure_public_identity_v1(uuid,uuid,text,text) IS 'probe';\n-- 4. Terminal self-check, from the catalog.")),
      /outside the approved twelve changed/u);
    });
    await probe('SELF_CHECK p4 a lost SECURITY DEFINER is refused', async () => {
      await restore();
      const statement = transform(transition, originalStatement(transition));
      await refusedWith(() => applyInline(mutated(M0150, statement, statement.replace('LANGUAGE plpgsql SECURITY DEFINER', 'LANGUAGE plpgsql'))),
        /PROD_RETRY_01_0150_SELF_CHECK: the posture of public\.transition_hypothesis_core_v1/u);
    });
    await probe('SELF_CHECK p5 re-applying 0150 to a migrated database is refused before anything changes', async () => {
      await refusedWith(() => applyInline(M0150), /PROD_RETRY_01_0150_PRECONDITION: .* already mentions PT409/u);
    });
    await probe('SELF_CHECK p6 a drifted pre-0150 body (one site missing) is refused before anything changes', async () => {
      await restore();
      const pause = TARGETS.find((t) => t.live === 'pause_matching_participation_v1');
      await q(mutated(originalStatement(pause), "ERRCODE='40001'", "ERRCODE='40002'"));
      await refusedWith(() => applyInline(M0150), /PROD_RETRY_01_0150_PRECONDITION: public\.pause_matching_participation_v1\(uuid,uuid\) holds 1 stale-state sites, expected 2/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ 3. the guard
const analyse = () => analyseRetryHazard((text, values) => rows(text, values));
const fnOf = (analysis, signature) => {
  const f = analysis.fns.find((x) => x.signature === signature);
  assert.ok(f, `${signature} exists`);
  return f;
};
/** The tokens of a function as one normalized string (literals quoted), for exact structural proofs. */
const codeOf = (tokens) => tokens.map((t) => (t.t === 'str' ? `'${t.v}'` : t.v)).join(' ');

/** DYNAMIC_SQL: the one EXECUTE reads an ordinary table named by a literal at every call site; it can reach no function. */
function proveDynamicSql(analysis) {
  const f = fnOf(analysis, 'public.historical_event_identity_conflict_v1(text,uuid,jsonb)');
  const at = f.tokens.flatMap((t, i) => (isWord(t, 'EXECUTE') ? [i] : []));
  assert.equal(at.length, 1, 'exactly one EXECUTE');
  const [format, open, template] = f.tokens.slice(at[0] + 1, at[0] + 4);
  assert.ok(isWord(format, 'FORMAT') && open.v === '(' && template.t === 'str', 'EXECUTE format(<literal template>, ...)');
  assert.match(template.v, /^SELECT to_jsonb\(t\) - 'created_at' FROM public\.%I t WHERE t\.event_id = \$1$/u, 'a single read-only SELECT of one relation');
  const callers = analysis.fns.filter((x) => x.calls.some((c) => c.callee === f.oid));
  assert.ok(callers.length > 0, 'it is called');
  return Promise.all(callers.flatMap((caller) => caller.tokens.flatMap((t, i) => (
    t.t === 'word' && t.v === 'historical_event_identity_conflict_v1' && caller.tokens[i + 1]?.v === '(' ? [caller.tokens[i + 2]] : []))
    .map(async (arg) => {
      assert.equal(arg.t, 'str', `${caller.signature} names the relation with a literal`);
      const [{ kind }] = await rows("SELECT (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.' || quote_ident($1)))::text AS kind", [arg.v]);
      assert.equal(kind, 'r', `${arg.v} is an ordinary table: a SELECT of it calls no function`);
    })));
}

/** RACE_CONVERGING, structurally: the ONE 40001 answers only the per-user unique key, behind a locked lookup that returns. */
function proveRaceConvergingStructure(analysis) {
  const f = fnOf(analysis, 'public.ensure_public_identity_v1(uuid,uuid,text,text)');
  const tracked = f.raises.filter((r) => ['40001', '40P01', 'PT409'].includes(r.code));
  assert.equal(tracked.length, 1, 'exactly one tracked raise');
  assert.equal(tracked[0].message, 'PUBLIC_EXPERIENCE_STALE');
  const frame = f.blocks.frames.find((fr) => fr.clauses.some((c) => tracked[0].at > c.start && tracked[0].at < c.end));
  const clause = frame.clauses.find((c) => tracked[0].at > c.start && tracked[0].at < c.end);
  assert.deepEqual(clause.conditions, ['unique_violation'], 'the raise answers a unique violation only');
  assert.match(codeOf(f.tokens.slice(clause.start, tracked[0].at)), /IF conflict = 'public_identities_user_key' THEN$/u,
    'and only the per-user key of public_identities');
  assert.match(codeOf(f.tokens.slice(frame.start, frame.exceptionAt)), /^BEGIN INSERT INTO public \. public_identities /u,
    'the protected statement is the one identity insert');
  assert.match(codeOf(f.tokens.slice(0, frame.start)),
    /SELECT \* INTO existing FROM public \. public_identities i WHERE i \. user_id = u FOR UPDATE ; .*IF FOUND THEN .*RETURN ; END IF ;$/u,
    'a re-run first finds the winner\'s committed identity, under lock, and returns');
}

/** REPLAY_GUARDED, structurally: the unprotected call is the committed-command branch, and the core answers it first. */
function proveReplayGuardedStructure(analysis) {
  const caller = fnOf(analysis, 'public_authoring_private.commit_own_public_experience_ready_v1(uuid,uuid)');
  const core = fnOf(analysis, 'public.commit_public_experience_ready_for_review_v1(uuid,uuid,uuid)');
  const sites = caller.calls.filter((c) => c.callee === core.oid);
  assert.equal(sites.length, 2, 'the wrapper calls the core twice');
  const unprotected = sites.filter((c) => caller.blocks.protectors(c.at).length === 0);
  assert.equal(unprotected.length, 1, 'exactly one call is outside the classifying handler');
  const before = codeOf(caller.tokens.slice(0, unprotected[0].at));
  const branch = /IF EXISTS \( SELECT 1 FROM public \. public_experience_review_ready_commands c WHERE c \. id = p_command_id \) THEN SELECT d \. outcome , d \. current_lifecycle INTO r FROM$/u;
  assert.match(before, branch, 'it is the branch taken only when this exact command is already committed');
  assert.match(codeOf(caller.tokens.slice(unprotected[0].at, unprotected[0].at + 6)), /^public \. commit_public_experience_ready_for_review_v1 \( p_command_id ,/u,
    'and it passes that same command id');
  const firstRaise = Math.min(...core.raises.filter((r) => r.code === '40001').map((r) => r.at));
  assert.match(codeOf(core.tokens.slice(0, firstRaise)),
    /SELECT \* INTO committed FROM public \. public_experience_review_ready_commands c WHERE c \. id = p_command_id ; IF FOUND THEN IF committed \. request_ref <> request THEN RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE = '23505' ; END IF ; .*RETURN ; END IF ;/u,
    'the core answers a committed command (ALREADY_COMMITTED or 23505) before any stale comparison');
  const deleters = analysis.fns.filter((x) => /DELETE FROM public \. public_experience_review_ready_commands/u.test(codeOf(x.tokens)));
  assert.deepEqual(deleters.map((x) => x.signature), [], 'no function removes a committed command');
}

/** The canonical guard check: every claim of the C1 classification, from the live catalog. */
async function verifyGuard(analysis = null) {
  const a = analysis ?? await analyse();
  const entries = new Map(entryPoints(a).map((e) => [e.name, e]));
  const findings = a.findings.filter((x) => !(x.kind === 'DYNAMIC_SQL' && x.signature === 'public.historical_event_identity_conflict_v1(text,uuid,jsonb)'));
  assert.deepEqual(findings, [], `every finding of the analysis is discharged: ${JSON.stringify(findings)}`);
  for (const [name, messages] of Object.entries(DETERMINISTIC)) {
    const e = entries.get(name);
    assert.ok(e, `${name} is a Data API entry point`);
    assert.deepEqual(e.retryable, [], `${name} lets no 40001 / 40P01 escape`);
    assert.deepEqual([...new Set(e.stale.map((s) => s.message))].sort(), [...messages].sort(), `${name} answers exactly its stale refusal with PT409`);
  }
  const retained = [...entries.values()].filter((e) => e.retryable.length > 0);
  assert.deepEqual(retained.map((e) => e.name).sort(), Object.keys(RETAINED).sort(), 'only the three classified entry points still let a 40001 escape');
  for (const e of retained) {
    assert.deepEqual(e.retryable.map((x) => `${x.code}|${x.message}|${x.origin}`), [RETAINED[e.name][0]], `${e.name} lets exactly its classified raise escape`);
  }
  const absorbed = [...entries.values()].filter((e) => e.reachesRetryableRaise && e.retryable.length === 0 && !(e.name in DETERMINISTIC));
  assert.deepEqual(absorbed.map((e) => e.name).sort(), [...ABSORBED].sort(), 'every other entry point that reaches a 40001 absorbs it');
  for (const e of absorbed) assert.ok(e.absorbed.length > 0, `${e.name} names its handler`);
  assert.deepEqual(raiseCensus(a).filter((r) => r.code === '40P01'), [], 'nothing raises 40P01');
  return a;
}

async function verifyGuardSection(report) {
  let analysis = null;
  await report.section('GUARD the twelve let only PT409 escape; the three retained, the absorbed and the findings are exactly classified', async () => {
    analysis = await verifyGuard();
  });
  await report.section('DYNAMIC_SQL the one EXECUTE is a read-only SELECT of an ordinary table at every call site', async () => {
    await proveDynamicSql(analysis ?? await analyse());
  });
  await report.section('RACE_CONVERGING structure: the only 40001 answers the per-user key behind a locked lookup that returns', async () => {
    proveRaceConvergingStructure(analysis ?? await analyse());
  });
  await report.section('REPLAY_GUARDED structure: the unprotected call is the committed-command branch, answered before any stale check', async () => {
    proveReplayGuardedStructure(analysis ?? await analyse());
  });

  const wrapper = (name, body) => `CREATE FUNCTION public.${name}() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
${body}
END$$;
GRANT EXECUTE ON FUNCTION public.${name}() TO authenticated;`;
  const refusedByGuard = async (setup, pattern) => {
    await setup();
    let error = null;
    try { await verifyGuard(); } catch (caught) { error = caught; }
    assert.ok(error, 'the guard refused the weakening');
    assert.match(String(error.message), pattern, `refused for the right reason (got: ${String(error.message).slice(0, 200)})`);
  };
  const probes = [
    ['GUARD g1 a deterministic body restored to 40001 is refused', async () => {
      await q(originalStatement(TARGETS.find((t) => t.live === 'transition_hypothesis_core_v1')));
    }, /transition_hypothesis_v2 lets no 40001/u],
    ['GUARD g2 the batch catcher restored to 40001-only is a CATCH_TRAP', async () => {
      await q(originalStatement(TARGETS.find((t) => t.live === 'execute_post_response_hypothesis_update_batch_v1_core')));
    }, /every finding of the analysis is discharged[\s\S]*CATCH_TRAP/u],
    ['GUARD g3 a new client wrapper around a 40001 raiser is refused', async () => {
      await q(wrapper('prod_retry_01_probe_escape_v1',
        '  PERFORM 1 FROM public.commit_public_experience_ready_for_review_v1(NULL::uuid, NULL::uuid, NULL::uuid);'));
    }, /only the three classified entry points/u],
    ['GUARD g4 a handler that re-raises absorbs nothing', async () => {
      await q(wrapper('prod_retry_01_probe_reraise_v1', `  BEGIN
    PERFORM 1 FROM public.commit_public_experience_ready_for_review_v1(NULL::uuid, NULL::uuid, NULL::uuid);
  EXCEPTION WHEN serialization_failure THEN
    RAISE;
  END;`));
    }, /only the three classified entry points/u],
    ['GUARD g5 a raised isolation level is refused', async () => {
      await q("ALTER FUNCTION public.ensure_public_identity_v1(uuid,uuid,text,text) SET default_transaction_isolation = 'serializable'");
    }, /every finding of the analysis is discharged[\s\S]*ISOLATION/u],
  ];
  await q('BEGIN');
  try {
    for (const [name, setup, pattern] of probes) {
      await report.section(name, async () => {
        await q('SAVEPOINT probe');
        try { await refusedByGuard(setup, pattern); } finally { await q('ROLLBACK TO SAVEPOINT probe'); await q('RELEASE SAVEPOINT probe'); }
      });
    }
    await report.section('GUARD the canonical check passes again once every probe is rolled back', () => verifyGuard());
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ 4. live behaviour
const humans = [];
async function newHuman() {
  const id = randomUUID();
  humans.push(id);
  await q('INSERT INTO auth.users(id) VALUES ($1)', [id]);
  return id;
}
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function drawSharedId() {
  let out = '';
  for (let i = 0; i < 12; i += 1) { out += ALPHABET[randomInt(32)]; if (i === 3 || i === 7) out += '-'; }
  return out;
}
const lookupRef = (canonical) => `sid1:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
const ROTATE_SEALED = 'SELECT * FROM public.rotate_own_sealed_shared_id_v1($1, $2, $3, 1, $4, $5, $6)';
const sealArgs = () => [randomBytes(12), randomBytes(14), randomBytes(16)];
const sharedIdState = async (human) => (await rows(`SELECT
    (SELECT jsonb_agg(to_jsonb(s)) FROM public.shared_world_invite_credential_state s WHERE s.user_id = $1) AS credential,
    (SELECT jsonb_agg(v.credential_epoch ORDER BY v.credential_epoch) FROM shared_private.shared_id_sealed_values v WHERE v.user_id = $1) AS sealed,
    (SELECT jsonb_agg(c.resulting_credential_epoch ORDER BY c.resulting_credential_epoch) FROM public.shared_world_invitation_commands c
      WHERE c.actor_user_id = $1) AS commands`, [human]))[0];

async function verifyStaleNoWrite(report) {
  await report.section('STALE_NO_WRITE Hypothesis: authenticated and service_role stale versions are PT409 and write nothing', async () => {
    await q('BEGIN');
    try {
      const owner = await newHuman();
      const session = randomUUID();
      const id = randomUUID();
      await q(`INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,assumptions)
               VALUES($1,$2,'prod-retry-01 probe','CAUSAL','GENERAL',$3,'HUMAN_REVIEWED','ACTIVE','{}')`, [id, owner, `CONVERSATION_SESSION:${session}`]);
      const snapshot = async () => (await rows(`SELECT to_jsonb(h) AS h,
          (SELECT count(*) FROM public.hypothesis_lifecycle_transitions t WHERE t.hypothesis_id = h.id)::int AS transitions,
          (SELECT count(*) FROM public.hypothesis_updates u WHERE u.hypothesis_id = h.id)::int AS updates
        FROM public.hypotheses h WHERE h.id = $1`, [id]))[0];
      const before = await snapshot();
      await asClient('authenticated', owner);
      assertStale(await refusal(() => q('SELECT * FROM public.transition_hypothesis_v2($1,$2,$3)', [id, 2, 'SUPPORTED'])), 'Stale hypothesis version.');
      assertStale(await refusal(() => q('SELECT * FROM public.apply_hypothesis_evidence_update($1,$2,$3,$4,$5)',
        [randomUUID(), id, 2, `memory:${randomUUID()}`, 'SUPPORTING'])), 'Stale hypothesis version.');
      await asClient('service_role');
      assertStale(await refusal(() => q('SELECT * FROM public.background_apply_hypothesis_evidence_update_v1($1,$2,$3,$4,$5,$6,$7)',
        [owner, session, randomUUID(), id, 2, `memory:${randomUUID()}`, 'SUPPORTING'])), 'Stale hypothesis version.');
      await asClient('postgres');
      assert.deepEqual(await snapshot(), before, 'the hypothesis, its lifecycle audit and its update audit are untouched');
    } finally {
      await q('ROLLBACK');
    }
  });
  await report.section('STALE_NO_WRITE the Thread identity dossier: PT409 with the exact message and DETAIL', async () => {
    await q('BEGIN');
    try {
      await asClient('service_role');
      assertStale(await refusal(() => q('SELECT * FROM public.get_conversation_thread_identity_dossier_page_v1($1,$2,$3,$4)', [randomUUID(), 1, null, 8])),
        'STALE_THREAD_IDENTITY_CONTEXT', STALE_DETAIL);
    } finally {
      await q('ROLLBACK');
    }
  });
  await report.section('STALE_NO_WRITE retained Matching reducers: a stale request in its own transaction commits not even its lock row', async () => {
    const human = await newHuman();
    const { q2, close } = await rt.openSecondary();
    try {
      for (const fn of ['pause_matching_participation_v1', 'turn_off_matching_participation_v1']) {
        await q2('BEGIN');
        await q2("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: human, role: 'authenticated' })]);
        await q2('SET LOCAL ROLE authenticated');
        let error = null;
        try { await q2(`SELECT * FROM public.${fn}($1, $2)`, [randomUUID(), randomUUID()]); } catch (caught) { error = caught; }
        await q2('ROLLBACK');
        assert.ok(error, `${fn} refused`);
        assertStale(error, 'MATCHING_STALE_STATE');
      }
      const [{ n }] = await rows(`SELECT (SELECT count(*) FROM public.matching_setup_locks WHERE user_id = $1)
        + (SELECT count(*) FROM public.matching_participation_events WHERE participant_user_id = $1) AS n`, [human]);
      assert.equal(Number(n), 0, 'no lock row and no participation event exist for the human');
    } finally {
      await close();
    }
  });
}

async function verifySharedId(report) {
  const human = await newHuman();
  // The existing credential state, as the owner with the human's claims (a FIRST Shared ID is launch-gated).
  await q('BEGIN');
  await asClient('postgres', human);
  const first = drawSharedId();
  await q('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, NULL)', [randomUUID(), lookupRef(first)]);
  await q('COMMIT');
  await report.section('STALE_NO_WRITE Shared ID: a stale sealed rotation is PT409 with the bounded message only, and writes nothing', async () => {
    const before = await sharedIdState(human);
    await q('BEGIN');
    try {
      await asClient('authenticated', human);
      const error = await refusal(() => q(ROTATE_SEALED, [randomUUID(), 7, drawSharedId(), ...sealArgs()]));
      assertStale(error, 'SHARED_INVITE_CREDENTIAL_STALE_STATE');
      assert.doesNotMatch(JSON.stringify({ m: error.message, d: error.detail, h: error.hint, w: error.where }), /sid1:|[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/u,
        'no credential reference or Shared ID is disclosed');
    } finally {
      await q('ROLLBACK');
    }
    assert.deepEqual(await sharedIdState(human), before, 'credential state, sealed value and command history are untouched');
  });
  const { q2, close } = await rt.openSecondary();
  const asHumanOn = async (run) => {
    await run('BEGIN');
    await run("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: human, role: 'authenticated' })]);
    await run('SET LOCAL ROLE authenticated');
  };
  try {
    await report.section('SHARED_ID_RACES two rotations from the same epoch: one ROTATED, the loser PT409, one current state', async () => {
      await asHumanOn(q);
      const [won] = (await q(ROTATE_SEALED, [randomUUID(), 1, drawSharedId(), ...sealArgs()])).rows;
      assert.deepEqual({ ...won }, { outcome: 'ROTATED', credential_epoch: '2' });
      await asHumanOn(q2);
      const loser = q2(ROTATE_SEALED, [randomUUID(), 1, drawSharedId(), ...sealArgs()]);
      assert.equal(await rt.stillPending(loser), true, 'the second rotation queues on the credential row');
      await q('COMMIT');
      let error = null;
      try { await loser; } catch (caught) { error = caught; }
      await q2('ROLLBACK');
      assert.ok(error, 'the loser is refused');
      assertStale(error, 'SHARED_INVITE_CREDENTIAL_STALE_STATE');
      const state = await sharedIdState(human);
      assert.equal(state.credential.length, 1);
      assert.equal(Number(state.credential[0].epoch), 2, 'one current state, at epoch 2');
      assert.deepEqual(state.sealed, [2], 'one sealed value, at epoch 2');
    });
    await report.section('SHARED_ID_RACES the same rotation twice at once: both answer the one committed epoch', async () => {
      const command = randomUUID();
      const value = drawSharedId();
      const seal = sealArgs();
      await asHumanOn(q);
      const [one] = (await q(ROTATE_SEALED, [command, 2, value, ...seal])).rows;
      await asHumanOn(q2);
      const twin = q2(ROTATE_SEALED, [command, 2, value, ...seal]);
      assert.equal(await rt.stillPending(twin), true, 'the twin queues on the credential row');
      await q('COMMIT');
      const [two] = (await twin).rows;
      await q2('COMMIT');
      assert.deepEqual({ ...one }, { outcome: 'ROTATED', credential_epoch: '3' });
      assert.deepEqual({ ...two }, { outcome: 'ROTATED', credential_epoch: '3' }, 'the equivalent retry answers the committed epoch');
      const [{ n }] = await rows('SELECT count(*)::int AS n FROM public.shared_world_invitation_commands WHERE id = $1', [command]);
      assert.equal(n, 1, 'one command history row');
    });
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await close();
  }
}

async function verifyRaceConverging(report) {
  await report.section('RACE_CONVERGING live: the loser of a first-identity race is 40001, and its re-run answers ALREADY_PRESENT', async () => {
    const human = await newHuman();
    const ref = randomUUID();
    const { q2, actAs2, close } = await rt.openSecondary();
    try {
      await q('BEGIN');
      await actAs(human);
      const [created] = await rows('SELECT * FROM public.ensure_public_identity_v1($1, $2, $3, $4)', [randomUUID(), ref, 'PSEUDONYM', 'first']);
      assert.equal(created.outcome, 'CREATED');
      await actAs2(human);
      await q2('BEGIN');
      const command = randomUUID();
      const call = () => q2('SELECT * FROM public.ensure_public_identity_v1($1, $2, $3, $4)', [command, randomUUID(), 'PSEUDONYM', 'second']);
      const loser = call();
      assert.equal(await rt.stillPending(loser), true, 'the second creation waits on the per-user key');
      await q('COMMIT');
      let error = null;
      try { await loser; } catch (caught) { error = caught; }
      await q2('ROLLBACK');
      assert.ok(error, 'the loser is refused');
      assert.equal(error.code, '40001', 'the race answer stays 40001 by design');
      assert.equal(error.message, 'PUBLIC_EXPERIENCE_STALE');
      // Exactly what PostgREST < v16 does with a 40001: the same request, again, in a new transaction.
      await q2('BEGIN');
      const [rerun] = (await call()).rows;
      await q2('COMMIT');
      assert.equal(rerun.outcome, 'ALREADY_PRESENT', 'one re-run converges on the winner\'s identity');
      assert.equal(rerun.public_identity_ref, ref);
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await close();
    }
  });
}

async function verifyReplayGuarded(report) {
  await report.section('REPLAY_GUARDED live: a committed READY command is answered before any stale comparison', async () => {
    await q('BEGIN');
    try {
      const f = rt.newFixture();
      await rt.asRole('postgres');
      await rt.provision(f);
      await rt.provisionIdentities(f);
      const ready = await rt.bringToReady(f, { experience: f.experience, manifest: f.manifest, version: f.version });
      const [{ id: command }] = await rows('SELECT id FROM public.public_experience_review_ready_commands WHERE experience_id = $1', [ready.experience]);
      // Make the core's stale comparison TRUE for anything that reaches it: the Experience back in DRAFT, its current
      // version no longer the committed one.
      await q('RESET ROLE');
      await q('UPDATE public.public_experiences SET current_lifecycle = $2, current_experience_version_id = NULL WHERE id = $1', [ready.experience, 'DRAFT']);
      await actAs(f.mohamed);
      const fresh = await refusal(() => q('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)', [randomUUID(), ready.experience, ready.version]));
      assert.equal(fresh.code, '40001', 'a NEW command does reach the stale comparison');
      assert.equal(fresh.message, 'PUBLIC_EXPERIENCE_STALE');
      const [replay] = await rows('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)', [command, ready.experience, ready.version]);
      assert.equal(replay.outcome, 'ALREADY_COMMITTED', 'the committed command is answered from its history first');
    } finally {
      await q('ROLLBACK');
    }
  });
}

async function removeHumans() {
  if (humans.length === 0) return;
  await q('RESET ROLE');
  await q('BEGIN');
  try {
    await q('ALTER TABLE public.public_identity_commands DISABLE TRIGGER public_identity_commands_immutable');
    await q('DELETE FROM public.public_identity_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.public_identity_display_state WHERE public_identity_ref IN (SELECT public_identity_ref FROM public.public_identities WHERE user_id = ANY($1::uuid[]))', [humans]);
    await q('DELETE FROM public.public_identities WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('ALTER TABLE public.public_identity_commands ENABLE TRIGGER public_identity_commands_immutable');
    await q('DELETE FROM public.shared_world_invitation_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.shared_world_direct_invitations WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM shared_private.shared_id_sealed_values WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.shared_world_invite_credential_state WHERE user_id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
}

// ---------------------------------------------------------------------- main
await runVerifier('0150', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0150', { query: q, restore: async () => { await q('RESET ROLE'); } });
  try {
    stage('catalog');
    await verifyCatalog(report);
    stage('self-check');
    await verifySelfCheck(report);
    stage('guard');
    await verifyGuardSection(report);
    stage('stale and no-write');
    await verifyStaleNoWrite(report);
    stage('shared id');
    await verifySharedId(report);
    stage('race-converging');
    await verifyRaceConverging(report);
    stage('replay-guarded');
    await verifyReplayGuarded(report);
  } finally {
    stage('fixture removal');
    await q('ROLLBACK').catch(() => undefined);
    await removeHumans();
  }
  stage('report');
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[]))
    + (SELECT count(*) FROM public.public_identities WHERE user_id = ANY($1::uuid[]))
    + (SELECT count(*) FROM public.shared_world_invite_credential_state WHERE user_id = ANY($1::uuid[]))
    + (SELECT count(*) FROM pg_proc WHERE proname LIKE 'prod\\_retry\\_01\\_probe%') AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture and probe this verifier created was rolled back or removed');
  console.log('Verified migration 0150: the twelve bodies are exactly their defining bodies with only the approved SQLSTATE change, '
    + 'their posture is unchanged, the self-check refuses every weakening, no Data API entry point lets a deterministic 40001 '
    + 'escape, every retained 40001 is proven race-converging or replay-guarded, and every stale refusal is PT409 with no write.');
}, () => rt.client.end().catch(() => undefined));
