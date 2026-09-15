// I-05A - Public Experience Draft / Approval / READY_FOR_REVIEW Runtime v1: the
// secret-free structural contract for migration 0093, and the forward-safety and
// anti-vacuity probe for the whole I-05A slice.
//
// Live semantics - real ACLs, real denials, the derived rightsholder set, the
// fail-closed source authority, concurrency and in-database forward safety - are
// proven by database/verify-migration-0093.mjs against real PostgreSQL. What is
// proven HERE is the structure a migration must already have before it deploys.
//
// ## Why the probe lives in this file and not in all three
//
// A mirror-based probe is expensive, and running one per contract would mirror
// the repository three times to prove one property. The probe below mirrors once
// and runs ALL THREE I-05A contracts against the mutated tree, so the property
// every one of them must have - "this is a contract, not a ceiling on the
// roadmap" - is proven for all three from one place.
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
/** Set in the child runs of the probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I05A_PUBLIC_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0093_public_experience_review_ready_runtime_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0093.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
/** The LAST `DO $$ / DECLARE` block is the self-assertion; the earlier one is the grant loop. */
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);

const COMMAND_TABLES = ['public_identity_commands', 'public_experience_draft_commands',
  'publication_package_prepare_commands', 'public_experience_review_ready_commands'];

/** Every function 0093 owns, in the exact form its security posture names. */
const MUTATIONS = [
  'ensure_public_identity_v1',
  'update_public_display_label_v1',
  'create_public_experience_draft_v1',
  'prepare_public_experience_manifest_v1',
  'approve_public_experience_manifest_v1',
  'commit_public_experience_ready_for_review_v1',
];
const DERIVATIONS = ['derive_public_publication_authority_v1', 'resolve_public_package_items_v1'];
const RESOLVER = 'resolve_public_experience_review_v1';

const OWN_SCRIPT = 'verify:public-experience-review-ready-runtime:integration';

