// I-06C - Replay Distribution Runtime, Export Privacy Sanitization and the
// Public REPLAY_ARTIFACT bridge: the secret-free structural contract for
// migration 0105.
//
// Live semantics are proven by database/verify-migration-0104.mjs and
// database/verify-migration-0105.mjs against real PostgreSQL. What is proven
// HERE is the structure a migration must already have before it deploys: that
// BOTH fail-closed seams are honest about being unimplemented; that the required
// approver set is DERIVED from canonical truth and never from membership or a
// caller; that the authority fingerprint is derived in ONE place and binds every
// truth that makes a consent specific; that the sanitizer reads no source and
// produces no private identity; that the canonical Public authority derivation
// is EXTENDED additively rather than duplicated and closes the reserved branch in
// both directions; that ONE human consent act writes both immutable evidence
// rows; that Replay is always the first lock and the CW2-08 prerequisite is
// always the last gate; and that no transport is fabricated anywhere.
//
// ## The self-assertion simulator
//
// Both migrations refuse to deploy unless a long list of regular expressions
// holds of their OWN function bodies. On a host with no PostgreSQL that list is
// unverifiable until CI runs it, and it has two silent failure modes that look
// identical from the outside: an anchor that matches NOTHING (so the invariant is
// never actually checked) and a ban that matches the migration's own PROSE (so
// the migration refuses itself at deploy). `simulateSelfAssertions` evaluates
// every one of them against the bodies the migration actually declares, and
// reports both.
//
// ## Why the slice-wide probe lives in this file and not in both
//
// A mirror-based probe is expensive. The probe at the end mirrors once and runs
// BOTH I-06C contracts against a mutated tree, so the property each must have -
// this is a contract, not a ceiling on the roadmap - is proven for both from one
// place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';
import { I06B_FROZEN } from './replay-distribution-frozen-predecessors.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
/** Set in the child runs of the probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I06C_REPLAY_DISTRIBUTION_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0105_replay_distribution_runtime_export_public_bridge_v1.sql';
const PART_A_NAME = '0104_replay_distribution_package_authority_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const partA = read(`../migrations/${PART_A_NAME}`);
const verifier = read('../verify-migration-0105.mjs');
const support = read('../replay-distribution-verifier-support.mjs');
const readme = read('../README.md');
const doc = read('../../docs/replay-runtime-v1.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const focused = read('../focused-verifiers.json');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const ANALYTICAL_SEAM = 'resolve_replay_analytical_distribution_authority_v1';
const PREREQUISITE_SEAM = 'resolve_replay_distribution_prerequisites_v1';
const DESCRIPTOR = 'derive_replay_export_descriptor_v1';
const FINGERPRINT = 'replay_distribution_authority_fingerprint_v1';
const APPROVERS = 'derive_replay_distribution_required_approvers_v1';
const AUTHORITY = 'derive_replay_distribution_authority_v1';
const BRIDGE = 'replay_prepare_public_distribution_artifact_v1';
const PREPARE = 'prepare_replay_distribution_package_v1';
const APPROVE = 'approve_replay_distribution_v1';
const WITHDRAW = 'withdraw_replay_distribution_approval_v1';
const AUTHORIZE = 'authorize_replay_distribution_v1';
const PACKAGE_RESOLVER = 'resolve_replay_distribution_package_v1';
const PUBLIC_RESOLVER = 'resolve_public_replay_artifact_v1';
const PUBLIC_AUTHORITY = 'derive_public_publication_authority_v1';
const HUMAN = [PREPARE, APPROVE, WITHDRAW, AUTHORIZE];
const OWN_TABLES = ['replay_distribution_prepare_commands', 'replay_distribution_withdrawal_commands',
  'replay_distribution_authorization_commands'];
const OWN_SCRIPT = 'verify:replay-distribution-runtime-export-public-bridge:integration';
const PART_A_SCRIPT = 'verify:replay-distribution-package-authority:integration';

/** Every function one migration declares, by name, with its body. */
function declaredFunctions(source) {
  const bodies = new Map();
  for (const match of source.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)\(/gu)) {
    const open = source.indexOf('AS $$', match.index);
    if (open < 0) continue;
    const end = source.indexOf('$$;', open + 5);
    bodies.set(match[1], source.slice(open + 'AS $$'.length, end < 0 ? undefined : end));
  }
  return bodies;
}
const bodies = declaredFunctions(migration);
const bodyOf = (name) => {
  const body = bodies.get(name);
  assert.ok(body !== undefined, `the migration declares ${name}`);
  return body;
};
const signatureOf = (name) => {
  const start = migration.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `the migration declares ${name}`);
  let depth = 1; let i = start + `FUNCTION public.${name}(`.length;
  while (i < migration.length && depth > 0) {
    if (migration[i] === '(') depth += 1; else if (migration[i] === ')') depth -= 1;
    i += 1;
  }
  return migration.slice(start + `FUNCTION public.${name}(`.length, i - 1);
};
const inputParameters = (name) => [...signatureOf(name)
  .matchAll(/(p_\w+)\s+(?:uuid\[\]|text\[\]|integer\[\]|uuid|text|integer|bigint|boolean|timestamptz|jsonb)/gu)]
  .map((m) => m[1]);

/** A PostgreSQL single-quoted literal, unescaped. */
const unquote = (literal) => literal.slice(1, -1).replace(/''/gu, "'");

/**
 * Evaluates every `prosrc` regular expression a migration's self-assertion block
 * applies to its own functions, against the bodies it actually declares.
 *
 * Returns one finding per check that would behave differently in PostgreSQL than
 * the author intended: an `unmatched-anchor` whose pattern matches nothing in its
 * subject, so the invariant is never checked at all; or a `self-match` whose
 * banned shape matches its own subject, so the migration refuses ITSELF.
 */
