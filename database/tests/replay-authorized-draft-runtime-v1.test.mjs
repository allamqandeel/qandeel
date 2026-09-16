// I-06A - Replay Authorized Source Capture and Draft Runtime: the secret-free
// structural contract for migration 0101.
//
// Live semantics - who may capture what, the bounded refusals, idempotency and
// the race matrix - are proven by database/verify-migration-0101.mjs against
// real PostgreSQL. What is proven HERE is the structure a migration must
// already have before it deploys: that the creating human is auth.uid() and
// never a parameter; that the Shared adapter CONSUMES the canonical I-04F
// visibility entry point rather than re-implementing it; that the Public adapter
// requires Experience CONTROL rather than public visibility and never traverses
// the sealed provenance; that no primitive writes a lifecycle beyond DRAFT,
// claims a Safety or Launch clearance, or reaches an application role; and that
// coverage, order and contiguity are DERIVED rather than accepted.
//
// ## Why the slice-wide probe lives in this file and not in both
//
// A mirror-based probe is expensive. The probe at the end mirrors once and runs
// BOTH I-06A contracts against a mutated tree, so the property each must have -
// this is a contract, not a ceiling on the roadmap - is proven for both from one
// place: the I-06B projection, render contract and first complete REPLAY_VERSION,
// an I-06C distribution package, an I-06D source-loss record, a reviewed CW2-08
// wrapper, additive columns and a new CI step must all leave I-06A passing, and
// every real weakening of an I-06A authority, privacy or truth invariant must
// break at least one of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';
import { FROZEN_PREDECESSORS } from './replay-frozen-predecessors.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
/** Set in the child runs of the probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I06A_REPLAY_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0101_replay_authorized_draft_runtime_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const partA = read('../migrations/0100_replay_foundation_source_manifest_selection_v1.sql');
const verifier = read('../verify-migration-0101.mjs');
const support = read('../replay-verifier-support.mjs');
const readme = read('../README.md');
const doc = read('../../docs/replay-runtime-v1.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const CAPTURE = 'replay_capture_source_manifest_v1';
const LOCK = 'replay_lock_source_manifest_v1';
const CURRENCY = 'derive_replay_source_manifest_currency_v1';
const SELECT_CORE = 'replay_resolve_selection_spec_v1';
const CREATE = 'create_replay_draft_v1';
const REVISE = 'revise_replay_draft_v1';
const COMPOSITION = 'resolve_replay_draft_composition_v1';
const TOKEN = 'replay_selection_request_token_v1';
const HUMAN = [CREATE, REVISE];
const CORES = [CAPTURE, LOCK, SELECT_CORE];
const OWN_TABLES = ['replay_create_commands', 'replay_draft_revision_commands'];
const OWN_SCRIPT = 'verify:replay-authorized-draft-runtime:integration';
const PART_A_SCRIPT = 'verify:replay-foundation-source-manifest:integration';

const signatureEnd = (name) => {
  const start = migration.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `migration 0101 creates ${name}`);
  let depth = 1; let i = start + `CREATE FUNCTION public.${name}(`.length;
  while (i < migration.length && depth > 0) {
    if (migration[i] === '(') depth += 1; else if (migration[i] === ')') depth -= 1;
    i += 1;
  }
  return { start, open: start + `CREATE FUNCTION public.${name}(`.length, close: i };
};
const functionBody = (name) => {
  const { close } = signatureEnd(name);
  const open = migration.indexOf('AS $$', close);
  const end = migration.indexOf('$$;', open + 5);
  assert.ok(open > close && end > open, `${name} has a terminated dollar-quoted body`);
  return { header: migration.slice(close, open), body: migration.slice(open + 'AS $$'.length, end) };
};
const inputParameters = (name) => {
  const { open, close } = signatureEnd(name);
  return [...migration.slice(open, close - 1).matchAll(/(p_\w+)\s+(?:uuid\[\]|text\[\]|integer\[\]|uuid|text|integer|bigint|boolean|timestamptz)/gu)]
    .map((m) => m[1]);
};
const resultColumns = (name) => {
  const { header } = functionBody(name);
  const table = /RETURNS TABLE\(([\s\S]*?)\)\s*\nLANGUAGE/u.exec(header);
  assert.ok(table, `${name} declares a RETURNS TABLE result`);
  return [...table[1].matchAll(/(\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean|timestamptz)/gu)].map((m) => m[1]);
};
const code = (body) => body.split('\n').map((line) => line.replace(/--.*$/u, '')).join('\n');
const tableBlock = (table) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(start >= 0, `0101 creates ${table}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};

/** Every parameter name a consequential Replay mutation may never accept. */
const PARAMETER_BAN = /actor|creator|owner|user_id|approver|authority|audience|viewer|visib|publish|distribut|lifecycle|clear|launch|safety|entitle|ordinal|order|contiguous|method|digest|fingerprint|medium|availability|complete|natural|language/u;
/** Result columns no Replay read boundary may ever declare: source identity is never a DTO. */
const DISCLOSURE_BAN = /user_id|email|session|turn|conversation_unit|shared_|material|history_item|availability|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|staleness/u;

// ---------------------------------------------------------------------------

test('0101 is the forward migration after 0100, every frozen predecessor is byte-identical, and nothing predecessor is rewritten', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0101_')).length, 1, 'exactly one migration carries the 0101 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0100_replay_foundation_source_manifest_selection_v1.sql'));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of FROZEN_PREDECESSORS) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu);
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE FUNCTION/u,
    '0101 replaces no predecessor function: every function it owns is new');
  // PART B adds the runtime beside PART A and rewrites none of its structure.
  for (const [, altered] of executableSql.matchAll(/ALTER TABLE (?:ONLY )?public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(altered), `0101 alters only its own command relations, not ${altered}`);
  }
  assert.ok(partA.includes('CREATE TABLE public.replays ('), 'PART A still owns the identity');
});

