// Real-PostgreSQL verifier for migration 0089 - I-04G Shared Material
// Persistence v1 (PART A).
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// behaviour rather than from the migration text:
//
//   * catalog: the four relations exist once and still carry every column they OWN
//     - name, type, nullability AND the absence of a default - unchanged and in
//     their original positions; every owned unique binding, check and foreign key
//     is pinned by name, local columns, parent and restrictive deletion; RLS is on
//     with zero policies; and PUBLIC, anon, authenticated and service_role hold no
//     privilege at all;
//   * catalog: the material resolver is postgres-owned, SECURITY DEFINER, STABLE,
//     search_path-pinned, executable by service_role ALONE, and consumes the ONE
//     frozen I-04F visibility entry point rather than re-deciding visibility;
//   * S01 the kind-to-body binding is STRUCTURAL: a text body cannot attach to a
//     voice note, a voice-note body cannot attach to text, and a reserved-kind
//     material can carry no body at all;
//   * S02 a human producer always has an author and QANDEEL never does;
//   * S03 one material is one history item, in one exact World, in both directions;
//   * S04 an empty or whitespace-only text body is refused, and no maximum length
//     is imposed;
//   * S05 an audio object reference that is a URL, carries a query or fragment, or
//     looks like a credential is refused; a transcript-free voice note is fine;
//   * S06 each provenance kind accepts exactly its own shape and no other;
//   * S07 a self-dependency and a same-instant or later source are refused, so a
//     MATERIAL_DEPENDENCY cycle is unrepresentable rather than merely rejected;
//   * S08 an opaque private context reference may not carry whitespace or prose;
//   * S09 one effective edge per (target, source), per (target, context), and at
//     most one INDEPENDENT_TARGET_TRUTH per target;
//   * M11 hidden history yields zero material rows and no placeholder;
//   * M12 the resolver returns only I-04F-visible material, and M06 its
//     established_at equals the item's occurred_at;
//   * M13 every direct relation stays sealed against every application role;
//   * P04 an ordinary material read reveals no sealed provenance, no material
//     authority and no membership;
//   * D11 a resolver never returns material whose body owner deletion destroyed;
//   * forward safety: later reviewed explicit-disclosure, World-event-derived and
//     Introduction producers, provider metadata, a Launch Gate, later additive
//     columns, indexes and audit triggers are created for real inside a rolled-back
//     SAVEPOINT and this verifier still passes - then every regression to something
//     0089 OWNS is planted and must still be refused;
//   * zero fixture residue after completion.
//
// There is deliberately NO live census of any kind here: this file runs against a
// fully migrated database, so a fixed list of table names required to stay absent,
// an exact count of live constraints or a catalog sweep for future names would be
// a ceiling on the whole roadmap rather than a fact about migration 0089. What
// 0089 itself did NOT create is proven from 0089's own text, by
// database/tests/shared-world-material-persistence-v1.test.mjs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
const databaseUrl = process.env.DATABASE_URL;
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes, message = null) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
  if (message) assert.match(error.message, message);
  return error;
}

const EPISODES = 'public.shared_world_membership_episodes';
const CREDENTIAL = 'public.shared_world_invite_credential_state';
const INVITATIONS = 'public.shared_world_direct_invitations';
const ITEMS = 'public.shared_world_history_items';

const MATERIALS = 'public.shared_world_materials';
const TEXT_BODIES = 'public.shared_world_text_material_bodies';
const VOICE_BODIES = 'public.shared_world_voice_note_material_bodies';
const DEPENDENCIES = 'public.shared_world_material_dependencies';
const COMMIT_COMMANDS = 'public.shared_world_material_commit_commands';
const DELETE_COMMANDS = 'public.shared_world_material_delete_commands';
const OWN_TABLES = [MATERIALS, TEXT_BODIES, VOICE_BODIES, DEPENDENCIES];
const APPLICATION_ROLES = ['anon', 'authenticated', 'service_role'];
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const RESOLVE_FN = 'public.resolve_shared_world_material_v1(uuid,uuid)';
const ENTRY_POINT_FN = 'public.resolve_shared_world_history_visibility_v1(uuid,uuid)';

const CHECK_VIOLATION = ['23514'];
const UNIQUE_VIOLATION = ['23505'];
const FOREIGN_KEY_VIOLATION = ['23503'];
const NOT_NULL_VIOLATION = ['23502'];
const INSUFFICIENT_PRIVILEGE = ['42501'];
const INVALID_PARAMETER = ['22023'];

const ROTATE_SQL = 'SELECT command_id, credential_epoch FROM public.rotate_shared_world_invite_credential_v1($1,$2,$3)';
const SUBMIT_SQL = 'SELECT outcome, command_id, requested_invitation_id FROM public.submit_shared_world_direct_invitation_v1($1,$2,$3)';
const BIRTH_SQL = 'SELECT outcome, born_world_id FROM public.commit_shared_world_direct_acceptance_birth_v1($1,$2,$3,$4,$5)';
const TEXT_COMMIT_SQL = `SELECT outcome, committed_material_id, committed_history_item_id, audience_size, material_established_at
  FROM public.commit_shared_world_human_text_v1($1,$2,$3,$4,$5)`;
const VOICE_COMMIT_SQL = `SELECT outcome, committed_material_id, committed_history_item_id, audience_size
  FROM public.commit_shared_world_human_voice_note_v1($1,$2,$3,$4,$5,$6,$7)`;
const DELETE_SQL = `SELECT outcome, deleted_material_id, invalidated_targets
  FROM public.delete_shared_world_owned_material_v1($1,$2,$3,$4)`;
const MATERIAL_SQL = `SELECT world_id, material_id, history_item_id, material_kind, established_at,
  author_user_id, text_body, audio_object_ref, transcript_text FROM public.resolve_shared_world_material_v1($1,$2)`;
const VISIBILITY_SQL = 'SELECT world_id, history_item_id, occurred_at FROM public.resolve_shared_world_history_visibility_v1($1,$2)';

const opaqueRef = (label) => `ref:i04g-material:${label}:${randomUUID()}`;

const UUID = 'uuid';
const TEXT = 'text';
const INT = 'integer';
const TSTZ = 'timestamp with time zone';

