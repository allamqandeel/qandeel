// I-06A - Replay Foundation, immutable source manifest and selection-spec
// versions: the secret-free structural contract for migration 0100.
//
// Live semantics - who may capture what, the anti-oracle refusals, the race
// matrix - are proven by database/verify-migration-0100.mjs and
// database/verify-migration-0101.mjs against real PostgreSQL. What is proven
// HERE is the structure a migration must already have before it deploys: that a
// Replay is not a World and carries no distribution, Safety or Launch state;
// that the three source classes are separated BY STRUCTURE rather than by
// convention; that a manifest binds source truth and copies none of it; that
// FULL_SOURCE is provable rather than assertable; that chronology cannot be
// reversed; that every component is append-only for every role including the
// table owner; and that migrations 0001-0099 are byte-identical.
//
// The slice-wide forward-safety and anti-vacuity probe lives in the sibling
// contract for 0101, and runs BOTH I-06A contracts against a mutated tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { FROZEN_PREDECESSORS } from './replay-frozen-predecessors.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0100_replay_foundation_source_manifest_selection_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0100.mjs');
const support = read('../replay-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const IDENTITY = 'replays';
const MANIFESTS = 'replay_source_manifest_versions';
const MANIFEST_ITEMS = 'replay_source_manifest_items';
const SPECS = 'replay_selection_spec_versions';
const SPEC_ITEMS = 'replay_selection_spec_items';
const DRAFT_STATE = 'replay_draft_state';
const OWN_TABLES = [IDENTITY, MANIFESTS, MANIFEST_ITEMS, SPECS, SPEC_ITEMS, DRAFT_STATE];
/** Append-only for EVERY role, including the table owner. */
const COMPONENT_TABLES = [MANIFESTS, MANIFEST_ITEMS, SPECS, SPEC_ITEMS];
const OWN_SCRIPT = 'verify:replay-foundation-source-manifest:integration';

const tableBlock = (table) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(start >= 0, `0100 creates ${table}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};
const functionBody = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0100 creates ${name}`);
  const open = migration.indexOf('AS $$', start);
  const end = migration.indexOf('$$;', open + 5);
  assert.ok(open > start && end > open, `${name} has a terminated dollar-quoted body`);
  return migration.slice(open + 'AS $$'.length, end);
};

// ---------------------------------------------------------------------------

test('0100 is the forward migration after 0099, every frozen predecessor is byte-identical, and no predecessor relation is altered', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0100_')).length, 1, 'exactly one migration carries the 0100 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0099_public_experience_disappearance_runtime_v1.sql'),
    '0100 is the forward migration after the I-05C closure');
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of FROZEN_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu,
    '0100 drops nothing');
  // The ONLY relations this migration alters are the six it just created.
  for (const [, altered] of executableSql.matchAll(/ALTER TABLE (?:ONLY )?public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(altered), `0100 alters only its own relations, not ${altered}`);
  }
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?FUNCTION public\.(?!reject_replay_component_mutation_v1|replay_identity_truth_v1|replay_draft_state_forward_only_v1|replay_selection_chronology_v1|replay_source_manifest_item_one_row_v1)/u,
    '0100 replaces no predecessor function');
});

