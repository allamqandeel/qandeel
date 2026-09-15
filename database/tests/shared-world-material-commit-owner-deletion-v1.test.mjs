// I-04G - Shared Material Commit Runtime and Owner Deletion v1: the secret-free
// structural contract for migration 0090.
//
// Live semantics - ACLs, real denials, the atomic commit, the one instant, the
// derived audience and authority, the physical body removal, the transitive
// invalidation, the multi-connection races and forward safety - are proven by
// database/verify-migration-0090.mjs against real PostgreSQL, which this file
// pins into the toolchain and CI. What is proven HERE is the structure a
// migration must already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04G PART B: that THIS slice implemented the
// human and QANDEEL material commit runtime and the human owner deletion over the
// frozen I-04F projection and the 0089 material store - and nothing beyond it. No
// route, controller, public RPC, mobile surface, Launch Gate, safety or
// moderation policy, no media storage provider, no history-grant withdrawal, no
// Introduction, explicit-disclosure or World-event producer, no human-to-human
// live call, and no reinterpretation of the frozen I-03G
// READY_FOR_LATER_DELIVERY_GATES - and that it modified no predecessor migration
// at all.
//
// It deliberately does NOT prove that a later reviewed producer, wrapper, column,
// index, audit trigger or consumer may never appear. Every assertion is scoped to
// migration 0090 itself, the verifier it added, the registration lines it added,
// and the frozen predecessors it was required not to modify - pinned by content
// hash, which proves immutability without banning additions. Migration 0089 is
// deliberately NOT content-pinned here: it is this slice's own sibling, shipping
// in the same PR, and pinning a sibling would pin a hash that is still moving.
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
const SELF = 'shared-world-material-commit-owner-deletion-v1.test.mjs';
/** Set in the child runs of the forward-safety probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04G_RUNTIME_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0090_shared_world_material_commit_owner_deletion_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0090.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
/** The frozen I-03G readiness boundary this migration's evidence binding must reproduce exactly. */
const readiness = read('../../apps/api/src/connected-worlds/source-disclosure/shared-privacy-authority-delivery-readiness.service.ts');
/** The frozen I-03D audience boundary whose snapshot fingerprint this migration revalidates against. */
const audience = read('../../apps/api/src/connected-worlds/audience/shared-human-audience-resolver.service.ts');
/** The narrow internal evidence binder this slice adds, which is registered nowhere. */
const binder = read('../../apps/api/src/connected-worlds/material-commit/shared-qandeel-material-commit-binding.ts');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
const selfAssertions = executableSql.slice(executableSql.indexOf('DO $$\nDECLARE'));

const COMMIT_COMMANDS = 'shared_world_material_commit_commands';
const EVIDENCE = 'shared_world_qandeel_material_evidence';
const AUTHORITY = 'shared_world_material_historical_authority';
const DELETED_EVENTS = 'shared_world_material_deleted_events';
const DELETE_COMMANDS = 'shared_world_material_delete_commands';
const OWN_TABLES = [COMMIT_COMMANDS, EVIDENCE, AUTHORITY, DELETED_EVENTS, DELETE_COMMANDS];

const HUMAN_CORE = 'commit_shared_world_human_material_v1';
const TEXT_FN = 'commit_shared_world_human_text_v1';
const VOICE_FN = 'commit_shared_world_human_voice_note_v1';
const QANDEEL_FN = 'commit_shared_world_qandeel_material_v1';
const DELETE_FN = 'delete_shared_world_owned_material_v1';
const GATE_FN = 'shared_world_material_historical_widening_gate_v1';
const OWN_FUNCTIONS = [HUMAN_CORE, TEXT_FN, VOICE_FN, QANDEEL_FN, DELETE_FN];
const ALL_FUNCTIONS = [...OWN_FUNCTIONS, GATE_FN];
const OWN_SCRIPT = 'verify:shared-world-material-commit-owner-deletion:integration';

const functionBody = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0090 creates ${name}`);
  const start = migration.indexOf('AS $$', create);
  assert.ok(start > create, `${name} opens a dollar-quoted body`);
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, `${name} has a terminated body`);
  return migration.slice(start + 'AS $$'.length, end + '\nEND'.length);
};
const BODY = Object.fromEntries(ALL_FUNCTIONS.map((name) => [name, functionBody(name)]));

/**
 * The declared parameter list of one function. `RETURNS` may sit on the same line
 * as the closing parenthesis or on the next one, so the terminator is matched
 * rather than assumed.
 */
const signature = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0090 creates ${name}`);
  const open = create + `CREATE FUNCTION public.${name}(`.length;
  const terminator = /\)\s*RETURNS/u.exec(migration.slice(open));
  assert.ok(terminator, `${name} has a terminated parameter list`);
  return migration.slice(open, open + terminator.index);
};
const parameters = (name) => [...signature(name).matchAll(/(p_[a-z_0-9]+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer)/gu)].map((m) => m[1]);

const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0090 creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};
const columnLines = (name) => tableBlock(name).split('\n')
  .filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line));

/** The frozen predecessor migrations, pinned by content rather than by absence. */
const PINNED_PREDECESSORS = [
  ['0075_connected_worlds_shared_persistence_foundation_v1.sql', '3119d34a4edd4c934067393eb278077fd294852b'],
  ['0076_shared_world_standing_context_grant_persistence_v1.sql', '3b2e1f35f1a7441ac09c482877294df5d42b9693'],
  ['0077_shared_standing_context_grant_resolution_boundary_v1.sql', '2d14702f11fda7379d911e275c4e4c6ce1f6732d'],
  ['0078_shared_standing_context_consent_commands_v1.sql', '9f5d169627b1b888ba1ddb1ab1151d1895eb07da'],
  ['0079_shared_human_audience_snapshot_resolution_v1.sql', 'e3b3f6397d02a82e4f472da26795913b0b67ae7b'],
  ['0080_shared_pre_model_world_state_resolution_v1.sql', '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0'],
  ['0081_shared_direct_invitation_runtime_v1.sql', '19789819a2076830fbc0d328909e3f4e8a35be66'],
  ['0082_shared_direct_world_birth_transaction_v1.sql', 'c7c575b246f01ce05944c7270428bea89d151a68'],
  ['0083_shared_world_standard_voluntary_leave_v1.sql', '91e4e427a2cfb7071a68bd59e0a9d2e37559d950'],
  ['0084_shared_world_governance_approval_foundation_v1.sql', '7b77087dc229b3dfee10ce1b175ffc9b16008aca'],
  ['0085_shared_world_governed_membership_lifecycle_v1.sql', 'd9d05ca2ec7dd11deea7426c80afc06571ec263c'],
  ['0086_shared_world_governed_settings_v1.sql', '2e78d1b751b5158b3ccf04ebaf1e614d76593f77'],
  ['0087_shared_world_selective_history_access_v1.sql', '46606903867c8cc3570d61ee068d0baf6b9d65d8'],
  ['0088_shared_world_standard_closure_v1.sql', 'dff71de8fbfc2f834d2d267949359d2ebbd3effe'],
];

// ---------------------------------------------------------------------------

test('0090 is the forward migration after 0089, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0090 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0090_')).length, 1, 'exactly one migration carries the 0090 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0089_shared_world_material_persistence_v1.sql'),
    '0090 orders after its own sibling 0089, whose relations it writes');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-04G reopens no predecessor`);
  }
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0090 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+\w*\s*public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('0090 alters no predecessor table and installs no trigger of its own', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.deepEqual(foreign, [], 'no statement alters a table 0090 did not create');
  assert.doesNotMatch(deployableSql, /ADD COLUMN/iu, 'no predecessor table gains a column');
  // ONE trigger, and it exists for exactly one reason: to refuse HISTORICAL
  // WIDENING of material whose additional human authority is unresolved, at the
  // one place widening actually happens. It is additive to the frozen I-04F
  // table and narrows nothing else.
  assert.equal((executableSql.match(/CREATE TRIGGER/gu) ?? []).length, 1, 'migration 0090 creates exactly one trigger');
  assert.equal((executableSql.match(/RETURNS trigger/gu) ?? []).length, 1, 'and exactly one trigger function for it');
  assert.match(executableSql, /CREATE TRIGGER shared_world_material_historical_widening_gate\s*\n\s*BEFORE INSERT ON public\.shared_world_history_package_manifest_items/u,
    'it guards the exact frozen I-04F relation a history package is built from');
  assert.match(BODY[GATE_FN], /resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u,
    'and refuses exactly the unresolved state, nothing else');
  assert.doesNotMatch(BODY[GATE_FN], /INSERT INTO|UPDATE public\.|DELETE FROM|auth\.uid/u,
    'the gate decides; it mutates nothing and trusts no client claim');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?RULE|CREATE EVENT TRIGGER/iu, 'and no rule or event trigger');
  assert.doesNotMatch(executableSql, /CREATE POLICY/iu, 'and no RLS policy');
  // The availability transitions go THROUGH the frozen I-04F revision semantics.
  assert.ok(selfAssertions.includes('I-04G: the frozen I-04F temporal-truth trigger must still guard every availability transition'));
  assert.doesNotMatch(migration, /@Controller|@Post|@Get|NestJS/u, 'the migration adds no application surface');
});

test('no command, event or evidence row carries content, a reason, a role or a Safety or Launch claim', () => {
  const created = [...executableSql.matchAll(/CREATE TABLE public\.(\w+) \(/gu)].map((m) => m[1]);
  assert.deepEqual(created.sort(), [...OWN_TABLES].sort(), 'exactly the five relations, and nothing else');
  for (const name of OWN_TABLES) {
    for (const declaration of columnLines(name)) {
      assert.doesNotMatch(declaration, /\b(?:json|jsonb|hstore|bytea)\b|\[\]/iu,
        `${name}: ${declaration.trim()} stores no JSON, array, hstore or binary payload`);
      assert.doesNotMatch(declaration, /(body_text|transcript|audio|content|payload|reason|note|prompt|message|excerpt|snippet|owner|admin|moderator|safety|launch|entitlement|clearance|approved|allowed)/iu,
        `${name}: ${declaration.trim()} carries no material content, reason, role or Safety/Launch claim`);
    }
    assert.match(tableBlock(name), /ON DELETE RESTRICT/u, `${name} cascades no canonical history away`);
    assert.doesNotMatch(tableBlock(name), /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/u, `${name} uses restrictive deletion only`);
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
  // A digest is identity, not content, and the constraint proves its shape.
  assert.match(tableBlock(COMMIT_COMMANDS), /CHECK \(body_digest ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u,
    'the command binds the exact bytes it committed by digest, never by copying them');
  assert.ok(selfAssertions.includes('I-04G: no command, event or evidence row may carry material content, a reason, a role or a Safety/Launch claim'));
});

test('one material is one commit command, one deletion and one MATERIAL_DELETED, structurally', () => {
  assert.match(tableBlock(COMMIT_COMMANDS), /CONSTRAINT shared_world_material_commit_commands_material_key UNIQUE \(material_id\)/u);
  assert.match(tableBlock(COMMIT_COMMANDS), /CONSTRAINT shared_world_material_commit_commands_history_item_key UNIQUE \(history_item_id\)/u);
  assert.match(tableBlock(COMMIT_COMMANDS), /CHECK \(\(producer_kind = 'HUMAN' AND actor_user_id IS NOT NULL\)\s*\n?\s*OR \(producer_kind = 'QANDEEL' AND actor_user_id IS NULL\)\)/u,
    'QANDEEL is a system actor and is never recorded as a human principal');
  assert.match(tableBlock(COMMIT_COMMANDS), /CHECK \(baseline_viewer_count > 0\)/u,
    'ordinary material is never committed into an empty audience');
  assert.match(tableBlock(DELETED_EVENTS), /CONSTRAINT shared_world_material_deleted_events_material_key UNIQUE \(material_id\)/u,
    'one material carries at most one MATERIAL_DELETED fact');
  assert.match(tableBlock(DELETE_COMMANDS), /CONSTRAINT shared_world_material_delete_commands_material_key UNIQUE \(material_id\)/u,
    'and at most one effective owner deletion, so two competing deletes cannot both commit');
  assert.match(tableBlock(DELETE_COMMANDS), /CHECK \(invalidated_target_count >= 0\)/u);
});

test('the I-03 evidence binds one output to one material, and claims no Safety or Launch clearance', () => {
  const evidence = tableBlock(EVIDENCE);
  assert.match(evidence, /CONSTRAINT shared_world_qandeel_material_evidence_readiness_key UNIQUE \(readiness_ref\)/u,
    'one I-03 readiness commits at most one material: evidence is not replayable');
  assert.match(evidence, /CHECK \(readiness_state = 'READY_FOR_LATER_DELIVERY_GATES'\)/u,
    'the bound state is the exact frozen I-03G state and nothing else');
  assert.match(evidence, /CHECK \(output_digest ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u);
  for (const forbidden of ['system_safety', 'launch_gate', 'delivery_permission', 'safety_status', 'moderation']) {
    assert.ok(!evidence.includes(forbidden),
      `the evidence relation carries no ${forbidden} column: I-03G readiness is not a clearance`);
  }
  // The frozen rule is deployed into the catalog, not left in a source comment.
  assert.match(executableSql, /COMMENT ON TABLE public\.shared_world_qandeel_material_evidence IS/u);
  assert.match(migration, /NOT System\/Safety clearance, NOT Launch Gate clearance and NOT delivery or/u);
  for (const phrase of [
    'I-04G: the bound I-03 readiness state must stay pinned to READY_FOR_LATER_DELIVERY_GATES',
    'I-04G: one I-03 readiness must commit at most one material: evidence is not replayable',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0090 refuses to deploy without: ${phrase}`);
});