const PINNED_PREDECESSORS = [
  ['0087_shared_world_selective_history_access_v1.sql', '46606903867c8cc3570d61ee068d0baf6b9d65d8'],
  ['0089_shared_world_material_persistence_v1.sql', '82d6d5f0c293528649198efee2305ca0baa7b685'],
  ['0090_shared_world_material_commit_owner_deletion_v1.sql', 'c65bb170449e98454b4ba248dad3793b6ea363f8'],
  ['0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
];

/**
 * The body PostgreSQL would store in `prosrc`, found by scanning to the balanced
 * end of the argument list and then to the dollar-quoted body. A lazy regular
 * expression cannot do this reliably when nine functions share one file.
 */
const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0093 creates ${name}`);
  let depth = 1; let i = start + `CREATE FUNCTION public.${name}(`.length;
  while (i < migration.length && depth > 0) {
    if (migration[i] === '(') depth += 1; else if (migration[i] === ')') depth -= 1;
    i += 1;
  }
  const open = migration.indexOf('AS $$', i);
  const end = migration.indexOf('$$;', open + 5);
  assert.ok(open > i && end > open, `${name} has a terminated dollar-quoted body`);
  return { header: migration.slice(i, open), body: migration.slice(open + 'AS $$'.length, end) };
};

/** The DECLARED input parameters of one function - never its RETURNS TABLE columns. */
const inputParameters = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  let depth = 1; let i = start + `CREATE FUNCTION public.${name}(`.length;
  const open = i;
  while (i < migration.length && depth > 0) {
    if (migration[i] === '(') depth += 1; else if (migration[i] === ')') depth -= 1;
    i += 1;
  }
  return [...migration.slice(open, i - 1).matchAll(/(p_\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean)/gu)]
    .map((m) => m[1]);
};

/** The declared RETURNS TABLE column names of one function. */
const resultColumns = (name) => {
  const { header } = functionBody(name);
  const table = /RETURNS TABLE\(([\s\S]*?)\)\s*\n?LANGUAGE/u.exec(header);
  assert.ok(table, `${name} declares a RETURNS TABLE result`);
  return [...table[1].matchAll(/(\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean|timestamptz)/gu)]
    .map((m) => m[1]);
};

// ---------------------------------------------------------------------------

test('0093 is the forward migration after 0092, and every frozen predecessor it consumes is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0093_')).length, 1, 'exactly one migration carries the 0093 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0092_public_experience_publication_package_authority_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  assert.doesNotMatch(executableSql, /^ALTER TABLE public\.(?!public_identity_commands|public_experience_draft_commands|publication_package_prepare_commands|public_experience_review_ready_commands)/mu,
    'the only tables 0093 alters are the four command relations it created');
});

test('no I-05A primitive can produce a public lifecycle, and the READY commit writes exactly one value', () => {
  // `prosrc` INCLUDES comments, and a PostgreSQL regular expression matches `.`
  // across newlines. Both of those are why this is checked here as well as in the
  // migration: a sentence in a comment is enough to make the migration refuse
  // itself at deploy, and that is exactly the failure this check exists to catch.
  for (const name of [...MUTATIONS, ...DERIVATIONS]) {
    const { body } = functionBody(name);
    assert.ok(!body.includes('PUBLISHED'), `${name} cannot produce PUBLISHED - not even in a comment`);
    assert.ok(!body.includes('ABSENT_FROM_PUBLIC_WORLD'), `${name} cannot produce ABSENT_FROM_PUBLIC_WORLD`);
  }
  const commit = functionBody('commit_public_experience_ready_for_review_v1').body;
  assert.match(commit, /SET current_lifecycle = 'READY_FOR_REVIEW'/u);
  assert.equal((commit.match(/current_lifecycle = '/gu) ?? []).length, 1,
    'the READY commit writes exactly one lifecycle value');
  const draft = functionBody('create_public_experience_draft_v1').body;
  assert.match(draft, /'DRAFT', NULL, 1, instant\)/u, 'a created Experience is DRAFT at revision 1 with no version');
  assert.match(selfAssertions, /must not be able to produce a public lifecycle/u);
  assert.match(selfAssertions, /the READY commit must write exactly READY_FOR_REVIEW/u);
});

test('no mutation accepts an authority, approver, audience, visibility, body, ordinal or instant parameter', () => {
  const BANNED = /(approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|body_text|ordinal|count|classification|revision|fingerprint)/u;
  // Every function, not only the mutations: the item resolution and the authority
  // derivation are what the mutations trust, so a caller-supplied approver set
  // smuggled into either of them would be exactly the same forged authority.
  for (const name of [...MUTATIONS, ...DERIVATIONS]) {
    for (const parameter of inputParameters(name)) {
      assert.doesNotMatch(parameter, BANNED, `${name} may not accept ${parameter}`);
    }
  }
  // And the check in the migration reads the INPUT half only. `proargnames` on a
  // RETURNS TABLE function holds the parameters AND the result columns in one
  // array, and every one of these primitives RETURNS a derived ordinal, count or
  // fingerprint - so a mode-blind assertion would refuse this migration for
  // reporting the very values it proves no caller supplied.
  assert.match(selfAssertions, /unnest\(pr\.proargnames, pr\.proargmodes\) AS arg\(name, mode\)\s*\n\s*WHERE pr\.oid = fn::regprocedure AND arg\.mode = 'i'/u);
  const prepared = resultColumns('prepare_public_experience_manifest_v1');
  assert.ok(prepared.some((c) => BANNED.test(c)),
    'and this is not theoretical: the prepare result really does carry a banned-looking name');
});

test('the actor is exactly auth.uid(), derived and never supplied', () => {
  for (const name of MUTATIONS) {
    const { body } = functionBody(name);
    assert.match(body, /u uuid := auth\.uid\(\);/u, `${name} derives its human from auth.uid()`);
    assert.match(body, /IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED'/u,
      `${name} fails closed without an authenticated human`);
  }
  // The draft primitive RESOLVES the actor's stable Public Identity rather than
  // accepting one, so nobody can create an Experience attributed to another human.
  assert.deepEqual(inputParameters('create_public_experience_draft_v1'), ['p_command_id', 'p_experience_id']);
  assert.match(functionBody('create_public_experience_draft_v1').body,
    /SELECT \* INTO identity FROM public\.public_identities i WHERE i\.user_id = u;/u);
  // And the label primitive has no identity parameter at all.
  assert.deepEqual(inputParameters('update_public_display_label_v1'), ['p_command_id', 'p_label_mode', 'p_display_label']);
});

test('the canonical Public lock order is Public World then Experience then manifest then source', () => {
  for (const name of ['create_public_experience_draft_v1', 'prepare_public_experience_manifest_v1',
    'approve_public_experience_manifest_v1', 'commit_public_experience_ready_for_review_v1']) {
    const { body } = functionBody(name);
    assert.match(body, /PERFORM 1 FROM public\.public_world_state w WHERE w\.singleton FOR UPDATE;/u,
      `${name} locks the ONE Public World first`);
  }
  for (const name of ['prepare_public_experience_manifest_v1', 'approve_public_experience_manifest_v1',
    'commit_public_experience_ready_for_review_v1']) {
    const { body } = functionBody(name);
    const world = body.indexOf('public.public_world_state w WHERE w.singleton FOR UPDATE');
    const experience = body.indexOf('public.public_experiences e WHERE e.id');
    assert.ok(world >= 0 && experience > world, `${name} locks the Experience after the World`);
    // The SAME relative order EVERY I-04 consequential mutation uses: the Shared
    // World row, then materials by id, then history items by id. Taking the World
    // row is what makes a source-view answer unable to go stale before the body
    // is copied, and taking it in I-04's own order is what keeps the two domains
    // from ever forming a cycle.
    const sharedWorld = body.indexOf('public.shared_worlds w');
    const materials = body.indexOf('public.shared_world_materials m');
    const history = body.indexOf('public.shared_world_history_items i');
    assert.ok(sharedWorld > experience, `${name} locks the Shared World row after the Public rows`);
    assert.ok(materials > sharedWorld, `${name} locks Shared materials after the Shared World row`);
    assert.ok(history > materials,
      `${name} locks Shared materials before Shared history items, exactly as I-04G does`);
    assert.ok(body.includes('ORDER BY w.id FOR SHARE') && body.includes('ORDER BY m.id FOR SHARE')
      && body.includes('ORDER BY i.id FOR SHARE'),
    `${name} takes SHARE locks in identity order: Public reads Shared truth and never writes it`);
  }
  for (const name of MUTATIONS) {
    const { body } = functionBody(name);
    assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|TRUNCATE/iu, `${name} takes no advisory or table lock`);
    assert.doesNotMatch(body, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/iu,
      `${name} accepts no clock but one read of the database's own`);
  }
});

test('the two Public Identity primitives deliberately take no global lock, and touch one identity only', () => {
  for (const name of ['ensure_public_identity_v1', 'update_public_display_label_v1']) {
    const { body } = functionBody(name);
    assert.ok(!body.includes('public_world_state'),
      `${name} does not serialize every display-label change in the product behind one global row`);
    assert.match(body, /FROM public\.public_identities i WHERE i\.user_id = u FOR UPDATE;/u,
      `${name} serializes on the identity's own row`);
    for (const reached of ['public_experiences', 'public_experience_versions', 'publication_package_manifest_versions',
      'publication_package_manifest_items', 'public_experience_controllers']) {
      assert.ok(!body.includes(reached),
        `${name} reaches no ${reached}: an alias change creates no version and mutates no package`);
    }
  }
});

