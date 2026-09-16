// Real-PostgreSQL verifier for migration 0101 - I-06A Replay Authorized Source
// Capture and Draft Runtime v1 (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// execution, the thirty-two scenario proofs the I-06A contract requires:
//
//   catalog / posture
//     * every function is postgres-owned, SECURITY DEFINER, pinned, and
//       executable by no application role except the ONE creator-exact read
//       boundary, which service_role alone may execute;
//     * the human is derived from auth.uid() and no mutation accepts an actor,
//       authority, audience, order, digest, medium or completeness parameter;
//     * the Shared adapter consumes the canonical I-04F visibility entry point
//       and never re-implements membership; the Public adapter requires
//       Experience CONTROL and never reads sealed provenance or Public visibility;
//     * no function writes any lifecycle but DRAFT, any natural-language result,
//       any distribution, Safety or Launch state, or any source relation.
//
//   Personal (P), Shared (S), Public (Q), draft lifecycle (D), forward safety
//   (F) and the race matrix (C) sections below carry the scenario numbers of
//   the contract in their comments.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, FN, NONE, R, REPLAY_DISCLOSURE_BAN, REPLAY_IMMUTABLE, SEAM, T, createReplayRuntime, runVerifier } from './replay-verifier-support.mjs';

const rt = createReplayRuntime(process.env.DATABASE_URL);
const { q, rows, count, actAs, asRole, rejected } = rt;

const OWN_TABLES = [R.CREATE_COMMANDS, R.REVISION_COMMANDS];
const REPLAY_TABLES = [R.REPLAYS, R.MANIFESTS, R.MANIFEST_ITEMS, R.SPECS, R.SPEC_ITEMS, R.DRAFT_STATE, ...OWN_TABLES];
const HUMAN = [FN.CREATE, FN.REVISE];
const CORES = [FN.CAPTURE, FN.LOCK, FN.SELECT];
const MUTATION_PARAMETER_BAN = /actor|creator|owner|user_id|approver|authority|audience|viewer|visib|publish|distribut|lifecycle|clear|launch|safety|entitle|allow|ordinal|order|contiguous|method|digest|fingerprint|medium|availability|complete|natural|language/u;
/** Relations whose row counts a Replay creation must leave exactly alone. */
const UNTOUCHED = ['public.shared_worlds', 'public.shared_world_membership_episodes', 'public.shared_world_governance_proposals',
  'public.shared_world_history_access_grants', 'public.shared_world_materials', 'public.shared_world_history_items',
  T.EXPERIENCES, T.CONTROLLERS, T.MANIFESTS, T.APPROVALS, T.REQUIRED, T.PUBLICATION_STATE, T.PROVENANCE,
  'public.conversation_units', 'public.conversation_sessions'];

const digestOf = async (text) => (await rows("SELECT 'sha256:' || encode(sha256(convert_to($1, 'UTF8')), 'hex') d", [text]))[0].d;
async function untouchedCounts() {
  const out = {};
  for (const table of UNTOUCHED) out[table] = Number((await rows(`SELECT count(*) n FROM ${table}`))[0].n);
  return out;
}

async function verifyCatalog() {
  await rt.verifyPosture({
    internal: [FN.CAPTURE, FN.LOCK, FN.CURRENCY, FN.SELECT, FN.CREATE, FN.REVISE],
    mutating: [FN.CAPTURE, FN.LOCK, FN.SELECT, FN.CREATE, FN.REVISE],
    reading: [FN.CURRENCY, FN.COMPOSITION],
    tables: OWN_TABLES,
    immutable: REPLAY_IMMUTABLE,
  });
  // The token function is IMMUTABLE and internal; the resolver is service_role-only.
  assert.equal((await rt.functionPosture(FN.TOKEN)).volatility, 'i', 'the selection request token is IMMUTABLE');
  for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, FN.TOKEN), false, `${role} must not execute the token helper`);
  const resolver = await rt.functionPosture(FN.COMPOSITION);
  assert.equal(resolver.secdef, true); assert.equal(resolver.volatility, 's'); assert.equal(resolver.owner, 'postgres');
  for (const role of ['public', 'anon', 'authenticated']) assert.equal(await rt.canExecute(role, FN.COMPOSITION), false, `${role} must not execute the composition resolver`);
  assert.equal(await rt.canExecute('service_role', FN.COMPOSITION), true, 'service_role executes the ONE creator-exact read boundary');
  assert.ok(resolver.prosrc.includes('r.created_by_user_id = p_user_id'), 'the resolver answers the exact creator and nobody else');
  const columns = await rt.resultColumns(FN.COMPOSITION);
  assert.ok(columns.length > 0);
  for (const column of columns) assert.doesNotMatch(column, REPLAY_DISCLOSURE_BAN, `the composition resolver must not return ${column}`);

  for (const fn of [...HUMAN, ...CORES]) {
    const p = await rt.functionPosture(fn);
    assert.ok(p.prosrc.includes('u uuid := auth.uid();'), `${fn} derives the human from auth.uid()`);
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, MUTATION_PARAMETER_BAN, `${fn} may not accept ${name}`);
    }
  }
  for (const fn of HUMAN) {
    const p = await rt.functionPosture(fn);
    for (const name of await rt.inputParameters(fn)) assert.doesNotMatch(name, /instant|timestamp|_at$/u, `${fn} accepts no clock (${name})`);
    assert.equal((p.prosrc.match(/clock_timestamp\(\)/gu) ?? []).length, 1, `${fn} reads the database clock exactly once`);
    assert.ok((p.prosrc.match(/WHERE c\.id = p_command_id/gu) ?? []).length >= 2, `${fn} checks durable idempotency before any lock and again under it`);
    assert.ok(p.prosrc.includes('REPLAY_COMMAND_ID_CONFLICT') && p.prosrc.includes('replay_selection_request_token_v1'), `${fn} binds the whole request identity`);
  }
  for (const fn of CORES) assert.ok(!(await rt.functionPosture(fn)).prosrc.includes('clock_timestamp'), `${fn} reads no clock of its own`);
  for (const fn of [FN.TOKEN, ...CORES, FN.CURRENCY, ...HUMAN, FN.COMPOSITION]) {
    const p = await rt.functionPosture(fn);
    assert.doesNotMatch(p.prosrc, /(INSERT INTO|UPDATE|DELETE FROM) public\.(conversation_|session_semantic|shared_world|public_experience|public_identit|public_world|publication_|users)/u,
      `${fn} mutates no Personal, Shared or Public relation`);
    assert.ok(!p.prosrc.includes('publication_package_item_provenance'), `${fn} never reads the sealed Public provenance`);
    assert.doesNotMatch(p.prosrc, /shared_world_membership_episodes|shared_world_history_access_grants|shared_world_standard_closed_view_entitlements|shared_world_history_package_manifest_items|shared_world_standing_context/u,
      `${fn} never re-implements Shared authorization`);
    assert.doesNotMatch(p.prosrc, /PUBLISH_TO_PUBLIC_WORLD|SHARE_EXTERNALLY|DOWNLOAD|DISTRIBUT|EXPORT_/u, `${fn} carries no distribution action`);
    assert.doesNotMatch(p.prosrc, /SAFETY_ALLOW|LAUNCH_CLEARED|ENTITLED|FEATURE_ENABLED|PUBLIC_LAUNCH_READY|CLEARED/u, `${fn} claims no Safety or Launch clearance`);
    assert.doesNotMatch(p.prosrc, /PREVIEW_READY|FINALIZED/u, `${fn} produces no lifecycle but DRAFT`);
    assert.doesNotMatch(p.prosrc, /NATURAL_LANGUAGE|'MIXED'/u, `${fn} writes no natural-language result and no MIXED medium`);
    assert.doesNotMatch(p.prosrc, /ABSENT_FROM_PUBLIC_WORLD|resolve_public_visibility_state_v1|resolve_public_audience_admission_v1/u,
      `${fn} derives no eligibility from Public visibility`);
    assert.doesNotMatch(p.prosrc, /\.created_at/u, `${fn} reads no wall-clock creation time as an anchor`);
  }
  const capture = await rt.functionPosture(FN.CAPTURE);
  for (const needle of ['public.resolve_shared_world_history_visibility_v1(p_source_context_id, u)', 'NOT (m.history_item_id = ANY(visible))',
    'public_experience_controllers c', 'c.controller_user_id = u', 'current_experience_version_id IS DISTINCT FROM p_source_version_id',
    'REPLAY_SOURCE_KIND_RESERVED', 'FROM public.session_semantic_clocks c', 'c.user_id = u FOR SHARE',
    'FROM public.shared_worlds w WHERE w.id = p_source_context_id FOR SHARE', 'ORDER BY m.id FOR SHARE', 'ORDER BY i.id FOR SHARE',
    'FROM public.public_world_state w WHERE w.singleton FOR SHARE', 'FROM public.public_experiences e WHERE e.id = p_source_context_id FOR SHARE']) {
    assert.ok(capture.prosrc.includes(needle), `the capture core requires: ${needle}`);
  }
  assert.ok(!capture.prosrc.includes('FOR UPDATE'), 'every source lock is a SHARE lock: a Replay reads source truth and never writes it');
  const shared = capture.prosrc.indexOf('FROM public.shared_worlds w WHERE w.id = p_source_context_id FOR SHARE');
  assert.ok(shared < capture.prosrc.indexOf('ORDER BY m.id FOR SHARE') && capture.prosrc.indexOf('ORDER BY m.id FOR SHARE') < capture.prosrc.indexOf('ORDER BY i.id FOR SHARE'),
    'Shared source is stabilized World, then materials, then history items');
  const revise = await rt.functionPosture(FN.REVISE);
  const replayLock = revise.prosrc.indexOf('FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE');
  assert.ok(replayLock >= 0 && replayLock < revise.prosrc.indexOf('replay_lock_source_manifest_v1(manifest_id)')
    && revise.prosrc.indexOf('replay_lock_source_manifest_v1(manifest_id)') < revise.prosrc.indexOf('UPDATE public.replay_draft_state s'),
  'a revision locks the Replay first, stabilizes the source second and writes last');
  for (const needle of ['derive_replay_source_manifest_currency_v1', 'REPLAY_SOURCE_STALE', 'state.draft_revision <> p_expected_draft_revision', 'REPLAY_DRAFT_STALE',
    'replay.created_by_user_id <> u', 'REPLAY_NOT_AVAILABLE', "current_lifecycle <> 'DRAFT'"]) {
    assert.ok(revise.prosrc.includes(needle), `the revision requires: ${needle}`);
  }
  const selection = await rt.functionPosture(FN.SELECT);
  for (const needle of ['row_number() OVER (ORDER BY mi.source_item_ordinal)', 'REPLAY_COVERAGE_NOT_PROVABLE', 'IF matched <> selected THEN', "'EXPLICIT_RESOLVED_ANCHORS'"]) {
    assert.ok(selection.prosrc.includes(needle), `the selection core requires: ${needle}`);
  }
  const currency = await rt.functionPosture(FN.CURRENCY);
  for (const needle of ['resolve_shared_world_history_visibility_v1(manifest.shared_world_id, creator)', 'WHEN OTHERS THEN', 'SOURCE_ACCESS_LOST',
    'availability_revision <> i.captured_availability_revision', 'public_experience_controllers', 'SOURCE_VERSION_NOT_CURRENT']) {
    assert.ok(currency.prosrc.includes(needle), `the currency derivation requires: ${needle}`);
  }
  assert.ok(!currency.prosrc.includes('auth.uid'), 'currency is a property of the Replay and its creator, never of the asker');
  const create = await rt.functionPosture(FN.CREATE);
  assert.ok(create.prosrc.includes("VALUES (p_replay_id, u, 'DRAFT', instant)"), 'creation writes exactly DRAFT bound to the exact human');
  // STRUCTURE: the command history binds its actor to the exact creator.
  for (const table of OWN_TABLES) {
    assert.ok((await rt.foreignKeysInto(table, R.REPLAYS)).some((fk) => fk.confdeltype === 'r'
      && JSON.stringify(fk.local_columns) === JSON.stringify(['replay_id', 'actor_user_id'])
      && JSON.stringify(fk.parent_columns) === JSON.stringify(['id', 'created_by_user_id'])), `${table} binds its actor to the exact Replay creator`);
  }
  // The frozen seam is still fail-closed: I-06A manufactures no launch readiness.
  assert.ok((await rt.functionPosture(SEAM)).prosrc.includes('NOT_EVALUATED'));
}

