// I-06D - Post-authorization current delivery eligibility, controlled
// reconciliation and Replay Runtime closure: the secret-free structural contract
// for migration 0107.
//
// Live semantics - what a stale authorization refuses, the Public
// non-regression, the race matrix - are proven by database/verify-migration-0107.mjs
// against real PostgreSQL. What is proven HERE is the structure a migration must
// already have before it deploys: that a HISTORICAL distribution authorization
// and a CURRENT delivery eligibility are two different facts and neither is
// stored as the other; that current eligibility re-evaluates through the
// canonical I-06A / I-06C / I-05C authorities and writes no parallel fingerprint,
// source currency or Public visibility rule of its own; that private Replay
// source loss invents no Public transition at all; that reconciliation appends
// bounded evidence, takes the Replay lock FIRST and mutates nothing; that no
// relation can record a delivery nobody performed or a recall QANDEEL cannot
// guarantee; and that the whole I-06D surface is additive over untouched
// predecessors.
//
// It also carries the anti-vacuity half for the WHOLE slice: every authorized
// later addition must leave both I-06D contracts passing, and every deliberate
// weakening must be refused by at least one of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const PROBE_CHILD = 'QANDEEL_I06D_REPLAY_CLOSURE_FORWARD_SAFETY_CHILD';

const MIGRATION_NAME = '0107_replay_distribution_current_eligibility_reconciliation_v1.sql';
const PART_A_NAME = '0106_replay_post_finalization_source_availability_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0107.mjs');
const support = read('../replay-closure-verifier-support.mjs');
const readme = read('../README.md');
const doc = read('../../docs/replay-runtime-v1.md');
const backlog = read('../../docs/qandeel-canonical-backlog-v1.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const focused = read('../focused-verifiers.json');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const OWN_TABLES = ['replay_distribution_reconciliation_events', 'replay_reconciliation_commands'];
const ELIGIBILITY = 'derive_replay_distribution_current_eligibility_v1';
const BOUNDARY = 'resolve_replay_distribution_current_state_v1';
const RECONCILE = 'reconcile_replay_post_finalization_state_v1';
const OWN_SCRIPT = 'verify:replay-distribution-reconciliation-closure:integration';
const PART_A_SCRIPT = 'verify:replay-post-finalization-source-availability:integration';

const bodyOf = (name) => {
  const start = executableSql.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `0107 declares ${name}`);
  const open = executableSql.indexOf('AS $$', start);
  const close = executableSql.indexOf('$$;', open + 5);
  return executableSql.slice(open + 'AS $$'.length, close);
};
const tableBlock = (table) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(start >= 0, `0107 creates ${table}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};
const columnsOf = (table) => [...tableBlock(table).matchAll(/^\s{4}(\w+)\s+(uuid|text|integer|bigint|boolean|timestamptz|jsonb|json|bytea)\b/gmu)]
  .map((m) => ({ name: m[1], type: m[2] }));

test('0107 is the forward migration after 0106, the frozen I-06C predecessors are byte-identical, and nothing is rewritten', async () => {
  const { I06C_FROZEN } = await import('./replay-closure-frozen-predecessors.mjs');
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0107_')).length, 1, 'exactly one migration carries the 0107 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf(PART_A_NAME));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of I06C_FROZEN) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu,
    '0107 drops nothing');
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE FUNCTION/u,
    '0107 replaces no predecessor function: the canonical Public visibility resolver, the canonical authority derivation and both fail-closed seams are consumed, never rewritten');
  for (const [, created] of executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(created), `0107 creates only its own relations, not ${created}`);
  }
  // A FROZEN RELATION IS TOUCHED ONLY TO ADD ONE TRIVIALLY-UNIQUE CANDIDATE KEY.
  const altered = [...executableSql.matchAll(/ALTER TABLE public\.(\w+)\n?\s*(ADD CONSTRAINT|OWNER TO|ENABLE ROW)/gu)]
    .filter(([, table]) => !OWN_TABLES.includes(table));
  assert.deepEqual(altered.map(([, table, action]) => [table, action]),
    [['replay_distribution_package_versions', 'ADD CONSTRAINT']],
    '0107 alters exactly one predecessor relation, and only to ADD a candidate key');
  assert.match(executableSql,
    /ALTER TABLE public\.replay_distribution_package_versions\s*\n\s*ADD CONSTRAINT replay_distribution_package_versions_target_key\s*\n\s*UNIQUE \(id, replay_id, replay_version_id\);/u,
    'and that key contains the primary key, so it constrains no row the primary key did not');
});

test('a HISTORICAL authorization and a CURRENT eligibility are two different facts', () => {
  const eligibility = bodyOf(ELIGIBILITY);
  // The historical row is READ and never rewritten, and the current answer is
  // never stored on it.
  assert.ok(eligibility.includes('public.replay_distribution_authorizations'),
    'current eligibility reads the historical authorization');
  for (const forbidden of ['INSERT INTO', 'UPDATE public.', 'DELETE FROM']) {
    assert.ok(!eligibility.includes(forbidden),
      `current eligibility writes nothing: ${forbidden} must not appear`);
  }
  // A package never authorized has no authorization to USE, which is a different
  // answer from a stale one.
  assert.ok(eligibility.includes("'NOT_AUTHORIZED'"),
    'and a package that was never authorized is answered as such');
  // THE VOCABULARY IS ABOUT FUTURE ELIGIBILITY AND HAS NO DELIVERED STATE.
  for (const state of ['ELIGIBLE_FOR_FUTURE_DELIVERY', 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY']) {
    assert.ok(eligibility.includes(`'${state}'`), `the derivation answers ${state}`);
  }
  for (const forbidden of ['DELIVERED', 'RECALLED', 'DELIVERY_PERFORMED', 'EXTERNAL_COPY']) {
    assert.ok(!eligibility.includes(forbidden),
      `authorization is not delivery, and no already-exported copy is claimed recalled: ${forbidden}`);
  }
});

test('every reconciliation record binds its exact target as ONE row, restrictively', () => {
  // ONE row rather than independent partial keys, which is the shape that lets
  // an observation pair one Replay's version with another Replay's package.
  assert.match(tableBlock('replay_distribution_reconciliation_events'),
    /FOREIGN KEY \(distribution_package_version_id, replay_id, replay_version_id\)\s*\n\s*REFERENCES public\.replay_distribution_package_versions \(id, replay_id, replay_version_id\)/u,
    'distribution evidence binds the exact package, its Replay and its Replay Version as ONE row');
  const commands = tableBlock('replay_reconciliation_commands');
  assert.match(commands,
    /FOREIGN KEY \(replay_id, actor_user_id\)\s*\n\s*REFERENCES public\.replays \(id, created_by_user_id\)/u,
    'the actor is the exact Replay creator, structurally, through the 0100 key');
  assert.match(commands,
    /FOREIGN KEY \(replay_version_id, replay_id\)\s*\n\s*REFERENCES public\.replay_version_finalizations \(replay_version_id, replay_id\)/u,
    'and the target is a HISTORICALLY finalized version of that exact Replay');
  assert.match(commands,
    /FOREIGN KEY \(distribution_package_version_id, replay_id, replay_version_id\)\s*\n\s*REFERENCES public\.replay_distribution_package_versions \(id, replay_id, replay_version_id\)/u,
    'and its package, when it names one, is that exact Replay Version own package');
  for (const table of OWN_TABLES) {
    const block = tableBlock(table);
    assert.ok(block.includes('ON DELETE RESTRICT'), `${table} binds restrictively`);
    assert.ok(!block.includes('ON DELETE CASCADE'), `${table} never cascades truth away`);
  }
});

test('current eligibility re-evaluates through the canonical authorities and writes no parallel one', () => {
  const eligibility = bodyOf(ELIGIBILITY);
  for (const canonical of ['derive_replay_version_current_availability_v1',
    'derive_replay_distribution_authority_v1', 'derive_replay_distribution_effective_approvals_v1',
    'derive_replay_export_descriptor_v1', 'resolve_replay_distribution_prerequisites_v1',
    'resolve_public_visibility_state_v1', 'replay_version_finalizations']) {
    assert.ok(eligibility.includes(canonical),
      `current eligibility must re-evaluate through the canonical ${canonical} rather than around it`);
  }
  for (const forbidden of ['replay_distribution_authority_fingerprint_v1',
    'derive_replay_source_manifest_currency_v1', 'derive_public_continuing_eligibility_v1',
    'current_lifecycle', 'public_experience_publication_state', "'sha256:'"]) {
    assert.ok(!eligibility.includes(forbidden),
      `no parallel fingerprint, source currency, Public visibility rule or lifecycle of its own: ${forbidden}`);
  }
  // AND IT READS NO RECONCILIATION ROW: evidence documents, never decides.
  for (const relation of ['replay_source_availability_reconciliation_events',
    'replay_distribution_reconciliation_events', 'replay_reconciliation_commands']) {
    assert.ok(!eligibility.includes(relation),
      `canonical current truth never consults ${relation}: a durable row may document a result, never create one`);
  }

  // EACH GATE IS PINNED BY ITS EXACT CONDITION, not only by the derivation it
  // consults and not only by the class it answers. A gate pinned by the function
  // alone survives `IF false THEN`, and a gate pinned by its refusal class alone
  // survives a condition that can never be true - both of which leave a stale
  // authorization usable while every other assertion here still passes.
  for (const condition of [
    'stored IS DISTINCT FROM derived.required_approvers',
    'derived.authority_fingerprint IS DISTINCT FROM package.authority_request_fingerprint',
    'authorized.authority_request_fingerprint IS DISTINCT FROM derived.authority_fingerprint',
    's.bound_authority_fingerprint IS DISTINCT FROM derived.authority_fingerprint',
    "s.effective_state IS DISTINCT FROM 'EFFECTIVE'",
    "current_availability IS DISTINCT FROM 'CURRENT'",
    'recomputed_digest IS DISTINCT FROM stored_digest',
    "visible.state IS DISTINCT FROM 'PUBLICLY_VISIBLE'",
    'visible.manifest IS DISTINCT FROM bridge.public_manifest_version_id',
  ]) {
    assert.ok(eligibility.includes(condition),
      `the gate is pinned by its exact condition and not only by what it consults: ${condition}`);
  }
});

test('the gate order is load-bearing: source before authority, CW2-08 last', () => {
  const eligibility = bodyOf(ELIGIBILITY);
  const at = (needle) => {
    const index = eligibility.indexOf(needle);
    assert.ok(index > 0, `the derivation contains ${needle}`);
    return index;
  };
  const notAuthorized = at("'NOT_AUTHORIZED'");
  const source = at("'SOURCE_NOT_CURRENT'");
  const authority = at("'AUTHORITY_UNRESOLVED'");
  const approval = at("'APPROVAL_NOT_EFFECTIVE'");
  const surface = at("'EXPORT_SURFACE_SUPERSEDED'");
  const destination = at("'PUBLIC_DESTINATION_NOT_SERVING'");
  const prerequisite = at("'PREREQUISITE_UNRESOLVED'");
  assert.ok(notAuthorized < source && source < authority && authority < approval
    && approval < surface && surface < destination && destination < prerequisite,
  'source is answered BEFORE authority, so the source-loss refusal is reachable in production, '
    + 'and the CW2-08 seam is LAST, so a privacy failure is never reported as a launch failure');
  // THE UNRESOLVED SEAM IS A BOUNDED REFUSAL, never an error a caller reads as
  // permission, and never reinterpreted as an empty human requirement.
  assert.match(eligibility, /EXCEPTION\s*\n\s*WHEN SQLSTATE '55000' THEN\s*\n\s*RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'AUTHORITY_UNRESOLVED'/u,
    'an unresolved authority seam answers NOT_ELIGIBLE with a bounded class');
  assert.ok(!eligibility.includes('RESOLVED_NO_HUMAN_REQUIREMENT'),
    'and unresolved is never reinterpreted as zero approvers');
  for (const dimension of ['safety_state', 'moderation_state', 'entitlement_state', 'feature_state',
    'launch_state']) {
    assert.ok(eligibility.includes(`gate.${dimension} IS DISTINCT FROM`),
      `every CW2-08 dimension must be positive on its own: ${dimension}`);
  }
});

test('private Replay source loss invents no Public transition at all', () => {
  const eligibility = bodyOf(ELIGIBILITY);
  const reconcile = bodyOf(RECONCILE);
  // The Public destination is answered by CONSUMING the canonical resolver and
  // comparing the exact manifest THIS package bridged.
  assert.match(eligibility, /public\.resolve_public_visibility_state_v1\(bridge\.public_experience_id\)/u,
    'the canonical Public visibility resolver is consulted for the exact bridged Experience');
  assert.ok(eligibility.includes('visible.manifest IS DISTINCT FROM bridge.public_manifest_version_id'),
    'and the exact manifest this package bridged must be the one currently served');
  // NOTHING ANYWHERE IN THIS MIGRATION MOVES PUBLIC LIFECYCLE.
  for (const body of [eligibility, reconcile]) {
    for (const forbidden of ['remove_public_experience_from_public_world_v1',
      'reconcile_public_experience_disappearance_v1', 'publish_public_experience_v1',
      'withdraw_publication_approval_v1', 'ABSENT_FROM_PUBLIC_WORLD']) {
      assert.ok(!body.includes(forbidden),
        `CW2-05 declines to invent automatic Public withdrawal from later source unavailability: ${forbidden}`);
    }
  }
  assert.ok(selfAssertions.includes('I-06D writes no second Public visibility authority'),
    'and the migration refuses to deploy if a second Public visibility truth appears');
  assert.ok(selfAssertions.includes('must never inspect private Replay source state'),
    'or if the canonical resolver grows a private Replay-source check of its own');
  // Public rows are taken FOR SHARE, because reconciliation READS Public truth.
  assert.ok(reconcile.includes('public.public_world_state w WHERE w.singleton FOR SHARE'),
    'reconciliation takes the Public rows FOR SHARE and never FOR UPDATE');
  assert.ok(!reconcile.includes('public_world_state w WHERE w.singleton FOR UPDATE'));
});

test('reconciliation is creator-scoped, Replay-locked first, and mutates nothing', () => {
  const reconcile = bodyOf(RECONCILE);
  assert.ok(reconcile.includes('u uuid := auth.uid()'),
    'the acting human comes from canonical identity and is never a parameter');
  const replayLock = reconcile.indexOf('FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE');
  const packageLock = reconcile.indexOf('replay_distribution_package_versions p');
  const versionLock = reconcile.indexOf('FROM public.replay_versions v');
  const sourceLock = reconcile.indexOf('replay_lock_source_manifest_v1');
  const approvalLock = reconcile.indexOf('replay_distribution_approvals a');
  const publicLock = reconcile.indexOf('public.public_world_state');
  const firstWrite = reconcile.indexOf('INSERT INTO public.replay_source_availability_reconciliation_events');
  assert.ok(replayLock > 0 && replayLock < packageLock && packageLock < versionLock
    && versionLock < sourceLock && sourceLock < approvalLock && approvalLock < publicLock
    && publicLock < firstWrite,
  'Replay FOR UPDATE, then the package and the version FOR SHARE, then the canonical source lock, '
    + 'then the approvals in a deterministic order, then the destination subsystem, then the writes');
  assert.ok(reconcile.includes('ORDER BY a.approver_user_id FOR SHARE'),
    'the approval rows are taken in a deterministic order');
  for (const forbidden of ['pg_advisory', 'LOCK TABLE', 'TRUNCATE', 'UPDATE public.', 'DELETE FROM']) {
    assert.ok(!reconcile.includes(forbidden),
      `reconciliation appends evidence and mutates nothing: ${forbidden} must not appear`);
  }
  // IT INSERTS ONLY INTO THE THREE RELATIONS THIS SLICE OWNS.
  const targets = [...reconcile.matchAll(/INSERT INTO public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(targets)].sort(),
    ['replay_distribution_reconciliation_events', 'replay_reconciliation_commands',
      'replay_source_availability_reconciliation_events'].sort(),
    'and writes nothing outside its own append-only evidence');
  assert.ok(reconcile.includes('instant := clock_timestamp()'),
    'with ONE database-owned instant for every row the command writes');
  assert.ok(!/\bnow\(\)|CURRENT_TIMESTAMP/u.test(reconcile),
    'and no transaction clock, which would collide with an immutability guard');
});

test('the command identity binds the WHOLE immutable request and answers from what was committed', () => {
  const reconcile = bodyOf(RECONCILE);
  for (const bound of ['actor=', 'replay=', 'replayVersion=', 'package=', 'purpose=']) {
    assert.ok(reconcile.includes(`'${bound}'`) || reconcile.includes(`|| '${bound}'`),
      `the request digest binds ${bound}`);
  }
  assert.ok(reconcile.includes("coalesce(lower(p_distribution_package_version_id::text), 'NONE')"),
    'including the EXPLICIT absence of a package, so a source-only retry cannot be answered for a package one');
  assert.equal((reconcile.match(/committed\.request_ref <> request/gu) ?? []).length, 2,
    'both idempotency passes - before the Replay lock and again under it - compare the whole request');
  assert.equal((reconcile.match(/'ALREADY_COMMITTED'::text/gu) ?? []).length, 2,
    'and both answer from the committed row');
  // EVERY FIELD OF THE ANSWER COMES FROM THE COMMITTED ROW, in BOTH passes.
  //
  // The request digest already proves the retry's arguments equal the committed
  // ones, so echoing a caller argument back reads as harmless today. It is
  // pinned anyway, because the two facts are independent: a later edit that
  // narrows the digest would turn every echoed field into an answer about a
  // request that was never committed, silently and with this file still green.
  for (const field of ['committed.replay_id', 'committed.replay_version_id',
    'committed.distribution_package_version_id', 'committed.committed_availability_state',
    'committed.committed_eligibility_state', 'committed.committed_at']) {
    assert.equal((reconcile.match(new RegExp(field.replace('.', '\\.'), 'gu')) ?? []).length, 2,
      `both idempotency passes answer with ${field} rather than with what the retry itself says`);
  }
  assert.ok(reconcile.includes("RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_COMMAND_ID_CONFLICT'"),
    'and the same command id over a materially different request is a deterministic conflict');
  // The committed ANSWER is on the command row, typed and bounded.
  const block = tableBlock('replay_reconciliation_commands');
  assert.match(block, /CHECK \(reconciliation_purpose IN \('SOURCE_AVAILABILITY',\s*\n\s*'SOURCE_AVAILABILITY_AND_DISTRIBUTION'\)\)/u,
    'a narrow typed command relation, never a generic command bus');
  assert.ok(block.includes('committed_availability_state') && block.includes('committed_eligibility_state'),
    'carrying the exact committed answer');
  assert.match(block, /replay_reconciliation_commands_shape_check CHECK \(/u,
    'whose shape agrees with the purpose in both directions');
});

test('every I-06D relation is append-only, sealed, and records no delivery or recall', () => {
  for (const table of OWN_TABLES) {
    assert.match(installedSql,
      new RegExp(`CREATE TRIGGER ${table}_immutable\\s*\\n\\s*BEFORE UPDATE OR DELETE ON public\\.${table}`, 'u'),
      `${table} is append-only for every role including its owner`);
    assert.match(installedSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'u'));
    for (const { name, type } of columnsOf(table)) {
      assert.ok(!['json', 'jsonb', 'bytea'].includes(type), `${table}.${name} may not be an untyped payload column`);
      assert.doesNotMatch(name,
        /body|transcript|audio|content|payload|url|uri|path|object_key|bucket|storage|delivered|downloaded|sent_at|recipient|endpoint|recalled|destroyed|remote_file|external_copy|provenance|staleness|digest/u,
        `QANDEEL performs no delivery and guarantees no recall of exported copies: ${table}.${name} may not exist`);
    }
  }
  assert.ok(!installedSql.includes('CREATE POLICY'), 'with zero policies anywhere');
  assert.match(installedSql, /REVOKE ALL ON TABLE public\.replay_distribution_reconciliation_events,\s*\n\s*public\.replay_reconciliation_commands\s*\n\s*FROM PUBLIC, anon, authenticated/u);
  assert.ok(installedSql.includes('FROM service_role'), 'and from the service tier too');
  // The evidence is bounded classification, and the two halves agree.
  const events = tableBlock('replay_distribution_reconciliation_events');
  assert.match(events, /CHECK \(observed_eligibility_state IN \('ELIGIBLE_FOR_FUTURE_DELIVERY',/u);
  assert.match(events, /replay_distribution_reconciliation_events_agreement_check CHECK \(/u,
    'an eligible observation can never carry a refusal, and a refusal can never be empty');
  assert.deepEqual(columnsOf('replay_distribution_reconciliation_events').map((c) => c.name),
    ['id', 'replay_id', 'replay_version_id', 'distribution_package_version_id',
      'observed_eligibility_state', 'observed_refusal_class', 'observed_at'],
    'the evidence relation carries exactly its bounded surface');
});

test('production remains fail-closed: no application role reaches the derivation or the primitive', () => {
  assert.ok(installedSql.includes(`'public.${ELIGIBILITY}(uuid)'`)
    && installedSql.includes(`'public.${RECONCILE}(uuid, uuid, uuid, uuid)'`),
  'both are in the sealed list');
  assert.ok(installedSql.includes(`boundary text := 'public.${BOUNDARY}(uuid, uuid)'`),
    'and the ONE creator boundary is the only granted surface');
  assert.match(installedSql, /GRANT EXECUTE ON FUNCTION %s TO service_role/u);
  assert.match(executableSql,
    new RegExp(`CREATE FUNCTION public\\.${RECONCILE}\\([\\s\\S]{0,600}?LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''`, 'u'),
    'the primitive is SECURITY DEFINER, VOLATILE and search_path-pinned');
  for (const name of [ELIGIBILITY, BOUNDARY]) {
    assert.match(executableSql,
      new RegExp(`CREATE FUNCTION public\\.${name}\\([\\s\\S]{0,400}?LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''`, 'u'),
      `${name} is SECURITY DEFINER, STABLE and search_path-pinned`);
  }
  assert.ok(selfAssertions.includes('executable by no application role'),
    'and the migration refuses to deploy if one becomes reachable');
  // AND NEITHER FROZEN SEAM IS WEAKENED.
  assert.ok(selfAssertions.includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT')
    && selfAssertions.includes('NOT_EVALUATED'),
  'the analytical subject-authority seam and the CW2-08 prerequisite seam must both still fail closed');
});

test('the creator boundary reports both facts and collapses every authority failure into one class', () => {
  const boundary = bodyOf(BOUNDARY);
  assert.ok(boundary.includes('r.created_by_user_id = p_user_id'), 'the exact creator, and nobody else');
  assert.match(boundary, /IF NOT FOUND THEN\s*\n\s*RETURN;\s*\n\s*END IF;/u,
    'and everyone else receives ZERO ROWS');
  assert.ok(boundary.includes('z.distribution_state'),
    'the HISTORICAL fact comes from the immutable authorization row and is never recomputed');
  assert.ok(boundary.includes(`public.${ELIGIBILITY}`),
    'and the CURRENT fact from the ONE eligibility derivation');
  // FOUR INTERNAL CLASSES COLLAPSE INTO ONE, so the creator never learns which
  // human moved or which internal component went stale.
  assert.match(boundary,
    /WHEN internal_class IN \('AUTHORITY_UNRESOLVED', 'AUTHORITY_SUPERSEDED',\s*\n\s*'APPROVAL_NOT_EFFECTIVE', 'EXPORT_SURFACE_SUPERSEDED'\)\s*\n\s*THEN 'AUTHORITY_NO_LONGER_CURRENT'/u,
    'missing, withdrawn, superseded and unresolved are one creator-facing class');
  for (const forbidden of ['SOURCE_UNAVAILABLE', 'SOURCE_ACCESS_LOST', 'SOURCE_VERSION_NOT_CURRENT',
    'approver_user_id', 'linked_public_approval_id']) {
    assert.ok(!boundary.includes(forbidden),
      `the creator boundary names no private source cause and no private approval identity: ${forbidden}`);
  }
});

test('0107 is registered in the toolchain, the focused gate, the I-06D CI group, the README and the phase document', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0107\\.mjs"`, 'u'));
  assert.match(readme, /0107_replay_distribution_current_eligibility_reconciliation_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README records the verifier command');
  assert.match(verifier, /verifier for migration 0107/iu);
  const groups = JSON.parse(focused).groups;
  assert.ok(groups['i06d-0107'], 'the focused gate can select 0107 alone');
  assert.deepEqual(groups['i06d-all'].verifiers,
    ['database/verify-migration-0106.mjs', 'database/verify-migration-0107.mjs']);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0107=PASS; else status=1; fi`));
  assert.ok(workflow.includes(`if npm run ${PART_A_SCRIPT}; then result_0106=PASS; else status=1; fi`));
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
  // Every predecessor Replay gate survives, and the I-06D group runs after them.
  for (const predecessor of ['verify:replay-foundation-source-manifest:integration',
    'verify:replay-authorized-draft-runtime:integration',
    'verify:replay-analytical-projection-render-contract:integration',
    'verify:replay-preview-finalization-runtime:integration',
    'verify:replay-distribution-package-authority:integration',
    'verify:replay-distribution-runtime-export-public-bridge:integration']) {
    assert.ok(workflow.includes(`npm run ${predecessor}`), `the predecessor gate ${predecessor} is not removed`);
  }
  assert.ok(workflow.indexOf('result_0107=PASS')
    > workflow.indexOf('result_0105=PASS'),
  'and the I-06D group runs after the I-06C group');

  // THE PHASE DOCUMENT TELLS THE TRUTH ABOUT WHERE I-06 STANDS.
  assert.ok(doc.includes('I-06') && doc.includes('ACTIVE'), 'I-06 is ACTIVE');
  assert.ok(/I-06A[^\n]*(CLOSED|MERGED)/u.test(doc), 'I-06A is closed and merged');
  assert.ok(/I-06B[^\n]*(CLOSED|MERGED)/u.test(doc), 'I-06B is closed and merged');
  assert.ok(/I-06C[^\n]*(CLOSED|MERGED)/u.test(doc),
    'I-06C is reconciled as closed and merged now that PR #254 is on main');
  assert.ok(doc.includes('I-06D') && doc.includes('CANDIDATE'),
    'and I-06D is a candidate awaiting independent review');
  assert.doesNotMatch(doc, /^\s*`?I-06`?\s+(?:is\s+)?(?:CLOSED|FROZEN)/mu, 'and I-06 is never claimed closed');
  // THE I-06C BANNER RESIDUE IS NORMALIZED WITHOUT REWRITING HISTORY.
  assert.ok(doc.includes('#254'), 'the document records the PR that merged I-06C');
  assert.ok(/governance reconciliation/iu.test(doc),
    'and says explicitly that the normalization is governance reconciliation, not a Product change');
  for (const phrase of ['CURRENT_SOURCE_ELIGIBILITY', 'SOURCE_CONTENT_BEARING_LAYER',
    'ANALYTICAL_VISUAL_LAYER', 'AUTHORIZED_FOR_DELIVERY', 'NOT_EVALUATED',
    'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT', 'QAN-BL-NAV-02']) {
    assert.ok(doc.includes(phrase), `the phase document records ${phrase}`);
  }
  assert.doesNotMatch(doc, /Public launch (?:is )?(?:ready|cleared|achieved)/iu,
    'the phase document claims no Public launch readiness');
  assert.ok(doc.includes('fails closed'), 'and records the fail-closed truth plainly');
  // BG-08: the inherited backlog item has an explicit disposition prepared, and
  // nothing has been tombstoned ahead of the independent review.
  assert.ok(backlog.includes('QAN-BL-NAV-02'), 'the canonical backlog still records QAN-BL-NAV-02');
});

test('the 0107 verifier RUNS the scenarios it claims, through the permanent aggregator', () => {
  for (const scenario of [
    'E01 a package that was never authorized has no authorization to use',
    'E05 the production analytical seam refuses, bounded, and never guesses',
    'E06 an unevaluated CW2-08 dimension refuses, after every privacy gate',
    'E11 no application role reaches any I-06D primitive or relation',
    'E02 E03 source loss refuses FUTURE delivery and rewrites no history',
    'E04 a withdrawn approval refuses future use, append-only throughout',
    'E07 E08 the answer claims no delivery and cannot be borrowed',
    'E09 E10 the creator boundary is bounded, historical-and-current, creator-exact',
    'P01 P02 private source loss invents NO Public transition and is no oracle',
    'P03 P04 canonical Public disappearance stops serving and refuses the package',
    'P05 no Replay reconciliation resurrects a disappeared Experience',
    'N01 N02 reconciliation appends bounded evidence that is NOT authority',
    'N03 N04 an equivalent retry is idempotent and a reused id conflicts',
    'N05 N06 another human cannot reconcile, and neither can an unfinalized version',
    'N07 reconciliation moves not one immutable row',
    'N08 every I-06D relation is append-only for every role including its owner',
    'C01 a source change racing reconciliation has ONE coherent current answer',
    'C02 a withdrawal racing reconciliation converges safely',
    'C03 Public disappearance racing reconciliation preserves Public absence',
    'C04 reopen-for-revision racing old-version reconciliation preserves the old version',
    'C05 a duplicate reconciliation command converges on ONE observation',
    'C06 reconciliation racing a new distribution authorization',
    'g1 the withdrawn-approval gate is load-bearing',
    'g2 the source gate is load-bearing, and the catalog refuses a detached one',
    'g3 the Public destination gate is load-bearing',
    'g4 reconciliation cannot be made to mutate an immutable package field',
    'g5 a later reviewed delivery boundary leaves everything passing',
  ]) {
    assert.ok(verifier.includes(`'${scenario}'`), `the verifier runs ${scenario}`);
  }
  assert.ok(verifier.includes('report.assertAllPassed()'));
  assert.ok(verifier.includes('the production analytical subject-authority seam is restored byte for byte')
    && verifier.includes('the production CW2-08 prerequisite seam is restored byte for byte'),
  'and the run proves BOTH production seams back after the committed races');
  assert.ok(support.includes('assert.equal(prosrc, seam.prosrc,')
    || read('../replay-distribution-verifier-support.mjs').includes('assert.equal(prosrc, seam.prosrc,'),
  'through the restore helper that compares the body rather than through a bare recreate');
  assert.ok(support.includes('I-06D VERIFIER PROBE'), 'every simulated answer says it is a probe');
});

// ---------------------------------------------------------------------------------------------
// Forward safety and anti-vacuity for the WHOLE I-06D slice.
// ---------------------------------------------------------------------------------------------

const I06D_CONTRACTS = [
  'database/tests/replay-post-finalization-source-availability-v1.test.mjs',
  'database/tests/replay-distribution-reconciliation-closure-v1.test.mjs',
];
const MIRRORED = ['.github', 'database', 'tests', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i06d-replay-');
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(mirror, entry), { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  mkdirSync(join(mirror, 'docs'), { recursive: true });
  writeFileSync(join(mirror, 'docs/replay-runtime-v1.md'), doc);
  writeFileSync(join(mirror, 'docs/qandeel-canonical-backlog-v1.md'), backlog);
  return mirror;
}
const write = (mirror, relative, text) => {
  mkdirSync(dirname(join(mirror, relative)), { recursive: true });
  writeFileSync(join(mirror, relative), text);
};
function patch(mirror, relative, from, to) {
  const target = join(mirror, relative);
  const text = readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `the mirrored ${relative} contains the text to patch; it does not contain:\n${from}`);
  assert.equal(text.indexOf(from), text.lastIndexOf(from),
    `the patch anchor for ${relative} occurs more than once, so the mutation would land somewhere unintended`);
  writeFileSync(target, text.replace(from, to));
}
function runInMirror(mirror) {
  const env = { ...process.env, [PROBE_CHILD]: '1' };
  delete env.NODE_TEST_CONTEXT;
  const files = I06D_CONTRACTS.map((relative) => join(mirror, relative));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    { cwd: mirror, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.error, undefined, `the mirrored contracts could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'the mirrored contracts did not exit normally');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(output, /# pass \d+/u, `the mirrored contracts reported no results:\n${output.slice(-1500)}`);
  assert.doesNotMatch(output, /# pass 0\b/u, 'the mirrored contracts executed nothing');
  return { ok: result.status === 0, output };
}

const M106 = `database/migrations/${PART_A_NAME}`;
const M107 = `database/migrations/${MIGRATION_NAME}`;
const CI = '.github/workflows/api-ci.yml';
const GROUP_STEP = '      - name: Verify the two I-06D Replay post-finalization source availability and reconciliation verifiers against real PostgreSQL as one reported group';

test('every authorized later addition leaves both I-06D contracts passing',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const mirror = buildMirror();
    try {
      // The roadmap, as a real migration: a reviewed media delivery boundary
      // with a real storage handle and a real external-copy record, a reviewed
      // protected-human subject-authority resolver that finally resolves the
      // analytical seam, a reviewed CW2-08 runtime that finally clears the
      // prerequisite, additive columns, an index and a new CI gate.
      //
      // The hypothetical migration number is deliberately AHEAD of this slice:
      // a probe that reused 0106 or 0107 would collide with what this slice
      // really installs the moment it lands.
      write(mirror, 'database/migrations/0108_replay_media_delivery_and_launch_v1.sql',
        'BEGIN;\n'
        + 'CREATE TABLE public.replay_delivery_receipts (distribution_package_version_id uuid PRIMARY KEY\n'
        + '  REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,\n'
        + '  storage_object_key text NOT NULL, signed_url text NOT NULL, delivered_at timestamptz NOT NULL);\n'
        + 'CREATE TABLE public.replay_external_copy_records (id uuid PRIMARY KEY,\n'
        + '  distribution_package_version_id uuid NOT NULL\n'
        + '    REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,\n'
        + '  remote_url text NOT NULL, recalled_at timestamptz);\n'
        + 'CREATE OR REPLACE FUNCTION public.resolve_replay_analytical_distribution_authority_v1(\n'
        + '  p_analytical_projection_version_id uuid)\n'
        + '  RETURNS TABLE(resolution_state text, required_approvers uuid[], resolution_basis text)\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$\n"
        + "  BEGIN RETURN QUERY SELECT 'RESOLVED_NO_HUMAN_REQUIREMENT'::text, ARRAY[]::uuid[],\n"
        + "    'a later reviewed subject authority resolver'::text; END$fn$;\n"
        + 'CREATE OR REPLACE FUNCTION public.resolve_replay_distribution_prerequisites_v1(\n'
        + '  p_distribution_package_version_id uuid, p_destination_action text)\n'
        + '  RETURNS TABLE(clearance text, safety_state text, moderation_state text, entitlement_state text,\n'
        + '                feature_state text, launch_state text, clearance_basis text)\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$\n"
        + "  BEGIN RETURN QUERY SELECT 'CLEARED'::text, 'SAFETY_ALLOW'::text, 'MODERATION_ALLOW'::text,\n"
        + "    'ENTITLED'::text, 'FEATURE_ENABLED'::text, 'LAUNCH_CLEARED'::text, 'a reviewed runtime'::text;\n"
        + '  END$fn$;\n'
        + 'ALTER TABLE public.replay_reconciliation_commands ADD COLUMN client_ref text;\n'
        + 'CREATE INDEX replay_distribution_reconciliation_events_at_idx\n'
        + '  ON public.replay_distribution_reconciliation_events (observed_at);\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0108.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/replay-media-delivery-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      patch(mirror, CI, GROUP_STEP,
        '      - {name: Verify a later reviewed Replay media delivery slice, run: npm run verify:replay-media-delivery:integration}\n' + GROUP_STEP);
      const { ok, output } = runInMirror(mirror);
      assert.ok(ok,
        'a reviewed delivery receipt with a real storage handle and signed URL, an external-copy record with a '
        + 'recall column, a resolved analytical authority seam, a cleared CW2-08 seam, an additive column, an '
        + 'index and a new CI gate must all leave I-06D passing:\n' + output.slice(-2500));
    } finally {
      removeHarnessMirror(mirror);
    }
  });

test('the contracts are not vacuous: every deliberate weakening of I-06D is refused by at least one of them',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const regressions = [
      // --- 0106: the canonical source delegation is replaced by a local answer
      ['current source availability stops consuming the canonical I-06A currency', M106,
        '    SELECT c.currency_state, c.staleness_class INTO currency\n      FROM public.derive_replay_source_manifest_currency_v1(version.source_manifest_version_id) c;',
        "    SELECT 'CURRENT'::text, NULL::text INTO currency;"],
      ['an unavailable source is allowed to remain currently usable', M106,
        "  IF current_availability IS DISTINCT FROM 'CURRENT' THEN",
        "  IF false AND current_availability IS DISTINCT FROM 'CURRENT' THEN"],
      ['the analytical layer is allowed to stand in for the missing source layer', M106,
        "  analytical_layer := CASE\n    WHEN declared_points IS NOT NULL AND sealed_points = declared_points\n         AND EXISTS (SELECT 1 FROM public.replay_render_contract_versions rc\n                      WHERE rc.id = version.render_contract_version_id)\n    THEN 'SEALED_HISTORICAL_EVIDENCE'\n    ELSE 'SEALED_EVIDENCE_INCOMPLETE' END;",
        "  analytical_layer := 'ANALYTICAL_ONLY';"],
      ['the creator boundary composes the owner-scoped I-06B truth currency', M106,
        '  SELECT pv.point_count INTO declared_points\n    FROM public.replay_analytical_projection_versions pv\n   WHERE pv.id = version.analytical_projection_version_id;',
        '  SELECT CASE WHEN (SELECT t.currency_state\n                      FROM public.derive_replay_version_truth_currency_v1(p_replay_version_id) t)\n                   = \'CURRENT\' THEN 1 ELSE 0 END INTO declared_points;'],
      ['a source body column is added to the reconciliation persistence', M106,
        '    observed_availability_state text NOT NULL,\n    observed_at timestamptz NOT NULL,',
        '    observed_availability_state text NOT NULL,\n    captured_body_text text,\n    observed_at timestamptz NOT NULL,'],
      ['the source digest becomes the availability authority', M106,
        '  SELECT v.* INTO version FROM public.replay_versions v\n   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id;',
        '  SELECT v.* INTO version FROM public.replay_versions v\n     JOIN public.replay_source_manifest_items i ON i.captured_source_digest IS NOT NULL\n   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id;'],
      ['historical finalization becomes evidence that the source is still current', M106,
        '  SELECT v.* INTO version FROM public.replay_versions v\n   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id;',
        '  SELECT v.* INTO version FROM public.replay_versions v\n     JOIN public.replay_version_finalizations f ON f.replay_version_id = v.id\n   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id;'],
      ['the evidence relation stops binding the historically finalized version', M106,
        '    CONSTRAINT replay_source_availability_reconciliation_events_final_fk\n        FOREIGN KEY (replay_version_id, replay_id)\n        REFERENCES public.replay_version_finalizations (replay_version_id, replay_id) ON DELETE RESTRICT',
        '    CONSTRAINT replay_source_availability_reconciliation_events_final_fk\n        FOREIGN KEY (replay_id)\n        REFERENCES public.replays (id) ON DELETE RESTRICT'],
      ['the creator boundary leaks the private staleness cause', M106,
        "                        source_layer, analytical_layer, 'SOURCE_NOT_CURRENTLY_AVAILABLE'::text;",
        "                        source_layer, analytical_layer, 'SOURCE_ACCESS_LOST'::text;"],
      ['the availability derivation stops being append-only-safe and writes', M106,
        "  RETURN QUERY SELECT 'NOT_CURRENT'::text, currency.staleness_class;",
        "  INSERT INTO public.replay_source_availability_reconciliation_events\n    (id, replay_id, replay_version_id, source_manifest_version_id, observed_availability_state, observed_at)\n  VALUES (gen_random_uuid(), p_replay_id, p_replay_version_id, version.source_manifest_version_id, 'NOT_CURRENT', clock_timestamp());\n  RETURN QUERY SELECT 'NOT_CURRENT'::text, currency.staleness_class;"],

      // --- 0107: current eligibility stops re-evaluating what it must
      ['a stale source stops blocking future use of an old authorization', M107,
        "  IF current_availability IS DISTINCT FROM 'CURRENT' THEN\n    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'SOURCE_NOT_CURRENT'::text; RETURN;\n  END IF;",
        '  IF false THEN RETURN; END IF;'],
      ['a withdrawn approval becomes effective again', M107,
        "  IF EXISTS (SELECT 1 FROM public.derive_replay_distribution_effective_approvals_v1(package.id) s\n              WHERE s.effective_state IS DISTINCT FROM 'EFFECTIVE') THEN\n    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'APPROVAL_NOT_EFFECTIVE'::text; RETURN;\n  END IF;",
        '  IF false THEN RETURN; END IF;'],
      ['a superseded authority fingerprint stops blocking future use', M107,
        "  IF stored IS DISTINCT FROM derived.required_approvers\n     OR derived.authority_fingerprint IS DISTINCT FROM package.authority_request_fingerprint\n     OR authorized.authority_request_fingerprint IS DISTINCT FROM derived.authority_fingerprint THEN",
        '  IF false THEN'],
      ['the unresolved analytical seam is reinterpreted as an empty requirement', M107,
        "    WHEN SQLSTATE '55000' THEN\n      RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'AUTHORITY_UNRESOLVED'::text; RETURN;",
        "    WHEN SQLSTATE '55000' THEN\n      derived := ROW('RESOLVED_NO_HUMAN_REQUIREMENT', ARRAY[]::uuid[], 0, package.authority_request_fingerprint);"],
      ['current eligibility starts claiming a delivery nobody performed', M107,
        "  RETURN QUERY SELECT 'ELIGIBLE_FOR_FUTURE_DELIVERY'::text, NULL::text;",
        "  RETURN QUERY SELECT 'DELIVERED'::text, NULL::text;"],
      ['the canonical Public visibility answer is bypassed on the Public destination', M107,
        '    SELECT v.visibility_state AS state, v.visible_manifest_version_id AS manifest INTO visible\n      FROM public.resolve_public_visibility_state_v1(bridge.public_experience_id) v;',
        "    SELECT 'PUBLICLY_VISIBLE'::text AS state, bridge.public_manifest_version_id AS manifest INTO visible;"],
      ['private Replay source loss is made to force Public disappearance', M107,
        "  IF current_availability IS DISTINCT FROM 'CURRENT' THEN\n    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'SOURCE_NOT_CURRENT'::text; RETURN;\n  END IF;",
        "  IF current_availability IS DISTINCT FROM 'CURRENT' THEN\n    PERFORM public.remove_public_experience_from_public_world_v1(gen_random_uuid(), bridge.public_experience_id, NULL);\n    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'SOURCE_NOT_CURRENT'::text; RETURN;\n  END IF;"],
      ['the creator boundary exposes the internal refusal class directly', M107,
        "      WHEN internal_class IN ('AUTHORITY_UNRESOLVED', 'AUTHORITY_SUPERSEDED',\n                              'APPROVAL_NOT_EFFECTIVE', 'EXPORT_SURFACE_SUPERSEDED')\n        THEN 'AUTHORITY_NO_LONGER_CURRENT'",
        "      WHEN internal_class = 'SOURCE_ACCESS_LOST' THEN 'SOURCE_ACCESS_LOST'"],
      ['reconciliation mutates the immutable package instead of refusing it', M107,
        "  RETURN QUERY SELECT 'REPLAY_POST_FINALIZATION_RECONCILED'::text, p_replay_id, p_replay_version_id,",
        "  UPDATE public.replay_distribution_package_versions SET required_approver_count = 0\n   WHERE id = p_distribution_package_version_id;\n  RETURN QUERY SELECT 'REPLAY_POST_FINALIZATION_RECONCILED'::text, p_replay_id, p_replay_version_id,"],
      ['the Replay lock stops coming first, inverting the source order', M107,
        '  SELECT r.* INTO replay FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE;',
        '  SELECT r.* INTO replay FROM public.replays r WHERE r.id = p_replay_id;'],
      ['reconciliation takes the Public rows FOR UPDATE and starts owning Public truth', M107,
        '      PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR SHARE;',
        '      PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;'],
      ['the command identity stops binding the exact package it was given', M107,
        "   || 'package=' || coalesce(lower(p_distribution_package_version_id::text), 'NONE') || E'\\n'",
        "   || 'package=NONE' || E'\\n'"],
      ['the retry answers from what it was handed instead of what was committed', M107,
        '    RETURN QUERY SELECT \'ALREADY_COMMITTED\'::text, committed.replay_id, committed.replay_version_id,\n                        committed.distribution_package_version_id,\n                        committed.committed_availability_state, committed.committed_eligibility_state,\n                        committed.committed_at;\n    RETURN;\n  END IF;\n\n  -- CANONICAL LOCK ORDER, STEP 1',
        '    RETURN QUERY SELECT \'ALREADY_COMMITTED\'::text, p_replay_id, p_replay_version_id,\n                        p_distribution_package_version_id,\n                        committed.committed_availability_state, committed.committed_eligibility_state,\n                        committed.committed_at;\n    RETURN;\n  END IF;\n\n  -- CANONICAL LOCK ORDER, STEP 1'],
      ['the reconciliation evidence stops binding its exact package as one row', M107,
        '    CONSTRAINT replay_distribution_reconciliation_events_target_fk\n        FOREIGN KEY (distribution_package_version_id, replay_id, replay_version_id)\n        REFERENCES public.replay_distribution_package_versions (id, replay_id, replay_version_id)\n        ON DELETE RESTRICT',
        '    CONSTRAINT replay_distribution_reconciliation_events_target_fk\n        FOREIGN KEY (distribution_package_version_id)\n        REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT'],
      ['a delivery receipt column appears on the reconciliation evidence', M107,
        '    observed_refusal_class text,\n    observed_at timestamptz NOT NULL,',
        '    observed_refusal_class text,\n    delivered_at timestamptz,\n    observed_at timestamptz NOT NULL,'],
      ['an external copy is claimed recalled', M107,
        '    observed_refusal_class text,\n    observed_at timestamptz NOT NULL,',
        '    observed_refusal_class text,\n    external_copy_recalled boolean,\n    observed_at timestamptz NOT NULL,'],
      ['the typed command becomes a generic untyped bus', M107,
        "    CONSTRAINT replay_reconciliation_commands_purpose_check\n        CHECK (reconciliation_purpose IN ('SOURCE_AVAILABILITY',\n                                          'SOURCE_AVAILABILITY_AND_DISTRIBUTION')),",
        '    CONSTRAINT replay_reconciliation_commands_purpose_check\n        CHECK (reconciliation_purpose IS NOT NULL),'],
      ['current truth starts consulting the reconciliation evidence it wrote', M107,
        '  SELECT z.* INTO authorized FROM public.replay_distribution_authorizations z\n   WHERE z.distribution_package_version_id = package.id;',
        "  IF EXISTS (SELECT 1 FROM public.replay_distribution_reconciliation_events e\n              WHERE e.distribution_package_version_id = package.id\n                AND e.observed_eligibility_state = 'ELIGIBLE_FOR_FUTURE_DELIVERY') THEN\n    RETURN QUERY SELECT 'ELIGIBLE_FOR_FUTURE_DELIVERY'::text, NULL::text; RETURN;\n  END IF;\n  SELECT z.* INTO authorized FROM public.replay_distribution_authorizations z\n   WHERE z.distribution_package_version_id = package.id;"],
      ['the additive candidate key stops being trivially unique', M107,
        'ALTER TABLE public.replay_distribution_package_versions\n  ADD CONSTRAINT replay_distribution_package_versions_target_key\n  UNIQUE (id, replay_id, replay_version_id);',
        'ALTER TABLE public.replay_distribution_package_versions\n  ADD CONSTRAINT replay_distribution_package_versions_target_key\n  UNIQUE (replay_id, replay_version_id);'],
      ['an I-06D relation stops being append-only', M107,
        'CREATE TRIGGER replay_reconciliation_commands_immutable\n  BEFORE UPDATE OR DELETE ON public.replay_reconciliation_commands\n  FOR EACH ROW EXECUTE FUNCTION public.reject_replay_post_finalization_mutation_v1();',
        ''],
      ['an I-06D relation opens to an application role', M107,
        "REVOKE ALL ON TABLE public.replay_distribution_reconciliation_events,\n                    public.replay_reconciliation_commands\n  FROM PUBLIC, anon, authenticated;",
        'GRANT SELECT ON TABLE public.replay_distribution_reconciliation_events TO authenticated;'],

      // --- the registration a reviewer would otherwise have to notice by eye
      ['the focused selector for the slice is removed', 'database/focused-verifiers.json',
        '"i06d-all"', '"i06d-removed"'],
      ['the I-06D CI group stops running one of its verifiers', CI,
        `if npm run ${OWN_SCRIPT}; then result_0107=PASS; else status=1; fi`,
        'result_0107=PASS'],
    ];
    // Every regression is run and the failures are reported TOGETHER. Failing at
    // the first one turns a set of findings into one, and costs a whole run per
    // finding - the same reason the real-PostgreSQL verifiers aggregate.
    const survived = [];
    for (const [label, file, from, to] of regressions) {
      const mirror = buildMirror();
      try {
        patch(mirror, file, from, to);
        if (runInMirror(mirror).ok) survived.push(label);
      } finally {
        removeHarnessMirror(mirror);
      }
    }
    assert.deepEqual(survived, [],
      `NO I-06D contract refused ${survived.length} regression(s):\n  - ${survived.join('\n  - ')}`);
  });