const OWNED_COLUMNS = {
  [MATERIALS]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['history_item_id', UUID, 'NO', null],
    ['material_kind', TEXT, 'NO', null], ['producer_kind', TEXT, 'NO', null], ['body_form', TEXT, 'NO', null],
    ['author_user_id', UUID, 'YES', null], ['established_at', TSTZ, 'NO', null],
  ],
  [TEXT_BODIES]: [
    ['material_id', UUID, 'NO', null], ['body_form', TEXT, 'NO', null], ['body_text', TEXT, 'NO', null],
  ],
  [VOICE_BODIES]: [
    ['material_id', UUID, 'NO', null], ['body_form', TEXT, 'NO', null], ['audio_object_ref', TEXT, 'NO', null],
    ['transcript_text', TEXT, 'YES', null], ['duration_ms', INT, 'YES', null],
  ],
  [DEPENDENCIES]: [
    ['id', UUID, 'NO', null], ['world_id', UUID, 'NO', null], ['dependency_kind', TEXT, 'NO', null],
    ['target_material_id', UUID, 'NO', null], ['target_established_at', TSTZ, 'NO', null],
    ['source_material_id', UUID, 'YES', null], ['source_established_at', TSTZ, 'YES', null],
    ['source_context_ref', TEXT, 'YES', null],
  ],
};

const OWNED_FOREIGN_KEYS = {
  shared_world_materials_world_fk: 'FOREIGN KEY (world_id) REFERENCES shared_worlds(id) ON DELETE RESTRICT',
  shared_world_materials_history_item_fk: 'FOREIGN KEY (history_item_id, world_id) REFERENCES shared_world_history_items(id, world_id) ON DELETE RESTRICT',
  shared_world_materials_author_fk: 'FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE RESTRICT',
  shared_world_text_material_bodies_material_fk: 'FOREIGN KEY (material_id, body_form) REFERENCES shared_world_materials(id, body_form) ON DELETE RESTRICT',
  shared_world_voice_note_material_bodies_material_fk: 'FOREIGN KEY (material_id, body_form) REFERENCES shared_world_materials(id, body_form) ON DELETE RESTRICT',
  shared_world_material_dependencies_target_world_fk: 'FOREIGN KEY (target_material_id, world_id) REFERENCES shared_world_materials(id, world_id) ON DELETE RESTRICT',
  shared_world_material_dependencies_source_world_fk: 'FOREIGN KEY (source_material_id, world_id) REFERENCES shared_world_materials(id, world_id) ON DELETE RESTRICT',
  shared_world_material_dependencies_target_instant_fk: 'FOREIGN KEY (target_material_id, target_established_at) REFERENCES shared_world_materials(id, established_at) ON DELETE RESTRICT',
  shared_world_material_dependencies_source_instant_fk: 'FOREIGN KEY (source_material_id, source_established_at) REFERENCES shared_world_materials(id, established_at) ON DELETE RESTRICT',
};

const OWNED_BINDINGS = [
  [MATERIALS, 'shared_world_materials_pk', /PRIMARY KEY \(id\)/u],
  [MATERIALS, 'shared_world_materials_history_item_key', /UNIQUE \(history_item_id\)/u],
  [MATERIALS, 'shared_world_materials_world_key', /UNIQUE \(id, world_id\)/u],
  [MATERIALS, 'shared_world_materials_instant_key', /UNIQUE \(id, established_at\)/u],
  [MATERIALS, 'shared_world_materials_body_form_key', /UNIQUE \(id, body_form\)/u],
  [MATERIALS, 'shared_world_materials_kind_check', /WORLD_EVENT_DERIVED_MATERIAL/u],
  [MATERIALS, 'shared_world_materials_producer_check', /HUMAN.*QANDEEL/su],
  [MATERIALS, 'shared_world_materials_authorship_check', /author_user_id IS NULL/u],
  [MATERIALS, 'shared_world_materials_kind_producer_check', /HUMAN_VOICE_NOTE/u],
  [MATERIALS, 'shared_world_materials_body_form_check', /RESERVED/u],
  [TEXT_BODIES, 'shared_world_text_material_bodies_pk', /PRIMARY KEY \(material_id\)/u],
  [TEXT_BODIES, 'shared_world_text_material_bodies_form_check', /body_form = 'TEXT'/u],
  [TEXT_BODIES, 'shared_world_text_material_bodies_nonempty_check', /btrim\(body_text\)\) > 0/u],
  [VOICE_BODIES, 'shared_world_voice_note_material_bodies_pk', /PRIMARY KEY \(material_id\)/u],
  [VOICE_BODIES, 'shared_world_voice_note_material_bodies_form_check', /body_form = 'VOICE_NOTE'/u],
  [VOICE_BODIES, 'shared_world_voice_note_material_bodies_opaque_ref_check', /credential/u],
  [VOICE_BODIES, 'shared_world_voice_note_material_bodies_duration_check', /duration_ms > 0/u],
  [DEPENDENCIES, 'shared_world_material_dependencies_pk', /PRIMARY KEY \(id\)/u],
  [DEPENDENCIES, 'shared_world_material_dependencies_kind_check', /INDEPENDENT_TARGET_TRUTH/u],
  [DEPENDENCIES, 'shared_world_material_dependencies_shape_check', /REASONING_DEPENDENCY/u],
  [DEPENDENCIES, 'shared_world_material_dependencies_no_self_check', /source_material_id <> target_material_id/u],
  [DEPENDENCIES, 'shared_world_material_dependencies_source_precedes_check', /source_established_at < target_established_at/u],
  [DEPENDENCIES, 'shared_world_material_dependencies_opaque_context_check', /source_context_ref/u],
];

const OWNED_INDEXES = [
  'shared_world_material_dependencies_one_material_edge_idx',
  'shared_world_material_dependencies_one_reasoning_edge_idx',
  'shared_world_material_dependencies_one_independent_idx',
];

// ---------------------------------------------------------------------------