test('the readiness fingerprint is reproduced EXACTLY from the frozen I-03G boundary', () => {
  // The QANDEEL core recomputes the readiness reference rather than trusting it.
  // That proof is only worth anything if the recomputation is byte-identical to
  // the boundary that produced it, so the migration is checked against the frozen
  // TypeScript source rather than against a copy of it written from memory.
  assert.match(readiness, /const SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_VERSION = 'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1'/u,
    'the frozen I-03G version constant is where this contract believes it is');
  for (const line of ['effectiveContext=', 'output=', 'sourceDisclosureGate=', 'authorityRevalidation=']) {
    assert.ok(readiness.includes(`\`${line}$`), `the frozen I-03G fingerprint carries the ${line} line`);
    assert.ok(BODY[QANDEEL_FN].includes(`'${line}'`), `and migration 0090 reproduces the ${line} line exactly`);
  }
  assert.match(readiness, /createHash\('sha256'\)\.update\(lines\.join\('\\n'\), 'utf8'\)\.digest\('hex'\)/u,
    'the frozen I-03G fingerprint is sha256 over the UTF-8 lines joined by a newline');
  assert.match(readiness, /return `sha256:\$\{/u, 'and is rendered as sha256:<hex>');
  assert.match(BODY[QANDEEL_FN], /'sha256:' \|\| encode\(sha256\(convert_to\(/u,
    'migration 0090 uses the same sha256 over UTF-8, rendered the same way');
  assert.match(BODY[QANDEEL_FN], /'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1' \|\| E'\\n'/u,
    'and starts from the same frozen version constant, joined by the same newline');
  assert.match(BODY[QANDEEL_FN], /IF p_readiness_ref <> recomputed_readiness THEN/u,
    'the readiness reference is RECOMPUTED and compared, never trusted');
  assert.match(BODY[QANDEEL_FN], /IF p_output_digest <> digest THEN/u,
    'and the output digest must be the digest of the exact body being committed');
});

test('every primitive is sealed, pinned, World-first, clock-free and executable by no application role', () => {
  assert.doesNotMatch(executableSql, /\bGRANT\b/u, 'migration 0090 grants nothing to anybody');
  for (const name of OWN_FUNCTIONS) {
    assert.match(executableSql, new RegExp(`ALTER FUNCTION public\\.${name}\\([^)]*\\) OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'));
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM service_role`, 'u'),
      `${name} is revoked from service_role too, because the frozen Launch Gate precondition is unimplemented`);
    assert.match(executableSql, new RegExp(`public\\.${name}\\([\\s\\S]{0,1400}?LANGUAGE plpgsql SECURITY DEFINER SET search_path=''`, 'u'));
    assert.doesNotMatch(BODY[name], /pg_advisory|LOCK TABLE/iu, `${name} takes no advisory or table lock`);
    assert.doesNotMatch(BODY[name], /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/u,
      `${name} accepts no clock but one read of the database's own`);
    assert.doesNotMatch(BODY[name], /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
      `${name} creates, closes and mutates no Shared World`);
    assert.doesNotMatch(BODY[name], /INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes/u,
      `${name} creates and mutates no membership episode: material authority restores no browsing`);
    assert.doesNotMatch(BODY[name], /shared_world_history_access_grants|shared_world_standard_closed_view_entitlements/u,
      `${name} writes no history grant and no closed-World entitlement`);
    assert.doesNotMatch(BODY[name], /TRUNCATE/iu, `${name} truncates no canonical history`);
    // No Matching, Public, Replay or live call, and no Personal context.
    for (const absent of ['MATCHING', 'PUBLIC_EXPERIENCE', 'REPLAY', 'LIVE_CALL', 'matching_', 'conversation_turns']) {
      assert.ok(!BODY[name].includes(absent), `${name} touches no ${absent} state`);
    }
    if (BODY[name].includes('FOR UPDATE')) {
      assert.match(BODY[name], /FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE/u,
        `${name} locks the exact World row FIRST`);
    }
  }
  for (const phrase of [
    'I-04G: PUBLIC must not execute the material runtime before the launch gate exists',
    'I-04G: % must not execute the material runtime before the launch gate exists',
    'I-04G: % must lock the exact World row first',
    'I-04G: % must not create, close or mutate a Shared World',
    'I-04G: % must not create or mutate a membership episode',
    'I-04G: % must not write a history grant or a closed-World entitlement',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0090 refuses to deploy without: ${phrase}`);
});

test('the human surface derives its human, and the QANDEEL core has none', () => {
  assert.match(BODY[HUMAN_CORE], /u uuid := auth\.uid\(\);/u, 'the committing human is exactly auth.uid()');
  assert.match(BODY[HUMAN_CORE], /VALUES \(p_history_item_id, u\)/u,
    'and is the exact and only required material authority of their own material');
  assert.match(BODY[DELETE_FN], /u uuid := auth\.uid\(\);/u, 'the deleting human is exactly auth.uid()');
  assert.doesNotMatch(BODY[QANDEEL_FN], /auth\.uid/u,
    'QANDEEL is a system actor and never a human consent or ownership principal');
  assert.match(BODY[QANDEEL_FN], /'QANDEEL', 'TEXT', NULL, commit_instant\)/u,
    'and its material carries no human author at all');
  // The two named human primitives pin their own kind as a literal.
  assert.match(BODY[TEXT_FN], /'HUMAN_TEXT', p_body_text, NULL, NULL, NULL\)/u,
    'the text primitive commits HUMAN_TEXT and nothing else');
  assert.match(BODY[VOICE_FN], /'HUMAN_VOICE_NOTE', NULL, p_audio_object_ref, p_transcript_text, p_duration_ms\)/u,
    'the voice primitive commits HUMAN_VOICE_NOTE and nothing else');
  // A transcript can never masquerade as an original voice note.
  assert.match(BODY[HUMAN_CORE], /IF p_audio_object_ref IS NULL OR length\(btrim\(p_audio_object_ref\)\) = 0/u,
    'a voice note without its media object reference is refused');
  for (const phrase of [
    'I-04G: % must derive the committing human from auth.uid()',
    'I-04G: the exact human author is the exact required material authority, and only them',
    'I-04G: QANDEEL is a system actor and is never a human consent or ownership principal',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0090 refuses to deploy without: ${phrase}`);
});

test('the audience is derived under the World lock and never supplied, on every surface', () => {
  for (const name of [HUMAN_CORE, QANDEEL_FN]) {
    assert.match(BODY[name], /public\.resolve_shared_world_human_audience_snapshot_v1\(p_world_id\)/u,
      `${name} derives the exact current audience through the frozen I-03D boundary`);
    assert.match(BODY[name], /INSERT INTO public\.shared_world_history_item_baseline_viewers/u,
      `${name} writes the exact original delivery audience as baseline viewers`);
    // The World lock comes BEFORE the audience derivation, every time.
    const lockAt = BODY[name].indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
    const audienceAt = BODY[name].indexOf('public.resolve_shared_world_human_audience_snapshot_v1(p_world_id)');
    assert.ok(lockAt > 0 && audienceAt > lockAt,
      `${name} derives its audience UNDER the World lock, not before it`);
    // And an empty audience refuses the commit outright.
    assert.match(BODY[name], /IF audience IS NULL OR array_length\(audience, 1\) IS NULL THEN/u,
      `${name} refuses an inert zero-human World`);
  }
  // ONE database-owned instant, read once, written to every authoritative moment.
  for (const name of [HUMAN_CORE, QANDEEL_FN]) {
    assert.equal((BODY[name].match(/clock_timestamp\(\)/gu) ?? []).length, 1,
      `${name} reads the database clock exactly once`);
    assert.match(BODY[name], /VALUES \(p_history_item_id, p_world_id, commit_instant, [^;]*?1, commit_instant\);/su,
      `${name} writes occurred_at and registered_at from that ONE instant`);
    assert.match(BODY[name], /body_digest, request_ref, baseline_viewer_count, committed_at\)/u);
  }
  assert.equal((BODY[DELETE_FN].match(/clock_timestamp\(\)/gu) ?? []).length, 1,
    'owner deletion reads the database clock exactly once');
  for (const phrase of [
    'I-04G: % must derive the exact current audience through the frozen I-03D boundary',
    'I-04G: % must write the exact original delivery audience as baseline viewers',
    "I-04G: % accepts no clock but one read of the database clock",
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0090 refuses to deploy without: ${phrase}`);
});

test('the QANDEEL approver set is dependency-derived, never every member and never a constant', () => {
  // MISSING AUTHORITY NEVER MEANS EMPTY. A reasoning dependency means a protected
  // human subject may be implicated whose authority this repository cannot yet
  // resolve, and unknown is recorded as unknown.
  assert.match(BODY[QANDEEL_FN], /WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u,
    'an unresolvable additional human requirement is recorded as unresolved, never as a known-empty one');
  assert.match(BODY[QANDEEL_FN], /authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'/u,
    'NO_HUMAN_APPROVAL_REQUIRED is reachable only from a RESOLVED empty requirement');
  // Known MATERIAL_DEPENDENCY owners do not resolve the whole requirement alone.
  assert.match(BODY[QANDEEL_FN], /WHEN reasoning_edges > 0 THEN[\s\S]{0,120}WHEN approvers > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'/u,
    'the unresolved branch is decided BEFORE the known-owner branch, so known owners never mask it');
  assert.match(BODY[QANDEEL_FN], /SELECT DISTINCT p_history_item_id, ra\.approver_user_id\s*\n\s*FROM public\.shared_world_materials m\s*\n\s*JOIN public\.shared_world_history_item_required_approvers ra ON ra\.history_item_id = m\.history_item_id\s*\n\s*WHERE m\.id = ANY\(sources\);/u,
    'the required set is the exact UNION over the MATERIAL_DEPENDENCY sources, and nothing else');
  // A REASONING_DEPENDENCY contributes nothing to material authority.
  const approverInsert = BODY[QANDEEL_FN].slice(
    BODY[QANDEEL_FN].indexOf('INSERT INTO public.shared_world_history_item_required_approvers'));
  const statement = approverInsert.slice(0, approverInsert.indexOf(';'));
  assert.ok(!statement.includes('reasoning'), 'a reasoning dependency never becomes material consent');
  assert.ok(!statement.includes('audience'), 'and the World audience is never the approver set');
  // Missing or contradictory source authority metadata fails closed.
  assert.match(BODY[QANDEEL_FN], /i\.authority_requirement_mode = 'EXACT_HUMAN_APPROVER_SET'\s*\n\s*AND NOT EXISTS/u,
    'a source claiming an exact approver set with no approver fails the commit closed');
  assert.match(BODY[QANDEEL_FN], /i\.authority_requirement_mode = 'NO_HUMAN_APPROVAL_REQUIRED'\s*\n\s*AND EXISTS/u,
    'and a source claiming no approval while carrying an approver is contradictory, never approval-free');
  // Stale dependency state refuses the commit.
  assert.match(BODY[QANDEEL_FN], /SHARED_WORLD_MATERIAL_STALE/u,
    'a source that is no longer AVAILABLE stales the commit rather than silently succeeding');
  for (const phrase of [
    'I-04G: the QANDEEL approver set is dependency-derived, never the World membership and never a constant',
    'I-04G: an unresolvable additional human requirement must be recorded as unresolved, never as empty',
    'I-04G: NO_HUMAN_APPROVAL_REQUIRED may be written only for a RESOLVED empty human requirement',
    'I-04G: exact I-03 operation evidence must bind these exact body bytes, recomputed rather than trusted',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0090 refuses to deploy without: ${phrase}`);
});

test('the supplied audience snapshot is REVALIDATED against the frozen I-03D fingerprint', () => {
  // The frozen I-03D fingerprint is where this contract believes it is, and
  // migration 0090 reproduces it line for line rather than from memory.
  assert.match(audience, /const SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION = 'QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1'/u);
  assert.match(audience, /`\$\{member\.userId\}@\$\{member\.membershipEpisodeId\}`/u,
    'the frozen fingerprint is per (user, EPISODE), which is what makes a rejoin stale an old snapshot');
  assert.match(audience, /const lines = \[SHARED_HUMAN_AUDIENCE_SNAPSHOT_VERSION, `state=\$\{facts\.state\}`, `world=\$\{facts\.worldId\.toLowerCase\(\)\}`, `members=\$\{members\}`\]/u);
  for (const line of ['QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1', 'state=RESOLVED', 'world=', 'members=']) {
    assert.ok(BODY[QANDEEL_FN].includes(`'${line}`), `migration 0090 reproduces the ${line} line exactly`);
  }
  assert.match(BODY[QANDEEL_FN], /lower\(a\.user_id::text\) \|\| '@' \|\| lower\(a\.membership_episode_id::text\)/u,
    'including the exact per-episode member rendering');
  assert.match(BODY[QANDEEL_FN], /COLLATE "C"/u,
    'ordered by byte value, which is what the frozen code-unit comparison means');
  assert.match(BODY[QANDEEL_FN], /IF p_audience_snapshot_ref <> current_audience_ref THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_STALE'/u,
    'and stale audience evidence REFUSES the commit rather than silently retargeting it');
  // One audience meaning: the same resolved rows produce the fingerprint and the
  // baseline viewers.
  assert.match(BODY[QANDEEL_FN], /INTO audience, current_audience_ref\s*\n\s*FROM public\.resolve_shared_world_human_audience_snapshot_v1\(p_world_id\) a;/u,
    'the fingerprint and the baseline audience come from the SAME resolved rows');
  for (const phrase of [
    'I-04G: the supplied audience snapshot must be recomputed against the frozen I-03D fingerprint',
    'I-04G: stale audience evidence must refuse the commit, never silently retarget it',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0090 refuses to deploy without: ${phrase}`);
});

test('durable retry identity binds the WHOLE immutable request, not part of it', () => {
  for (const name of [HUMAN_CORE, QANDEEL_FN]) {
    assert.match(BODY[name], /'QANDEEL_CWV2_SHARED_MATERIAL_COMMIT_REQUEST_V1'/u,
      `${name} builds one versioned durable request identity`);
    // Every retry path decides on the whole identity. There are three per core:
    // pre-lock, under-lock and unique-violation recovery.
    assert.equal((BODY[name].match(/committed\.request_ref = request/gu) ?? []).length, 3,
      `${name} compares the whole request identity in all three retry paths`);
    assert.doesNotMatch(BODY[name], /committed\.body_digest = digest/u,
      `${name} no longer decides equivalence on the body alone`);
  }
  // C1: voice-note duration is part of request identity, with presence distinct
  // from value - the exact gap the review found.
  assert.match(BODY[HUMAN_CORE], /'duration=' \|\| CASE WHEN p_duration_ms IS NULL THEN 'NONE' ELSE p_duration_ms::text END/u,
    'a NULL duration and a valued duration can never fingerprint alike');
  assert.match(BODY[HUMAN_CORE], /'audio=' \|\| CASE WHEN p_audio_object_ref IS NULL THEN 'NONE'/u);
  assert.match(BODY[HUMAN_CORE], /'transcript=' \|\| CASE WHEN p_transcript_text IS NULL THEN 'NONE'/u);
  // C2: the QANDEEL identity binds every evidence reference and both exact
  // dependency sets, in canonical order.
  for (const bound of ['effectiveContext=', 'outputDigest=', 'sourceDisclosureGate=',
    'authorityRevalidation=', 'readiness=', 'audienceSnapshot=', 'materialSources=', 'reasoningSources=']) {
    assert.ok(BODY[QANDEEL_FN].includes(`'${bound}`), `the QANDEEL request identity binds ${bound}`);
  }
  assert.match(BODY[QANDEEL_FN], /ORDER BY lower\(s\.item::text\) COLLATE "C"/u,
    'set ORDER cannot change identity, because the members are canonically ordered');
  // And a retry answers from committed truth, never from its own input arrays.
  assert.doesNotMatch(BODY[QANDEEL_FN], /committed\.baseline_viewer_count, approvers, material_edges, reasoning_edges/u,
    'a retry never reports the counts it was called with');
  assert.equal((BODY[QANDEEL_FN].match(/INTO db_material_edges, db_reasoning_edges/gu) ?? []).length, 3,
    'all three retry paths read their dependency counts from committed rows');
  assert.match(tableBlock(COMMIT_COMMANDS), /CHECK \(request_ref ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u);
  for (const phrase of [
    'I-04G: % must bind its whole immutable request into one versioned durable identity',
    'I-04G: % must decide retry equivalence on the whole request identity, not on part of it',
    'I-04G: a retry must report committed dependency counts, never the arrays it was called with',
    'I-04G: every one of the three retry paths must read its counts from committed rows',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0090 refuses to deploy without: ${phrase}`);
});

test('unresolved historical-sharing authority is recorded, and blocks widening where it happens', () => {
  const relation = tableBlock(AUTHORITY);
  for (const state of ['RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT',
    'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT']) {
    assert.ok(relation.includes(`'${state}'`), `${state} is representable`);
  }
  assert.match(relation, /PRIMARY KEY \(material_id\)/u, 'one resolution per material');
  assert.match(relation, /UNIQUE \(history_item_id\)/u);
  // Every commit records one, so no committed material is silently unclassified.
  for (const name of [HUMAN_CORE, QANDEEL_FN]) {
    assert.match(BODY[name], /INSERT INTO public\.shared_world_material_historical_authority/u,
      `${name} records the historical-sharing authority resolution of what it commits`);
  }
  assert.match(BODY[HUMAN_CORE], /'RESOLVED_EXACT_HUMAN_REQUIREMENT'\);/u,
    'a human author is their own known authority: nothing about it is unresolved');
  // A reasoning grantor is NEVER turned into a material approver.
  const approverInsert = BODY[QANDEEL_FN].slice(
    BODY[QANDEEL_FN].indexOf('INSERT INTO public.shared_world_history_item_required_approvers'));
  assert.ok(!approverInsert.slice(0, approverInsert.indexOf(';')).includes('source_context_ref'),
    'no reasoning context reference ever becomes an approver identity');
  assert.ok(selfAssertions.includes('I-04G: a reasoning dependency is never material consent: no reasoning grantor becomes an approver'));
  assert.ok(selfAssertions.includes('I-04G: unresolved historical-sharing authority must be refused where widening actually happens'));
  // Current delivery is untouched: the gate is on the history package, not on the
  // commit and not on the material resolver.
  assert.ok(!BODY[QANDEEL_FN].includes('shared_world_history_package_manifest_items'),
    'committing is never blocked by an unresolved future redistribution authority');
});

test('the QANDEEL evidence binder is internal, unregistered and binds the exact World and operation', () => {
  // The database proves what it can see - the readiness fingerprint, the body
  // digest and the current World-bound audience fingerprint. The one thing it
  // cannot see is whether the I-03F revalidation behind an opaque reference was
  // performed for THIS World, so that half is bound here, against the frozen
  // typed result rather than against a re-implementation of it.
  assert.match(binder, /export function bindSharedQandeelMaterialCommit\(/u);
  assert.match(binder, /if \(authority\.targetWorldId !== request\.targetWorldId\) return refused\('WORLD_MISMATCH'\);/u,
    'evidence for another World cannot assemble a commit here');
  assert.match(binder, /if \(authority\.outputDigest !== outputDigest\) return refused\('OUTPUT_MISMATCH'\);/u);
  assert.match(binder, /if \(readiness\.outputDigest !== outputDigest\) return refused\('OUTPUT_MISMATCH'\);/u);
  assert.match(binder, /const outputDigest = digestProviderOutput\(request\.outputText\);/u,
    'the output identity is recomputed with the frozen I-03F convention, never trusted');
  assert.match(binder, /if \(authority\.effectiveContextRef !== readiness\.effectiveContextRef\) return refused\('OPERATION_MISMATCH'\);/u);
  assert.match(binder, /if \(readiness\.authorityRevalidationRef !== authority\.revalidationRef\) return refused\('OPERATION_MISMATCH'\);/u);
  assert.match(binder, /if \(authority\.audienceSnapshotRef !== request\.currentAudienceSnapshotRef\) return refused\('AUDIENCE_MISMATCH'\);/u);
  assert.match(binder, /request\.revalidation\.state !== 'CURRENT'/u);
  assert.match(binder, /request\.readiness\.state !== 'READY_FOR_LATER_DELIVERY_GATES'/u);

  // It is an ADAPTER, not a boundary: no decorator, no module, no transport, no
  // I/O, no state, and no Safety or Launch position of its own.
  for (const forbidden of ['@Injectable', '@Controller', '@Module', '@Get', '@Post',
    'NestModule', 'providers:', 'imports:', 'Repository', 'createClient', 'fetch(']) {
    assert.ok(!binder.includes(forbidden), `the evidence binder carries no ${forbidden}`);
  }
  assert.doesNotMatch(binder, /systemSafetyStatus:|launchGateStatus:|deliveryCommitAuthority:/u,
    'it restates no Safety, Launch or delivery position: CW2-08 owns those and this grants nothing');
  // Nothing imports it, so it is unreachable from any registered surface.
  const importers = [];
  const walk = (directory) => {
    for (const entry of readdirSync(join(rootPath, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) { walk(relative); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      if (relative.includes('material-commit/')) continue;
      if (readFileSync(join(rootPath, relative), 'utf8').includes('shared-qandeel-material-commit-binding')) {
        importers.push(relative);
      }
    }
  };
  walk('apps/api/src');
  assert.deepEqual(importers, [],
    'the evidence binder is imported by nothing: it is server-internal and transport-unreachable');
});

test('owner deletion destroys bodies and nothing else, and never reopens a World', () => {
  // Only the deletion primitive deletes, and only a BODY.
  for (const name of [HUMAN_CORE, TEXT_FN, VOICE_FN, QANDEEL_FN]) {
    assert.doesNotMatch(BODY[name], /DELETE FROM/iu, `${name} deletes nothing: committing material destroys nothing`);
  }
  const deletes = [...BODY[DELETE_FN].matchAll(/DELETE FROM public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(deletes)].sort(),
    ['shared_world_text_material_bodies', 'shared_world_voice_note_material_bodies'],
    'every DELETE owner deletion issues targets a material BODY relation, and nothing else');
  assert.equal(deletes.length, 4, 'two for the deleted source, two for its invalidated derivatives');
  assert.match(BODY[DELETE_FN], /SET availability_state = 'DELETED_BY_OWNER', availability_revision = i\.availability_revision \+ 1/u,
    'the source becomes terminally DELETED_BY_OWNER through the frozen I-04F revision semantics');
  assert.match(BODY[DELETE_FN], /SET availability_state = 'UNAVAILABLE', availability_revision = i\.availability_revision \+ 1/u,
    'and a source-content-bearing derivative becomes UNAVAILABLE, never DELETED_BY_OWNER');
  assert.doesNotMatch(BODY[DELETE_FN], /SET lifecycle|SET phase|SET closed_at/u,
    'a privacy material mutation never reopens or changes World lifecycle');
  assert.match(BODY[DELETE_FN], /IF world\.lifecycle NOT IN \('ACTIVE', 'READ_ONLY_CLOSED'\) THEN/u,
    'both ACTIVE and READ_ONLY_CLOSED permit this privacy mutation');
  assert.match(BODY[DELETE_FN], /IF owned\.producer_kind <> 'HUMAN' OR owned\.author_user_id IS NULL OR owned\.author_user_id <> u THEN/u,
    'the actor must be the exact original human author, so membership confers no ownership');
  assert.ok(!BODY[DELETE_FN].includes('shared_world_membership_episodes'),
    'and membership is never consulted: a former member and a closed-World viewer keep this authority');
  // The invalidation traversal follows MATERIAL_DEPENDENCY only.
  assert.equal((BODY[DELETE_FN].match(/d\.dependency_kind = 'MATERIAL_DEPENDENCY'/gu) ?? []).length, 2,
    'both recursive branches follow MATERIAL_DEPENDENCY edges');
  assert.doesNotMatch(BODY[DELETE_FN], /dependency_kind = 'REASONING_DEPENDENCY'/u,
    'an analytical derivative is never erased merely because a source later disappeared');
  assert.ok(!BODY[DELETE_FN].includes('DELETE FROM public.shared_world_material_dependencies'),
    'and dependency identity is never erased');
  assert.match(BODY[DELETE_FN], /WITH RECURSIVE reachable\(material_id\) AS \(/u,
    'the closure is a deterministic recursive traversal');
  assert.match(BODY[DELETE_FN], /\n      UNION\n/u, 'UNION rather than UNION ALL, so the traversal terminates');
  for (const phrase of [
    'I-04G: owner deletion removes material BODIES and nothing else: % DELETE statements, % of them bodies',
    'I-04G: owner deletion must transition the exact history item to the terminal DELETED_BY_OWNER',
    'I-04G: a source-content-bearing derivative becomes UNAVAILABLE, never DELETED_BY_OWNER',
    'I-04G: invalidation follows MATERIAL_DEPENDENCY only: an analytical derivative is not erased',
    'I-04G: a privacy material mutation never reopens or changes World lifecycle',
    'I-04G: both recursive branches must follow MATERIAL_DEPENDENCY edges exactly',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0090 refuses to deploy without: ${phrase}`);
});

test('every surface accepts exactly its frozen parameter list, and no actor, audience, authority or clock', () => {
  assert.deepEqual(parameters(HUMAN_CORE),
    ['p_command_id', 'p_world_id', 'p_material_id', 'p_history_item_id', 'p_material_kind',
      'p_body_text', 'p_audio_object_ref', 'p_transcript_text', 'p_duration_ms']);
  assert.deepEqual(parameters(TEXT_FN),
    ['p_command_id', 'p_world_id', 'p_material_id', 'p_history_item_id', 'p_body_text']);
  assert.deepEqual(parameters(VOICE_FN),
    ['p_command_id', 'p_world_id', 'p_material_id', 'p_history_item_id',
      'p_audio_object_ref', 'p_transcript_text', 'p_duration_ms']);
  assert.deepEqual(parameters(QANDEEL_FN),
    ['p_command_id', 'p_world_id', 'p_material_id', 'p_history_item_id', 'p_material_kind', 'p_body_text',
      'p_effective_context_ref', 'p_output_digest', 'p_source_disclosure_gate_ref',
      'p_authority_revalidation_ref', 'p_readiness_ref', 'p_audience_snapshot_ref',
      'p_material_source_ids', 'p_reasoning_source_refs']);
  assert.deepEqual(parameters(DELETE_FN),
    ['p_command_id', 'p_world_id', 'p_material_id', 'p_material_deleted_event_id']);
  for (const name of OWN_FUNCTIONS) {
    for (const parameter of parameters(name)) {
      assert.doesNotMatch(parameter, /actor|viewer|baseline|approver|member_ids|episode|instant|timestamp|_at$|count|availability|revision|launch_gate|system_safety|entitlement|moderation/u,
        `${name} must not accept ${parameter}: an actor, viewer list, approver, count or clock parameter`);
    }
    assert.doesNotMatch(signature(name), /DEFAULT/u,
      `${name} declares no defaulted parameter, so a widened list cannot arrive silently`);
  }
});

test('0090 own parameter deny-patterns never reject the exact frozen parameter lists they guard', () => {
  // A migration whose parameter-name deny-pattern matches one of the parameters
  // it is guarding REFUSES ITSELF at deploy. That is not a hypothetical: a bare
  // `author` token rejects the valid frozen `p_authority_revalidation_ref`, which
  // is the same shape as the I-04F FIX-02 defect. So this proof reads the
  // migration's OWN patterns and runs them against the migration's OWN frozen
  // parameter names.
  const patterns = [...selfAssertions.matchAll(
    /FOREACH arg_name IN ARRAY in_names LOOP\s*\n\s*IF arg_name ~\*\s*'((?:[^']|'')*)'/gu)]
    .map((m) => m[1].replace(/''/gu, "'"));
  assert.equal(patterns.length, 3, 'exactly three parameter deny-patterns: the human core, the QANDEEL core and deletion');

  const guarded = [parameters(HUMAN_CORE), parameters(QANDEEL_FN), parameters(DELETE_FN)];
  patterns.forEach((pattern, index) => {
    assert.ok(guarded[index].length > 0, 'the guarded parameter list is non-empty, so this proof is not vacuous');
    // PostgreSQL `~*` over these tokens is equivalent to a case-insensitive JS
    // regex: they use no PostgreSQL-only construct, and `$` anchors the whole
    // string in both, because PostgreSQL newline-sensitive matching is off by default.
    const deny = new RegExp(pattern, 'i');
    for (const parameter of guarded[index]) {
      assert.doesNotMatch(parameter, deny,
        `migration 0090 would refuse ITSELF at deploy: its own deny pattern /${pattern}/ rejects its own frozen parameter ${parameter}`);
    }
  });

  // The exact token this correction turns on, pinned in every pattern so the
  // broad one cannot come back.
  for (const pattern of patterns) {
    assert.doesNotMatch(pattern, /(?:^|\|)author(?:\||$)/u,
      'a bare `author` token rejects the valid frozen p_authority_revalidation_ref: the narrow author_ / author$ pair is required');
    assert.ok(pattern.includes('author_|author$'), 'every deny pattern keeps the narrow author token pair');
  }

  // And the exact in_names equality is untouched: it stays the PRIMARY proof that
  // no additional parameter can enter any surface silently.
  for (const list of [
    /IF in_names <> ARRAY\['p_command_id','p_world_id','p_material_id','p_history_item_id',\s*\n\s*'p_material_kind','p_body_text','p_audio_object_ref','p_transcript_text','p_duration_ms'\] THEN/u,
    /IF in_names <> ARRAY\['p_command_id','p_world_id','p_material_id','p_material_deleted_event_id'\] THEN/u,
  ]) assert.match(selfAssertions, list, 'a frozen parameter list is still asserted exactly');
});

/**
 * The migration's own `prosrc` self-assertions, each paired with the function
 * bodies it actually guards.
 *
 * This is the other half of the I-04F FIX-02 / FIX-03 lesson, and it is done at
 * the level of the whole `IF` CONDITION rather than of the individual `~` /
 * `!~` operand. A condition like
 *
 *   IF p.prosrc ~ 'FOR UPDATE' AND p.prosrc !~ '<the canonical lock>' THEN
 *
 * is an implication, not a ban: reading its first operand as a ban would report
 * a defect in a migration that is perfectly correct. What matters is exactly what
 * PostgreSQL will evaluate at deploy — the condition, against the body.
 *
 * `pg_proc.prosrc` is the text between `AS $$` and the closing `END`, COMMENTS
 * INCLUDED, which is why a ban on a bare vocabulary token is dangerous: this
 * migration's deletion body EXPLAINS in prose why an analytical derivative is
 * spared, and a bare `REASONING_DEPENDENCY` ban would have made the migration
 * refuse itself the first time PostgreSQL saw it.
 */
const TERM = /(p\.prosrc|[a-z_][a-z_0-9]*)\s+(!?~\*?)\s*'((?:[^']|'')*)'/gu;