test('a mutation mutates no predecessor state and re-implements no Shared entitlement', () => {
  for (const name of MUTATIONS) {
    const { body } = functionBody(name);
    assert.doesNotMatch(body, /(INSERT INTO|UPDATE|DELETE FROM) public\.(shared_world|conversation_|users|memories|hypothes|standing_context|matching_|introduction)/u,
      `${name} mutates no Shared Personal or predecessor state`);
    // What is banned is a Public primitive deciding Shared entitlement for
    // itself. Consuming the canonical I-04F entry point is required, not banned.
    for (const forbidden of ['shared_world_membership_episodes', 'shared_world_history_access_grants',
      'shared_world_invite_credential_state', 'shared_world_standard_closed_view_entitlements',
      'shared_world_history_package_manifest_items']) {
      assert.ok(!body.includes(forbidden),
        `${name} must not re-implement Shared authorization out of ${forbidden}`);
    }
  }
  assert.match(selfAssertions, /must not re-implement Shared membership or history authorization: consume the canonical I-04F visibility entry point/u);
});

// ---------------------------------------------------------------------------
// FIX-A. Content publication authority is not source-access authority.
// ---------------------------------------------------------------------------

test('a Shared body is copied only after the initiator is proven currently entitled to SEE it', () => {
  const { body } = functionBody('prepare_public_experience_manifest_v1');
  // It CONSUMES the canonical I-04F entry point rather than re-deriving the answer.
  assert.match(body,
    /FROM public\.resolve_shared_world_history_visibility_v1\(sm\.world_id, u\) v\s*\n\s*WHERE v\.history_item_id = sm\.history_item_id/u,
    'the visibility question is answered by the frozen I-04F entry point, for the exact human and the exact item');
  // And it does so BEFORE anything reads or copies a body. Positions are measured
  // over the EXECUTABLE body with comments stripped: a prose mention of the
  // resolver would otherwise satisfy an ordering claim that no code establishes.
  const code = body.split('\n').map((line) => line.replace(/--.*$/u, '')).join('\n');
  const visibility = code.indexOf('resolve_shared_world_history_visibility_v1');
  const copy = code.indexOf('public.resolve_public_package_items_v1');
  const bodyExists = code.indexOf('shared_world_text_material_bodies');
  const kind = code.indexOf('material_kind NOT IN');
  const authority = code.indexOf('shared_world_material_historical_authority');
  assert.ok(visibility > 0 && copy > visibility, 'the body is copied only after the source-view proof');
  assert.ok(bodyExists > visibility, 'and no body is even probed before it');
  assert.ok(kind > visibility && authority > visibility,
    'the kind and authority checks run after it too, so neither can answer whether a hidden source exists');
  // The denial is the SAME class a nonexistent source gets: a caller learns
  // nothing about whether the id they guessed exists. This reads the exact
  // statement the visibility check raises, not a window around it.
  const visibilityStatement = code.slice(visibility, code.indexOf('END IF;', visibility));
  assert.match(visibilityStatement, /RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE'/u,
    'a hidden Shared source is refused with the same class a nonexistent one gets');
  assert.ok(!visibilityStatement.includes('PUBLIC_EXPERIENCE_NOT_AUTHORIZED'),
    'a hidden Shared source and a nonexistent one are indistinguishable from the error');
  // The nonexistent-source check immediately before it raises that same class.
  const existence = code.lastIndexOf('PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE', visibility);
  assert.ok(existence > 0 && existence < visibility,
    'and the existence check that precedes it raises the identical class');
  // The Shared World row is held while the answer is used.
  assert.match(body, /FROM public\.shared_worlds w\s*\n\s*WHERE w\.id = ANY\(p_shared_source_world_ids\) ORDER BY w\.id FOR SHARE;/u);
  assert.ok(body.indexOf('public.shared_worlds w') < visibility,
    'the Shared World row is locked before the visibility answer is resolved, so it cannot go stale');
  assert.match(selfAssertions, /publication preparation must prove the initiator may currently SEE each selected Shared history item/u);
  assert.match(selfAssertions, /publication preparation must synchronize on the exact Shared World row before resolving source visibility/u);
  assert.match(selfAssertions, /the frozen I-04F history visibility entry point must still be reachable/u);
  // Approving is a different right and reads no visibility at all.
  assert.ok(!functionBody('approve_public_experience_manifest_v1').body.includes('resolve_shared_world_history_visibility_v1'),
    'approving your own included material never asks whether you may browse: material authority survives membership loss');
});

// ---------------------------------------------------------------------------
// FIX-B. The approval binds the protected action, not the command.
// ---------------------------------------------------------------------------

test('the manifest binds PUBLISH_TO_PUBLIC_WORLD while the prepare command stays PREPARE_PUBLICATION', () => {
  const { body } = functionBody('prepare_public_experience_manifest_v1');
  assert.match(body, /'PUBLISH_TO_PUBLIC_WORLD', 'PUBLIC_WORLD_AUDIENCE', 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY'/u,
    'the manifest intends the protected audience-expansion action');
  assert.match(body, /'PREPARE_PUBLICATION', total, derived_count/u,
    'the command that ran stays in its own namespace');
  // AB04 the prepare request reference is a different digest namespace entirely.
  assert.match(body, /QANDEEL_CWV2_PUBLIC_PACKAGE_PREPARE_COMMAND_V1/u);
  const derive = functionBody('derive_public_publication_authority_v1').body;
  assert.match(derive, /'action=' \|\| manifest\.intended_publication_action/u,
    'AB02 the authority fingerprint binds the INTENDED protected action');
  assert.ok(!derive.includes('PREPARE_PUBLICATION'),
    'and never the preparation command');
  assert.match(selfAssertions, /a manifest must not intend PREPARE_PUBLICATION: preparing is not audience expansion/u);
  assert.match(selfAssertions, /the intended publication action and the prepare command action must each be pinned/u);
  assert.match(selfAssertions, /the authority request fingerprint must bind the intended publication action/u);
  // AB05 binding the future action changes nothing about what this slice does.
  const commit = functionBody('commit_public_experience_ready_for_review_v1').body;
  assert.ok(!commit.includes('PUBLISH_TO_PUBLIC_WORLD'),
    'AB05 the READY commit executes no publication: it only checks the authority the manifest already bound');
});

