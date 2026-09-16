// I-05C - Continuing Public Eligibility and Canonical Visibility Closure v1:
// the secret-free structural contract for migration 0098.
//
// Live semantics - a withdrawal or a source loss turning every Public surface
// dark immediately, the anti-oracle answer, the races - are proven by
// database/verify-migration-0098.mjs against real PostgreSQL. What is proven
// HERE is the structure a migration must already have before it deploys: that
// PART A writes no row at all, that continuing eligibility CONTINUES the frozen
// 0095 publication gates rather than inventing new ones, that it consumes every
// canonical truth instead of re-deriving it, that it fails closed on every
// raise, that the ONE canonical visibility derivation is extended additively
// with the frozen result shape and still answers exactly two states, and that
// migrations 0091-0097 are byte-identical.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { FROZEN_PREDECESSORS } from './public-runtime-frozen-predecessors.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0098_public_continuing_eligibility_visibility_closure_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0098.mjs');
const support = read('../public-runtime-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
// The self-assertion block NAMES the shapes it refuses - 'INSERT INTO',
// 'ABSENT_FROM_PUBLIC_WORLD' - so the "PART A writes nothing" claims are asked
// of the migration's own statements, never of the refusals that guard them.
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const ELIGIBILITY = 'derive_public_continuing_eligibility_v1';
const VISIBILITY = 'resolve_public_visibility_state_v1';
const OWN_SCRIPT = 'verify:public-continuing-eligibility-visibility-closure:integration';

const functionBody = (name, keyword = 'CREATE FUNCTION') => {
  const start = migration.indexOf(`${keyword} public.${name}(`);
  assert.ok(start >= 0, `migration 0098 declares ${name}`);
  let depth = 1; let i = start + `${keyword} public.${name}(`.length;
  while (i < migration.length && depth > 0) {
    if (migration[i] === '(') depth += 1; else if (migration[i] === ')') depth -= 1;
    i += 1;
  }
  const open = migration.indexOf('AS $$', i);
  const end = migration.indexOf('$$;', open + 5);
  assert.ok(open > i && end > open, `${name} has a terminated dollar-quoted body`);
  return { header: migration.slice(i, open), body: migration.slice(open + 'AS $$'.length, end) };
};
const inputParameters = (name, keyword = 'CREATE FUNCTION') => {
  const start = migration.indexOf(`${keyword} public.${name}(`);
  let depth = 1; let i = start + `${keyword} public.${name}(`.length;
  const open = i;
  while (i < migration.length && depth > 0) {
    if (migration[i] === '(') depth += 1; else if (migration[i] === ')') depth -= 1;
    i += 1;
  }
  return [...migration.slice(open, i - 1).matchAll(/(p_\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean)/gu)].map((m) => m[1]);
};
const resultColumns = (name, keyword = 'CREATE FUNCTION') => {
  const { header } = functionBody(name, keyword);
  const table = /RETURNS TABLE\(([\s\S]*?)\)\s*\n?LANGUAGE/u.exec(header);
  assert.ok(table, `${name} declares a RETURNS TABLE result`);
  return [...table[1].matchAll(/(\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean|timestamptz|real)/gu)].map((m) => m[1]);
};
/** Executable statements only: prose in comments must never satisfy a claim. */
const code = (body) => body.split('\n').map((line) => line.replace(/--.*$/u, '')).join('\n');

// ---------------------------------------------------------------------------

test('0098 is the forward migration after 0097, every frozen predecessor is byte-identical, and PART A writes nothing', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0098_')).length, 1, 'exactly one migration carries the 0098 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0097_public_vitality_search_lens_panel_projections_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of FROZEN_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  // PART A is pure derivation. Privacy must fail closed IMMEDIATELY through
  // canonical truth, so nothing here waits on a row: no relation, no trigger,
  // no index, no policy, no insert, no update, no delete, no grant.
  for (const forbidden of [/\bCREATE TABLE\b/u, /\bCREATE TRIGGER\b/u, /\bCREATE INDEX\b/u, /\bCREATE POLICY\b/u,
    /\bINSERT INTO\b/u, /\bUPDATE public\./u, /\bDELETE FROM\b/u, /\bALTER TABLE\b/u, /\bGRANT\b/u]) {
    assert.doesNotMatch(installedSql, forbidden, `PART A is pure derivation: ${forbidden} has no place in it`);
  }
  assert.ok(!installedSql.includes('ABSENT_FROM_PUBLIC_WORLD'),
    'PART A owns no disappearance lifecycle: the convergence is migration 0099');
  assert.equal((executableSql.match(/CREATE FUNCTION public\./gu) ?? []).length, 1,
    'it creates exactly one new function');
  assert.equal((executableSql.match(/CREATE OR REPLACE FUNCTION public\./gu) ?? []).length, 1,
    'and replaces exactly one, additively, through the repository forward method');
  assert.match(executableSql, /CREATE OR REPLACE FUNCTION public\.resolve_public_visibility_state_v1\(p_experience_id uuid\)/u,
    'the ONE object it replaces is the canonical visibility derivation');
});