/**
 * PostgreSQL's `~` / `~*` run with NEWLINE-SENSITIVE MATCHING OFF: a `.` matches
 * a NEWLINE, and so does a bracket negation. JavaScript's equivalent is the `s`
 * (dotAll) flag - and its ABSENCE here is precisely why migration 0090 passed
 * this contract locally and then REFUSED ITSELF at
 * `Apply all migrations to fresh PostgreSQL`: a guard reading
 * `reasoning.*approver_user_id` spanned the entire function body in PostgreSQL
 * while stopping at the first newline in this simulator.
 */
function pgRegExp(op, pattern) {
  return new RegExp(pattern.replace(/''/gu, "'"), op.endsWith('*') ? 'siu' : 'su');
}

/**
 * The migration bounds a statement with `substr`/`strpos`/`left` rather than with
 * a regex, because a regex is exactly what it must stop depending on here - and
 * because `strpos` over `prosrc` is the idiom migration 0081 already deploys.
 * This models those three builtins faithfully, `strpos` = 0 included.
 */
function pgBounded(body, { anchor, terminator }) {
  const start = body.indexOf(anchor);
  let text = start < 0 ? body : body.slice(start);
  if (terminator === undefined) return text;
  const end = text.indexOf(terminator);
  return end < 0 ? '' : text.slice(0, end + terminator.length);
}