test('a Replay is a source-bound artifact and never a World, and carries no distribution, Safety or Launch state', () => {
  for (const table of OWN_TABLES) {
    const block = tableBlock(table);
    // A World, its membership, its governance and its geography.
    assert.doesNotMatch(block, /^\s+\w*(?:world_type|phase|birth_basis|member|episode|governance|proposal|semantic|coordinate|embedding|vitality|ranking)\w*\s+(?:uuid|text|integer|bigint|boolean|timestamptz)/mu,
      `${table} carries no World, membership, governance or semantic column`);
    // Distribution, and everything CW2-08 owns.
    assert.doesNotMatch(block, /^\s+\w*(?:public_flag|is_public|is_shared|shareable|share_flag|share_link|sharing|download|distribut|export|premium|safety|moderation|entitle|launch|clearance|feature_flag|approver)\w*\s+(?:uuid|text|integer|bigint|boolean|timestamptz)/mu,
      `${table} carries no distribution, Safety or Launch column: creation authority is not distribution authority`);
    // A manifest is a BINDING, never a copy. No content of any kind, in any type.
    assert.doesNotMatch(block, /^\s+\w*(?:body|transcript|audio_object|content|payload|blob|document|excerpt|snippet|caption)\w*\s+\w/mu,
      `${table} carries no content column`);
    assert.doesNotMatch(block, /\b(?:json|jsonb|bytea)\b/u, `${table} carries no JSON or binary payload`);
  }
  // No relation in the whole slice is a Replay Version, a projection or a render
  // contract: I-06A owns two of the four components and refuses to fake the rest.
  for (const [, created] of executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(created), `0100 creates only its six relations, not ${created}`);
    assert.doesNotMatch(created, /replay_versions|analytical_projection|render_contract|distribution|approval/u,
      `${created} would be an incomplete canonical REPLAY_VERSION or a distribution relation`);
  }
  // The lifecycle vocabulary is complete so I-06B is additive; 0100 writes no row at all.
  assert.match(tableBlock(IDENTITY), /CHECK \(current_lifecycle IN \('DRAFT', 'PREVIEW_READY', 'FINALIZED'\)\)/u);
  assert.doesNotMatch(installedSql, /INSERT INTO/u, 'PART A writes no row');
  assert.doesNotMatch(installedSql, /\bGRANT\b/u, 'PART A grants nothing');
});