test('continuing eligibility CONTINUES the frozen 0095 publication gates, in order, over the exact published package', () => {
  const { header, body } = functionBody(ELIGIBILITY);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''/u);
  assert.deepEqual(inputParameters(ELIGIBILITY), ['p_experience_id'],
    'no approver, authority, audience, viewer, eligibility, cause or instant parameter');
  const c = code(body);
  const at = (needle) => { const i = c.indexOf(needle); assert.ok(i >= 0, `continuing eligibility contains: ${needle}`); return i; };
  // GATE 1, the frozen I-05B publication binding, unchanged.
  const lifecycle = at("AND e.current_lifecycle = 'PUBLISHED'");
  const record = at('JOIN public.public_experience_publication_state s ON s.experience_id = e.id');
  const pointer = at('AND e.current_experience_version_id = s.published_experience_version_id');
  const manifestBinding = at('AND s.published_manifest_version_id = v.package_manifest_version_id');
  // GATE 2, every required approval currently EFFECTIVE, through the ONE 0094
  // derivation, each still bound to the fingerprint the publication recorded.
  const approvals = at('FROM public.derive_publication_manifest_effective_approvals_v1(bound_manifest) ea');
  const notEffective = at("WHERE ea.effective_state <> 'EFFECTIVE'");
  const boundPrint = at('OR ea.bound_authority_fingerprint IS DISTINCT FROM bound_fingerprint');
  // GATE 3, source availability and authority, through the ONE I-05A derivation.
  const authority = at('FROM public.derive_public_publication_authority_v1(bound_manifest) d;');
  // GATE 4, the derived rightsholder set still equals the stored one.
  const stored = at('FROM public.publication_manifest_required_approvers ra');
  const compare = at('IF stored_approvers IS DISTINCT FROM derived_approvers THEN');
  // Gate 1 is ONE statement, so its four clauses carry no order among
  // themselves; what must hold is that the four GATES follow one another, each
  // anchored on its last clause. Every clause above was proven present by `at`.
  assert.ok(lifecycle >= 0 && record >= 0 && pointer >= 0 && notEffective >= 0 && boundPrint >= 0 && stored >= 0);
  const gates = [manifestBinding, approvals, authority, compare];
  for (let i = 1; i < gates.length; i += 1) {
    assert.ok(gates[i] > gates[i - 1], `gate ${i + 1} follows gate ${i}`);
  }
  // AND THERE IS NO FIFTH GATE. Every one of the four is a property of the
  // PACKAGE: no actor reaches the derivation, so continuing eligibility can
  // never become a question about who is currently reading, controlling or
  // browsing. See the dedicated contract below for why that is load-bearing.
  assert.ok(!c.includes('auth.uid()'), 'continuing eligibility reads no acting human');
  // It FAILS CLOSED on every raise of the frozen derivation it consumes.
  assert.match(c, /EXCEPTION\s*\n\s*WHEN SQLSTATE 'P0002' THEN/u,
    'the frozen source-unavailable class becomes the source ineligibility class');
  assert.equal((c.match(/WHEN OTHERS THEN/gu) ?? []).length, 1,
    'and every other raise becomes an ineligibility answer rather than an error a caller can read');
  // Current membership is never a proxy, and control is never read at all.
  for (const forbidden of ['shared_world_membership_episodes', 'shared_world_history_access_grants',
    'shared_world_standard_closed_view_entitlements', 'shared_world_history_package_manifest_items',
    'public_experience_controllers']) {
    assert.ok(!body.includes(forbidden), `continuing eligibility consumes canonical truth rather than reading ${forbidden}`);
  }
  // It writes nothing and takes no lock: callers that need a stable answer hold
  // the Experience row, exactly as the frozen derivation documents.
  assert.doesNotMatch(body, /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|FOR SHARE/u);
  assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|TRUNCATE/iu);
  assert.doesNotMatch(body, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/iu);
});