/**
 * Splits the DO block into logical statements, so an `IF` CONDITION THAT SPANS
 * SEVERAL LINES is read whole. A line-at-a-time reader silently skips every
 * multi-line guard, which is coverage this contract cannot afford to lose.
 */
function logicalLines(source) {
  const lines = source.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    let text = lines[i];
    if (/^\s*(?:IF|ELSIF)\s/u.test(text) && !/\sTHEN\s*$/u.test(text)) {
      for (let j = i + 1; j < lines.length && j - i <= 12; j += 1) {
        text += `\n${lines[j]}`;
        if (/\sTHEN\s*$/u.test(lines[j])) { i = j; break; }
      }
    }
    out.push(text);
  }
  return out;
}

function prosrcGuards(source = selfAssertions) {
  // The DECLARE aliases, so a guard's subject can be resolved to real bodies.
  const alias = new Map();
  for (const m of source.matchAll(/^\s{2}(\w+) text := 'public\.(\w+)\(/gmu)) alias.set(m[1], m[2]);
  const groups = new Map([['all_fns', OWN_FUNCTIONS]]);
  for (const m of source.matchAll(/(\w+) := ARRAY\[([^\]]+)\];/gu)) {
    const members = m[2].split(',').map((name) => alias.get(name.trim())).filter(Boolean);
    if (members.length) groups.set(m[1], members);
  }

  const guards = [];
  let subject = null;
  // Text DERIVED from a body by `x := substr(p.prosrc, strpos(...))` and then
  // `x := left(x, strpos(x, ';'))`, so a guard can be proven against ONE BOUNDED
  // STATEMENT rather than against a whole body. That is the only honest way to
  // ban a vocabulary token: bounded.
  const derived = new Map();
  for (const line of logicalLines(source)) {
    const loopAll = /FOREACH fn IN ARRAY (\w+) LOOP/u.exec(line);
    if (loopAll && groups.has(loopAll[1])) subject = groups.get(loopAll[1]);
    const loopList = /FOREACH fn IN ARRAY ARRAY\[([^\]]+)\] LOOP/u.exec(line);
    if (loopList) {
      const members = loopList[1].split(',').map((name) => alias.get(name.trim())).filter(Boolean);
      if (members.length) subject = members;
    }
    const pinned = /pr\.oid = (\w+)::regprocedure/u.exec(line);
    if (pinned && alias.has(pinned[1])) subject = [alias.get(pinned[1])];
    const deriveFrom = /^\s*(\w+) := substr\(p\.prosrc, strpos\(p\.prosrc, '((?:[^']|'')*)'\)\);\s*$/u.exec(line);
    if (deriveFrom) derived.set(deriveFrom[1], { anchor: deriveFrom[2].replace(/''/gu, "'") });
    const deriveTo = /^\s*(\w+) := left\((\w+), strpos\(\2, '((?:[^']|'')*)'\)\);\s*$/u.exec(line);
    if (deriveTo && deriveTo[1] === deriveTo[2] && derived.has(deriveTo[1])) {
      derived.set(deriveTo[1], { ...derived.get(deriveTo[1]), terminator: deriveTo[3].replace(/''/gu, "'") });
    }
    // Only a real `IF <comparison...> THEN` is a guard. A line that merely
    // MENTIONS p.prosrc - the statement censuses count occurrences with
    // `length(replace(...))` - is arithmetic, not a condition, and modelling it
    // as one would report a defect in correct code.
    const guard = /^\s*IF ([\s\S]*?) THEN\s*$/u.exec(line);
    if (!guard) continue;
    const subjects = [...guard[1].matchAll(TERM)].map((m) => m[1]);
    if (!subjects.some((name) => name === 'p.prosrc' || derived.has(name))) continue;
    assert.ok(subject, `a prosrc guard appears before any subject is established: ${line.trim()}`);
    guards.push({ subject, condition: guard[1], derived: new Map(derived) });
  }
  return guards;
}

