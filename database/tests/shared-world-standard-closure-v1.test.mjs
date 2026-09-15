// I-04F - Standard World Closure v1: the secret-free structural contract for
// migration 0088.
//
// Live semantics - ACLs, real denials, the unanimous close, the one closure
// instant across every persisted moment, the exact entitlement snapshot, the
// closed viewer who is not a member, the read-only boundary, the multi-connection
// races and forward safety - are proven by database/verify-migration-0088.mjs
// against real PostgreSQL, which this file pins into the toolchain and CI. What is
// proven HERE is the structure a migration must already have before it is allowed
// to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04F PART B: that THIS slice implemented the
// unanimous Standard archival closure and the bounded CLOSED_WORLD_VIEW_ENTITLEMENT
// over the frozen I-04D governance substrate and the I-04F history projection - and
// nothing beyond it. No Introduction closure; no Matching, Public or Replay state;
// no deletion of any canonical history; no fake active membership; no blanket
// "nothing may ever mutate" rule that would forbid a later reviewed
// PRIVACY_MATERIAL_MUTATION; no Launch Gate, wrapper, controller or route - and
// that it modified no predecessor migration at all.
//
// It deliberately does NOT prove that a later reviewed Introduction closure
// producer, material writer, index, audit trigger or consumer may never appear.
// Every assertion is scoped to migration 0088 itself, the verifier it added, the
// registration lines it added, and the frozen predecessors it was required not to
// modify - pinned by content hash, which proves immutability without banning
// additions. Migration 0087 is deliberately NOT content-pinned here: it is this
// slice's own sibling, shipping in the same PR, and pinning a sibling would pin a
// hash that is still moving.
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
const SELF = 'shared-world-standard-closure-v1.test.mjs';
/** Set in the child runs of the forward-safety probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04F_CLOSURE_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0088_shared_world_standard_closure_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0088.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
const selfAssertions = executableSql.slice(executableSql.indexOf('DO $$\nDECLARE'));

const PAYLOADS = 'shared_world_end_payload_versions';
const ENTITLEMENTS = 'shared_world_standard_closed_view_entitlements';
const ENTITLEMENT_ITEMS = 'shared_world_standard_closed_view_entitlement_items';
const ENDED_EVENTS = 'shared_world_ended_events';
const END_COMMANDS = 'shared_world_standard_end_commands';
const OWN_TABLES = [PAYLOADS, ENTITLEMENTS, ENTITLEMENT_ITEMS, ENDED_EVENTS, END_COMMANDS];

const PREPARE_FN = 'prepare_shared_world_standard_end_governance_v1';
const COMMIT_FN = 'commit_shared_world_standard_end_v1';
const RESOLVE_FN = 'resolve_shared_world_closed_history_visibility_v1';
const MUTATION_FUNCTIONS = [PREPARE_FN, COMMIT_FN];
const OWN_FUNCTIONS = [...MUTATION_FUNCTIONS, RESOLVE_FN];
const OWN_SCRIPT = 'verify:shared-world-standard-closure:integration';

const functionBody = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0088 creates ${name}`);
  const start = migration.indexOf('AS $$', create);
  assert.ok(start > create, `${name} opens a dollar-quoted body`);
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, `${name} has a terminated body`);
  return migration.slice(start + 'AS $$'.length, end + '\nEND'.length);
};
const BODY = Object.fromEntries(OWN_FUNCTIONS.map((name) => [name, functionBody(name)]));

const signature = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  const open = create + `CREATE FUNCTION public.${name}(`.length;
  const close = migration.indexOf(') RETURNS', open);
  assert.ok(close > open, `${name} has a terminated parameter list`);
  return migration.slice(open, close);
};
const parameters = (name) => [...signature(name).matchAll(/(p_[a-z_]+)\s+(?:uuid|text)/gu)].map((m) => m[1]);

const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0088 creates ${name}`);
  const end = executableSql.indexOf('\n);', start);
  assert.ok(end > start, `${name} has a terminated definition`);
  return executableSql.slice(start, end);
};

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
];

// ---------------------------------------------------------------------------

test('0088 is the forward migration after 0087, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0088 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0088_')).length, 1, 'exactly one migration carries the 0088 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0087_shared_world_selective_history_access_v1.sql'),
    '0088 orders after its own sibling 0087, whose relations it references');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-04F reopens no predecessor`);
  }
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0088 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+\w*\s*public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('0088 alters no predecessor table and installs no trigger of its own', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.deepEqual(foreign, [], 'no statement alters a table 0088 did not create');
  assert.doesNotMatch(deployableSql, /ADD COLUMN/iu, 'no predecessor table gains a column');
  assert.doesNotMatch(executableSql, /CREATE TRIGGER/iu, 'migration 0088 creates no trigger at all');
  assert.doesNotMatch(executableSql, /RETURNS trigger/iu, 'and no trigger function for one to call');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?RULE|CREATE EVENT TRIGGER/iu, 'and no rule or event trigger');
  assert.doesNotMatch(executableSql, /CREATE POLICY/iu, 'and no RLS policy');
  // Pending member invitations terminalize through the existing reviewed I-04E
  // mechanism, not through a second conflicting one invented here.
  assert.ok(!deployableSql.includes('shared_world_member_invitations'),
    '0088 never names a member invitation: closure terminalizes them through the reviewed 0085 topology trigger');
  assert.ok(selfAssertions.includes('I-04F: the two reviewed I-04E topology triggers must still be in place: closure terminalizes invitations through them'));
});

test('the END_WORLD payload is identity only: no reason, no initiator, no JSON', () => {
  const created = [...executableSql.matchAll(/CREATE TABLE public\.(\w+) \(/gu)].map((m) => m[1]);
  assert.deepEqual(created.sort(), [...OWN_TABLES].sort(), 'exactly the five relations, and nothing else');
  const payload = tableBlock(PAYLOADS);
  assert.equal(payload.split('\n').filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line)).length, 5,
    'the END_WORLD payload carries exactly five columns and no place for a closure reason');
  assert.match(payload, /CHECK \(governance_operation_kind = 'END_WORLD'\)/u, 'and it can belong to no other operation');
  assert.match(payload, /FOREIGN KEY \(governance_proposal_id, world_id, governance_operation_kind, id\)\s*\n?\s*REFERENCES public\.shared_world_governance_proposals\s*\n?\s*\(id, world_id, operation_kind, proposed_payload_version_id\) ON DELETE RESTRICT/u,
    'the four-column composite key makes the proposal binding structural rather than procedural');
  assert.match(payload, /UNIQUE \(governance_proposal_id\)/u, 'one proposal carries at most one END_WORLD payload');
  for (const name of OWN_TABLES) {
    const table = tableBlock(name);
    const declarations = table.split('\n')
      .filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line));
    for (const declaration of declarations) {
      assert.doesNotMatch(declaration, /\b(?:json|jsonb|hstore|bytea)\b|\[\]/iu,
        `${name}: ${declaration.trim()} stores no JSON, array, hstore or binary body`);
      assert.doesNotMatch(declaration, /(reason|note|body|transcript|audio|content|blob|document|analysis|message|owner|admin|creator|initiator|moderator|closer|privilege|capability|permission|commercial|safety|moderation)/iu,
        `${name}: ${declaration.trim()} carries no reason, actor, role, policy or material content`);
    }
    assert.match(table, /ON DELETE RESTRICT/u, `${name} cascades no canonical history away`);
    assert.doesNotMatch(table, /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/u, `${name} uses restrictive deletion only`);
  }
  assert.ok(selfAssertions.includes('I-04F: a closed entitlement is historical viewing authority only, never membership, a role, a reason or material content'));
  assert.doesNotMatch(migration, /@Controller|@Post|@Get|NestJS/u, 'the migration adds no application surface');
});

test('a closed viewer is an entitlement holder, and never an active member', () => {
  const entitlement = tableBlock(ENTITLEMENTS);
  assert.match(entitlement, /PRIMARY KEY \(world_id, user_id\)/u,
    'one row per (world, user) for the one irreversible Standard closure');
  assert.doesNotMatch(entitlement, /joined_at|is_active|is_open|is_current|active_|current_/iu,
    'the entitlement carries no open, current or active membership state of any kind');
  assert.match(entitlement, /^ {4}membership_episode_id uuid NOT NULL,$/mu,
    'it records WHICH exact episode it derived from, which is historical truth');
  assert.match(entitlement, /UNIQUE \(membership_episode_id\)/u, 'and no episode entitles twice');
  const items = tableBlock(ENTITLEMENT_ITEMS);
  assert.match(items, /PRIMARY KEY \(world_id, user_id, history_item_id\)/u,
    'the entitlement item snapshot is exact normalized rows');
  assert.match(items, /FOREIGN KEY \(world_id, user_id\)\s*\n?\s*REFERENCES public\.shared_world_standard_closed_view_entitlements \(world_id, user_id\) ON DELETE RESTRICT/u);
  assert.match(items, /FOREIGN KEY \(history_item_id, world_id\)\s*\n?\s*REFERENCES public\.shared_world_history_items \(id, world_id\) ON DELETE RESTRICT/u,
    'every entitled item belongs to the exact same World, structurally');
  assert.equal(items.split('\n').filter((line) => /^ {4}\w+\s+\S/u.test(line) && !/^ {4}CONSTRAINT\b/u.test(line)).length, 3,
    'the item snapshot carries exactly the three identity columns and no copied material');
  // One Standard closure per World, structurally.
  assert.match(tableBlock(ENDED_EVENTS), /CONSTRAINT shared_world_ended_events_world_key UNIQUE \(world_id\)/u,
    'a second competing close command can never manufacture a second WORLD_ENDED');
  assert.match(tableBlock(END_COMMANDS), /CONSTRAINT shared_world_standard_end_commands_world_key UNIQUE \(world_id\)/u);
});

test('both primitives are sealed, pinned, World-first, actor-free and executable by no application role', () => {
  // I-04F keeps EXACTLY ONE application/server-role historical visibility entry
  // point, and it is migration 0087's. This migration therefore grants nothing at
  // all: its closed-mode reader is an internal helper the 0087 resolver calls as
  // its own owner.
  assert.doesNotMatch(executableSql, /\bGRANT\b/u, 'migration 0088 grants nothing to anybody');
  for (const name of MUTATION_FUNCTIONS) {
    assert.match(executableSql, new RegExp(`ALTER FUNCTION public\\.${name}\\([^)]*\\) OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'));
    assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM service_role`, 'u'),
      `${name} is revoked from service_role too, because the frozen Launch Gate precondition is unimplemented`);
    assert.match(executableSql, new RegExp(`public\\.${name}\\([\\s\\S]{0,900}?LANGUAGE plpgsql SECURITY DEFINER SET search_path=''`, 'u'));
    // CLOSURE AUTHORITY IS UNANIMITY, NEVER A ROLE and never whoever transmits it.
    assert.doesNotMatch(BODY[name], /auth\.uid/u, `${name} derives and records no closer`);
    assert.doesNotMatch(BODY[name], /pg_advisory|LOCK TABLE/iu, `${name} takes no advisory or table lock`);
    assert.doesNotMatch(BODY[name], /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp/u,
      `${name} accepts no clock but the database's own`);
    // ARCHIVAL CLOSURE IS NOT DELETION.
    assert.doesNotMatch(BODY[name], /DELETE FROM|TRUNCATE/iu, `${name} deletes no canonical history`);
    assert.match(BODY[name], /FROM public\.shared_worlds w WHERE w\.id = (?:p_world_id|target_world) FOR UPDATE/u,
      `${name} locks the exact World row first`);
    assert.equal((BODY[name].match(/FOR UPDATE/gu) ?? []).length, 1,
      `${name} takes exactly one row lock of its own, and it is the World row`);
    // No Introduction closure, and no Matching, Public or Replay state.
    for (const absent of ['INTRODUCTION', 'MATCHING', 'PUBLIC_EXPERIENCE', 'REPLAY', 'matching_', 'introduction_']) {
      assert.ok(!BODY[name].includes(absent), `${name} touches no ${absent} state: I-04F closes Standard Worlds only`);
    }
  }
  for (const phrase of [
    'I-04F: PUBLIC must not execute the Standard closure surface before the launch gate exists',
    'I-04F: % must not execute the Standard closure surface before the launch gate exists',
    'I-04F: % records no closer: the authority is the exact unanimous END_WORLD approval set',
    'I-04F: % must not implement Introduction closure: that belongs to the Introduction line',
    'I-04F: % may never delete canonical history: closure is archival',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0088 refuses to deploy without: ${phrase}`);
  for (const name of OWN_TABLES) {
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
});

test('both primitives accept exactly their frozen identity list, and no reason, actor or clock', () => {
  assert.deepEqual(parameters(PREPARE_FN),
    ['p_proposal_id', 'p_membership_snapshot_id', 'p_end_payload_version_id', 'p_world_id'],
    'the closure preparation accepts four opaque identities and nothing describable');
  assert.deepEqual(parameters(COMMIT_FN), ['p_command_id', 'p_proposal_id', 'p_world_ended_event_id'],
    'the closure commit accepts three opaque identities and no actor at all');
  for (const name of MUTATION_FUNCTIONS) {
    for (const parameter of parameters(name)) {
      assert.doesNotMatch(parameter, /actor|closer|user_id|initiator|proposer|owner|admin|approver|approval_set|member_ids|episode|reason|note|audience|count|launch|gate|timestamp|instant|_at$/u,
        `${name} must not accept ${parameter}: an actor, reason, topology, count or clock parameter`);
    }
    assert.doesNotMatch(signature(name), /DEFAULT/u,
      `${name} declares no defaulted parameter, so a widened list cannot arrive silently`);
  }
});

test('0088 consumes the frozen I-04D governance and manufactures none of its own', () => {
  assert.match(BODY[PREPARE_FN], /public\.capture_shared_world_governance_proposal_v1\(/u,
    'the preparation opens its proposal through the frozen I-04D capture');
  assert.match(BODY[PREPARE_FN], /'END_WORLD', p_end_payload_version_id,\s*\n\s*'ALL_CURRENT_MEMBERS', NULL\)/u,
    'exactly END_WORLD under ALL_CURRENT_MEMBERS, with no exclusion');
  assert.match(BODY[PREPARE_FN], /captured\.snapshot_captured_at/u,
    'and persists the exact instant the frozen capture owned');
  assert.doesNotMatch(BODY[PREPARE_FN], /clock_timestamp/u, 'reading no clock of its own');
  assert.doesNotMatch(BODY[PREPARE_FN], /UPDATE public\.shared_worlds|UPDATE public\.shared_world_membership_episodes/u,
    'preparing a closure changes no lifecycle and closes no episode');
  assert.match(BODY[COMMIT_FN], /public\.resolve_shared_world_governance_approval_v1\([\s\S]{0,80}'END_WORLD', payload\.id\)/u,
    'the commit revalidates the exact operation AND the exact payload version it is about to apply');
  for (const name of MUTATION_FUNCTIONS) {
    for (const coupled of [
      'INSERT INTO public.shared_world_governance_proposals', 'UPDATE public.shared_world_governance_proposals',
      'INSERT INTO public.shared_world_governance_approvals', 'UPDATE public.shared_world_governance_approvals',
      'INSERT INTO public.shared_world_membership_snapshot',
      'INSERT INTO public.shared_world_history_access_grants',
      'INSERT INTO public.shared_world_history_package_',
      'public.shared_world_standing_context_grants', 'public.shared_world_standing_context_grant_audience',
      'public.shared_world_settings_state',
    ]) assert.ok(!BODY[name].includes(coupled), `${name} never performs: ${coupled}`);
  }
  assert.ok(selfAssertions.includes('I-04F: the frozen I-04D capture must already map END_WORLD to ALL_CURRENT_MEMBERS'));
});

test('the closure commits ONE instant across every persisted moment, in the one order that is truthful', () => {
  assert.match(BODY[COMMIT_FN], /closure_instant := clock_timestamp\(\);/u, 'the commit reads ONE database-owned instant');
  assert.equal((BODY[COMMIT_FN].match(/closure_instant := /gu) ?? []).length, 1, 'exactly once');
  for (const moment of [
    /SET lifecycle = 'READ_ONLY_CLOSED', phase = 'STANDARD', closed_at = closure_instant/u,
    /SET ended_at = closure_instant, end_reason = 'WORLD_CLOSED'/u,
    /VALUES \(p_world_ended_event_id, target_world, p_proposal_id, payload\.id, closure_instant\)/u,
    /VALUES \(p_command_id, target_world, p_proposal_id, payload\.id, p_world_ended_event_id, closure_instant\)/u,
    /SELECT e\.world_id, e\.user_id, e\.id, closure_instant/u,
  ]) assert.match(BODY[COMMIT_FN], moment, 'every persisted moment reuses the one canonical closure instant');
  // THE ORDER: World lock -> governance proof -> entitlement + item snapshot ->
  // World transition -> episode closure. The snapshot MUST precede the closure, or
  // it would record what a human could see after their membership was destroyed.
  const at = (needle) => BODY[COMMIT_FN].indexOf(needle);
  const world = at('FROM public.shared_worlds w WHERE w.id = target_world FOR UPDATE');
  const proof = at('public.resolve_shared_world_governance_approval_v1');
  const entitlement = at('INSERT INTO public.shared_world_standard_closed_view_entitlements');
  const snapshot = at('INSERT INTO public.shared_world_standard_closed_view_entitlement_items');
  const transition = at('UPDATE public.shared_worlds w');
  const episodes = at('UPDATE public.shared_world_membership_episodes e');
  const ended = at('INSERT INTO public.shared_world_ended_events');
  assert.ok(world > 0 && proof > world && entitlement > proof && snapshot > entitlement
    && transition > snapshot && episodes > transition && ended > episodes,
    'World, proof, entitlement, item snapshot, transition, episode closure, WORLD_ENDED - in that exact order');
  assert.match(BODY[COMMIT_FN], /public\.resolve_shared_world_history_visibility_v1\(ent\.world_id, ent\.user_id\)/u,
    'the item snapshot comes from the ONE frozen I-04F visibility resolver, never a re-implementation');
  assert.ok(selfAssertions.includes('I-04F: a closure must lock the World, prove governance and snapshot every entitlement BEFORE it destroys membership'));
  // Equivalent retry is historically stable AFTER closure: the first pass validates
  // the immutable facts this command owns, and never requires ACTIVE.
  const firstPass = BODY[COMMIT_FN].slice(0, BODY[COMMIT_FN].indexOf('WORLD-FIRST ORDER'));
  assert.match(firstPass, /w\.lifecycle = 'READ_ONLY_CLOSED' AND w\.phase = 'STANDARD'/u,
    'an equivalent retry validates the closure it committed, rather than demanding a pre-closure World');
  assert.ok(!firstPass.includes("world.lifecycle <> 'ACTIVE'"),
    'and never refuses merely because the World is now closed');
});

test('0088 adds no blanket freeze: a later reviewed privacy material mutation stays possible', () => {
  // READ_ONLY_CLOSED blocks ORDINARY mutation because every ordinary primitive
  // already requires ACTIVE / STANDARD. 0088 adds no rule, trigger or constraint
  // that would ALSO block a later reviewed PRIVACY_MATERIAL_MUTATION.
  assert.doesNotMatch(executableSql, /CREATE TRIGGER/iu, 'no trigger freezes a closed World');
  assert.ok(!deployableSql.includes('READ_ONLY_CLOSED') || deployableSql.split('READ_ONLY_CLOSED').length - 1 <= 3,
    'READ_ONLY_CLOSED appears only where this slice writes or reads its own closure');
  assert.ok(!executableSql.includes('CHECK (lifecycle'), 'and no new lifecycle check constraint is added anywhere');
  for (const table of OWN_TABLES) {
    assert.ok(!tableBlock(table).includes('shared_world_history_items (id) '),
      `${table} does not pin history items against future availability change`);
  }
  // The closed reader re-checks availability on every read, so a later valid owner
  // deletion still narrows an entitlement that already exists.
  assert.match(BODY[RESOLVE_FN], /i\.availability_state = 'AVAILABLE'/u,
    'a closed entitlement can never reconstruct owner-deleted or unavailable source');
  assert.ok(selfAssertions.includes('I-04F: a closed entitlement can never reconstruct owner-deleted or unavailable source'));
});

test('the closed-history reader is read-only, service-role-only and never consults membership', () => {
  assert.match(executableSql, new RegExp(`public\\.${RESOLVE_FN}\\(p_world_id uuid, p_user_id uuid\\)\\s*\\nRETURNS TABLE\\(world_id uuid, history_item_id uuid, occurred_at timestamptz\\)\\s*\\nLANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''`, 'u'),
    'it returns exactly world, item identity and time - never content, never a count');
  assert.doesNotMatch(BODY[RESOLVE_FN], /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'it mutates nothing, locks nothing and trusts no client claim');
  assert.ok(!BODY[RESOLVE_FN].includes('shared_world_membership_episodes'),
    'closed viewing is entitlement, never membership');
  assert.match(BODY[RESOLVE_FN], /world\.lifecycle <> 'READ_ONLY_CLOSED' OR world\.phase <> 'STANDARD'/u,
    'and it refuses any World that is not an archived Standard World');
  assert.ok(selfAssertions.includes('I-04F: closed viewing is entitlement, never membership: the reader must not consult episodes'));
});

test('the closed-history reader is INTERNAL: I-04F keeps exactly one server-role visibility entry point', () => {
  assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${RESOLVE_FN}\\(uuid, uuid\\) FROM PUBLIC, anon, authenticated;`, 'u'));
  assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${RESOLVE_FN}\\(uuid, uuid\\) FROM service_role`, 'u'),
    'service_role is revoked too: the helper is not a second read boundary');
  assert.doesNotMatch(executableSql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${RESOLVE_FN}`, 'u'),
    'and it is granted to nobody');
  assert.match(executableSql, /ALTER FUNCTION public\.resolve_shared_world_closed_history_visibility_v1\(uuid, uuid\) OWNER TO postgres;/u,
    'it stays a postgres-owned internal helper');
  for (const phrase of [
    'I-04F: % must not execute the internal closed-history helper: I-04F has ONE historical visibility entry point',
    'I-04F: PUBLIC must not execute the internal closed-history helper',
    'I-04F: service_role must still execute the ONE historical visibility entry point',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0088 refuses to deploy without: ${phrase}`);
  // The one entry point stays 0087's, and 0088 names it as the thing that must
  // still be reachable - so this slice narrowed the boundary rather than closing it.
  assert.match(selfAssertions, /public\.resolve_shared_world_history_visibility_v1\(uuid,uuid\)', 'EXECUTE'/u);
});

test('the verifier, the script and the CI step are registered, and the README records the slice', () => {
  assert.ok(existsSync(new URL('../verify-migration-0088.mjs', import.meta.url)), 'the real-PostgreSQL verifier exists');
  assert.match(verifier, /0088/u);
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0088\\.mjs"`, 'u'));
  assert.match(workflow, new RegExp(`run: npm run ${OWN_SCRIPT}\\}`, 'u'), 'one API CI step runs it');
  const step = workflow.split('\n').find((line) => line.includes(OWN_SCRIPT));
  assert.ok(step, 'the CI step exists');
  assert.doesNotMatch(step.slice(step.indexOf('{name:'), step.indexOf(', run:')), /,/u, 'the step name is comma-free');
  assert.match(readme, /0088_shared_world_standard_closure_v1\.sql/u, 'the README records migration 0088');
  assert.match(readme, /CLOSED_WORLD_VIEW_ENTITLEMENT/u);
});

test('the real-PostgreSQL verifier carries no live-schema ceiling of its own', () => {
  assert.doesNotMatch(verifier, /FORBIDDEN_TABLES|const (?:FORBIDDEN|ABSENT|BANNED|MUST_NOT_EXIST)\w*\s*=\s*\[/u,
    'no live future-object absence census: what 0088 did not create is proven from 0088 own text, above');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Ff]oreign[Kk]ey\w*\.length/u, 'foreign keys are asserted exactly, never counted');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Cc]onstraint\w*\.length/u, 'and neither are constraints');
  assert.doesNotMatch(verifier, /proname\s*~/u, 'and the function catalog is never swept for future names');
  assert.doesNotMatch(verifier, /c\.column_name ~\*/u, 'no migration-wide column NAME filter over the live column list');
  assert.doesNotMatch(verifier, /c\.data_type IN \('json'/u, 'and no migration-wide column TYPE filter over it either');
  assert.doesNotMatch(verifier, /migrations\.length|readdirSync\(new URL\('\.\.\/migrations/u,
    'and no migration count ceiling: later migrations are not 0088 regressions');
  assert.match(verifier, /const OWNED_FOREIGN_KEYS = \{/u);
  assert.match(verifier, /const OWNED_COLUMNS = \{/u);
  assert.match(verifier, /SELECT column_name, data_type, is_nullable, column_default FROM information_schema\.columns/u);
  assert.match(verifier, /observed\.slice\(0, owned\.length\)/u);
  assert.match(verifier, /async function verifyForwardSafety\(/u, 'the verifier proves forward safety against real PostgreSQL');
  assert.match(verifier, /await verifyForwardSafety\(f\);/u, 'and actually runs it');
  assert.match(verifier, /SAVEPOINT forward_safety/u, 'inside a rolled-back savepoint');
  assert.match(verifier, /await assert\.rejects\(verifyCatalog\(\), refuses/u, 'and requires real regressions to still be refused');
  for (const authorized of ['_introduction_closure', '_shared_material', '_privacy_material_mutation',
    '_launch_gates', 'CREATE INDEX', 'CREATE TRIGGER', '_entitlement_metadata']) {
    assert.ok(verifier.includes(authorized), `the probe proves a later reviewed ${authorized} is not an 0088 regression`);
  }
});

// ---------------------------------------------------------------------------
// Anti-vacuity: every assertion above must be capable of failing.
// ---------------------------------------------------------------------------

test('the contract is not vacuous: every deliberate weakening of migration 0088 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const weakenings = [
      ['grants authenticated EXECUTE on the closure commit', (text) => text.replace(
        `REVOKE ALL ON FUNCTION public.${COMMIT_FN}(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
        `GRANT EXECUTE ON FUNCTION public.${COMMIT_FN}(uuid, uuid, uuid) TO authenticated;`)],
      ['opens a SECOND server-role visibility entry point on the internal helper', (text) => text.replace(
        `ALTER FUNCTION public.${RESOLVE_FN}(uuid, uuid) OWNER TO postgres;`,
        `ALTER FUNCTION public.${RESOLVE_FN}(uuid, uuid) OWNER TO postgres;\n`
        + `GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role;`)],
      ['stops revoking the internal helper from service_role', (text) => text.replace(
        `  EXECUTE 'REVOKE ALL ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) FROM service_role';\n`, '')],
      ['lets a client supply a closure reason', (text) => text.replace(
        '    governance_operation_kind text NOT NULL,\n    created_at timestamptz NOT NULL,',
        '    governance_operation_kind text NOT NULL,\n    closure_reason text,\n    created_at timestamptz NOT NULL,')],
      ['records a closer', (text) => text.replace(
        'DECLARE\n  committed public.shared_world_standard_end_commands;',
        'DECLARE\n  u uuid := auth.uid();\n  committed public.shared_world_standard_end_commands;')],
      ['lets a World be closed twice', (text) => text.replace(
        '    CONSTRAINT shared_world_ended_events_world_key UNIQUE (world_id),\n', '')],
      ['snapshots the entitlement AFTER the membership is destroyed', (text) => text.replace(
        '    INSERT INTO public.shared_world_standard_closed_view_entitlements\n      (world_id, user_id, membership_episode_id, entitled_at)\n    SELECT e.world_id, e.user_id, e.id, closure_instant\n      FROM public.shared_world_membership_episodes e\n     WHERE e.world_id = target_world AND e.ended_at IS NULL;\n    GET DIAGNOSTICS entitlements = ROW_COUNT;\n',
        '')],
      ['leaves an episode open after closure', (text) => text.replace(
        "       SET ended_at = closure_instant, end_reason = 'WORLD_CLOSED'",
        "       SET end_reason = 'WORLD_CLOSED'")],
      ['closes the World without setting the closure instant', (text) => text.replace(
        "       SET lifecycle = 'READ_ONLY_CLOSED', phase = 'STANDARD', closed_at = closure_instant",
        "       SET lifecycle = 'READ_ONLY_CLOSED', phase = 'STANDARD'")],
      ['gives the entitlement an active-membership flag', (text) => text.replace(
        '    entitled_at timestamptz NOT NULL,', '    entitled_at timestamptz NOT NULL,\n    is_active boolean,')],
      ['deletes history at closure', (text) => text.replace(
        '    INSERT INTO public.shared_world_ended_events',
        '    DELETE FROM public.shared_world_history_items WHERE world_id = target_world;\n'
        + '    INSERT INTO public.shared_world_ended_events')],
      ['implements Introduction closure too', (text) => text.replace(
        "       SET lifecycle = 'READ_ONLY_CLOSED', phase = 'STANDARD', closed_at = closure_instant",
        "       SET lifecycle = 'READ_ONLY_CLOSED', phase = 'INTRODUCTION', closed_at = closure_instant")],
      ['lets a closed entitlement reconstruct deleted source', (text) => text.replace(
        "     WHERE it.world_id = p_world_id AND it.user_id = p_user_id\n       AND i.availability_state = 'AVAILABLE'",
        '     WHERE it.world_id = p_world_id AND it.user_id = p_user_id')],
      ['lets the closed reader answer from active membership', (text) => text.replace(
        '      JOIN public.shared_world_history_items i ON i.id = it.history_item_id',
        '      JOIN public.shared_world_history_items i ON i.id = it.history_item_id\n'
        + '      JOIN public.shared_world_membership_episodes e ON e.user_id = it.user_id')],
      ['re-implements visibility instead of consuming the frozen resolver', (text) => text.replace(
        'public.resolve_shared_world_history_visibility_v1(ent.world_id, ent.user_id) visible',
        'public.shared_world_history_items visible')],
      ['lets a caller supply the closure instant', (text) => text.replace(
        '  p_command_id uuid, p_proposal_id uuid, p_world_ended_event_id uuid\n) RETURNS TABLE(outcome text, end_command_id uuid',
        '  p_command_id uuid, p_proposal_id uuid, p_world_ended_event_id uuid, p_closed_at timestamptz DEFAULT NULL\n) RETURNS TABLE(outcome text, end_command_id uuid')],
    ];
    for (const [reason, weaken] of weakenings) {
      const weakened = weaken(migration);
      assert.notEqual(weakened, migration, `the probe for "${reason}" must actually change migration 0088`);
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
        return weakened.slice(open, weakened.indexOf(') RETURNS', open));
      };
      const at = (needle) => bodies[COMMIT_FN].indexOf(needle);
      const grantLines = sql.split('\n').filter((line) => /\bGRANT\b/u.test(line));
      const caught = [
        () => assert.equal(grantLines.length, 0),
        () => assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${RESOLVE_FN}\\(uuid, uuid\\) FROM service_role`, 'u')),
        () => assert.doesNotMatch(body, /closure_reason/u),
        () => assert.doesNotMatch(bodies[COMMIT_FN], /auth\.uid/u),
        () => assert.match(body, /CONSTRAINT shared_world_ended_events_world_key UNIQUE \(world_id\)/u),
        () => assert.ok(at('INSERT INTO public.shared_world_standard_closed_view_entitlements') > 0
          && at('INSERT INTO public.shared_world_standard_closed_view_entitlements') < at('UPDATE public.shared_world_membership_episodes e')),
        () => assert.match(bodies[COMMIT_FN], /SET ended_at = closure_instant, end_reason = 'WORLD_CLOSED'/u),
        () => assert.match(bodies[COMMIT_FN], /SET lifecycle = 'READ_ONLY_CLOSED', phase = 'STANDARD', closed_at = closure_instant/u),
        () => assert.doesNotMatch(body, /is_active/u),
        () => assert.doesNotMatch(bodies[COMMIT_FN], /DELETE FROM/iu),
        () => assert.ok(!bodies[COMMIT_FN].includes('INTRODUCTION')),
        () => assert.match(bodies[RESOLVE_FN], /i\.availability_state = 'AVAILABLE'/u),
        () => assert.ok(!bodies[RESOLVE_FN].includes('shared_world_membership_episodes')),
        () => assert.match(bodies[COMMIT_FN], /public\.resolve_shared_world_history_visibility_v1\(ent\.world_id, ent\.user_id\)/u),
        () => assert.doesNotMatch(declared(COMMIT_FN), /DEFAULT|_at\b/u),
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

const MIRRORED = ['database', '.github/workflows/api-ci.yml', 'package.json', 'tests/harness-temp-dir.mjs'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i04f-closure-');
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

test('a later Introduction closure, the I-04G material store, a reviewed privacy mutation and a Launch Gate leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'probe child' : false }, (t) => {
    const mirror = buildMirror();
    t.after(() => removeHarnessMirror(mirror));
    try {
      write(mirror, 'database/migrations/0089_shared_world_introduction_closure_and_material_v1.sql',
        '-- A later reviewed slice: Introduction closure, the I-04G material store, a reviewed\n'
        + '-- PRIVACY_MATERIAL_MUTATION on an already closed World, a Launch Gate and later\n'
        + '-- additive entitlement metadata.\n'
        + 'BEGIN;\n'
        + 'CREATE TABLE public.shared_world_introduction_records (id uuid PRIMARY KEY, world_id uuid NOT NULL);\n'
        + 'CREATE TABLE public.shared_world_introduction_ended_events (id uuid PRIMARY KEY, world_id uuid NOT NULL);\n'
        + 'CREATE TABLE public.shared_world_material (id uuid PRIMARY KEY, history_item_id uuid NOT NULL\n'
        + '  REFERENCES public.shared_world_history_items (id) ON DELETE RESTRICT, body text);\n'
        + 'ALTER TABLE public.shared_world_standard_closed_view_entitlements ADD COLUMN entitlement_metadata jsonb;\n'
        + 'CREATE INDEX shared_world_ended_events_time_idx ON public.shared_world_ended_events (occurred_at);\n'
        + 'CREATE TABLE public.launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL);\n'
        + 'CREATE FUNCTION public.end_shared_world_introduction_v1(p_world_id uuid) RETURNS void\n'
        + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + 'BEGIN\n'
        + "  UPDATE public.shared_worlds SET lifecycle = 'READ_ONLY_CLOSED', closed_at = clock_timestamp()\n"
        + "   WHERE id = p_world_id AND phase = 'INTRODUCTION';\n"
        + 'END$fn$;\n'
        + '-- A reviewed privacy material mutation that must stay possible AFTER closure.\n'
        + 'CREATE FUNCTION public.privacy_material_mutation_v1(p_item_id uuid) RETURNS void\n'
        + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + 'BEGIN\n'
        + '  UPDATE public.shared_world_history_items i\n'
        + "     SET availability_state = 'DELETED_BY_OWNER', availability_revision = i.availability_revision + 1\n"
        + '   WHERE i.id = p_item_id;\n'
        + 'END$fn$;\n'
        + 'CREATE FUNCTION public.end_shared_world_gated_v1(p_command_id uuid, p_proposal_id uuid, p_event_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + `BEGIN\n  PERFORM 1 FROM public.${COMMIT_FN}(p_command_id, p_proposal_id, p_event_id);\nEND$fn$;\n`
        + 'GRANT EXECUTE ON FUNCTION public.end_shared_world_gated_v1(uuid, uuid, uuid) TO authenticated;\n'
        + 'CREATE FUNCTION public.shared_world_closure_audit_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$\n'
        + 'BEGIN RETURN NULL; END$fn$;\n'
        + 'CREATE TRIGGER shared_world_ended_events_audit AFTER INSERT ON public.shared_world_ended_events\n'
        + '  FOR EACH ROW EXECUTE FUNCTION public.shared_world_closure_audit_v1();\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0089.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/shared-world-introduction-closure-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      assert.ok(runInMirror(mirror).ok,
        'a later reviewed Introduction closure producer, the I-04G material store, a reviewed privacy material '
        + 'mutation on a closed World, later additive entitlement metadata, a Launch Gate, a gated wrapper, a later '
        + 'index, a later audit trigger and migration 0089 must all leave this contract passing');

      const regressions = [
        ['0088 itself grants EXECUTE to an application role', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          `REVOKE ALL ON FUNCTION public.${PREPARE_FN}(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
          `GRANT EXECUTE ON FUNCTION public.${PREPARE_FN}(uuid, uuid, uuid, uuid) TO authenticated;`)],
        ['a frozen predecessor migration is edited', () => patch(mirror, 'database/migrations/0085_shared_world_governed_membership_lifecycle_v1.sql',
          'BEGIN;', 'BEGIN;\n-- edited\n')],
        ['0088 lets a client supply a closure reason', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '    governance_operation_kind text NOT NULL,\n    created_at timestamptz NOT NULL,',
          '    governance_operation_kind text NOT NULL,\n    closure_reason text,\n    created_at timestamptz NOT NULL,')],
        ['0088 alters a predecessor table', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          'CREATE TABLE public.shared_world_end_payload_versions (',
          'ALTER TABLE public.shared_world_governance_proposals ADD COLUMN closure_note text;\nCREATE TABLE public.shared_world_end_payload_versions (')],
        ['0088 installs a trigger of its own', () => patch(mirror, `database/migrations/${MIGRATION_NAME}`,
          '-- ---------------------------------------------------------------------------\n-- 5. Deny-by-default posture',
          'CREATE TRIGGER shared_world_closure_freeze AFTER UPDATE ON public.shared_worlds\n'
          + '  FOR EACH ROW EXECUTE FUNCTION public.qandeel_keepalive();\n'
          + '-- ---------------------------------------------------------------------------\n-- 5. Deny-by-default posture')],
        ['the CI step for this slice is removed', () => patch(mirror, '.github/workflows/api-ci.yml',
          `run: npm run ${OWN_SCRIPT}}`, 'run: echo skipped}')],
      ];
      for (const [reason, plant] of regressions) {
        const snapshot = buildMirror();
        try {
          plant(mirror);
          assert.equal(runInMirror(mirror).ok, false, `a repository where ${reason} must still be refused`);
        } finally {
          const wiped = removeHarnessMirror(mirror);
          assert.ok(wiped.removed,
            `the mirror must be wiped before the snapshot is restored: ${wiped.error?.message ?? wiped.refused ?? ''}`);
          cpSync(snapshot, mirror, { recursive: true });
          removeHarnessMirror(snapshot);
        }
      }
    } finally {
      removeHarnessMirror(mirror);
    }
  });