function manifestItemsOf(manifest) {
  return rows(`SELECT * FROM ${R.MANIFEST_ITEMS} WHERE manifest_version_id = $1 ORDER BY source_item_ordinal`, [manifest]);
}
function specItemsOf(spec) {
  return rows(`SELECT * FROM ${R.SPEC_ITEMS} WHERE selection_spec_version_id = $1 ORDER BY selected_ordinal`, [spec]);
}
const fresh = (extra = {}) => ({ command: randomUUID(), replay: randomUUID(), manifest: randomUUID(), selection: randomUUID(), ...extra });

async function verifyPersonal(f) {
  const before = await untouchedCounts();
  await actAs(f.mohamed);
  // P01 the owner creates a private Replay from OWNED committed text; P03 the
  // delivered QANDEEL text is an original source event inside the owner's Replay.
  const spec = fresh({ sourceClass: 'MY_WORLD', context: f.session, items: [f.assistantUnit, f.userUnit], coverage: 'FULL_SOURCE' });
  const [created] = await rt.createDraft(spec);
  assert.equal(created.outcome, 'REPLAY_DRAFT_CREATED');
  assert.equal(created.committed_replay_id, spec.replay);
  assert.equal(created.replay_lifecycle, 'DRAFT');
  assert.equal(Number(created.resulting_draft_revision), 1);
  assert.equal(created.resolved_coverage_class, 'FULL_SOURCE');
  assert.equal(created.captured_item_count, 2);
  assert.equal(created.resolved_source_contiguous, true);
  const [replay] = await rows(`SELECT * FROM ${R.REPLAYS} WHERE id = $1`, [spec.replay]);
  assert.equal(replay.created_by_user_id, f.mohamed, 'P24 the creator is the session human, derived');
  assert.equal(replay.current_lifecycle, 'DRAFT');
  const [manifest] = await rows(`SELECT * FROM ${R.MANIFESTS} WHERE id = $1`, [spec.manifest]);
  assert.equal(manifest.source_class, 'MY_WORLD');
  assert.equal(manifest.creation_authority_basis, 'PERSONAL_SOURCE_OWNERSHIP');
  assert.equal(manifest.personal_session_id, f.session);
  assert.equal(manifest.personal_owner_user_id, f.mohamed);
  assert.equal(manifest.personal_frontier_session_position, 2, 'the captured frontier is the Session Position, never a clock');
  assert.equal(manifest.item_count, 2); assert.equal(manifest.authorized_universe_item_count, 2); assert.equal(manifest.universe_complete, true);
  const items = await manifestItemsOf(spec.manifest);
  assert.deepEqual(items.map((i) => [i.source_item_ordinal, i.source_universe_rank, i.personal_conversation_unit_id, i.personal_session_position, i.personal_source_role, i.original_medium]),
    [[1, 1, f.userUnit, 1, 'USER', 'ORIGINAL_TEXT'], [2, 2, f.assistantUnit, 2, 'ASSISTANT', 'ORIGINAL_TEXT']],
    'P01 items in canonical Session Position order with the frozen anchors, whatever order the caller supplied');
  assert.equal(items[0].captured_source_digest, await digestOf(f.userText), 'the digest is of the exact committed bytes');
  assert.equal(items[1].captured_source_digest, await digestOf(f.assistantText));
  for (const i of items) {
    assert.equal(i.shared_material_id, null); assert.equal(i.public_package_item_id, null);
    assert.equal(i.source_class, 'MY_WORLD');
  }
  // P04 no Personal audio is fabricated.
  assert.equal(await count(R.MANIFEST_ITEMS, "source_class = 'MY_WORLD' AND original_medium <> 'ORIGINAL_TEXT'", []), 0, 'P04 no Personal item is audio');
  const [state] = await rows(`SELECT * FROM ${R.DRAFT_STATE} WHERE replay_id = $1`, [spec.replay]);
  assert.equal(state.current_source_manifest_version_id, spec.manifest);
  assert.equal(state.current_selection_spec_version_id, spec.selection);
  assert.equal(Number(state.draft_revision), 1);
  const specItems = await specItemsOf(spec.selection);
  assert.deepEqual(specItems.map((i) => [i.selected_ordinal, i.source_item_ordinal, i.anchor_kind]), [[1, 1, 'WHOLE_ITEM'], [2, 2, 'WHOLE_ITEM']]);
  // THE CREATOR-EXACT READ BOUNDARY.
  const [composed] = await rt.composition(spec.replay, f.mohamed);
  assert.equal(composed.source_class, 'MY_WORLD'); assert.equal(composed.coverage_class, 'FULL_SOURCE');
  assert.equal(composed.currency_state, 'CURRENT'); assert.equal(composed.selection_method, 'EXPLICIT_RESOLVED_ANCHORS');
  assert.equal(Number(composed.draft_revision), 1);
  assert.deepEqual(await rt.composition(spec.replay, f.hadir), [], 'nobody but the creator reads a composition');
  assert.deepEqual(await rt.composition(randomUUID(), f.mohamed), [], 'and a guessed identifier reads nothing');
  await rejected(() => rt.composition(spec.replay, null), ['22023']);
  // P14 / P29 nothing outside Replay changed: no World, membership, package, approval, control or source row.
  assert.deepEqual(await untouchedCounts(), before, 'P14 creation widens no audience and creates no World, membership, package or approval');

  // P02 ANOTHER HUMAN CANNOT CREATE FROM THIS PERSONAL SOURCE, and learns nothing.
  await actAs(f.hadir);
  const byHadir = await rejected(() => rt.createDraft(fresh({ sourceClass: 'MY_WORLD', context: f.session, items: [f.userUnit] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  const byGuess = await rejected(() => rt.createDraft(fresh({ sourceClass: 'MY_WORLD', context: randomUUID(), items: [randomUUID()] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(byHadir.message, byGuess.message, 'P02 another human and a nonexistent source are ONE class');
  await actAs(f.mohamed);
  const wrongSession = await rejected(() => rt.createDraft(fresh({ sourceClass: 'MY_WORLD', context: randomUUID(), items: [f.userUnit] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(wrongSession.message, byGuess.message);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'MY_WORLD', context: f.session, items: [f.userUnit, f.mohamedMaterial] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  // A Personal source takes no version; a Shared or Public identifier is not a Personal item.
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'MY_WORLD', context: f.session, version: randomUUID(), items: [f.userUnit] })), ['22023'], /REPLAY_COMMAND_INVALID/u);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'MATCHING', context: f.session, items: [f.userUnit] })), ['22023'], /REPLAY_COMMAND_INVALID/u);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'REPLAY_ARTIFACT', context: spec.replay, items: [spec.manifest] })), ['22023'], /REPLAY_COMMAND_INVALID/u);
  // P24 no authenticated human, no Replay.
  await actAs(null);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'MY_WORLD', context: f.session, items: [f.userUnit] })), ['42501'], /REPLAY_AUTHENTICATION_REQUIRED/u);
  await actAs(f.mohamed);
  assert.equal(await count(R.REPLAYS, 'created_by_user_id = $1', [f.hadir]), 0, 'P02 nothing was written for the refused humans');
  return { personal: spec, personalItems: items };
}