test('source AVAILABILITY is a continuing condition and actor source ACCESS is not', () => {
  const { body } = functionBody(ELIGIBILITY);
  // The frozen publish boundary asks an ACTOR question, and says so in as many
  // words. It is untouched: this contract removes nothing from publication.
  const frozen0095 = read('../migrations/0095_public_experience_publication_visibility_serving_v1.sql');
  assert.match(frozen0095, /GATE 6: CURRENT SOURCE ACCESS FOR THE PUBLISHING HUMAN/u,
    'the frozen gate is a publish-time actor gate, and the frozen migration labels it one');
  assert.ok(frozen0095.includes('public.resolve_shared_world_history_visibility_v1(p.shared_world_id, u)'),
    'and the publish boundary still asks it of the human performing the act');
  // Continuing eligibility must not repurpose it into a perpetual public
  // predicate. A publisher who later leaves the Shared World, is removed from
  // it, or falls outside a closed-view entitlement loses BROWSING - the source
  // they published is untouched, still AVAILABLE at the captured revision and
  // still the captured bytes. Re-asking the actor question forever would let one
  // human's later browsing status delete everyone else's Public view, and no
  // frozen contract states that: 0095 scopes the call to that instant, and
  // nothing in 0091-0097 re-asks it afterwards.
  for (const forbidden of ['resolve_shared_world_history_visibility_v1', 'publisher_user_id', 'bound_publisher']) {
    assert.ok(!body.includes(forbidden),
      `continuing eligibility must not make actor source access a continuing condition: ${forbidden}`);
  }
  // What it consumes instead is the actor-free availability/integrity truth -
  // and the migration refuses at DEPLOY time, not merely here, if either half of
  // that is ever undone.
  assert.ok(body.includes('derive_public_publication_authority_v1'),
    'source availability comes from the ONE I-05A derivation');
  assert.ok(selfAssertions.includes("IF p.prosrc ~ 'resolve_shared_world_history_visibility_v1' THEN"),
    'the migration itself refuses to deploy a continuing derivation that asks the actor question');
  assert.ok(selfAssertions.includes('availability_revision <> p\\.captured_availability_revision'),
    'while asserting the consumed derivation still binds the exact captured availability revision');
  assert.ok(selfAssertions.includes('captured_source_digest'),
    'and the exact captured source digest');
});