export function simulateSelfAssertions(source) {
  const declared = declaredFunctions(source);
  const block = source.slice(source.lastIndexOf('DO $$\nDECLARE'));
  const findings = [];
  let evaluated = 0;

  const named = new Map();
  for (const match of block.matchAll(/(\w+)\s+text\s*:=\s*'public\.(\w+)\(/gu)) named.set(match[1], [match[2]]);
  const resolve = (expression) => {
    const names = [];
    for (const token of expression.split(/[\s,[\]|]+/u).filter(Boolean)) {
      if (token === 'ARRAY') continue;
      if (named.has(token)) names.push(...named.get(token));
      else if (/^'public\.(\w+)\(/u.test(token)) names.push(/^'public\.(\w+)\(/u.exec(token)[1]);
      else if (declared.has(token)) names.push(token);
      else return null;
    }
    return names.length > 0 ? names : null;
  };
  for (const match of block.matchAll(/^\s*(\w+)\s*:=\s*([^;']+);$/gmu)) {
    const names = resolve(match[2].replace(/^ARRAY\[|\]$/gu, ''));
    if (names) named.set(match[1], names);
  }
  const subjectOf = new Map();
  for (const match of block.matchAll(/WHERE pr\.oid = (\w+)::regprocedure/gu)) {
    subjectOf.set(match.index, named.get(match[1]) ?? null);
  }
  for (const match of block.matchAll(/p\.proname = '(\w+)'/gu)) {
    subjectOf.set(match.index, declared.has(match[1]) ? [match[1]] : null);
  }

  const stack = [];
  let current = null;
  let offset = 0;
  for (const line of block.split('\n')) {
    const start = offset;
    offset += line.length + 1;
    const loop = /FOREACH \w+ IN ARRAY (ARRAY\[[^\]]*\]|\w+) LOOP/u.exec(line);
    if (loop) { stack.push(resolve(loop[1].replace(/^ARRAY\[|\]$/gu, ''))); continue; }
    if (/END LOOP;/u.test(line)) { stack.pop(); continue; }
    for (const [at, subject] of subjectOf) {
      if (at >= start && at < offset) current = subject;
    }
    const scoped = [...stack].reverse().find((frame) => frame !== null) ?? current;
    if (!scoped) continue;
    for (const match of line.matchAll(/\bp(?:\.prosrc)?\s*(!~\*?|~\*?)\s*('(?:[^']|'')*')/gu)) {
      const [, operator, literal] = match;
      const pattern = new RegExp(unquote(literal), operator.endsWith('*') ? 'iu' : 'u');
      const required = operator.startsWith('!');
      evaluated += 1;
      for (const name of scoped) {
        const body = declared.get(name);
        if (body === undefined) continue;
        const matched = pattern.test(body);
        if (required && !matched) {
          findings.push({ kind: 'unmatched-anchor', fn: name, pattern: pattern.source,
            detail: 'the invariant this anchor checks is never actually checked, so a weakening would deploy' });
        }
        if (!required && matched) {
          findings.push({ kind: 'self-match', fn: name, pattern: pattern.source,
            detail: 'this migration refuses ITSELF at deploy: the banned shape matches its own text' });
        }
      }
    }
  }
  return { findings, evaluated };
}

// ---------------------------------------------------------------------------

test('0105 is the forward migration after 0104, the frozen I-06B predecessors are byte-identical, and only the canonical Public authority derivation is replaced', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0105_')).length, 1, 'exactly one migration carries the 0105 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf(PART_A_NAME));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of I06B_FROZEN) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu,
    '0105 drops nothing');
  for (const [, created] of executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(created), `0105 creates only its three command relations, not ${created}`);
  }
  for (const [, altered] of executableSql.matchAll(/ALTER TABLE (?:ONLY )?public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(altered), `0105 alters only its own command relations, not ${altered}`);
  }
  // EXACTLY ONE predecessor function is replaced, additively, through the
  // repository's canonical forward method - the 0098 precedent.
  const replaced = [...executableSql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(replaced, [PUBLIC_AUTHORITY],
    '0105 replaces the canonical Public authority derivation and nothing else');
});

test('BOTH I-06C migrations pass their own deploy-time self-assertions', () => {
  let total = 0;
  for (const [name, source] of [[PART_A_NAME, partA], [MIGRATION_NAME, migration]]) {
    const { findings, evaluated } = simulateSelfAssertions(source);
    total += evaluated;
    assert.deepEqual(findings, [],
      `${name} would not deploy:\n${findings.map((f) => `  ${f.kind}  ${f.fn}  /${f.pattern}/  ${f.detail}`).join('\n')}`);
  }
  // THE SIMULATOR'S OWN ANTI-VACUITY NUMBER. A simulator that resolved no subject
  // would report zero findings over zero checks and read exactly like a clean run.
  assert.ok(total >= 60, `the simulator must actually evaluate the checks; it evaluated ${total}`);
  // And it must FIND something in a tree where a required anchor no longer
  // matches, and in one where a ban matches the migration's own text.
  const anchorRemoved = migration.replace('u uuid := auth.uid();', 'u uuid := auth.uid( );');
  assert.ok(simulateSelfAssertions(anchorRemoved).findings.some((f) => f.kind === 'unmatched-anchor'),
    'the simulator catches an anchor that stopped matching');
  const selfBanned = migration.replace(
    "  IF p_analytical_projection_version_id IS NULL THEN",
    "  -- pg_advisory\n  IF p_analytical_projection_version_id IS NULL THEN");
  assert.ok(simulateSelfAssertions(selfBanned).findings.some((f) => f.kind === 'self-match'),
    'and a ban that matches the migration own text');
});

test('both fail-closed seams are honest about being unimplemented and manufacture nothing', () => {
  const analytical = bodyOf(ANALYTICAL_SEAM);
  assert.ok(analytical.includes('UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'),
    'the analytical seam answers the canonical unresolved state');
  assert.ok(!analytical.includes('RESOLVED_EXACT_HUMAN_REQUIREMENT')
    && !analytical.includes('RESOLVED_NO_HUMAN_REQUIREMENT'),
  'and never manufactures a resolved human requirement it cannot derive');
  assert.ok(analytical.includes('NULL::uuid[]'), 'it names no approver at all');
  const gate = bodyOf(PREREQUISITE_SEAM);
  assert.equal((gate.match(/NOT_EVALUATED/gu) ?? []).length, 6,
    'the CW2-08 seam answers NOT_EVALUATED on the clearance and on every one of the five dimensions');
  for (const positive of ['SAFETY_ALLOW', 'MODERATION_ALLOW', 'ENTITLED', 'FEATURE_ENABLED',
    'LAUNCH_CLEARED', "'CLEARED'"]) {
    assert.ok(!gate.includes(positive), `the CW2-08 seam never answers ${positive}`);
  }
  // Both are STABLE reads that decide nothing about the actor and write nothing.
  for (const name of [ANALYTICAL_SEAM, PREREQUISITE_SEAM]) {
    assert.match(migration, new RegExp(`FUNCTION public\\.${name}\\([\\s\\S]{0,400}?LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''`, 'u'),
      `${name} is a pinned SECURITY DEFINER STABLE read`);
    assert.ok(!bodyOf(name).includes('auth.uid()'), `${name} decides nothing about who is asking`);
    assert.ok(!bodyOf(name).includes('INSERT INTO'), `${name} writes nothing`);
  }
});

test('the required approver set is DERIVED from canonical truth, never from membership or a caller', () => {
  const body = bodyOf(APPROVERS);
  assert.ok(body.includes(`public.${ANALYTICAL_SEAM}`), 'the analytical half is delegated whole to the ONE seam');
  assert.ok(body.includes('REPLAY_DISTRIBUTION_ANALYTICAL_AUTHORITY_UNRESOLVED'),
    'and anything but a RESOLVED answer fails the derivation closed');
  assert.ok(body.includes("personal_source_role IS DISTINCT FROM 'USER'")
    && body.includes('REPLAY_DISTRIBUTION_SOURCE_AUTHORITY_UNRESOLVED'),
  'QANDEEL-authored Personal material fails closed exactly as the frozen Public preparation refuses it');
  assert.ok(body.includes('replay_selection_spec_items'),
    'authority follows the SELECTED segments, not everything the manifest captured');
  for (const forbidden of ['shared_world_membership_episodes', 'shared_world_history_access_grants',
    'shared_world_standing_context', 'public_experience_controllers']) {
    assert.ok(!body.includes(forbidden), `the derivation reads no ${forbidden}: membership is not distribution authority`);
  }
  // A contradictory analytical answer fails closed in BOTH directions.
  assert.ok(body.includes("analytical.resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'\n     AND coalesce(cardinality(analytical.required_approvers), 0) = 0"),
    'an exact requirement that names nobody is contradictory, never empty');
  assert.ok(body.includes("analytical.resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT'\n     AND coalesce(cardinality(analytical.required_approvers), 0) <> 0"),
    'and an empty requirement that names approvers is contradictory too');
});

test('the authority fingerprint is derived in ONE place and binds every truth that makes a consent specific', () => {
  const body = bodyOf(FINGERPRINT);
  for (const bound of ['action=', 'replay=', 'replayVersion=', 'package=', 'manifest=', 'selection=',
    'projection=', 'projectionDigest=', 'renderContract=', 'contractDigest=', 'sanitization=',
    'descriptorDigest=', 'sourceAuthority=', 'analyticalAuthority=', 'authorityState=',
    'requiredApprovers=', 'publicManifest=']) {
    assert.ok(body.includes(bound), `the fingerprint binds ${bound}`);
  }
  assert.match(migration, new RegExp(`FUNCTION public\\.${FINGERPRINT}\\([\\s\\S]{0,1400}?LANGUAGE sql IMMUTABLE`, 'u'),
    'it is IMMUTABLE, so one truth can never digest two ways');
  // It is DERIVED, never supplied: no human primitive accepts a fingerprint.
  for (const name of HUMAN) {
    for (const parameter of inputParameters(name)) {
      assert.doesNotMatch(parameter, /(fingerprint|authority|approver|digest|descriptor|sanitiz|actor|creator|owner|safety|moderation|entitle|launch|clearance|feature)/u,
        `${name} may not accept ${parameter}`);
    }
  }
  // And the ONE package derivation is what preparation, approval and the commit
  // all consume, so they cannot drift.
  for (const name of [PREPARE, APPROVE, AUTHORIZE]) {
    assert.ok(bodyOf(name).includes(`public.${AUTHORITY}`),
      `${name} consumes the ONE package authority derivation`);
  }
});

test('the sanitizer reads no source and produces no private identity', () => {
  const body = bodyOf(DESCRIPTOR);
  for (const forbidden of ['conversation_units', 'shared_world_', 'public_experience_text_derivative_bodies',
    'replay_source_manifest_items', 'audio_object_ref', 'transcript_text', 'body_text', 'committed_text',
    'publication_package_item_provenance']) {
    assert.ok(!body.includes(forbidden), `the sanitizer reads no ${forbidden}`);
  }
  assert.ok(body.includes('replay_selection_spec_versions') && body.includes('replay_render_contract_versions'),
    'it derives the audience-visible surface from the immutable selection spec and render contract');
  assert.ok(body.includes('replay_export_descriptor_digest_v1'),
    'and commits the digest of its own audience-visible surface');
  // THE DIGEST COVERS THE SANITIZED SURFACE AND NO INTERNAL IDENTITY.
  const digest = bodyOf('replay_export_descriptor_digest_v1');
  for (const internal of ['replay=', 'replayVersion=', 'manifest=', 'selection=', 'projection=', 'package=']) {
    assert.ok(!digest.includes(internal), `the exported descriptor digest covers no ${internal}`);
  }
  assert.ok(digest.includes('reference=') && digest.includes('destination='),
    'it does cover the opaque reference and the destination, so one surface cannot move to another');
});

test('the canonical Public authority derivation is extended additively and closes the reserved branch both ways', () => {
  const body = bodyOf(PUBLIC_AUTHORITY);
  // Every rule it already had.
  for (const kept of ['manifest.intended_publication_action', "availability_state <> 'AVAILABLE'",
    'availability_revision <> p.captured_availability_revision', 'captured_source_digest',
    'shared_world_material_historical_authority', 'shared_world_history_item_required_approvers',
    'personal_owner_user_id', 'authoritySnapshot=']) {
    assert.ok(body.includes(kept), `the extended derivation keeps: ${kept}`);
  }
  assert.ok(!body.includes('PREPARE_PUBLICATION'), 'a preparation command is never publication consent');
  // AND THE RESERVED BRANCH, CLOSED IN BOTH DIRECTIONS.
  assert.ok(body.includes("p.source_class = 'REPLAY_ARTIFACT'\n       AND NOT EXISTS (SELECT 1 FROM public.replay_public_distribution_artifacts"),
    'an unbridged REPLAY_ARTIFACT item fails closed rather than requiring nobody');
  assert.ok(body.includes('PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED'),
    'with the frozen class for exactly this situation');
  assert.ok(body.includes('replay_distribution_required_approvers'),
    'and a bridged one contributes the EXACT required set of its Replay distribution package');
  assert.ok(body.includes("'REPLAY_ARTIFACT:' || lower(a.distribution_package_version_id::text)"),
    'the source scope names the exact package and version, inside a one-way digest');
  // The signature and result columns are identical, so every frozen consumer
  // keeps compiling and keeps reading the same answer.
  assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${PUBLIC_AUTHORITY}\\(p_manifest_version_id uuid\\)\\nRETURNS TABLE\\(required_approvers uuid\\[\\], required_approver_count integer, authority_fingerprint text\\)`, 'u'));
  assert.ok(!body.includes('INSERT INTO') && !body.includes('UPDATE public') && !body.includes('DELETE FROM'),
    'and it still writes nothing');
});

test('ONE human consent act writes both immutable evidence rows and bypasses neither subsystem', () => {
  const body = bodyOf(APPROVE);
  assert.ok(body.includes('INSERT INTO public.replay_distribution_approvals'),
    'the Replay evidence row');
  assert.ok(body.includes('INSERT INTO public.publication_manifest_approvals'),
    'and the CANONICAL Public evidence row, in the same act');
  assert.ok(body.includes(`public.${PUBLIC_AUTHORITY}(bridge.public_manifest_version_id)`),
    'bound to the canonical Public authority fingerprint, never a fabricated one');
  assert.ok(body.includes('NOT (u = ANY(derived.required_approvers))'),
    'and a human the package does not require can never record a valid approval');
  assert.ok(!body.includes('INSERT INTO public.public_experience_controllers'),
    'approving grants no Experience control');
  // The Public bridge core writes the canonical Public package and nothing else.
  const bridge = bodyOf(BRIDGE);
  for (const written of ['publication_package_manifest_versions', 'public_experience_versions',
    'publication_package_manifest_items', 'publication_package_item_provenance',
    'publication_package_item_authority', 'publication_manifest_required_approvers',
    'replay_public_distribution_artifacts']) {
    assert.ok(bridge.includes(`INSERT INTO public.${written}`), `the bridge core writes ${written}`);
  }
  for (const forbidden of ['public_experience_controllers', 'publication_manifest_approvals',
    'public_experience_lifecycle_events', 'public_experience_publication_state']) {
    assert.ok(!bridge.includes(`INSERT INTO public.${forbidden}`),
      `the bridge core never writes ${forbidden}`);
  }
  assert.ok(!bridge.includes('SET current_lifecycle'), 'and moves no Public lifecycle at all');
  assert.ok(bridge.includes("'RESERVED'") && bridge.includes("'REPLAY_ARTIFACT'"),
    'it activates the reserved shapes explicitly');
  assert.ok(bridge.includes('descriptor.descriptor_digest'),
    'and the bounded public derivative of a Replay is its SANITIZED descriptor');
});

test('Replay is always the first lock and the CW2-08 prerequisite is always the last gate', () => {
  for (const name of HUMAN) {
    const body = bodyOf(name);
    assert.match(body, /FROM public\.replays r WHERE r\.id = [a-z_.]+ FOR UPDATE/u,
      `${name} takes the Replay row FOR UPDATE`);
    const replay = body.search(/FROM public\.replays r WHERE r\.id = [a-z_.]+ FOR UPDATE/u);
    const world = body.indexOf('FROM public.public_world_state w WHERE w.singleton FOR UPDATE');
    if (world >= 0) {
      assert.ok(replay < world, `${name} never inverts Replay and the Public World`);
    }
    const source = body.indexOf('public.replay_lock_source_manifest_v1');
    if (source >= 0) {
      assert.ok(replay < source, `${name} never takes the Replay lock after a source lock`);
    }
    assert.ok(!/pg_advisory|LOCK TABLE|TRUNCATE/iu.test(body),
      `${name} locks rows in the canonical order, never a table and never an advisory key`);
  }
  const commit = bodyOf(AUTHORIZE);
  assert.ok(commit.indexOf('derive_replay_distribution_effective_approvals_v1')
    < commit.indexOf(`public.${PREREQUISITE_SEAM}`),
  'every privacy and ownership gate precedes the CW2-08 prerequisite');
  assert.ok(commit.indexOf('derive_replay_source_manifest_currency_v1')
    < commit.indexOf(`public.${PREREQUISITE_SEAM}`),
  'and so does the source revalidation');
  assert.ok(commit.indexOf(`public.${PREREQUISITE_SEAM}`)
    < commit.indexOf('INSERT INTO public.replay_distribution_authorizations'),
  'and the seam is the LAST thing checked before anything is written');
  // The approval rows are taken in a deterministic order.
  assert.ok(commit.includes('ORDER BY a.approver_user_id FOR SHARE'),
    'approval rows are locked deterministically');
  // AND EVERY GATE IS PINNED BY THE EXACT CONDITION IT TESTS, not by the function
  // it consults: a gate pinned only by its function survives `IF false THEN`
  // beside an untouched RAISE, which reads exactly like a gate that still fires.
  for (const condition of ["WHERE s.effective_state = 'MISSING'",
    "WHERE s.effective_state <> 'EFFECTIVE'",
    's.bound_authority_fingerprint IS DISTINCT FROM derived.authority_fingerprint',
    'stored IS DISTINCT FROM derived.required_approvers',
    'derived.authority_fingerprint IS DISTINCT FROM package.authority_request_fingerprint',
    'recomputed IS DISTINCT FROM descriptor.descriptor_digest',
    "IF currency IS DISTINCT FROM 'CURRENT' THEN",
    "gate.clearance IS DISTINCT FROM 'CLEARED'"]) {
    assert.ok(commit.includes(condition), `the distribution commit tests the exact condition: ${condition}`);
  }
  // And the approval act pins its own two, for the same reason.
  const approval = bodyOf(APPROVE);
  for (const condition of ['stored IS DISTINCT FROM derived.required_approvers',
    'derived.authority_fingerprint IS DISTINCT FROM package.authority_request_fingerprint']) {
    assert.ok(approval.includes(condition), `the consent act tests the exact condition: ${condition}`);
  }
});

test('source currency is revalidated through the ONE frozen I-06A path and no competing evaluator exists', () => {
  for (const name of [PREPARE, APPROVE, AUTHORIZE]) {
    const body = bodyOf(name);
    assert.ok(body.includes('public.derive_replay_source_manifest_currency_v1'),
      `${name} revalidates currency through the ONE frozen I-06A derivation`);
    assert.ok(body.includes("IF currency IS DISTINCT FROM 'CURRENT' THEN"),
      `${name} refuses on any answer but CURRENT`);
  }
  // The two CREATOR-exact paths also take the frozen I-06A source lock. The
  // approval act deliberately does not: `replay_lock_source_manifest_v1` is
  // creator-scoped by design and an approver need not be the creator, so calling
  // it there would give a required rightsholder a distinguishable refusal from a
  // path whose whole purpose is to be bounded. The act that widens an audience
  // still revalidates under the full lock.
  for (const name of [PREPARE, AUTHORIZE]) {
    assert.ok(bodyOf(name).includes('public.replay_lock_source_manifest_v1'),
      `${name} stabilizes the source through the frozen I-06A helper`);
  }
  assert.ok(!bodyOf(APPROVE).includes('public.replay_lock_source_manifest_v1'),
    'the consent act takes no creator-scoped lock, so a required rightsholder is not answered differently');
  assert.ok(!installedSql.includes('CREATE FUNCTION public.derive_replay_distribution_source_currency'),
    'no competing source-currency evaluator is created');
  // AND NO FUNCTION THIS SLICE OWNS READS A SOURCE BODY AT ALL: a distribution
  // binds truth and copies none of it.
  //
  // The canonical Public authority derivation is excluded BY NAME, because it is
  // not a function this slice owns: it is the frozen I-05A derivation carried
  // over unchanged, and the source-integrity revalidation that reads
  // `committed_text` and `body_text` is precisely the rule that must survive the
  // additive extension. Excluding it is stated rather than silent, and the
  // section above proves it kept those exact reads.
  for (const [name] of bodies) {
    if (name === PUBLIC_AUTHORITY) continue;
    assert.ok(!/committed_text|body_text|transcript_text|audio_object_ref/u.test(bodyOf(name)),
      `${name} reads no source body: a distribution binds truth and copies none of it`);
  }
});

test('no transport, codec, storage or delivery is fabricated anywhere', () => {
  for (const [name] of bodies) {
    const body = bodyOf(name);
    assert.ok(!/(codec|bitrate|framerate|frame_rate|https?:\/\/|s3:\/\/|cloudfront|bucket|object_key|watermark)/iu.test(body),
      `${name} invents no codec container storage endpoint or transport`);
  }
  const commit = bodyOf(AUTHORIZE);
  assert.ok(commit.includes("'AUTHORIZED_FOR_DELIVERY'"),
    'an external share and a download are authorized and never delivered');
  assert.ok(commit.includes('public.publish_public_experience_v1'),
    'and a Public publish goes through the CANONICAL Public boundary');
  assert.ok(!commit.includes('INSERT INTO public.public_experience_publication_state'),
    'the canonical Public publication record stays the ONE Public publication truth');
});

test('the two read boundaries are exact, bounded and disclose nothing private', () => {
  const creator = bodyOf(PACKAGE_RESOLVER);
  assert.ok(creator.includes('r.created_by_user_id = p_user_id'),
    'the package resolver answers the exact Replay creator and nobody else');
  assert.ok(!creator.includes('approver_user_id,'), 'and returns no approver identity');
  const artifact = bodyOf(PUBLIC_RESOLVER);
  assert.ok(artifact.includes('public.resolve_public_visibility_state_v1')
    && artifact.includes('public.resolve_public_audience_admission_v1'),
  'the Public artifact resolver composes the canonical visibility state and the canonical admission gate');
  assert.ok(artifact.includes('d.audience_safe_reference = p_audience_safe_reference'),
    'and is addressed by the opaque audience reference, never by an internal identity');
  assert.ok(!artifact.includes('current_lifecycle'),
    'it tests no lifecycle for itself: the canonical derivation owns that');
  assert.ok(!artifact.includes('publication_package_item_provenance'),
    'and never reads the sealed Public provenance');
  const declared = /RETURNS TABLE\(([\s\S]*?)\)\s*\nLANGUAGE/u.exec(
    migration.slice(migration.indexOf(`FUNCTION public.${PUBLIC_RESOLVER}(`)));
  assert.ok(declared, 'the Public artifact resolver declares a RETURNS TABLE result');
  for (const column of [...declared[1].matchAll(/(\w+)\s+(?:uuid|text|integer|timestamptz)/gu)].map((m) => m[1])) {
    assert.doesNotMatch(column, /user_id|session|shared_|material|history_item|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|replay|manifest|selection|render_contract|distribution/u,
      `the Public artifact resolver must not return ${column}`);
  }
});

test('the command history is narrow, sealed and structurally bound to the creator', () => {
  for (const table of OWN_TABLES) {
    const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
    assert.ok(start >= 0, `0105 creates ${table}`);
    const block = executableSql.slice(start, executableSql.indexOf('\n);', start));
    assert.match(block, /request_ref text NOT NULL/u, `${table} binds the whole immutable request`);
    assert.match(block, /CHECK \(request_ref ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u);
    for (const forbidden of ['body', 'transcript', 'audio', 'payload', 'reason', 'safety', 'launch',
      'entitle', 'url', 'path', 'storage']) {
      assert.ok(!new RegExp(`\\n    \\w*${forbidden}\\w* `, 'u').test(block),
        `${table} carries no ${forbidden} column`);
    }
    assert.ok(installedSql.includes(`ALTER TABLE public.${table} OWNER TO postgres;`));
    assert.ok(installedSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`));
  }
  for (const table of ['replay_distribution_prepare_commands', 'replay_distribution_authorization_commands']) {
    const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
    const block = executableSql.slice(start, executableSql.indexOf('\n);', start));
    assert.match(block, /FOREIGN KEY \(replay_id, actor_user_id\)\s*\n\s*REFERENCES public\.replays \(id, created_by_user_id\) ON DELETE RESTRICT/u,
      `${table} binds its actor to the exact Replay creator through the identity key`);
  }
  assert.doesNotMatch(installedSql, /GRANT (SELECT|INSERT|UPDATE|DELETE)/u, '0105 grants no table privilege');
  assert.match(installedSql, /GRANT EXECUTE ON FUNCTION %s TO service_role/u,
    'and grants EXECUTE only on the two read boundaries');
});

