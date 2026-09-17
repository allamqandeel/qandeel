// I-06D - Post-finalization source availability and current complete-Replay
// usability: the secret-free structural contract for migration 0106.
//
// Live semantics - what a stale source refuses, what the creator is told, the
// race matrix - are proven by database/verify-migration-0106.mjs and
// database/verify-migration-0107.mjs against real PostgreSQL. What is proven
// HERE is the structure a migration must already have before it deploys: that a
// historical FINALIZATION and a CURRENT source answer are two different things
// and neither is computed from the other; that current source availability is
// DELEGATED whole to the one canonical I-06A derivation rather than re-derived;
// that a captured digest is never treated as evidence that the source still
// exists; that the source-content-bearing layer and the analytical visual layer
// have distinct consequences and neither may stand in for the other; that the
// evidence relation carries classification and an instant and no source content
// of any kind; and that nothing in this slice rewrites, repairs or re-composes
// an immutable Replay Version.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0106_replay_post_finalization_source_availability_v1.sql';
const PREDECESSOR_NAME = '0105_replay_distribution_runtime_export_public_bridge_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0106.mjs');
const support = read('../replay-closure-verifier-support.mjs');
const readme = read('../README.md');
const doc = read('../../docs/replay-runtime-v1.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const focused = read('../focused-verifiers.json');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const OWN_TABLES = ['replay_source_availability_reconciliation_events'];
const AVAILABILITY = 'derive_replay_version_current_availability_v1';
const USABILITY = 'resolve_replay_version_current_usability_v1';
const GUARD = 'reject_replay_post_finalization_mutation_v1';
const CANONICAL_CURRENCY = 'derive_replay_source_manifest_currency_v1';
const CANONICAL_TRUTH = 'derive_replay_version_truth_currency_v1';
const OWN_SCRIPT = 'verify:replay-post-finalization-source-availability:integration';
const PART_B_SCRIPT = 'verify:replay-distribution-reconciliation-closure:integration';

/** The body of one function this migration declares, as PostgreSQL would store it. */
const bodyOf = (name) => {
  const start = executableSql.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `0106 declares ${name}`);
  const open = executableSql.indexOf('AS $$', start);
  const close = executableSql.indexOf('$$;', open + 5);
  return executableSql.slice(open + 'AS $$'.length, close);
};
const tableBlock = (table) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(start >= 0, `0106 creates ${table}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};
const columnsOf = (table) => [...tableBlock(table).matchAll(/^\s{4}(\w+)\s+(uuid|text|integer|bigint|boolean|timestamptz|jsonb|json|bytea)\b/gmu)]
  .map((m) => ({ name: m[1], type: m[2] }));

test('0106 is the forward migration after 0105, the frozen I-06C predecessors are byte-identical, and nothing is rewritten', async () => {
  const { I06C_FROZEN } = await import('./replay-closure-frozen-predecessors.mjs');
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0106_')).length, 1, 'exactly one migration carries the 0106 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf(PREDECESSOR_NAME));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of I06C_FROZEN) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu,
    '0106 drops nothing');
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE FUNCTION/u,
    '0106 replaces no predecessor function: the canonical source currency, the canonical Replay Version truth currency and the canonical Public visibility resolver are consumed, never rewritten');
  for (const [, created] of executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(created), `0106 creates only its own relation, not ${created}`);
  }
  // 0106 TOUCHES NO PREDECESSOR RELATION AT ALL, not even to add a key.
  for (const match of executableSql.matchAll(/ALTER TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(match[1]), `0106 alters no predecessor relation, not ${match[1]}`);
  }
});

test('a Replay is not a World, and observing one changes no ontology', () => {
  const block = tableBlock(OWN_TABLES[0]);
  for (const forbidden of ['world_type', 'membership', 'governance', 'lifecycle', 'coordinate',
    'embedding', 'vitality', 'ranking', 'episode', 'proposal']) {
    assert.ok(!block.includes(forbidden), `the evidence relation may not carry ${forbidden}`);
  }
  assert.ok(selfAssertions.includes('a Replay is a source-bound artifact, never a World'),
    'and the migration refuses to deploy if one ever appears');
});

test('a historical FINALIZATION and a CURRENT source answer are two different facts', () => {
  const block = tableBlock(OWN_TABLES[0]);
  // The observation binds the HISTORICAL evidence, through the append-only
  // relation rather than through `replays.current_lifecycle`, which I-06B
  // legitimately moves back to DRAFT without erasing it.
  assert.match(block, /REFERENCES public\.replay_version_finalizations \(replay_version_id, replay_id\)/u,
    'an observation names a version that was HISTORICALLY finalized');
  assert.match(block, /REFERENCES public\.replay_versions \(id, replay_id, source_manifest_version_id\)/u,
    'and the exact version, its Replay and that version own manifest as ONE row');
  assert.ok(!block.includes('current_lifecycle'),
    'and never consults the stable Replay CURRENT lifecycle to decide anything');

  // The CURRENT answer is derived, never stored on the historical row.
  const availability = bodyOf(AVAILABILITY);
  assert.ok(!availability.includes('replay_version_finalizations'),
    'historical finalization is never evidence that the source is still current');
  assert.ok(availability.includes(`public.${CANONICAL_CURRENCY}`),
    'and the current answer comes from the ONE canonical I-06A source-currency derivation');
});

test('current source availability is DELEGATED whole and re-derives nothing', () => {
  const availability = bodyOf(AVAILABILITY);
  assert.ok(availability.includes(`public.${CANONICAL_CURRENCY}(version.source_manifest_version_id)`),
    'the delegation names the exact manifest the immutable version binds');
  for (const forbidden of ['conversation_units', 'shared_world_materials', 'shared_world_history_items',
    'publication_package_manifest_items', 'encode(sha256', 'captured_source_digest']) {
    assert.ok(!availability.includes(forbidden),
      `a second source-currency evaluator is exactly what this slice may not write: ${forbidden} must not appear`);
  }
  // THREE BOUNDED ANSWERS, and a contradiction is not merely "not current".
  for (const state of ['CURRENT', 'NOT_CURRENT', 'CONTRADICTORY']) {
    assert.ok(availability.includes(`'${state}'`), `the derivation can answer ${state}`);
  }
  assert.match(tableBlock(OWN_TABLES[0]),
    /CHECK \(observed_availability_state IN \('CURRENT', 'NOT_CURRENT', 'CONTRADICTORY'\)\)/u,
    'and the evidence can spell those three and nothing else');
  // IT IS TOTAL: a canonical derivation that raises is answered closed rather
  // than propagated as something a caller could read.
  assert.match(availability, /EXCEPTION WHEN OTHERS THEN\s*\n\s*RETURN QUERY SELECT 'CONTRADICTORY'/u,
    'an unreadable canonical answer fails closed');
});

test('a captured digest is never evidence that the source still exists', () => {
  // The manifest keeps its digest forever - that is I-06A's immutable record of
  // what the source WAS. What this slice may never do is read one and conclude
  // that the source still IS.
  const availability = bodyOf(AVAILABILITY);
  assert.ok(!/digest/iu.test(availability),
    'the availability derivation names no digest at all');
  for (const { name } of columnsOf(OWN_TABLES[0])) {
    assert.doesNotMatch(name, /digest|fingerprint|checksum|hash/u,
      `the evidence relation may not carry ${name}: a digest is not an availability`);
  }
  assert.ok(selfAssertions.includes('recompute no digest of its own'),
    'and the migration refuses to deploy if the derivation grows one');
});

test('the source-content-bearing layer and the analytical visual layer stay distinct', () => {
  const usability = bodyOf(USABILITY);
  // BOTH layers are answered on every row, including the refusals. That is what
  // makes CW2-05 section 32 operational rather than decorative.
  for (const state of ['DEREFERENCEABLE', 'NOT_DEREFERENCEABLE', 'SEALED_HISTORICAL_EVIDENCE']) {
    assert.ok(usability.includes(state), `the boundary answers ${state}`);
  }
  // The source layer follows the SOURCE and the analytical layer follows the
  // ANALYTICAL truth: neither is computed from the other.
  assert.match(usability, /source_layer := CASE WHEN current_availability = 'CURRENT'/u,
    'the source layer follows current source availability alone');
  assert.match(usability, /analytical_layer := CASE WHEN truth_state = 'CURRENT'/u,
    'and the analytical layer follows the canonical I-06B truth currency alone');
  assert.ok(usability.includes(`public.${CANONICAL_TRUTH}`),
    'which is consumed rather than re-derived');
  // AND THERE IS NO STATE IN WHICH ONE STANDS IN FOR THE OTHER.
  for (const forbidden of ['ANALYTICAL_ONLY', 'ANALYTICAL_FALLBACK', 'ANALYTICAL_SUBSTITUTE',
    'PARTIAL_REPLAY', 'DEGRADED_REPLAY']) {
    assert.ok(!usability.includes(forbidden),
      `an analytical-only rendering may never be represented as the complete Replay it is not: ${forbidden}`);
  }
  assert.ok(selfAssertions.includes('an analytical-only rendering may never be represented as the complete Replay it is not'),
    'and the migration refuses to deploy if one is introduced');
});

test('a complete Replay fails CLOSED, in order, and the source gate is unconditional', () => {
  const usability = bodyOf(USABILITY);
  const finalization = usability.indexOf('REPLAY_VERSION_NOT_FINALIZED');
  const contradiction = usability.indexOf('SOURCE_STATE_CONTRADICTORY');
  const source = usability.indexOf('SOURCE_NOT_CURRENTLY_AVAILABLE');
  const analytical = usability.indexOf('ANALYTICAL_TRUTH_DIVERGED');
  const usable = usability.indexOf('COMPLETE_REPLAY_CURRENTLY_USABLE');
  assert.ok(finalization > 0 && contradiction > finalization && source > contradiction
    && analytical > source && usable > analytical,
  'historical finalization, then the source, then the analytical truth, and only then usable');
  // The source gate is tested against the availability answer and nothing else:
  // an analytical clause in that condition is the stand-in defect.
  assert.match(usability, /IF current_availability IS DISTINCT FROM 'CURRENT' THEN/u,
    'the source gate is unconditional');
});

test('the creator boundary is creator-exact, bounded, and no existence oracle', () => {
  const usability = bodyOf(USABILITY);
  assert.ok(usability.includes('r.created_by_user_id = p_user_id'),
    'the exact creator, and nobody else');
  assert.match(usability, /IF NOT FOUND THEN\s*\n\s*RETURN;\s*\n\s*END IF;/u,
    'and everyone else receives ZERO ROWS rather than a distinguishable refusal');
  // The private I-06A staleness vocabulary never crosses the boundary.
  for (const forbidden of ['SOURCE_UNAVAILABLE', 'SOURCE_ACCESS_LOST', 'SOURCE_VERSION_NOT_CURRENT',
    'SOURCE_CHANGED', 'PROJECTION_MOVED', 'CUT_UNSAFE', 'RENDER_CONTRACT_MOVED']) {
    assert.ok(!usability.includes(forbidden),
      `the creator receives a bounded actionable class, never the private cause ${forbidden}`);
  }
  // The result columns name nothing private either.
  const declared = /RETURNS TABLE\(([\s\S]*?)\)\nLANGUAGE plpgsql/u
    .exec(executableSql.slice(executableSql.indexOf(`CREATE FUNCTION public.${USABILITY}(`)));
  assert.ok(declared, 'the boundary declares result columns');
  for (const column of [...declared[1].matchAll(/(\w+)\s+(?:text|uuid|integer|timestamptz)/gu)].map((m) => m[1])) {
    assert.doesNotMatch(column,
      /session|turn|conversation_unit|world|shared_|material|history_item|manifest|selection|render_contract|experience|approver|user_id|digest|fingerprint|provenance|staleness|availability_state/u,
      `the boundary must not return ${column}`);
  }
});

test('nothing repairs, trims or re-composes an immutable Replay Version', () => {
  for (const name of [AVAILABILITY, USABILITY]) {
    const body = bodyOf(name);
    for (const forbidden of ['INSERT INTO', 'UPDATE public.', 'DELETE FROM', 'ALTER TABLE', 'TRUNCATE']) {
      assert.ok(!body.includes(forbidden),
        `${name} answers a question and writes nothing: ${forbidden} must not appear`);
    }
    for (const forbidden of ['FOR UPDATE', 'FOR SHARE', 'pg_advisory', 'LOCK TABLE']) {
      assert.ok(!body.includes(forbidden),
        `${name} is a STABLE derivation and takes no lock: ${forbidden} must not appear`);
    }
  }
  assert.ok(selfAssertions.includes('source loss never repairs an immutable Replay Version'),
    'and the migration refuses to deploy if either grows a write');
});

test('the evidence relation is append-only, sealed, and carries no source content', () => {
  const block = tableBlock(OWN_TABLES[0]);
  assert.match(installedSql,
    new RegExp(`CREATE TRIGGER ${OWN_TABLES[0]}_immutable\\s*\\n\\s*BEFORE UPDATE OR DELETE ON public\\.${OWN_TABLES[0]}`, 'u'),
    'append-only for every role including its owner');
  assert.match(installedSql, new RegExp(`ALTER TABLE public\\.${OWN_TABLES[0]} ENABLE ROW LEVEL SECURITY`, 'u'));
  assert.ok(!installedSql.includes('CREATE POLICY'), 'with zero policies');
  assert.match(installedSql, new RegExp(`REVOKE ALL ON TABLE public\\.${OWN_TABLES[0]}\\s*\\n?\\s*FROM PUBLIC, anon, authenticated`, 'u'));
  assert.ok(installedSql.includes(`REVOKE ALL ON TABLE public.${OWN_TABLES[0]} FROM service_role`),
    'and from the service tier too');

  // A POSITIVE ALLOWLIST: exactly these columns, and every one of them is an
  // identity, a bounded classification or the database's own instant.
  assert.deepEqual(columnsOf(OWN_TABLES[0]).map((c) => c.name),
    ['id', 'replay_id', 'replay_version_id', 'source_manifest_version_id',
      'observed_availability_state', 'observed_at'],
    'the evidence relation carries exactly its bounded surface');
  for (const { name, type } of columnsOf(OWN_TABLES[0])) {
    assert.ok(!['json', 'jsonb', 'bytea'].includes(type), `${name} may not be an untyped payload column`);
    assert.doesNotMatch(name,
      /body|text|transcript|audio|content|payload|url|uri|path|object_key|bucket|storage|reason|explanation|note|message|staleness|provenance/u,
      `source loss never authorizes a copy: ${name} may not exist`);
  }
  assert.ok(block.includes('ON DELETE RESTRICT'), 'and every binding is restrictive');
  assert.ok(!block.includes('ON DELETE CASCADE'), 'never cascading truth away');
});

test('0106 invents no media, storage, transport, delivery or external recall', () => {
  for (const forbidden of ['codec', 'bitrate', 'frame_rate', 'cdn', 'watermark', 'drm', 'encoder',
    'object_key', 'bucket', 'signed_url', 'download_url', 'RECALLED', 'DELIVERED', 'recipient']) {
    assert.ok(!installedSql.includes(forbidden),
      `CW2-05 defers all of it and guarantees no recall: ${forbidden} must not appear`);
  }
  // The BANS are scoped to this migration's own relations, so a later reviewed
  // media or transport boundary is not made impossible anywhere else.
  assert.ok(selfAssertions.includes('never a ceiling on 0107 or on\n--    any later reviewed work')
    || migration.includes('never a ceiling on 0107 or on'),
  'and the self-assertions say so in their own words');
  assert.match(selfAssertions, /FOREACH t IN ARRAY own_tables LOOP/u,
    'every column ban is applied to own_tables and to nothing else');
});

test('the frozen truths 0106 consumes are asserted intact, and neither seam is weakened', () => {
  for (const frozen of ['derive_replay_source_manifest_currency_v1', 'derive_replay_version_truth_currency_v1',
    'replay_lock_source_manifest_v1', 'resolve_public_visibility_state_v1']) {
    assert.ok(selfAssertions.includes(frozen), `0106 asserts the frozen predecessor ${frozen} still exists`);
  }
  assert.ok(selfAssertions.includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'),
    'the analytical subject-authority seam must still answer UNRESOLVED');
  assert.ok(selfAssertions.includes('NOT_EVALUATED'),
    'and the CW2-08 prerequisite seam must still answer NOT_EVALUATED');
  assert.ok(selfAssertions.includes('I-06D writes no second Public visibility authority'),
    'and the canonical Public visibility resolver is consumed, never duplicated');
});

test('the internal derivation is sealed and the creator boundary is service-tier only', () => {
  assert.ok(installedSql.includes(`REVOKE ALL ON FUNCTION public.${AVAILABILITY}(uuid, uuid) FROM PUBLIC`));
  assert.ok(installedSql.includes(`REVOKE ALL ON FUNCTION public.${USABILITY}(uuid, uuid, uuid) FROM PUBLIC`));
  assert.match(installedSql, /GRANT EXECUTE ON FUNCTION %s TO service_role/u,
    'and exactly one boundary is granted to the service tier');
  assert.ok(installedSql.includes(`'public.${AVAILABILITY}(uuid, uuid)'`)
    && installedSql.includes(`'public.${GUARD}()'`),
  'the internal derivation and the guard are in the sealed list');
  assert.ok(installedSql.includes(`boundary text := 'public.${USABILITY}(uuid, uuid, uuid)'`),
    'and the creator boundary is the only granted one');
  for (const name of [AVAILABILITY, USABILITY]) {
    assert.match(executableSql,
      new RegExp(`CREATE FUNCTION public\\.${name}\\([\\s\\S]{0,400}?LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''`, 'u'),
      `${name} is SECURITY DEFINER, STABLE and search_path-pinned`);
  }
});

test('no human principal and no verdict is ever a trusted parameter', () => {
  for (const name of [AVAILABILITY, USABILITY]) {
    const signature = executableSql.slice(executableSql.indexOf(`CREATE FUNCTION public.${name}(`));
    const parameters = /\(([\s\S]*?)\)\s*RETURNS/u.exec(signature)[1];
    for (const parameter of [...parameters.matchAll(/(p_\w+)/gu)].map((m) => m[1])) {
      assert.doesNotMatch(parameter,
        /actor|creator_user|owner_user|approver|currency|staleness|availability_state|usability|authority|safety|entitlement|launch|clearance/u,
        `${name} accepts no caller-authored principal or verdict: ${parameter}`);
    }
  }
  assert.ok(selfAssertions.includes('accepts no caller-authored principal state or verdict'),
    'and the migration refuses to deploy if one is added');
});

test('0106 is registered in the toolchain, the focused gate, the I-06D CI group, the README and the phase document', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0106\\.mjs"`, 'u'));
  assert.match(readme, /0106_replay_post_finalization_source_availability_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README records the verifier command');
  assert.match(verifier, /verifier for migration 0106/iu);

  // THE FOCUSED GATE, in migration order, so full API CI is never the debugger.
  const groups = JSON.parse(focused).groups;
  assert.ok(groups['i06d-0106'], 'the focused gate can select 0106 alone');
  assert.deepEqual(groups['i06d-all'].verifiers,
    ['database/verify-migration-0106.mjs', 'database/verify-migration-0107.mjs']);

  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0106=PASS; else status=1; fi`));
  assert.ok(workflow.includes(`if npm run ${PART_B_SCRIPT}; then result_0107=PASS; else status=1; fi`),
    'both I-06D verifiers run in ONE reported group, so a failure in 0106 cannot skip 0107');
  const step = workflow.slice(workflow.indexOf('- name: Verify the two I-06D Replay post-finalization'));
  assert.ok(step.includes('exit "$status"'), 'and the group fails at the end if either failed');
  assert.ok(workflow.includes('if npm run verify:replay-distribution-package-authority:integration; then result_0104=PASS'),
    'the predecessor I-06C group is not removed');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);

  // The phase document tells the truth about where I-06 stands.
  assert.ok(doc.includes('I-06') && doc.includes('ACTIVE'), 'the phase document records I-06 as ACTIVE');
  assert.ok(doc.includes('I-06D') && doc.includes('CANDIDATE'),
    'and I-06D as a candidate awaiting independent review');
  assert.doesNotMatch(doc, /^\s*`?I-06`?\s+(?:is\s+)?(?:CLOSED|FROZEN)/mu, 'and never claims I-06 is closed');
});

test('the 0106 verifier RUNS the scenarios it claims, through the permanent aggregator', () => {
  for (const scenario of [
    'S02 a source-current finalized version is a complete Replay, currently usable',
    'S01 S03 S05 S07 an unavailable source leaves every immutable row untouched',
    'S04 S06 a source that CHANGED is not current, and its captured digest proves nothing',
    'S12 source currentness RECOVERS when the exact source returns',
    'S08 a NEW Replay Version cannot be built over the unavailable source',
    'S09 S10 the creator boundary is creator-exact and no existence oracle',
    'S11 a Replay Version that was never finalized is not a complete Replay',
    'S16 the evidence relation is append-only for every role including its owner',
    'S14 no application role reaches the derivation, the boundary table or the guard',
    'S13 the availability derivation DELEGATES rather than re-deriving',
    'f4 the append-only guard is what refuses a mutation by the table owner',
    'f1 replacing the canonical delegation with a permissive constant is caught',
    'f2 f3 an unavailable source that stays usable, and an analytical stand-in, are both caught',
    'f5 a later reviewed slice may add relations, a column and an index',
  ]) {
    assert.ok(verifier.includes(`'${scenario}'`), `the verifier runs ${scenario}`);
  }
  assert.ok(verifier.includes('report.assertAllPassed()'),
    'and the run fails ONCE at the end naming every scenario that failed');
  assert.ok(verifier.includes('every fixture this verifier created was rolled back or removed'),
    'and proves it left no residue');
});

test('the verifier support simulates a seam rather than weakening one, and proves it back', () => {
  assert.ok(support.includes('I-06D VERIFIER PROBE'), 'every simulated answer says it is a probe');
  assert.ok(verifier.includes('rt.restoreSeamDefinition(currency)'),
    'and the canonical source currency is restored through the helper that compares the body');
  assert.ok(verifier.includes('the production I-06A source-currency derivation is exactly what it was'),
    'and the run proves the production body back byte for byte');
  // The source surgery is FIXTURE surgery, never a weakened derivation: a stale
  // source in these proofs is a source that really moved.
  assert.ok(support.includes("SET LOCAL session_replication_role = 'replica'"),
    'the surgery stands the triggers aside exactly as the frozen 0072 helper does');
  assert.ok(support.includes('ON DELETE RESTRICT, so the database refuses to'),
    'and the support records WHY a hard delete is not among the reachable shapes');
});
