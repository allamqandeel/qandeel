// Real-PostgreSQL verifier for migration 0100 - I-06A Replay Foundation:
// stable identity, immutable source manifest and selection-spec versions, and
// the creator-private draft composition pointer (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live rows written as the table owner (PART A has no writer), that:
//
//   catalog / posture
//     * every relation is postgres-owned, RLS-enabled with zero policies and
//       revoked from every application role; the four trigger functions return
//       trigger and are executable by nobody;
//     * a Replay is not a World and carries no distribution, Safety or Launch
//       state; no relation carries a content column or a JSON / binary payload;
//     * every foreign key is restrictive and none reaches a body relation, the
//       sealed Public provenance or a raw turn; the Public binding is ONE exact
//       version row; the Personal manifest binds its Session owner to the
//       exact Replay creator; completeness is GENERATED, never written;
//
//   structure proven by rows
//     * S01 identity: lifecycle vocabulary, creator binding, identity truth;
//     * S02 manifest: one exact context shape per class, class-pinned basis,
//       counts, the creator binding and the exact Public version binding;
//     * S03 items: one exact shape per class, no cross-class identifier, the
//       exact source bindings, the manifest-context binding, the medium rule;
//     * S04 every component relation is append-only for the OWNER;
//     * S05 a chronology reversal is unrepresentable; a gap is not a reversal;
//     * S06 FULL_SOURCE is unrepresentable unless the complete universe is
//       selected whole and contiguously;
//     * S07 the draft pointer moves forward exactly one revision and binds the
//       selection TO its manifest as one pair;
//     * S08 every application role is refused every direct read;
//
//   forward safety inside a rolled-back SAVEPOINT: the I-06B / I-06C / I-06D
//   additions leave the catalog proof passing, and eight deliberate weakenings
//   are each refused - several proven non-vacuous by the row the weakened shape
//   admits.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { APP_ROLES, FN, R, REPLAY_IMMUTABLE, createReplayRuntime, runVerifier } from './replay-verifier-support.mjs';

const rt = createReplayRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, rejected } = rt;

const OWN_TABLES = [R.REPLAYS, R.MANIFESTS, R.MANIFEST_ITEMS, R.SPECS, R.SPEC_ITEMS, R.DRAFT_STATE];
const COMPONENT_TABLES = [R.MANIFESTS, R.MANIFEST_ITEMS, R.SPECS, R.SPEC_ITEMS];
const WORLD_BAN = /(world_type|phase|birth_basis|member|episode|governance|proposal|approv|semantic|coordinate|embedding|placement|vitality|ranking)/u;
const DISTRIBUTION_BAN = /(public_flag|is_public|is_shared|shareable|share_flag|share_link|sharing|download|distribut|export|premium|safety|moderation|entitle|launch|clearance|feature_flag|allow|approver)/u;
const CONTENT_BAN = /(body|_text$|^text|transcript|audio_object|content|payload|blob|document|excerpt|snippet|caption|render|projection)/u;
const FORBIDDEN_PARENTS = ['public.publication_package_item_provenance', 'public.shared_world_text_material_bodies',
  'public.shared_world_voice_note_material_bodies', 'public.public_experience_text_derivative_bodies', 'public.conversation_turns'];
const DIGEST = `sha256:${'a'.repeat(64)}`;

