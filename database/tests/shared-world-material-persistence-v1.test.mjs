// I-04G - Shared Material Persistence v1: the secret-free structural contract
// for migration 0089.
//
// Live semantics - ACLs, real denials, the resolver composing the frozen I-04F
// entry point, real bodies, real provenance and forward safety - are proven by
// database/verify-migration-0089.mjs against real PostgreSQL, which this file
// pins into the toolchain and CI. What is proven HERE is the structure a
// migration must already have before it is allowed to deploy.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-04G PART A: that THIS slice created the
// Shared material envelope, its normalized per-kind bodies, its provenance
// relation and ONE narrow read boundary over the frozen I-04F projection - and
// nothing beyond it. No writer, no trigger, no deletion, no second history or
// audience model, no JSON content blob, no owner/admin role column, no media
// storage provider, no Launch Gate, wrapper, controller or route - and that it
// modified no predecessor migration at all.
//
// It deliberately does NOT prove that a later reviewed producer, column, index,
// audit trigger, provider metadata relation or consumer may never appear. Every
// assertion is scoped to migration 0089 itself, the verifier it added, the
// registration lines it added, and the frozen predecessors it was required not
// to modify - pinned by content hash, which proves immutability without banning
// additions. Migration 0090 is deliberately NOT content-pinned here: it is this
// slice's own sibling, shipping in the same PR, and pinning a sibling would pin
// a hash that is still moving.
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
const SELF = 'shared-world-material-persistence-v1.test.mjs';
/** Set in the child runs of the forward-safety probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I04G_MATERIAL_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0089_shared_world_material_persistence_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0089.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const deployableSql = executableSql.slice(0, executableSql.indexOf('DO $$\nDECLARE'));
const selfAssertions = executableSql.slice(executableSql.indexOf('DO $$\nDECLARE'));

const MATERIALS = 'shared_world_materials';
const TEXT_BODIES = 'shared_world_text_material_bodies';
const VOICE_BODIES = 'shared_world_voice_note_material_bodies';
const DEPENDENCIES = 'shared_world_material_dependencies';
const OWN_TABLES = [MATERIALS, TEXT_BODIES, VOICE_BODIES, DEPENDENCIES];

const RESOLVE_FN = 'resolve_shared_world_material_v1';
const ENTRY_POINT_FN = 'resolve_shared_world_history_visibility_v1';
const OWN_SCRIPT = 'verify:shared-world-material-persistence:integration';

/** The frozen CW2-03 section 36 material vocabulary, complete. */
const MATERIAL_KINDS = ['HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS',
  'EXPLICIT_DISCLOSURE', 'WORLD_EVENT_DERIVED_MATERIAL'];
/** The three frozen provenance kinds (I-00 section 12, kernel material.types.ts). */
const DEPENDENCY_KINDS = ['MATERIAL_DEPENDENCY', 'REASONING_DEPENDENCY', 'INDEPENDENT_TARGET_TRUTH'];

const functionBody = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0089 creates ${name}`);
  const start = migration.indexOf('AS $$', create);
  assert.ok(start > create, `${name} opens a dollar-quoted body`);
  const end = migration.indexOf('\nEND$$;', start);
  assert.ok(end > start, `${name} has a terminated body`);
  return migration.slice(start + 'AS $$'.length, end + '\nEND'.length);
};
const RESOLVE_BODY = functionBody(RESOLVE_FN);

/**
 * The declared parameter list of one function.
 *
 * `RETURNS` may sit on the same line as the closing parenthesis or on the next
 * one, so the terminator is matched rather than assumed: an exact `') RETURNS'`
 * search silently finds nothing on a wrapped declaration, and every proof built
 * on it then fails for the wrong reason.
 */
const signature = (name) => {
  const create = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(create >= 0, `migration 0089 creates ${name}`);
  const open = create + `CREATE FUNCTION public.${name}(`.length;
  const terminator = /\)\s*RETURNS/u.exec(migration.slice(open));
  assert.ok(terminator, `${name} has a terminated parameter list`);
  return migration.slice(open, open + terminator.index);
};
const parameters = (name) => [...signature(name).matchAll(/(p_[a-z_0-9]+)\s+(?:uuid|text|integer)/gu)].map((m) => m[1]);

const tableBlock = (name) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${name} (`);
  assert.ok(start >= 0, `migration 0089 creates ${name}`);
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