async function verifyShared(f) {
  await actAs(f.mohamed);
  const [{ n: visible }] = await rows('SELECT count(*) n FROM public.resolve_shared_world_history_visibility_v1($1, $2)', [f.world, f.mohamed]);
  assert.equal(Number(visible), 6, 'fixture: six visible items, the hidden one excluded');
  // S05 a participant creates from exact currently visible Shared text.
  const spec = fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.hadirMaterial, f.mohamedMaterial] });
  const [created] = await rt.createDraft(spec);
  assert.equal(created.outcome, 'REPLAY_DRAFT_CREATED');
  assert.equal(created.resolved_coverage_class, 'SELECTED_EXCERPT');
  const [manifest] = await rows(`SELECT * FROM ${R.MANIFESTS} WHERE id = $1`, [spec.manifest]);
  assert.equal(manifest.source_class, 'SHARED_WORLD'); assert.equal(manifest.creation_authority_basis, 'SHARED_HISTORY_VISIBILITY');
  assert.equal(manifest.shared_world_id, f.world); assert.equal(manifest.item_count, 2);
  assert.equal(manifest.authorized_universe_item_count, 6, 'the authorized universe is exactly the visible set');
  assert.equal(manifest.universe_complete, false);
  const items = await manifestItemsOf(spec.manifest);
  const truth = await rows(
    `SELECT m.id material, m.history_item_id item, m.material_kind kind, i.occurred_at at, i.availability_revision rev,
            'sha256:' || encode(sha256(convert_to(t.body_text, 'UTF8')), 'hex') digest
       FROM public.shared_world_materials m JOIN public.shared_world_history_items i ON i.id = m.history_item_id
       JOIN public.shared_world_text_material_bodies t ON t.material_id = m.id
      WHERE m.id = ANY($1::uuid[]) ORDER BY i.occurred_at, i.id`, [[f.hadirMaterial, f.mohamedMaterial]]);
  assert.deepEqual(items.map((i) => [i.shared_material_id, i.shared_history_item_id, i.shared_material_kind, i.captured_availability_state, Number(i.captured_availability_revision), i.captured_source_digest, i.original_medium]),
    truth.map((t) => [t.material, t.item, t.kind, 'AVAILABLE', Number(t.rev), t.digest, 'ORIGINAL_TEXT']),
    'S05 exact material, history item, kind, availability revision and body digest, in establishment order');
  assert.deepEqual(items.map((i) => i.shared_occurred_at), truth.map((t) => t.at), 'the anchor is the frozen establishment instant');
  for (const i of items) { assert.equal(i.personal_conversation_unit_id, null); assert.equal(i.public_package_item_id, null); }
  // S25 FULL_SOURCE is not provable for a partial universe; over the complete visible universe it is.
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.mohamedMaterial], coverage: 'FULL_SOURCE' })), ['22023'], /REPLAY_COVERAGE_NOT_PROVABLE/u);
  const everything = [f.mohamedMaterial, f.hadirMaterial, f.unresolvedMaterial, f.noHumanMaterial, f.voiceMaterial, f.metadatalessMaterial];
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: everything, selected: [f.mohamedMaterial], coverage: 'FULL_SOURCE' })), ['22023'], /REPLAY_COVERAGE_NOT_PROVABLE/u);
  const full = fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: everything, coverage: 'FULL_SOURCE' });
  const [fullCreated] = await rt.createDraft(full);
  assert.equal(fullCreated.resolved_coverage_class, 'FULL_SOURCE');
  assert.equal(fullCreated.captured_item_count, 6);
  // S09 THE VOICE NOTE binds as original-audio identity and copies no handle anywhere.
  const [voice] = await rows(`SELECT * FROM ${R.MANIFEST_ITEMS} WHERE manifest_version_id = $1 AND shared_material_id = $2`, [full.manifest, f.voiceMaterial]);
  assert.equal(voice.original_medium, 'ORIGINAL_AUDIO'); assert.equal(voice.shared_material_kind, 'HUMAN_VOICE_NOTE');
  const [{ expected }] = await rows(
    `SELECT 'sha256:' || encode(sha256(convert_to(v.audio_object_ref || E'\\n' || coalesce(v.transcript_text, ''), 'UTF8')), 'hex') expected
       FROM public.shared_world_voice_note_material_bodies v WHERE v.material_id = $1`, [f.voiceMaterial]);
  assert.equal(voice.captured_source_digest, expected, 'S09 the voice-note digest follows the frozen 0090 convention');
  for (const table of REPLAY_TABLES) {
    const [{ leaked }] = await rows(`SELECT count(*) leaked FROM ${table} t WHERE to_jsonb(t)::text LIKE '%opaque-media-object-ref%'`);
    assert.equal(Number(leaked), 0, `S09 ${table} carries no media handle`);
  }
  const [composedFull] = await rt.composition(full.replay, f.mohamed);
  assert.equal(composedFull.coverage_class, 'FULL_SOURCE');
  assert.ok(!JSON.stringify(composedFull).includes('opaque-media-object-ref') && !JSON.stringify(composedFull).includes(f.world), 'S09 the read boundary discloses no handle and no World');
  // A code-point range inside audio identity is not a selection.
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.voiceMaterial], starts: [0], ends: [3] })), ['22023'], /REPLAY_SELECTION_INVALID/u);

  // S06 CURRENT MEMBERSHIP IS NO SUBSTITUTE FOR EXACT VISIBILITY, S08 ONE CLASS.
  const hidden = await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.hiddenMaterial] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  const absent = await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [randomUUID()] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  const noWorld = await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: randomUUID(), items: [f.mohamedMaterial] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(hidden.message, absent.message, 'S08 a current member is told the same thing about hidden and nonexistent material');
  assert.equal(noWorld.message, absent.message);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.mohamedMaterial, f.hiddenMaterial] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  // A former member with no open episode sees nothing, even of material they own.
  await actAs(f.hadir);
  const former = await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.hadirMaterial] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(former.message, absent.message, 'S06 material authority is not browsing: a former member is refused like anyone else');
  await actAs(f.mohamed);
  // An Introduction World is refused through the same class, never a distinguishable mode error.
  const intro = randomUUID();
  await asRole('postgres');
  await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at) VALUES ($1, 'ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH', now())`, [intro]);
  await actAs(f.mohamed);
  const introRefusal = await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: intro, items: [f.mohamedMaterial] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(introRefusal.message, absent.message);

  // S07 A CLOSED-WORLD VIEWER FOLLOWS THE CANONICAL RESOLVER EXACTLY.
  await q('SAVEPOINT closed');
  await asRole('postgres');
  const [{ episode }] = await rows('SELECT id episode FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL', [f.world, f.mohamed]);
  const [{ item: entitledItem }] = await rows('SELECT history_item_id item FROM public.shared_world_materials WHERE id = $1', [f.mohamedMaterial]);
  await q(`UPDATE public.shared_world_membership_episodes SET ended_at = now(), end_reason = 'WORLD_CLOSED' WHERE world_id = $1 AND ended_at IS NULL`, [f.world]);
  await q(`UPDATE public.shared_worlds SET lifecycle = 'READ_ONLY_CLOSED', closed_at = now() WHERE id = $1`, [f.world]);
  await q('INSERT INTO public.shared_world_standard_closed_view_entitlements (world_id, user_id, membership_episode_id, entitled_at) VALUES ($1, $2, $3, now())', [f.world, f.mohamed, episode]);
  await q('INSERT INTO public.shared_world_standard_closed_view_entitlement_items (world_id, user_id, history_item_id) VALUES ($1, $2, $3)', [f.world, f.mohamed, entitledItem]);
  await actAs(f.mohamed);
  const closedSpec = fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.mohamedMaterial], coverage: 'FULL_SOURCE' });
  const [closedCreated] = await rt.createDraft(closedSpec);
  assert.equal(closedCreated.outcome, 'REPLAY_DRAFT_CREATED', 'S07 the entitled item is capturable from an archived World');
  assert.equal(closedCreated.resolved_coverage_class, 'FULL_SOURCE', 'S07 and the entitlement snapshot is the whole authorized universe');
  const outsideEntitlement = await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.hadirMaterial] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(outsideEntitlement.message, absent.message, 'S07 an item outside the frozen entitlement is unavailable, not distinguishable');
  await asRole('postgres');
  await q('ROLLBACK TO SAVEPOINT closed'); await q('RELEASE SAVEPOINT closed');
  await actAs(f.mohamed);

  // S10 A DELETED SOURCE CANNOT BE NEWLY CAPTURED, and an existing binding goes STALE.
  await actAs(f.hadir);
  const [deleted] = await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID());
  assert.equal(deleted.outcome, 'MATERIAL_DELETED');
  await actAs(f.mohamed);
  const gone = await rejected(() => rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.hadirMaterial] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(gone.message, absent.message, 'S10 a deleted source is unavailable, and its deletion is not disclosed by the class');
  const [stale] = await rt.currency(spec.manifest);
  assert.equal(stale.currency_state, 'STALE'); assert.equal(stale.staleness_class, 'SOURCE_UNAVAILABLE');
  const [composedStale] = await rt.composition(spec.replay, f.mohamed);
  assert.equal(composedStale.currency_state, 'STALE', 'S10 the creator sees the draft is stale');
  assert.ok(!Object.keys(composedStale).includes('staleness_class'), 'and not the internal cause');
  await rejected(() => rt.reviseDraft({ command: randomUUID(), replay: spec.replay, expectedRevision: 1, selection: randomUUID(), selected: [f.mohamedMaterial] }),
    ['40001'], /REPLAY_SOURCE_STALE/u);
  const [fullStale] = await rt.currency(full.manifest);
  assert.equal(fullStale.currency_state, 'STALE', 'S10 the six-item manifest that named the deleted source is stale too');
  // The immutable manifests were NOT rewritten to hide the loss.
  assert.equal(await count(R.MANIFEST_ITEMS, 'shared_material_id = $1', [f.hadirMaterial]), 2, 'S28 provenance identity survives deletion; content never lived here');
  assert.equal((await rt.currency(closedSpec.manifest).catch((e) => [{ currency_state: e.code }]))[0].currency_state, 'P0002',
    'a manifest that was rolled back with its savepoint no longer exists');
  return { shared: spec, full };
}

async function verifyPublic(f, seam) {
  const ready = await rt.bringToReady(f, { experience: f.experience, manifest: f.manifest, version: f.version, shared: [f.mohamedMaterial] });
  await asRole('postgres');
  const packageItems = await rows('SELECT package_item_id id, item_ordinal ordinal, public_body_digest digest, derivative_classification cls FROM public.publication_package_manifest_items WHERE manifest_version_id = $1 ORDER BY item_ordinal', [ready.manifest]);
  assert.equal(packageItems.length, 2, 'fixture: one Personal and one Shared item in the public package');
  const before = await untouchedCounts();
  await actAs(f.mohamed);
  // Q11 the controller creates from the eligible exact current version.
  const spec = fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: f.experience, version: ready.version, items: packageItems.map((i) => i.id).reverse(), coverage: 'FULL_SOURCE' });
  const [created] = await rt.createDraft(spec);
  assert.equal(created.outcome, 'REPLAY_DRAFT_CREATED'); assert.equal(created.resolved_coverage_class, 'FULL_SOURCE');
  const [manifest] = await rows(`SELECT * FROM ${R.MANIFESTS} WHERE id = $1`, [spec.manifest]);
  assert.equal(manifest.source_class, 'PUBLIC_EXPERIENCE'); assert.equal(manifest.creation_authority_basis, 'PUBLIC_EXPERIENCE_CONTROL');
  assert.equal(manifest.public_experience_id, f.experience); assert.equal(manifest.public_experience_version_id, ready.version);
  assert.equal(manifest.public_manifest_version_id, ready.manifest); assert.equal(manifest.authorized_universe_item_count, 2);
  const items = await manifestItemsOf(spec.manifest);
  assert.deepEqual(items.map((i) => [i.source_item_ordinal, i.public_package_item_id, i.public_item_ordinal, i.captured_source_digest, i.public_derivative_classification, i.original_medium]),
    packageItems.map((p) => [p.ordinal, p.id, p.ordinal, p.digest, p.cls, 'ORIGINAL_TEXT']), 'Q11 the bounded public items in package order with their public digests');
  // Q13 THE PUBLIC PATH BINDS THE DERIVATIVE, NEVER THE SEALED PROVENANCE BEHIND IT.
  for (const i of items) {
    assert.equal(i.personal_conversation_unit_id, null); assert.equal(i.shared_material_id, null); assert.equal(i.shared_world_id, null);
    assert.equal(i.shared_history_item_id, null); assert.equal(i.personal_session_id, null);
  }
  const [{ sealed }] = await rows(`SELECT count(*) sealed FROM ${T.PROVENANCE} WHERE manifest_version_id = $1 AND (personal_conversation_unit_id IS NOT NULL OR shared_material_id IS NOT NULL)`, [ready.manifest]);
  assert.equal(Number(sealed), 2, 'Q13 the sealed provenance DOES hold the private sources, and the Replay binding carries none of them');
  assert.deepEqual(await untouchedCounts(), before, 'Q14 creation from a Public Experience creates no package, approval, control or publication row');
  // Q12 AN ORDINARY VIEWER CANNOT REBUILD SOMEBODY ELSE'S EXPERIENCE.
  const other = randomUUID(); const otherVersion = randomUUID(); const otherManifest = randomUUID();
  const published = await rt.bringToPublished(f, { experience: other, manifest: otherManifest, version: otherVersion, personal: false, shared: [f.mohamedMaterial] }, seam);
  assert.equal((await rt.serving(other, f.reader)).length, 1, 'fixture: the reader is admitted and served the published Experience');
  const [{ id: servedItem }] = await rows('SELECT package_item_id id FROM public.publication_package_manifest_items WHERE manifest_version_id = $1', [otherManifest]);
  await actAs(f.reader);
  const byViewer = await rejected(() => rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: other, version: otherVersion, items: [servedItem] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  const byGuess = await rejected(() => rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: randomUUID(), version: otherVersion, items: [servedItem] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(byViewer.message, byGuess.message, 'Q12 a viewer is told exactly what a guesser is told');
  await actAs(f.hadir);
  const byRightsholder = await rejected(() => rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: other, version: otherVersion, items: [servedItem] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  assert.equal(byRightsholder.message, byGuess.message, 'Q12 content rights are not container control');
  await actAs(f.mohamed);
  const [fromPublished] = await rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: other, version: otherVersion, items: [servedItem] }));
  assert.equal(fromPublished.outcome, 'REPLAY_DRAFT_CREATED', 'Q11 the controller creates from a PUBLISHED version too');
  assert.equal((await rt.visibility(other))[0].visibility_state, 'PUBLICLY_VISIBLE', 'Q14 the Public Experience is exactly as visible as before');
  // Exactness: a version that is not current, a version of another Experience, no version.
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: f.experience, version: randomUUID(), items: [packageItems[0].id] })), ['40001'], /REPLAY_SOURCE_STALE/u);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: f.experience, version: otherVersion, items: [packageItems[0].id] })), ['40001'], /REPLAY_SOURCE_STALE/u);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: f.experience, items: [packageItems[0].id] })), ['22023'], /REPLAY_COMMAND_INVALID/u);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: f.experience, version: ready.version, items: [servedItem] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
  // A removed Experience is no longer an eligible version: fail closed.
  await q('SAVEPOINT absent');
  await rt.removeFromPublicWorld(randomUUID(), other, otherVersion);
  await rejected(() => rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: other, version: otherVersion, items: [servedItem] })), ['40001'], /REPLAY_SOURCE_STALE/u);
  const [absentCurrency] = await rt.currency(fromPublished.composed_manifest_version_id);
  assert.equal(absentCurrency.staleness_class, 'SOURCE_VERSION_NOT_CURRENT', 'Q23 an existing binding to a removed Experience is stale');
  await q('ROLLBACK TO SAVEPOINT absent'); await q('RELEASE SAVEPOINT absent');
  return { public: spec, ready, published };
}

async function verifyDraftLifecycle(f, state) {
  await actAs(f.mohamed);
  const spec = state.personal;
  // D15 / D16 THE COMPONENTS ARE IMMUTABLE FOR THE OWNER.
  await asRole('postgres');
  await rejected(() => q(`UPDATE ${R.MANIFESTS} SET item_count = 1 WHERE id = $1`, [spec.manifest]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${R.MANIFEST_ITEMS} WHERE manifest_version_id = $1`, [spec.manifest]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);
  await rejected(() => q(`UPDATE ${R.SPECS} SET coverage_class = 'SELECTED_EXCERPT' WHERE id = $1`, [spec.selection]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${R.SPEC_ITEMS} WHERE selection_spec_version_id = $1`, [spec.selection]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);
  await actAs(f.mohamed);
  const snapshotBefore = await rt.replaySnapshot(spec.replay);
  // D18 / D19 IDEMPOTENCY OF THE BIRTH.
  const [replayed] = await rt.createDraft(spec);
  assert.equal(replayed.outcome, 'ALREADY_COMMITTED');
  assert.equal(replayed.committed_replay_id, spec.replay); assert.equal(replayed.composed_manifest_version_id, spec.manifest);
  assert.deepEqual(await rt.replaySnapshot(spec.replay), snapshotBefore, 'D18 a retry writes nothing');
  await rejected(() => rt.createDraft({ ...spec, coverage: 'HIGHLIGHT_SELECTION' }), ['23505'], /REPLAY_COMMAND_ID_CONFLICT/u);
  await rejected(() => rt.createDraft({ ...spec, replay: randomUUID(), manifest: randomUUID(), selection: randomUUID() }), ['23505'], /REPLAY_COMMAND_ID_CONFLICT/u);
  await rejected(() => rt.createDraft({ ...fresh(), replay: spec.replay, sourceClass: 'MY_WORLD', context: f.session, items: [f.userUnit] }), ['23505'], /REPLAY_ID_CONFLICT/u);
  await rejected(() => rt.createDraft({ ...fresh(), manifest: spec.manifest, sourceClass: 'MY_WORLD', context: f.session, items: [f.userUnit] }), ['23505'], /REPLAY_ID_CONFLICT/u);
  await actAs(f.hadir);
  await rejected(() => rt.createDraft({ ...spec, sourceClass: 'SHARED_WORLD', context: f.world, items: [f.mohamedMaterial] }), ['23505'], /REPLAY_COMMAND_ID_CONFLICT/u);
  await actAs(f.mohamed);
  assert.deepEqual(await rt.replaySnapshot(spec.replay), snapshotBefore, 'D19 a conflicting reuse writes nothing');

  // D17 A REVISION CREATES NEW VERSIONS AND ADVANCES ONLY THE POINTER.
  const revision = { command: randomUUID(), replay: spec.replay, expectedRevision: 1, selection: randomUUID(), selected: [f.assistantUnit], coverage: 'HIGHLIGHT_SELECTION' };
  // D25 FULL_SOURCE cannot be claimed for a partial selection or a range.
  await rejected(() => rt.reviseDraft({ ...revision, coverage: 'FULL_SOURCE' }), ['22023'], /REPLAY_COVERAGE_NOT_PROVABLE/u);
  await rejected(() => rt.reviseDraft({ ...revision, selected: [f.userUnit, f.assistantUnit], starts: [0, null], ends: [3, null], coverage: 'FULL_SOURCE' }), ['22023'], /REPLAY_COVERAGE_NOT_PROVABLE/u);
  // D27 NOTHING OUTSIDE THE AUTHORIZED UNIVERSE IS A SELECTION: a fabricated or foreign identity is refused.
  await rejected(() => rt.reviseDraft({ ...revision, selected: [randomUUID()] }), ['22023'], /REPLAY_SELECTION_INVALID/u);
  await rejected(() => rt.reviseDraft({ ...revision, selected: [f.mohamedMaterial] }), ['22023'], /REPLAY_SELECTION_INVALID/u);
  await rejected(() => rt.reviseDraft({ ...revision, selected: [f.userUnit, f.userUnit] }), ['22023'], /REPLAY_SELECTION_INVALID/u);
  await rejected(() => rt.reviseDraft({ ...revision, selected: [f.userUnit], starts: [0], ends: [999] }), ['22023'], /REPLAY_SELECTION_INVALID/u);
  await rejected(() => rt.reviseDraft({ ...revision, selected: [f.userUnit], starts: [5], ends: [5] }), ['22023'], /REPLAY_SELECTION_INVALID/u);
  await rejected(() => rt.reviseDraft({ ...revision, selected: [f.userUnit], starts: [0], ends: [null] }), ['22023'], /REPLAY_SELECTION_INVALID/u);
  await rejected(() => rt.reviseDraft({ ...revision, selected: [] }), ['22023'], /REPLAY_SELECTION_INVALID/u);
  await rejected(() => rt.reviseDraft({ ...revision, expectedRevision: 2 }), ['40001'], /REPLAY_DRAFT_STALE/u);
  await rejected(() => rt.reviseDraft({ ...revision, selection: spec.selection }), ['23505'], /REPLAY_ID_CONFLICT/u);
  await rejected(() => rt.reviseDraft({ ...revision, context: f.session }), ['22023'], /REPLAY_COMMAND_INVALID/u);
  assert.equal(Number((await rows(`SELECT draft_revision r FROM ${R.DRAFT_STATE} WHERE replay_id = $1`, [spec.replay]))[0].r), 1, 'every refusal left the pointer where it was');
  const [revised] = await rt.reviseDraft(revision);
  assert.equal(revised.outcome, 'REPLAY_DRAFT_REVISED');
  assert.equal(Number(revised.resulting_draft_revision), 2);
  assert.equal(revised.composed_manifest_version_id, spec.manifest, 'D17 the manifest is unchanged when only the selection changes');
  assert.equal(revised.composed_selection_spec_version_id, revision.selection);
  assert.equal(revised.resolved_coverage_class, 'HIGHLIGHT_SELECTION');
  const [stateAfter] = await rows(`SELECT * FROM ${R.DRAFT_STATE} WHERE replay_id = $1`, [spec.replay]);
  assert.equal(stateAfter.current_selection_spec_version_id, revision.selection); assert.equal(Number(stateAfter.draft_revision), 2);
  const [newSpec] = await rows(`SELECT * FROM ${R.SPECS} WHERE id = $1`, [revision.selection]);
  assert.equal(newSpec.selection_revision, 2); assert.equal(newSpec.selected_item_count, 1); assert.equal(newSpec.source_contiguous, true);
  // D28 the old components are exactly as they were.
  const after = await rt.replaySnapshot(spec.replay);
  assert.deepEqual(after.manifests, snapshotBefore.manifests); assert.deepEqual(after.items, snapshotBefore.items);
  assert.deepEqual(after.specs.slice(0, 1), snapshotBefore.specs); assert.deepEqual(after.specItems.slice(0, 2), snapshotBefore.specItems);
  assert.equal(after.specs.length, 2, 'D17 exactly one new selection version');
  // D18 / D19 for the revision command.
  const [revisionReplay] = await rt.reviseDraft(revision);
  assert.equal(revisionReplay.outcome, 'ALREADY_COMMITTED'); assert.equal(Number(revisionReplay.resulting_draft_revision), 2);
  await rejected(() => rt.reviseDraft({ ...revision, coverage: 'SELECTED_EXCERPT' }), ['23505'], /REPLAY_COMMAND_ID_CONFLICT/u);
  await rejected(() => rt.reviseDraft({ ...revision, replay: state.shared.replay }), ['23505'], /REPLAY_COMMAND_ID_CONFLICT/u);
  assert.deepEqual(await rt.replaySnapshot(spec.replay), after, 'D18 the retry and the conflict wrote nothing');

  // D26 THE CALLER CANNOT REVERSE CHRONOLOGY: the order is derived, whatever order arrives.
  const reversed = { command: randomUUID(), replay: spec.replay, expectedRevision: 2, selection: randomUUID(), selected: [f.assistantUnit, f.userUnit], starts: [null, 0], ends: [null, 3] };
  const [reordered] = await rt.reviseDraft(reversed);
  assert.equal(reordered.outcome, 'REPLAY_DRAFT_REVISED');
  assert.deepEqual((await specItemsOf(reversed.selection)).map((i) => [i.selected_ordinal, i.source_item_ordinal, i.anchor_kind, i.range_start, i.range_end]),
    [[1, 1, 'TEXT_CODE_POINT_RANGE', 0, 3], [2, 2, 'WHOLE_ITEM', null, null]], 'D26 canonical chronology, with the exact anchors the caller resolved');
  assert.equal((await rows(`SELECT source_contiguous c, coverage_class k FROM ${R.SPECS} WHERE id = $1`, [reversed.selection]))[0].c, true);
  // D17 A REVISION WITH A NEW SOURCE SET IS A NEW MANIFEST VERSION.
  const remanifest = { command: randomUUID(), replay: spec.replay, expectedRevision: 3, manifest: randomUUID(), selection: randomUUID(),
    sourceClass: 'MY_WORLD', context: f.session, items: [f.userUnit], selected: [f.userUnit] };
  await rejected(() => rt.reviseDraft({ ...remanifest, items: null }), ['22023'], /REPLAY_COMMAND_INVALID/u);
  await rejected(() => rt.reviseDraft({ ...remanifest, coverage: 'FULL_SOURCE' }), ['22023'], /REPLAY_COVERAGE_NOT_PROVABLE/u);
  const [remanifested] = await rt.reviseDraft(remanifest);
  assert.equal(remanifested.outcome, 'REPLAY_DRAFT_REVISED'); assert.equal(Number(remanifested.resulting_draft_revision), 4);
  assert.equal(remanifested.composed_manifest_version_id, remanifest.manifest);
  assert.equal((await rows(`SELECT manifest_revision r, universe_complete u FROM ${R.MANIFESTS} WHERE id = $1`, [remanifest.manifest]))[0].r, 2);
  assert.equal(await count(R.MANIFESTS, 'replay_id = $1', [spec.replay]), 2, 'D28 both manifest versions remain');
  assert.equal(await count(R.SPECS, 'replay_id = $1', [spec.replay]), 4);
  assert.deepEqual((await rt.replaySnapshot(spec.replay)).manifests[0], snapshotBefore.manifests[0], 'D28 the first manifest is byte-for-byte historical truth');
  // D24 A STRANGER CANNOT REVISE, and learns nothing; only a DRAFT is revised.
  await actAs(f.hadir);
  const stranger = await rejected(() => rt.reviseDraft({ command: randomUUID(), replay: spec.replay, expectedRevision: 4, selection: randomUUID(), selected: [f.userUnit] }), ['P0002'], /REPLAY_NOT_AVAILABLE/u);
  const missing = await rejected(() => rt.reviseDraft({ command: randomUUID(), replay: randomUUID(), expectedRevision: 4, selection: randomUUID(), selected: [f.userUnit] }), ['P0002'], /REPLAY_NOT_AVAILABLE/u);
  assert.equal(stranger.message, missing.message, 'D24 a stranger and a nonexistent Replay are ONE class');
  await actAs(null);
  await rejected(() => rt.reviseDraft({ command: randomUUID(), replay: spec.replay, expectedRevision: 4, selection: randomUUID(), selected: [f.userUnit] }), ['42501'], /REPLAY_AUTHENTICATION_REQUIRED/u);
  await asRole('postgres');
  await q('SAVEPOINT lifecycle');
  await q(`UPDATE ${R.REPLAYS} SET current_lifecycle = 'PREVIEW_READY' WHERE id = $1`, [spec.replay]);
  await actAs(f.mohamed);
  await rejected(() => rt.reviseDraft({ command: randomUUID(), replay: spec.replay, expectedRevision: 4, selection: randomUUID(), selected: [f.userUnit] }), ['55000'], /REPLAY_LIFECYCLE_INVALID/u);
  await asRole('postgres');
  await q('ROLLBACK TO SAVEPOINT lifecycle'); await q('RELEASE SAVEPOINT lifecycle');
  // D27 EVERY SELECTION EVER WRITTEN IS EXPLICIT RESOLVED ANCHORS.
  assert.equal(await count(R.SPECS, "selection_method <> 'EXPLICIT_RESOLVED_ANCHORS'", []), 0, 'D27 no natural-language result was ever persisted');
  // D30 EVERY APPLICATION ROLE IS REFUSED THE MUTATIONS AND THE DIRECT READS.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT acl');
    await asRole(role, f.mohamed);
    await rejected(() => rt.createDraft(fresh({ sourceClass: 'MY_WORLD', context: f.session, items: [f.userUnit] })), ['42501']);
    await rejected(() => rt.reviseDraft({ command: randomUUID(), replay: spec.replay, expectedRevision: 4, selection: randomUUID(), selected: [f.userUnit] }), ['42501']);
    await rejected(() => rt.currency(spec.manifest), ['42501']);
    for (const table of REPLAY_TABLES) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    if (role === 'service_role') {
      const [served] = await rt.composition(spec.replay, f.mohamed);
      assert.equal(served.replay_id, spec.replay, 'D30 the service tier reads the creator-exact composition on the creator\'s behalf');
      assert.deepEqual(await rt.composition(spec.replay, f.hadir), [], 'and nothing for anybody else');
    } else {
      await rejected(() => rt.composition(spec.replay, f.mohamed), ['42501']);
    }
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT acl'); await q('RELEASE SAVEPOINT acl');
  }
  await actAs(f.mohamed);
  return { revision: remanifest };
}

async function verifyForwardSafety(f, state) {
  const refuses = { name: 'AssertionError' };
  await q('SAVEPOINT forward_safety');
  try {
    await asRole('postgres');
    // A LEGITIMATE ADDITIVE FUTURE: the I-06B components and the first complete
    // REPLAY_VERSION, a PREVIEW_READY writer, an I-06C distribution package with
    // approvals and an export sanitizer, an I-06D source-loss record, a Public
    // Replay source adapter table, a CW2-08 wrapper that is itself grantable.
    await q(`CREATE TABLE public.i06b_probe_analytical_projection_versions (id uuid PRIMARY KEY, replay_id uuid NOT NULL REFERENCES ${R.REPLAYS} (id))`);
    await q(`CREATE TABLE public.i06b_probe_render_contract_versions (id uuid PRIMARY KEY, replay_id uuid NOT NULL REFERENCES ${R.REPLAYS} (id))`);
    await q(`CREATE TABLE public.i06b_probe_replay_versions (id uuid PRIMARY KEY, replay_id uuid NOT NULL REFERENCES ${R.REPLAYS} (id),
               source_manifest_version_id uuid NOT NULL REFERENCES ${R.MANIFESTS} (id), selection_spec_version_id uuid NOT NULL REFERENCES ${R.SPECS} (id),
               analytical_projection_version_id uuid NOT NULL REFERENCES public.i06b_probe_analytical_projection_versions (id),
               render_contract_version_id uuid NOT NULL REFERENCES public.i06b_probe_render_contract_versions (id))`);
    await q(`CREATE FUNCTION public.i06b_probe_commit_preview_ready_v1(p_replay_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.replays r SET current_lifecycle = 'PREVIEW_READY' WHERE r.id = p_replay_id; END$fn$`);
    await q('CREATE TABLE public.i06c_probe_distribution_package_versions (id uuid PRIMARY KEY, replay_version_id uuid NOT NULL REFERENCES public.i06b_probe_replay_versions (id))');
    await q('CREATE TABLE public.i06c_probe_distribution_approvals (id uuid PRIMARY KEY, package_version_id uuid NOT NULL REFERENCES public.i06c_probe_distribution_package_versions (id), approver_user_id uuid NOT NULL)');
    await q(`CREATE FUNCTION public.i06c_probe_export_sanitizer_v1(p_package_version_id uuid) RETURNS text LANGUAGE sql SET search_path='' AS $fn$ SELECT 'SANITIZED'::text $fn$`);
    await q(`CREATE TABLE public.i06d_probe_source_loss_records (manifest_version_id uuid PRIMARY KEY REFERENCES ${R.MANIFESTS} (id), noted_at timestamptz NOT NULL)`);
    await q(`ALTER TABLE ${R.CREATE_COMMANDS} ADD COLUMN i06_probe_client_ref text`);
    await q(`CREATE INDEX i06_probe_idx ON ${R.REVISION_COMMANDS} (committed_at)`);
    await q(`CREATE FUNCTION public.i06_probe_launch_gated_create_v1(p_command_id uuid, p_replay_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN PERFORM 1; END$fn$`);
    await q('GRANT EXECUTE ON FUNCTION public.i06_probe_launch_gated_create_v1(uuid, uuid) TO authenticated');
    await verifyCatalog();

    // F1 A CONSEQUENTIAL PRIMITIVE BECOMES APPLICATION-REACHABLE BEFORE THE LAUNCH GATE.
    await q('SAVEPOINT f1');
    await q(`GRANT EXECUTE ON FUNCTION ${FN.CREATE} TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses, 'F1 creation becoming application-reachable is a regression');
    await q('ROLLBACK TO SAVEPOINT f1'); await q('RELEASE SAVEPOINT f1');

    // F2 THE SHARED ADAPTER RE-DERIVES ACCESS FROM MEMBERSHIP instead of the canonical resolver.
    await q('SAVEPOINT f2');
    const capture = (await rows('SELECT pg_get_functiondef($1::regprocedure) def', [FN.CAPTURE]))[0].def;
    const mutant = capture.replace(
      'SELECT array_agg(v.history_item_id ORDER BY v.occurred_at, v.history_item_id) INTO visible\n        FROM public.resolve_shared_world_history_visibility_v1(p_source_context_id, u) v;',
      "SELECT array_agg(i.id ORDER BY i.occurred_at, i.id) INTO visible FROM public.shared_world_history_items i\n        WHERE i.world_id = p_source_context_id AND i.availability_state = 'AVAILABLE'\n          AND EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e WHERE e.world_id = i.world_id AND e.user_id = u AND e.ended_at IS NULL);");
    assert.notEqual(mutant, capture, 'F2 the mutation landed');
    await q(mutant);
    await assert.rejects(verifyCatalog(), refuses, 'F2 an adapter that re-derives Shared access from membership is a regression');
    await actAs(f.mohamed);
    const [leak] = await rt.createDraft(fresh({ sourceClass: 'SHARED_WORLD', context: f.world, items: [f.hiddenMaterial] }));
    assert.equal(leak.outcome, 'REPLAY_DRAFT_CREATED', 'F2 anti-vacuity: the mutant really lets a current member bind material they never saw');
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT f2'); await q('RELEASE SAVEPOINT f2');

    // F3 THE PUBLIC ADAPTER STOPS REQUIRING CONTROL, so a viewer can rebuild another's Experience.
    await q('SAVEPOINT f3');
    const noControl = capture.replace(
      'IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c\n                                  WHERE c.experience_id = p_source_context_id AND c.controller_user_id = u) THEN',
      'IF NOT FOUND THEN');
    assert.notEqual(noControl, capture);
    await q(noControl);
    await assert.rejects(verifyCatalog(), refuses, 'F3 a Public adapter without Experience control is a regression');
    const [{ id: servedItem }] = await rows('SELECT package_item_id id FROM public.publication_package_manifest_items WHERE manifest_version_id = $1', [state.published.manifest]);
    await actAs(f.reader);
    const [rebuilt] = await rt.createDraft(fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: state.published.experience, version: state.published.version, items: [servedItem] }));
    assert.equal(rebuilt.outcome, 'REPLAY_DRAFT_CREATED', 'F3 anti-vacuity: the mutant really lets a viewer rebuild somebody else\'s Experience');
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT f3'); await q('RELEASE SAVEPOINT f3');

    // F4 THE SELECTION CORE TAKES THE CALLER'S ORDER. The 0100 chronology guard
    // still refuses the reversed rows, so the structure holds even when the writer regresses.
    await q('SAVEPOINT f4');
    const selectCore = (await rows('SELECT pg_get_functiondef($1::regprocedure) def', [FN.SELECT]))[0].def;
    const callerOrder = selectCore.replace('(row_number() OVER (ORDER BY mi.source_item_ordinal))::integer,', '(row_number() OVER (ORDER BY s.ord))::integer,')
      .replace('FROM unnest(p_selected_source_item_ids, p_range_starts, p_range_ends) AS s(sid, rs, re)\n    JOIN public.replay_source_manifest_items mi',
        'FROM unnest(p_selected_source_item_ids, p_range_starts, p_range_ends) WITH ORDINALITY AS s(sid, rs, re, ord)\n    JOIN public.replay_source_manifest_items mi');
    assert.notEqual(callerOrder, selectCore);
    await q(callerOrder);
    await assert.rejects(verifyCatalog(), refuses, 'F4 a selection core that takes the caller\'s order is a regression');
    await actAs(f.mohamed);
    await rejected(() => rt.reviseDraft({ command: randomUUID(), replay: state.personal.replay, expectedRevision: 4, manifest: randomUUID(), selection: randomUUID(),
      sourceClass: 'MY_WORLD', context: f.session, items: [f.userUnit, f.assistantUnit], selected: [f.assistantUnit, f.userUnit] }), ['P0001'], /REPLAY_SELECTION_CHRONOLOGY_REVERSED/u);
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT f4'); await q('RELEASE SAVEPOINT f4');

    // F5 THE READ BOUNDARY ANSWERS EVERYBODY.
    await q('SAVEPOINT f5');
    const composition = (await rows('SELECT pg_get_functiondef($1::regprocedure) def', [FN.COMPOSITION]))[0].def;
    const anybody = composition.replace('WHERE r.id = p_replay_id AND r.created_by_user_id = p_user_id;', 'WHERE r.id = p_replay_id;');
    assert.notEqual(anybody, composition);
    await q(anybody);
    await assert.rejects(verifyCatalog(), refuses, 'F5 a composition resolver that answers a stranger is a regression');
    assert.equal((await rt.composition(state.personal.replay, f.hadir)).length, 1, 'F5 anti-vacuity: the mutant really answers a stranger');
    await q('ROLLBACK TO SAVEPOINT f5'); await q('RELEASE SAVEPOINT f5');

    // F6 A REVISION STOPS REVALIDATING SOURCE CURRENCY.
    await q('SAVEPOINT f6');
    const revise = (await rows('SELECT pg_get_functiondef($1::regprocedure) def', [FN.REVISE]))[0].def;
    const noCurrency = revise.replace("IF currency IS DISTINCT FROM 'CURRENT' THEN", 'IF false THEN');
    assert.notEqual(noCurrency, revise);
    await q(noCurrency);
    await assert.rejects(verifyCatalog(), refuses, 'F6 a revision that commits over a stale source is a regression');
    await actAs(f.mohamed);
    const [staleCommit] = await rt.reviseDraft({ command: randomUUID(), replay: state.shared.replay, expectedRevision: 1, selection: randomUUID(), selected: [f.mohamedMaterial] });
    assert.equal(staleCommit.outcome, 'REPLAY_DRAFT_REVISED', 'F6 anti-vacuity: the mutant really commits old prepared state over a deleted source');
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT f6'); await q('RELEASE SAVEPOINT f6');

    // F7 THE READ BOUNDARY GROWS A SOURCE IDENTITY COLUMN.
    await q('SAVEPOINT f7');
    await q(`DROP FUNCTION ${FN.COMPOSITION}`);
    await q(composition.replace('currency_state text,\n              updated_at timestamptz)', 'currency_state text,\n              updated_at timestamptz, shared_world_id uuid)')
      .replace('cur.currency_state, s.updated_at', 'cur.currency_state, s.updated_at, m.shared_world_id'));
    await q(`REVOKE ALL ON FUNCTION ${FN.COMPOSITION} FROM PUBLIC, anon, authenticated`);
    await q(`GRANT EXECUTE ON FUNCTION ${FN.COMPOSITION} TO service_role`);
    await assert.rejects(verifyCatalog(), refuses, 'F7 a read boundary that discloses a source World is a regression');
    await q('ROLLBACK TO SAVEPOINT f7'); await q('RELEASE SAVEPOINT f7');

    // F8 CREATION WRITES A LATER LIFECYCLE.
    await q('SAVEPOINT f8');
    const create = (await rows('SELECT pg_get_functiondef($1::regprocedure) def', [FN.CREATE]))[0].def;
    const preview = create.replace("VALUES (p_replay_id, u, 'DRAFT', instant);", "VALUES (p_replay_id, u, 'PREVIEW_READY', instant);");
    assert.notEqual(preview, create);
    await q(preview);
    await assert.rejects(verifyCatalog(), refuses, 'F8 a birth that skips DRAFT is a regression');
    await q('ROLLBACK TO SAVEPOINT f8'); await q('RELEASE SAVEPOINT f8');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

async function verifyConcurrency(c, seam) {
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    await asRole('postgres');
    const extraMaterial = randomUUID();
    await rt.commitMaterial(c.world, extraMaterial, 'HUMAN_TEXT', c.hadir, 'a second sentence Hadir wrote', 'EXACT_HUMAN_APPROVER_SET', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [c.hadir], c.mohamed);
    const draftExperience = randomUUID(); const v1 = randomUUID(); const m1 = randomUUID();
    await actAs(c.mohamed);
    await rt.createDraft({ command: randomUUID(), experience: draftExperience }).catch(() => undefined); // not a Replay call; placeholder guard
    await rt.createDraft; // eslint-disable-line no-unused-expressions
    await rows('SELECT * FROM public.create_public_experience_draft_v1($1, $2)', [randomUUID(), draftExperience]);
    const [prepared] = await rt.prepare(randomUUID(), draftExperience, m1, v1, NONE, NONE, [randomUUID()], [c.world], [c.mohamedMaterial]);
    assert.equal(prepared.outcome, 'PACKAGE_PREPARED');
    const [{ id: v1Item }] = await rows('SELECT package_item_id id FROM public.publication_package_manifest_items WHERE manifest_version_id = $1', [m1]);
    await asRole('postgres');

    // C18 DUPLICATE BIRTH FROM TWO CONNECTIONS: one Replay, one answer.
    console.log('0101 concurrency C18 start');
    const birth = fresh({ sourceClass: 'SHARED_WORLD', context: c.world, items: [c.mohamedMaterial] });
    await q('BEGIN'); await actAs(c.mohamed);
    const [first] = await rt.createDraft(birth);
    assert.equal(first.outcome, 'REPLAY_DRAFT_CREATED');
    await q2('BEGIN'); await actAs2(c.mohamed);
    const duplicate = q2('SELECT * FROM public.create_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9::uuid[], $10::integer[], $11::integer[], $12)',
      [birth.command, birth.replay, birth.manifest, birth.selection, 'SHARED_WORLD', c.world, null, birth.items, birth.items, [null], [null], 'SELECTED_EXCERPT']);
    assert.equal(await rt.stillPending(duplicate), true, 'C18 the duplicate blocks behind the first birth');
    await q('COMMIT');
    const [dup] = (await duplicate).rows;
    await q2('COMMIT');
    assert.equal(dup.outcome, 'ALREADY_COMMITTED', 'C18 the duplicate is served from the durable command');
    assert.equal(await count(R.REPLAYS, 'id = $1', [birth.replay]), 1);
    assert.equal(await count(R.CREATE_COMMANDS, 'replay_id = $1', [birth.replay]), 1);
    console.log('0101 concurrency C18 pass');

    // C20 COMPETING DRAFT REVISIONS: one winner, one stale loser.
    console.log('0101 concurrency C20 start');
    await q('BEGIN'); await actAs(c.mohamed);
    const [winner] = await rt.reviseDraft({ command: randomUUID(), replay: birth.replay, expectedRevision: 1, selection: randomUUID(), selected: [c.mohamedMaterial], coverage: 'HIGHLIGHT_SELECTION' });
    assert.equal(winner.outcome, 'REPLAY_DRAFT_REVISED');
    await q2('BEGIN'); await actAs2(c.mohamed);
    const loser = q2('SELECT * FROM public.revise_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[], $10::uuid[], $11::integer[], $12::integer[], $13)',
      [randomUUID(), birth.replay, 1, null, randomUUID(), null, null, null, null, [c.mohamedMaterial], [null], [null], 'SELECTED_EXCERPT']);
    assert.equal(await rt.stillPending(loser), true, 'C20 the competing revision blocks on the Replay row');
    await q('COMMIT');
    await assert.rejects(loser, (error) => error.code === '40001' && /REPLAY_DRAFT_STALE/u.test(error.message), 'C20 the loser is stale, never applied to whatever is current');
    await q2('ROLLBACK');
    assert.equal(Number((await rows(`SELECT draft_revision r FROM ${R.DRAFT_STATE} WHERE replay_id = $1`, [birth.replay]))[0].r), 2, 'C20 exactly one revision landed');
    assert.equal(await count(R.SPECS, 'replay_id = $1', [birth.replay]), 2);
    console.log('0101 concurrency C20 pass');

    // C21a A REVISION HOLDS THE SOURCE WHILE IT DECIDES: an owner deletion waits, then the draft is stale.
    console.log('0101 concurrency C21 start');
    const bound = fresh({ sourceClass: 'SHARED_WORLD', context: c.world, items: [extraMaterial, c.mohamedMaterial] });
    await actAs(c.mohamed);
    await rt.createDraft(bound);
    await q('BEGIN'); await actAs(c.mohamed);
    const [held] = await rt.reviseDraft({ command: randomUUID(), replay: bound.replay, expectedRevision: 1, selection: randomUUID(), selected: [extraMaterial] });
    assert.equal(held.outcome, 'REPLAY_DRAFT_REVISED');
    await q2('BEGIN'); await actAs2(c.hadir);
    const deleting = q2('SELECT * FROM public.delete_shared_world_owned_material_v1($1, $2, $3, $4)', [randomUUID(), c.world, extraMaterial, randomUUID()]);
    assert.equal(await rt.stillPending(deleting), true, 'C21 the owner deletion blocks behind the SHARE-locked source');
    await q('COMMIT');
    const [removed] = (await deleting).rows;
    await q2('COMMIT');
    assert.equal(removed.outcome, 'MATERIAL_DELETED', 'C21 the deletion proceeds once the revision released the source');
    assert.equal((await rt.currency(bound.manifest))[0].currency_state, 'STALE', 'C21 and the committed revision is now stale, never rewritten');
    await actAs(c.mohamed);
    await rejected(() => rt.reviseDraft({ command: randomUUID(), replay: bound.replay, expectedRevision: 2, selection: randomUUID(), selected: [c.mohamedMaterial] }), ['40001'], /REPLAY_SOURCE_STALE/u);
    // C21b THE REVERSE ORDER: a deletion in flight blocks a capture, which then refuses.
    const late = randomUUID();
    await asRole('postgres');
    await rt.commitMaterial(c.world, late, 'HUMAN_TEXT', c.hadir, 'a sentence deleted while a Replay reached for it', 'EXACT_HUMAN_APPROVER_SET', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [c.hadir], c.mohamed);
    await q('BEGIN'); await actAs(c.hadir);
    const [lateDeleted] = await rt.deleteMaterial(randomUUID(), c.world, late, randomUUID());
    assert.equal(lateDeleted.outcome, 'MATERIAL_DELETED');
    await q2('BEGIN'); await actAs2(c.mohamed);
    const lateBirth = fresh({ sourceClass: 'SHARED_WORLD', context: c.world, items: [late] });
    const capturing = q2('SELECT * FROM public.create_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9::uuid[], $10::integer[], $11::integer[], $12)',
      [lateBirth.command, lateBirth.replay, lateBirth.manifest, lateBirth.selection, 'SHARED_WORLD', c.world, null, [late], [late], [null], [null], 'SELECTED_EXCERPT']);
    assert.equal(await rt.stillPending(capturing), true, 'C21 the capture blocks behind the deletion holding the World');
    await q('COMMIT');
    await assert.rejects(capturing, (error) => error.code === 'P0002' && /REPLAY_SOURCE_NOT_AVAILABLE/u.test(error.message), 'C21 the deletion won, so old access never commits');
    await q2('ROLLBACK');
    assert.equal(await count(R.REPLAYS, 'id = $1', [lateBirth.replay]), 0, 'C21 nothing partial');
    console.log('0101 concurrency C21 pass');

    // C23 PUBLIC VERSION ELIGIBILITY CHANGES WHILE A CAPTURE WAITS.
    console.log('0101 concurrency C23 start');
    await q('BEGIN'); await actAs(c.mohamed);
    const [v2] = await rt.prepare(randomUUID(), draftExperience, randomUUID(), randomUUID(), NONE, NONE, [randomUUID()], [c.world], [c.mohamedMaterial]);
    assert.equal(v2.outcome, 'PACKAGE_PREPARED');
    await q2('BEGIN'); await actAs2(c.mohamed);
    const oldVersion = fresh({ sourceClass: 'PUBLIC_EXPERIENCE', context: draftExperience, version: v1, items: [v1Item] });
    const capturingOld = q2('SELECT * FROM public.create_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9::uuid[], $10::integer[], $11::integer[], $12)',
      [oldVersion.command, oldVersion.replay, oldVersion.manifest, oldVersion.selection, 'PUBLIC_EXPERIENCE', draftExperience, v1, [v1Item], [v1Item], [null], [null], 'SELECTED_EXCERPT']);
    assert.equal(await rt.stillPending(capturingOld), true, 'C23 the capture blocks behind the preparation holding the Experience');
    await q('COMMIT');
    await assert.rejects(capturingOld, (error) => error.code === '40001' && /REPLAY_SOURCE_STALE/u.test(error.message), 'C23 the superseded version cannot be captured as current');
    await q2('ROLLBACK');
    console.log('0101 concurrency C23 pass');

    // C22 SHARED ACCESS LOSS WHILE A CAPTURE WAITS: the leave holds the World row first.
    console.log('0101 concurrency C22 start');
    await asRole('postgres');
    await q('BEGIN');
    await q('SELECT 1 FROM public.shared_worlds WHERE id = $1 FOR UPDATE', [c.world]);
    await q(`UPDATE public.shared_world_membership_episodes SET ended_at = now(), end_reason = 'VOLUNTARY_LEAVE' WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`, [c.world, c.mohamed]);
    await q2('BEGIN'); await actAs2(c.mohamed);
    const leaving = fresh({ sourceClass: 'SHARED_WORLD', context: c.world, items: [c.mohamedMaterial] });
    const capturingAfterLeave = q2('SELECT * FROM public.create_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9::uuid[], $10::integer[], $11::integer[], $12)',
      [leaving.command, leaving.replay, leaving.manifest, leaving.selection, 'SHARED_WORLD', c.world, null, leaving.items, leaving.items, [null], [null], 'SELECTED_EXCERPT']);
    assert.equal(await rt.stillPending(capturingAfterLeave), true, 'C22 the capture blocks behind the topology change holding the World');
    await q('COMMIT');
    await assert.rejects(capturingAfterLeave, (error) => error.code === 'P0002' && /REPLAY_SOURCE_NOT_AVAILABLE/u.test(error.message), 'C22 lost access never commits as old access');
    await q2('ROLLBACK');
    assert.equal((await rt.currency(bound.manifest))[0].staleness_class, 'SOURCE_UNAVAILABLE', 'availability is reported before access');
    assert.equal((await rt.currency(birth.manifest))[0].staleness_class, 'SOURCE_ACCESS_LOST', 'C22 an existing binding to material the creator can no longer see is stale');
    console.log('0101 concurrency C22 pass');
  } finally {
    await close();
    await asRole('postgres');
    await rt.restorePrerequisites(seam);
  }
}