test('the three source classes are separated by structure, and a class can never carry another class identifier', () => {
  const manifest = tableBlock(MANIFESTS);
  const items = tableBlock(MANIFEST_ITEMS);
  assert.match(manifest, /CHECK \(source_class IN \('MY_WORLD', 'SHARED_WORLD', 'PUBLIC_EXPERIENCE'\)\)/u,
    'exactly the three frozen source contexts, so Replay-of-Replay and operational state are unrepresentable');
  assert.match(items, /CHECK \(source_class IN \('MY_WORLD', 'SHARED_WORLD', 'PUBLIC_EXPERIENCE'\)\)/u);

  // ONE exact shape per class on BOTH relations: every foreign class column is
  // pinned NULL, so the separation is a property of the row rather than of the writer.
  for (const [table, block] of [[MANIFESTS, manifest], [MANIFEST_ITEMS, items]]) {
    const shape = new RegExp(`CONSTRAINT ${table}_shape_check CHECK \\(([\\s\\S]*?)\\)\\),`, 'u').exec(block)
      ?? new RegExp(`CONSTRAINT ${table}_shape_check CHECK \\(([\\s\\S]*?)\\)\\)`, 'u').exec(block);
    assert.ok(shape, `${table} carries an exact-shape CHECK`);
    for (const branch of ['MY_WORLD', 'SHARED_WORLD', 'PUBLIC_EXPERIENCE']) {
      assert.ok(shape[1].includes(`source_class = '${branch}'`), `${table} pins the shape of ${branch}`);
    }
    assert.ok((shape[1].match(/IS NULL/gu) ?? []).length >= 9,
      `${table} pins every foreign-class column NULL in every branch`);
  }
  // The authority basis is pinned to its class, so a Shared capture can never
  // record Personal ownership as its basis.
  assert.match(manifest, /\(source_class = 'MY_WORLD' AND creation_authority_basis = 'PERSONAL_SOURCE_OWNERSHIP'\)/u);
  assert.match(manifest, /\(source_class = 'SHARED_WORLD' AND creation_authority_basis = 'SHARED_HISTORY_VISIBILITY'\)/u);
  assert.match(manifest, /\(source_class = 'PUBLIC_EXPERIENCE' AND creation_authority_basis = 'PUBLIC_EXPERIENCE_CONTROL'\)/u);
  // Only Shared kinds with a real producer and a real body are bindable.
  assert.match(items, /CHECK \(shared_material_kind IS NULL\s*\n\s*OR shared_material_kind IN \('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS'\)\)/u,
    'the reserved Shared kinds have no producer and are unrepresentable');
  // A voice note IS original audio and a text kind is not: no transcript is ever
  // promoted to audio, and no text is ever recorded as audio.
  assert.match(items, /\(\(shared_material_kind = 'HUMAN_VOICE_NOTE'\) = \(original_medium = 'ORIGINAL_AUDIO'\)\)/u);
  assert.match(items, /CHECK \(original_medium IN \('ORIGINAL_TEXT', 'ORIGINAL_AUDIO', 'MIXED'\)\)/u,
    'the medium vocabulary is forward-safe for a reviewed mixed source');
  // No Personal item can be audio: this repository has no durable Personal audio source.
  const personalBranch = /\(source_class = 'MY_WORLD'([\s\S]*?)\n     OR \(source_class = 'SHARED_WORLD'/u.exec(items);
  assert.ok(personalBranch, 'the item shape has a MY_WORLD branch');
  assert.ok(personalBranch[1].includes("original_medium = 'ORIGINAL_TEXT'"),
    'a Personal item is pinned to ORIGINAL_TEXT, because no durable Personal audio source exists');
});

test('a manifest binds source truth that survives owner deletion, and never a body, a raw turn or the sealed provenance', () => {
  const items = tableBlock(MANIFEST_ITEMS);
  const manifest = tableBlock(MANIFESTS);
  // The exact source rows, and the exact temporal anchors.
  for (const [constraint, parent] of [
    ['replay_source_manifest_items_personal_unit_fk', 'public.conversation_units (id)'],
    ['replay_source_manifest_items_personal_position_fk', 'public.conversation_units (session_id, session_position)'],
    ['replay_source_manifest_items_shared_material_fk', 'public.shared_world_materials (id, world_id)'],
    ['replay_source_manifest_items_shared_history_fk', 'public.shared_world_history_items (world_id, id)'],
    ['replay_source_manifest_items_public_item_fk', 'public.publication_package_manifest_items (manifest_version_id, package_item_id)'],
  ]) {
    assert.ok(items.includes(constraint), `the items bind ${constraint}`);
    assert.ok(items.includes(parent), `${constraint} reaches ${parent}`);
  }
  // An item names the exact context of ITS OWN manifest, structurally.
  for (const constraint of ['replay_source_manifest_items_personal_context_fk',
    'replay_source_manifest_items_shared_context_fk', 'replay_source_manifest_items_public_context_fk']) {
    assert.ok(items.includes(constraint), `the items bind ${constraint}, so an item cannot name a foreign context`);
  }
  // The Public source is ONE exact version row through the additive 0095 key -
  // never three independent keys that could name three unrelated rows.
  assert.match(manifest, /FOREIGN KEY \(public_experience_version_id, public_experience_id, public_manifest_version_id\)\s*\n\s*REFERENCES public\.public_experience_versions \(id, experience_id, package_manifest_version_id\)/u);
  // The Personal manifest binds its Session owner to the exact Replay creator.
  assert.match(manifest, /FOREIGN KEY \(replay_id, personal_owner_user_id\)\s*\n\s*REFERENCES public\.replays \(id, created_by_user_id\)/u);
  assert.match(manifest, /FOREIGN KEY \(personal_session_id, personal_owner_user_id\)\s*\n\s*REFERENCES public\.conversation_sessions \(id, user_id\)/u);

  // NOTHING THIS MIGRATION INSTALLS reaches a body relation, the sealed
  // provenance or a raw turn. Scoped to the installed structure on purpose: the
  // self-assertion block names those same relations in order to FORBID them, and
  // a whole-file ban would therefore be satisfied by the guard against itself.
  for (const forbidden of ['publication_package_item_provenance', 'shared_world_text_material_bodies',
    'shared_world_voice_note_material_bodies', 'public_experience_text_derivative_bodies', 'conversation_turns']) {
    assert.ok(!installedSql.includes(forbidden),
      `0100 must never reference ${forbidden}: source identity is a binding, not a copy, and provenance is not an access route`);
    assert.ok(selfAssertions.includes(forbidden),
      `and the deploy-time guard must still name ${forbidden} among the parents it refuses`);
  }
  // Every foreign key is restrictive: source truth and Replay truth never cascade away.
  for (const [, action] of executableSql.matchAll(/REFERENCES public\.[\w ,()]+ ON DELETE (\w+)/gu)) {
    assert.equal(action, 'RESTRICT', 'every Replay foreign key is restrictive');
  }
  assert.equal((executableSql.match(/REFERENCES public\./gu) ?? []).length,
    (executableSql.match(/ON DELETE RESTRICT/gu) ?? []).length,
    'every REFERENCES in 0100 carries an explicit RESTRICT');
  assert.match(items, /CHECK \(captured_source_digest ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u,
    'the captured digest is a one-way canonical source-identity digest');
  // WHAT THE DIGEST ATTESTS IS STATED ACCURATELY. For a Shared voice note the
  // frozen I-04G convention digests the audio object REFERENCE and transcript,
  // so it is a body-identity digest and not an attestation of the media bytes.
  // The migration must say so rather than call every digest one of source bytes.
  assert.ok(!migration.includes('digest of the exact source bytes'),
    'no comment may claim every captured digest attests the exact source bytes');
  assert.ok(migration.includes('does NOT attest the underlying audio media bytes'),
    'the Shared voice-note digest is documented as body identity, never media attestation');
  assert.ok(migration.includes('sha256 over the opaque'),
    'and the frozen I-04G convention it follows is named rather than redesigned');
});

test('an item must prove its source columns describe ONE canonical row, without preempting a foreign key', () => {
  const guard = functionBody('replay_source_manifest_item_one_row_v1');
  // Independent foreign keys prove each parent EXISTS and cannot prove SAMENESS:
  // unit A could be stored beside unit B's Session Position, material M1 beside
  // material M2's history item, package item P1 beside P2's ordinal.
  // As CONTIGUOUS CHAINS, not as loose substrings: each column also appears in
  // the guard's own precondition, so an individual substring check would still
  // pass after the column was dropped from the comparison that matters.
  for (const [what, chain] of [
    ['a Personal unit, its Session, its Session Position and its role are ONE row',
      /cu\.id = NEW\.personal_conversation_unit_id\s*\n\s*AND cu\.session_id = NEW\.personal_session_id\s*\n\s*AND cu\.session_position = NEW\.personal_session_position\s*\n\s*AND cu\.source_role = NEW\.personal_source_role/u],
    ['a Shared material, its World and its own history item are ONE row',
      /m\.id = NEW\.shared_material_id AND m\.world_id = NEW\.shared_world_id\s*\n\s*AND m\.history_item_id = NEW\.shared_history_item_id/u],
    ['the captured Shared instant is that exact history item\'s frozen instant',
      /h\.id = NEW\.shared_history_item_id AND h\.world_id = NEW\.shared_world_id\s*\n\s*AND h\.occurred_at = NEW\.shared_occurred_at/u],
    ['the public ordinal and classification are read from the exact package item',
      /it\.package_item_id = NEW\.public_package_item_id\s*\n\s*AND it\.item_ordinal = NEW\.public_item_ordinal\s*\n\s*AND it\.derivative_classification = NEW\.public_derivative_classification/u],
  ]) {
    assert.match(guard, chain, `the same-row guard proves ${what}`);
  }
  assert.match(guard, /REPLAY_SOURCE_BINDING_NOT_ONE_ROW' USING ERRCODE='P0001'/u);
  // It acts only once BOTH compared parents exist, so a missing parent is still
  // answered by the exact foreign key that owns it and that proof stays reachable.
  for (const precondition of [
    'IF EXISTS (SELECT 1 FROM public.conversation_units cu',
    'IF EXISTS (SELECT 1 FROM public.shared_world_materials m',
    'IF EXISTS (SELECT 1 FROM public.publication_package_manifest_items it',
  ]) {
    assert.ok(guard.includes(precondition), `the guard waits for both parents before it speaks: ${precondition}`);
  }
  // It reads source IDENTITY and never source content.
  assert.doesNotMatch(guard, /body_text|transcript_text|audio_object_ref|committed_text|public_text_body|provenance/u,
    'the same-row guard reads identity and never content');
  // Installed for every role including the table owner, as a BEFORE trigger.
  assert.match(executableSql, /CREATE TRIGGER replay_source_manifest_items_one_row\s*\n\s*BEFORE INSERT ON public\.replay_source_manifest_items\s*\n\s*FOR EACH ROW EXECUTE FUNCTION public\.replay_source_manifest_item_one_row_v1\(\)/u);
  // And the migration refuses to deploy without it.
  for (const phrase of ['a manifest item must prove its source columns describe ONE canonical row',
    'a Personal item must prove its unit, Session, Session Position and role are ONE row',
    'a Shared item must prove the material and the history item are the SAME canonical event',
    'a Public item must read its ordinal and classification from the exact package item named',
    'the same-row guard must act only when both parents exist, so it never preempts a foreign key',
    'the same-row guard reads source identity and never source content']) {
    assert.ok(selfAssertions.includes(phrase), `the self-assertions refuse a migration missing: ${phrase}`);
  }
});

test('FULL_SOURCE is proven from captured truth and can never be asserted by a caller', () => {
  const manifest = tableBlock(MANIFESTS);
  const spec = tableBlock(SPECS);
  assert.match(manifest, /universe_complete boolean GENERATED ALWAYS AS \(item_count = authorized_universe_item_count\) STORED/u,
    'completeness is GENERATED from the captured counts and can never be written');
  assert.match(manifest, /CHECK \(item_count >= 1 AND authorized_universe_item_count >= item_count\)/u);
  assert.match(spec, /CHECK \(coverage_class IN \('FULL_SOURCE', 'SELECTED_EXCERPT', 'HIGHLIGHT_SELECTION'\)\)/u);
  // All four conditions, together, or the class is unrepresentable.
  const full = /CONSTRAINT replay_selection_spec_versions_full_source_check\s*\n\s*CHECK \(([\s\S]*?)\)\),/u.exec(spec);
  assert.ok(full, 'the selection spec carries a FULL_SOURCE check');
  for (const condition of ['manifest_universe_complete', 'selected_item_count = manifest_item_count',
    'whole_item_count = selected_item_count', 'source_contiguous']) {
    assert.ok(full[1].includes(condition), `FULL_SOURCE requires ${condition}`);
  }
  // Completeness is READ FROM the manifest row by composite foreign key rather
  // than copied, so the two can never disagree however the row is produced.
  assert.match(spec, /FOREIGN KEY \(source_manifest_version_id, manifest_universe_complete\)\s*\n\s*REFERENCES public\.replay_source_manifest_versions \(id, universe_complete\)/u);
  // NOTHING declares a cut safe: Semantic Cut Safety belongs to I-06B.
  assert.doesNotMatch(executableSql, /\b\w*(?:semantic_safe|cut_safe|safe_cut|render_safe|is_safe)\w*\b/u,
    'no column claims a cut is render-safe');
  // The selection method vocabulary is forward-safe and 0100 writes neither value.
  assert.match(spec, /CHECK \(selection_method IN \('EXPLICIT_RESOLVED_ANCHORS', 'NATURAL_LANGUAGE_RESOLVED'\)\)/u);
  // An anchor is the whole item or a half-open code-point range inside a text item.
  assert.match(tableBlock(SPEC_ITEMS), /CHECK \(anchor_kind IN \('WHOLE_ITEM', 'TEXT_CODE_POINT_RANGE'\)\)/u);
  assert.match(tableBlock(SPEC_ITEMS), /range_start >= 0 AND range_end > range_start/u);
});

test('the components are append-only for every role, the identity is frozen, the pointer moves forward, and chronology cannot reverse', () => {
  for (const table of COMPONENT_TABLES) {
    assert.match(executableSql,
      new RegExp(`CREATE TRIGGER ${table}_immutable\\s*\\n\\s*BEFORE UPDATE OR DELETE ON public\\.${table}\\s*\\n\\s*FOR EACH ROW EXECUTE FUNCTION public\\.reject_replay_component_mutation_v1\\(\\)`, 'u'),
      `${table} refuses UPDATE and DELETE by trigger, because privileges do not bind the table owner`);
  }
  assert.match(functionBody('reject_replay_component_mutation_v1'), /REPLAY_COMPONENT_IS_IMMUTABLE'\s*\n\s*USING ERRCODE='55000'/u);

  // The identity cannot be re-bound. The LIFECYCLE is deliberately NOT frozen:
  // I-06B owns its later transitions, so this is a contract and not a ceiling.
  const identity = functionBody('replay_identity_truth_v1');
  assert.match(identity, /NEW\.id <> OLD\.id OR NEW\.created_by_user_id <> OLD\.created_by_user_id/u);
  assert.match(identity, /NEW\.created_at <> OLD\.created_at/u);
  assert.doesNotMatch(identity, /current_lifecycle/u,
    'the identity trigger must not freeze the lifecycle, or I-06B could not transition it');
  assert.match(executableSql, /CREATE TRIGGER replays_identity_truth\s*\n\s*BEFORE UPDATE ON public\.replays/u);

  const forward = functionBody('replay_draft_state_forward_only_v1');
  assert.match(forward, /NEW\.draft_revision <> OLD\.draft_revision \+ 1/u, 'the pointer advances exactly one revision');
  assert.match(forward, /NEW\.replay_id <> OLD\.replay_id/u, 'and never changes which Replay it belongs to');

  // A REVERSAL IS UNREPRESENTABLE, not merely refused: the trigger compares the
  // sign of the selected order against the sign of the canonical source order.
  const chronology = functionBody('replay_selection_chronology_v1');
  assert.match(chronology, /sign\(i\.selected_ordinal - NEW\.selected_ordinal\)\s*\n\s*<> sign\(i\.source_item_ordinal - NEW\.source_item_ordinal\)/u);
  assert.match(chronology, /REPLAY_SELECTION_CHRONOLOGY_REVERSED/u);
  assert.match(executableSql, /CREATE TRIGGER replay_selection_spec_items_chronology\s*\n\s*BEFORE INSERT ON public\.replay_selection_spec_items/u);
  // The draft pointer binds the selection TO its own manifest as one exact pair.
  assert.match(tableBlock(DRAFT_STATE), /FOREIGN KEY \(current_selection_spec_version_id, current_source_manifest_version_id\)\s*\n\s*REFERENCES public\.replay_selection_spec_versions \(id, source_manifest_version_id\)/u);
});

test('every relation is sealed by default, and PART A creates no writer at all', () => {
  for (const table of OWN_TABLES) {
    assert.ok(executableSql.includes(`ALTER TABLE public.${table} OWNER TO postgres;`), `${table} is postgres-owned`);
    assert.ok(executableSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`), `${table} has RLS enabled`);
    assert.ok(executableSql.includes(`public.${table}`), `${table} appears in the REVOKE list`);
  }
  assert.doesNotMatch(executableSql, /CREATE POLICY/u, 'zero policies');
  assert.match(executableSql, /REVOKE ALL ON TABLE[\s\S]*?FROM PUBLIC, anon, authenticated;/u);
  assert.ok(executableSql.includes("REVOKE ALL ON TABLE public.replays, public.replay_source_manifest_versions, public.replay_source_manifest_items, public.replay_selection_spec_versions, public.replay_selection_spec_items, public.replay_draft_state FROM service_role"),
    'the service tier holds no direct table privilege either');

  // Every function 0100 owns returns `trigger` and is callable as nothing else.
  const created = [...executableSql.matchAll(/CREATE FUNCTION public\.(\w+)\(\)\s*\nRETURNS (\w+)/gu)];
  assert.equal(created.length, 5, '0100 creates exactly five functions');
  for (const [, name, returns] of created) {
    assert.equal(returns, 'trigger', `${name} is a trigger function and nothing else: PART A creates no writer`);
    assert.ok(executableSql.includes(`ALTER FUNCTION public.${name}() OWNER TO postgres;`), `${name} is postgres-owned`);
    assert.ok(executableSql.includes(`REVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC;`), `${name} is revoked from PUBLIC`);
  }
  for (const [, name] of executableSql.matchAll(/CREATE FUNCTION public\.(\w+)/gu)) {
    assert.doesNotMatch(name, /^(?:create|revise|publish|distribute|export|finalize|preview)_/u,
      `${name} would be a writer, and PART A creates none`);
  }
  // Every function body is search_path-pinned.
  assert.equal((executableSql.match(/LANGUAGE plpgsql(?: SECURITY DEFINER)? SET search_path=''/gu) ?? []).length, 5);
});

test('the self-assertions refuse to deploy a migration that lost any of this', () => {
  assert.ok(SELF_ASSERT_START > 0, '0100 carries a deploy-time self-assertion block');
  for (const phrase of [
    'a Replay is a source-bound artifact, never a World',
    'creation authority is not distribution authority',
    'a Replay source manifest identifies source truth and copies none of it',
    'must bind no body relation, no sealed provenance and no raw turn',
    'every Replay foreign key is restrictive',
    'a Public source manifest must bind version, Experience and manifest as ONE exact row',
    'a Personal source manifest must bind its Session owner to the exact Replay creator',
    'FULL_SOURCE must be representable only over a complete manifest selected whole',
    'manifest completeness must be GENERATED from the captured counts, never written',
    'must be append-only for every role',
    'the identity truth, forward-only pointer and chronology triggers must be installed',
    'must be a trigger function and nothing else',
    'must have row level security enabled',
    'must carry zero policies',
    'must be postgres-owned',
    'must hold no privilege for',
    'PART A is persistence and writes no row',
    'the frozen committed Personal source must still be append-only',
    'the frozen 0065 Session Position key must still exist',
    'the frozen I-04F availability truth must still be guarded',
    'the frozen 0095 exact version identity key must still exist',
    'an identifier on % exceeds the PostgreSQL 63-byte limit',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the self-assertions refuse a migration missing: ${phrase}`);
  }
  // A CONTRACT, NOT A CEILING. No assertion may ban the additions I-06B, I-06C
  // and I-06D must make, or a later slice could only proceed by deleting it.
  for (const future of ['analytical_projection', 'render_contract', 'replay_version', 'PREVIEW_READY',
    'distribution_package', 'source_loss', 'launch_gate']) {
    assert.doesNotMatch(selfAssertions, new RegExp(`RAISE EXCEPTION[^;]*${future}`, 'iu'),
      `no self-assertion may forbid a later reviewed ${future}`);
  }
  // The census is scoped to the relations this migration owns, never to the database.
  assert.ok(selfAssertions.includes("own_tables text[] := ARRAY['replays'"), 'the assertions walk 0100 relations only');
  assert.doesNotMatch(selfAssertions, /FROM pg_proc p\s*\n?[^;]*WHERE[^;]*count\(\*\)\s*[<>=]/u,
    'no assertion pins a global catalog count');
});

test('0100 is registered in the toolchain, in the I-06A CI group, and in the database README', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0100\\.mjs"`, 'u'));
  assert.match(readme, /0100_replay_foundation_source_manifest_selection_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README records the verifier command');
  assert.ok(readme.includes('PERSONAL_SOURCE_OWNERSHIP') && readme.includes('SHARED_HISTORY_VISIBILITY')
    && readme.includes('PUBLIC_EXPERIENCE_CONTROL'),
  'the README records the three creation-authority bases');
  assert.ok(readme.includes('NOT PRODUCIBLE - no durable canonical source exists'),
    'the README states the Personal audio absence truthfully');
  assert.match(verifier, /verifier for migration 0100/iu);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0100=PASS; else status=1; fi`));
  // Scoped to the I-06A step's OWN body: other grouped steps end the same way,
  // and a whole-file check would be satisfied by one of those instead.
  const step = workflow.slice(workflow.indexOf('- name: Verify the two I-06A Replay foundation and draft runtime verifiers'));
  assert.ok(step.slice(0, step.indexOf('\n      - ')).includes('exit "$status"'),
    'the grouped I-06A step fails the job when either verifier failed');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
});

test('the verifier proves the structure from live rows and refuses the weakenings', () => {
  for (const needle of ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08',
    'SAVEPOINT forward_safety', 'anti-vacuity',
    // The concrete refusals, not only the section codes: a section code survives
    // deleting the proof under it, and these do not.
    'REPLAY_SELECTION_CHRONOLOGY_REVERSED',
    'REPLAY_COMPONENT_IS_IMMUTABLE',
    'REPLAY_IDENTITY_IS_IMMUTABLE',
    'REPLAY_DRAFT_REVISION_MUST_ADVANCE',
    'replay_selection_spec_versions_full_source_check',
    'replay_selection_spec_versions_complete_fk',
    // The same-row proofs, against EXISTING valid rows deliberately cross-paired.
    'S09 EXACT SAME-ROW SOURCE IDENTITY',
    'REPLAY_SOURCE_BINDING_NOT_ONE_ROW']) {
    assert.ok(verifier.includes(needle), `the 0100 verifier proves ${needle}`);
  }
  // The cross-pairings themselves, so deleting one is not silent.
  for (const pairing of ['unit: f.userUnit, position: 2', 'unit: f.assistantUnit, position: 1',
    'historyItem: other.historyItem', 'material: other.material', 'occurredAt: other.occurredAt',
    'publicOrdinal: publicOrdinal + 100']) {
    assert.ok(verifier.includes(pairing), `the 0100 verifier cross-pairs ${pairing}`);
  }
  assert.ok(support.includes('MANIFESTS') && support.includes('SPEC_ITEMS') && support.includes('REPLAY_IMMUTABLE'),
    'the shared harness knows the Replay relations and the guards it must lift for teardown');
  assert.match(verifier, /\}, \(\) => rt\.client\.end\(\)\.catch\(\(\) => undefined\)\);\s*$/u,
    'the verifier ends its database client through the envelope on every path, so a failure exits instead of hanging the CI step');
});