test('0089 is the forward migration after 0088, and every frozen predecessor is byte-identical', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME), 'migration 0089 exists');
  assert.equal(migrations.filter((name) => name.startsWith('0089_')).length, 1, 'exactly one migration carries the 0089 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0088_shared_world_standard_closure_v1.sql'),
    '0089 orders after 0088, whose history projection it binds to');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  for (const [name, blob] of PINNED_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical: I-04G reopens no predecessor`);
  }
  assert.doesNotMatch(deployableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu, '0089 drops nothing');
  assert.doesNotMatch(deployableSql, /\bALTER\s+TABLE\s+\w*\s*public\.\w+\s+(?:RENAME|DROP)\b/iu, 'and renames nothing');
});

test('0089 alters no predecessor table, installs no trigger and writes nothing', () => {
  const alters = deployableSql.match(/^ALTER TABLE\s+public\.(\w+)[\s\S]*?;/gmu) ?? [];
  const foreign = alters.filter((statement) => !OWN_TABLES.some((name) => statement.includes(`public.${name}`)));
  assert.deepEqual(foreign, [], 'no statement alters a table 0089 did not create');
  assert.doesNotMatch(deployableSql, /ADD COLUMN/iu, 'no predecessor table gains a column');
  assert.doesNotMatch(executableSql, /CREATE TRIGGER/iu, 'migration 0089 creates no trigger at all');
  assert.doesNotMatch(executableSql, /RETURNS trigger/iu, 'and no trigger function for one to call');
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?RULE|CREATE EVENT TRIGGER/iu, 'and no rule or event trigger');
  assert.doesNotMatch(executableSql, /CREATE POLICY/iu, 'and no RLS policy');
  // PART A is persistence. Every writer belongs to migration 0090.
  assert.doesNotMatch(deployableSql, /INSERT INTO|UPDATE public\.\w+\s+SET|DELETE FROM/iu,
    '0089 writes nothing: the commit and deletion runtime is migration 0090');
  assert.ok(selfAssertions.includes('I-04G: PART A installs no trigger: the commit and deletion runtime is migration 0090'));
  assert.doesNotMatch(migration, /@Controller|@Post|@Get|NestJS/u, 'the migration adds no application surface');
});

test('the envelope is exactly four relations, with no JSON blob, no role column and no second history model', () => {
  const created = [...executableSql.matchAll(/CREATE TABLE public\.(\w+) \(/gu)].map((m) => m[1]);
  assert.deepEqual(created.sort(), [...OWN_TABLES].sort(), 'exactly the four relations, and nothing else');
  for (const name of OWN_TABLES) {
    for (const declaration of columnLines(name)) {
      assert.doesNotMatch(declaration, /\b(?:json|jsonb|hstore|bytea)\b|\[\]/iu,
        `${name}: ${declaration.trim()} stores no JSON, array, hstore or binary payload`);
      assert.doesNotMatch(declaration, /(owner|admin|moderator|inviter|creator|initiator|privilege|capability|permission|entitlement|safety|launch)/iu,
        `${name}: ${declaration.trim()} carries no role, policy or gate column`);
    }
    assert.match(tableBlock(name), /ON DELETE RESTRICT/u, `${name} cascades no canonical history away`);
    assert.doesNotMatch(tableBlock(name), /ON DELETE (?:CASCADE|SET NULL|SET DEFAULT)/u, `${name} uses restrictive deletion only`);
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} OWNER TO postgres;`, 'u'));
    assert.match(executableSql, new RegExp(`ALTER TABLE public\\.${name} ENABLE ROW LEVEL SECURITY;`, 'u'));
  }
  // Availability, audience and material authority stay on the frozen I-04F
  // projection. A copy here would be a second truth.
  for (const forbidden of ['availability_state', 'availability_revision', 'baseline', 'approver', 'occurred_at', 'registered_at']) {
    assert.ok(!tableBlock(MATERIALS).includes(forbidden),
      `the envelope carries no ${forbidden}: I-04F owns availability, audience and material authority`);
  }
  assert.ok(selfAssertions.includes('I-04G: availability, audience and material authority stay on the frozen I-04F projection'));
  assert.ok(selfAssertions.includes('I-04G: material authority is the exact required-approver relation, never a role column'));
  assert.ok(selfAssertions.includes('I-04G: material bodies are normalized relations, never a universal JSON or binary payload'));
});

test('one material is one history item in one exact World, structurally', () => {
  const envelope = tableBlock(MATERIALS);
  assert.match(envelope, /CONSTRAINT shared_world_materials_history_item_key UNIQUE \(history_item_id\)/u,
    'one history item carries at most one material');
  assert.match(envelope, /FOREIGN KEY \(history_item_id, world_id\)\s*\n?\s*REFERENCES public\.shared_world_history_items \(id, world_id\) ON DELETE RESTRICT/u,
    'and the item belongs to the exact same World, structurally rather than procedurally');
  assert.match(envelope, /CONSTRAINT shared_world_materials_world_key UNIQUE \(id, world_id\)/u);
  assert.match(envelope, /CONSTRAINT shared_world_materials_instant_key UNIQUE \(id, established_at\)/u);
  assert.match(envelope, /CONSTRAINT shared_world_materials_body_form_key UNIQUE \(id, body_form\)/u);
  // established_at carries its frozen meaning into the catalog, exactly as
  // migration 0087 did for occurred_at - not into a source comment only.
  assert.match(executableSql, /COMMENT ON COLUMN public\.shared_world_materials\.established_at IS/u);
  assert.match(migration, /NOT a recalled event time, source-event semantic/u);
});