test('the Personal source adapter is the canonical committed unit, owner-exact, and fails closed on analysis', () => {
  const { body } = functionBody('prepare_public_experience_manifest_v1');
  assert.match(body, /FROM public\.conversation_units cu\s*\n\s*WHERE cu\.id = ANY\(p_personal_source_unit_ids\) AND cu\.user_id <> u/u,
    'another human cannot prepare a Personal source they do not own');
  assert.match(body, /cu\.source_role <> 'USER'[\s\S]{0,200}?PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u,
    'Personal QANDEEL analysis fails CLOSED: no reviewed protected-human subject-authority producer exists');
  assert.ok(!body.includes('conversation_turns') && !body.includes('conversation_sessions'),
    'the adapter binds the committed Conversational Unit, never the mutable operational envelope');
  // There is no durable Personal voice source at all, so none is faked.
  assert.ok(!body.includes('audio_object_ref'), 'and no Personal voice adapter is invented');
});

test('the Shared source adapter uses the exact I-04G authority and fails closed on unresolved or reserved kinds', () => {
  const { body } = functionBody('prepare_public_experience_manifest_v1');
  assert.match(body, /sm\.material_kind NOT IN \('HUMAN_TEXT', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS'\)/u);
  assert.match(body, /PUBLIC_EXPERIENCE_SOURCE_KIND_RESERVED/u,
    'HUMAN_VOICE_NOTE has no reviewed public media boundary; the two RESERVED kinds have no producer at all');
  assert.match(body, /shared_world_material_historical_authority ha[\s\S]{0,400}?PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u,
    'unresolved additional human authority fails closed for package inclusion');
  assert.match(body, /ha\.resolution_state IN \('RESOLVED_EXACT_HUMAN_REQUIREMENT',\s*\n?\s*'RESOLVED_NO_HUMAN_REQUIREMENT'\)/u,
    'and so does the ABSENCE of any source-side authority metadata: missing never means empty');
  assert.match(body, /i\.availability_state <> 'AVAILABLE'/u, 'an unavailable source cannot enter a package');
});

test('the ONE authority derivation is the only one, and every consumer calls it', () => {
  const derive = functionBody('derive_public_publication_authority_v1').body;
  // It fails closed rather than returning a partial answer.
  for (const failure of ['PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE', 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED',
    'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE']) {
    assert.ok(derive.includes(failure), `the derivation raises ${failure}`);
  }
  // The rightsholder set is the exact UNION over the INCLUDED material.
  assert.match(derive, /FROM public\.publication_package_item_provenance p\s*\n\s*JOIN public\.shared_world_history_item_required_approvers ra\s*\n\s*ON ra\.history_item_id = p\.shared_history_item_id/u);
  assert.match(derive, /SELECT p\.personal_owner_user_id AS approver/u);
  assert.ok(!derive.includes('shared_world_membership_episodes'),
    'membership contributes nothing to the rightsholder set: the derivation never reads an episode');
  assert.ok(!derive.includes('shared_world_history_item_baseline_viewers'),
    'and neither does the original delivery audience');
  // The fingerprint binds the whole authority-relevant request identity.
  for (const bound of ['action=', 'target=PUBLIC_WORLD', 'audienceClass=', 'readiness=', 'experience=',
    'experienceVersion=', 'manifest=', 'publisher=', 'sourceScope=', 'requiredApprovers=', 'authoritySnapshot=']) {
    assert.ok(derive.includes(bound), `the authority request fingerprint binds ${bound}`);
  }
  // And it deliberately does NOT bind the viewing policy.
  assert.ok(!derive.includes('public_audience_policy_state'),
    'the fingerprint binds no viewing policy: who may view is a gate, not the identity of a package');
  for (const consumer of ['prepare_public_experience_manifest_v1', 'approve_public_experience_manifest_v1',
    'commit_public_experience_ready_for_review_v1']) {
    assert.match(functionBody(consumer).body,
      /FROM public\.derive_public_publication_authority_v1\(/u, `${consumer} uses the ONE derivation`);
  }
});

test('the READY commit requires an exact controller, a current version, complete approvals and a current fingerprint', () => {
  const { body } = functionBody('commit_public_experience_ready_for_review_v1');
  assert.match(body, /public\.public_experience_controllers c\s*\n\s*WHERE c\.experience_id = p_experience_id AND c\.controller_user_id = u/u);
  assert.match(body, /experience\.current_experience_version_id IS DISTINCT FROM p_experience_version_id[\s\S]{0,120}?PUBLIC_EXPERIENCE_STALE/u,
    'a newer preparation stales this attempt rather than committing an old package');
  assert.match(body, /IF satisfied <> derived_count THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE'/u,
    'a controller cannot substitute for a missing content approval');
  assert.match(body, /a\.bound_authority_fingerprint <> derived_fingerprint[\s\S]{0,160}?PUBLIC_EXPERIENCE_STALE/u,
    'an approval collected against a different authority cannot float forward');
  assert.match(body, /IF stored <> derived_approvers THEN\s*\n\s*RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE'/u,
    'a changed rightsholder set stales the commit');
  // And it writes no controller row, so committing grants nobody new control.
  assert.ok(!body.includes('INSERT INTO public.public_experience_controllers'));
  assert.ok(!functionBody('approve_public_experience_manifest_v1').body.includes('public_experience_controllers'),
    'approving your own included material grants NO Experience control');
});

test('the ONE review resolver is controller-only and discloses no private identity or sealed provenance', () => {
  const { header, body } = functionBody(RESOLVER);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''/u);
  assert.match(body, /JOIN public\.public_experience_controllers c\s*\n\s*ON c\.experience_id = e\.id AND c\.controller_user_id = p_user_id/u,
    'a non-controller joins to nothing and receives zero rows, which discloses no existence');
  assert.ok(!body.includes('publication_package_item_provenance'), 'it never reads sealed provenance');
  const columns = resultColumns(RESOLVER);
  for (const column of columns) {
    assert.doesNotMatch(column,
      /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id/u,
      `the review resolver must not return ${column}`);
  }
  assert.ok(columns.includes('publisher_public_identity_ref') && columns.includes('publisher_display_label'),
    'it returns the stable public ref and the current display label, never the account behind them');
  assert.ok(columns.includes('approvals_complete'), 'and the approval completion state');
});

test('every primitive is internal, and only the review resolver is reachable by an application role', () => {
  for (const name of [...MUTATIONS, ...DERIVATIONS]) {
    assert.ok(executableSql.includes(`REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated`)
      || executableSql.includes(`'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated'`),
      'every internal function is revoked through one loop');
    assert.ok(executableSql.includes(name), `${name} is named in the security posture`);
  }
  assert.match(executableSql, /GRANT EXECUTE ON FUNCTION %s TO service_role/u);
  const grants = [...executableSql.matchAll(/GRANT EXECUTE ON FUNCTION ([^\n']+)/gu)].map((m) => m[1].trim());
  assert.deepEqual(grants, ['%s TO service_role'],
    'the ONE grant in the migration is the review resolver, granted through the loop');
  assert.ok(executableSql.includes(`resolver text := 'public.${RESOLVER}(uuid, uuid)'`));
  for (const name of MUTATIONS) {
    assert.match(functionBody(name).header, /LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''/u);
  }
  for (const name of DERIVATIONS) {
    assert.match(functionBody(name).header, /SECURITY DEFINER STABLE SET search_path=''/u);
    assert.ok(!functionBody(name).body.includes('INSERT INTO'), `${name} writes nothing`);
  }
});

test('durable idempotency binds the whole immutable request, in every command family', () => {
  for (const [name, table] of [
    ['create_public_experience_draft_v1', 'public_experience_draft_commands'],
    ['prepare_public_experience_manifest_v1', 'publication_package_prepare_commands'],
    ['commit_public_experience_ready_for_review_v1', 'public_experience_review_ready_commands'],
    ['ensure_public_identity_v1', 'public_identity_commands'],
    ['update_public_display_label_v1', 'public_identity_commands'],
  ]) {
    const { body } = functionBody(name);
    assert.match(body, new RegExp(`FROM public\\.${table} c WHERE c\\.id = p_command_id`, 'u'),
      `${name} answers an equivalent retry from its durable command`);
    assert.match(body, /committed\.request_ref <> request[\s\S]{0,140}?PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u,
      `${name} refuses a conflicting identity reuse`);
  }
  // The three Experience-flow commands check twice: before any lock, and under it.
  for (const name of ['create_public_experience_draft_v1', 'prepare_public_experience_manifest_v1',
    'commit_public_experience_ready_for_review_v1']) {
    const { body } = functionBody(name);
    assert.ok((body.match(/WHERE c\.id = p_command_id/gu) ?? []).length >= 2,
      `${name} re-checks idempotency under the lock, so two competing commands serialize`);
  }
  for (const table of COMMAND_TABLES) {
    assert.match(executableSql, new RegExp(`CONSTRAINT ${table}_request_check\\s*\\n?\\s*CHECK \\(request_ref ~ '\\^sha256`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
});

test('no route, controller, mobile surface, Safety, Launch, entitlement or serving state is created', () => {
  for (const banned of ['@Controller', '@Get', '@Post', '@Module', 'CREATE POLICY', 'CREATE EVENT TRIGGER',
    'CREATE RULE', 'CREATE SERVER', 'CREATE EXTENSION', 'pg_cron', 'http_post']) {
    assert.ok(!executableSql.includes(banned), `0093 creates no ${banned}`);
  }
  for (const banned of ['semantic_placement', 'public_discussion', 'public_reply', 'public_vitality',
    'public_search', 'public_lens', 'replay_', 'moderation_', 'launch_gate', 'entitlement_']) {
    assert.ok(!executableSql.includes(banned), `and no ${banned} state`);
  }
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  for (const phrase of [
    'must be owned by postgres',
    'must be SECURITY DEFINER',
    'must pin an empty search_path',
    'before the frozen CW2-08 Launch Gate exists',
    'consequential primitive % must be VOLATILE',
    'derivation % must be STABLE',
    'derivation % must write nothing',
    'the review resolver must be a STABLE SECURITY DEFINER with an empty search_path',
    'service_role must execute the ONE review resolver',
    'the review resolver must disclose no private identity and no sealed provenance',
    'the review resolver must never read sealed provenance',
    'must not be able to produce a public lifecycle',
    'the READY commit must write exactly READY_FOR_REVIEW',
    'may not accept an authority audience visibility body ordinal or instant parameter',
    'accepts no clock but one read of the database clock',
    'must mutate no Shared Personal or predecessor state',
    'must not re-implement Shared membership or history authorization',
    'publication preparation must prove the initiator may currently SEE each selected Shared history item',
    'publication preparation must synchronize on the exact Shared World row before resolving source visibility',
    'the frozen I-04F history visibility entry point must still be reachable',
    'a manifest must not intend PREPARE_PUBLICATION: preparing is not audience expansion',
    'the intended publication action and the prepare command action must each be pinned',
    'the authority request fingerprint must bind the intended publication action',
    'the frozen committed Personal source must still be append-only',
    'the frozen I-04G historical widening gate must still be in place',
    'the frozen I-04G material resolver must still be reachable',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the migration refuses itself when: ${phrase}`);
  }
  assert.match(selfAssertions, /cfg IN \('search_path=', 'search_path=""'\)/u,
    'both stored forms of an empty search_path are accepted, as the frozen I-04G assertion does');
  assert.match(selfAssertions, /has_function_privilege\('public', fn, 'EXECUTE'\)/u,
    'PUBLIC is read through the pseudo-role, which a NULL proacl cannot silently pass');
});

test('0093 is registered in the toolchain, in CI and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0093\\.mjs"`, 'u'));
  assert.ok(workflow.includes(`run: npm run ${OWN_SCRIPT}}`), 'the verifier runs in API CI');
  assert.match(readme, /0093_public_experience_review_ready_runtime_v1\.sql/u);
  assert.match(verifier, /verifier for migration 0093/iu);
  const step = new RegExp(`- \\{name: ([^,}]*), run: npm run ${OWN_SCRIPT}\\}`, 'u').exec(workflow);
  assert.ok(step, 'the CI step is one well-formed flow mapping whose name carries no comma');
});

test('the verifier proves its forward safety inside a rolled-back savepoint, and then proves the regressions', () => {
  assert.match(verifier, /SAVEPOINT forward_safety/u);
  assert.match(verifier, /ROLLBACK TO SAVEPOINT forward_safety/u);
  // Every later reviewed addition CW2-04 and the I-05 plan already schedule.
  for (const authorized of ['semantic_placement', 'public_discussion', 'public_qandeel', 'vitality',
    'search_projection', 'owner_deletion', 'replay_source', 'launch_gate', 'CREATE INDEX', 'CREATE TRIGGER',
    // FIX-C. Final publication must be able to reject an approval withdrawn
    // before publish, so a later reviewed effective-approval-state writer must
    // not be a regression against anything I-05A froze.
    'approval_effective_state', 'approval_withdrawal']) {
    assert.ok(verifier.includes(authorized),
      `the probe proves a later reviewed ${authorized} is not an I-05A regression`);
  }
});

test('FIX-C: nothing I-05A owns freezes a historical approval row as eternally effective', () => {
  // The historical row stays append-only evidence - that is deliberate, and the
  // review explicitly does not want retroactive deletion of it. What must stay
  // possible is an ADDITIVE later relation that says whether that evidence is
  // still EFFECTIVE at publish time.
  assert.match(read('../migrations/0092_public_experience_publication_package_authority_v1.sql'),
    /BEFORE UPDATE OR DELETE ON public\.publication_manifest_approvals/u,
    'the approval event itself remains immutable historical evidence');
  // Nothing claims the approval set is the final word on publication authority.
  const commit = functionBody('commit_public_experience_ready_for_review_v1').body;
  assert.ok(!commit.includes('PUBLISHED'),
    'the READY commit is not a publication decision, so its approval count is not a publication permit');
  // And no self-assertion REFUSES a later effective-state or withdrawal object.
  // This reads the messages the migration can raise, not every occurrence of the
  // word: `REVOKE ALL ON FUNCTION` contains "revoke" and forbids nothing.
  const refusals = [...selfAssertions.matchAll(/RAISE EXCEPTION '([^']*)'/gu)].map((m) => m[1].toLowerCase());
  for (const shape of ['effective', 'withdraw', 'supersed', 'revoke', 'approval_state']) {
    const offender = refusals.find((message) => message.includes(shape));
    assert.equal(offender, undefined,
      `no self-assertion forbids a later reviewed approval ${shape} state; found: ${offender}`);
  }
  // Nor does any of them cap the relations, functions or triggers that may exist.
  assert.ok(!selfAssertions.includes('count(*) = '), 'no self-assertion caps how many objects may exist');
});

// ---------------------------------------------------------------------------
// Forward safety and anti-vacuity for the WHOLE I-05A slice.
// ---------------------------------------------------------------------------

const I05A_CONTRACTS = [
  'database/tests/public-world-experience-foundation-v1.test.mjs',
  'database/tests/public-experience-publication-authority-v1.test.mjs',
  'database/tests/public-experience-review-ready-runtime-v1.test.mjs',
];
const MIRRORED = ['.github', 'database', 'tests', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i05a-public-');
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(mirror, entry), { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  return mirror;
}
const write = (mirror, relative, text) => {
  mkdirSync(dirname(join(mirror, relative)), { recursive: true });
  writeFileSync(join(mirror, relative), text);
};
function patch(mirror, relative, from, to) {
  const target = join(mirror, relative);
  const text = readFileSync(target, 'utf8');
  assert.ok(text.includes(from),
    `the mirrored ${relative} contains the text to patch; it does not contain:\n${from}`);
  // An anchor that appears twice silently mutates the FIRST occurrence, which may
  // not be the one the regression is about - and a regression planted somewhere
  // else proves nothing about the place it was aimed at.
  assert.equal(text.indexOf(from), text.lastIndexOf(from),
    `the patch anchor for ${relative} occurs more than once, so the mutation would land somewhere unintended`);
  writeFileSync(target, text.replace(from, to));
}
function runInMirror(mirror) {
  // `NODE_TEST_CONTEXT` must be removed, or the child decides it is already
  // inside a test run, SKIPS every file it was given and exits 0 - which would
  // make this whole probe pass while proving nothing at all.
  const env = { ...process.env, [PROBE_CHILD]: '1' };
  delete env.NODE_TEST_CONTEXT;
  const files = I05A_CONTRACTS.map((relative) => join(mirror, relative));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    { cwd: mirror, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.error, undefined, `the mirrored contracts could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'the mirrored contracts did not exit normally');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  // And the child must really have run them: a run that executed no test is not
  // evidence of anything.
  assert.match(output, /# pass \d+/u, `the mirrored contracts reported no results:\n${output.slice(-1500)}`);
  assert.doesNotMatch(output, /# pass 0\b/u, 'the mirrored contracts executed nothing');
  return { ok: result.status === 0, output };
}

test('every authorized later I-05B / I-05C / CW2-08 addition leaves all three I-05A contracts passing',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const mirror = buildMirror();
    try {
      // The whole of what I-05B and I-05C are scheduled to build, plus a CW2-08
      // launch wrapper and ordinary additive maintenance, written as one later
      // authorized migration that owns its own objects.
      write(mirror, 'database/migrations/0094_public_semantic_publication_v1.sql',
        'BEGIN;\n'
        + 'CREATE TABLE public.public_experience_semantic_placement (\n'
        + '  experience_version_id uuid PRIMARY KEY, placement_ref text NOT NULL);\n'
        + 'CREATE TABLE public.public_discussion_threads (\n'
        + '  id uuid PRIMARY KEY, experience_id uuid NOT NULL REFERENCES public.public_experiences (id));\n'
        + 'CREATE TABLE public.public_qandeel_responses (id uuid PRIMARY KEY, thread_id uuid NOT NULL);\n'
        + 'CREATE TABLE public.public_experience_vitality_state (experience_id uuid PRIMARY KEY, heat integer NOT NULL);\n'
        + 'CREATE TABLE public.public_search_projection (experience_id uuid PRIMARY KEY, lens text NOT NULL);\n'
        + 'CREATE TABLE public.public_experience_replay_source (package_item_id uuid PRIMARY KEY, replay_id uuid NOT NULL);\n'
        + 'CREATE TABLE public.public_launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL);\n'
        // FIX-C. The later reviewed effective-approval state I-05B composes at
        // final PUBLISH revalidation, plus its withdrawal event. Both are purely
        // additive beside the append-only historical approval evidence.
        + 'CREATE TABLE public.publication_approval_effective_state (\n'
        + '  approval_id uuid PRIMARY KEY REFERENCES public.publication_manifest_approvals (id),\n'
        + "  effective_state text NOT NULL CHECK (effective_state IN ('EFFECTIVE', 'WITHDRAWN', 'SUPERSEDED')));\n"
        + 'CREATE TABLE public.publication_approval_withdrawal_events (\n'
        + '  id uuid PRIMARY KEY, approval_id uuid NOT NULL REFERENCES public.publication_manifest_approvals (id),\n'
        + '  occurred_at timestamptz NOT NULL);\n'
        + 'CREATE FUNCTION public.withdraw_publication_approval_v1(p_id uuid) RETURNS void\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + '  BEGIN UPDATE public.publication_approval_effective_state s\n'
        + "          SET effective_state = 'WITHDRAWN' WHERE s.approval_id = p_id; END$fn$;\n"
        + 'ALTER TABLE public.public_experiences ADD COLUMN published_at timestamptz;\n'
        + 'ALTER TABLE public.publication_package_manifest_versions ADD COLUMN provider_metadata text;\n'
        + 'CREATE INDEX public_experiences_lifecycle_idx ON public.public_experiences (current_lifecycle);\n'
        + 'CREATE FUNCTION public.publish_public_experience_v1(p_id uuid) RETURNS void\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + "  BEGIN UPDATE public.public_experiences e SET current_lifecycle = 'PUBLISHED' WHERE e.id = p_id; END$fn$;\n"
        + 'CREATE FUNCTION public.delete_public_experience_v1(p_id uuid) RETURNS void\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$;\n"
        + 'CREATE FUNCTION public.public_experience_audit_v1() RETURNS trigger\n'
        + "  LANGUAGE plpgsql AS $fn$ BEGIN RETURN NEW; END$fn$;\n"
        + 'CREATE TRIGGER public_experiences_audit AFTER INSERT ON public.public_experiences\n'
        + '  FOR EACH ROW EXECUTE FUNCTION public.public_experience_audit_v1();\n'
        + 'GRANT EXECUTE ON FUNCTION public.publish_public_experience_v1(uuid) TO service_role;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0094.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/public-semantic-publication-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      patch(mirror, '.github/workflows/api-ci.yml',
        `- {name: Verify Public Experience draft approval and READY_FOR_REVIEW runtime against real PostgreSQL`,
        `- {name: Verify a later I-05B slice, run: npm run verify:public-semantic-publication:integration}\n`
        + `      - {name: Verify Public Experience draft approval and READY_FOR_REVIEW runtime against real PostgreSQL`);
      const { ok, output } = runInMirror(mirror);
      assert.ok(ok,
        'a later reviewed semantic placement table, public discussion, Public QANDEEL producer, vitality and '
        + 'search projection, Replay source adapter, owner-deletion writer, PUBLISHED transition, launch gate, '
        + 'additive columns, an index, an audit trigger and a new CI gate must all leave I-05A passing:\n'
        + output.slice(-2500));
    } finally {
      removeHarnessMirror(mirror);
    }
  });

test('the contracts are not vacuous: every deliberate weakening of I-05A is refused by at least one of them',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const M91 = 'database/migrations/0091_public_world_experience_identity_foundation_v1.sql';
    const M92 = 'database/migrations/0092_public_experience_publication_package_authority_v1.sql';
    const M93 = `database/migrations/${MIGRATION_NAME}`;
    const regressions = [
      ['a second Public World becomes representable', M91,
        '    CONSTRAINT public_world_state_singleton_check CHECK (singleton),\n', ''],
      ['the Public Identity ref may equal the private account id', M91,
        '    CONSTRAINT public_identities_ref_not_account_check CHECK (public_identity_ref <> user_id),\n', ''],
      ['a Public Experience becomes a World row', M91,
        '    current_lifecycle text NOT NULL,', '    current_lifecycle text NOT NULL,\n    world_type text,'],
      ['Experience control is derived from an approval', M91,
        '    control_basis text NOT NULL,', '    control_basis text NOT NULL,\n    approval_id uuid,'],
      ['an Experience version becomes mutable', M91,
        'CREATE TRIGGER public_experience_versions_immutable', 'CREATE TRIGGER public_experience_versions_later'],
      ['the audience policy becomes part of Experience identity', M91,
        '    CONSTRAINT public_experiences_world_fk', '    CONSTRAINT public_experiences_policy_fk\n'
        + '        FOREIGN KEY (public_world_singleton)\n'
        + '        REFERENCES public.public_audience_policy_state (singleton) ON DELETE RESTRICT,\n'
        + '    CONSTRAINT public_experiences_world_fk'],
      ['a source identifier appears in the public package item', M92,
        '    public_body_digest text NOT NULL,', '    public_body_digest text NOT NULL,\n    shared_world_id uuid,'],
      ['provenance binds a Shared body owner deletion destroys', M92,
        'REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT',
        'REFERENCES public.shared_world_text_material_bodies (material_id) ON DELETE RESTRICT'],
      ['an unresolved item becomes representable inside a package', M92,
        "CHECK (resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT'))",
        "CHECK (resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT', 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'))"],
      ['an approval escapes the derived required approver set', M92,
        'REFERENCES public.publication_manifest_required_approvers\n                   (manifest_version_id, approver_user_id) ON DELETE RESTRICT',
        'REFERENCES public.publication_package_manifest_versions (id) ON DELETE RESTRICT'],
      ['a package may be empty', M92, 'CHECK (item_count > 0)', 'CHECK (item_count >= 0)'],
      ['the manifest asserts a Safety decision', M92,
        '    item_count integer NOT NULL,', '    item_count integer NOT NULL,\n    safety_allow boolean,'],
      ['a caller may supply the approver set to the preparation', M93,
        'CREATE FUNCTION public.prepare_public_experience_manifest_v1(\n  p_command_id uuid,',
        'CREATE FUNCTION public.prepare_public_experience_manifest_v1(\n  p_required_approver_ids uuid[],\n  p_command_id uuid,'],
      ['a caller may supply the approver set to the item resolution', M93,
        'CREATE FUNCTION public.resolve_public_package_items_v1(\n  p_personal_package_item_ids uuid[],',
        'CREATE FUNCTION public.resolve_public_package_items_v1(\n  p_content_authority_ids uuid[],\n  p_personal_package_item_ids uuid[],'],
      ['Personal QANDEEL analysis stops failing closed', M93,
        "WHERE cu.id = ANY(p_personal_source_unit_ids) AND cu.source_role <> 'USER') THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED' USING ERRCODE='55000';",
        "WHERE cu.id = ANY(p_personal_source_unit_ids) AND cu.source_role = 'SYSTEM') THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';"],
      ['unresolved Shared authority stops failing closed', M93,
        "                          AND ha.resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT',\n                                                      'RESOLVED_NO_HUMAN_REQUIREMENT'))",
        '                          AND ha.material_id IS NOT NULL)'],
      ['the READY commit stops requiring complete approvals', M93,
        "  IF satisfied <> derived_count THEN\n    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE' USING ERRCODE='P0002';\n  END IF;\n", ''],
      ['a primitive becomes executable by an application role', M93,
        "    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);",
        "    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);"],
      ['the review resolver discloses the account behind a public identity', M93,
        '              publisher_label_mode text, publisher_display_label text, package_item_id uuid,',
        '              publisher_label_mode text, publisher_display_label text, publisher_user_id uuid, package_item_id uuid,'],
      ['the review resolver stops requiring a controller', M93,
        '    JOIN public.public_experience_controllers c\n      ON c.experience_id = e.id AND c.controller_user_id = p_user_id',
        '    LEFT JOIN public.public_experience_controllers c\n      ON c.experience_id = e.id'],
      ['a mutation re-implements Shared entitlement out of membership episodes', M93,
        '  -- ===================== THE PERSONAL SOURCE ADAPTER =====================',
        '  PERFORM 1 FROM public.shared_world_membership_episodes ep WHERE ep.ended_at IS NULL;\n'
        + '  -- ===================== THE PERSONAL SOURCE ADAPTER ====================='],
      ['preparation stops proving the initiator may see the Shared source', M93,
        '    SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(sm.world_id, u) v\n'
        + '          WHERE v.history_item_id = sm.history_item_id)',
        '    SELECT 1 FROM public.shared_world_history_items v\n'
        + '          WHERE v.id = sm.history_item_id)'],
      ['preparation stops holding the Shared World row while it resolves visibility', M93,
        '  PERFORM 1 FROM public.shared_worlds w\n'
        + '    WHERE w.id = ANY(p_shared_source_world_ids) ORDER BY w.id FOR SHARE;\n', ''],
      ['a hidden Shared source is denied with a different class than a nonexistent one', M93,
        '         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(sm.world_id, u) v\n'
        + '          WHERE v.history_item_id = sm.history_item_id)\n'
        + '  ) THEN\n'
        + "    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';",
        '         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(sm.world_id, u) v\n'
        + '          WHERE v.history_item_id = sm.history_item_id)\n'
        + '  ) THEN\n'
        + "    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';"],
      ['the manifest intends the preparation command instead of the protected action', M92,
        "CHECK (intended_publication_action = 'PUBLISH_TO_PUBLIC_WORLD')",
        "CHECK (intended_publication_action IN ('PREPARE_PUBLICATION', 'PUBLISH_TO_PUBLIC_WORLD'))"],
      ['the fingerprint stops binding the intended publication action', M93,
        "     || 'action=' || manifest.intended_publication_action || E'\\n'\n", ''],
      ['a frozen predecessor migration is edited',
        'database/migrations/0090_shared_world_material_commit_owner_deletion_v1.sql', 'BEGIN;', 'BEGIN;\n-- edited\n'],
      ['the CI step that runs an I-05A verifier is removed', '.github/workflows/api-ci.yml',
        `run: npm run ${OWN_SCRIPT}}`, 'run: npm run test:toolchain}'],
    ];
    for (const [reason, file, from, to] of regressions) {
      const fresh = buildMirror();
      try {
        patch(fresh, file, from, to);
        const { ok, output } = runInMirror(fresh);
        assert.equal(ok, false,
          `a repository where ${reason} must break at least one I-05A contract; all three passed:\n${output.slice(-1500)}`);
      } finally {
        removeHarnessMirror(fresh);
      }
    }
  });