await runVerifier('0101', async (stage) => {
  await rt.client.connect();
  stage('catalog');
  await asRole('postgres');
  await verifyCatalog();
  const seam = await rt.captureSeam();

  const f = rt.newFixture();
  await q('BEGIN');
  try {
    stage('fixtures');
    await rt.provision(f);
    await rt.provisionIdentities(f);
    stage('personal source');
    const personal = await verifyPersonal(f);
    stage('shared source');
    const shared = await verifyShared(f);
    stage('public source');
    const pub = await verifyPublic(f, seam);
    stage('draft lifecycle');
    await verifyDraftLifecycle(f, { ...personal, ...shared, ...pub });
    stage('forward safety');
    await asRole('postgres');
    await verifyForwardSafety(f, { ...personal, ...shared, ...pub });
  } finally {
    await q('ROLLBACK');
  }
  assert.equal((await rt.functionPosture(SEAM)).prosrc, seam.prosrc, 'the production seam is intact after the rolled-back section');
  await verifyCatalog();

  stage('concurrency');
  const c = rt.newFixture();
  c.humans = [c.mohamed, c.hadir, c.stranger, c.reader];
  c.experiences = [];
  try {
    await asRole('postgres');
    await q('BEGIN');
    try {
      await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [c.humans]);
      await rt.provisionWorld(c, c.world);
      await rt.provisionIdentities(c);
      await asRole('postgres');
    } finally {
      await q('COMMIT');
    }
    await verifyConcurrency(c, seam);
  } finally {
    stage('concurrency: fixture removal');
    await rt.removeCommittedReplays(c.humans);
    const experiences = (await rows(`SELECT id FROM ${T.EXPERIENCES} e WHERE e.created_by_public_identity_ref IN
                                       (SELECT public_identity_ref FROM ${T.IDENTITIES} WHERE user_id = ANY($1::uuid[]))`, [c.humans])).map((r) => r.id);
    c.experiences = experiences;
    await rt.removeCommittedFixtures(c);
  }

  stage('fixture residue');
  await asRole('postgres');
  assert.equal((await rt.functionPosture(SEAM)).prosrc, seam.prosrc, 'the production seam is exactly what the migration installed');
  await verifyCatalog();
  const humans = [f.mohamed, f.hadir, f.stranger, f.reader, ...c.humans];
  const [{ n }] = await rows(
    `SELECT (SELECT count(*) FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${T.IDENTITIES} WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($2::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
    [humans, [f.world, c.world]]);
  assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