test('the frozen material vocabulary is complete, and only the four implemented kinds pin a producer', () => {
  const envelope = tableBlock(MATERIALS);
  for (const kind of MATERIAL_KINDS) {
    assert.ok(envelope.includes(`'${kind}'`), `${kind} is part of the frozen CW2-03 section 36 vocabulary`);
  }
  assert.match(envelope, /CHECK \(producer_kind IN \('HUMAN', 'QANDEEL'\)\)/u);
  // QANDEEL never has a human author; a human producer always does.
  assert.match(envelope, /CHECK \(\(producer_kind = 'HUMAN' AND author_user_id IS NOT NULL\)\s*\n?\s*OR \(producer_kind = 'QANDEEL' AND author_user_id IS NULL\)\)/u,
    'QANDEEL is a system actor and never a human consent principal');
  assert.match(envelope, /material_kind IN \('HUMAN_TEXT', 'HUMAN_VOICE_NOTE'\) AND producer_kind = 'HUMAN'/u);
  assert.match(envelope, /material_kind IN \('QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS'\) AND producer_kind = 'QANDEEL'/u);
  // The kind-to-body binding is structural.
  assert.match(envelope, /material_kind IN \('HUMAN_TEXT', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS'\) AND body_form = 'TEXT'/u);
  assert.match(envelope, /material_kind = 'HUMAN_VOICE_NOTE' AND body_form = 'VOICE_NOTE'/u);
  assert.match(envelope, /material_kind IN \('EXPLICIT_DISCLOSURE', 'WORLD_EVENT_DERIVED_MATERIAL'\) AND body_form = 'RESERVED'/u,
    'the two reserved kinds get no body relation at all until a reviewed producer exists');
  for (const [body, form] of [[TEXT_BODIES, 'TEXT'], [VOICE_BODIES, 'VOICE_NOTE']]) {
    assert.match(tableBlock(body), new RegExp(`CHECK \\(body_form = '${form}'\\)`, 'u'));
    assert.match(tableBlock(body), /FOREIGN KEY \(material_id, body_form\)\s*\n?\s*REFERENCES public\.shared_world_materials \(id, body_form\) ON DELETE RESTRICT/u,
      `${body} can attach only to a material whose kind takes that body`);
    assert.match(tableBlock(body), new RegExp(`PRIMARY KEY \\(material_id\\)`, 'u'), `${body} holds one body per material`);
  }
});

test('the text body is a real non-empty UTF-8 body, with no invented Product copy limit', () => {
  const body = tableBlock(TEXT_BODIES);
  assert.match(body, /^ {4}body_text text NOT NULL,$/mu, 'the real body is persisted, not a reference to one');
  assert.match(body, /CHECK \(length\(btrim\(body_text\)\) > 0\)/u, 'and it is non-empty');
  assert.doesNotMatch(body, /length\(body_text\) <=|length\(body_text\) </u,
    'no maximum body length is invented here: no frozen contract states a Product copy limit');
  assert.equal(columnLines(TEXT_BODIES).length, 3, 'exactly material_id, body_form and the body itself');
});

test('the voice note keeps an opaque media reference that is neither a URL nor a credential', () => {
  const body = tableBlock(VOICE_BODIES);
  assert.match(body, /^ {4}audio_object_ref text NOT NULL,$/mu, 'an original voice note always has its media object reference');
  assert.match(body, /^ {4}transcript_text text,$/mu, 'the transcript is optional');
  assert.match(body, /^ {4}duration_ms integer,$/mu);
  assert.match(body, /audio_object_ref !~ ':\/\/'/u, 'the reference is not a public URL');
  assert.match(body, /audio_object_ref !~ '\[\?#\]'/u, 'and carries no query string or fragment');
  assert.match(body, /token\|signature\|sig=\|key=\|secret\|password\|credential\|bearer\|x-amz\|expires\|assertion/u,
    'and carries no credential or signature');
  assert.match(body, /CHECK \(duration_ms IS NULL OR duration_ms > 0\)/u);
  assert.doesNotMatch(body, /duration_ms <=|media_type|mime/iu,
    'no media type and no invented duration ceiling: the repository has no convention for either');
  // I-04G builds no storage provider, upload path or credential.
  assert.doesNotMatch(executableSql, /bucket|s3|gcs|azure|presign|upload|storage_credential/iu,
    'I-04G builds no media storage provider, upload path or storage credential');
});

test('the three provenance kinds are exact, and a MATERIAL_DEPENDENCY cycle is unrepresentable', () => {
  const deps = tableBlock(DEPENDENCIES);
  for (const kind of DEPENDENCY_KINDS) assert.ok(deps.includes(`'${kind}'`), `${kind} is preserved exactly`);
  // Each kind's exact shape.
  assert.match(deps, /dependency_kind = 'MATERIAL_DEPENDENCY'\s*\n?\s*AND source_material_id IS NOT NULL AND source_established_at IS NOT NULL\s*\n?\s*AND source_context_ref IS NULL/u,
    'a material dependency names a committed Shared source and never a private context');
  assert.match(deps, /dependency_kind = 'REASONING_DEPENDENCY'\s*\n?\s*AND source_material_id IS NULL AND source_established_at IS NULL\s*\n?\s*AND source_context_ref IS NOT NULL/u,
    'a reasoning dependency names an opaque context and never a material: reasoning influence is not material consent');
  assert.match(deps, /dependency_kind = 'INDEPENDENT_TARGET_TRUTH'\s*\n?\s*AND source_material_id IS NULL AND source_established_at IS NULL\s*\n?\s*AND source_context_ref IS NULL/u,
    'an independent target has no source of any kind');
  // The opaque context reference can hold no raw private prose.
  assert.match(deps, /length\(source_context_ref\) <= 200\s*\n?\s*AND source_context_ref !~ '\\s'/u,
    'a private source reference is bounded and whitespace-free, so raw content cannot be stored in it');
  // Acyclicity, structurally.
  assert.match(deps, /CHECK \(source_material_id IS NULL OR source_material_id <> target_material_id\)/u);
  assert.match(deps, /CHECK \(source_established_at IS NULL OR source_established_at < target_established_at\)/u,
    'every MATERIAL_DEPENDENCY edge strictly increases establishment time, so a cycle cannot be represented');
  assert.match(deps, /FOREIGN KEY \(target_material_id, target_established_at\)\s*\n?\s*REFERENCES public\.shared_world_materials \(id, established_at\)/u);
  assert.match(deps, /FOREIGN KEY \(source_material_id, source_established_at\)\s*\n?\s*REFERENCES public\.shared_world_materials \(id, established_at\)/u);
  // Source and target share ONE world_id column, so both bind to the same World.
  assert.match(deps, /FOREIGN KEY \(target_material_id, world_id\)\s*\n?\s*REFERENCES public\.shared_world_materials \(id, world_id\)/u);
  assert.match(deps, /FOREIGN KEY \(source_material_id, world_id\)\s*\n?\s*REFERENCES public\.shared_world_materials \(id, world_id\)/u);
  assert.ok(selfAssertions.includes('I-04G: a MATERIAL_DEPENDENCY cycle must be unrepresentable, not merely refused'));
  // One effective edge per (target, source) and per (target, context).
  assert.match(executableSql, /CREATE UNIQUE INDEX shared_world_material_dependencies_one_material_edge_idx[\s\S]{0,200}WHERE dependency_kind = 'MATERIAL_DEPENDENCY'/u);
  assert.match(executableSql, /CREATE UNIQUE INDEX shared_world_material_dependencies_one_reasoning_edge_idx[\s\S]{0,200}WHERE dependency_kind = 'REASONING_DEPENDENCY'/u);
  assert.match(executableSql, /CREATE UNIQUE INDEX shared_world_material_dependencies_one_independent_idx[\s\S]{0,200}WHERE dependency_kind = 'INDEPENDENT_TARGET_TRUTH'/u);
});

test('the material resolver composes the ONE frozen I-04F entry point and discloses nothing beside material', () => {
  assert.match(executableSql, new RegExp(`public\\.${RESOLVE_FN}\\(p_world_id uuid, p_user_id uuid\\)[\\s\\S]{0,400}?LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''`, 'u'));
  assert.deepEqual(parameters(RESOLVE_FN), ['p_world_id', 'p_user_id'],
    'it accepts the exact World and the exact human, and nothing describable');
  assert.match(RESOLVE_BODY, new RegExp(`public\\.${ENTRY_POINT_FN}\\(p_world_id, p_user_id\\)`, 'u'),
    'visibility is DECIDED by the frozen I-04F resolver, never re-implemented here');
  assert.doesNotMatch(RESOLVE_BODY, /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'it mutates nothing, locks nothing and trusts no client claim');
  // NO SEALED PROVENANCE, NO AUTHORITY ROW, NO MEMBERSHIP.
  for (const forbidden of ['shared_world_material_dependencies', 'source_context_ref', 'source_material_id',
    'shared_world_history_item_required_approvers', 'shared_world_membership_episodes',
    'shared_world_history_item_baseline_viewers', 'shared_world_history_access_grants']) {
    assert.ok(!RESOLVE_BODY.includes(forbidden), `the resolver never reads ${forbidden}`);
  }
  // NO PLACEHOLDER FOR HIDDEN OR DELETED MATERIAL.
  assert.doesNotMatch(RESOLVE_BODY, /count\(|hidden|placeholder|tombstone|redacted|UNION/iu,
    'hidden and deleted material produce no row, no count and no placeholder');
  assert.match(RESOLVE_BODY, /AND \(t\.material_id IS NOT NULL OR v\.material_id IS NOT NULL\)/u,
    'a material whose body no longer exists is not returned at all');
  // The bounded renderable result, exactly.
  assert.match(executableSql, /RETURNS TABLE\(world_id uuid, material_id uuid, history_item_id uuid, material_kind text,\s*\n\s*established_at timestamptz, author_user_id uuid, text_body text,\s*\n\s*audio_object_ref text, transcript_text text\)/u);
  for (const phrase of [
    'I-04G: % must consume the ONE frozen I-04F visibility entry point, never re-implement it',
    'I-04G: % must disclose no provenance source, no material authority and no membership',
    'I-04G: hidden and deleted material must produce no row, no count and no placeholder',
    'I-04G: % must return exactly the bounded renderable material, not %',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0089 refuses to deploy without: ${phrase}`);
});

test('every direct relation stays sealed, and service_role executes the resolver alone', () => {
  const grants = executableSql.split('\n').filter((line) => /\bGRANT\b/u.test(line));
  assert.deepEqual(grants.map((line) => line.trim()),
    [`GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role;`],
    'the ONLY grant in migration 0089 is service_role EXECUTE on the read-only resolver');
  assert.match(executableSql, new RegExp(`REVOKE ALL ON TABLE public\\.${MATERIALS},`, 'u'));
  assert.match(executableSql, /FROM PUBLIC, anon, authenticated;/u);
  assert.match(executableSql, /FROM service_role'/u, 'and service_role is revoked from every table too');
  assert.match(executableSql, new RegExp(`ALTER FUNCTION public\\.${RESOLVE_FN}\\(uuid, uuid\\) OWNER TO postgres;`, 'u'));
  assert.match(executableSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${RESOLVE_FN}\\(uuid, uuid\\) FROM PUBLIC, anon, authenticated;`, 'u'));
  for (const phrase of [
    'I-04G: the material store must stay sealed: % holds % on %',
    'I-04G: PUBLIC must not execute the material resolver',
    'I-04G: service_role must execute the ONE narrow material resolver',
    'I-04G: service_role must still execute the ONE historical visibility entry point',
  ]) assert.ok(selfAssertions.includes(phrase), `migration 0089 refuses to deploy without: ${phrase}`);
});

test('0089 own parameter deny-pattern never rejects the exact frozen parameter list it guards', () => {
  // A migration whose parameter-name deny-pattern matches one of the parameters
  // it is guarding REFUSES ITSELF at deploy. That is the I-04F FIX-02 defect
  // class, and it is caught here by reading the migration's OWN pattern and
  // running it against the migration's OWN frozen parameter names.
  const patterns = [...selfAssertions.matchAll(
    /FOREACH arg_name IN ARRAY in_names LOOP\s*\n\s*IF arg_name ~\*\s*'((?:[^']|'')*)'/gu)]
    .map((m) => m[1].replace(/''/gu, "'"));
  assert.equal(patterns.length, 1, 'exactly one parameter deny-pattern: the resolver');
  const guarded = parameters(RESOLVE_FN);
  assert.ok(guarded.length > 0, 'the guarded parameter list is non-empty, so this proof is not vacuous');
  // PostgreSQL `~*` over these tokens is equivalent to a case-insensitive JS
  // regex: they use no PostgreSQL-only construct, and `$` anchors the whole
  // string in both, because PostgreSQL newline-sensitive matching is off by default.
  const deny = new RegExp(patterns[0], 'i');
  for (const parameter of guarded) {
    assert.doesNotMatch(parameter, deny,
      `migration 0089 would refuse ITSELF at deploy: its own deny pattern /${patterns[0]}/ rejects its own frozen parameter ${parameter}`);
  }
  assert.match(selfAssertions, /IF in_names <> ARRAY\['p_world_id', 'p_user_id'\] THEN/u,
    'the frozen resolver parameter list is still asserted exactly, so the ban above cannot pass vacuously');
});

test('every prosrc self-assertion is satisfied by the body it actually guards', () => {
  // The other half of the I-04F FIX-02 / FIX-03 lesson: a REQUIRED pattern that
  // matches no body, or a BAN that matches the body it guards, makes the
  // migration refuse itself the first time PostgreSQL sees it. pg_proc.prosrc is
  // the text between `AS $$` and the closing `END`, COMMENTS INCLUDED - which is
  // exactly why a ban on a bare vocabulary token is dangerous.
  //
  // Reading each operand on its own is faithful ONLY while every guard is a
  // single comparison. A compound condition such as `A AND NOT B` is an
  // implication, and reading its first operand as a ban would report a defect in
  // correct code - so the shape this proof depends on is asserted first. (The
  // 0090 contract, whose migration really does carry a compound guard, evaluates
  // whole conditions instead.)
  for (const line of selfAssertions.split('\n')) {
    if (!/p\.prosrc\s*!?~/u.test(line)) continue;
    assert.equal((line.match(/p\.prosrc\s*!?~/gu) ?? []).length, 1,
      `migration 0089 gained a compound prosrc condition this proof cannot read faithfully: ${line.trim()}`);
  }
  const guards = [...selfAssertions.matchAll(/p\.prosrc\s+(!?~\*?)\s*'((?:[^']|'')*)'/gu)]
    .map((m) => ({ required: m[1].startsWith('!'), insensitive: m[1].endsWith('*'), pattern: m[2].replace(/''/gu, "'") }));
  assert.ok(guards.length >= 4, `migration 0089 carries prosrc self-assertions (found ${guards.length})`);
  for (const { required, insensitive, pattern } of guards) {
    // PostgreSQL runs `~` / `~*` with NEWLINE-SENSITIVE MATCHING OFF, so a `.`
    // matches a NEWLINE and a pattern can span a whole body. JavaScript's
    // equivalent is the `s` (dotAll) flag, and simulating without it is what let
    // a self-rejecting guard reach deploy in the 0090 slice.
    const matches = new RegExp(pattern, insensitive ? 'siu' : 'su').test(RESOLVE_BODY);
    if (required) {
      assert.ok(matches, `migration 0089 requires /${pattern}/ of its resolver, and the deployed body does not satisfy it`);
    } else {
      assert.ok(!matches, `migration 0089 bans /${pattern}/ and its own resolver body matches it: the migration would refuse itself`);
    }
  }
});

test('the verifier, the script and the CI step are registered, and the README records the slice', () => {
  assert.ok(existsSync(new URL('../verify-migration-0089.mjs', import.meta.url)), 'the real-PostgreSQL verifier exists');
  assert.match(verifier, /0089/u);
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0089\\.mjs"`, 'u'));
  assert.match(workflow, new RegExp(`run: npm run ${OWN_SCRIPT}\\}`, 'u'), 'one API CI step runs it');
  const step = workflow.split('\n').find((line) => line.includes(OWN_SCRIPT));
  assert.ok(step, 'the CI step exists');
  assert.doesNotMatch(step.slice(step.indexOf('{name:'), step.indexOf(', run:')), /,/u, 'the step name is comma-free');
  assert.match(readme, /0089_shared_world_material_persistence_v1\.sql/u, 'the README records migration 0089');
  assert.match(readme, /MATERIAL_DEPENDENCY/u);
});

test('the real-PostgreSQL verifier carries no live-schema ceiling of its own', () => {
  assert.doesNotMatch(verifier, /FORBIDDEN_TABLES|const (?:FORBIDDEN|ABSENT|BANNED|MUST_NOT_EXIST)\w*\s*=\s*\[/u,
    'no live future-object absence census: what 0089 did not create is proven from 0089 own text, above');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Ff]oreign[Kk]ey\w*\.length/u, 'foreign keys are asserted exactly, never counted');
  assert.doesNotMatch(verifier, /assert\.equal\(\s*\w*[Cc]onstraint\w*\.length/u, 'and neither are constraints');
  assert.doesNotMatch(verifier, /proname\s*~/u, 'and the function catalog is never swept for future names');
  assert.doesNotMatch(verifier, /c\.column_name ~\*/u, 'no migration-wide column NAME filter over the live column list');
  assert.doesNotMatch(verifier, /c\.data_type IN \('json'/u, 'and no migration-wide column TYPE filter over it either');
  assert.doesNotMatch(verifier, /migrations\.length|readdirSync\(new URL\('\.\.\/migrations/u,
    'and no migration count ceiling: later migrations are not 0089 regressions');
  assert.match(verifier, /const OWNED_FOREIGN_KEYS = \{/u);
  assert.match(verifier, /const OWNED_COLUMNS = \{/u);
  assert.match(verifier, /SELECT column_name, data_type, is_nullable, column_default FROM information_schema\.columns/u);
  assert.match(verifier, /observed\.slice\(0, owned\.length\)/u);
  assert.match(verifier, /async function verifyForwardSafety\(/u, 'the verifier proves forward safety against real PostgreSQL');
  assert.match(verifier, /await verifyForwardSafety\(f\);/u, 'and actually runs it');
  assert.match(verifier, /SAVEPOINT forward_safety/u, 'inside a rolled-back savepoint');
  assert.match(verifier, /await assert\.rejects\(verifyCatalog\(\), refuses/u, 'and requires real regressions to still be refused');
  for (const authorized of ['_explicit_disclosure', '_world_event_material', '_introduction_material',
    '_launch_gates', '_provider_metadata', 'CREATE INDEX', 'CREATE TRIGGER', '_material_metadata']) {
    assert.ok(verifier.includes(authorized), `the probe proves a later reviewed ${authorized} is not an 0089 regression`);
  }
});

// ---------------------------------------------------------------------------
// Anti-vacuity: every assertion above must be capable of failing.
// ---------------------------------------------------------------------------

test('the contract is not vacuous: every deliberate weakening of migration 0089 is refused by at least one structural check',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const weakenings = [
      ['grants authenticated SELECT on the material store', (text) => text.replace(
        '  FROM PUBLIC, anon, authenticated;', '  FROM PUBLIC, anon;\nGRANT SELECT ON TABLE public.shared_world_materials TO authenticated;')],
      ['lets one history item carry two materials', (text) => text.replace(
        '    CONSTRAINT shared_world_materials_history_item_key UNIQUE (history_item_id),\n', '')],
      ['lets a material bind a history item from another World', (text) => text.replace(
        'FOREIGN KEY (history_item_id, world_id)\n        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT',
        'FOREIGN KEY (history_item_id) REFERENCES public.shared_world_history_items (id) ON DELETE RESTRICT')],
      ['gives QANDEEL a human author', (text) => text.replace(
        "OR (producer_kind = 'QANDEEL' AND author_user_id IS NULL)),",
        "OR (producer_kind = 'QANDEEL')),")],
      ['stores a universal JSON payload instead of a normalized body', (text) => text.replace(
        '    body_text text NOT NULL,', '    body_text text NOT NULL,\n    payload jsonb,')],
      ['gives the envelope an owner column', (text) => text.replace(
        '    author_user_id uuid,', '    author_user_id uuid,\n    owner_user_id uuid,')],
      ['copies availability onto the envelope as a second truth', (text) => text.replace(
        '    established_at timestamptz NOT NULL,', '    established_at timestamptz NOT NULL,\n    availability_state text,')],
      ['invents a Product copy limit on the body', (text) => text.replace(
        'CHECK (length(btrim(body_text)) > 0)', 'CHECK (length(btrim(body_text)) > 0 AND length(body_text) <= 4000)')],
      ['lets the audio object reference be a signed public URL', (text) => text.replace(
        "           AND audio_object_ref !~ '://'\n", '')],
      ['lets a reasoning dependency carry a material source', (text) => text.replace(
        "            OR (dependency_kind = 'REASONING_DEPENDENCY'\n                AND source_material_id IS NULL AND source_established_at IS NULL\n                AND source_context_ref IS NOT NULL)",
        "            OR (dependency_kind = 'REASONING_DEPENDENCY'\n                AND source_context_ref IS NOT NULL)")],
      ['lets a MATERIAL_DEPENDENCY cycle exist', (text) => text.replace(
        '    CONSTRAINT shared_world_material_dependencies_source_precedes_check\n        CHECK (source_established_at IS NULL OR source_established_at < target_established_at),\n', '')],
      ['lets a material depend on itself', (text) => text.replace(
        '    CONSTRAINT shared_world_material_dependencies_no_self_check\n        CHECK (source_material_id IS NULL OR source_material_id <> target_material_id),\n', '')],
      ['stores raw private prose in the reasoning source reference', (text) => text.replace(
        "               AND length(source_context_ref) <= 200\n               AND source_context_ref !~ '\\s'", '               AND length(source_context_ref) <= 200000')],
      ['re-implements visibility instead of consuming the frozen entry point', (text) => text.replace(
        'FROM public.resolve_shared_world_history_visibility_v1(p_world_id, p_user_id) visible',
        'FROM public.shared_world_history_items visible')],
      ['returns a placeholder row for material whose body is gone', (text) => text.replace(
        '       AND (t.material_id IS NOT NULL OR v.material_id IS NOT NULL)\n', '')],
      ['discloses the sealed provenance source through the ordinary resolver', (text) => text.replace(
        '      LEFT JOIN public.shared_world_voice_note_material_bodies v ON v.material_id = m.id',
        '      LEFT JOIN public.shared_world_voice_note_material_bodies v ON v.material_id = m.id\n'
        + '      LEFT JOIN public.shared_world_material_dependencies d ON d.target_material_id = m.id')],
      ['opens the resolver to authenticated', (text) => text.replace(
        `GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role;`,
        `GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role, authenticated;`)],
      ['installs a writer in PART A', (text) => text.replace(
        'BEGIN;\n', 'BEGIN;\nCREATE TABLE public.shared_world_material_seed (id uuid PRIMARY KEY);\nINSERT INTO public.shared_world_material_seed (id) VALUES (gen_random_uuid());\n')],
    ];
    for (const [reason, weaken] of weakenings) {
      const weakened = weaken(migration);
      assert.notEqual(weakened, migration, `the probe for "${reason}" must actually change migration 0089`);
      const sql = weakened.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
      const body = sql.slice(0, sql.indexOf('DO $$\nDECLARE'));
      const create = weakened.indexOf(`CREATE FUNCTION public.${RESOLVE_FN}(`);
      const start = weakened.indexOf('AS $$', create);
      const end = weakened.indexOf('\nEND$$;', start);
      const resolver = create < 0 || start < 0 || end < 0 ? '' : weakened.slice(start, end);
      const block = (name) => {
        const from = sql.indexOf(`CREATE TABLE public.${name} (`);
        return from < 0 ? '' : sql.slice(from, sql.indexOf('\n);', from));
      };
      const grantLines = sql.split('\n').filter((line) => /\bGRANT\b/u.test(line));
      const caught = [
        () => assert.deepEqual(grantLines.map((line) => line.trim()),
          [`GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role;`]),
        () => assert.match(block(MATERIALS), /UNIQUE \(history_item_id\)/u),
        () => assert.match(block(MATERIALS), /FOREIGN KEY \(history_item_id, world_id\)/u),
        () => assert.match(block(MATERIALS), /OR \(producer_kind = 'QANDEEL' AND author_user_id IS NULL\)/u),
        () => { for (const n of OWN_TABLES) for (const l of block(n).split('\n').filter((x) => /^ {4}\w+\s+\S/u.test(x) && !/^ {4}CONSTRAINT\b/u.test(x))) assert.doesNotMatch(l, /\b(?:json|jsonb|bytea)\b/iu); },
        () => { for (const n of OWN_TABLES) for (const l of block(n).split('\n').filter((x) => /^ {4}\w+\s+\S/u.test(x) && !/^ {4}CONSTRAINT\b/u.test(x))) assert.doesNotMatch(l, /owner|admin|moderator/iu); },
        () => { for (const f of ['availability_state', 'availability_revision', 'approver']) assert.ok(!block(MATERIALS).includes(f)); },
        () => assert.doesNotMatch(block(TEXT_BODIES), /length\(body_text\) <=/u),
        () => assert.match(block(VOICE_BODIES), /audio_object_ref !~ ':\/\/'/u),
        () => assert.match(block(DEPENDENCIES), /dependency_kind = 'REASONING_DEPENDENCY'\s*\n?\s*AND source_material_id IS NULL/u),
        () => assert.match(block(DEPENDENCIES), /CHECK \(source_established_at IS NULL OR source_established_at < target_established_at\)/u),
        () => assert.match(block(DEPENDENCIES), /CHECK \(source_material_id IS NULL OR source_material_id <> target_material_id\)/u),
        () => assert.match(block(DEPENDENCIES), /source_context_ref !~ '\\s'/u),
        () => assert.match(resolver, new RegExp(`public\\.${ENTRY_POINT_FN}\\(p_world_id, p_user_id\\)`, 'u')),
        () => assert.match(resolver, /AND \(t\.material_id IS NOT NULL OR v\.material_id IS NOT NULL\)/u),
        () => assert.ok(!resolver.includes('shared_world_material_dependencies')),
        () => assert.doesNotMatch(body, /INSERT INTO|DELETE FROM/iu),
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
  const mirror = createHarnessMirror('qandeel-i04g-material-');
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

test('a later reviewed producer, provider metadata, index, audit trigger and Launch Gate leave this contract passing, and a real regression still breaks it',
  { skip: process.env[PROBE_CHILD] === '1' ? 'probe child' : false }, (t) => {
    const mirror = buildMirror();
    // `removeHarnessMirror` never throws and is idempotent, so the explicit
    // removal below frees the mirror early and this stays a pure safety net.
    t.after(() => removeHarnessMirror(mirror));
    try {
      write(mirror, 'database/migrations/0091_shared_world_material_later_producers_v1.sql',
        '-- A later reviewed slice: the explicit-disclosure producer, the World-event-derived\n'
        + '-- producer, an Introduction material producer, media provider metadata, a CW2-08\n'
        + '-- Launch Gate wrapper, later additive columns, indexes and an audit trigger.\n'
        + 'BEGIN;\n'
        + 'ALTER TABLE public.shared_world_materials ADD COLUMN material_metadata jsonb;\n'
        + 'ALTER TABLE public.shared_world_voice_note_material_bodies ADD COLUMN media_type text;\n'
        + 'CREATE TABLE public.shared_world_material_provider_metadata (material_id uuid PRIMARY KEY\n'
        + '  REFERENCES public.shared_world_materials (id) ON DELETE RESTRICT, provider text NOT NULL);\n'
        + 'CREATE INDEX shared_world_materials_kind_idx ON public.shared_world_materials (material_kind);\n'
        + 'CREATE TABLE public.launch_gate_snapshots (id uuid PRIMARY KEY, capability text NOT NULL);\n'
        + 'CREATE FUNCTION public.commit_shared_world_explicit_disclosure_v1(p_material_id uuid) RETURNS void\n'
        + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$;\n"
        + 'CREATE FUNCTION public.commit_shared_world_world_event_material_v1(p_material_id uuid) RETURNS void\n'
        + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$;\n"
        + 'CREATE FUNCTION public.commit_shared_world_introduction_material_v1(p_material_id uuid) RETURNS void\n'
        + "LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$;\n"
        + 'CREATE FUNCTION public.shared_world_material_audit_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$\n'
        + 'BEGIN RETURN NULL; END$fn$;\n'
        + 'CREATE TRIGGER shared_world_materials_audit AFTER INSERT ON public.shared_world_materials\n'
        + '  FOR EACH ROW EXECUTE FUNCTION public.shared_world_material_audit_v1();\n'
        + 'CREATE FUNCTION public.read_shared_world_material_gated_v1(p_world_id uuid, p_user_id uuid)\n'
        + "RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$;\n"
        + 'GRANT EXECUTE ON FUNCTION public.read_shared_world_material_gated_v1(uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0091.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/shared-world-material-later-producers-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      assert.ok(runInMirror(mirror).ok,
        'a later reviewed explicit-disclosure producer, World-event-derived producer, Introduction producer, '
        + 'provider metadata, later additive columns, a later index, a later audit trigger, a Launch Gate, a '
        + 'gated wrapper and migration 0091 must all leave this contract passing');
    } finally {
      removeHarnessMirror(mirror);
    }

    // Each regression gets its OWN pristine mirror, so one cannot mask another
    // and none inherits the authorized-future migration written above.
    const regressions = [
      ['0089 itself grants a table privilege to an application role', `database/migrations/${MIGRATION_NAME}`,
        '  FROM PUBLIC, anon, authenticated;',
        '  FROM PUBLIC, anon;\nGRANT SELECT ON TABLE public.shared_world_materials TO authenticated;'],
      ['a frozen predecessor migration is edited', 'database/migrations/0087_shared_world_selective_history_access_v1.sql',
        'BEGIN;', 'BEGIN;\n-- edited\n'],
      ['0089 stores a universal JSON payload', `database/migrations/${MIGRATION_NAME}`,
        '    body_text text NOT NULL,', '    body_text text NOT NULL,\n    payload jsonb,'],
      ['0089 alters a predecessor table', `database/migrations/${MIGRATION_NAME}`,
        'CREATE TABLE public.shared_world_materials (',
        'ALTER TABLE public.shared_world_history_items ADD COLUMN material_body text;\nCREATE TABLE public.shared_world_materials ('],
      ['0089 lets the resolver disclose sealed provenance', `database/migrations/${MIGRATION_NAME}`,
        '      LEFT JOIN public.shared_world_voice_note_material_bodies v ON v.material_id = m.id',
        '      LEFT JOIN public.shared_world_voice_note_material_bodies v ON v.material_id = m.id\n'
        + '      LEFT JOIN public.shared_world_material_dependencies d ON d.target_material_id = m.id'],
      ['0089 drops the acyclicity constraint', `database/migrations/${MIGRATION_NAME}`,
        '    CONSTRAINT shared_world_material_dependencies_source_precedes_check\n        CHECK (source_established_at IS NULL OR source_established_at < target_established_at),\n', ''],
      ['0089 installs a trigger of its own', `database/migrations/${MIGRATION_NAME}`,
        '-- ---------------------------------------------------------------------------\n-- 5. Deny-by-default posture',
        'CREATE FUNCTION public.shared_world_material_guard_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$\n'
        + 'BEGIN RETURN NEW; END$fn$;\n'
        + 'CREATE TRIGGER shared_world_materials_guard BEFORE INSERT ON public.shared_world_materials\n'
        + '  FOR EACH ROW EXECUTE FUNCTION public.shared_world_material_guard_v1();\n'
        + '-- ---------------------------------------------------------------------------\n-- 5. Deny-by-default posture'],
      ['0089 opens the material resolver to authenticated', `database/migrations/${MIGRATION_NAME}`,
        `GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role;`,
        `GRANT EXECUTE ON FUNCTION public.${RESOLVE_FN}(uuid, uuid) TO service_role, authenticated;`],
      ['the CI step that runs the 0089 verifier is removed', '.github/workflows/api-ci.yml',
        `run: npm run ${OWN_SCRIPT}}`, 'run: npm run test:toolchain}'],
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