test('the creating human is auth.uid(), and no mutation accepts an actor, an authority or a derived truth', () => {
  for (const fn of [...HUMAN, ...CORES]) {
    const { body } = functionBody(fn);
    assert.ok(body.includes('u uuid := auth.uid();'), `${fn} derives the human from auth.uid()`);
    assert.match(body, /IF u IS NULL THEN\s*\n\s*RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';/u,
      `${fn} fails closed when there is no authenticated human`);
    for (const parameter of inputParameters(fn)) {
      assert.doesNotMatch(parameter, PARAMETER_BAN,
        `${fn} may not accept ${parameter}: a caller can never author identity, authority or a derived truth`);
    }
  }
  // The human primitives take no clock either, and read the database clock ONCE.
  for (const fn of HUMAN) {
    const { body } = functionBody(fn);
    for (const parameter of inputParameters(fn)) {
      assert.doesNotMatch(parameter, /instant|timestamp|_at$/u, `${fn} accepts no clock (${parameter})`);
    }
    assert.equal((body.match(/clock_timestamp\(\)/gu) ?? []).length, 1,
      `${fn} reads the database clock exactly once, so one instant serves every authoritative fact`);
  }
  // The internal cores read no clock at all: the ONE instant is the caller's.
  for (const fn of CORES) {
    assert.ok(!functionBody(fn).body.includes('clock_timestamp'), `${fn} reads no clock of its own`);
  }
  // The command relations bind the actor to the creator STRUCTURALLY.
  for (const table of OWN_TABLES) {
    assert.match(tableBlock(table), /FOREIGN KEY \(replay_id, actor_user_id\)\s*\n\s*REFERENCES public\.replays \(id, created_by_user_id\)/u,
      `${table} binds its actor to the exact Replay creator through the 0100 identity key`);
    assert.match(tableBlock(table), /CHECK \(request_ref ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u);
  }
});

test('the Shared adapter consumes the canonical visibility boundary and never re-implements Shared authorization', () => {
  const capture = code(functionBody(CAPTURE).body);
  assert.ok(capture.includes('public.resolve_shared_world_history_visibility_v1(p_source_context_id, u)'),
    'the Shared adapter asks the ONE canonical I-04F entry point, for the creating human');
  // Never a second derivation of Shared access from the topology itself.
  for (const forbidden of ['shared_world_membership_episodes', 'shared_world_history_access_grants',
    'shared_world_standard_closed_view_entitlements', 'shared_world_standing_context_grants']) {
    assert.ok(!capture.includes(forbidden),
      `the Shared adapter must never read ${forbidden}: current membership is not exact historical visibility`);
    assert.ok(!code(functionBody(CURRENCY).body).includes(forbidden),
      `the currency derivation must never read ${forbidden} either`);
  }
  // Every captured item must be inside the exact visible set.
  assert.ok(capture.includes('NOT (m.history_item_id = ANY(visible))'),
    'an item outside the exact visible set is refused');
  // A raise from the consumed resolver becomes the bounded class, never an error a caller can read.
  assert.match(capture, /EXCEPTION WHEN SQLSTATE 'P0002' OR SQLSTATE '0A000' THEN\s*\n\s*RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE'/u);
  // A voice note is original-audio IDENTITY, digested one way, never stored.
  assert.ok(capture.includes("CASE WHEN m.material_kind = 'HUMAN_VOICE_NOTE' THEN 'ORIGINAL_AUDIO' ELSE 'ORIGINAL_TEXT' END"));
  // The opaque audio handle is digested ONE WAY and never stored: every single
  // occurrence of it must sit inside a sha256(convert_to( ... )) expression in
  // the same statement, so none of them can be a value reaching a column.
  const audioAt = [...capture.matchAll(/audio_object_ref/gu)].map((m) => m.index);
  assert.ok(audioAt.length > 0, 'the Shared adapter does read the voice-note handle, to digest it');
  for (const at of audioAt) {
    const digestAt = capture.lastIndexOf('sha256(convert_to(', at);
    assert.ok(digestAt >= 0, 'every audio handle read is inside a digest expression');
    assert.ok(!capture.slice(digestAt, at).includes(';'),
      'the audio handle is digested in the same statement and never stored as a value');
  }
  assert.ok(capture.includes("material_kind NOT IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')")
    && capture.includes('REPLAY_SOURCE_KIND_RESERVED'),
  'a reserved Shared kind is refused as reserved, after authority is proven');
});

test('the Public adapter requires Experience CONTROL, never public visibility, and never traverses the sealed provenance', () => {
  const capture = code(functionBody(CAPTURE).body);
  assert.ok(capture.includes('public.public_experience_controllers c')
    && capture.includes('c.controller_user_id = u'),
  'Public source authority is EXPERIENCE_CONTROL_AUTHORITY for the creating human');
  assert.ok(capture.includes('experience.current_experience_version_id IS DISTINCT FROM p_source_version_id'),
    'only the exact controlled current version binds; anything else fails closed');
  // Public visibility is NOT creation eligibility.
  for (const fn of [...HUMAN, ...CORES, CURRENCY, COMPOSITION]) {
    const { body } = functionBody(fn);
    for (const forbidden of ['resolve_public_visibility_state_v1', 'resolve_public_audience_admission_v1']) {
      assert.ok(!body.includes(forbidden),
        `${fn} must never derive Replay eligibility from ${forbidden}: visibility is not control`);
    }
    assert.ok(!body.includes('publication_package_item_provenance'),
      `${fn} must never read the sealed Public provenance: it is internal audit truth, not a bridge into private source`);
  }
  // The Public capture consumes the bounded derivative of the exact package.
  assert.ok(capture.includes('public.publication_package_manifest_items it'),
    'the Public adapter binds the bounded public package item itself');
  // The whole installed migration never names the sealed relation.
  assert.ok(!installedSql.includes('publication_package_item_provenance'));
  assert.ok(selfAssertions.includes('publication_package_item_provenance'),
    'and the deploy-time guard still names it among the reads it refuses');
});

test('nothing writes a lifecycle beyond DRAFT, a distribution act, or a Safety or Launch clearance', () => {
  for (const fn of [...HUMAN, ...CORES, CURRENCY, COMPOSITION, TOKEN]) {
    const { body } = functionBody(fn);
    assert.ok(!body.includes("'PREVIEW_READY'") && !body.includes("'FINALIZED'"),
      `${fn} writes no lifecycle beyond DRAFT: preview and finalization belong to I-06B`);
    assert.doesNotMatch(body, /PUBLISH_TO_PUBLIC_WORLD|SHARE_EXTERNALLY|DOWNLOAD_REPLAY|DISTRIBUTE_REPLAY|EXPORT_PRIVACY_SANITIZATION/u,
      `${fn} carries no distribution act: creation authority is not distribution authority`);
    assert.doesNotMatch(body, /SAFETY_ALLOW|LAUNCH_CLEARED|ENTITLED|FEATURE_ENABLED|PUBLIC_LAUNCH_READY/u,
      `${fn} claims no Safety, Launch or entitlement clearance: no executable CW2-08 runtime exists`);
    assert.ok(!body.includes("'NATURAL_LANGUAGE_RESOLVED'"),
      `${fn} writes no natural-language selection result: no reviewed bounded resolver exists`);
    assert.ok(!body.includes("'MIXED'"), `${fn} writes no MIXED medium: no reviewed producer exists`);
    // A Replay READS source truth and never writes it.
    assert.doesNotMatch(body, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:conversation_|session_semantic|shared_world|public_experience|public_identit|public_world|publication_|users)/u,
      `${fn} mutates no Personal, Shared or Public relation`);
  }
  assert.ok(functionBody(CREATE).body.includes("VALUES (p_replay_id, u, 'DRAFT', instant);"),
    'creation writes exactly DRAFT and binds the exact creating human');
  // No relation in this migration is a Replay Version, a projection or a package.
  for (const [, created] of executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(created), `0101 creates only its two command relations, not ${created}`);
  }
  for (const table of OWN_TABLES) {
    assert.doesNotMatch(tableBlock(table), /^\s+\w*(?:reason|detail|note|content|body|world|distribut|clearance|safety|launch)\w*\s+\w/mu,
      `${table} carries no content, reason, World, distribution or clearance column`);
  }
});