async function columnsOf(table) {
  return rows(
    `SELECT a.attname name, ty.typname type, a.attgenerated generated
       FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
      WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [table]);
}
async function constraintDefinition(table, name) {
  const [c] = await rows(
    'SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2', [table, name]);
  assert.ok(c, `${table} carries ${name}`);
  return c.definition;
}

async function verifyCatalog() {
  await rt.verifyPosture({
    triggers: [FN.COMPONENT_TRIGGER, FN.IDENTITY_TRIGGER, FN.FORWARD_TRIGGER, FN.CHRONOLOGY_TRIGGER, FN.ONE_ROW_TRIGGER],
    tables: OWN_TABLES,
    immutable: REPLAY_IMMUTABLE,
  });
  // THE SAME-ROW GUARD IS INSTALLED AND ENABLED. The foreign keys prove each
  // parent exists; only this proves the columns came from ONE row.
  assert.equal(await rt.triggerEnabled(R.MANIFEST_ITEMS, 'replay_source_manifest_items_one_row'), true,
    'a manifest item proves its source columns describe one canonical row');
  const guard = (await rt.functionPosture(FN.ONE_ROW_TRIGGER)).prosrc;
  for (const pairing of ['cu.source_role = NEW.personal_source_role', 'm.history_item_id = NEW.shared_history_item_id',
    'h.occurred_at = NEW.shared_occurred_at', 'it.item_ordinal = NEW.public_item_ordinal',
    'it.derivative_classification = NEW.public_derivative_classification']) {
    assert.ok(guard.includes(pairing), `the same-row guard proves ${pairing}`);
  }
  assert.doesNotMatch(guard, /body_text|transcript_text|audio_object_ref|committed_text|public_text_body|provenance/u,
    'the same-row guard reads source identity and never source content');
  for (const table of OWN_TABLES) {
    const cols = await columnsOf(table);
    assert.ok(cols.length > 0, `${table} has columns`);
    for (const c of cols) {
      assert.equal(typeof c.name, 'string');
      assert.doesNotMatch(c.name, WORLD_BAN, `${table}.${c.name}: a Replay is never a World`);
      assert.doesNotMatch(c.name, DISTRIBUTION_BAN, `${table}.${c.name}: creation authority is not distribution authority`);
      assert.doesNotMatch(c.name, CONTENT_BAN, `${table}.${c.name}: a manifest is a binding, never a copy`);
      assert.ok(!['json', 'jsonb', 'bytea'].includes(c.type), `${table}.${c.name} is not a JSON or binary payload`);
    }
    const fks = await rows(
      `SELECT c.conname, c.confdeltype, c.confrelid::regclass::text parent, cardinality(c.confkey) width
         FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.contype = 'f'`, [table]);
    for (const fk of fks) {
      assert.equal(fk.confdeltype, 'r', `${table}.${fk.conname} is restrictive`);
    }
    const parents = await rows(
      `SELECT ns.nspname || '.' || cl.relname parent FROM pg_constraint c
         JOIN pg_class cl ON cl.oid = c.confrelid JOIN pg_namespace ns ON ns.oid = cl.relnamespace
        WHERE c.conrelid = $1::regclass AND c.contype = 'f'`, [table]);
    for (const p of parents) {
      assert.ok(!FORBIDDEN_PARENTS.includes(p.parent), `${table} binds ${p.parent}: no body relation, sealed provenance or raw turn is ever a Replay parent`);
    }
  }
  // THE EXACT BINDINGS.
  await rt.assertExactBinding(R.MANIFESTS, 'public.public_experience_versions',
    ['public_experience_version_id', 'public_experience_id', 'public_manifest_version_id'],
    ['id', 'experience_id', 'package_manifest_version_id']);
  // The manifest binds its Replay twice on purpose - the plain identity and, for a
  // Personal manifest, (replay, Session owner) onto (id, creator). Both include the
  // primary key, so they can never name two different Replays; what must exist is
  // the creator pair.
  assert.ok((await rt.foreignKeysInto(R.MANIFESTS, R.REPLAYS)).some((fk) => fk.confdeltype === 'r'
    && JSON.stringify(fk.local_columns) === JSON.stringify(['replay_id', 'personal_owner_user_id'])
    && JSON.stringify(fk.parent_columns) === JSON.stringify(['id', 'created_by_user_id'])),
  'a Personal manifest binds its Session owner to the exact Replay creator');
  await rt.assertExactBinding(R.MANIFESTS, 'public.conversation_sessions', ['personal_session_id', 'personal_owner_user_id'], ['id', 'user_id']);
  await rt.assertExactBinding(R.MANIFEST_ITEMS, 'public.shared_world_materials', ['shared_material_id', 'shared_world_id'], ['id', 'world_id']);
  await rt.assertExactBinding(R.MANIFEST_ITEMS, 'public.shared_world_history_items', ['shared_world_id', 'shared_history_item_id'], ['world_id', 'id']);
  await rt.assertExactBinding(R.MANIFEST_ITEMS, 'public.publication_package_manifest_items', ['public_manifest_version_id', 'public_package_item_id'], ['manifest_version_id', 'package_item_id']);
  assert.ok((await rt.foreignKeysInto(R.MANIFEST_ITEMS, 'public.conversation_units')).some((fk) =>
    JSON.stringify(fk.local_columns) === JSON.stringify(['personal_session_id', 'personal_session_position'])
    && JSON.stringify(fk.parent_columns) === JSON.stringify(['session_id', 'session_position'])),
  'a Personal item binds its canonical Session Position through the frozen 0065 key');
  for (const [column, context] of [['personal_session_id', 'personal_session_id'], ['shared_world_id', 'shared_world_id'], ['public_manifest_version_id', 'public_manifest_version_id']]) {
    assert.ok((await rt.foreignKeysInto(R.MANIFEST_ITEMS, R.MANIFESTS)).some((fk) =>
      JSON.stringify(fk.local_columns) === JSON.stringify(['manifest_version_id', column])
      && JSON.stringify(fk.parent_columns) === JSON.stringify(['id', context])),
    `an item names the exact ${context} of its own manifest, structurally`);
  }
  await rt.assertExactBinding(R.SPECS, R.MANIFESTS, ['source_manifest_version_id', 'manifest_universe_complete'], ['id', 'universe_complete']);
  await rt.assertExactBinding(R.DRAFT_STATE, R.SPECS, ['current_selection_spec_version_id', 'current_source_manifest_version_id'], ['id', 'source_manifest_version_id']);
  const [generated] = (await columnsOf(R.MANIFESTS)).filter((c) => c.name === 'universe_complete');
  assert.ok(generated, 'the manifest carries universe_complete');
  assert.equal(generated.generated, 's', 'completeness is GENERATED from the captured counts, never written');
  // VOCABULARIES AND THE FULL_SOURCE LAW.
  assert.match(await constraintDefinition(R.REPLAYS, 'replays_lifecycle_check'), /'DRAFT'.*'PREVIEW_READY'.*'FINALIZED'/su);
  assert.match(await constraintDefinition(R.SPECS, 'replay_selection_spec_versions_coverage_check'), /FULL_SOURCE.*SELECTED_EXCERPT.*HIGHLIGHT_SELECTION/su);
  assert.match(await constraintDefinition(R.MANIFEST_ITEMS, 'replay_source_manifest_items_medium_check'), /ORIGINAL_TEXT.*ORIGINAL_AUDIO.*MIXED/su);
  assert.match(await constraintDefinition(R.MANIFESTS, 'replay_source_manifest_versions_class_check'), /MY_WORLD.*SHARED_WORLD.*PUBLIC_EXPERIENCE/su);
  const full = await constraintDefinition(R.SPECS, 'replay_selection_spec_versions_full_source_check');
  for (const needle of ['manifest_universe_complete', 'selected_item_count = manifest_item_count', 'whole_item_count = selected_item_count', 'source_contiguous']) {
    assert.ok(full.includes(needle), `FULL_SOURCE requires ${needle}`);
  }
  for (const name of ['replay_source_manifest_versions_shape_check', 'replay_source_manifest_versions_basis_check']) await constraintDefinition(R.MANIFESTS, name);
  for (const name of ['replay_source_manifest_items_shape_check', 'replay_source_manifest_items_shared_kind_check', 'replay_source_manifest_items_shared_medium_check']) await constraintDefinition(R.MANIFEST_ITEMS, name);
  for (const [table, trigger] of [[R.REPLAYS, 'replays_identity_truth'], [R.DRAFT_STATE, 'replay_draft_state_forward_only'], [R.SPEC_ITEMS, 'replay_selection_spec_items_chronology']]) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} guards ${table}`);
  }
  // THE FROZEN TRUTHS THIS FOUNDATION BINDS.
  assert.equal(await rt.triggerEnabled('public.conversation_units', 'conversation_units_immutable'), true);
  assert.equal(await rt.triggerEnabled('public.shared_world_history_items', 'shared_world_history_item_immutable_truth'), true);
  assert.deepEqual(await rt.uniqueKeyColumns('public.public_experience_versions', 'public_experience_versions_exact_identity_key'),
    ['id', 'experience_id', 'package_manifest_version_id']);
}