async function verifyCatalog() {
  stage = 'catalog: every relation 0089 owns exists exactly once';
  for (const table of OWN_TABLES) {
    const [meta] = await rows(
      'SELECT c.relkind kind, c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass',
      [table]);
    assert.ok(meta, `${table} exists`);
    assert.equal(meta.kind, 'r', `${table} is an ordinary table`);
    assert.equal(meta.owner, 'postgres', `${table} is owned by postgres`);
    assert.equal(meta.rls, true, `row level security is enabled on ${table}`);
  }

  stage = 'catalog: the owned columns, unchanged and in their original positions';
  for (const [table, owned] of Object.entries(OWNED_COLUMNS)) {
    const columns = await rows(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table.replace('public.', '')]);
    const observed = columns.map((c) => [c.column_name, c.data_type, c.is_nullable, c.column_default]);
    assert.deepEqual(
      observed.slice(0, owned.length),
      owned,
      `${table} still carries every column migration 0089 owns, unchanged and in its original position`);
    for (const [name] of owned) {
      assert.equal(observed.filter((column) => column[0] === name).length, 1, `${table}.${name} appears exactly once`);
    }
  }

  stage = 'catalog: the exact bindings and foreign keys 0089 owns';
  const constraintsOf = async (table) => rows(
    'SELECT conname name, contype type, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname',
    [table]);
  const live = new Map();
  for (const table of OWN_TABLES) live.set(table, await constraintsOf(table));
  const defOf = (table, name) => (live.get(table).find((c) => c.name === name) ?? { def: `MISSING CONSTRAINT ${name}` }).def;
  for (const [table, name, shape] of OWNED_BINDINGS) {
    assert.match(defOf(table, name), shape, `${name} is the exact binding migration 0089 owns`);
  }
  const normalize = (def) => def.replace(/REFERENCES (?:public\.)?/u, 'REFERENCES ');
  const liveKeys = new Map();
  for (const table of OWN_TABLES) {
    for (const c of live.get(table).filter((entry) => entry.type === 'f')) liveKeys.set(c.name, normalize(c.def));
  }
  for (const [name, def] of Object.entries(OWNED_FOREIGN_KEYS)) {
    assert.equal(liveKeys.get(name), def,
      `${name} binds exactly the canonical row, restrictively: canonical history is never cascaded away`);
  }
  for (const index of OWNED_INDEXES) {
    const [live_index] = await rows('SELECT indexdef def FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
      ['public', index]);
    assert.ok(live_index, `${index} still exists`);
    assert.match(live_index.def, /CREATE UNIQUE INDEX/u, `${index} is the unique edge rule migration 0089 owns`);
    assert.match(live_index.def, /WHERE \(dependency_kind = /u, `${index} stays scoped to its own dependency kind`);
  }

  stage = 'catalog: RLS on, zero policies and no application-role privilege';
  for (const table of OWN_TABLES) {
    const [{ n: policies }] = await rows('SELECT count(*)::int n FROM pg_policy p WHERE p.polrelid = $1::regclass', [table]);
    assert.equal(policies, 0, `${table} carries zero RLS policies`);
    const [{ publicAcl }] = await rows(
      'SELECT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid = $1::regclass AND a.grantee = 0) AS "publicAcl"',
      [table]);
    assert.equal(publicAcl, false, `PUBLIC must not hold any privilege on ${table}`);
    for (const role of APPLICATION_ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ allowed }] = await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, table, privilege]);
        assert.equal(allowed, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }

  stage = 'catalog: the material resolver is STABLE, service-role-only and composed, never re-deciding';
  const [resolver] = await rows(
    `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc,
            pg_get_userbyid(pr.proowner) owner FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [RESOLVE_FN]);
  assert.ok(resolver, 'the material resolver exists');
  assert.equal(resolver.owner, 'postgres', 'the material resolver is owned by postgres');
  assert.equal(resolver.secdef, true, 'the material resolver is SECURITY DEFINER');
  assert.equal(resolver.volatility, 's', 'the material resolver is a read boundary and is STABLE');
  assert.ok((resolver.config ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'),
    'the material resolver pins an empty search_path');
  assert.doesNotMatch(resolver.prosrc, /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'the material resolver mutates nothing, locks nothing and trusts no client claim');
  assert.match(resolver.prosrc, /public\.resolve_shared_world_history_visibility_v1\(p_world_id, p_user_id\)/u,
    'visibility is decided by the ONE frozen I-04F entry point, never re-implemented');
  for (const sealed of ['shared_world_material_dependencies', 'source_context_ref',
    'shared_world_history_item_required_approvers', 'shared_world_membership_episodes']) {
    assert.ok(!resolver.prosrc.includes(sealed),
      `the material resolver discloses no ${sealed}: sealed provenance stays sealed and membership is not material`);
  }
  const [{ allowed: publicExecute }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') AS allowed", [RESOLVE_FN]);
  assert.equal(publicExecute, false, 'PUBLIC must not execute the material resolver');
  for (const role of ['anon', 'authenticated']) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, RESOLVE_FN, 'EXECUTE']);
    assert.equal(allowed, false, `${role} must not execute the material resolver`);
  }
  const [{ allowed: serviceExecute }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed',
    ['service_role', RESOLVE_FN, 'EXECUTE']);
  assert.equal(serviceExecute, true, 'service_role must execute the ONE narrow material resolver');
  const [{ allowed: entryPoint }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed',
    ['service_role', ENTRY_POINT_FN, 'EXECUTE']);
  assert.equal(entryPoint, true, 'service_role must still execute the ONE historical visibility entry point');
}

// ---------------------------------------------------------------------------

async function provisionWorld(inviter, target, label) {
  const ref = opaqueRef(label);
  // The frozen I-04A rotation is a compare-and-swap: a NULL expected epoch means
  // `this human has no credential yet`, and offering it to a human who already has
  // one is a stale-state refusal. A fixture human may legitimately be the target of
  // more than one World here, so the CURRENT epoch is read and offered.
  await identity('postgres');
  const [state] = await rows(`SELECT epoch FROM ${CREDENTIAL} WHERE user_id = $1`, [target]);
  await identity('authenticated', target);
  await rows(ROTATE_SQL, [randomUUID(), ref, state ? state.epoch : null]);
  await identity('authenticated', inviter);
  const invitationId = randomUUID();
  await rows(SUBMIT_SQL, [randomUUID(), invitationId, ref]);
  await identity('postgres', target);
  const worldId = randomUUID();
  const inviterEpisode = randomUUID();
  const targetEpisode = randomUUID();
  const [born] = await rows(BIRTH_SQL, [randomUUID(), invitationId, worldId, inviterEpisode, targetEpisode]);
  assert.equal(born.outcome, 'BORN', 'the fixture World was born through the frozen I-04B primitive');
  await identity('postgres');
  return { worldId, inviterEpisode, targetEpisode, invitationId };
}

/** Commit real HUMAN_TEXT through the frozen I-04G primitive, as that exact human. */
async function commitText(worldId, human, body) {
  await identity('postgres', human);
  const materialId = randomUUID();
  const [committed] = await rows(TEXT_COMMIT_SQL, [randomUUID(), worldId, materialId, randomUUID(), body]);
  assert.equal(committed.outcome, 'MATERIAL_COMMITTED');
  await identity('postgres');
  return { materialId: committed.committed_material_id, itemId: committed.committed_history_item_id,
    viewers: committed.audience_size, establishedAt: committed.material_established_at };
}

async function commitVoice(worldId, human, audioRef, transcript = null, durationMs = null) {
  await identity('postgres', human);
  const [committed] = await rows(VOICE_COMMIT_SQL,
    [randomUUID(), worldId, randomUUID(), randomUUID(), audioRef, transcript, durationMs]);
  assert.equal(committed.outcome, 'MATERIAL_COMMITTED');
  await identity('postgres');
  return { materialId: committed.committed_material_id, itemId: committed.committed_history_item_id };
}

async function deleteOwn(worldId, human, materialId) {
  await identity('postgres', human);
  const [deleted] = await rows(DELETE_SQL, [randomUUID(), worldId, materialId, randomUUID()]);
  assert.equal(deleted.outcome, 'MATERIAL_DELETED');
  await identity('postgres');
  return deleted;
}

const materialFor = async (worldId, userId) => rows(MATERIAL_SQL, [worldId, userId]);
const visibleFor = async (worldId, userId) => (await rows(VISIBILITY_SQL, [worldId, userId])).map((row) => row.history_item_id);

// ---------------------------------------------------------------------------

async function verifyStructure(f) {
  const world = await provisionWorld(f.inviter, f.second, 'structure');

  stage = 'S01: the kind-to-body binding is structural, not procedural';
  const text = await commitText(world.worldId, f.inviter, 'a real Shared statement');
  const voice = await commitVoice(world.worldId, f.second, 'media-object-0001', 'the spoken words', 4200);
  // The provenance proofs below depend on `text` really preceding `voice`. Two
  // commits inside one transaction read clock_timestamp() twice and cannot share
  // an instant in practice - but a shared instant would make the strict
  // source-precedes-target proofs read as a flake instead of a defect, so it is
  // asserted rather than assumed.
  const [{ ordered }] = await rows(
    `SELECT (a.established_at < b.established_at) AS ordered FROM ${MATERIALS} a, ${MATERIALS} b
      WHERE a.id = $1 AND b.id = $2`, [text.materialId, voice.materialId]);
  assert.equal(ordered, true, 'the fixture text material really was established before the fixture voice note');
  // A text body can never attach to a voice note, and the reverse, because the
  // composite (id, body_form) key refuses it.
  await rejected(() => q(`INSERT INTO ${TEXT_BODIES}(material_id, body_form, body_text) VALUES($1,'TEXT','x')`,
    [voice.materialId]), FOREIGN_KEY_VIOLATION, /shared_world_text_material_bodies_material_fk/u);
  await rejected(() => q(
    `INSERT INTO ${VOICE_BODIES}(material_id, body_form, audio_object_ref) VALUES($1,'VOICE_NOTE','media-object-x')`,
    [text.materialId]), FOREIGN_KEY_VIOLATION, /shared_world_voice_note_material_bodies_material_fk/u);
  // And a mislabelled body_form is refused by the body relation's own check.
  await rejected(() => q(`INSERT INTO ${TEXT_BODIES}(material_id, body_form, body_text) VALUES($1,'VOICE_NOTE','x')`,
    [randomUUID()]), CHECK_VIOLATION, /shared_world_text_material_bodies_form_check/u);

  stage = 'S02: a human producer always has an author, and QANDEEL never does';
  /** A bare I-04F history item, so a direct envelope INSERT has something legal to bind to. */
  const bareItem = async (mode = 'NO_HUMAN_APPROVAL_REQUIRED') => {
    const id = randomUUID();
    await q(`INSERT INTO ${ITEMS}(id, world_id, occurred_at, authority_requirement_mode, availability_state,
                                  availability_revision, registered_at)
             VALUES($1,$2, clock_timestamp(), $3, 'AVAILABLE', 1, clock_timestamp())`, [id, world.worldId, mode]);
    return id;
  };
  const humanNoAuthor = await bareItem();
  await rejected(() => q(
    `INSERT INTO ${MATERIALS}(id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
     VALUES($1,$2,$3,'HUMAN_TEXT','HUMAN','TEXT',NULL, clock_timestamp())`,
    [randomUUID(), world.worldId, humanNoAuthor]), CHECK_VIOLATION, /shared_world_materials_authorship_check/u);
  const qandeelWithAuthor = await bareItem();
  await rejected(() => q(
    `INSERT INTO ${MATERIALS}(id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
     VALUES($1,$2,$3,'QANDEEL_OUTPUT','QANDEEL','TEXT',$4, clock_timestamp())`,
    [randomUUID(), world.worldId, qandeelWithAuthor, f.inviter]),
  CHECK_VIOLATION, /shared_world_materials_authorship_check/u);
  // And a human kind can never claim a QANDEEL producer.
  await rejected(() => q(
    `INSERT INTO ${MATERIALS}(id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
     VALUES($1,$2,$3,'HUMAN_TEXT','QANDEEL','TEXT',NULL, clock_timestamp())`,
    [randomUUID(), world.worldId, humanNoAuthor]), CHECK_VIOLATION, /shared_world_materials_kind_producer_check/u);
  // A RESERVED kind carries no body at all: no body relation accepts its form.
  const reservedItem = await bareItem();
  const reservedMaterial = randomUUID();
  await q(`INSERT INTO ${MATERIALS}(id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
           VALUES($1,$2,$3,'EXPLICIT_DISCLOSURE','HUMAN','RESERVED',$4, clock_timestamp())`,
  [reservedMaterial, world.worldId, reservedItem, f.inviter]);
  await rejected(() => q(`INSERT INTO ${TEXT_BODIES}(material_id, body_form, body_text) VALUES($1,'TEXT','x')`,
    [reservedMaterial]), FOREIGN_KEY_VIOLATION, /shared_world_text_material_bodies_material_fk/u);
  await q(`DELETE FROM ${MATERIALS} WHERE id = $1`, [reservedMaterial]);

  stage = 'S03: one material is one history item, in one exact World, in both directions';
  await rejected(() => q(
    `INSERT INTO ${MATERIALS}(id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
     VALUES($1,$2,$3,'HUMAN_TEXT','HUMAN','TEXT',$4, clock_timestamp())`,
    [randomUUID(), world.worldId, text.itemId, f.inviter]),
  UNIQUE_VIOLATION, /shared_world_materials_history_item_key/u);
  const otherWorld = await provisionWorld(f.inviter, f.third, 'structure-other');
  await rejected(() => q(
    `INSERT INTO ${MATERIALS}(id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
     VALUES($1,$2,$3,'HUMAN_TEXT','HUMAN','TEXT',$4, clock_timestamp())`,
    [randomUUID(), otherWorld.worldId, humanNoAuthor, f.inviter]),
  FOREIGN_KEY_VIOLATION, /shared_world_materials_history_item_fk/u);

  stage = 'S04: an empty body is refused, and no maximum length is imposed';
  const emptyItem = await bareItem();
  const emptyMaterial = randomUUID();
  await q(`INSERT INTO ${MATERIALS}(id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
           VALUES($1,$2,$3,'HUMAN_TEXT','HUMAN','TEXT',$4, clock_timestamp())`,
  [emptyMaterial, world.worldId, emptyItem, f.inviter]);
  await rejected(() => q(`INSERT INTO ${TEXT_BODIES}(material_id, body_form, body_text) VALUES($1,'TEXT','   ')`,
    [emptyMaterial]), CHECK_VIOLATION, /shared_world_text_material_bodies_nonempty_check/u);
  const long = 'x'.repeat(200000);
  await q(`INSERT INTO ${TEXT_BODIES}(material_id, body_form, body_text) VALUES($1,'TEXT',$2)`, [emptyMaterial, long]);
  const [{ n: stored }] = await rows(`SELECT length(body_text)::int n FROM ${TEXT_BODIES} WHERE material_id = $1`, [emptyMaterial]);
  assert.equal(stored, 200000, 'no Product copy limit is invented: a long body is persisted whole');
  await q(`DELETE FROM ${TEXT_BODIES} WHERE material_id = $1`, [emptyMaterial]);
  await q(`DELETE FROM ${MATERIALS} WHERE id = $1`, [emptyMaterial]);

  stage = 'S05: the audio object reference is opaque, never a URL and never a credential';
  const voiceItem = await bareItem();
  const voiceMaterial = randomUUID();
  await q(`INSERT INTO ${MATERIALS}(id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
           VALUES($1,$2,$3,'HUMAN_VOICE_NOTE','HUMAN','VOICE_NOTE',$4, clock_timestamp())`,
  [voiceMaterial, world.worldId, voiceItem, f.inviter]);
  for (const bad of ['https://cdn.example/audio.m4a', 'media-object?token=abc', 'media#fragment',
    'media object with space', 'media-object-signature-9f', '']) {
    await rejected(() => q(
      `INSERT INTO ${VOICE_BODIES}(material_id, body_form, audio_object_ref) VALUES($1,'VOICE_NOTE',$2)`,
      [voiceMaterial, bad]), CHECK_VIOLATION, /shared_world_voice_note_material_bodies_opaque_ref_check/u);
  }
  await rejected(() => q(
    `INSERT INTO ${VOICE_BODIES}(material_id, body_form, audio_object_ref, duration_ms) VALUES($1,'VOICE_NOTE','media-ok',0)`,
    [voiceMaterial]), CHECK_VIOLATION, /shared_world_voice_note_material_bodies_duration_check/u);
  await rejected(() => q(
    `INSERT INTO ${VOICE_BODIES}(material_id, body_form, audio_object_ref) VALUES($1,'VOICE_NOTE',NULL)`,
    [voiceMaterial]), NOT_NULL_VIOLATION);
  await q(`INSERT INTO ${VOICE_BODIES}(material_id, body_form, audio_object_ref) VALUES($1,'VOICE_NOTE','media-object-plain')`,
    [voiceMaterial]);
  await q(`DELETE FROM ${VOICE_BODIES} WHERE material_id = $1`, [voiceMaterial]);
  await q(`DELETE FROM ${MATERIALS} WHERE id = $1`, [voiceMaterial]);

  stage = 'S06 / S07 / S08: each provenance kind has exactly one shape, and a cycle is unrepresentable';
  // A MATERIAL_DEPENDENCY with a private context reference, and a
  // REASONING_DEPENDENCY with a material source, are both unrepresentable.
  await rejected(() => q(
    `INSERT INTO ${DEPENDENCIES}(id, world_id, dependency_kind, target_material_id, target_established_at,
                                 source_material_id, source_established_at, source_context_ref)
     SELECT $1,$2,'MATERIAL_DEPENDENCY',$3,m.established_at,$4,s.established_at,'ctx:leak'
       FROM ${MATERIALS} m, ${MATERIALS} s WHERE m.id = $3 AND s.id = $4`,
    [randomUUID(), world.worldId, voice.materialId, text.materialId]),
  CHECK_VIOLATION, /shared_world_material_dependencies_shape_check/u);
  await rejected(() => q(
    `INSERT INTO ${DEPENDENCIES}(id, world_id, dependency_kind, target_material_id, target_established_at,
                                 source_material_id, source_established_at)
     SELECT $1,$2,'REASONING_DEPENDENCY',$3,m.established_at,$4,s.established_at
       FROM ${MATERIALS} m, ${MATERIALS} s WHERE m.id = $3 AND s.id = $4`,
    [randomUUID(), world.worldId, voice.materialId, text.materialId]),
  CHECK_VIOLATION, /shared_world_material_dependencies_shape_check/u);
  // A self dependency.
  await rejected(() => q(
    `INSERT INTO ${DEPENDENCIES}(id, world_id, dependency_kind, target_material_id, target_established_at,
                                 source_material_id, source_established_at)
     SELECT $1,$2,'MATERIAL_DEPENDENCY',$3,m.established_at,$3,m.established_at FROM ${MATERIALS} m WHERE m.id = $3`,
    [randomUUID(), world.worldId, text.materialId]),
  CHECK_VIOLATION, /shared_world_material_dependencies_no_self_check/u);
  // A source that does NOT precede its target - the edge that would make a cycle
  // representable. `text` was committed BEFORE `voice`, so this is the wrong way round.
  await rejected(() => q(
    `INSERT INTO ${DEPENDENCIES}(id, world_id, dependency_kind, target_material_id, target_established_at,
                                 source_material_id, source_established_at)
     SELECT $1,$2,'MATERIAL_DEPENDENCY',$3,t.established_at,$4,s.established_at
       FROM ${MATERIALS} t, ${MATERIALS} s WHERE t.id = $3 AND s.id = $4`,
    [randomUUID(), world.worldId, text.materialId, voice.materialId]),
  CHECK_VIOLATION, /shared_world_material_dependencies_source_precedes_check/u);
  // An opaque context reference may not carry prose.
  await rejected(() => q(
    `INSERT INTO ${DEPENDENCIES}(id, world_id, dependency_kind, target_material_id, target_established_at, source_context_ref)
     SELECT $1,$2,'REASONING_DEPENDENCY',$3,m.established_at,$4 FROM ${MATERIALS} m WHERE m.id = $3`,
    [randomUUID(), world.worldId, voice.materialId, 'he told me in confidence that he is leaving']),
  CHECK_VIOLATION, /shared_world_material_dependencies_opaque_context_check/u);

  stage = 'S09: one effective edge per target and source, context and independence';
  const edgeId = randomUUID();
  await q(
    `INSERT INTO ${DEPENDENCIES}(id, world_id, dependency_kind, target_material_id, target_established_at,
                                 source_material_id, source_established_at)
     SELECT $1,$2,'MATERIAL_DEPENDENCY',$3,t.established_at,$4,s.established_at
       FROM ${MATERIALS} t, ${MATERIALS} s WHERE t.id = $3 AND s.id = $4`,
    [edgeId, world.worldId, voice.materialId, text.materialId]);
  await rejected(() => q(
    `INSERT INTO ${DEPENDENCIES}(id, world_id, dependency_kind, target_material_id, target_established_at,
                                 source_material_id, source_established_at)
     SELECT $1,$2,'MATERIAL_DEPENDENCY',$3,t.established_at,$4,s.established_at
       FROM ${MATERIALS} t, ${MATERIALS} s WHERE t.id = $3 AND s.id = $4`,
    [randomUUID(), world.worldId, voice.materialId, text.materialId]),
  UNIQUE_VIOLATION, /shared_world_material_dependencies_one_material_edge_idx/u);
  // The voice note already carries its own INDEPENDENT_TARGET_TRUTH row from its
  // commit, so a second one is refused.
  await rejected(() => q(
    `INSERT INTO ${DEPENDENCIES}(id, world_id, dependency_kind, target_material_id, target_established_at)
     SELECT $1,$2,'INDEPENDENT_TARGET_TRUTH',$3,m.established_at FROM ${MATERIALS} m WHERE m.id = $3`,
    [randomUUID(), world.worldId, voice.materialId]),
  UNIQUE_VIOLATION, /shared_world_material_dependencies_one_independent_idx/u);
  await q(`DELETE FROM ${DEPENDENCIES} WHERE id = $1`, [edgeId]);
  await q(`DELETE FROM ${ITEMS} WHERE id = ANY($1::uuid[])`,
    [[humanNoAuthor, qandeelWithAuthor, reservedItem, emptyItem, voiceItem]]);
}

async function verifyResolver(f) {
  const world = await provisionWorld(f.inviter, f.second, 'resolver');
  const first = await commitText(world.worldId, f.inviter, 'the first Shared statement');
  const spoken = await commitVoice(world.worldId, f.second, 'media-object-resolver', 'spoken transcript', 1500);

  stage = 'M06: the material establishment instant IS the history item occurrence instant';
  const [{ same }] = await rows(
    `SELECT (m.established_at = i.occurred_at AND i.occurred_at = i.registered_at) AS same
       FROM ${MATERIALS} m JOIN ${ITEMS} i ON i.id = m.history_item_id WHERE m.id = $1`, [first.materialId]);
  assert.equal(same, true, 'established_at, occurred_at and registered_at are the ONE database-owned instant');

  stage = 'M12: the resolver returns exactly the I-04F-visible material, with its real body';
  await identity('service_role');
  const visible = await materialFor(world.worldId, f.inviter);
  assert.deepEqual(visible.map((row) => row.material_id).sort(),
    [first.materialId, spoken.materialId].sort(), 'both committed materials are visible to a current member');
  const textRow = visible.find((row) => row.material_id === first.materialId);
  assert.equal(textRow.material_kind, 'HUMAN_TEXT');
  assert.equal(textRow.text_body, 'the first Shared statement', 'the REAL body is returned, not a reference to one');
  assert.equal(textRow.audio_object_ref, null);
  assert.equal(textRow.author_user_id, f.inviter);
  const voiceRow = visible.find((row) => row.material_id === spoken.materialId);
  assert.equal(voiceRow.audio_object_ref, 'media-object-resolver');
  assert.equal(voiceRow.transcript_text, 'spoken transcript');
  assert.equal(voiceRow.text_body, null);

  stage = 'P04: an ordinary material read reveals no sealed provenance, no authority and no membership';
  assert.deepEqual(Object.keys(textRow).sort(),
    ['audio_object_ref', 'author_user_id', 'established_at', 'history_item_id', 'material_id',
      'material_kind', 'text_body', 'transcript_text', 'world_id'].sort(),
    'the resolver returns exactly the bounded renderable material and nothing else');

  stage = 'M11: hidden history gives zero material rows and no placeholder';
  await identity('service_role');
  assert.deepEqual(await materialFor(world.worldId, f.outsider), [],
    'a human with no membership sees no material at all - no count, no placeholder, no row');
  assert.deepEqual(await visibleFor(world.worldId, f.outsider), [],
    'and the frozen visibility entry point agrees');

  stage = 'M13: every direct relation stays sealed against every application role';
  for (const role of APPLICATION_ROLES) {
    for (const table of OWN_TABLES) {
      await identity(role, f.inviter);
      await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), INSUFFICIENT_PRIVILEGE);
    }
  }
  await identity('postgres');

  stage = 'D11: material whose body owner deletion destroyed is never returned again';
  await deleteOwn(world.worldId, f.inviter, first.materialId);
  await identity('service_role');
  assert.deepEqual((await materialFor(world.worldId, f.second)).map((row) => row.material_id), [spoken.materialId],
    'the deleted material disappears from the material resolver entirely');
  await identity('postgres');
  const [{ n: bodies }] = await rows(`SELECT count(*)::int n FROM ${TEXT_BODIES} WHERE material_id = $1`, [first.materialId]);
  assert.equal(bodies, 0, 'and its body row is physically gone');
  const [{ n: envelope }] = await rows(`SELECT count(*)::int n FROM ${MATERIALS} WHERE id = $1`, [first.materialId]);
  assert.equal(envelope, 1, 'while the envelope survives as non-content history');

  stage = 'the resolver refuses a malformed request and an unsupported World mode with bounded classes';
  await identity('service_role');
  await rejected(() => rows(MATERIAL_SQL, [null, f.inviter]), INVALID_PARAMETER, /SHARED_WORLD_MATERIAL_COMMAND_INVALID/u);
  await rejected(() => rows(MATERIAL_SQL, [world.worldId, null]), INVALID_PARAMETER, /SHARED_WORLD_MATERIAL_COMMAND_INVALID/u);
  await identity('postgres');
}

// ---------------------------------------------------------------------------

async function verifyForwardSafety(f) {
  stage = 'forward safety: later reviewed producers, provider metadata and a Launch Gate do not fail this verifier';
  await identity('postgres');
  const probe = `i04g_mat_probe_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
  await q('SAVEPOINT forward_safety');
  try {
    // The producers I-04G deliberately does not implement.
    await q(`CREATE TABLE public.${probe}_explicit_disclosure (id uuid PRIMARY KEY, material_id uuid
             REFERENCES ${MATERIALS} (id) ON DELETE RESTRICT)`);
    await q(`CREATE FUNCTION public.${probe}_commit_explicit_disclosure_v1(p_material_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`CREATE TABLE public.${probe}_world_event_material (id uuid PRIMARY KEY, world_id uuid NOT NULL)`);
    await q(`CREATE FUNCTION public.${probe}_commit_world_event_material_v1(p_world_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`CREATE FUNCTION public.${probe}_commit_introduction_material_v1(p_world_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    // A later reviewed media provider metadata relation and a media type column.
    await q(`CREATE TABLE public.${probe}_provider_metadata (material_id uuid PRIMARY KEY
             REFERENCES ${MATERIALS} (id) ON DELETE RESTRICT, provider text NOT NULL)`);
    await q(`ALTER TABLE ${VOICE_BODIES} ADD COLUMN ${probe}_media_type text`);
    // CW2-08's Launch Gate and a launch-gated application wrapper.
    await q(`CREATE TABLE public.${probe}_launch_gates (id uuid PRIMARY KEY, capability text NOT NULL, state text NOT NULL)`);
    await q(`CREATE FUNCTION public.${probe}_read_material_gated_v1(p_world_id uuid, p_user_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q(`GRANT EXECUTE ON FUNCTION public.${probe}_read_material_gated_v1(uuid, uuid) TO authenticated`);
    // Later additive metadata, with names and types 0089 would never write, plus a
    // Public and a Replay consumer of the material store.
    await q(`ALTER TABLE ${MATERIALS} ADD COLUMN ${probe}_material_metadata jsonb`);
    await q(`ALTER TABLE ${DEPENDENCIES} ADD COLUMN ${probe}_disclosure_epoch bigint`);
    await q(`ALTER TABLE ${TEXT_BODIES} ADD CONSTRAINT ${probe}_body_present_check CHECK (body_text IS NOT NULL)`);
    await q(`CREATE INDEX ${probe}_materials_kind_idx ON ${MATERIALS} (material_kind)`);
    await q(`CREATE TABLE public.${probe}_public_experience_material (id uuid PRIMARY KEY, material_id uuid
             REFERENCES ${MATERIALS} (id) ON DELETE RESTRICT)`);
    await q(`CREATE TABLE public.${probe}_replay_material (id uuid PRIMARY KEY, material_id uuid
             REFERENCES ${MATERIALS} (id) ON DELETE RESTRICT)`);
    // A later reviewed AUDIT trigger on a table 0089 owns. Deliberately inert.
    await q(`CREATE FUNCTION public.${probe}_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NULL; END$fn$`);
    await q(`CREATE TRIGGER ${probe}_materials_audit AFTER INSERT ON ${MATERIALS}
             FOR EACH ROW EXECUTE FUNCTION public.${probe}_audit_fn()`);
    await verifyCatalog();

    stage = 'forward safety: a whole material commit still works beside the authorized future';
    const world = await provisionWorld(f.inviter, f.forwardSecond, 'material-forward');
    const committed = await commitText(world.worldId, f.inviter, 'a statement made beside the authorized future');
    await identity('service_role');
    assert.deepEqual((await materialFor(world.worldId, f.forwardSecond)).map((row) => row.material_id),
      [committed.materialId], 'and the material resolver still answers correctly through the ONE entry point');
    await identity('postgres');

    stage = 'forward safety: a real regression to something 0089 OWNS is still refused';
    for (const [reason, plant, refuses] of [
      ['one history item could carry two materials',
        `ALTER TABLE ${MATERIALS} DROP CONSTRAINT shared_world_materials_history_item_key`,
        /shared_world_materials_history_item_key/u],
      ['a material stops binding its exact history item in its exact World',
        `ALTER TABLE ${MATERIALS} DROP CONSTRAINT shared_world_materials_history_item_fk,
         ADD CONSTRAINT shared_world_materials_history_item_fk
           FOREIGN KEY (history_item_id) REFERENCES ${ITEMS} (id) ON DELETE RESTRICT`,
        /shared_world_materials_history_item_fk/u],
      ['QANDEEL could acquire a human author',
        `ALTER TABLE ${MATERIALS} DROP CONSTRAINT shared_world_materials_authorship_check`,
        /shared_world_materials_authorship_check/u],
      ['a text body could attach to a voice note',
        `ALTER TABLE ${TEXT_BODIES} DROP CONSTRAINT shared_world_text_material_bodies_material_fk`,
        /shared_world_text_material_bodies_material_fk/u],
      ['a MATERIAL_DEPENDENCY cycle becomes representable',
        `ALTER TABLE ${DEPENDENCIES} DROP CONSTRAINT shared_world_material_dependencies_source_precedes_check`,
        /shared_world_material_dependencies_source_precedes_check/u],
      ['a reasoning dependency could carry a material source',
        `ALTER TABLE ${DEPENDENCIES} DROP CONSTRAINT shared_world_material_dependencies_shape_check`,
        /shared_world_material_dependencies_shape_check/u],
      ['one target could carry two identical material edges',
        `DROP INDEX shared_world_material_dependencies_one_material_edge_idx`,
        /shared_world_material_dependencies_one_material_edge_idx still exists/u],
      ['an owned column is dropped',
        `ALTER TABLE ${MATERIALS} DROP COLUMN body_form CASCADE`,
        /still carries every column migration 0089 owns/u],
      ['an owned column becomes optional',
        `ALTER TABLE ${MATERIALS} ALTER COLUMN established_at DROP NOT NULL`,
        /still carries every column migration 0089 owns/u],
      ['a material relation becomes directly readable by an application role',
        `GRANT SELECT ON ${TEXT_BODIES} TO authenticated`,
        /authenticated must not hold SELECT/u],
      ['the material resolver becomes executable by authenticated',
        `GRANT EXECUTE ON FUNCTION ${RESOLVE_FN} TO authenticated`,
        /authenticated must not execute the material resolver/u],
      ['the material resolver is taken away from service_role',
        `REVOKE ALL ON FUNCTION ${RESOLVE_FN} FROM service_role`,
        /service_role must execute the ONE narrow material resolver/u],
      ['the ONE historical visibility entry point is taken away from service_role',
        `REVOKE ALL ON FUNCTION ${ENTRY_POINT_FN} FROM service_role`,
        /service_role must still execute the ONE historical visibility entry point/u],
      ['the material resolver starts re-deciding visibility for itself',
        `CREATE OR REPLACE FUNCTION public.resolve_shared_world_material_v1(p_world_id uuid, p_user_id uuid)
         RETURNS TABLE(world_id uuid, material_id uuid, history_item_id uuid, material_kind text,
                       established_at timestamptz, author_user_id uuid, text_body text,
                       audio_object_ref text, transcript_text text)
         LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
         BEGIN
           RETURN QUERY SELECT m.world_id, m.id, m.history_item_id, m.material_kind, m.established_at,
                               m.author_user_id, t.body_text, NULL::text, NULL::text
             FROM public.shared_world_materials m
             JOIN public.shared_world_text_material_bodies t ON t.material_id = m.id
            WHERE m.world_id = p_world_id;
         END$fn$`,
        /visibility is decided by the ONE frozen I-04F entry point/u],
      ['the material resolver starts disclosing sealed provenance',
        `CREATE OR REPLACE FUNCTION public.resolve_shared_world_material_v1(p_world_id uuid, p_user_id uuid)
         RETURNS TABLE(world_id uuid, material_id uuid, history_item_id uuid, material_kind text,
                       established_at timestamptz, author_user_id uuid, text_body text,
                       audio_object_ref text, transcript_text text)
         LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$
         BEGIN
           RETURN QUERY SELECT m.world_id, m.id, m.history_item_id, m.material_kind, m.established_at,
                               m.author_user_id, d.source_context_ref, NULL::text, NULL::text
             FROM public.resolve_shared_world_history_visibility_v1(p_world_id, p_user_id) visible
             JOIN public.shared_world_materials m ON m.history_item_id = visible.history_item_id
             JOIN public.shared_world_material_dependencies d ON d.target_material_id = m.id;
         END$fn$`,
        /discloses no shared_world_material_dependencies/u],
    ]) {
      stage = `forward safety: regression - ${reason}`;
      await q('SAVEPOINT forward_safety_regression');
      try {
        await q(plant);
        await assert.rejects(verifyCatalog(), refuses, `a database where ${reason} must still be refused`);
      } finally {
        await q('ROLLBACK TO SAVEPOINT forward_safety_regression');
        await q('RELEASE SAVEPOINT forward_safety_regression');
      }
    }
    stage = 'forward safety: every planted regression was reverted';
    await verifyCatalog();
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
    await identity('postgres');
  }
  stage = 'forward safety: the present-day catalog is unchanged';
  await verifyCatalog();
}

// ---------------------------------------------------------------------------

async function provisionHumans(humanIds) {
  await identity('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humanIds]);
}

async function main() {
  const f = {
    inviter: randomUUID(), second: randomUUID(), third: randomUUID(), outsider: randomUUID(),
    forwardSecond: randomUUID(),
  };
  f.humans = Object.values(f);
  try {
    await client.connect();
    await verifyCatalog();
    await q('BEGIN');
    try {
      await provisionHumans(f.humans);
      await verifyStructure(f);
      await verifyResolver(f);
      await verifyForwardSafety(f);
      await identity('postgres');
    } finally {
      await q('ROLLBACK');
    }

    stage = 'fixture residue';
    await identity('postgres');
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${MATERIALS} WHERE author_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${COMMIT_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${DELETE_COMMANDS} WHERE actor_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${EPISODES} WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${CREDENTIAL} WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${INVITATIONS} WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`, [f.humans]);
    assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back');

    console.log('migration 0089 verified: real Shared material - bound, bodied, provenanced and sealed');
  } catch (error) {
    console.error(`migration 0089 verification failed at stage: ${stage}`);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

void (async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();