test('coverage, selected order and contiguity are derived from captured truth, never accepted from the caller', () => {
  const core = code(functionBody(SELECT_CORE).body);
  // Every selected identity is an item of the EXACT manifest.
  assert.ok(core.includes('IF matched <> selected THEN')
    && core.includes("RAISE EXCEPTION 'REPLAY_SELECTION_INVALID'"),
  'an identity outside the authorized universe the manifest captured is not a selection');
  // The order is derived from the manifest's canonical order, whatever order arrives.
  assert.ok(core.includes('(row_number() OVER (ORDER BY mi.source_item_ordinal))::integer'),
    'the selected order is derived from the manifest canonical order');
  assert.ok(core.includes('ORDER BY mi.source_item_ordinal;'), 'and the rows are inserted in that order');
  // Contiguity is machine truth from the captured universe ranks.
  assert.ok(core.includes('max(mi.source_universe_rank) - min(mi.source_universe_rank) + 1 = selected'),
    'contiguity is derived from the captured source universe');
  // FULL_SOURCE is proven or refused; never downgraded silently, never taken on the caller's word.
  assert.ok(core.includes("IF p_requested_coverage_class = 'FULL_SOURCE'")
    && core.includes('NOT (manifest.universe_complete AND selected = manifest.item_count AND whole = selected AND contiguous)')
    && core.includes("RAISE EXCEPTION 'REPLAY_COVERAGE_NOT_PROVABLE'"),
  'FULL_SOURCE requires the complete universe selected whole without a gap');
  // The ONE writer records resolved anchors and nothing that claims safety.
  assert.ok(core.includes("'EXPLICIT_RESOLVED_ANCHORS'"), 'every selection written here is explicit resolved anchors');
  assert.doesNotMatch(core, /semantic_safe|cut_safe|render_safe|is_safe/u,
    'no selection is marked render-safe: Semantic Cut Safety belongs to I-06B');
});