/** The text one guard term compares against: a whole body, or a bounded derivation of it. */
function subjectText(name, body, derived) {
  if (name === 'p.prosrc') return body;
  const bounds = derived.get(name);
  assert.ok(bounds !== undefined, `this contract does not know what \`${name}\` is derived from`);
  return pgBounded(body, bounds);
}

/** Evaluates one migration IF-condition over `prosrc` against one body, exactly as PostgreSQL would. */
function raisesFor(condition, body, derived = new Map()) {
  const terms = [];
  const expression = condition.replace(TERM, (_match, name, op, pattern) => {
    const matched = pgRegExp(op, pattern).test(subjectText(name, body, derived));
    terms.push(op.startsWith('!') ? !matched : matched);
    return `T[${terms.length - 1}]`;
  }).replace(/\bAND\b/gu, '&&').replace(/\bOR\b/gu, '||');
  assert.doesNotMatch(expression, /p\.prosrc|[^\s&|!()[\]0-9T]/u,
    `this contract cannot faithfully evaluate the migration condition: ${condition}`);
  // eslint-disable-next-line no-new-func
  return Function('T', `return (${expression});`)(terms);
}

test('every prosrc self-assertion is satisfied by the bodies it actually guards', () => {
  const guards = prosrcGuards();
  assert.ok(guards.length >= 22, `migration 0090 carries prosrc self-assertions (found ${guards.length})`);
  for (const { subject, condition, derived } of guards) {
    for (const name of subject) {
      assert.equal(raisesFor(condition, BODY[name], derived), false,
        `migration 0090 would REFUSE ITSELF at deploy: its own condition \`${condition}\` raises for ${name}`);
    }
  }
});

test('every bounded derivation a guard depends on actually resolves, so no guard is vacuous', () => {
  // A derivation that resolves to the empty string satisfies every ban and fails
  // every requirement; one that resolves to the whole body bounds nothing. A
  // guard proven against a derivation is worth exactly as much as the derivation.
  const guards = prosrcGuards().filter(({ derived }) => derived.size > 0);
  assert.ok(guards.length >= 3, `migration 0090 proves an approver write by bounded derivation (found ${guards.length})`);
  for (const { subject, condition, derived } of guards) {
    for (const name of [...condition.matchAll(TERM)].map((m) => m[1]).filter((n) => derived.has(n))) {
      for (const fn of subject) {
        const text = subjectText(name, BODY[fn], derived);
        assert.ok(text, `migration 0090 derives \`${name}\` from ${fn} and the derivation does not resolve`);
        assert.ok(text.length < BODY[fn].length,
          `a derivation that returns the whole body of ${fn} bounds nothing`);
      }
    }
  }
});