test('the bounded internal ineligibility vocabulary is exactly five classes and names nothing private', () => {
  const { body } = functionBody(ELIGIBILITY);
  // Every UPPER_SNAKE literal the derivation can emit or compare against. The
  // list is a CEILING, not a floor: a sixth invented cause, or a literal that
  // named a source, would appear here and fail.
  const ALLOWED = new Set([
    // the two eligibility states and the five bounded internal causes
    'ELIGIBLE', 'INELIGIBLE',
    'NOT_PUBLISHED', 'PUBLICATION_BINDING_INVALID', 'REQUIRED_APPROVAL_NOT_EFFECTIVE',
    'PUBLISHED_SOURCE_NOT_AVAILABLE', 'PUBLICATION_AUTHORITY_INVALIDATED',
    // frozen predecessor vocabulary it COMPARES against, never invents
    'PUBLISHED', 'EFFECTIVE', 'SHARED_WORLD', 'MY_WORLD',
    // the one bounded error class it raises for a null identifier
    'PUBLIC_EXPERIENCE_COMMAND_INVALID',
  ]);
  const literals = [...new Set([...body.matchAll(/'([A-Z][A-Z_]{3,})'/gu)].map((m) => m[1]))].sort();
  for (const literal of literals) {
    assert.ok(ALLOWED.has(literal), `the derivation may not introduce the literal ${literal}`);
    assert.doesNotMatch(literal, /SESSION|MATERIAL|HISTORY_ITEM|MEMBER|DIGEST|REVISION|ACCOUNT|EMAIL/u,
      `${literal} names no source, World, human, revision or digest`);
  }
  for (const cause of ['NOT_PUBLISHED', 'PUBLICATION_BINDING_INVALID', 'REQUIRED_APPROVAL_NOT_EFFECTIVE',
    'PUBLISHED_SOURCE_NOT_AVAILABLE', 'PUBLICATION_AUTHORITY_INVALIDATED']) {
    assert.ok(literals.includes(cause), `the bounded internal vocabulary decides ${cause}`);
  }
  assert.deepEqual(resultColumns(ELIGIBILITY),
    ['experience_id', 'eligibility_state', 'ineligibility_class', 'eligible_experience_version_id',
      'eligible_manifest_version_id', 'eligible_version_ordinal'],
    'and the derivation declares exactly the columns the convergence needs');
});

test('the canonical visibility derivation is extended additively, keeps the frozen shape, and answers exactly two states', () => {
  const { header, body } = functionBody(VISIBILITY, 'CREATE OR REPLACE FUNCTION');
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''/u);
  assert.deepEqual(inputParameters(VISIBILITY, 'CREATE OR REPLACE FUNCTION'), ['p_experience_id']);
  assert.deepEqual(resultColumns(VISIBILITY, 'CREATE OR REPLACE FUNCTION'),
    ['experience_id', 'visibility_state', 'visible_experience_version_id',
      'visible_manifest_version_id', 'visible_version_ordinal'],
    'the frozen I-05B result shape is unchanged, so every frozen consumer keeps reading the same five columns');
  assert.match(body, /FROM public\.derive_public_continuing_eligibility_v1\(p_experience_id\) ce\s*\n\s*WHERE ce\.eligibility_state = 'ELIGIBLE';/u,
    'it consumes the ONE continuing-eligibility truth');
  assert.equal((body.match(/RETURN QUERY/gu) ?? []).length, 2,
    'exactly two answers exist, so every non-serving cause is ONE outward class');
  assert.match(body, /RETURN QUERY SELECT p_experience_id, 'NOT_PUBLICLY_VISIBLE'::text, NULL::uuid, NULL::uuid, NULL::integer;/u,
    'and the non-serving answer carries no version, no manifest and no ordinal');
  assert.ok(!body.includes('ineligibility_class'), 'the internal cause never reaches a Public surface');
  assert.ok(!body.includes('public_audience_policy_state'), 'object visibility and viewer admission are different gates');
  for (const projection of ['public_experience_search_projection', 'public_experience_vitality_state']) {
    assert.ok(!body.includes(projection),
      `no cycle: the visibility truth must not depend on ${projection}, whose own write eligibility depends on it`);
  }
  assert.ok(!body.includes('INSERT INTO') && !body.includes('UPDATE public') && !body.includes('DELETE FROM'),
    'and it writes nothing');
});