test('0105 is registered in the toolchain, the focused gate, the I-06C CI group, the README and the phase document', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0105\\.mjs"`, 'u'));
  assert.match(readme, /0105_replay_distribution_runtime_export_public_bridge_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README records the verifier command');
  assert.match(verifier, /verifier for migration 0105/iu);
  const groups = JSON.parse(focused).groups;
  assert.ok(groups['i06c-0105'], 'the focused gate can select 0105 alone');
  assert.deepEqual(groups['i06c-all'].verifiers,
    ['database/verify-migration-0104.mjs', 'database/verify-migration-0105.mjs']);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0105=PASS; else status=1; fi`));
  assert.ok(workflow.includes(`if npm run ${PART_A_SCRIPT}; then result_0104=PASS; else status=1; fi`));
  // The phase document tells the truth about where I-06 stands.
  assert.ok(doc.includes('I-06') && doc.includes('ACTIVE'), 'the phase document records I-06 as ACTIVE');
  assert.ok(doc.includes('I-06A') && doc.includes('CLOSED'), 'and I-06A as closed and merged');
  assert.ok(doc.includes('I-06C') && doc.includes('CANDIDATE'),
    'and I-06C as a candidate awaiting independent review');
  assert.doesNotMatch(doc, /^\s*`?I-06`?\s+(?:is\s+)?(?:CLOSED|FROZEN)/mu, 'and never claims I-06 is closed');
  for (const phrase of ['REPLAY_DISTRIBUTION_PACKAGE_VERSION', 'EXPORT_PRIVACY_SANITIZATION',
    'PUBLISH_TO_PUBLIC_WORLD', 'SHARE_EXTERNALLY', 'DOWNLOAD', 'AUTHORIZED_FOR_DELIVERY',
    'REPLAY_ARTIFACT', 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT', 'NOT_EVALUATED', 'I-06D']) {
    assert.ok(doc.includes(phrase), `the phase document records ${phrase}`);
  }
  // IT CLAIMS NO LAUNCH READINESS. The words appear only as things this slice
  // does NOT produce, so the check is about the CLAIM rather than the vocabulary.
  assert.doesNotMatch(doc, /Public launch (?:is )?(?:ready|cleared|achieved)/iu,
    'the phase document claims no Public launch readiness');
  assert.ok(doc.includes('fails closed'), 'and records the fail-closed truth plainly');
  assert.ok(doc.includes('I-06B') && /I-06B[^\n]*(CLOSED|MERGED)/u.test(doc),
    'and reconciles I-06B as closed and merged now that its PR is on main');
});

test('the 0105 verifier RUNS the scenarios it claims, through the permanent aggregator', () => {
  for (const scenario of [
    'X01 production package preparation fails closed on unresolved analytical authority',
    'X02 the analytical authority seam answers unresolved and names no approver',
    'X03 the CW2-08 prerequisite seam answers NOT_EVALUATED on every dimension',
    'X04 no application role can execute any I-06C primitive',
    'X05 a prepared package binds the exact finalized version and widens no audience',
    'X06 a Replay Version that was never finalized cannot be prepared',
    'X07 a stranger and a nonexistent Replay reach ONE bounded class',
    'X08 the required approver set is derived and membership adds nobody',
    'X09 QANDEEL-authored Personal material fails the source authority closed',
    'X10 a bound source that moved blocks preparation',
    'X11 the sanitized descriptor is the whole audience-visible surface',
    'X12 a second destination is a NEW package with its own authority identity',
    'X13 preparation is durably idempotent and a reused command id conflicts',
    'X14 the required human approves the exact package through auth.uid()',
    'X15 a human the package does not require reaches the bounded class',
    'X16 an approval cannot float to another package or another destination',
    'X17 withdrawal is append-only, own-approval only and idempotent',
    'X18 MISSING WITHDRAWN and EFFECTIVE are each derived, never counted',
    'X19 a missing approval blocks the distribution',
    'X20 a withdrawn approval blocks the distribution',
    'X21 an unevaluated CW2-08 prerequisite blocks the distribution, seam last',
    'X22 each CW2-08 dimension blocks on its own: no layer manufactures another',
    'X23 a source that moved after preparation blocks the distribution',
    'X24 an external share reaches AUTHORIZED_FOR_DELIVERY and claims no delivery',
    'X26 a Public package prepares the bounded artifact under the canonical runtime',
    'X27 the canonical Public authority derivation reaches the Replay required set',
    'X28 an unbridged REPLAY_ARTIFACT item fails the canonical Public authority closed',
    'X29 ONE human consent act writes BOTH immutable evidence rows',
    'X30 the Public publish goes through the canonical boundary and its own prerequisite',
    'X31 the artifact resolver serves the sanitized descriptor to an admitted viewer',
    'X32 an Experience that is not publicly visible serves nothing',
    'X33 a Public viewer gains no source access and no Replay creation authority',
    'X34 no caller can author the required set, the approval principal or a clearance',
  ]) {
    assert.ok(verifier.includes(`report.isolated('${scenario}'`),
      `the 0105 verifier RUNS the scenario: ${scenario}`);
  }
  for (const race of [
    'C01 a withdrawal racing the distribution commit blocks the stale commit',
    'C02 a source change racing the distribution commit blocks the stale commit',
    'C03 two competing distribution commands converge on ONE winner',
  ]) {
    assert.ok(verifier.includes(`report.section('${race}'`), `the 0105 verifier RUNS the race: ${race}`);
  }
  assert.match(verifier, /createScenarioReport/u);
  assert.match(verifier, /assertAllPassed\(\)/u);
  assert.ok(verifier.indexOf('createScenarioReport') < verifier.indexOf("stage('catalog')"),
    'the report exists before the first catalog check');
  // THE SEAMS ARE SIMULATED AND RESTORED, never granted and never left installed.
  assert.ok(support.includes('captureSeamDefinition') && support.includes('restoreSeamDefinition'),
    'the harness captures and restores a seam');
  assert.ok(support.includes('assert.equal(prosrc, seam.prosrc,'),
    'and PROVES the production body back byte for byte');
  assert.ok(support.includes('VERIFIER PROBE'), 'every simulated answer says it is a probe');
  assert.ok(verifier.includes('both production seams are restored after the committed races'),
    'and the run proves BOTH production seams back after the committed races');
  assert.ok(verifier.includes('await rt.restoreSeamDefinition(analytical);')
    && verifier.includes('await rt.restoreSeamDefinition(gate);'),
  'through the restore helper that compares the body rather than through a bare recreate');
  assert.ok(support.includes('assert.equal(await rt.triggerEnabled(table, trigger), true,'),
    'the harness proves every append-only guard it lifted back');
});

// ---------------------------------------------------------------------------
// Forward safety and anti-vacuity for the WHOLE I-06C slice.
// ---------------------------------------------------------------------------

const I06C_CONTRACTS = [
  'database/tests/replay-distribution-package-authority-v1.test.mjs',
  'database/tests/replay-distribution-export-public-bridge-v1.test.mjs',
];
const MIRRORED = ['.github', 'database', 'tests', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i06c-replay-');
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(mirror, entry), { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  mkdirSync(join(mirror, 'docs'), { recursive: true });
  writeFileSync(join(mirror, 'docs/replay-runtime-v1.md'), doc);
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
  const files = I06C_CONTRACTS.map((relative) => join(mirror, relative));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    { cwd: mirror, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.error, undefined, `the mirrored contracts could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'the mirrored contracts did not exit normally');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(output, /# pass \d+/u, `the mirrored contracts reported no results:\n${output.slice(-1500)}`);
  assert.doesNotMatch(output, /# pass 0\b/u, 'the mirrored contracts executed nothing');
  return { ok: result.status === 0, output };
}

const M104 = `database/migrations/${PART_A_NAME}`;
const M105 = `database/migrations/${MIGRATION_NAME}`;
const CI = '.github/workflows/api-ci.yml';
const GROUP_STEP = '      - name: Verify the two I-06C Replay distribution package authority and runtime verifiers against real PostgreSQL as one reported group';

test('every authorized later addition leaves both I-06C contracts passing',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const mirror = buildMirror();
    try {
      // The roadmap, as a real migration: the I-06D post-finalization source-loss
      // record and its distribution reconciliation, a reviewed protected-human
      // subject-authority resolver that finally resolves the analytical seam, a
      // reviewed CW2-08 runtime that finally clears the prerequisite, a reviewed
      // media delivery boundary, additive columns, an index and a new CI gate.
      write(mirror, 'database/migrations/0106_replay_source_loss_and_launch_v1.sql',
        'BEGIN;\n'
        + 'CREATE TABLE public.replay_source_loss_records (source_manifest_version_id uuid PRIMARY KEY\n'
        + '  REFERENCES public.replay_source_manifest_versions (id) ON DELETE RESTRICT,\n'
        + '  noted_at timestamptz NOT NULL);\n'
        + 'CREATE TABLE public.replay_distribution_recall_records (distribution_package_version_id uuid PRIMARY KEY\n'
        + '  REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,\n'
        + '  recalled_at timestamptz NOT NULL);\n'
        + 'CREATE TABLE public.replay_delivery_receipts (distribution_package_version_id uuid PRIMARY KEY\n'
        + '  REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,\n'
        + '  delivered_at timestamptz NOT NULL, storage_object_key text NOT NULL);\n'
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
        + 'ALTER TABLE public.replay_distribution_prepare_commands ADD COLUMN client_ref text;\n'
        + 'CREATE INDEX replay_distribution_authorizations_at_idx\n'
        + '  ON public.replay_distribution_authorizations (authorized_at);\n'
        + 'CREATE FUNCTION public.launch_gated_prepare_replay_distribution_v1(p_command_id uuid, p_replay_id uuid)\n'
        + "  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN PERFORM 1; END$fn$;\n"
        + 'GRANT EXECUTE ON FUNCTION public.launch_gated_prepare_replay_distribution_v1(uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0106.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/replay-source-loss-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      patch(mirror, CI, GROUP_STEP,
        '      - {name: Verify a later reviewed Replay source-loss slice, run: npm run verify:replay-source-loss:integration}\n' + GROUP_STEP);
      const { ok, output } = runInMirror(mirror);
      assert.ok(ok,
        'an I-06D source-loss record and recall reconciliation, a reviewed delivery receipt with a real storage '
        + 'handle, a resolved analytical authority seam, a cleared CW2-08 seam, additive columns, an index and a '
        + 'new CI gate must all leave I-06C passing:\n' + output.slice(-2500));
    } finally {
      removeHarnessMirror(mirror);
    }
  });

test('the contracts are not vacuous: every deliberate weakening of I-06C is refused by at least one of them',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const regressions = [
      // --- 0104: the package stops binding the truth it must bind
      ['the package stops binding historical finalization evidence', M104,
        '    CONSTRAINT replay_distribution_package_versions_finalized_fk\n        FOREIGN KEY (replay_version_id, replay_id)\n        REFERENCES public.replay_version_finalizations (replay_version_id, replay_id) ON DELETE RESTRICT,',
        '    CONSTRAINT replay_distribution_package_versions_finalized_fk\n        FOREIGN KEY (replay_version_id)\n        REFERENCES public.replay_version_finalizations (replay_version_id) ON DELETE RESTRICT,'],
      ['the package stops binding the exact Replay Version composition', M104,
        '        FOREIGN KEY (replay_version_id, replay_id, source_manifest_version_id)\n        REFERENCES public.replay_versions (id, replay_id, source_manifest_version_id) ON DELETE RESTRICT,',
        '        FOREIGN KEY (replay_version_id)\n        REFERENCES public.replay_versions (id) ON DELETE RESTRICT,'],
      ['unresolved analytical authority becomes representable inside a package', M104,
        "    CONSTRAINT replay_distribution_package_versions_analytical_authority_check\n        CHECK (analytical_authority_resolution IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',\n                                                   'RESOLVED_NO_HUMAN_REQUIREMENT')),",
        '    CONSTRAINT replay_distribution_package_versions_analytical_authority_check\n        CHECK (analytical_authority_resolution IS NOT NULL),'],
      ['an exact human requirement becomes recordable as an empty approver set', M104,
        "    CONSTRAINT replay_distribution_package_versions_count_check\n        CHECK ((authority_requirement_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT' AND required_approver_count > 0)\n            OR (authority_requirement_state = 'RESOLVED_NO_HUMAN_REQUIREMENT' AND required_approver_count = 0)),",
        '    CONSTRAINT replay_distribution_package_versions_count_check\n        CHECK (required_approver_count >= 0),'],
      ['an approval stops binding the derived required set', M104,
        '    CONSTRAINT replay_distribution_approvals_required_fk\n        FOREIGN KEY (distribution_package_version_id, approver_user_id)\n        REFERENCES public.replay_distribution_required_approvers\n                   (distribution_package_version_id, approver_user_id) ON DELETE RESTRICT,',
        '    CONSTRAINT replay_distribution_approvals_required_fk\n        FOREIGN KEY (approver_user_id)\n        REFERENCES public.users (id) ON DELETE RESTRICT,'],
      ['an approval stops binding its destination', M104,
        '    CONSTRAINT replay_distribution_approvals_destination_fk\n        FOREIGN KEY (distribution_package_version_id, destination_action)\n        REFERENCES public.replay_distribution_package_versions (id, destination_action) ON DELETE RESTRICT',
        '    CONSTRAINT replay_distribution_approvals_destination_fk\n        FOREIGN KEY (distribution_package_version_id)\n        REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT'],
      ['the audience reference becomes an internal uuid column', M104,
        '    sanitization_contract_id text NOT NULL,\n    audience_safe_reference text NOT NULL,',
        '    sanitization_contract_id text NOT NULL,\n    audience_safe_reference uuid NOT NULL,'],
      ['the opacity guard stops being installed', M104,
        'CREATE TRIGGER replay_distribution_package_versions_opaque_reference\n    BEFORE INSERT ON public.replay_distribution_package_versions',
        'CREATE TRIGGER replay_distribution_package_versions_opaque_reference_disabled\n    BEFORE INSERT ON public.replay_distribution_required_approvers'],
      ['the sanitized descriptor grows a private source column', M104,
        '    coverage_class text NOT NULL,\n    selected_segment_count integer NOT NULL,',
        '    coverage_class text NOT NULL,\n    personal_session_id uuid,\n    selected_segment_count integer NOT NULL,'],
      ['the Public bridge becomes a generic artifact pointer', M104,
        '    CONSTRAINT replay_public_distribution_artifacts_provenance_fk\n        FOREIGN KEY (package_item_id, public_source_class)\n        REFERENCES public.publication_package_item_provenance (package_item_id, source_class)\n        ON DELETE RESTRICT,',
        '    CONSTRAINT replay_public_distribution_artifacts_provenance_fk\n        FOREIGN KEY (package_item_id)\n        REFERENCES public.publication_package_item_provenance (package_item_id)\n        ON DELETE RESTRICT,'],
      ['an authorization may claim a delivery no transport performed', M104,
        "     OR (destination_action = 'SHARE_EXTERNALLY'\n            AND distribution_state = 'AUTHORIZED_FOR_DELIVERY'\n            AND published_experience_version_id IS NULL)",
        "     OR (destination_action = 'SHARE_EXTERNALLY'\n            AND distribution_state = 'DELIVERED'\n            AND published_experience_version_id IS NULL)"],
      ['a CW2-08 dimension stops being pinned positive', M104,
        "    CONSTRAINT replay_distribution_authorizations_clearance_check CHECK (\n        safety_state = 'SAFETY_ALLOW' AND moderation_state = 'MODERATION_ALLOW'",
        '    CONSTRAINT replay_distribution_authorizations_clearance_check CHECK (\n        safety_state IS NOT NULL AND moderation_state IS NOT NULL'],
      // --- 0105: the runtime stops being fail-closed or stops revalidating
      ['the analytical seam starts answering a resolved requirement', M105,
        "  RETURN QUERY SELECT 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'::text, NULL::uuid[],",
        "  RETURN QUERY SELECT 'RESOLVED_NO_HUMAN_REQUIREMENT'::text, ARRAY[]::uuid[],"],
      ['the CW2-08 seam starts clearing the distribution', M105,
        "  RETURN QUERY SELECT 'NOT_EVALUATED'::text, 'NOT_EVALUATED'::text, 'NOT_EVALUATED'::text,",
        "  RETURN QUERY SELECT 'CLEARED'::text, 'SAFETY_ALLOW'::text, 'MODERATION_ALLOW'::text,"],
      ['the required approver derivation stops consuming the analytical seam', M105,
        '  SELECT a.resolution_state, a.required_approvers INTO analytical\n    FROM public.resolve_replay_analytical_distribution_authority_v1(version.analytical_projection_version_id) a;',
        '  analytical := ROW(NULL, NULL);'],
      ['QANDEEL-authored Personal material stops failing the source authority closed', M105,
        "       AND (mi.personal_conversation_unit_id IS NULL OR mi.personal_source_role IS DISTINCT FROM 'USER')",
        '       AND mi.personal_conversation_unit_id IS NULL'],
      ['the distribution commit stops revalidating source currency', M105,
        "  SELECT c.currency_state INTO currency\n    FROM public.derive_replay_source_manifest_currency_v1(package.source_manifest_version_id) c;\n  IF currency IS DISTINCT FROM 'CURRENT' THEN\n    RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001',\n      DETAIL='A bound source changed, became unavailable, is no longer visible to the creator or is no longer the eligible version; a stale distribution cannot commit.';\n  END IF;",
        "  currency := 'CURRENT';"],
      ['the distribution commit stops requiring every approval to be effective', M105,
        "  IF EXISTS (SELECT 1 FROM public.derive_replay_distribution_effective_approvals_v1(package.id) s\n              WHERE s.effective_state <> 'EFFECTIVE') THEN",
        '  IF false THEN'],
      ['the canonical Public authority derivation loses the REPLAY_ARTIFACT fail-closed branch', M105,
        "  IF EXISTS (\n    SELECT 1 FROM public.publication_package_item_provenance p\n     WHERE p.manifest_version_id = p_manifest_version_id AND p.source_class = 'REPLAY_ARTIFACT'\n       AND NOT EXISTS (SELECT 1 FROM public.replay_public_distribution_artifacts a\n                        WHERE a.package_item_id = p.package_item_id)\n  ) THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';\n  END IF;",
        '  IF false THEN\n    RAISE EXCEPTION \'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED\' USING ERRCODE=\'55000\';\n  END IF;'],
      ['the Public artifact resolver stops composing the canonical visibility state', M105,
        '      CROSS JOIN LATERAL public.resolve_public_visibility_state_v1(a.public_experience_id) vs',
        '      CROSS JOIN LATERAL (SELECT a.public_experience_id experience_id,\n        \'PUBLICLY_VISIBLE\'::text visibility_state, NULL::uuid visible_manifest_version_id,\n        1 visible_version_ordinal) vs'],
      ['a Public publish stops going through the canonical Public boundary', M105,
        '    SELECT * INTO published FROM public.publish_public_experience_v1(\n      p_public_publish_command_id, bridge.public_experience_id, publishing_version);',
        "    published := ROW('PUBLISHED');"],
      ['the human consent act stops writing the canonical Public evidence row', M105,
        '      INSERT INTO public.publication_manifest_approvals\n        (id, manifest_version_id, approver_user_id, bound_authority_fingerprint, approved_at)\n      VALUES (p_public_approval_id, bridge.public_manifest_version_id, u, public_fingerprint, instant);',
        '      PERFORM 1;'],
    ];
    for (const [label, file, from, to] of regressions) {
      const mirror = buildMirror();
      try {
        patch(mirror, file, from, to);
        const { ok, output } = runInMirror(mirror);
        assert.equal(ok, false,
          `NO I-06C contract refused this regression: ${label}\n${output.slice(-1200)}`);
      } finally {
        removeHarnessMirror(mirror);
      }
    }
  });