/** A body deliberately mutated so that `condition` must now raise, or the body unchanged. */
function violating(condition, body, derived) {
  let broken = body;
  for (const m of condition.matchAll(TERM)) {
    const [, name, op, raw] = m;
    const literal = raw.replace(/''/gu, "'");
    if (op.startsWith('!')) {
      // A requirement: remove what satisfies it. Only a literal-ish pattern can be
      // removed reliably; a regex-heavy one is exercised by the ban branch.
      const plain = literal.replace(/\\([.()+*?^$|[\]{}\\])/gu, '$1');
      if (broken.includes(plain)) broken = broken.split(plain).join('');
    } else {
      const plain = literal.split('|')[0].replace(/\\([.()+*?^$|[\]{}\\])/gu, '$1');
      if (!/^[\w\s.:'()=<>+-]+$/u.test(plain)) continue;
      if (name === 'p.prosrc') { broken += `\n${plain}\n`; continue; }
      // A BOUNDED ban has to be violated INSIDE its own bounds: appending the
      // token to the end of the body would prove only that the bound holds.
      const region = pgBounded(broken, derived.get(name));
      if (region) broken = broken.replace(region, region.replace(/;$/u, ` ${plain};`));
    }
  }
  return broken;
}

test('every prosrc self-assertion is capable of firing, so none of them is decorative', () => {
  // A guard that can never raise proves nothing. Each one is re-evaluated against
  // a body deliberately mutated to violate it: a required pattern removed, a
  // banned pattern inserted. If the guard still does not fire, it is inert.
  const guards = prosrcGuards();
  let exercised = 0;
  for (const { subject, condition, derived } of guards) {
    const body = BODY[subject[0]];
    const broken = violating(condition, body, derived);
    if (broken === body) {
      // A guard proven against a BOUNDED derivation is the one class this
      // contract must never let slip through unexercised: it is the replacement
      // for the unbounded pattern that reached deploy.
      assert.ok(![...condition.matchAll(TERM)].some(([, name]) => derived.has(name)),
        `the bounded guard \`${condition}\` was never exercised against a violating body`);
      continue;
    }
    exercised += 1;
    assert.equal(raisesFor(condition, broken, derived), true,
      `migration 0090 condition \`${condition}\` is inert: it does not fire even against a body that violates it`);
  }
  assert.ok(exercised >= 14, `at least most guards are exercised against a violating body (exercised ${exercised})`);
});

test('the corrected simulator rejects the broad guard that made migration 0090 refuse itself', () => {
  // FIX-02 anti-vacuity regression. The deploy-blocking defect was not a typo: it
  // was this contract modelling PostgreSQL regex semantics with the wrong flags.
  // Restoring the exact guard that failed at deploy must now FAIL LOCALLY - and
  // it must be the dotAll correction, not something else, that catches it.
  const anchor = "  IF p.prosrc ~ 'auth\\.uid' THEN\n";
  assert.ok(selfAssertions.includes(anchor), 'the QANDEEL-core guard region is still anchored where this proof inserts');
  const broadGuard = 'reasoning_grantor|reasoning.*approver_user_id|source_context_ref[^;]*approver';
  const restored = selfAssertions.replace(anchor,
    `  IF p.prosrc ~ '${broadGuard}' THEN\n`
    + "    RAISE EXCEPTION 'I-04G: a reasoning dependency is never material consent';\n"
    + '  END IF;\n' + anchor);

  const reintroduced = prosrcGuards(restored).filter(({ condition }) => condition.includes(broadGuard));
  assert.equal(reintroduced.length, 1, 'the regression probe reintroduces exactly one broad guard');
  const [{ subject, condition, derived }] = reintroduced;
  assert.ok(subject.includes(QANDEEL_FN), 'the probe lands on the QANDEEL core, the body the real guard rejected');
  assert.equal(raisesFor(condition, BODY[QANDEEL_FN], derived), true,
    'the corrected contract must report the broad guard as self-rejecting, exactly as PostgreSQL did at deploy');

  // And the correction is load-bearing: under the OLD flags this same guard passed.
  assert.equal(new RegExp(broadGuard, 'u').test(BODY[QANDEEL_FN]), false,
    'the old non-dotAll simulator did not catch this guard, which is why it reached CI');
  assert.equal(new RegExp(broadGuard, 'su').test(BODY[QANDEEL_FN]), true,
    'PostgreSQL dot-matches-newline semantics are what make the guard reject its own correct body');
});

test('the QANDEEL approver write is proven structurally, not by an unbounded negative pattern', () => {
  // The invariant is not "the word reasoning must not precede approver_user_id".
  // It is: exactly ONE approver-writing path, deriving only from
  // MATERIAL_DEPENDENCY source authority. That is what the migration now proves,
  // and what this contract re-proves against the deployed body.
  const writes = BODY[QANDEEL_FN].split('INSERT INTO public.shared_world_history_item_required_approvers').length - 1;
  assert.equal(writes, 1, 'the QANDEEL core writes a required approver in exactly one place');
  assert.doesNotMatch(BODY[QANDEEL_FN], /(?:UPDATE|DELETE FROM) public\.shared_world_history_item_required_approvers/su,
    'no second approver-writing path exists in the QANDEEL core');
  const write = pgBounded(BODY[QANDEEL_FN],
    { anchor: 'INSERT INTO public.shared_world_history_item_required_approvers', terminator: ';' });
  assert.ok(write && write.length < BODY[QANDEEL_FN].length, 'the one approver write is a complete bounded statement');
  assert.match(write, /WHERE m\.id = ANY\(sources\)/u, 'it selects the MATERIAL_DEPENDENCY sources, and only them');
  assert.doesNotMatch(write, /reasoning|source_context_ref|grantor/isu,
    'no reasoning identity of any kind reaches the one approver write');
  // `sources` is the MATERIAL_DEPENDENCY selection, never the reasoning one.
  assert.match(BODY[QANDEEL_FN], /sources := coalesce\(p_material_source_ids/u);
  assert.match(BODY[QANDEEL_FN], /reasoning := coalesce\(p_reasoning_source_refs/u);
  // And the migration asserts all three of those things about itself.
  assert.match(selfAssertions, /approver_write := substr\(p\.prosrc, strpos\(p\.prosrc,/u);
  assert.match(selfAssertions, /approver_write := left\(approver_write, strpos\(approver_write, ';'\)\);/u);
  assert.match(selfAssertions, /the QANDEEL core must write a required approver in exactly one place/u);
  assert.doesNotMatch(selfAssertions, /reasoning\.\*approver_user_id/u,
    'the unbounded cross-body negative pattern is gone for good');
});

test('the verifier, the script and the CI step are registered, and the README records the slice', () => {
  assert.ok(existsSync(new URL('../verify-migration-0090.mjs', import.meta.url)), 'the real-PostgreSQL verifier exists');
  assert.match(verifier, /0090/u);
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0090\\.mjs"`, 'u'));
  assert.match(workflow, new RegExp(`run: npm run ${OWN_SCRIPT}\\}`, 'u'), 'one API CI step runs it');
  const step = workflow.split('\n').find((line) => line.includes(OWN_SCRIPT));
  assert.ok(step, 'the CI step exists');
  assert.doesNotMatch(step.slice(step.indexOf('{name:'), step.indexOf(', run:')), /,/u, 'the step name is comma-free');
  assert.match(readme, /0090_shared_world_material_commit_owner_deletion_v1\.sql/u, 'the README records migration 0090');
  assert.match(readme, /READY_FOR_LATER_DELIVERY_GATES/u);
});

test('the real-PostgreSQL verifier carries no live-schema ceiling of its own', () => {
  assert.doesNotMatch(verifier, /FORBIDDEN_TABLES|const (?:FORBIDDEN|ABSENT|BANNED|MUST_NOT_EXIST)\w*\s*=\s*\[/u,
    'no live future-object absence census: what 0090 did not create is proven from 0090 own text, above');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Ff]oreign[Kk]ey\w*\.length/u, 'foreign keys are asserted exactly, never counted');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Cc]onstraint\w*\.length/u, 'and neither are constraints');
  assert.doesNotMatch(verifier, /proname\s*~/u, 'and the function catalog is never swept for future names');
  assert.doesNotMatch(verifier, /c\.column_name ~\*/u, 'no migration-wide column NAME filter over the live column list');
  assert.doesNotMatch(verifier, /c\.data_type IN \('json'/u, 'and no migration-wide column TYPE filter over it either');
  assert.doesNotMatch(verifier, /migrations\.length|readdirSync\(new URL\('\.\.\/migrations/u,
    'and no migration count ceiling: later migrations are not 0090 regressions');
  assert.match(verifier, /const OWNED_FOREIGN_KEYS = \{/u);
  assert.match(verifier, /const OWNED_COLUMNS = \{/u);
  assert.match(verifier, /SELECT column_name, data_type, is_nullable, column_default FROM information_schema\.columns/u);
  assert.match(verifier, /observed\.slice\(0, owned\.length\)/u);
  assert.match(verifier, /async function verifyForwardSafety\(/u, 'the verifier proves forward safety against real PostgreSQL');
  assert.match(verifier, /await verifyForwardSafety\(f\);/u, 'and actually runs it');
  assert.match(verifier, /SAVEPOINT forward_safety/u, 'inside a rolled-back savepoint');
  assert.match(verifier, /await assert\.rejects\(verifyCatalog\(\), refuses/u, 'and requires real regressions to still be refused');
  assert.match(verifier, /async function verifyConcurrency\(/u, 'and proves the mandatory races with real independent connections');
  assert.match(verifier, /async function verifyReviewFixes\(/u, 'and proves the Independent Review FIX-01 corrections');
  assert.match(verifier, /await verifyReviewFixes\(f\);/u, 'and actually runs them');
  assert.match(verifier, /async function currentAudienceSnapshotRef\(/u,
    'valid QANDEEL fixtures use the real canonical I-03D fingerprint, never a fabricated one');
  assert.doesNotMatch(verifier, /audienceSnapshotRef: `aud:/u, 'no fabricated audience reference survives in a valid fixture');
  for (const authorized of ['_introduction_producer', '_cw208_wrapper', '_launch_gates', '_public_consumer',
    '_replay_consumer', '_subject_authority_resolver', 'CREATE INDEX', 'CREATE TRIGGER', '_command_metadata']) {
    assert.ok(verifier.includes(authorized), `the probe proves a later reviewed ${authorized} is not an 0090 regression`);
  }
});

// ---------------------------------------------------------------------------
// Anti-vacuity: every assertion above must be capable of failing.
// ---------------------------------------------------------------------------

test('the contract is not vacuous: every deliberate weakening of migration 0090 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const weakenings = [
      ['grants authenticated EXECUTE on the human text commit', (text) => text.replace(
        `REVOKE ALL ON FUNCTION public.${TEXT_FN}(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;`,
        `GRANT EXECUTE ON FUNCTION public.${TEXT_FN}(uuid, uuid, uuid, uuid, text) TO authenticated;`)],
      ['restores the broad bare-author token that makes the migration refuse itself', (text) => text.replace(
        "'actor|author_|author$|user_id|viewer|baseline|approver|member|episode|audience_human",
        "'actor|author|user_id|viewer|baseline|approver|member|episode|audience_human")],
      ['gives QANDEEL a human actor', (text) => text.replace(
        'DECLARE\n  committed public.shared_world_material_commit_commands;\n  world public.shared_worlds;\n  digest text;\n  request text;',
        'DECLARE\n  u uuid := auth.uid();\n  committed public.shared_world_material_commit_commands;\n  world public.shared_worlds;\n  digest text;\n  request text;')],
      ['lets the QANDEEL approver set become every current member', (text) => text.replace(
        "    SELECT DISTINCT p_history_item_id, ra.approver_user_id\n      FROM public.shared_world_materials m\n      JOIN public.shared_world_history_item_required_approvers ra ON ra.history_item_id = m.history_item_id\n     WHERE m.id = ANY(sources);",
        '    SELECT p_history_item_id, v.member FROM unnest(audience) AS v(member);')],
      ['turns an UNRESOLVED additional human requirement into a known-empty one', (text) => text.replace(
        "    WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'",
        "    WHEN reasoning_edges > 0 THEN 'RESOLVED_NO_HUMAN_REQUIREMENT'")],
      ['lets NO_HUMAN_APPROVAL_REQUIRED be written for an unresolved requirement', (text) => text.replace(
        "  authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'",
        "  authority_mode := CASE WHEN approvers = 0")],
      ['drops the historical widening gate', (text) => text.replace(
        'CREATE TRIGGER shared_world_material_historical_widening_gate', '-- CREATE TRIGGER removed')],
      ['trusts the supplied readiness reference instead of recomputing it', (text) => text.replace(
        '  IF p_readiness_ref <> recomputed_readiness THEN', '  IF FALSE THEN')],
      ['lets evidence bind bytes other than the body being committed', (text) => text.replace(
        '  IF p_output_digest <> digest THEN', '  IF FALSE THEN')],
      ['lets one I-03 readiness commit many materials', (text) => text.replace(
        '    CONSTRAINT shared_world_qandeel_material_evidence_readiness_key UNIQUE (readiness_ref),\n', '')],
      ['claims a Safety clearance in the evidence row', (text) => text.replace(
        '    audience_snapshot_ref text NOT NULL,', '    audience_snapshot_ref text NOT NULL,\n    system_safety_status text,')],
      ['accepts a caller-supplied viewer list', (text) => text.replace(
        '  p_material_source_ids uuid[], p_reasoning_source_refs text[]',
        '  p_material_source_ids uuid[], p_reasoning_source_refs text[], p_baseline_viewer_ids uuid[]')],
      ['accepts a caller-supplied instant', (text) => text.replace(
        '  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid, p_body_text text\n',
        '  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid, p_body_text text, p_committed_at timestamptz\n')],
      ['lets a human commit under somebody else s identity', (text) => text.replace(
        '  u uuid := auth.uid();\n  committed public.shared_world_material_commit_commands;\n  world public.shared_worlds;\n  digest text;\n  request text;\n  form text;',
        '  u uuid := p_material_id;\n  committed public.shared_world_material_commit_commands;\n  world public.shared_worlds;\n  digest text;\n  request text;\n  form text;')],
      ['lets membership co-own another human s material', (text) => text.replace(
        '    INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id)\n    VALUES (p_history_item_id, u);',
        '    INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id)\n    SELECT p_history_item_id, v.member FROM unnest(audience) AS v(member);')],
      ['reads a second clock for the history item', (text) => text.replace(
        "    VALUES (p_history_item_id, p_world_id, commit_instant, 'EXACT_HUMAN_APPROVER_SET', 'AVAILABLE',\n            1, commit_instant);",
        "    VALUES (p_history_item_id, p_world_id, clock_timestamp(), 'EXACT_HUMAN_APPROVER_SET', 'AVAILABLE',\n            1, clock_timestamp());")],
      ['derives the audience before taking the World lock', (text) => text.replace(
        '  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;\n  IF NOT FOUND THEN\n    RAISE EXCEPTION \'SHARED_WORLD_MATERIAL_NOT_AVAILABLE\' USING ERRCODE=\'P0002\';\n  END IF;\n\n  -- STEP 3.',
        '  SELECT array_agg(a.user_id ORDER BY a.user_id) INTO audience\n    FROM public.resolve_shared_world_human_audience_snapshot_v1(p_world_id) a;\n'
        + '  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;\n  IF NOT FOUND THEN\n    RAISE EXCEPTION \'SHARED_WORLD_MATERIAL_NOT_AVAILABLE\' USING ERRCODE=\'P0002\';\n  END IF;\n\n  -- STEP 3.')],
      ['lets a commit destroy a body', (text) => text.replace(
        '    INSERT INTO public.shared_world_text_material_bodies (material_id, body_form, body_text)\n      VALUES (p_material_id, \'TEXT\', p_body_text);',
        '    DELETE FROM public.shared_world_text_material_bodies WHERE material_id = p_material_id;\n'
        + '    INSERT INTO public.shared_world_text_material_bodies (material_id, body_form, body_text)\n      VALUES (p_material_id, \'TEXT\', p_body_text);')],
      ['leaves the deleted body in place', (text) => text.replace(
        '    DELETE FROM public.shared_world_text_material_bodies b WHERE b.material_id = p_material_id;\n', '')],
      ['marks an invalidated derivative as deleted by ITS owner', (text) => text.replace(
        "         SET availability_state = 'UNAVAILABLE', availability_revision = i.availability_revision + 1",
        "         SET availability_state = 'DELETED_BY_OWNER', availability_revision = i.availability_revision + 1")],
      ['erases analytical derivatives too', (text) => text.replace(
        "        JOIN reachable step ON d.source_material_id = step.material_id\n       WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'",
        "        JOIN reachable step ON d.source_material_id = step.material_id\n       WHERE d.dependency_kind = 'REASONING_DEPENDENCY'")],
      ['lets membership confer deletion authority', (text) => text.replace(
        "  IF owned.producer_kind <> 'HUMAN' OR owned.author_user_id IS NULL OR owned.author_user_id <> u THEN",
        '  IF FALSE THEN')],
      ['reopens the World lifecycle during a privacy mutation', (text) => text.replace(
        '    INSERT INTO public.shared_world_material_deleted_events',
        "    UPDATE public.shared_worlds SET lifecycle = 'ACTIVE' WHERE id = p_world_id;\n"
        + '    INSERT INTO public.shared_world_material_deleted_events')],
      ['lets two owner deletions both commit', (text) => text.replace(
        '    CONSTRAINT shared_world_material_delete_commands_material_key UNIQUE (material_id),\n', '')],
      ['stores the deleted transcript in the audit row', (text) => text.replace(
        '    occurred_at timestamptz NOT NULL,\n    CONSTRAINT shared_world_material_deleted_events_pk',
        '    occurred_at timestamptz NOT NULL,\n    transcript_text text,\n    CONSTRAINT shared_world_material_deleted_events_pk')],
      ['commits ordinary material into an empty audience', (text) => text.replace(
        '    CONSTRAINT shared_world_material_commit_commands_viewers_check\n        CHECK (baseline_viewer_count > 0),\n', '')],
    ];
    for (const [reason, weaken] of weakenings) {
      const weakened = weaken(migration);
      assert.notEqual(weakened, migration, `the probe for "${reason}" must actually change migration 0090`);
      const sql = weakened.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
      const body = sql.slice(0, sql.indexOf('DO $$\nDECLARE'));
      const bodies = Object.fromEntries(OWN_FUNCTIONS.map((name) => {
        const create = weakened.indexOf(`CREATE FUNCTION public.${name}(`);
        const start = weakened.indexOf('AS $$', create);
        const end = weakened.indexOf('\nEND$$;', start);
        return [name, create < 0 || start < 0 || end < 0 ? '' : weakened.slice(start, end)];
      }));
      const declared = (name) => {
        const create = weakened.indexOf(`CREATE FUNCTION public.${name}(`);
        const open = create + `CREATE FUNCTION public.${name}(`.length;
        const terminator = /\)\s*RETURNS/u.exec(weakened.slice(open));
        return terminator ? weakened.slice(open, open + terminator.index) : '';
      };
      const names = (name) => [...declared(name).matchAll(/(p_[a-z_0-9]+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|timestamptz)/gu)].map((m) => m[1]);
      const block = (name) => {
        const from = sql.indexOf(`CREATE TABLE public.${name} (`);
        return from < 0 ? '' : sql.slice(from, sql.indexOf('\n);', from));
      };
      const denyPatterns = [...sql.matchAll(
        /FOREACH arg_name IN ARRAY in_names LOOP\s*\n\s*IF arg_name ~\*\s*'((?:[^']|'')*)'/gu)]
        .map((m) => m[1].replace(/''/gu, "'"));
      const caught = [
        () => assert.doesNotMatch(sql, /\bGRANT\b/u),
        () => { for (const p of denyPatterns) assert.doesNotMatch(p, /(?:^|\|)author(?:\||$)/u); },
        () => assert.doesNotMatch(bodies[QANDEEL_FN], /auth\.uid/u),
        () => assert.match(bodies[QANDEEL_FN], /SELECT DISTINCT p_history_item_id, ra\.approver_user_id/u),
        () => assert.match(bodies[QANDEEL_FN], /WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u),
        () => assert.match(bodies[QANDEEL_FN], /authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'/u),
        () => assert.match(sql, /CREATE TRIGGER shared_world_material_historical_widening_gate/u),
        () => assert.match(bodies[QANDEEL_FN], /IF p_readiness_ref <> recomputed_readiness THEN/u),
        () => assert.match(bodies[QANDEEL_FN], /IF p_output_digest <> digest THEN/u),
        () => assert.match(block(EVIDENCE), /UNIQUE \(readiness_ref\)/u),
        () => { for (const l of block(EVIDENCE).split('\n').filter((x) => /^ {4}\w+\s+\S/u.test(x) && !/^ {4}CONSTRAINT\b/u.test(x))) assert.doesNotMatch(l, /safety|launch|clearance/iu); },
        () => { for (const n of OWN_FUNCTIONS) for (const p of names(n)) assert.doesNotMatch(p, /viewer|_at$|actor/u); },
        () => assert.match(bodies[HUMAN_CORE], /u uuid := auth\.uid\(\);/u),
        () => assert.match(bodies[HUMAN_CORE], /VALUES \(p_history_item_id, u\);/u),
        () => assert.equal((bodies[HUMAN_CORE].match(/clock_timestamp\(\)/gu) ?? []).length, 1),
        () => {
          const lockAt = bodies[HUMAN_CORE].indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
          const audienceAt = bodies[HUMAN_CORE].indexOf('public.resolve_shared_world_human_audience_snapshot_v1(p_world_id)');
          assert.ok(lockAt > 0 && audienceAt > lockAt);
        },
        () => { for (const n of [HUMAN_CORE, TEXT_FN, VOICE_FN, QANDEEL_FN]) assert.doesNotMatch(bodies[n], /DELETE FROM/iu); },
        () => assert.equal((bodies[DELETE_FN].match(/DELETE FROM public\.\w+/gu) ?? []).length, 4),
        () => assert.match(bodies[DELETE_FN], /SET availability_state = 'UNAVAILABLE'/u),
        () => assert.equal((bodies[DELETE_FN].match(/d\.dependency_kind = 'MATERIAL_DEPENDENCY'/gu) ?? []).length, 2),
        () => assert.match(bodies[DELETE_FN], /IF owned\.producer_kind <> 'HUMAN'/u),
        () => assert.doesNotMatch(bodies[DELETE_FN], /UPDATE public\.shared_worlds/u),
        () => assert.match(block(DELETE_COMMANDS), /UNIQUE \(material_id\)/u),
        () => { for (const l of block(DELETED_EVENTS).split('\n').filter((x) => /^ {4}\w+\s+\S/u.test(x) && !/^ {4}CONSTRAINT\b/u.test(x))) assert.doesNotMatch(l, /transcript|body_text|audio/iu); },
        () => assert.match(block(COMMIT_COMMANDS), /CHECK \(baseline_viewer_count > 0\)/u),
      ];
      let refused = false;
      for (const check of caught) {
        try { check(); } catch { refused = true; break; }
      }
      assert.ok(refused, `a migration that ${reason} must be refused by at least one structural check`);
    }
  });

// ---------------------------------------------------------------------------
// Forward safety, proven rather than asserted.
// ---------------------------------------------------------------------------

// The frozen I-03G readiness boundary is mirrored too, because this contract
// proves migration 0090 reproduces its fingerprint exactly - and a regression
// probe has to be able to change it. Only that one directory is copied: mirroring
// the whole API tree would cost seconds per probe to prove nothing extra.
const MIRRORED = ['database', '.github/workflows/api-ci.yml', 'package.json', 'tests/harness-temp-dir.mjs',
  'apps/api/src/connected-worlds/source-disclosure', 'apps/api/src/connected-worlds/audience',
  'apps/api/src/connected-worlds/material-commit'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i04g-runtime-');
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    const to = join(mirror, entry);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  return mirror;
}

function runInMirror(mirror, file = SELF) {
  const env = { ...process.env, [PROBE_CHILD]: '1' };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', join(mirror, 'database', 'tests', file)], { cwd: mirror, encoding: 'utf8', env });
  assert.equal(result.error, undefined, `the mirrored contract could not be started: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

const write = (mirror, relative, content) => {
  const target = join(mirror, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
};
const patch = (mirror, relative, from, to) => {
  const target = join(mirror, relative);
  const text = readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `the regression probe needs ${from} in ${relative}`);
  writeFileSync(target, text.replace(from, to));
};

test('a later reviewed producer, a CW2-08 wrapper, Public and Replay consumers, an index and an audit trigger leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'probe child' : false }, (t) => {
    const mirror = buildMirror();
    // `removeHarnessMirror` never throws and is idempotent, so the explicit
    // removal below frees the mirror early and this stays a pure safety net.
    t.after(() => removeHarnessMirror(mirror));
    try {
      write(mirror, 'database/migrations/0091_shared_world_material_later_runtime_v1.sql',
        '-- A later reviewed slice: an Introduction material producer, the CW2-08 Safety /\n'
        + '-- Launch Gate wrapper over the sealed commit cores, Public and Replay consumers of\n'
        + '-- committed material, later additive command metadata, an index and an audit trigger.\n'
        + 'BEGIN;\n'
        + 'CREATE TABLE public.launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL);\n'
        + 'ALTER TABLE public.shared_world_material_commit_commands ADD COLUMN command_metadata jsonb;\n'
        + 'CREATE INDEX shared_world_material_commit_commands_time_idx\n'
        + '  ON public.shared_world_material_commit_commands (committed_at);\n'
        + 'CREATE FUNCTION public.commit_shared_world_introduction_material_v1(p_world_id uuid) RETURNS void\n'
        + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$;\n"
        + 'CREATE FUNCTION public.commit_shared_world_human_text_gated_v1(\n'
        + '  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_history_item_id uuid, p_body_text text)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + `BEGIN\n  PERFORM 1 FROM public.${TEXT_FN}(p_command_id, p_world_id, p_material_id, p_history_item_id, p_body_text);\nEND$fn$;\n`
        + 'GRANT EXECUTE ON FUNCTION public.commit_shared_world_human_text_gated_v1(uuid, uuid, uuid, uuid, text) TO authenticated;\n'
        + 'CREATE TABLE public.public_experience_material (id uuid PRIMARY KEY, material_id uuid NOT NULL\n'
        + '  REFERENCES public.shared_world_materials (id) ON DELETE RESTRICT);\n'
        + 'CREATE TABLE public.replay_material (id uuid PRIMARY KEY, material_id uuid NOT NULL\n'
        + '  REFERENCES public.shared_world_materials (id) ON DELETE RESTRICT);\n'
        + 'CREATE FUNCTION public.shared_world_material_command_audit_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$\n'
        + 'BEGIN RETURN NULL; END$fn$;\n'
        + 'CREATE TRIGGER shared_world_material_commit_commands_audit\n'
        + '  AFTER INSERT ON public.shared_world_material_commit_commands\n'
        + '  FOR EACH ROW EXECUTE FUNCTION public.shared_world_material_command_audit_v1();\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0091.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/shared-world-material-later-runtime-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      assert.ok(runInMirror(mirror).ok,
        'a later reviewed Introduction producer, a CW2-08 launch-gated wrapper, Public and Replay consumers of '
        + 'committed material, later additive command metadata, a later index, a later audit trigger and '
        + 'migration 0091 must all leave this contract passing');
    } finally {
      removeHarnessMirror(mirror);
    }

    // Each regression gets its OWN pristine mirror, so one cannot mask another
    // and none inherits the authorized-future migration written above.
    const regressions = [
      ['0090 itself grants EXECUTE to an application role', `database/migrations/${MIGRATION_NAME}`,
        `REVOKE ALL ON FUNCTION public.${DELETE_FN}(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
        `GRANT EXECUTE ON FUNCTION public.${DELETE_FN}(uuid, uuid, uuid, uuid) TO authenticated;`],
      ['a frozen predecessor migration is edited', 'database/migrations/0088_shared_world_standard_closure_v1.sql',
        'BEGIN;', 'BEGIN;\n-- edited\n'],
      ['0090 gives QANDEEL a human actor', `database/migrations/${MIGRATION_NAME}`,
        'DECLARE\n  committed public.shared_world_material_commit_commands;\n  world public.shared_worlds;\n  digest text;\n  request text;',
        'DECLARE\n  u uuid := auth.uid();\n  committed public.shared_world_material_commit_commands;\n  world public.shared_worlds;\n  digest text;\n  request text;'],
      ['0090 alters a predecessor table', `database/migrations/${MIGRATION_NAME}`,
        'CREATE TABLE public.shared_world_material_commit_commands (',
        'ALTER TABLE public.shared_world_materials ADD COLUMN commit_note text;\nCREATE TABLE public.shared_world_material_commit_commands ('],
      ['0090 stores a deleted transcript in its audit row', `database/migrations/${MIGRATION_NAME}`,
        '    occurred_at timestamptz NOT NULL,\n    CONSTRAINT shared_world_material_deleted_events_pk',
        '    occurred_at timestamptz NOT NULL,\n    transcript_text text,\n    CONSTRAINT shared_world_material_deleted_events_pk'],
      ['0090 claims a Launch Gate clearance in its evidence row', `database/migrations/${MIGRATION_NAME}`,
        '    audience_snapshot_ref text NOT NULL,', '    audience_snapshot_ref text NOT NULL,\n    launch_gate_status text,'],
      ['0090 lets an analytical derivative be erased by a source deletion', `database/migrations/${MIGRATION_NAME}`,
        "        JOIN reachable step ON d.source_material_id = step.material_id\n       WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'",
        "        JOIN reachable step ON d.source_material_id = step.material_id\n       WHERE d.dependency_kind = 'REASONING_DEPENDENCY'"],
      ['0090 installs a trigger of its own', `database/migrations/${MIGRATION_NAME}`,
        '-- ---------------------------------------------------------------------------\n-- 5. Deny-by-default posture',
        'CREATE FUNCTION public.shared_world_material_guard_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$\n'
        + 'BEGIN RETURN NEW; END$fn$;\n'
        + 'CREATE TRIGGER shared_world_material_commit_guard BEFORE INSERT ON public.shared_world_material_commit_commands\n'
        + '  FOR EACH ROW EXECUTE FUNCTION public.shared_world_material_guard_v1();\n'
        + '-- ---------------------------------------------------------------------------\n-- 5. Deny-by-default posture'],
      ['the CI step that runs the 0090 verifier is removed', '.github/workflows/api-ci.yml',
        `run: npm run ${OWN_SCRIPT}}`, 'run: npm run test:toolchain}'],
      ['the frozen I-03G readiness fingerprint changes without this migration following it',
        'apps/api/src/connected-worlds/source-disclosure/shared-privacy-authority-delivery-readiness.service.ts',
        "`sourceDisclosureGate=${facts.sourceDisclosureGateRef}`", "`disclosureGate=${facts.sourceDisclosureGateRef}`"],
    ];
    for (const [reason, file, from, to] of regressions) {
      const fresh = buildMirror();
      try {
        patch(fresh, file, from, to);
        const { ok, output } = runInMirror(fresh);
        assert.equal(ok, false, `a repository where ${reason} must break this contract; it passed:\n${output.slice(-1200)}`);
      } finally {
        removeHarnessMirror(fresh);
      }
    }
  });