/** A manifest row written as the owner; the class decides the context columns. */
async function insertManifest(m) {
  await q(`INSERT INTO ${R.MANIFESTS} (id, replay_id, manifest_revision, source_class, creation_authority_basis,
             personal_session_id, personal_owner_user_id, personal_frontier_session_position, shared_world_id,
             public_experience_id, public_experience_version_id, public_manifest_version_id,
             item_count, authorized_universe_item_count, captured_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, clock_timestamp())`,
  [m.id, m.replay, m.revision ?? 1, m.sourceClass, m.basis, m.session ?? null, m.owner ?? null, m.frontier ?? null,
    m.world ?? null, m.experience ?? null, m.version ?? null, m.packageManifest ?? null, m.items ?? 1, m.universe ?? 1]);
}
async function insertItem(i) {
  await q(`INSERT INTO ${R.MANIFEST_ITEMS} (manifest_version_id, source_item_ordinal, source_universe_rank, source_class,
             original_medium, captured_source_digest, personal_session_id, personal_conversation_unit_id,
             personal_session_position, personal_source_role, shared_world_id, shared_material_id,
             shared_history_item_id, shared_material_kind, shared_occurred_at, captured_availability_state,
             captured_availability_revision, public_manifest_version_id, public_package_item_id,
             public_item_ordinal, public_derivative_classification)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
  [i.manifest, i.ordinal, i.rank ?? i.ordinal, i.sourceClass, i.medium ?? 'ORIGINAL_TEXT', i.digest ?? DIGEST,
    i.session ?? null, i.unit ?? null, i.position ?? null, i.role ?? null,
    i.world ?? null, i.material ?? null, i.historyItem ?? null, i.kind ?? null, i.occurredAt ?? null,
    i.availability ?? null, i.revision ?? null, i.packageManifest ?? null, i.packageItem ?? null,
    i.publicOrdinal ?? null, i.classification ?? null]);
}
async function insertSpec(s) {
  await q(`INSERT INTO ${R.SPECS} (id, replay_id, source_manifest_version_id, manifest_universe_complete, selection_revision,
             selection_method, coverage_class, manifest_item_count, selected_item_count, whole_item_count,
             source_contiguous, created_at)
           VALUES ($1, $2, $3, $4, $5, 'EXPLICIT_RESOLVED_ANCHORS', $6, $7, $8, $9, $10, clock_timestamp())`,
  [s.id, s.replay, s.manifest, s.complete, s.revision ?? 1, s.coverage ?? 'SELECTED_EXCERPT', s.manifestItems, s.selected, s.whole ?? s.selected, s.contiguous ?? true]);
}
const insertSpecItem = (spec, manifest, source, selected, anchor = 'WHOLE_ITEM', start = null, end = null) =>
  q(`INSERT INTO ${R.SPEC_ITEMS} (selection_spec_version_id, source_manifest_version_id, source_item_ordinal, selected_ordinal, anchor_kind, range_start, range_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`, [spec, manifest, source, selected, anchor, start, end]);

async function verifyStructure(f) {
  const ready = await rt.bringToReady(f, { experience: f.experience, manifest: f.manifest, version: f.version });
  await asRole('postgres');
  const [{ material, historyItem, occurredAt }] = await rows(
    `SELECT m.id material, m.history_item_id "historyItem", i.occurred_at "occurredAt"
       FROM public.shared_world_materials m JOIN public.shared_world_history_items i ON i.id = m.history_item_id
      WHERE m.id = $1`, [f.mohamedMaterial]);
  // The ordinal and classification are READ from the exact package row rather
  // than assumed, because the same-row guard binds them to it.
  const packageRows = await rows(
    `SELECT package_item_id "packageItem", item_ordinal "publicOrdinal", derivative_classification classification
       FROM public.publication_package_manifest_items WHERE manifest_version_id = $1 ORDER BY item_ordinal`, [ready.manifest]);
  const [{ packageItem, publicOrdinal, classification }] = packageRows;

  // S01 THE STABLE IDENTITY.
  const replay = randomUUID();
  await rejected(() => q(`INSERT INTO ${R.REPLAYS} (id, created_by_user_id, current_lifecycle, created_at) VALUES ($1, $2, 'PUBLISHED', now())`, [randomUUID(), f.mohamed]),
    ['23514'], /replays_lifecycle_check/u);
  await rejected(() => q(`INSERT INTO ${R.REPLAYS} (id, created_by_user_id, current_lifecycle, created_at) VALUES ($1, $2, 'DRAFT', now())`, [randomUUID(), randomUUID()]),
    ['23503'], /replays_creator_fk/u);
  await q(`INSERT INTO ${R.REPLAYS} (id, created_by_user_id, current_lifecycle, created_at) VALUES ($1, $2, 'DRAFT', now())`, [replay, f.mohamed]);
  await rejected(() => q(`UPDATE ${R.REPLAYS} SET created_by_user_id = $2 WHERE id = $1`, [replay, f.hadir]), ['55000'], /REPLAY_IDENTITY_IS_IMMUTABLE/u);
  // A DIFFERENT instant, arithmetically: `now()` is the TRANSACTION timestamp and
  // would be byte-identical to the one this row was inserted with a moment ago,
  // so the trigger would see no change and the update would legitimately succeed.
  await rejected(() => q(`UPDATE ${R.REPLAYS} SET created_at = created_at + interval '1 second' WHERE id = $1`, [replay]),
    ['55000'], /REPLAY_IDENTITY_IS_IMMUTABLE/u);
  // The lifecycle is deliberately NOT frozen here: I-06B owns its transitions.
  await q('SAVEPOINT s01');
  await q(`UPDATE ${R.REPLAYS} SET current_lifecycle = 'PREVIEW_READY' WHERE id = $1`, [replay]);
  await q('ROLLBACK TO SAVEPOINT s01'); await q('RELEASE SAVEPOINT s01');

  // S02 THE MANIFEST: one exact context shape per class.
  const personal = { id: randomUUID(), replay, sourceClass: 'MY_WORLD', basis: 'PERSONAL_SOURCE_OWNERSHIP', session: f.session, owner: f.mohamed, frontier: 2, items: 1, universe: 2 };
  await rejected(() => insertManifest({ ...personal, id: randomUUID(), world: f.world }), ['23514'], /replay_source_manifest_versions_shape_check/u);
  await rejected(() => insertManifest({ ...personal, id: randomUUID(), basis: 'SHARED_HISTORY_VISIBILITY' }), ['23514'], /replay_source_manifest_versions_basis_check/u);
  await rejected(() => insertManifest({ ...personal, id: randomUUID(), items: 3, universe: 2 }), ['23514'], /replay_source_manifest_versions_count_check/u);
  // ANOTHER HUMAN'S SESSION IS UNREPRESENTABLE IN THIS REPLAY: the Session owner
  // must be the Replay creator, structurally.
  await rejected(() => insertManifest({ ...personal, id: randomUUID(), owner: f.hadir }), ['23503'], /replay_source_manifest_versions_personal_(creator|session)_fk/u);
  await insertManifest(personal);
  const shared = { id: randomUUID(), replay, revision: 2, sourceClass: 'SHARED_WORLD', basis: 'SHARED_HISTORY_VISIBILITY', world: f.world, items: 1, universe: 3 };
  await rejected(() => insertManifest({ ...shared, id: randomUUID(), session: f.session, owner: f.mohamed, frontier: 1 }), ['23514'], /replay_source_manifest_versions_shape_check/u);
  await rejected(() => insertManifest({ ...shared, id: randomUUID(), world: randomUUID() }), ['23503'], /replay_source_manifest_versions_shared_world_fk/u);
  await insertManifest(shared);
  const pub = { id: randomUUID(), replay, revision: 3, sourceClass: 'PUBLIC_EXPERIENCE', basis: 'PUBLIC_EXPERIENCE_CONTROL', experience: f.experience, version: ready.version, packageManifest: ready.manifest, items: 1, universe: 1 };
  // THE PUBLIC BINDING IS ONE EXACT VERSION ROW: version V beside another manifest is unrepresentable.
  await rejected(() => insertManifest({ ...pub, id: randomUUID(), packageManifest: randomUUID() }), ['23503'], /replay_source_manifest_versions_public_version_fk/u);
  await rejected(() => insertManifest({ ...pub, id: randomUUID(), experience: randomUUID() }), ['23503'], /replay_source_manifest_versions_public_version_fk/u);
  await insertManifest(pub);
  const [{ complete }] = await rows(`SELECT universe_complete complete FROM ${R.MANIFESTS} WHERE id = $1`, [pub.id]);
  assert.equal(complete, true, 'completeness is generated from the captured counts');
  assert.equal((await rows(`SELECT universe_complete complete FROM ${R.MANIFESTS} WHERE id = $1`, [personal.id]))[0].complete, false);
  await rejected(() => q(`UPDATE ${R.MANIFESTS} SET universe_complete = true WHERE id = $1`, [personal.id]), ['428C9', '55000']);

  // S03 THE ITEMS: one exact shape per class, exact source bindings.
  const pItem = { manifest: personal.id, ordinal: 1, rank: 1, sourceClass: 'MY_WORLD', session: f.session, unit: f.userUnit, position: 1, role: 'USER' };
  await rejected(() => insertItem({ ...pItem, material: f.mohamedMaterial }), ['23514'], /replay_source_manifest_items_shape_check/u);
  await rejected(() => insertItem({ ...pItem, medium: 'ORIGINAL_AUDIO' }), ['23514'], /replay_source_manifest_items_shape_check/u);
  await rejected(() => insertItem({ ...pItem, digest: 'md5:abc' }), ['23514'], /replay_source_manifest_items_digest_check/u);
  await rejected(() => insertItem({ ...pItem, unit: randomUUID() }), ['23503'], /replay_source_manifest_items_personal_unit_fk/u);
  await rejected(() => insertItem({ ...pItem, position: 99 }), ['23503'], /replay_source_manifest_items_personal_position_fk/u);
  await rejected(() => insertItem({ ...pItem, session: randomUUID() }), ['23503'], /replay_source_manifest_items_personal_(context|position)_fk/u);
  await insertItem(pItem);
  const sItem = { manifest: shared.id, ordinal: 1, rank: 2, sourceClass: 'SHARED_WORLD', world: f.world, material, historyItem, kind: 'HUMAN_TEXT', occurredAt, availability: 'AVAILABLE', revision: 1 };
  await rejected(() => insertItem({ ...sItem, unit: f.userUnit }), ['23514'], /replay_source_manifest_items_shape_check/u);
  await rejected(() => insertItem({ ...sItem, kind: 'EXPLICIT_DISCLOSURE' }), ['23514'], /replay_source_manifest_items_shared_kind_check/u);
  await rejected(() => insertItem({ ...sItem, kind: 'HUMAN_VOICE_NOTE' }), ['23514'], /replay_source_manifest_items_shared_medium_check/u);
  await rejected(() => insertItem({ ...sItem, medium: 'ORIGINAL_AUDIO' }), ['23514'], /replay_source_manifest_items_shared_medium_check/u);
  await rejected(() => insertItem({ ...sItem, world: randomUUID() }), ['23503'], /replay_source_manifest_items_shared_(context|material|history)_fk/u);
  await rejected(() => insertItem({ ...sItem, material: randomUUID() }), ['23503'], /replay_source_manifest_items_shared_material_fk/u);
  await rejected(() => insertItem({ ...sItem, historyItem: randomUUID() }), ['23503'], /replay_source_manifest_items_shared_history_fk/u);
  await insertItem(sItem);
  const qItem = { manifest: pub.id, ordinal: 1, rank: 1, sourceClass: 'PUBLIC_EXPERIENCE', packageManifest: ready.manifest, packageItem, publicOrdinal, classification };
  await rejected(() => insertItem({ ...qItem, world: f.world }), ['23514'], /replay_source_manifest_items_shape_check/u);
  await rejected(() => insertItem({ ...qItem, packageItem: randomUUID() }), ['23503'], /replay_source_manifest_items_public_item_fk/u);
  await rejected(() => insertItem({ ...qItem, packageManifest: randomUUID() }), ['23503'], /replay_source_manifest_items_public_(context|item)_fk/u);
  await insertItem(qItem);
  // A second item at the same ordinal or rank, or the same source twice, is
  // refused. The unit carries its OWN role, or the same-row guard answers first.
  await rejected(() => insertItem({ ...pItem, unit: f.assistantUnit, position: 2, role: 'ASSISTANT', rank: 2 }), ['23505']);
  await rejected(() => insertItem({ ...pItem, ordinal: 2 }), ['23505']);

  // S09 EXACT SAME-ROW SOURCE IDENTITY.
  //
  // Every row named below EXISTS and every foreign key is satisfied: what is
  // refused is describing a source event out of the parts of two real ones.
  // These pairings are exactly what independent foreign keys cannot express,
  // and each class gets its own manifest because a manifest carries ONE context.
  const pairPersonal = { ...personal, id: randomUUID(), revision: 5 };
  const pairShared = { ...shared, id: randomUUID(), revision: 6 };
  const pairPublic = { ...pub, id: randomUUID(), revision: 7 };
  for (const m of [pairPersonal, pairShared, pairPublic]) await insertManifest(m);
  const pPair = { ...pItem, manifest: pairPersonal.id };
  const sPair = { ...sItem, manifest: pairShared.id };
  const qPair = { ...qItem, manifest: pairPublic.id };

  // Committed unit A beside committed unit B's Session Position, same Session.
  await rejected(() => insertItem({ ...pPair, unit: f.userUnit, position: 2, role: 'ASSISTANT' }),
    ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  await rejected(() => insertItem({ ...pPair, unit: f.assistantUnit, position: 1, role: 'USER' }),
    ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  // And one unit wearing another unit's role.
  await rejected(() => insertItem({ ...pPair, unit: f.userUnit, position: 1, role: 'ASSISTANT' }),
    ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  // The well-formed row is accepted, so the refusals above are not vacuous.
  await insertItem(pPair);

  // Shared material M1 beside material M2's history item, in the SAME World.
  const [other] = await rows(
    `SELECT m.id material, m.history_item_id "historyItem", i.occurred_at "occurredAt"
       FROM public.shared_world_materials m JOIN public.shared_world_history_items i ON i.id = m.history_item_id
      WHERE m.world_id = $1 AND m.id <> $2 ORDER BY i.occurred_at LIMIT 1`, [f.world, material]);
  assert.ok(other, 'fixture: the World carries a second material for the cross-pair proof');
  await rejected(() => insertItem({ ...sPair, historyItem: other.historyItem, occurredAt: other.occurredAt }),
    ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  await rejected(() => insertItem({ ...sPair, material: other.material }),
    ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  // The captured instant must be the named history item's own frozen instant.
  await rejected(() => insertItem({ ...sPair, occurredAt: other.occurredAt }),
    ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  await insertItem(sPair);

  // Public package item P1 wearing package item P2's ordinal or classification.
  if (packageRows.length > 1) {
    await rejected(() => insertItem({ ...qPair, publicOrdinal: packageRows[1].publicOrdinal }),
      ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  }
  await rejected(() => insertItem({ ...qPair, publicOrdinal: publicOrdinal + 100 }),
    ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  await rejected(() => insertItem({
    ...qPair,
    classification: classification === 'ANALYTICAL_DERIVATIVE' ? 'SOURCE_CONTENT_BEARING_DERIVATIVE' : 'ANALYTICAL_DERIVATIVE',
  }), ['P0001'], /REPLAY_SOURCE_BINDING_NOT_ONE_ROW/u);
  await insertItem(qPair);

  // AND THE GUARD NEVER PREEMPTS A FOREIGN KEY: a parent that does not exist is
  // still answered by the exact key that owns it - proven by the 23503 refusals
  // in S03 above, which the guard leaves reachable by acting only once both
  // compared parents exist.

  // S04 EVERY COMPONENT RELATION IS APPEND-ONLY FOR THE OWNER.
  await rejected(() => q(`UPDATE ${R.MANIFESTS} SET item_count = 2 WHERE id = $1`, [personal.id]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${R.MANIFESTS} WHERE id = $1`, [personal.id]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);
  await rejected(() => q(`UPDATE ${R.MANIFEST_ITEMS} SET captured_source_digest = $2 WHERE manifest_version_id = $1`, [personal.id, `sha256:${'b'.repeat(64)}`]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${R.MANIFEST_ITEMS} WHERE manifest_version_id = $1`, [personal.id]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);

  // S06 FULL_SOURCE IS UNREPRESENTABLE UNLESS PROVEN, S05 CHRONOLOGY.
  const spec = randomUUID();
  await rejected(() => insertSpec({ id: randomUUID(), replay, manifest: personal.id, complete: true, coverage: 'FULL_SOURCE', manifestItems: 1, selected: 1 }),
    ['23503'], /replay_selection_spec_versions_complete_fk/u);
  await rejected(() => insertSpec({ id: randomUUID(), replay, manifest: personal.id, complete: false, coverage: 'FULL_SOURCE', manifestItems: 1, selected: 1 }),
    ['23514'], /replay_selection_spec_versions_full_source_check/u);
  await rejected(() => insertSpec({ id: randomUUID(), replay, manifest: pub.id, complete: true, coverage: 'FULL_SOURCE', manifestItems: 2, selected: 1 }),
    ['23514'], /replay_selection_spec_versions_full_source_check/u);
  await rejected(() => insertSpec({ id: randomUUID(), replay, manifest: pub.id, complete: true, coverage: 'FULL_SOURCE', manifestItems: 1, selected: 1, whole: 0 }),
    ['23514'], /replay_selection_spec_versions_full_source_check/u);
  await rejected(() => insertSpec({ id: randomUUID(), replay, manifest: pub.id, complete: true, coverage: 'FULL_SOURCE', manifestItems: 1, selected: 1, contiguous: false }),
    ['23514'], /replay_selection_spec_versions_full_source_check/u);
  await rejected(() => insertSpec({ id: randomUUID(), replay: randomUUID(), manifest: pub.id, complete: true, manifestItems: 1, selected: 1 }),
    ['23503'], /replay_selection_spec_versions_manifest_fk/u);
  await rejected(() => insertSpec({ id: randomUUID(), replay, manifest: pub.id, complete: true, coverage: 'COMPLETE', manifestItems: 1, selected: 1 }),
    ['23514'], /replay_selection_spec_versions_coverage_check/u);
  await insertSpec({ id: spec, replay, manifest: pub.id, complete: true, coverage: 'FULL_SOURCE', manifestItems: 1, selected: 1 });
  // A wider manifest for the chronology proof: three Personal items.
  const wide = { ...personal, id: randomUUID(), revision: 4, items: 2, universe: 2 };
  await insertManifest(wide);
  await insertItem({ ...pItem, manifest: wide.id, ordinal: 1, rank: 1 });
  await insertItem({ ...pItem, manifest: wide.id, ordinal: 2, rank: 2, unit: f.assistantUnit, position: 2, role: 'ASSISTANT' });
  const wideSpec = randomUUID();
  await insertSpec({ id: wideSpec, replay, manifest: wide.id, complete: true, revision: 2, manifestItems: 2, selected: 2 });
  await insertSpecItem(wideSpec, wide.id, 2, 1);
  // The later source item is already first; an earlier source item can never follow it.
  await rejected(() => insertSpecItem(wideSpec, wide.id, 1, 2), ['P0001'], /REPLAY_SELECTION_CHRONOLOGY_REVERSED/u);
  // The BEFORE trigger fires ahead of the primary key, so a same-ordinal row that
  // also disagrees with chronology is refused by whichever guard speaks first.
  await rejected(() => insertSpecItem(wideSpec, wide.id, 1, 1), ['P0001', '23505']);
  await rejected(() => insertSpecItem(wideSpec, wide.id, 3, 3), ['23503'], /replay_selection_spec_items_manifest_item_fk/u);
  // Shape probes over a spec with no rows yet, so the chronology guard has nothing to say.
  const probeSpec = randomUUID();
  await insertSpec({ id: probeSpec, replay, manifest: wide.id, complete: true, revision: 3, manifestItems: 2, selected: 1, contiguous: false });
  await rejected(() => insertSpecItem(probeSpec, personal.id, 1, 1), ['23503'], /replay_selection_spec_items_spec_fk/u);
  await rejected(() => insertSpecItem(probeSpec, wide.id, 1, 0), ['23514']);
  await rejected(() => insertSpecItem(probeSpec, wide.id, 1, 1, 'TEXT_CODE_POINT_RANGE', 3, 2), ['23514'], /replay_selection_spec_items_range_check/u);
  await rejected(() => insertSpecItem(probeSpec, wide.id, 1, 1, 'WHOLE_ITEM', 0, 2), ['23514'], /replay_selection_spec_items_range_check/u);
  await rejected(() => insertSpecItem(probeSpec, wide.id, 1, 1, 'AUDIO_RANGE', 0, 2), ['23514'], /replay_selection_spec_items_anchor_check/u);
  // A GAP is not a reversal: a range anchor inside one item, with the other item omitted, is legal.
  await insertSpecItem(probeSpec, wide.id, 1, 1, 'TEXT_CODE_POINT_RANGE', 0, 3);
  await rejected(() => q(`UPDATE ${R.SPEC_ITEMS} SET selected_ordinal = 5 WHERE selection_spec_version_id = $1`, [probeSpec]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);
  await rejected(() => q(`DELETE FROM ${R.SPECS} WHERE id = $1`, [probeSpec]), ['55000'], /REPLAY_COMPONENT_IS_IMMUTABLE/u);

  // S07 THE DRAFT POINTER.
  await rejected(() => q(`INSERT INTO ${R.DRAFT_STATE} (replay_id, current_source_manifest_version_id, current_selection_spec_version_id, draft_revision, updated_at)
                          VALUES ($1, $2, $3, 1, now())`, [replay, personal.id, spec]), ['23503'], /replay_draft_state_selection_fk/u);
  await q(`INSERT INTO ${R.DRAFT_STATE} (replay_id, current_source_manifest_version_id, current_selection_spec_version_id, draft_revision, updated_at)
           VALUES ($1, $2, $3, 1, now())`, [replay, pub.id, spec]);
  await rejected(() => q(`UPDATE ${R.DRAFT_STATE} SET draft_revision = 3 WHERE replay_id = $1`, [replay]), ['55000'], /REPLAY_DRAFT_REVISION_MUST_ADVANCE/u);
  await rejected(() => q(`UPDATE ${R.DRAFT_STATE} SET draft_revision = 1, current_source_manifest_version_id = $2, current_selection_spec_version_id = $3 WHERE replay_id = $1`,
    [replay, wide.id, wideSpec]), ['55000'], /REPLAY_DRAFT_REVISION_MUST_ADVANCE/u);
  await q(`UPDATE ${R.DRAFT_STATE} SET draft_revision = 2, current_source_manifest_version_id = $2, current_selection_spec_version_id = $3, updated_at = now() WHERE replay_id = $1`,
    [replay, wide.id, wideSpec]);
  assert.equal(Number((await rows(`SELECT draft_revision r FROM ${R.DRAFT_STATE} WHERE replay_id = $1`, [replay]))[0].r), 2);
  // Every old component survives exactly as written.
  assert.equal(await count(R.MANIFESTS, 'replay_id = $1', [replay]), 4, 'S07 every manifest version remains historical truth');
  assert.equal(await count(R.SPECS, 'replay_id = $1', [replay]), 3, 'S07 every selection version remains historical truth');

  // S08 EVERY APPLICATION ROLE IS REFUSED EVERY DIRECT READ.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT s08');
    await asRole(role, f.mohamed);
    for (const table of OWN_TABLES) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    await rejected(() => q(`INSERT INTO ${R.REPLAYS} (id, created_by_user_id, current_lifecycle, created_at) VALUES ($1, $2, 'DRAFT', now())`, [randomUUID(), f.mohamed]), ['42501']);
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT s08'); await q('RELEASE SAVEPOINT s08');
  }
  return { replay, personal, shared, pub, wide, spec };
}

async function verifyForwardSafety(f, state) {
  const refuses = { name: 'AssertionError' };
  await q('SAVEPOINT forward_safety');
  try {
    await asRole('postgres');
    // A LEGITIMATE ADDITIVE FUTURE: the I-06B projection and render contract, the
    // first complete REPLAY_VERSION binding all four components, a PREVIEW_READY
    // writer, an I-06C distribution package with approvals, an I-06D source-loss
    // record, a CW2-08 wrapper, new columns, a new index.
    await q(`CREATE TABLE public.i06b_probe_analytical_projection_versions (id uuid PRIMARY KEY,
               replay_id uuid NOT NULL REFERENCES ${R.REPLAYS} (id) ON DELETE RESTRICT, projection_revision integer NOT NULL)`);
    await q(`CREATE TABLE public.i06b_probe_render_contract_versions (id uuid PRIMARY KEY,
               replay_id uuid NOT NULL REFERENCES ${R.REPLAYS} (id) ON DELETE RESTRICT, timing_policy text NOT NULL)`);
    await q(`CREATE TABLE public.i06b_probe_replay_versions (id uuid PRIMARY KEY,
               replay_id uuid NOT NULL REFERENCES ${R.REPLAYS} (id) ON DELETE RESTRICT,
               source_manifest_version_id uuid NOT NULL REFERENCES ${R.MANIFESTS} (id) ON DELETE RESTRICT,
               selection_spec_version_id uuid NOT NULL REFERENCES ${R.SPECS} (id) ON DELETE RESTRICT,
               analytical_projection_version_id uuid NOT NULL REFERENCES public.i06b_probe_analytical_projection_versions (id) ON DELETE RESTRICT,
               render_contract_version_id uuid NOT NULL REFERENCES public.i06b_probe_render_contract_versions (id) ON DELETE RESTRICT)`);
    await q(`CREATE FUNCTION public.i06b_probe_commit_preview_ready_v1(p_replay_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.replays r SET current_lifecycle = 'PREVIEW_READY' WHERE r.id = p_replay_id; END$fn$`);
    await q(`CREATE TABLE public.i06c_probe_distribution_package_versions (id uuid PRIMARY KEY,
               replay_version_id uuid NOT NULL REFERENCES public.i06b_probe_replay_versions (id) ON DELETE RESTRICT, audience_class text NOT NULL)`);
    await q(`CREATE TABLE public.i06c_probe_distribution_approvals (id uuid PRIMARY KEY,
               package_version_id uuid NOT NULL REFERENCES public.i06c_probe_distribution_package_versions (id) ON DELETE RESTRICT, approver_user_id uuid NOT NULL)`);
    await q(`CREATE TABLE public.i06d_probe_source_loss_records (manifest_version_id uuid PRIMARY KEY REFERENCES ${R.MANIFESTS} (id) ON DELETE RESTRICT, noted_at timestamptz NOT NULL)`);
    await q('CREATE TABLE public.i06_probe_launch_gate (id uuid PRIMARY KEY, capability text NOT NULL)');
    await q(`ALTER TABLE ${R.REPLAYS} ADD COLUMN i06b_probe_finalized_at timestamptz`);
    await q(`ALTER TABLE ${R.SPECS} ADD COLUMN i06b_probe_cut_review_revision integer`);
    await q(`CREATE INDEX i06_probe_idx ON ${R.MANIFESTS} (captured_at)`);
    await q(`CREATE FUNCTION public.i06_probe_launch_wrapper_v1() RETURNS void LANGUAGE sql SET search_path='' AS $fn$ SELECT 1 $fn$`);
    await q('GRANT EXECUTE ON FUNCTION public.i06_probe_launch_wrapper_v1() TO authenticated');
    await verifyCatalog();

    // F1 AN APPLICATION ROLE GAINS A DIRECT READ.
    await q('SAVEPOINT f1');
    await q(`GRANT SELECT ON TABLE ${R.MANIFEST_ITEMS} TO service_role`);
    await assert.rejects(verifyCatalog(), refuses, 'F1 a direct application-role privilege on a Replay relation is a regression');
    await q('ROLLBACK TO SAVEPOINT f1'); await q('RELEASE SAVEPOINT f1');

    // F2 THE CHRONOLOGY GUARD DISAPPEARS, so a reversed story becomes representable.
    await q('SAVEPOINT f2');
    await q(`DROP TRIGGER replay_selection_spec_items_chronology ON ${R.SPEC_ITEMS}`);
    await assert.rejects(verifyCatalog(), refuses, 'F2 losing the chronology guard is a regression');
    await insertSpecItem(state.spec, state.pub.id, 1, 1);
    const reversed = randomUUID();
    await insertSpec({ id: reversed, replay: state.replay, manifest: state.wide.id, complete: true, revision: 9, manifestItems: 2, selected: 2 });
    await insertSpecItem(reversed, state.wide.id, 2, 1);
    await insertSpecItem(reversed, state.wide.id, 1, 2);
    assert.equal(await count(R.SPEC_ITEMS, 'selection_spec_version_id = $1', [reversed]), 2, 'F2 anti-vacuity: without the guard a reversal really is representable');
    await q('ROLLBACK TO SAVEPOINT f2'); await q('RELEASE SAVEPOINT f2');

    // F3 A CONTENT COLUMN APPEARS ON THE MANIFEST ITEMS: a shadow copy.
    await q('SAVEPOINT f3');
    await q(`ALTER TABLE ${R.MANIFEST_ITEMS} ADD COLUMN captured_body_text text`);
    await assert.rejects(verifyCatalog(), refuses, 'F3 a content column on a Replay relation is a regression');
    await q('ROLLBACK TO SAVEPOINT f3'); await q('RELEASE SAVEPOINT f3');

    // F4 A DISTRIBUTION FLAG APPEARS ON THE IDENTITY.
    await q('SAVEPOINT f4');
    await q(`ALTER TABLE ${R.REPLAYS} ADD COLUMN is_public boolean NOT NULL DEFAULT false`);
    await assert.rejects(verifyCatalog(), refuses, 'F4 a distribution flag on the Replay identity is a regression');
    await q('ROLLBACK TO SAVEPOINT f4'); await q('RELEASE SAVEPOINT f4');

    // F5 THE PERSONAL CREATOR BINDING WEAKENS, so another human's Session becomes representable.
    await q('SAVEPOINT f5');
    await q(`ALTER TABLE ${R.MANIFESTS} DROP CONSTRAINT replay_source_manifest_versions_personal_creator_fk`);
    await assert.rejects(verifyCatalog(), refuses, 'F5 losing the creator binding is a regression');
    await q(`INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')`, [randomUUID(), f.hadir]);
    const [{ session }] = await rows('SELECT id session FROM public.conversation_sessions WHERE user_id = $1 LIMIT 1', [f.hadir]);
    await insertManifest({ id: randomUUID(), replay: state.replay, revision: 9, sourceClass: 'MY_WORLD', basis: 'PERSONAL_SOURCE_OWNERSHIP', session, owner: f.hadir, frontier: 1, items: 1, universe: 1 });
    assert.equal(await count(R.MANIFESTS, 'replay_id = $1 AND personal_owner_user_id = $2', [state.replay, f.hadir]), 1,
      "F5 anti-vacuity: the weakened shape admits another human's Session inside this creator's Replay");
    await q('ROLLBACK TO SAVEPOINT f5'); await q('RELEASE SAVEPOINT f5');

    // F6 A COMPONENT RELATION BECOMES MUTABLE.
    await q('SAVEPOINT f6');
    await q(`ALTER TABLE ${R.MANIFESTS} DISABLE TRIGGER replay_source_manifest_versions_immutable`);
    await assert.rejects(verifyCatalog(), refuses, 'F6 a mutable manifest version is a regression');
    await q('ROLLBACK TO SAVEPOINT f6'); await q('RELEASE SAVEPOINT f6');

    // F7 THE PUBLIC BINDING WEAKENS INTO INDEPENDENT KEYS, so version V beside another manifest fits.
    await q('SAVEPOINT f7');
    await q(`ALTER TABLE ${R.MANIFESTS} DROP CONSTRAINT replay_source_manifest_versions_public_version_fk`);
    await q(`ALTER TABLE ${R.MANIFESTS} ADD CONSTRAINT i06_probe_version_fk FOREIGN KEY (public_experience_version_id, public_experience_id)
             REFERENCES public.public_experience_versions (id, experience_id) ON DELETE RESTRICT`);
    await q(`ALTER TABLE ${R.MANIFESTS} ADD CONSTRAINT i06_probe_manifest_fk FOREIGN KEY (public_manifest_version_id)
             REFERENCES public.publication_package_manifest_versions (id) ON DELETE RESTRICT`);
    await assert.rejects(verifyCatalog(), refuses, 'F7 two independent keys in place of the exact version binding is a regression');
    await q('ROLLBACK TO SAVEPOINT f7'); await q('RELEASE SAVEPOINT f7');

    // F8 A BODY RELATION BECOMES A REPLAY PARENT: deletion could be blocked or content kept alive.
    await q('SAVEPOINT f8');
    await q(`ALTER TABLE ${R.MANIFEST_ITEMS} ADD CONSTRAINT i06_probe_body_fk FOREIGN KEY (shared_material_id)
             REFERENCES public.shared_world_text_material_bodies (material_id) ON DELETE RESTRICT`);
    await assert.rejects(verifyCatalog(), refuses, 'F8 a Replay foreign key onto a body relation is a regression');
    await q('ROLLBACK TO SAVEPOINT f8'); await q('RELEASE SAVEPOINT f8');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

await runVerifier('0100', async (stage) => {
  await rt.client.connect();
  stage('catalog');
  await asRole('postgres');
  await verifyCatalog();

  const f = rt.newFixture();
  await q('BEGIN');
  try {
    stage('fixtures');
    await rt.provision(f);
    await rt.provisionIdentities(f);
    stage('structure');
    const state = await verifyStructure(f);
    stage('forward safety');
    await asRole('postgres');
    await verifyForwardSafety(f, state);
  } finally {
    await q('ROLLBACK');
  }

  stage('fixture residue');
  await asRole('postgres');
  await verifyCatalog();
  const [{ n }] = await rows(
    `SELECT (SELECT count(*) FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
          + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
    [[f.mohamed, f.hadir, f.stranger, f.reader]]);
  assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back');
}, () => rt.client.end().catch(() => undefined));
