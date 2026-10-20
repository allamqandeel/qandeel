// S7-01 / migration 0169 - real-PostgreSQL proof of the Personal Replay secure integration and its account erasure.
//
//   A  posture: the eleven exposed wrappers are postgres-owned SECURITY INVOKER one-liners executable by `authenticated`
//      alone and take no human identity; every replay_private definer is pinned, derives the human from auth.uid() and
//      runs no dynamic SQL; no frozen I-06 primitive, core, derivation or distribution act became executable by any
//      application role, and the three creator resolvers stay service_role-only; no table is reachable; the gate starts
//      UNCONFIGURED; no read declares a source identity; the two I-06 guards are their prior bodies plus exactly 0164's
//      prefix; the coordinator, the census and the operations summary are 0164's bodies plus exactly the named edits;
//      every relation referencing a Replay relation is registered, REPLAY is covered and its remainder is not; CW2-08
//      stays NOT_EVALUATED.
//   E  behaviour, each in its own SAVEPOINT of one rolled-back transaction: the closed gate; the whole lifecycle with
//      versions that never change; two accounts and the anti-oracle; whole messages only; the open Live Head refused
//      and sealed later; a LEGACY UNCOVERED conversation; a changed source (and its recovery); a moved analysis; the
//      moment analysis as the exact canonical K(TC) with no hindsight; idempotency and command conflicts; compare-and-
//      swap and lifecycle refusals; the gate snapshot bound to every act; no distribution anywhere; the frozen cores and
//      relations still closed to a client.
//   R  account erasure, in the same rolled-back transaction: the Personal footprint ERASED with zero references and the
//      other human untouched; 0130 refusing after the module ran rolls everything back; a footprint outside the
//      Personal module BLOCKED with nothing touched; the re-arm; the narrowed guards; the operations summary.
//   G  races on two real connections, committed and removed: equivalent births; competing revisions; competing
//      finalizations; an erasure against an in-flight revision and a revision against an in-flight erasure; an
//      operator change waiting for an in-flight act - no deadlock, one winner every time.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import {
  CONTRACT_POLICY, P, PERSONAL_REPLAY_DISCLOSURE_BAN, W, coordinatorWithS701Edits, createPersonalReplayRuntime, runVerifier,
} from './replay-personal-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createPersonalReplayRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;
const owner = () => asRole('postgres');
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const migration = (prefix) => readFileSync(new URL(readdirSync(MIGRATIONS).find((f) => f.startsWith(prefix)), MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
const PRIVATE_DEFINERS = [
  'replay_private.read_my_replay_capability_v1()',
  'replay_private.create_my_replay_draft_v1(uuid,uuid,integer,integer)',
  'replay_private.revise_my_replay_draft_v1(uuid,uuid,bigint,integer,integer)',
  'replay_private.prepare_my_replay_preview_v1(uuid,uuid,bigint)',
  'replay_private.finalize_my_replay_version_v1(uuid,uuid,uuid)',
  'replay_private.reopen_my_replay_for_revision_v1(uuid,uuid,uuid)',
  'replay_private.read_my_replay_v1(uuid)',
  'replay_private.read_my_replay_version_v1(uuid,uuid)',
  'replay_private.read_my_replay_moments_v1(uuid,uuid)',
  'replay_private.read_my_replay_moment_analysis_v1(uuid,uuid,integer)',
  'replay_private.list_my_conversation_replays_v1(uuid)',
];
const NOBODY = [P.SET_GATE, P.BIND_GATE, P.IDENTITY, P.RANGE, P.VIEWING, P.EVIDENCE_GUARD, P.MODULE, P.MODULE_RESIDUE,
  'account_erasure_private.erase_account_v1(uuid)', 'account_erasure_private.residue_classes_v1(uuid,uuid[])'];
const GUARDS = ['public.reject_replay_component_mutation_v1()', 'public.reject_replay_version_component_mutation_v1()'];
const PREFIX = "\n  -- S7-01 (0169): the governed account erasure alone may DELETE; nothing else changes.\n"
  + "  IF TG_OP = 'DELETE' THEN\n"
  + "    IF pg_catalog.current_setting('qandeel.account_erasure', true) = pg_catalog.txid_current()::text THEN\n"
  + '      IF account_erasure_private.erasure_authorized_v1() THEN RETURN OLD; END IF;\n'
  + '    END IF;\n'
  + '  END IF;';
const OUTSIDE = 'REPLAY_OUTSIDE_PERSONAL';

// ------------------------------------------------------------------ helpers
/** The body of the LAST definition of `schema.name` in the migrations BEFORE `before`, CR-free. */
function priorBody(schema, name, before = '0169') {
  let found = null;
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < before).sort()) {
    const text = readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
    for (const match of text.matchAll(new RegExp(String.raw`CREATE (?:OR REPLACE )?FUNCTION ${schema}\.${name}\(`, 'gu'))) {
      const tail = text.slice(match.index);
      const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(tail);
      const start = open.index + open[0].length;
      found = { file, body: tail.slice(start, tail.indexOf(open[1], start)) };
    }
  }
  return found;
}
const once = (text, from, to, label) => {
  assert.equal(text.split(from).length - 1, 1, `${label}: the 0164 anchor exists exactly once`);
  return text.replace(from, () => to);
};
const live = async (fn) => (await rt.functionPosture(fn)).prosrc.replace(/\r\n/gu, '\n');
async function requestDeletion(user, { status = 'SCHEDULED' } = {}) {
  await owner();
  const [row] = await rows(
    `INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at, blocked_at)
     VALUES ($1, gen_random_uuid(), $2, clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day',
             CASE WHEN $2 = 'BLOCKED' THEN clock_timestamp() END)
     RETURNING id`, [user, status]);
  return row.id;
}
async function erase(id, on = q) {
  if (on === q) await asRole('service_role');
  try { return (await on('SELECT public.server_erase_account_v1($1) AS outcome', [id])).rows[0].outcome; } finally { if (on === q) await owner(); }
}
const progressOf = async (id) => { await owner(); return (await rows('SELECT * FROM account_erasure_private.deletion_progress WHERE deletion_id = $1', [id]))[0] ?? null; };
const requestOf = async (id) => { await owner(); return (await rows('SELECT * FROM personal_data_private.account_deletions WHERE id = $1', [id]))[0]; };
/** Every row anywhere that still references `user` through a foreign key to the account. */
async function references(user) {
  await owner();
  const keys = await rows(`
    SELECT c.conrelid::regclass::text rel, a.attname col FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND cardinality(c.conkey) = 1`);
  const held = [];
  for (const k of keys) {
    const [{ n }] = await rows(`SELECT count(*)::int n FROM ${k.rel} x WHERE x.${k.col} = $1`, [user]);
    if (n > 0) held.push(`${k.rel}.${k.col}=${n}`);
  }
  return held;
}
/** An exact content fingerprint of every Replay relation, the account rows and the request: "nothing changed" is literal. */
async function replayFingerprint() {
  await owner();
  const relations = (await rows("SELECT relation FROM account_erasure_private.coverage_registry WHERE coverage IN ('REPLAY', 'PERSONAL') ORDER BY 1"))
    .map((r) => r.relation).concat(['public.users']);
  const out = {};
  for (const rel of relations) {
    const [{ h }] = await rows(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM ${rel} t`);
    out[rel] = h;
  }
  return out;
}
const sameFingerprint = (before, after, label) => {
  assert.deepEqual(Object.keys(before).filter((k) => before[k] !== after[k]), [], `${label}: nothing at all changed`);
};
/** The whole immutable composition of one Replay: every component row, for byte-for-byte before / after comparisons. */
async function composition(replay) {
  await owner();
  return { ...(await rt.replaySnapshot(replay)), ...(await rt.versionSnapshot(replay)) };
}
const outcomeOf = (row) => row?.outcome;
/** The canonical K(TC) analytical families of `session` at `tc`, as the owner sees them, minus the two exclusions. */
async function canonicalFamilies(user, session, tc) {
  await asRole('authenticated', user);
  try {
    const [k] = await rows('SELECT * FROM public.get_session_historical_projection_v1($1, $2)', [session, tc]);
    const families = { ...k };
    for (const key of ['session_id', 'live_head', 'tc', 'sealed', 'revision', 'moments']) delete families[key];
    families.materials = families.materials.map(({ expiry, ...rest }) => rest);
    return families;
  } finally { await owner(); }
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await owner();
  await report.section('A01 the eleven wrappers: postgres-owned SECURITY INVOKER, pinned, authenticated only, no human identity in', async () => {
    for (const fn of Object.values(W)) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
      assert.equal(p.secdef, false, `A01 ${fn} is SECURITY INVOKER`);
      assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `A01 ${fn} pins search_path`);
      assert.equal(await rt.canExecute('authenticated', fn), true, `A01 authenticated executes ${fn}`);
      for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
      const inputs = await rt.inputParameters(fn);
      assert.deepEqual(inputs.filter((name) => /user|owner|actor|creator|author|approver|member|coverage|unit|item|manifest|digest|authority|selection_spec/u.test(name)), [],
        `A01 ${fn} takes no human identity, source item, coverage claim or authority`);
      assert.match(p.prosrc.trim(), /^SELECT [^;]+ FROM replay_private\.\w+\([^;]*\) [a-z]+;$/su, `A01 ${fn} is one call into its definer`);
    }
  });

  await report.section('A02 replay_private: every definer pinned, auth.uid()-derived, no dynamic SQL; authenticated reaches only the eleven', async () => {
    const fns = await rows(`SELECT pr.oid::regprocedure::text sig, pr.proname, pr.prosecdef, pr.proconfig, pr.prosrc
                              FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'replay_private'`);
    assert.equal(fns.length, PRIVATE_DEFINERS.length + 6, 'A02 the private schema holds exactly the eleven definers and six helpers');
    for (const f of fns) {
      assert.ok((f.proconfig ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `A02 ${f.sig} pins search_path`);
      assert.doesNotMatch(f.prosrc.replace(/--[^\n]*/gu, ''), /\bEXECUTE\s/u, `A02 ${f.sig} runs no dynamic SQL`);
      for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, f.sig), false, `A02 ${role} must not execute ${f.sig}`);
    }
    for (const fn of PRIVATE_DEFINERS) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.secdef, true, `A02 ${fn} is SECURITY DEFINER`);
      assert.match(p.prosrc, /auth\.uid\(\)/u, `A02 ${fn} derives the human from auth.uid()`);
      assert.equal(await rt.canExecute('authenticated', fn), true, `A02 authenticated executes ${fn} (the INVOKER wrapper runs as it)`);
    }
    for (const fn of NOBODY) {
      for (const role of ['public', 'anon', 'authenticated', 'service_role']) assert.equal(await rt.canExecute(role, fn), false, `A02 ${role} must not execute ${fn}`);
    }
    const [{ usage }] = await rows("SELECT has_schema_privilege('service_role', 'replay_private', 'USAGE') usage");
    assert.equal(usage, false, 'A02 the server channel holds nothing of Replay');
  });

  await report.section('A03 nothing frozen was granted: no I-06 function is client-executable; the creator resolvers stay service_role-only', async () => {
    const wrappers = new Set(Object.values(W).map((fn) => fn.slice('public.'.length, fn.indexOf('('))));
    const frozen = await rows(`SELECT pr.oid::regprocedure::text sig, pr.proname FROM pg_proc pr
                                 JOIN pg_namespace n ON n.oid = pr.pronamespace
                                WHERE n.nspname = 'public' AND pr.proname ~ 'replay' AND pr.prokind = 'f'`);
    assert.ok(frozen.length > 40, 'A03 the I-06 surface is present');
    for (const f of frozen.filter((x) => !wrappers.has(x.proname))) {
      for (const role of ['public', 'anon', 'authenticated']) assert.equal(await rt.canExecute(role, f.sig), false, `A03 ${role} must not execute frozen ${f.sig}`);
      if (await rt.canExecute('service_role', f.sig)) assert.match(f.proname, /^resolve_/u, `A03 service_role executes only frozen read boundaries (${f.sig})`);
    }
    const tables = await rows(`SELECT c.oid::regclass::text rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                WHERE c.relkind = 'r' AND ((n.nspname = 'public' AND c.relname ~ '^replay') OR n.nspname = 'replay_private')`);
    assert.equal(tables.length, 36, 'A03 thirty-three Replay relations and three private ones');
    for (const t of tables) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const [{ any }] = await rows('SELECT has_table_privilege($1, $2, $3) "any"', [role, t.rel, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE']);
        assert.equal(any, false, `A03 ${role} reaches no Replay relation (${t.rel})`);
      }
    }
  });

  await report.section('A04 the gate starts UNCONFIGURED and DENIES; no migration opened it', async () => {
    assert.equal(Number((await rows('SELECT count(*) n FROM replay_private.replay_launch_capability_states'))[0].n), 0, 'A04 no gate row');
    const [gate] = await rows('SELECT * FROM replay_private.bind_replay_launch_gate_v1()');
    assert.deepEqual([gate.verdict, gate.feature_flag_state], ['DENY', 'UNCONFIGURED'], 'A04 UNCONFIGURED denies');
  });

  await report.section('A05 no read declares a source identity, a human, a digest or a private cause', async () => {
    for (const fn of [W.READ, W.VERSION, W.MOMENTS, W.ANALYSIS, W.LIST, W.CREATE, W.REVISE, W.PREVIEW, W.FINALIZE, W.REOPEN, W.CAPABILITY]) {
      const columns = await rt.resultColumns(fn);
      assert.ok(columns.length > 0, `A05 ${fn} declares its result`);
      // A `_policy` column is a frozen render-contract policy NAME (caption_provenance_policy is a policy about captions),
      // never data of what it names.
      assert.deepEqual(columns.filter((c) => !/_policy$/u.test(c) && PERSONAL_REPLAY_DISCLOSURE_BAN.test(c)), [], `A05 ${fn} declares no source identity`);
      assert.deepEqual(columns.filter((c) => /colou?r|hue|x$|^y$|coordinate|pixel|camera_|motion_curve|easing|component/u.test(c) && !/_policy$/u.test(c)), [],
        `A05 ${fn} declares no graphic`);
    }
  });

  await report.section('A06 the two I-06 guards are their prior bodies byte for byte after exactly one prefix; their triggers are enabled', async () => {
    for (const fn of GUARDS) {
      const name = fn.slice('public.'.length, fn.indexOf('('));
      const prior = priorBody('public', name);
      assert.ok(prior, `A06 ${fn} was defined before 0169`);
      const at = prior.body.search(/\bBEGIN\b/u);
      assert.equal(await live(fn), prior.body.slice(0, at + 5) + PREFIX + prior.body.slice(at + 5), `A06 ${fn} is the ${prior.file} body plus exactly the prefix`);
    }
    const disabled = await rows(`SELECT t.tgrelid::regclass::text rel FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND t.tgenabled <> 'O' AND p.oid = ANY($1::regprocedure[])`, [[...GUARDS, P.EVIDENCE_GUARD]]);
    assert.deepEqual(disabled, [], 'A06 every guard trigger is enabled');
    const guarded = await rows(`SELECT count(*)::int n FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgfoid = ANY($1::regprocedure[])`, [GUARDS]);
    assert.equal(guarded[0].n, 12, 'A06 the two guards still stand on all twelve append-only relations');
  });

  await report.section('A07 the coordinator, the census and the operations summary are 0164 plus exactly the named edits', async () => {
    const m0164 = migration('0164');
    const body = (head) => {
      const at = m0164.indexOf(head);
      const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(m0164.slice(at));
      const start = at + open.index + open[0].length;
      return m0164.slice(start, m0164.indexOf(open[1], start));
    };
    const coordinator = coordinatorWithS701Edits(body('CREATE FUNCTION account_erasure_private.erase_account_v1(p_deletion_id uuid)'));
    assert.equal(await live('account_erasure_private.erase_account_v1(uuid)'), coordinator, 'A07 the coordinator is 0164 plus E1-E3');

    const out = `'${OUTSIDE}'::text`;
    let census = body('CREATE FUNCTION account_erasure_private.residue_classes_v1(p_user uuid, p_worlds uuid[])');
    for (const [probe, label] of [
      ['FROM public.replay_distribution_authorizations x WHERE x.authorized_by_user_id = p_user) THEN v := v || ', 'C1'],
      ['FROM public.replay_distribution_required_approvers x WHERE x.approver_user_id = p_user) THEN v := v || ', 'C2'],
      ['FROM public.replay_source_manifest_items x WHERE x.shared_world_id = ANY (p_worlds)) THEN v := v || ', 'C4'],
      ['FROM public.replay_source_manifest_versions x WHERE x.shared_world_id = ANY (p_worlds)) THEN v := v || ', 'C5']]) {
      census = once(census, `${probe}'REPLAY'::text; END IF;`, `${probe}${out}; END IF;`, label);
    }
    const liveCensus = await live('account_erasure_private.residue_classes_v1(uuid,uuid[])');
    const added = liveCensus.slice(liveCensus.indexOf('  -- S7-01 (0169): an own Replay'), liveCensus.indexOf(`${out}; END IF;\n`, liveCensus.indexOf('  -- S7-01 (0169): an own Replay')) + `${out}; END IF;\n`.length);
    assert.ok(added.startsWith('  -- S7-01 (0169)'), 'A07 the census carries the one added probe');
    assert.equal(liveCensus.replace(added, ''), census, 'A07 the census is 0164 plus C1-C5 and nothing else');
    assert.match(added, /source_class <> 'MY_WORLD'[\s\S]*replay_distribution_package_versions[\s\S]*replay_reconciliation_commands[\s\S]*replay_source_availability_reconciliation_events/u,
      'A07 the added probe names every footprint outside the Personal module');

    const operations = once(body('CREATE FUNCTION public.server_read_account_erasure_operations_v1()'),
      "(SELECT count(*) FROM blocked b WHERE 'REPLAY' = ANY (b.residue_classes))::integer,",
      `(SELECT count(*) FROM blocked b WHERE b.residue_classes && ARRAY['REPLAY', '${OUTSIDE}'])::integer,`, 'O1');
    assert.equal(await live('public.server_read_account_erasure_operations_v1()'), operations, 'A07 the operations summary is 0164 plus O1');
    assert.equal(await live('personal_data_private.erase_personal_account_v1(uuid)'), priorBody('personal_data_private', 'erase_personal_account_v1').body,
      'A07 0130 is untouched');
  });

  await report.section('A08 coverage: every relation referencing the account or a Replay relation is registered; REPLAY covered, its remainder not', async () => {
    const missing = await rows(`
      WITH erased AS (SELECT relation FROM account_erasure_private.coverage_registry
                       WHERE coverage IN ('MATCHING_INTRODUCTIONS', 'SHARED_INTRODUCTION', 'REPLAY')),
      scope AS (SELECT DISTINCT c.conrelid::regclass::text relation FROM pg_constraint c
                 WHERE c.contype = 'f' AND (c.confrelid = 'public.users'::regclass OR c.confrelid::regclass::text IN (SELECT relation FROM erased)))
      SELECT s.relation FROM scope s WHERE s.relation NOT IN (SELECT relation FROM account_erasure_private.coverage_registry) ORDER BY 1`);
    assert.deepEqual(missing.map((r) => r.relation), [], 'A08 nothing referencing the account or an erased relation is unregistered');
    const replayRelations = await rows(`SELECT c.oid::regclass::text rel FROM pg_class c WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace AND c.relname ~ '^replay'`);
    const registered = new Set((await rows("SELECT relation FROM account_erasure_private.coverage_registry WHERE coverage = 'REPLAY'")).map((r) => r.relation));
    assert.deepEqual(replayRelations.map((r) => r.rel).filter((r) => !registered.has(r)), [], 'A08 every Replay relation is registered REPLAY');
    assert.ok(registered.has('replay_private.personal_replay_launch_evidence'), 'A08 so is the launch evidence');
    const unindexed = await rows(`
      SELECT c.conrelid::regclass::text || '.' || a.attname AS col FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND c.conrelid::regclass::text ~ '^replay'
         AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])`);
    assert.deepEqual(unindexed, [], 'A08 every account column of a Replay relation has a leading index');
    await asRole('service_role');
    const coverage = Object.fromEntries((await rows('SELECT * FROM public.server_read_account_erasure_coverage_v1()')).map((r) => [r.residue_class, r.covered]));
    await owner();
    assert.deepEqual(coverage, { PUBLIC: false, REPLAY: true, REPLAY_OUTSIDE_PERSONAL: false, SHARED_STANDARD: false, UNREGISTERED: false },
      'A08 REPLAY covered; REPLAY_OUTSIDE_PERSONAL, Shared STANDARD, Public and UNREGISTERED not');
    const weakened = await rows(`SELECT c.conrelid::regclass::text rel FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass AND c.confdeltype NOT IN ('r', 'c')`);
    assert.deepEqual(weakened, [], 'A08 no reference to the account is SET NULL, SET DEFAULT or NO ACTION');
  });

  await report.section('A09 CW2-08 stays closed: the Replay distribution prerequisite seam answers NOT_EVALUATED', async () => {
    for (const destination of ['SHARE_EXTERNALLY', 'DOWNLOAD', 'PUBLISH_TO_PUBLIC_WORLD']) {
      const [seam] = await rows('SELECT * FROM public.resolve_replay_distribution_prerequisites_v1(gen_random_uuid(), $1)', [destination]);
      assert.equal(seam.clearance, 'NOT_EVALUATED', `A09 ${destination} is NOT_EVALUATED`);
    }
  });
}

// ------------------------------------------------------------------ E. behaviour, one rolled-back transaction
async function verifyBehaviour(report) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('E01 the closed gate: every act is NOT_AVAILABLE_NOW and writes nothing; reads still answer', async () => {
      const [A] = [randomUUID()];
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A);
      const before = await replayFingerprint();
      assert.equal(await rt.capability(A), false, 'E01 the hint says closed');
      assert.equal(outcomeOf(await rt.create(A, randomUUID(), c.session, 1, 4)), 'NOT_AVAILABLE_NOW', 'E01 create');
      assert.equal(outcomeOf(await rt.revise(A, randomUUID(), randomUUID(), 1, 1, 2)), 'NOT_AVAILABLE_NOW', 'E01 revise');
      assert.equal(outcomeOf(await rt.preview(A, randomUUID(), randomUUID(), 1)), 'NOT_AVAILABLE_NOW', 'E01 preview');
      assert.equal(outcomeOf(await rt.finalize(A, randomUUID(), randomUUID(), randomUUID())), 'NOT_AVAILABLE_NOW', 'E01 finalize');
      assert.equal(outcomeOf(await rt.reopen(A, randomUUID(), randomUUID(), randomUUID())), 'NOT_AVAILABLE_NOW', 'E01 reopen');
      sameFingerprint(before, await replayFingerprint(), 'E01');
      assert.deepEqual(await rt.list(A, c.session), [], 'E01 the list answers, empty');
      for (const flag of [['DISABLED', 'SATISFIED'], ['INTERNAL', 'SATISFIED'], ['LIMITED_ROLLOUT', 'SATISFIED'], ['ENABLED', 'UNSATISFIED'],
        ['ENABLED', 'UNKNOWN'], ['EMERGENCY_DISABLED', 'SATISFIED']]) {
        await rt.setGate(...flag);
        assert.equal(outcomeOf(await rt.create(A, randomUUID(), c.session, 1, 4)), 'NOT_AVAILABLE_NOW', `E01 ${flag.join(' / ')} denies`);
      }
      await rt.setGate('ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE');
      assert.equal(outcomeOf(await rt.create(A, randomUUID(), c.session, 1, 4)), 'CREATED', 'E01 ENABLED / WAIVED allows');
    });

    await report.isolated('E02 the whole lifecycle: draft, true preview, private final version, reopen, new version - no version ever changes', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A, { turns: 4, unitsPerTurn: 2 });
      await rt.setGate();
      const created = await rt.create(A, randomUUID(), c.session, 1, 4);
      assert.deepEqual([created.outcome, created.replay_lifecycle, Number(created.draft_revision), created.coverage_class, created.selected_item_count],
        ['CREATED', 'DRAFT', 1, 'SELECTED_EXCERPT', 4], 'E02 a draft of two whole messages');
      const [draft] = await rt.read(A, created.replay_id);
      assert.deepEqual([draft.draft_first_tc, draft.draft_last_tc, draft.draft_source_state, draft.current_replay_version_id],
        [1, 4, 'CURRENT', null], 'E02 the draft names its range by TC and has no version yet');
      const p1 = await rt.preview(A, randomUUID(), created.replay_id, 1);
      assert.deepEqual([p1.outcome, p1.replay_version_revision, p1.moment_count, p1.temporal_discontinuity_count], ['PREVIEW_READY', 1, 4, 0], 'E02 the preview is one complete version');
      const [v1] = await rt.version(A, created.replay_id, p1.replay_version_id);
      assert.deepEqual([v1.is_current, v1.finalized, v1.viewing_state, v1.first_tc, v1.last_tc], [true, false, 'VIEWABLE', 1, 4], 'E02 the preview is viewable');
      assert.deepEqual({
        schema: v1.render_contract_schema, medium: v1.source_medium_class, originalMedium: v1.original_medium_policy, sourceText: v1.source_text_policy,
        semanticCut: v1.semantic_cut_policy, discontinuity: v1.temporal_discontinuity_policy, timing: v1.timing_integrity_policy,
        projection: v1.analytical_projection_policy, camera: v1.camera_emphasis_policy, motion: v1.motion_policy, caption: v1.caption_provenance_policy,
        accessibility: v1.accessibility_parity_policy, reducedMotion: v1.reduced_motion_parity_policy, editorial: v1.editorial_annotation_policy,
      }, { ...CONTRACT_POLICY }, 'E02 the version carries the exact frozen render truth contract');
      const moments = await rt.moments(A, created.replay_id, p1.replay_version_id);
      assert.deepEqual(moments.map((m) => [m.selected_ordinal, m.tc, m.source_role, m.original_medium, m.omitted_before, m.source_text]),
        c.units.slice(0, 4).map((u, i) => [i + 1, u.sp, u.role, 'ORIGINAL_TEXT', 0, u.text]), 'E02 the moments are the exact messages, in chronology, text only');
      const frozenV1 = await composition(created.replay_id);
      const f1 = await rt.finalize(A, randomUUID(), created.replay_id, p1.replay_version_id);
      assert.deepEqual([f1.outcome, f1.replay_version_id], ['FINALIZED', p1.replay_version_id], 'E02 the exact previewed version is finalized');
      const [after] = await rt.version(A, created.replay_id, p1.replay_version_id);
      assert.deepEqual([after.finalized, after.viewing_state], [true, 'VIEWABLE'], 'E02 a finalized version is viewable');
      const reopened = await rt.reopen(A, randomUUID(), created.replay_id, p1.replay_version_id);
      assert.deepEqual([reopened.outcome, reopened.replay_lifecycle], ['REOPENED', 'DRAFT'], 'E02 reopened for revision');
      const [again] = await rt.read(A, created.replay_id);
      const revised = await rt.revise(A, randomUUID(), created.replay_id, Number(again.draft_revision), 3, 6);
      assert.deepEqual([revised.outcome, Number(revised.draft_revision), revised.selected_item_count], ['REVISED', 2, 4], 'E02 a new contiguous range');
      const p2 = await rt.preview(A, randomUUID(), created.replay_id, 2);
      assert.deepEqual([p2.outcome, p2.replay_version_revision], ['PREVIEW_READY', 2], 'E02 a NEW version revision');
      assert.notEqual(p2.replay_version_id, p1.replay_version_id, 'E02 a different version identity');
      const [old] = await rt.version(A, created.replay_id, p1.replay_version_id);
      assert.deepEqual([old.is_current, old.finalized, old.viewing_state], [false, true, 'VIEWABLE'], 'E02 the old finalized version stays historically finalized and viewable');
      const now = await composition(created.replay_id);
      for (const key of ['manifests', 'items', 'specs', 'specItems', 'projections', 'points', 'contracts']) {
        for (const row of frozenV1[key]) assert.ok(now[key].some((r) => JSON.stringify(r) === JSON.stringify(row)), `E02 every ${key} row of version 1 is byte-identical`);
      }
      assert.deepEqual(now.versions[0], frozenV1.versions[0], 'E02 version 1 itself is unchanged');
      assert.deepEqual((await rt.list(A, c.session)).map((r) => [r.replay_id, r.replay_lifecycle]), [[created.replay_id, 'PREVIEW_READY']], 'E02 the conversation lists its Replay');
    });

    await report.isolated('E03 two accounts: the other human reaches nothing, indistinguishably from what does not exist', async () => {
      const [A, B] = [randomUUID(), randomUUID()];
      await rt.provisionHumans([A, B]);
      const c = await rt.provisionConversation(A);
      await rt.setGate();
      const f = await rt.bringTo(A, c, 'FINALIZED');
      const ghost = { replay: randomUUID(), version: randomUUID(), session: randomUUID() };
      for (const [who, target] of [[B, f], [A, ghost], [B, ghost]]) {
        const label = who === B && target === f ? "B on A's" : 'on a nonexistent';
        assert.equal(outcomeOf(await rt.create(who, randomUUID(), target === f ? c.session : ghost.session, 1, 4)), 'UNAVAILABLE', `E03 create ${label} conversation`);
        assert.equal(outcomeOf(await rt.revise(who, randomUUID(), target.replay, 1, 1, 2)), 'UNAVAILABLE', `E03 revise ${label} Replay`);
        assert.equal(outcomeOf(await rt.preview(who, randomUUID(), target.replay, 1)), 'UNAVAILABLE', `E03 preview ${label} Replay`);
        assert.equal(outcomeOf(await rt.finalize(who, randomUUID(), target.replay, target.version)), 'UNAVAILABLE', `E03 finalize ${label} Replay`);
        assert.equal(outcomeOf(await rt.reopen(who, randomUUID(), target.replay, target.version)), 'UNAVAILABLE', `E03 reopen ${label} Replay`);
        assert.deepEqual(await rt.read(who, target.replay), [], `E03 read ${label} Replay: zero rows`);
        assert.deepEqual(await rt.version(who, target.replay, target.version), [], `E03 version ${label}: zero rows`);
        assert.deepEqual(await rt.moments(who, target.replay, target.version), [], `E03 moments ${label}: zero rows`);
        assert.deepEqual(await rt.analysis(who, target.replay, target.version, 1), [], `E03 analysis ${label}: zero rows`);
        assert.deepEqual(await rt.list(who, target === f ? c.session : ghost.session), [], `E03 list ${label} conversation: zero rows`);
      }
      assert.equal((await rt.read(A, f.replay)).length, 1, 'E03 the creator still reads it');
    });

    await report.isolated('E04 one contiguous range of whole messages; coverage is the server\'s, never the caller\'s', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A, { turns: 3, unitsPerTurn: 2 });
      await rt.setGate();
      for (const [first, last] of [[1, 3], [2, 4], [2, 3], [4, 5]]) {
        assert.equal(outcomeOf(await rt.create(A, randomUUID(), c.session, first, last)), 'NOT_WHOLE_MESSAGES', `E04 ${first}..${last} cuts a message`);
      }
      assert.equal(outcomeOf(await rt.create(A, randomUUID(), c.session, 5, 8)), 'UNAVAILABLE', 'E04 beyond the conversation');
      await rejected(() => rt.create(A, randomUUID(), c.session, 3, 2), ['22023']);
      await rejected(() => rt.create(A, randomUUID(), c.session, 0, 2), ['22023']);
      assert.equal((await rt.create(A, randomUUID(), c.session, 3, 4)).coverage_class, 'SELECTED_EXCERPT', 'E04 a middle message');
      assert.equal((await rt.create(A, randomUUID(), c.session, 1, 6)).coverage_class, 'FULL_SOURCE', 'E04 the whole conversation is FULL_SOURCE');
      const [{ n }] = await rows(`SELECT count(*)::int n FROM public.replay_selection_spec_items si JOIN public.replay_selection_spec_versions sp
                                   ON sp.id = si.selection_spec_version_id JOIN public.replays r ON r.id = sp.replay_id
                                   WHERE r.created_by_user_id = $1 AND si.anchor_kind <> 'WHOLE_ITEM'`, [A]);
      assert.equal(n, 0, 'E04 every selected item is a WHOLE_ITEM: no partial cut is ever made');
    });

    await report.isolated('E05 the open Live Head is refused, writes nothing, and the same draft previews once it is sealed', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A, { turns: 3, unitsPerTurn: 2 });
      await rt.setGate();
      const created = await rt.create(A, randomUUID(), c.session, 5, 6);
      const before = await composition(created.replay_id);
      assert.equal(outcomeOf(await rt.preview(A, randomUUID(), created.replay_id, 1)), 'MOMENT_NOT_SEALED', 'E05 the newest message is still open');
      assert.deepEqual(await composition(created.replay_id), before, 'E05 nothing was frozen');
      assert.equal((await rt.read(A, created.replay_id))[0].replay_lifecycle, 'DRAFT', 'E05 still a DRAFT');
      await rt.commitMessage(A, c);
      const sealed = await rt.preview(A, randomUUID(), created.replay_id, 1);
      assert.equal(sealed.outcome, 'PREVIEW_READY', 'E05 sealed by a later message, the same draft previews');
    });

    await report.isolated('E06 a LEGACY UNCOVERED conversation: the draft is real, the preview is ANALYSIS_UNAVAILABLE', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const legacy = await rt.provisionLegacySession(A);
      await rt.setGate();
      const created = await rt.create(A, randomUUID(), legacy.session, 1, 2);
      assert.equal(created.outcome, 'CREATED', 'E06 the draft binds the real messages');
      assert.equal(outcomeOf(await rt.preview(A, randomUUID(), created.replay_id, 1)), 'ANALYSIS_UNAVAILABLE', 'E06 no historical analysis exists to replay');
    });

    await report.isolated('E07 a changed source: draft STALE, preview SOURCE_CHANGED, the finalized version NOT_VIEWABLE with no text; it recovers', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A);
      await rt.setGate();
      const f = await rt.bringTo(A, c, 'FINALIZED');
      const draft = await rt.create(A, randomUUID(), c.session, 1, 4);
      const unit = c.units[1];
      await rt.asReplica(() => q('UPDATE public.conversation_units SET committed_text = $2 WHERE id = $1', [unit.id, `${unit.text.slice(0, -1)}X`]));
      await owner();
      assert.equal((await rt.read(A, draft.replay_id))[0].draft_source_state, 'STALE', 'E07 the draft reads STALE');
      assert.equal(outcomeOf(await rt.preview(A, randomUUID(), draft.replay_id, 1)), 'SOURCE_CHANGED', 'E07 the preview refuses');
      const [v] = await rt.version(A, f.replay, f.version);
      assert.deepEqual([v.finalized, v.viewing_state, v.not_viewable_class, v.source_layer, v.analytical_layer],
        [true, 'NOT_VIEWABLE', 'SOURCE_NOT_CURRENTLY_AVAILABLE', 'NOT_DEREFERENCEABLE', 'SEALED_HISTORICAL_EVIDENCE'],
        'E07 historically finalized, currently not viewable; the analysis never stands in for the source');
      const moments = await rt.moments(A, f.replay, f.version);
      assert.equal(moments.length, 4, 'E07 the structure is still the version\'s own truth');
      assert.ok(moments.every((m) => m.source_text === null), 'E07 and no text of any moment is served');
      assert.equal((await rt.analysis(A, f.replay, f.version, 1))[0].outcome, 'NOT_VIEWABLE', 'E07 no moment analysis either');
      await rt.asReplica(() => q('UPDATE public.conversation_units SET committed_text = $2 WHERE id = $1', [unit.id, unit.text]));
      await owner();
      assert.equal((await rt.version(A, f.replay, f.version))[0].viewing_state, 'VIEWABLE', 'E07 the same exact row returned: viewable again');
    });

    await report.isolated('E08 a moved analysis: the moment analysis is withheld, and finalization refuses ANALYSIS_CHANGED', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A);
      await rt.setGate();
      const p = await rt.bringTo(A, c, 'PREVIEW_READY');
      assert.equal((await rt.analysis(A, p.replay, p.version, 2))[0].outcome, 'AVAILABLE', 'E08 before');
      await rt.asReplica(() => q(
        `INSERT INTO public.historical_reading_events
           (event_id, user_id, hypothesis_id, event_kind, from_status, to_status, from_version, to_version,
            session_id, session_position, same_sp_event_sequence, world_version)
         VALUES (gen_random_uuid(), $1, $2, 'STATUS_TRANSITION', 'CANDIDATE', 'REJECTED', 1, 1, $3, 2, 1, $4)`,
        [A, c.readingA, c.session, c.baseline + 10]));
      await owner();
      assert.equal((await rt.analysis(A, p.replay, p.version, 2))[0].outcome, 'ANALYSIS_NOT_CURRENTLY_AVAILABLE', 'E08 a different answer is never served as the frozen one');
      assert.equal(outcomeOf(await rt.finalize(A, randomUUID(), p.replay, p.version)), 'ANALYSIS_CHANGED', 'E08 finalization revalidates and refuses');
      assert.equal((await rt.read(A, p.replay))[0].replay_lifecycle, 'PREVIEW_READY', 'E08 nothing moved');
    });

    await report.isolated('E09 the moment analysis is the canonical K(TC) at that moment, exactly, with no hindsight', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A, { turns: 3, unitsPerTurn: 2 });
      await rt.commitMessage(A, c);
      await rt.setGate();
      const p = await rt.bringTo(A, c, 'FINALIZED', { first: 1, last: 6 });
      const readingIds = (a) => a.readings.map((r) => r.id).sort();
      for (const ordinal of [1, 2, 3, 4, 5, 6]) {
        const [moment] = await rt.analysis(A, p.replay, p.version, ordinal);
        assert.deepEqual([moment.outcome, moment.selected_ordinal, moment.tc], ['AVAILABLE', ordinal, ordinal], `E09 moment ${ordinal}`);
        assert.deepEqual(moment.analysis, await canonicalFamilies(A, c.session, ordinal), `E09 moment ${ordinal} is exactly K(${ordinal})`);
        assert.equal('moments' in moment.analysis, false, `E09 moment ${ordinal} carries no source events`);
        assert.ok(moment.analysis.materials.every((m) => !('expiry' in m)), `E09 moment ${ordinal} carries no wall-clock expiry`);
      }
      const at = async (o) => readingIds((await rt.analysis(A, p.replay, p.version, o))[0].analysis);
      assert.deepEqual(await at(1), [c.readingA].sort(), 'E09 at TC 1 only Reading A was known');
      assert.deepEqual(await at(3), [c.readingA, c.readingB].sort(), 'E09 Reading B appears at TC 3, never before');
      const statusAt = async (o) => (await rt.analysis(A, p.replay, p.version, o))[0].analysis.readings.find((r) => r.id === c.readingA).statusAtTc;
      assert.deepEqual([await statusAt(4), await statusAt(5)], ['CANDIDATE', 'ACTIVE'], 'E09 the later status is never shown early');
      assert.deepEqual(await rt.analysis(A, p.replay, p.version, 7), [], 'E09 no coordinate outside the version');
      await rejected(() => rt.analysis(A, p.replay, p.version, 0), ['22023']);
    });

    await report.isolated('E10 idempotency: an equivalent retry answers its first result, gate or no gate; a different request is a conflict', async () => {
      const [A, B] = [randomUUID(), randomUUID()];
      await rt.provisionHumans([A, B]);
      const c = await rt.provisionConversation(A, { turns: 4, unitsPerTurn: 2 });
      await rt.setGate();
      const [createCmd, previewCmd, finalizeCmd, reopenCmd, reviseCmd] = Array.from({ length: 5 }, () => randomUUID());
      const created = await rt.create(A, createCmd, c.session, 1, 4);
      const previewed = await rt.preview(A, previewCmd, created.replay_id, 1);
      const finalized = await rt.finalize(A, finalizeCmd, created.replay_id, previewed.replay_version_id);
      const reopened = await rt.reopen(A, reopenCmd, created.replay_id, previewed.replay_version_id);
      const revised = await rt.revise(A, reviseCmd, created.replay_id, 1, 3, 6);
      const evidence = Number((await rows('SELECT count(*) n FROM replay_private.personal_replay_launch_evidence WHERE replay_id = $1', [created.replay_id]))[0].n);
      assert.equal(evidence, 5, 'E10 one gate snapshot per committed act');
      await rt.setGate('EMERGENCY_DISABLED', 'SATISFIED');
      assert.deepEqual(await rt.create(A, createCmd, c.session, 1, 4), created, 'E10 create retried under a closed gate');
      assert.deepEqual(await rt.preview(A, previewCmd, created.replay_id, 1), previewed, 'E10 preview retried');
      assert.deepEqual(await rt.finalize(A, finalizeCmd, created.replay_id, previewed.replay_version_id), finalized, 'E10 finalize retried');
      assert.deepEqual(await rt.reopen(A, reopenCmd, created.replay_id, previewed.replay_version_id), { ...reopened, replay_lifecycle: 'DRAFT' }, 'E10 reopen retried');
      assert.deepEqual(await rt.revise(A, reviseCmd, created.replay_id, 1, 3, 6), revised, 'E10 revise retried');
      assert.equal(Number((await rows('SELECT count(*) n FROM replay_private.personal_replay_launch_evidence WHERE replay_id = $1', [created.replay_id]))[0].n), 5,
        'E10 a retry binds no second snapshot');
      await rt.setGate();
      assert.equal(outcomeOf(await rt.create(A, createCmd, c.session, 1, 2)), 'COMMAND_CONFLICT', 'E10 create: same id, different range');
      assert.equal(outcomeOf(await rt.revise(A, reviseCmd, created.replay_id, 1, 1, 2)), 'COMMAND_CONFLICT', 'E10 revise: same id, different range');
      assert.equal(outcomeOf(await rt.preview(A, previewCmd, created.replay_id, 2)), 'COMMAND_CONFLICT', 'E10 preview: same id, different expectation');
      const other = await rt.provisionConversation(B);
      assert.equal(outcomeOf(await rt.create(B, createCmd, other.session, 1, 4)), 'COMMAND_CONFLICT', "E10 another human cannot reuse A's command id");
      assert.equal(outcomeOf(await rt.preview(B, previewCmd, created.replay_id, 1)), 'COMMAND_CONFLICT', 'E10 nor a preview command id');
    });

    await report.isolated('E11 compare-and-swap and lifecycle: a stale expectation is CHANGED, a wrong state LIFECYCLE_NOT_ELIGIBLE, nothing written', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A, { turns: 4, unitsPerTurn: 2 });
      await rt.setGate();
      const d = await rt.bringTo(A, c, 'DRAFT');
      assert.equal(outcomeOf(await rt.revise(A, randomUUID(), d.replay, 1, 3, 4)), 'REVISED', 'E11 revision 2');
      assert.equal(outcomeOf(await rt.revise(A, randomUUID(), d.replay, 1, 1, 2)), 'CHANGED', 'E11 a revision composed against revision 1');
      assert.equal(outcomeOf(await rt.preview(A, randomUUID(), d.replay, 1)), 'CHANGED', 'E11 a preview composed against revision 1');
      assert.equal(outcomeOf(await rt.finalize(A, randomUUID(), d.replay, randomUUID())), 'LIFECYCLE_NOT_ELIGIBLE', 'E11 a DRAFT is not finalized');
      assert.equal(outcomeOf(await rt.reopen(A, randomUUID(), d.replay, randomUUID())), 'LIFECYCLE_NOT_ELIGIBLE', 'E11 a DRAFT is not reopened');
      const p = await rt.preview(A, randomUUID(), d.replay, 2);
      assert.equal(outcomeOf(await rt.finalize(A, randomUUID(), d.replay, randomUUID())), 'CHANGED', 'E11 a finalization naming another version');
      assert.equal(outcomeOf(await rt.revise(A, randomUUID(), d.replay, 2, 1, 2)), 'LIFECYCLE_NOT_ELIGIBLE', 'E11 a PREVIEW_READY Replay is reopened before it is revised');
      assert.equal(outcomeOf(await rt.preview(A, randomUUID(), d.replay, 2)), 'LIFECYCLE_NOT_ELIGIBLE', 'E11 a second preview');
      assert.equal(outcomeOf(await rt.finalize(A, randomUUID(), d.replay, p.replay_version_id)), 'FINALIZED', 'E11 the exact version finalizes');
      assert.equal(outcomeOf(await rt.finalize(A, randomUUID(), d.replay, p.replay_version_id)), 'LIFECYCLE_NOT_ELIGIBLE', 'E11 exactly once');
    });

    await report.isolated('E12 the gate snapshot: every act binds the version it ran under; an operator change is a new version', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A);
      const first = await rt.setGate();
      const d = await rt.bringTo(A, c, 'DRAFT');
      const second = await rt.setGate('ENABLED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE');
      assert.ok(Number(second.restriction_version) > Number(first.restriction_version), 'E12 the version advances');
      const p = await rt.preview(A, randomUUID(), d.replay, 1);
      const bound = await rows('SELECT command_kind, restriction_version, launch_requirements_state FROM replay_private.personal_replay_launch_evidence WHERE replay_id = $1 ORDER BY bound_at', [d.replay]);
      assert.deepEqual(bound.map((b) => [b.command_kind, Number(b.restriction_version), b.launch_requirements_state]),
        [['CREATE', Number(first.restriction_version), 'SATISFIED'], ['PREVIEW', Number(second.restriction_version), 'WAIVED_BY_AUTHORIZED_GOVERNANCE']],
        'E12 each act carries the exact snapshot it was allowed under');
      const events = await rows("SELECT count(*)::int n FROM replay_private.replay_launch_capability_events WHERE capability_scope = 'PERSONAL_REPLAY'");
      assert.ok(events[0].n >= 2, 'E12 every operator decision is audited');
      assert.equal(p.outcome, 'PREVIEW_READY', 'E12 the preview committed');
      await rejected(() => q("UPDATE replay_private.personal_replay_launch_evidence SET restriction_version = 99 WHERE replay_id = $1", [d.replay]), ['55000']);
      await rejected(() => q('DELETE FROM replay_private.personal_replay_launch_evidence WHERE replay_id = $1', [d.replay]), ['55000']);
    });

    await report.isolated('E13 FINALIZED is not distributed: no package, approver, authorization or artifact; distribution stays unreachable', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A);
      await rt.setGate();
      const f = await rt.bringTo(A, c, 'FINALIZED');
      for (const rel of ['replay_distribution_package_versions', 'replay_distribution_prepare_commands', 'replay_distribution_authorization_commands']) {
        assert.equal(Number((await rows(`SELECT count(*) n FROM public.${rel} WHERE replay_id = $1`, [f.replay]))[0].n), 0, `E13 no ${rel}`);
      }
      const distribution = await rows(`SELECT pr.oid::regprocedure::text sig FROM pg_proc pr
        WHERE pr.pronamespace = 'public'::regnamespace AND pr.proname ~ '(distribution|replay_artifact|reconcile_replay)'`);
      assert.ok(distribution.length >= 8, 'E13 the I-06C / I-06D acts exist');
      for (const d of distribution) assert.equal(await rt.canExecute('authenticated', d.sig), false, `E13 a client cannot reach ${d.sig}`);
    });

    await report.isolated('E14 a client reaches no frozen primitive and no relation directly', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A);
      await asRole('authenticated', A);
      await rejected(() => q('SELECT * FROM public.replays'), ['42501']);
      await rejected(() => q('SELECT * FROM replay_private.replay_launch_capability_states'), ['42501']);
      await rejected(() => q(`SELECT * FROM public.create_replay_draft_v1($1, $2, $3, $4, 'MY_WORLD', $5, NULL, $6::uuid[], $6::uuid[], ARRAY[NULL]::integer[], ARRAY[NULL]::integer[], 'SELECTED_EXCERPT')`,
        [randomUUID(), randomUUID(), randomUUID(), randomUUID(), c.session, [c.units[0].id]]), ['42501']);
      await rejected(() => q('SELECT * FROM public.resolve_replay_draft_composition_v1($1, $2)', [randomUUID(), A]), ['42501']);
      await rejected(() => q("SELECT * FROM replay_private.set_replay_launch_capability_v1('PERSONAL_REPLAY', 'ENABLED', 'SATISFIED', 'x', 'y')"), ['42501']);
      await rejected(() => q('SELECT * FROM replay_private.bind_replay_launch_gate_v1()'), ['42501']);
      await owner();
      await asRole('anon');
      await rejected(() => q('SELECT * FROM public.read_my_replay_capability_v1()'), ['42501']);
      await owner();
      await asRole('authenticated', null);
      await rejected(() => q('SELECT * FROM public.read_my_replay_capability_v1()'), ['42501']);
      await owner();
    });

    // S7-05 D5 (3): the gate governs creation acts only. A Replay that already exists is read exactly as before once the
    // gate closes (E01 reads an empty list; this reads a real FINALIZED and a real PREVIEW_READY Replay), while every act
    // on it is NOT_AVAILABLE_NOW and writes nothing, and the other human still reaches nothing.
    await report.isolated('E15 the gate closes after a Replay exists: its version, moments, analysis and list answer unchanged; every act is refused', async () => {
      const [A, B] = [randomUUID(), randomUUID()];
      await rt.provisionHumans([A, B]);
      const c = await rt.provisionConversation(A, { turns: 4, unitsPerTurn: 2 });
      await rt.setGate();
      const f = await rt.bringTo(A, c, 'FINALIZED', { first: 1, last: 4 });
      const p = await rt.bringTo(A, c, 'PREVIEW_READY', { first: 5, last: 6 });
      const snapshotOf = async (r) => ({
        read: await rt.read(A, r.replay),
        version: await rt.version(A, r.replay, r.version),
        moments: await rt.moments(A, r.replay, r.version),
        analysis: await rt.analysis(A, r.replay, r.version, 1),
      });
      const open = { f: await snapshotOf(f), p: await snapshotOf(p), list: await rt.list(A, c.session) };
      assert.deepEqual([open.f.read[0].replay_lifecycle, open.p.read[0].replay_lifecycle], ['FINALIZED', 'PREVIEW_READY'], 'E15 a FINALIZED and a PREVIEW_READY Replay exist');
      assert.deepEqual([open.f.version[0].viewing_state, open.p.version[0].viewing_state], ['VIEWABLE', 'VIEWABLE'], 'E15 both versions are viewable under the open gate');
      assert.equal(open.f.moments.length, 4, 'E15 the finalized version has its four moments');
      assert.ok(open.f.moments.every((m) => typeof m.source_text === 'string' && m.source_text.length > 0), 'E15 with their text');
      assert.equal(open.f.analysis.length, 1, 'E15 the moment analysis answers under the open gate');
      for (const flag of [['EMERGENCY_DISABLED', 'SATISFIED'], ['DISABLED', 'SATISFIED']]) {
        await rt.setGate(...flag);
        const label = `E15 ${flag[0]}`;
        assert.equal(await rt.capability(A), false, `${label}: the hint says closed`);
        const before = await replayFingerprint();
        assert.deepEqual(await snapshotOf(f), open.f, `${label}: the FINALIZED Replay, version, moments and analysis read exactly as before`);
        assert.deepEqual(await snapshotOf(p), open.p, `${label}: the PREVIEW_READY Replay reads exactly as before`);
        assert.deepEqual(await rt.list(A, c.session), open.list, `${label}: the conversation lists both, unchanged`);
        assert.equal(outcomeOf(await rt.reopen(A, randomUUID(), f.replay, f.version)), 'NOT_AVAILABLE_NOW', `${label}: reopen is refused`);
        assert.equal(outcomeOf(await rt.finalize(A, randomUUID(), p.replay, p.version)), 'NOT_AVAILABLE_NOW', `${label}: finalize is refused`);
        assert.equal(outcomeOf(await rt.create(A, randomUUID(), c.session, 1, 4)), 'NOT_AVAILABLE_NOW', `${label}: create is refused`);
        sameFingerprint(before, await replayFingerprint(), label);
        assert.deepEqual(await rt.read(B, f.replay), [], `${label}: the other human reads nothing`);
        assert.deepEqual(await rt.version(B, f.replay, f.version), [], `${label}: nor its version`);
        assert.deepEqual(await rt.moments(B, f.replay, f.version), [], `${label}: nor its moments`);
        assert.deepEqual(await rt.analysis(B, f.replay, f.version, 1), [], `${label}: nor its analysis`);
      }
    });
  } finally {
    await owner();
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ R. account erasure, one rolled-back transaction
async function verifyErasure(report) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('R01 the Personal Replay footprint is ERASED: zero references, the other human untouched', async () => {
      const [A, B] = [randomUUID(), randomUUID()];
      await rt.provisionHumans([A, B]);
      const ca = await rt.provisionConversation(A, { turns: 4, unitsPerTurn: 2 });
      const cb = await rt.provisionConversation(B);
      await rt.setGate();
      await rt.bringTo(A, ca, 'DRAFT', { first: 5, last: 6 });
      await rt.bringTo(A, ca, 'PREVIEW_READY');
      const f = await rt.bringTo(A, ca, 'FINALIZED', { first: 3, last: 6 });
      assert.equal(outcomeOf(await rt.reopen(A, randomUUID(), f.replay, f.version)), 'REOPENED', 'R01 a reopened Replay too');
      const fb = await rt.bringTo(B, cb, 'FINALIZED');
      const bBefore = await rt.replayFootprint(B);
      const bComposition = await composition(fb.replay);
      const id = await requestDeletion(A);
      const started = Date.now();
      assert.equal(await erase(id), 'ERASED', 'R01 ERASED');
      console.log(`0169 T the Personal Replay erasure took ${Date.now() - started} ms`);
      assert.deepEqual(await rt.replayFootprint(A), { replays: 0, manifests: 0, versions: 0, lifecycle: 0, evidence: 0, creates: 0, finalizations: 0 },
        'R01 no Replay row of A survives');
      assert.deepEqual(await references(A), [], 'R01 no row anywhere references the erased account');
      assert.equal((await requestOf(id)).status, 'ERASED', 'R01 the request is ERASED');
      assert.deepEqual(await rt.replayFootprint(B), bBefore, "R01 B's Replays are untouched");
      assert.deepEqual(await composition(fb.replay), bComposition, "R01 byte for byte");
      assert.equal((await rt.version(B, fb.replay, fb.version))[0].viewing_state, 'VIEWABLE', "R01 and B's finalized version is still viewable");
    });

    await report.isolated('R02 0130 refusing after the module ran rolls EVERYTHING back and answers RETRY', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A);
      await rt.setGate();
      const f = await rt.bringTo(A, c, 'FINALIZED');
      await owner();
      await q('CREATE TABLE public.s7_01_planted (user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT)');
      await q('INSERT INTO public.s7_01_planted VALUES ($1)', [A]);
      const id = await requestDeletion(A);
      const before = await replayFingerprint();
      assert.equal(await erase(id), 'RETRY', 'R02 RETRY: the refusal the census did not explain');
      sameFingerprint(before, await replayFingerprint(), 'R02');
      assert.equal((await rt.version(A, f.replay, f.version))[0].viewing_state, 'VIEWABLE', 'R02 the Replay is exactly as it was');
      assert.equal((await progressOf(id)).last_outcome, 'RETRY', 'R02 recorded RETRY');
    });

    await report.isolated('R03 a footprint outside the Personal module is BLOCKED (REPLAY_OUTSIDE_PERSONAL) and nothing is touched', async () => {
      const [A, B] = [randomUUID(), randomUUID()];
      await rt.provisionHumans([A, B]);
      const ca = await rt.provisionConversation(A);
      const cb = await rt.provisionConversation(B);
      await rt.setGate();
      // (1) A's own finalized Replay with I-06D reconciliation evidence, through the frozen primitive as A.
      const fa = await rt.bringTo(A, ca, 'FINALIZED');
      await rt.actAs(A);
      const [reconciled] = await rows('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, NULL)', [randomUUID(), fa.replay, fa.version]);
      await owner();
      assert.ok(reconciled, 'R03 the frozen reconciliation recorded evidence for A');
      const id = await requestDeletion(A);
      let before = await replayFingerprint();
      assert.equal(await erase(id), 'BLOCKED', 'R03 an own Replay with reconciliation evidence blocks');
      assert.deepEqual((await progressOf(id)).residue_classes, [OUTSIDE], 'R03 classified outside the Personal module');
      sameFingerprint(before, await replayFingerprint(), 'R03 (own)');
      // (2) Another human's Replay naming B as a required distribution approver (planted: no product path creates one).
      await rt.asReplica(() => q('INSERT INTO public.replay_distribution_required_approvers (distribution_package_version_id, approver_user_id) VALUES (gen_random_uuid(), $1)', [B]));
      await owner();
      await rt.bringTo(B, cb, 'DRAFT');
      const idB = await requestDeletion(B);
      before = await replayFingerprint();
      assert.equal(await erase(idB), 'BLOCKED', "R03 another human's Replay naming the account blocks");
      sameFingerprint(before, await replayFingerprint(), 'R03 (named)');
      assert.deepEqual((await progressOf(idB)).residue_classes, [OUTSIDE], 'R03 classified outside the Personal module');
      assert.ok((await rt.replayFootprint(B)).replays > 0, "R03 B's own Personal Replay is untouched");
      await asRole('service_role');
      const [ops] = await rows('SELECT * FROM public.server_read_account_erasure_operations_v1()');
      await owner();
      assert.ok(ops.blocked_replay >= 2, 'R03 the operations summary counts both as blocked by Replay');
    });

    await report.isolated('R04 recovery: a BLOCKED (REPLAY) request whose census is now clean is re-armed; an outside one stays BLOCKED', async () => {
      const [A, B] = [randomUUID(), randomUUID()];
      await rt.provisionHumans([A, B]);
      const ca = await rt.provisionConversation(A);
      const cb = await rt.provisionConversation(B);
      await rt.setGate();
      await rt.bringTo(A, ca, 'FINALIZED');
      const fb = await rt.bringTo(B, cb, 'FINALIZED');
      await rt.actAs(B);
      await rows('SELECT * FROM public.reconcile_replay_post_finalization_state_v1($1, $2, $3, NULL)', [randomUUID(), fb.replay, fb.version]);
      await owner();
      const blockedA = await requestDeletion(A, { status: 'BLOCKED' });
      const blockedB = await requestDeletion(B, { status: 'BLOCKED' });
      for (const [id, classes] of [[blockedA, ['REPLAY']], [blockedB, ['REPLAY']]]) {
        await q("INSERT INTO account_erasure_private.deletion_progress (deletion_id, last_outcome, residue_classes) VALUES ($1, 'BLOCKED', $2)", [id, classes]);
      }
      await asRole('service_role');
      await rows('SELECT public.server_rearm_blocked_account_deletions_v1(20)');
      await owner();
      const a = await requestOf(blockedA);
      assert.equal(a.status, 'SCHEDULED', 'R04 the Personal-only footprint is re-armed');
      assert.ok(new Date(a.final_at).getTime() > Date.now() + 6 * 24 * 3600 * 1000, 'R04 with a fresh 7-day grace the owner can cancel');
      assert.equal((await progressOf(blockedA)).last_outcome, 'REARMED', 'R04 recorded REARMED');
      assert.equal((await requestOf(blockedB)).status, 'BLOCKED', 'R04 the outside footprint stays BLOCKED');
      assert.deepEqual((await progressOf(blockedB)).residue_classes, ['REPLAY', OUTSIDE], 'R04 and its classes are now exact (the covered one recorded beside it, as 0164 records)');
      await q("UPDATE personal_data_private.account_deletions SET final_at = clock_timestamp() - interval '1 day' WHERE id = $1", [blockedA]);
      assert.equal(await erase(blockedA), 'ERASED', 'R04 the re-armed request erases when due');
    });

    await report.isolated('R05 the narrowed guards: the GUC alone, the authorization alone and a stale one each refuse; both admit DELETE only', async () => {
      const A = randomUUID();
      await rt.provisionHumans([A]);
      const c = await rt.provisionConversation(A);
      await rt.setGate();
      const f = await rt.bringTo(A, c, 'FINALIZED');
      await owner();
      const deletePoints = () => q('DELETE FROM public.replay_analytical_projection_points WHERE source_manifest_version_id IN (SELECT id FROM public.replay_source_manifest_versions WHERE replay_id = $1)', [f.replay]);
      const deleteSpecItems = () => q('DELETE FROM public.replay_selection_spec_items WHERE source_manifest_version_id IN (SELECT id FROM public.replay_source_manifest_versions WHERE replay_id = $1)', [f.replay]);
      const deleteEvidence = () => q('DELETE FROM replay_private.personal_replay_launch_evidence WHERE replay_id = $1', [f.replay]);
      for (const op of [deletePoints, deleteSpecItems, deleteEvidence]) await rejected(op, ['55000']);
      await q("SELECT set_config('qandeel.account_erasure', txid_current()::text, true)");
      for (const op of [deletePoints, deleteSpecItems, deleteEvidence]) await rejected(op, ['55000']);
      await q("SELECT set_config('qandeel.account_erasure', '', true)");
      await q('INSERT INTO account_erasure_private.erasure_authorizations (transaction_id, deletion_id) VALUES (txid_current(), gen_random_uuid())');
      for (const op of [deletePoints, deleteSpecItems, deleteEvidence]) await rejected(op, ['55000']);
      await q("SELECT set_config('qandeel.account_erasure', (txid_current() + 1)::text, true)");
      for (const op of [deletePoints, deleteSpecItems, deleteEvidence]) await rejected(op, ['55000']);
      await q("SELECT set_config('qandeel.account_erasure', txid_current()::text, true)");
      await rejected(() => q('UPDATE public.replay_versions SET created_at = created_at WHERE replay_id = $1', [f.replay]), ['55000']);
      await rejected(() => q('UPDATE public.replay_source_manifest_items SET captured_source_digest = captured_source_digest WHERE manifest_version_id IN (SELECT id FROM public.replay_source_manifest_versions WHERE replay_id = $1)', [f.replay]), ['55000']);
      await rejected(() => q('UPDATE replay_private.personal_replay_launch_evidence SET bound_at = bound_at WHERE replay_id = $1', [f.replay]), ['55000']);
      await deleteEvidence();
      await deletePoints();
      assert.equal(Number((await rows('SELECT count(*) n FROM replay_private.personal_replay_launch_evidence WHERE replay_id = $1', [f.replay]))[0].n), 0,
        'R05 both together admit a DELETE - and only a DELETE');
      await q("SELECT set_config('qandeel.account_erasure', '', true)");
    });
  } finally {
    await owner();
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ G. races on two real connections
async function verifyRaces(report, humans) {
  const [A, B, C, D] = humans;
  await owner();
  const committed = async (work) => { await q('BEGIN'); try { const r = await work(); await q('COMMIT'); return r; } catch (e) { await q('ROLLBACK'); throw e; } };
  await committed(() => rt.provisionHumans(humans));
  const ca = await committed(() => rt.provisionConversation(A, { turns: 4, unitsPerTurn: 2 }));
  const cc = await committed(() => rt.provisionConversation(C));
  const cd = await committed(() => rt.provisionConversation(D));
  await committed(() => rt.setGate());
  const { q2, actAs2, close } = await rt.openSecondary();
  const as2 = async (uid) => { await actAs2(uid); await q2('SET LOCAL ROLE authenticated'); };
  try {
    await report.section('G01 two equivalent births at once converge on ONE Replay and one answer', async () => {
      const command = randomUUID();
      await q2('BEGIN');
      await as2(A);
      const first = (await q2('SELECT * FROM public.create_my_replay_draft_v1($1, $2, 1, 4)', [command, ca.session])).rows[0];
      const second = committed(() => rt.create(A, command, ca.session, 1, 4));
      assert.ok(await rt.stillPending(second), 'G01 the second waits for the first');
      await q2('COMMIT');
      assert.deepEqual(await second, first, 'G01 both answer the same committed birth');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.replay_create_commands WHERE id = $1', [command]))[0].n), 1, 'G01 one command');
    });

    await report.section('G02 competing revisions of one draft: exactly one REVISED, the other CHANGED', async () => {
      const d = await committed(() => rt.bringTo(A, ca, 'DRAFT', { first: 3, last: 4 }));
      await q2('BEGIN');
      await as2(A);
      const winner = (await q2('SELECT * FROM public.revise_my_replay_draft_v1($1, $2, 1, 1, 2)', [randomUUID(), d.replay])).rows[0];
      const loser = committed(() => rt.revise(A, randomUUID(), d.replay, 1, 5, 6));
      assert.ok(await rt.stillPending(loser), 'G02 the loser waits on the Replay row');
      await q2('COMMIT');
      assert.deepEqual([winner.outcome, (await loser).outcome], ['REVISED', 'CHANGED'], 'G02 one winner, one stale loser');
    });

    await report.section('G03 competing finalizations of one version: exactly one FINALIZED', async () => {
      const p = await committed(() => rt.bringTo(A, ca, 'PREVIEW_READY'));
      await q2('BEGIN');
      await as2(A);
      const winner = (await q2('SELECT * FROM public.finalize_my_replay_version_v1($1, $2, $3)', [randomUUID(), p.replay, p.version])).rows[0];
      const loser = committed(() => rt.finalize(A, randomUUID(), p.replay, p.version));
      assert.ok(await rt.stillPending(loser), 'G03 the loser waits');
      await q2('COMMIT');
      assert.deepEqual([winner.outcome, (await loser).outcome], ['FINALIZED', 'LIFECYCLE_NOT_ELIGIBLE'], 'G03 exactly once');
    });

    await report.section('G04 an erasure against an in-flight revision answers RETRY in its lock timeout, then ERASED: no deadlock', async () => {
      const d = await committed(() => rt.bringTo(C, cc, 'DRAFT'));
      const id = await committed(() => requestDeletion(C));
      await q2('BEGIN');
      await as2(C);
      assert.equal((await q2('SELECT * FROM public.revise_my_replay_draft_v1($1, $2, 1, 3, 4)', [randomUUID(), d.replay])).rows[0].outcome, 'REVISED', 'G04 the revision holds its Replay');
      await owner();
      assert.equal(await committed(() => erase(id)), 'RETRY', 'G04 the erasure yields');
      await q2('COMMIT');
      assert.equal(await committed(() => erase(id)), 'ERASED', 'G04 once the revision committed, the next pass erases everything');
      assert.equal(Number((await rows('SELECT count(*) n FROM public.replays WHERE created_by_user_id = $1', [C]))[0].n), 0, 'G04 no orphan');
    });

    await report.section('G05 a revision against an in-flight erasure waits, then finds nothing: UNAVAILABLE, no orphan', async () => {
      const d = await committed(() => rt.bringTo(D, cd, 'DRAFT'));
      const id = await committed(() => requestDeletion(D));
      await q2('BEGIN');
      await q2('RESET ROLE');
      await q2("SELECT set_config('request.jwt.claims', '', true)");
      await q2('SET LOCAL ROLE service_role');
      assert.equal((await q2('SELECT public.server_erase_account_v1($1) AS outcome', [id])).rows[0].outcome, 'ERASED', 'G05 the erasure holds its locks');
      const revision = committed(() => rt.revise(D, randomUUID(), d.replay, 1, 1, 2));
      assert.ok(await rt.stillPending(revision), 'G05 the revision waits on the Replay row');
      await q2('COMMIT');
      // The revision ran in its own committed transaction on its own connection: its refusal, if any, aborts nothing here.
      let answer;
      try {
        answer = await revision;
      } catch (error) {
        answer = { outcome: `ERROR ${error.code}` };
      }
      assert.ok(['UNAVAILABLE', 'ERROR 42501'].includes(answer.outcome), `G05 the erased human's revision finds nothing (${answer.outcome})`);
      assert.equal(Number((await rows('SELECT count(*) n FROM public.replays WHERE created_by_user_id = $1', [D]))[0].n), 0, 'G05 no orphan Replay');
    });

    await report.section('G06 an operator change waits for an in-flight act, and the next act binds the new decision', async () => {
      await q2('BEGIN');
      await as2(A);
      const created = (await q2('SELECT * FROM public.create_my_replay_draft_v1($1, $2, 7, 8)', [randomUUID(), ca.session])).rows[0];
      assert.equal(created.outcome, 'CREATED', 'G06 the act holds the gate snapshot');
      const change = committed(() => rt.setGate('EMERGENCY_DISABLED', 'SATISFIED'));
      assert.ok(await rt.stillPending(change), 'G06 the emergency disable waits for the act');
      await q2('COMMIT');
      await change;
      assert.equal(outcomeOf(await committed(() => rt.create(A, randomUUID(), ca.session, 1, 2))), 'NOT_AVAILABLE_NOW', 'G06 the next act is refused');
    });
  } finally {
    await close();
    await owner();
  }
}

runVerifier('0169', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '120s'");
  const report = createScenarioReport('0169', { query: q, restore: () => owner() });
  const raceHumans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  setStage('posture');
  await verifyPosture(report);
  setStage('behaviour');
  await verifyBehaviour(report);
  setStage('erasure');
  await verifyErasure(report);
  setStage('races');
  try {
    await verifyRaces(report, raceHumans);
  } finally {
    setStage('teardown');
    await rt.removeCommittedFixtures(raceHumans);
    await rt.resetGate();
  }
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.replays WHERE created_by_user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM replay_private.replay_launch_capability_states) AS residue`, [raceHumans]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