test('one bounded class answers every unauthorized source, and the read boundary discloses no source identity', () => {
  const capture = functionBody(CAPTURE).body;
  assert.ok((capture.match(/REPLAY_SOURCE_NOT_AVAILABLE/gu) ?? []).length >= 9,
    'a nonexistent source, another human\'s source, invisible Shared history and an uncontrolled Experience share ONE bounded class');
  // The composition resolver answers the exact creator and nobody else.
  const composition = functionBody(COMPOSITION).body;
  assert.ok(composition.includes('r.created_by_user_id = p_user_id'),
    'the composition resolver answers the exact creator and returns zero rows to everybody else');
  for (const column of resultColumns(COMPOSITION)) {
    assert.doesNotMatch(column, DISCLOSURE_BAN,
      `the composition resolver must not return ${column}: some creator source access is not a reason to expose a private source path`);
  }
  assert.ok(resultColumns(COMPOSITION).includes('currency_state'), 'it returns the two-state currency');
  assert.ok(!resultColumns(COMPOSITION).includes('staleness_class'),
    'and never the internal bounded staleness cause');
  // Availability is answered before access, so a deleted source never reads as an access loss.
  const currency = code(functionBody(CURRENCY).body);
  assert.ok(currency.indexOf("'SOURCE_UNAVAILABLE'") < currency.indexOf("'SOURCE_ACCESS_LOST'"),
    'availability is reported before access');
  // DEFENCE IN DEPTH. A source assembled from parts of two real events - a
  // material beside another material's history item, a public ordinal belonging
  // to a different package item - can never read CURRENT, however valid each row
  // it names is on its own. The 0100 guard makes it unrepresentable at INSERT
  // and this derivation refuses to bless one anyway.
  for (const contradiction of ['m.history_item_id IS DISTINCT FROM i.shared_history_item_id',
    'h.occurred_at IS DISTINCT FROM i.shared_occurred_at',
    'm.material_kind IS DISTINCT FROM i.shared_material_kind',
    'it.item_ordinal IS DISTINCT FROM i.public_item_ordinal',
    'it.derivative_classification IS DISTINCT FROM i.public_derivative_classification',
    "'SOURCE_CONTRADICTORY'"]) {
    assert.ok(currency.includes(contradiction), `source currency refuses a binding that is not one row: ${contradiction}`);
  }
  // As a CONTIGUOUS predicate over the manifest's own items: a shape check,
  // because a substring survives being disabled in place with `false AND`.
  assert.match(currency, /WHERE i\.manifest_version_id = manifest\.id\s*\n\s*AND \(m\.id IS NULL OR h\.id IS NULL\s*\n\s*OR m\.history_item_id IS DISTINCT FROM i\.shared_history_item_id/u,
    'the Shared contradiction check really runs over this manifest\'s items');
  assert.match(currency, /WHERE i\.manifest_version_id = manifest\.id\s*\n\s*AND \(it\.package_item_id IS NULL\s*\n\s*OR it\.item_ordinal IS DISTINCT FROM i\.public_item_ordinal/u,
    'and so does the Public one');
  // And it refuses the contradiction BEFORE it answers availability, so a
  // malformed binding is never reported as a mere deletion.
  const contradictionAt = currency.indexOf('m.history_item_id IS DISTINCT FROM i.shared_history_item_id');
  const availabilityAt = currency.indexOf("h.availability_state <> 'AVAILABLE'");
  assert.ok(contradictionAt >= 0 && availabilityAt >= 0 && contradictionAt < availabilityAt,
    'a contradictory source binding is answered before availability');
  // The internal cause still never leaves the read boundary.
  assert.ok(!resultColumns(COMPOSITION).includes('staleness_class'));
  assert.ok(currency.includes('SELECT r.created_by_user_id INTO creator'),
    'source currency is a property of the Replay and its creator, never of whoever asks');
  assert.ok(!currency.includes('auth.uid()'), 'and the derivation therefore reads no caller identity');
});

test('the lock order is Replay first then each source domain in its own frozen order, in SHARE mode', () => {
  const capture = code(functionBody(CAPTURE).body);
  // Shared: World, then materials by id, then history items by id.
  const world = capture.indexOf('FROM public.shared_worlds w WHERE w.id = p_source_context_id FOR SHARE');
  const materials = capture.indexOf('ORDER BY m.id FOR SHARE');
  const history = capture.indexOf('ORDER BY i.id FOR SHARE');
  assert.ok(world > 0 && materials > world && history > materials,
    'the Shared source is stabilized World first, then materials, then history items');
  // Public: singleton, then Experience, then the package.
  const singleton = capture.indexOf('FROM public.public_world_state w WHERE w.singleton FOR SHARE');
  const experience = capture.indexOf('FROM public.public_experiences e WHERE e.id = p_source_context_id FOR SHARE');
  assert.ok(singleton > 0 && experience > singleton, 'the Public source is stabilized singleton first, then Experience');
  // A Replay READS source truth: every source lock is a SHARE lock.
  for (const fn of [CAPTURE, LOCK]) {
    const { body } = functionBody(fn);
    for (const [, locked] of code(body).matchAll(/public\.(\w+)[^;]*?FOR UPDATE/gu)) {
      assert.equal(locked, 'replays', `${fn} takes an exclusive lock on the Replay only, never on source (${locked})`);
    }
  }
  // Creation and revision take the Replay first and write last.
  const create = code(functionBody(CREATE).body);
  assert.ok(create.indexOf('FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE')
    < create.indexOf(`public.${CAPTURE}(`), 'creation stabilizes the Replay identity before it reaches the source');
  const revise = code(functionBody(REVISE).body);
  const replayLock = revise.indexOf('FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE');
  const sourceLock = revise.indexOf(`public.${LOCK}(manifest_id)`);
  const write = revise.indexOf('UPDATE public.replay_draft_state s');
  assert.ok(replayLock > 0 && sourceLock > replayLock && write > sourceLock,
    'a revision locks the Replay first, stabilizes the source second and writes last');
  // A revision revalidates currency before it commits prepared state.
  assert.ok(revise.includes("IF currency IS DISTINCT FROM 'CURRENT' THEN") && revise.includes('REPLAY_SOURCE_STALE'),
    'a revision refuses stale prepared state instead of committing old access');
  // No advisory lock and no table lock substitutes for database correctness.
  // Scoped to the installed runtime: the self-assertion block names both in
  // order to FORBID them, so a whole-file ban would pass on the guard alone.
  assert.doesNotMatch(installedSql, /pg_advisory|LOCK TABLE/u);
  assert.match(selfAssertions, /pg_advisory/u, 'and the deploy-time guard still refuses an advisory key');
});

test('both commands are durably idempotent through narrow typed relations, and bind the whole request', () => {
  for (const fn of HUMAN) {
    const { body } = functionBody(fn);
    assert.ok((body.match(/WHERE c\.id = p_command_id/gu) ?? []).length >= 2,
      `${fn} checks durable idempotency before any lock and again under it`);
    assert.ok(body.includes('REPLAY_COMMAND_ID_CONFLICT'),
      `${fn} refuses a reused command identity carrying a different request`);
    assert.ok(body.includes(`public.${TOKEN}(p_selected_source_item_ids, p_range_starts, p_range_ends)`),
      `${fn} binds the exact resolved selection into its request identity`);
    assert.ok(body.includes("'ALREADY_COMMITTED'::text"),
      `${fn} serves an equivalent retry from the durable command rather than from current state`);
    assert.ok(body.includes('EXCEPTION WHEN unique_violation THEN'),
      `${fn} converges two racing equivalent commands on the unique key`);
  }
  // The token is order-insensitive over the selection and distinguishes a whole
  // item from a range over it, so two different requests never fingerprint alike.
  const token = functionBody(TOKEN).body;
  assert.ok(token.includes('ORDER BY lower(s.sid::text) COLLATE "C"'), 'the token is order-insensitive');
  assert.ok(token.includes("CASE WHEN s.rs IS NULL THEN 'WHOLE'"), 'a whole item and a range never fingerprint alike');
  assert.match(functionBody(TOKEN).header, /LANGUAGE sql IMMUTABLE SET search_path=''/u);
  // A generic untyped event table would let one family answer for another.
  assert.equal(OWN_TABLES.length, 2, 'one narrow relation per command family');
  assert.match(tableBlock('replay_draft_revision_commands'), /UNIQUE \(replay_id, resulting_draft_revision\)/u,
    'two competing revisions can never both commit the same step');
});

test('every consequential primitive is sealed, and only the creator-exact read boundary reaches the service tier', () => {
  for (const table of OWN_TABLES) {
    assert.ok(executableSql.includes(`ALTER TABLE public.${table} OWNER TO postgres;`));
    assert.ok(executableSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`));
  }
  assert.doesNotMatch(executableSql, /CREATE POLICY/u, 'zero policies');
  for (const fn of [TOKEN, ...CORES, CURRENCY, ...HUMAN, COMPOSITION]) {
    assert.match(functionBody(fn).header, /SET search_path=''/u, `${fn} pins an empty search_path`);
    assert.ok(executableSql.includes(`ALTER FUNCTION public.${fn}(`), `${fn} is explicitly owned`);
  }
  // Exactly ONE grant exists in the whole migration, and it is the read boundary.
  const grants = [...executableSql.matchAll(/GRANT EXECUTE ON FUNCTION %s TO service_role/gu)];
  assert.equal(grants.length, 1, 'exactly one grant exists in 0101');
  assert.ok(executableSql.includes("resolver text := 'public.resolve_replay_draft_composition_v1(uuid, uuid)';"),
    'and the granted function is the creator-exact composition resolver');
  assert.ok(executableSql.includes("EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);"),
    'every consequential primitive is revoked from the service tier too, pending a reviewed CW2-08 wrapper');
  // Every internal function is listed for revocation, and the resolver is not among them.
  const internal = /internal text\[\] := ARRAY\[([\s\S]*?)\];/u.exec(executableSql);
  assert.ok(internal, '0101 revokes an explicit internal list');
  for (const fn of [TOKEN, ...CORES, CURRENCY, ...HUMAN]) {
    assert.ok(internal[1].includes(`public.${fn}(`), `${fn} is revoked from every application role`);
  }
  assert.ok(!internal[1].includes(COMPOSITION), 'the read boundary is not in the internal revoke list');
  // No route, controller or RPC surface is added by this slice.
  assert.doesNotMatch(executableSql, /CREATE (?:OR REPLACE )?VIEW|COMMENT ON EXTENSION|CREATE PUBLICATION/u);
});

test('the self-assertions refuse to deploy a runtime that lost any of this, and ban no authorized future', () => {
  assert.ok(SELF_ASSERT_START > 0, '0101 carries a deploy-time self-assertion block');
  for (const phrase of [
    'must be owned by postgres',
    'must be SECURITY DEFINER',
    'must pin an empty search_path',
    'before the frozen CW2-08 Launch Gate exists',
    'the service tier is an executor, never the human consent principal',
    'locks rows in the canonical order, never a table and never an advisory key',
    'a Replay binds source truth and never writes it',
    'it is internal audit truth, not a bridge into private source',
    'consume the ONE canonical I-04F visibility entry point',
    'creation authority is not distribution authority',
    'must claim no Safety, Launch or entitlement clearance',
    'must produce no lifecycle but DRAFT',
    'must write no natural-language selection result and no MIXED medium',
    'Public source authority is Experience CONTROL',
    'the anchors are Session Position, establishment instant and package ordinal',
    'must derive the human from auth.uid() and never from a parameter',
    'may not accept an actor authority audience order digest medium or completeness parameter',
    'must check durable idempotency before any lock and again under it',
    'the Personal adapter must require the creator to own the exact Session',
    'the Shared adapter must consume the ONE canonical I-04F visibility entry point',
    'the reserved Shared kinds and the unproduced Public forms must be unselectable',
    'the Public adapter must require EXPERIENCE CONTROL AUTHORITY',
    'a voice-note handle is digested one-way and never stored',
    'must share ONE bounded class',
    'the Shared source must be stabilized World first, then materials, then history items, in SHARE mode',
    'every source lock is a SHARE lock',
    'a revision locks the Replay first, stabilizes the source second and writes last',
    'the selected order is derived from the manifest',
    'nothing outside the authorized universe is a selection',
    'no selection may be marked render-safe: Semantic Cut Safety belongs to I-06B',
    'the composition resolver answers the exact creator and nobody else',
    'must disclose no source identity, no private path and no internal staleness cause',
    'must bind its actor to the exact Replay creator through the identity key',
    'the 0100 component immutability and chronology guards must still be in place',
    'the ONE frozen I-04F visibility entry point must still be reachable',
    'I-06A manufactures no launch readiness',
    'must answer a source that is not ONE canonical row as contradictory, never as current',
    'a contradictory source binding must be answered before availability and access',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the self-assertions refuse a runtime missing: ${phrase}`);
  }
  // A CONTRACT, NOT A CEILING: no assertion may forbid what I-06B/C/D must add,
  // or a later slice could only proceed by deleting an assertion.
  for (const future of ['analytical_projection', 'render_contract', 'replay_versions',
    'distribution_package', 'source_loss', 'republish']) {
    assert.doesNotMatch(selfAssertions, new RegExp(`RAISE EXCEPTION[^;]*${future}`, 'iu'),
      `no self-assertion may forbid a later reviewed ${future}`);
  }
});

test('0101 is registered in the toolchain, in the I-06A CI group, in the README and in the phase document', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0101\\.mjs"`, 'u'));
  assert.match(readme, /0101_replay_authorized_draft_runtime_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README records the verifier command');
  assert.match(verifier, /verifier for migration 0101/iu);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0101=PASS; else status=1; fi`));
  assert.ok(workflow.includes(`if npm run ${PART_A_SCRIPT}; then result_0100=PASS; else status=1; fi`),
    'both I-06A verifiers run, and one failing never silently skips the other');
  const step = workflow.slice(workflow.indexOf('- name: Verify the two I-06A Replay foundation and draft runtime verifiers'));
  const body = step.slice(0, step.indexOf('\n      - '));
  assert.ok(body.includes('exit "$status"'), 'the grouped I-06A step fails the job when either verifier failed');
  assert.ok(body.indexOf(PART_A_SCRIPT) < body.indexOf(OWN_SCRIPT), '0100 is reported before 0101');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
  // The phase document tells the truth about where I-06 stands.
  assert.ok(doc.includes('I-06') && doc.includes('ACTIVE'), 'the phase document records I-06 as ACTIVE');
  assert.ok(doc.includes('CANDIDATE'), 'and I-06A as a candidate awaiting independent review');
  assert.doesNotMatch(doc, /^\s*`?I-06`?\s+(?:is\s+)?(?:CLOSED|FROZEN)/mu, 'and never claims I-06 is closed or frozen');
  assert.ok(doc.includes('QAN-BL-NAV-02'), 'and records the backlog disposition explicitly, because silence is not a disposition');
});

test('the verifier proves the thirty-two scenario proofs, the refused weakenings and the race matrix', () => {
  for (const needle of ['P01', 'P02', 'P03', 'P04', 'P14', 'P24', 'P29',
    'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S25',
    'Q11', 'Q12', 'Q13',
    'D15', 'D16', 'D17', 'D18', 'D19', 'D24', 'D25', 'D26', 'D27', 'D28', 'D30',
    'F1 creation becoming application-reachable is a regression',
    'F2 an adapter that re-derives Shared access from membership is a regression',
    'F3 a Public adapter without Experience control is a regression',
    // Truncated before the apostrophe: the verifier source escapes it, so the
    // file's literal bytes are `caller\'s` and a plain apostrophe never matches.
    'F4 a selection core that takes the caller',
    'F5 a composition resolver that answers a stranger is a regression',
    'F6 a revision that commits over a stale source is a regression',
    'F7 a read boundary that discloses a source World is a regression',
    'F8 a birth that skips DRAFT is a regression',
    'anti-vacuity', 'C18', 'C20', 'C21', 'C22', 'C23', 'SAVEPOINT forward_safety',
    // The contradictory-source proof, simulated under a rolled-back savepoint.
    'S31', 'SOURCE_CONTRADICTORY', 'SAVEPOINT contradiction',
    'DISABLE TRIGGER replay_source_manifest_items_one_row',
    'S31 the same-row guard is enabled again after the simulation']) {
    assert.ok(verifier.includes(needle), `the verifier proves ${needle}`);
  }
  assert.ok(support.includes('removeCommittedReplays') && support.includes('REPLAY_IMMUTABLE'),
    'the shared harness lifts the Replay guards for teardown');
  assert.ok(support.includes('DISABLE TRIGGER') && support.includes('ENABLE TRIGGER')
    && support.includes('is enabled again after Replay teardown'),
  'and PROVES every lifted append-only guard back, so a teardown can never leave one disabled in the database it ran against');
  assert.match(verifier, /\}, \(\) => rt\.client\.end\(\)\.catch\(\(\) => undefined\)\);\s*$/u,
    'the verifier ends its database client through the envelope on every path, so a failure exits instead of hanging the CI step');
  // Every launched blocking promise is awaited only after the release edge, or
  // the verifier deadlocks against itself instead of proving a race.
  for (const launched of ['duplicate', 'loser', 'deleting', 'capturing', 'capturingOld', 'capturingAfterLeave']) {
    const launch = verifier.indexOf(`const ${launched} = q2`);
    assert.ok(launch > 0, `${launched} is LAUNCHED on the second connection rather than awaited inline`);
    const released = verifier.indexOf("await q('COMMIT')", launch);
    const settled = Math.min(...[`await ${launched}`, `assert.rejects(${launched}`, `(await ${launched})`]
      .map((s) => verifier.indexOf(s, launch)).filter((i) => i > 0));
    assert.ok(released > launch && settled > released,
      `${launched} is awaited only after the other connection released`);
  }
});