test('both derivations stay internal, and nothing in 0098 grants anything to any application role', () => {
  assert.match(executableSql, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/u);
  assert.match(executableSql, /REVOKE ALL ON FUNCTION %s FROM service_role/u);
  assert.equal((executableSql.match(/\bGRANT\b/gu) ?? []).length, 0,
    'PART A opens no new surface: the ONE serving resolver stays exactly as migration 0095 granted it');
  for (const name of [ELIGIBILITY, VISIBILITY]) {
    assert.ok(executableSql.includes(`'public.${name}(uuid)'`), `${name} is named in the revoke posture`);
  }
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'before the frozen CW2-08 Launch Gate exists',
    'derivation % must be STABLE',
    'derivation % must write nothing',
    'PART A owns no disappearance lifecycle',
    'may not accept an authority audience visibility eligibility or instant parameter',
    'continuing eligibility must keep the frozen I-05B publication binding intact',
    'continuing eligibility must require every required approval to be currently EFFECTIVE through the ONE 0094 derivation',
    'continuing eligibility must revalidate source availability and authority through the ONE I-05A derivation',
    'continuing eligibility must compare the derived rightsholder set with the stored one',
    'continuing eligibility must not turn actor source ACCESS into a continuing public-visibility condition',
    'continuing eligibility must not re-implement Shared membership or history authorization',
    'continuing eligibility must read no Experience control: control is not content consent',
    'continuing eligibility must turn every raise of a consumed derivation into an INELIGIBLE answer',
    'the bounded internal ineligibility vocabulary must include',
    'the canonical visibility derivation must consume the ONE continuing-eligibility truth',
    'the canonical visibility derivation must fail closed to NOT_PUBLICLY_VISIBLE',
    'the canonical visibility derivation must answer exactly two states',
    'the canonical visibility derivation must never expose the internal ineligibility cause',
    'object visibility and viewer admission are different gates',
    'must not depend on a projection whose own write eligibility depends on it',
    'the canonical visibility derivation must keep the frozen I-05B result shape',
    'the ONE I-05A authority derivation must still bind the exact captured source availability revision and digest',
    'the frozen 0092 approval evidence must still be append-only',
    'the frozen 0095 publication record must still be append-only',
    'the frozen 0094 withdrawal evidence must still be append-only',
    'the frozen committed Personal source must still be append-only',
    'the CW2-08 prerequisite seam must still answer NOT_EVALUATED',
    'the frozen CW2-08 signed-out viewing requirement must remain UNRESOLVED',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
  // Nothing here is a ceiling on migration 0099 or on any later slice: no
  // refusal names a later object, caps the catalog, or forbids a lifecycle
  // value schema-wide.
  const refusals = [...selfAssertions.matchAll(/RAISE EXCEPTION '([^']*)'/gu)].map((m) => m[1].toLowerCase());
  assert.equal(refusals.find((m) => /must not exist|no function may|no migration may|count\(\*\) = /u.test(m)), undefined,
    'no self-assertion forbids a later reviewed object');
  assert.ok(!selfAssertions.includes('FROM pg_proc pr JOIN pg_namespace'),
    'and none sweeps the whole catalog: every assertion is a fact about the two objects 0098 owns');
});

test('0098 is registered in the toolchain, in the I-05C CI group, and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0098\\.mjs"`, 'u'));
  assert.match(readme, /0098_public_continuing_eligibility_visibility_closure_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`));
  assert.ok(readme.includes('CONTINUING PUBLIC ELIGIBILITY') && readme.includes('ABSENT_FROM_PUBLIC_WORLD'),
    'the README records the continuing-eligibility rule and the disappearance lifecycle meaning');
  assert.match(verifier, /verifier for migration 0098/iu);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0098=PASS; else status=1; fi`));
  // Scoped to the I-05C step's OWN body. Other grouped steps end the same way,
  // and a whole-file check would be satisfied by one of those instead.
  const step = workflow.slice(workflow.indexOf('- name: Verify the two I-05C Public World disappearance verifiers'));
  assert.ok(step.slice(0, step.indexOf('\n      - ')).includes('exit "$status"'),
    'the grouped I-05C step fails the job when either verifier failed');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
});