// ---------------------------------------------------------------------------
// Forward safety and anti-vacuity for the WHOLE I-06A slice.
// ---------------------------------------------------------------------------

const I06A_CONTRACTS = [
  'database/tests/replay-foundation-source-manifest-v1.test.mjs',
  'database/tests/replay-authorized-draft-runtime-v1.test.mjs',
];
const MIRRORED = ['.github', 'database', 'tests', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i06a-replay-');
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(mirror, entry), { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  // The 0101 contract reads the phase document, which is not otherwise mirrored.
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
  const files = I06A_CONTRACTS.map((relative) => join(mirror, relative));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    { cwd: mirror, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.error, undefined, `the mirrored contracts could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'the mirrored contracts did not exit normally');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(output, /# pass \d+/u, `the mirrored contracts reported no results:\n${output.slice(-1500)}`);
  assert.doesNotMatch(output, /# pass 0\b/u, 'the mirrored contracts executed nothing');
  return { ok: result.status === 0, output };
}

const M100 = 'database/migrations/0100_replay_foundation_source_manifest_selection_v1.sql';
const M101 = `database/migrations/${MIGRATION_NAME}`;
const SUPPORT = 'database/replay-verifier-support.mjs';
const V100 = 'database/verify-migration-0100.mjs';
const V101 = 'database/verify-migration-0101.mjs';
const CI = '.github/workflows/api-ci.yml';
const GROUP_STEP = '      - name: Verify the two I-06A Replay foundation and draft runtime verifiers against real PostgreSQL as one reported group';

test('every authorized later addition leaves both I-06A contracts passing',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const mirror = buildMirror();
    try {
      // The roadmap, as a real migration: the I-06B analytical projection and
      // render contract, the FIRST COMPLETE REPLAY_VERSION binding all four
      // components, a PREVIEW_READY writer, an I-06C distribution package with
      // approvals and an export sanitizer, an I-06D source-loss record, a
      // reviewed CW2-08 wrapper that is itself grantable, and additive columns.
      write(mirror, 'database/migrations/0102_replay_projection_render_and_distribution_v1.sql',
        'BEGIN;\n'
        + 'CREATE TABLE public.replay_analytical_projection_versions (id uuid PRIMARY KEY,\n'
        + '  replay_id uuid NOT NULL REFERENCES public.replays (id) ON DELETE RESTRICT, projected_at timestamptz NOT NULL);\n'
        + 'CREATE TABLE public.replay_render_contract_versions (id uuid PRIMARY KEY,\n'
        + '  replay_id uuid NOT NULL REFERENCES public.replays (id) ON DELETE RESTRICT, contract_ref text NOT NULL);\n'
        + 'CREATE TABLE public.replay_versions (id uuid PRIMARY KEY,\n'
        + '  replay_id uuid NOT NULL REFERENCES public.replays (id) ON DELETE RESTRICT,\n'
        + '  source_manifest_version_id uuid NOT NULL REFERENCES public.replay_source_manifest_versions (id) ON DELETE RESTRICT,\n'
        + '  selection_spec_version_id uuid NOT NULL REFERENCES public.replay_selection_spec_versions (id) ON DELETE RESTRICT,\n'
        + '  analytical_projection_version_id uuid NOT NULL REFERENCES public.replay_analytical_projection_versions (id) ON DELETE RESTRICT,\n'
        + '  render_contract_version_id uuid NOT NULL REFERENCES public.replay_render_contract_versions (id) ON DELETE RESTRICT);\n'
        + 'CREATE TABLE public.replay_temporal_discontinuities (replay_version_id uuid NOT NULL REFERENCES public.replay_versions (id) ON DELETE RESTRICT,\n'
        + '  after_selected_ordinal integer NOT NULL, PRIMARY KEY (replay_version_id, after_selected_ordinal));\n'
        + 'CREATE FUNCTION public.commit_replay_preview_ready_v1(p_replay_id uuid) RETURNS void\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + "  BEGIN UPDATE public.replays r SET current_lifecycle = 'PREVIEW_READY' WHERE r.id = p_replay_id; END$fn$;\n"
        + 'CREATE TABLE public.replay_distribution_package_versions (id uuid PRIMARY KEY,\n'
        + '  replay_version_id uuid NOT NULL REFERENCES public.replay_versions (id) ON DELETE RESTRICT);\n'
        + 'CREATE TABLE public.replay_distribution_approvals (id uuid PRIMARY KEY,\n'
        + '  package_version_id uuid NOT NULL REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,\n'
        + '  approver_user_id uuid NOT NULL);\n'
        + "CREATE FUNCTION public.replay_export_privacy_sanitization_v1(p_package_version_id uuid) RETURNS text\n  LANGUAGE sql SET search_path='' AS $fn$ SELECT 'SANITIZED'::text $fn$;\n"
        + 'CREATE TABLE public.replay_source_loss_records (manifest_version_id uuid PRIMARY KEY\n'
        + '  REFERENCES public.replay_source_manifest_versions (id) ON DELETE RESTRICT, noted_at timestamptz NOT NULL);\n'
        + 'ALTER TABLE public.replay_create_commands ADD COLUMN client_ref text;\n'
        + 'CREATE INDEX replay_create_commands_committed_idx ON public.replay_create_commands (committed_at);\n'
        + 'CREATE FUNCTION public.launch_gated_create_replay_draft_v1(p_command_id uuid, p_replay_id uuid) RETURNS void\n'
        + "  LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN PERFORM 1; END$fn$;\n"
        + 'GRANT EXECUTE ON FUNCTION public.launch_gated_create_replay_draft_v1(uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0102.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/replay-projection-render-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      patch(mirror, CI, GROUP_STEP,
        '      - {name: Verify a later reviewed Replay slice, run: npm run verify:replay-projection-render:integration}\n' + GROUP_STEP);
      const { ok, output } = runInMirror(mirror);
      assert.ok(ok,
        'the I-06B projection render contract and first complete REPLAY_VERSION, a PREVIEW_READY writer, an I-06C '
        + 'distribution package with approvals and an export sanitizer, an I-06D source-loss record, a reviewed '
        + 'CW2-08 wrapper, additive columns, an index and a new CI gate must all leave I-06A passing:\n'
        + output.slice(-2500));
    } finally {
      removeHarnessMirror(mirror);
    }
  });

test('the contracts are not vacuous: every deliberate weakening of I-06A is refused by at least one of them',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const regressions = [
      // --- 0100: a Replay stops being a source-bound non-World artifact
      ['the Replay identity grows a distribution flag', M100,
        '    current_lifecycle text NOT NULL,\n', '    current_lifecycle text NOT NULL,\n    is_public boolean,\n'],
      ['the manifest items grow a source body column', M100,
        '    captured_source_digest text NOT NULL,\n', '    captured_source_digest text NOT NULL,\n    body_text text,\n'],
      ['a Replay relation grows a World membership column', M100,
        '    draft_revision bigint NOT NULL,\n', '    draft_revision bigint NOT NULL,\n    member_count integer,\n'],
      ['the Public source binding weakens into an independent key', M100,
        '    CONSTRAINT replay_source_manifest_versions_public_version_fk\n        FOREIGN KEY (public_experience_version_id, public_experience_id, public_manifest_version_id)\n        REFERENCES public.public_experience_versions (id, experience_id, package_manifest_version_id)\n        ON DELETE RESTRICT',
        '    CONSTRAINT replay_source_manifest_versions_public_version_fk\n        FOREIGN KEY (public_experience_version_id)\n        REFERENCES public.public_experience_versions (id)\n        ON DELETE RESTRICT'],
      ['manifest completeness becomes a written column instead of a derived one', M100,
        '    universe_complete boolean GENERATED ALWAYS AS (item_count = authorized_universe_item_count) STORED,',
        '    universe_complete boolean NOT NULL,'],
      ['FULL_SOURCE stops requiring the complete captured universe', M100,
        '        CHECK (coverage_class <> \'FULL_SOURCE\'\n            OR (manifest_universe_complete AND selected_item_count = manifest_item_count\n                AND whole_item_count = selected_item_count AND source_contiguous)),',
        "        CHECK (coverage_class <> 'FULL_SOURCE' OR selected_item_count >= 1),"],
      ['the chronology guard is no longer installed', M100,
        'CREATE TRIGGER replay_selection_spec_items_chronology', 'CREATE TRIGGER replay_selection_spec_items_later'],
      ['a component relation becomes mutable', M100,
        'CREATE TRIGGER replay_selection_spec_versions_immutable', 'CREATE TRIGGER replay_selection_spec_versions_later'],
      ['a reserved Shared kind with no producer becomes bindable', M100,
        "    CONSTRAINT replay_source_manifest_items_shared_kind_check\n        CHECK (shared_material_kind IS NULL\n            OR shared_material_kind IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')),",
        '    CONSTRAINT replay_source_manifest_items_shared_kind_check\n        CHECK (shared_material_kind IS NULL OR length(btrim(shared_material_kind)) > 0),'],
      ['a Replay foreign key stops being restrictive and cascades source truth away', M100,
        '    CONSTRAINT replay_source_manifest_items_personal_unit_fk\n        FOREIGN KEY (personal_conversation_unit_id)\n        REFERENCES public.conversation_units (id) ON DELETE RESTRICT,',
        '    CONSTRAINT replay_source_manifest_items_personal_unit_fk\n        FOREIGN KEY (personal_conversation_unit_id)\n        REFERENCES public.conversation_units (id) ON DELETE CASCADE,'],
      ['a Personal source item is recorded as original audio that never existed', M100,
        "            AND original_medium = 'ORIGINAL_TEXT'\n            AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL",
        '            AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL'],

      // --- the exact same-row source binding, which independent keys cannot express
      ['the same-row guard stops proving a Personal unit and its Session Position are one row', M100,
        '                          AND cu.session_position = NEW.personal_session_position\n                          AND cu.source_role = NEW.personal_source_role) THEN',
        '                          AND cu.source_role = NEW.personal_source_role) THEN'],
      ['the same-row guard stops proving a Shared material owns the history item named', M100,
        '                        AND m.history_item_id = NEW.shared_history_item_id) THEN',
        '                        AND m.world_id = NEW.shared_world_id) THEN'],
      ['the same-row guard stops binding the captured Shared instant to that event', M100,
        '                        AND h.occurred_at = NEW.shared_occurred_at) THEN',
        '                        AND h.world_id = NEW.shared_world_id) THEN'],
      ['the same-row guard stops binding the public ordinal to the exact package item', M100,
        '                          AND it.item_ordinal = NEW.public_item_ordinal\n                          AND it.derivative_classification = NEW.public_derivative_classification) THEN',
        '                          AND it.derivative_classification = NEW.public_derivative_classification) THEN'],
      ['the same-row guard is no longer installed at all', M100,
        'CREATE TRIGGER replay_source_manifest_items_one_row', 'CREATE TRIGGER replay_source_manifest_items_later'],
      ['source currency blesses a binding that is not one canonical row', M101,
        '       WHERE i.manifest_version_id = manifest.id\n         AND (m.id IS NULL OR h.id IS NULL',
        '       WHERE false\n         AND (m.id IS NULL OR h.id IS NULL'],
      ['source currency answers a contradiction only after availability', M101,
        "      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CONTRADICTORY'::text; RETURN;\n    END IF;\n    IF EXISTS (\n      SELECT 1 FROM public.replay_source_manifest_items i\n        JOIN public.shared_world_history_items h ON h.id = i.shared_history_item_id\n       WHERE i.manifest_version_id = manifest.id AND h.availability_state <> 'AVAILABLE'\n    ) THEN\n      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_UNAVAILABLE'::text; RETURN;\n    END IF;",
        "      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CONTRADICTORY'::text; RETURN;\n    END IF;"],
      ['the 0100 verifier stops cross-pairing two real Personal moments', V100,
        "  await rejected(() => insertItem({ ...pPair, unit: f.userUnit, position: 2, role: 'ASSISTANT' }),\n    ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);",
        '  // the Personal cross-pair proof was removed'],
      ['the 0101 verifier stops proving a planted contradiction is never current', V101,
        "    assert.equal(contradictory.staleness_class, 'SOURCE_CONTRADICTORY', 'S31 and it is reported as contradictory rather than merely changed');",
        ''],

      // --- 0101: the runtime stops enforcing authority, truth or privacy
      ['the Shared adapter re-derives access from current membership', M101,
        'SELECT array_agg(v.history_item_id ORDER BY v.occurred_at, v.history_item_id) INTO visible\n        FROM public.resolve_shared_world_history_visibility_v1(p_source_context_id, u) v;',
        "SELECT array_agg(i.id ORDER BY i.occurred_at, i.id) INTO visible FROM public.shared_world_history_items i\n        WHERE i.world_id = p_source_context_id AND i.availability_state = 'AVAILABLE'\n          AND EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e\n                       WHERE e.world_id = i.world_id AND e.user_id = u AND e.ended_at IS NULL);"],
      ['the Public adapter stops requiring Experience control', M101,
        'IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c\n                                  WHERE c.experience_id = p_source_context_id AND c.controller_user_id = u) THEN',
        'IF NOT FOUND THEN'],
      ['the Public adapter derives eligibility from public visibility', M101,
        '    IF experience.current_experience_version_id IS DISTINCT FROM p_source_version_id',
        '    PERFORM 1 FROM public.resolve_public_visibility_state_v1(p_source_context_id);\n    IF experience.current_experience_version_id IS DISTINCT FROM p_source_version_id'],
      ['a mutation accepts a caller-supplied actor', M101,
        'CREATE FUNCTION public.create_replay_draft_v1(\n  p_command_id uuid,', 'CREATE FUNCTION public.create_replay_draft_v1(\n  p_actor_user_id uuid,\n  p_command_id uuid,'],
      ['creation writes a lifecycle it has not earned', M101,
        "VALUES (p_replay_id, u, 'DRAFT', instant);", "VALUES (p_replay_id, u, 'PREVIEW_READY', instant);"],
      ['the selection core takes the caller order instead of the canonical one', M101,
        '         (row_number() OVER (ORDER BY mi.source_item_ordinal))::integer,\n         CASE WHEN s.rs IS NULL',
        '         (row_number() OVER (ORDER BY s.sid))::integer,\n         CASE WHEN s.rs IS NULL'],
      ['FULL_SOURCE becomes something the caller can assert', M101,
        "  IF p_requested_coverage_class = 'FULL_SOURCE'\n     AND NOT (manifest.universe_complete AND selected = manifest.item_count AND whole = selected AND contiguous) THEN",
        '  IF false THEN'],
      ['a selection may name an identity outside the captured universe', M101,
        '  IF matched <> selected THEN', '  IF false THEN'],
      ['the read boundary answers a stranger', M101,
        '     WHERE r.id = p_replay_id AND r.created_by_user_id = p_user_id;', '     WHERE r.id = p_replay_id;'],
      ['the read boundary discloses the internal staleness cause', M101,
        '              selected_item_count integer, source_contiguous boolean, currency_state text,\n              updated_at timestamptz)',
        '              selected_item_count integer, source_contiguous boolean, currency_state text,\n              staleness_class text, updated_at timestamptz)'],
      ['a revision stops revalidating source currency before it commits', M101,
        "IF currency IS DISTINCT FROM 'CURRENT' THEN", 'IF false THEN'],
      ['every consequential primitive becomes application-reachable before the Launch Gate', M101,
        "      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);",
        "      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);"],
      ['the capture reaches into the sealed Public provenance', M101,
        '    SELECT count(*)::integer INTO locked FROM public.publication_package_manifest_items it\n     WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids);',
        '    SELECT count(*)::integer INTO locked FROM public.publication_package_item_provenance it\n     WHERE it.manifest_version_id = package.id;'],
      ['a source row is taken with an exclusive lock instead of a share lock', M101,
        'PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_source_context_id FOR SHARE;',
        'PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_source_context_id FOR UPDATE;'],
      // A whole item and a range over it would fingerprint alike, so a DIFFERENT
      // request replays as an equivalent retry and returns the wrong committed answer.
      ['the request identity stops distinguishing a whole item from a range over it', M101,
        "                      || CASE WHEN s.rs IS NULL THEN 'WHOLE' ELSE s.rs::text || '-' || s.re::text END,",
        "                      || 'WHOLE',"],

      // --- the gates themselves
      ['a frozen predecessor migration is edited',
        'database/migrations/0090_shared_world_material_commit_owner_deletion_v1.sql', 'BEGIN;', 'BEGIN;\n-- edited\n'],
      ['the CI step that runs an I-06A verifier is removed', CI,
        `if npm run ${OWN_SCRIPT}; then result_0101=PASS; else status=1; fi`,
        'if npm run test:toolchain; then result_0101=PASS; else status=1; fi'],
      ['the grouped I-06A CI step stops failing the job when a verifier fails', CI,
        '"$result_0100" "$result_0101" >> "$GITHUB_STEP_SUMMARY"\n          fi\n          exit "$status"\n',
        '"$result_0100" "$result_0101" >> "$GITHUB_STEP_SUMMARY"\n          fi\n          exit 0\n'],
      ['a failing I-06A verifier is swallowed instead of recorded', CI,
        `if npm run ${PART_A_SCRIPT}; then result_0100=PASS; else status=1; fi`,
        `npm run ${PART_A_SCRIPT} || true`],
      ['a failed I-06A verifier hangs its CI step instead of exiting', V101,
        '}, () => rt.client.end().catch(() => undefined));\n', '  await rt.client.end();\n});\n'],
      ['the 0100 verifier stops proving that a chronology reversal is unrepresentable', V100,
        "  await rejected(() => insertSpecItem(wideSpec, wide.id, 1, 2), ['P0001'], /REPLAY_SELECTION_CHRONOLOGY_REVERSED/u);",
        '  // the reversal proof was removed'],
      ['the Replay teardown stops proving the immutability guards back', SUPPORT,
        "assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled again after Replay teardown`);", ''],
      ['a Replay race awaits before releasing the other connection', V101,
        "    await q('COMMIT');\n    const [dup] = (await duplicate).rows;", "    const [dup] = (await duplicate).rows;\n    await q('COMMIT');"],
    ];
    for (const [reason, file, from, to] of regressions) {
      const fresh = buildMirror();
      try {
        patch(fresh, file, from, to);
        const { ok, output } = runInMirror(fresh);
        assert.equal(ok, false,
          `a repository where ${reason} must break at least one I-06A contract; both passed:\n${output.slice(-1500)}`);
      } finally {
        removeHarnessMirror(fresh);
      }
    }
  });