test('the verifier proves the live semantics, the whole surface census, and eleven refused weakenings', () => {
  for (const needle of ['CE01', 'CE02', 'CE03', 'CE04', 'CE05', 'CE06', 'CE07', 'CE08', 'CE09', 'CE10', 'CE11', 'CE12',
    'P1 a Public resolver that bypasses canonical visibility is a regression',
    'P2 a projection that implies visibility is a regression',
    'P3 membership in place of exact source truth is a regression',
    'P4 continuing eligibility without the effective-approval gate is a regression',
    'P5 a visibility truth that ignores continuing eligibility is a regression',
    'P6 exposing the internal ineligibility cause is a regression',
    'P7 the internal cause becoming application-reachable is a regression',
    'P8 widening anonymous Public serving is a regression',
    'P9 a seam that answers CLEARED without a canonical gate is a regression',
    'P10 an outward Public surface outside the visibility census is a regression',
    'P11 re-asking actor source ACCESS as a continuing public condition is a regression',
    'CE06 lost actor source ACCESS is not lost source AVAILABILITY, and does not end the publication',
    'CE06 availability, unlike actor access, IS a continuing condition',
    'anti-vacuity', 'PUBLIC_SURFACES', 'PUBLIC_WRITERS', 'assertCompletelyDark',
    'every outward Public World surface is in the visibility dependency census',
    'R01', 'R02', 'R03', 'SAVEPOINT forward_safety']) {
    assert.ok(verifier.includes(needle), `the verifier proves ${needle}`);
  }
  // Every §21 probe is paired with a proof that the weakening is REAL.
  assert.ok((verifier.match(/anti-vacuity/gu) ?? []).length >= 6,
    'each mutation probe that could pass vacuously is paired with a proof that it really regresses behaviour');
  // The complete-disappearance census is one helper used everywhere, so a
  // surface cannot be dark in one proof and forgotten in another.
  for (const surface of ['resolve_public_experience_serving_v1', 'resolve_public_experience_semantic_placement_v1',
    'resolve_public_discussion_v1', 'resolve_public_qandeel_responses_v1', 'resolve_public_experience_vitality_v1',
    'search_public_experiences_v1', 'resolve_public_lens_v1', 'resolve_public_panel_v1']) {
    assert.ok(verifier.includes(surface), `the visibility dependency census names ${surface}`);
  }
  for (const surface of ['serving(experience, viewer)', 'resolvePlacement(experience, viewer)',
    'resolveDiscussion(experience, viewer)', 'resolveResponses(experience, viewer)',
    'resolveVitality(experience, viewer)', 'panel(experience, viewer)']) {
    assert.ok(support.includes(`await ${surface}`), `the shared darkness helper asks ${surface}`);
  }
  assert.match(verifier, /\}, \(\) => rt\.client\.end\(\)\.catch\(\(\) => undefined\)\);\s*$/u,
    'the verifier ends its database client through the envelope on every path, so a failure exits instead of hanging the CI step');
  // Every launched blocking promise is awaited only after the release edge.
  for (const [launched, release] of [['posting', "await q('COMMIT')"], ['withdrawing', "await q('COMMIT')"]]) {
    const launch = verifier.indexOf(`const ${launched} = q`);
    assert.ok(launch > 0, `${launched} is LAUNCHED rather than awaited inline`);
    const released = verifier.indexOf(release, launch);
    const settled = Math.min(...[`await ${launched}`, `assert.rejects(${launched}`].map((s) => verifier.indexOf(s, launch)).filter((i) => i > 0));
    assert.ok(released > launch && settled > released, `${launched} is awaited only after the other connection released`);
  }
});
