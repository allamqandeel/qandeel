// S5-02 — Public Publishing, Rights, Draft / Review & Privacy Closure v1: the real-PostgreSQL verifier for migration 0143.
//
// It proves, against a fully migrated database:
//   1. the boundary: every S5-02 function is a pinned `public_authoring_private` SECURITY DEFINER or a pinned `public`
//      INVOKER wrapper; `authenticated` executes exactly the nine owner commands and nothing else; no owner command
//      accepts an account, ref, label, approver, authority, audience or body input; no frozen I-05 primitive became
//      application-executable; nothing S5-02 owns names the publish boundary or the CW2-08 seam; the 0092 guard still
//      holds all seven package relations; owner deletion erases; exactly one function deletes a Public body;
//   2. identity (E2E-H-08): no I-05 identity by entering, reading, choosing a display mode or listing; the first real
//      authoring act provisions exactly ONE identity (concurrently too); PSEUDONYM renders the CURRENT Public ID and
//      REAL_NAME the CURRENT full 80-character Name through the controller review, with no stale label;
//   3. rights: only a legal source prepares (one non-enumerating UNAVAILABLE for hidden, foreign or absent material);
//      the exact rightsholders — and nobody else, not a non-rightsholder member, not the controller for another's item —
//      approve; an approver sees only the exact included content requiring their approval; READY needs every CURRENT effective approval; a
//      withdrawal is immediate and never resurrected (and the frozen READY commit, which ignores it, is unreachable);
//      approval never grants control; source deletion before READY fails closed;
//   4. privacy (ASSURE-F05): owner deletion — through the application path too — physically erases every Public copy
//      of a Shared material it physically erases (the deleted source, and every target of its transitive
//      MATERIAL_DEPENDENCY closure, whatever the item's ANALYTICAL label: S5-02 R1, G16), its body and both digests, in
//      the same transaction at the canonical instant, and a whole-database census finds neither the bytes nor their
//      digest anywhere; audit identity survives; both review boundaries go dark and never present a partial package; an
//      equivalent REASONING_DEPENDENCY output, and an output unrelated to the deleted source, keep their bytes; the transition is one-way
//      and every other package mutation is still refused; an equivalent retry re-proves the erasure; already-unsafe rows
//      (closure targets included) are reconciled forward and contradictory state refuses deployment;
//   5. concurrency, on real connections: delete-first leaves the preparation failing closed with nothing written;
//      prepare-first is erased by the deletion it waited for; a burst of races produces no deadlock and no committed
//      deletion beside surviving bytes;
//   6. launch closure: the seam still answers NOT_EVALUATED; no application role can publish; no PUBLISHED Experience.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { APP_ROLES, NONE, SEAM, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, actAs, asRole, rejected } = rt;
/** Every direct read of a sealed relation is the table owner's, whatever role the previous step left in force. */
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };
const ownCount = async (table, where, values) => { await asRole('postgres'); return rt.count(table, where, values); };

const OWNER_COMMANDS = {
  start_own_public_experience_draft_v1: ['p_command_id uuid'],
  list_own_public_drafts_v1: [],
  list_own_public_authoring_sources_v1: [],
  prepare_own_public_experience_package_v1: ['p_command_id uuid', 'p_experience_id uuid', 'p_personal_unit_ids uuid[]',
    'p_shared_world_ids uuid[]', 'p_shared_material_ids uuid[]'],
  read_own_public_experience_review_v1: ['p_experience_id uuid'],
  list_own_public_approval_requests_v1: [],
  approve_own_public_package_v1: ['p_command_id uuid', 'p_manifest_version_id uuid'],
  withdraw_own_public_approval_v1: ['p_command_id uuid', 'p_manifest_version_id uuid'],
  commit_own_public_experience_ready_v1: ['p_command_id uuid', 'p_experience_id uuid'],
};
const INTERNAL = ['erase_owner_deleted_public_derivatives_v1', 'public_package_state_v1', 'derive_authoring_identity_v1',
  'require_authoring_actor_v1', 'classify_public_refusal_v1', 'provision_own_public_identity_v1',
  'refuse_erased_body_resurrection_v1'];
const FROZEN = ['public.ensure_public_identity_v1(uuid, uuid, text, text)', 'public.update_public_display_label_v1(uuid, text, text)',
  'public.create_public_experience_draft_v1(uuid, uuid)',
  'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])',
  'public.approve_public_experience_manifest_v1(uuid, uuid)', 'public.withdraw_publication_approval_v1(uuid, uuid)',
  'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)', 'public.publish_public_experience_v1(uuid, uuid, uuid)',
  SEAM, 'public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid)'];
const PACKAGE_RELATIONS = [T.MANIFESTS, T.ITEMS, T.BODIES, T.PROVENANCE, T.ITEM_AUTHORITY, T.REQUIRED, T.APPROVALS];

// ---- the S5-02 owner commands, as the human's own application role
const as = async (uid) => asRole('authenticated', uid);
const startDraft = async (uid, command) => { await as(uid); return (await rows('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [command]))[0]; };
const drafts = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_public_drafts_v1()'); };
const sources = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_public_authoring_sources_v1()'); };
const prepareOwn = async (uid, command, experience, units, worlds, materials) => {
  await as(uid);
  return (await rows('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
    [command, experience, units, worlds, materials]))[0];
};
const reviewOwn = async (uid, experience) => { await as(uid); return rows('SELECT * FROM public.read_own_public_experience_review_v1($1)', [experience]); };
const requests = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_public_approval_requests_v1()'); };
const approveOwn = async (uid, command, manifest) => { await as(uid); return (await rows('SELECT * FROM public.approve_own_public_package_v1($1, $2)', [command, manifest]))[0]; };
const withdrawOwn = async (uid, command, manifest) => { await as(uid); return (await rows('SELECT * FROM public.withdraw_own_public_approval_v1($1, $2)', [command, manifest]))[0]; };
const readyOwn = async (uid, command, experience) => { await as(uid); return (await rows('SELECT * FROM public.commit_own_public_experience_ready_v1($1, $2)', [command, experience]))[0]; };

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const identitiesOf = async (uid) => { await asRole('postgres'); return rows(`SELECT public_identity_ref FROM ${T.IDENTITIES} WHERE user_id = $1`, [uid]); };
const manifestOf = async (experience) => {
  await asRole('postgres');
  const [row] = await rows(`SELECT v.package_manifest_version_id m FROM ${T.EXPERIENCES} e
    JOIN ${T.VERSIONS} v ON v.id = e.current_experience_version_id WHERE e.id = $1`, [experience]);
  return row?.m ?? null;
};
const itemFor = async (manifest, material) => {
  await asRole('postgres');
  const [row] = await rows(`SELECT it.*, p.captured_source_digest, p.captured_digest_erased_at, p.shared_material_id
      FROM ${T.PROVENANCE} p JOIN ${T.ITEMS} it ON it.package_item_id = p.package_item_id
     WHERE p.manifest_version_id = $1 AND p.shared_material_id = $2`, [manifest, material]);
  return row;
};
const bodyOf = async (item) => { await asRole('postgres'); return (await rows(`SELECT public_text_body FROM ${T.BODIES} WHERE package_item_id = $1`, [item]))[0]?.public_text_body ?? null; };

/**
 * THE WHOLE-DATABASE CENSUS. Every text-like column of every application relation is asked for the exact deleted bytes
 * and for their digest (hex, the form every QANDEEL digest takes), and every bytea column for the raw digest. A
 * physically erased secret answers zero everywhere.
 */
async function censusOf(text) {
  await asRole('postgres');
  const hex = sha(text);
  const columns = await rows(`SELECT n.nspname s, c.relname t, a.attname col, format_type(a.atttypid, a.atttypmod) ty
      FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
       AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       AND (a.atttypid IN ('text'::regtype, 'varchar'::regtype, 'bpchar'::regtype, 'bytea'::regtype, 'jsonb'::regtype, 'json'::regtype))`);
  const hits = [];
  for (const { s, t, col, ty } of columns) {
    const ident = `"${s}"."${t}"`;
    const sql = ty === 'bytea'
      ? `SELECT count(*) n FROM ${ident} WHERE "${col}" = decode($1, 'hex')`
      : `SELECT count(*) n FROM ${ident} WHERE strpos("${col}"::text, $2) > 0 OR strpos("${col}"::text, $1) > 0`;
    const [{ n }] = await rows(sql, ty === 'bytea' ? [hex] : [hex, text]);
    if (Number(n) > 0) hits.push(`${s}.${t}.${col}`);
  }
  return { columns: columns.length, hits };
}

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT n.nspname, p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner,
      pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public_authoring_private' ORDER BY 2`);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...Object.keys(OWNER_COMMANDS), ...INTERNAL].sort(),
    'B01 the private schema holds exactly the S5-02 functions');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `B01 ${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres');
    assert.deepEqual(f.proconfig, ['search_path=""'], `B01 ${f.proname} pins an empty search_path`);
  }
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
  [Object.keys(OWNER_COMMANDS)]);
  assert.equal(wrappers.length, Object.keys(OWNER_COMMANDS).length, 'B02 each owner command has exactly one public wrapper');
  for (const w of wrappers) {
    assert.equal(w.prosecdef, false, `B02 public.${w.proname} is an INVOKER wrapper`);
    assert.deepEqual(w.proconfig, ['search_path=""']);
    assert.equal(w.args, OWNER_COMMANDS[w.proname].join(', '), `B03 public.${w.proname} accepts exactly its frozen inputs`);
  }
  // B03 no owner command accepts an account, ref, label, approver, authority, audience, body or clearance input.
  for (const [name, inputs] of Object.entries(OWNER_COMMANDS)) {
    for (const input of inputs) {
      assert.doesNotMatch(input, /user|actor|identity|label|approver|rightsholder|authority|audience|body|digest|fingerprint|visib|clearance|lifecycle|ref\b/u,
        `B03 ${name} input ${input} is no authority claim`);
    }
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = 'public_authoring_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(OWNER_COMMANDS), APP_ROLES]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(),
    Object.keys(OWNER_COMMANDS).flatMap((n) => [`authenticated public.${n}`, `authenticated public_authoring_private.${n}`]).sort(),
    'B04 authenticated runs the nine owner commands only; anon and the server channel run nothing; no internal helper is reachable');
  const publicExec = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = 'public_authoring_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')`,
  [Object.keys(OWNER_COMMANDS)]);
  assert.deepEqual(publicExec, [], 'B04 no S5-02 function keeps PUBLIC EXECUTE');
  const [{ tables }] = await rows(`SELECT count(*)::int tables FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public_authoring_private' AND c.relkind IN ('r', 'p', 'v', 'm')`);
  assert.equal(tables, 0, 'B05 the S5-02 schema holds no relation: no second publication model');
  for (const fn of FROZEN) {
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false, `B06 ${role} must not execute the frozen ${fn}`);
    }
  }
  assert.equal(await rt.canExecute('authenticated', 'public.resolve_public_experience_review_v1(uuid, uuid)'), false,
    'B06 the frozen review resolver stays server-only');
  // B07 nothing S5-02 owns reaches publication, the seam, a public lifecycle or the label primitive.
  const bodies = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public_authoring_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[]))`, [Object.keys(OWNER_COMMANDS)]);
  for (const b of bodies) {
    assert.doesNotMatch(b.prosrc, /publish_public_experience_v1|resolve_public_publication_prerequisites_v1|'PUBLISHED'|ABSENT_FROM_PUBLIC_WORLD|semantic_placement|public_discussion|public_qandeel|update_public_display_label_v1/u,
      `B07 ${b.proname} reaches nothing beyond DRAFT → READY_FOR_REVIEW`);
  }
  // B08 the 0092 guard still holds every package relation; owner deletion erases; one body destroyer.
  for (const table of PACKAGE_RELATIONS) {
    const [tg] = await rows(`SELECT tg.tgenabled FROM pg_trigger tg WHERE tg.tgrelid = $1::regclass AND NOT tg.tgisinternal
      AND tg.tgfoid = 'public.reject_publication_package_mutation_v1'::regproc`, [table]);
    assert.equal(tg?.tgenabled, 'O', `B08 ${table} keeps the enabled append-only guard`);
  }
  const deletion = (await rt.functionPosture('public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid)')).prosrc;
  assert.match(deletion, /public_authoring_private\.erase_owner_deleted_public_derivatives_v1\(p_material_id, delete_instant\)/u,
    'B08 canonical owner deletion erases the Public derivative at its own instant');
  assert.ok(deletion.indexOf('public_authoring_private.erase_owner_deleted_public_derivatives_v1')
    > deletion.indexOf("SET availability_state = 'DELETED_BY_OWNER'"), 'B08 after the terminal transition it proves');
  const destroyers = await rows(`SELECT n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prorettype <> 'trigger'::regtype
      AND p.prosrc ~ 'DELETE FROM public\\.public_experience_text_derivative_bodies'`);
  assert.deepEqual(destroyers.map((d) => d.fn), ['public_authoring_private.erase_owner_deleted_public_derivatives_v1'],
    'B08 exactly one function destroys a Public derivative body');
  // B09 the Name ceiling.
  const [label] = await rows(`SELECT pg_get_constraintdef(c.oid) d FROM pg_constraint c WHERE c.conrelid = $1::regclass
    AND c.conname = 'public_identity_display_label_check'`, [T.DISPLAY]);
  assert.match(label.d, /<= 80/u, 'B09 a display label holds 80 characters');
  const seam = (await rt.functionPosture(SEAM)).prosrc;
  assert.ok(seam.includes('NOT_EVALUATED') && !seam.includes("'CLEARED'"), 'B10 the CW2-08 seam still answers NOT_EVALUATED');
}

// ------------------------------------------------------------------------------------------------------------- fixture
async function fixture() {
  const f = rt.newFixture();
  f.member = randomUUID();
  f.f05Material = randomUUID();
  f.f05Text = `S5-02 erasure probe ${randomUUID()}`;
  f.analysisTarget = randomUUID();
  await asRole('postgres');
  await rt.provision(f);
  await q('INSERT INTO auth.users(id) VALUES ($1)', [f.member]);
  // A CURRENT member who can see everything Mohamed sees and is the rightsholder of nothing.
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
           VALUES ($1, $2, $3, now(), NULL)`, [randomUUID(), f.world, f.member]);
  await q(`INSERT INTO public.shared_world_history_item_baseline_viewers (history_item_id, user_id)
           SELECT m.history_item_id, $2 FROM public.shared_world_materials m WHERE m.world_id = $1 AND m.id <> $3`,
  [f.world, f.member, f.hiddenMaterial]);
  // Hadir's own sentence for the erasure proofs, seen by Mohamed and the member.
  const item = await rt.commitMaterial(f.world, f.f05Material, 'HUMAN_TEXT', f.hadir, f.f05Text,
    'EXACT_HUMAN_APPROVER_SET', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
  await q('INSERT INTO public.shared_world_history_item_baseline_viewers (history_item_id, user_id) VALUES ($1, $2)', [item, f.member]);
  return f;
}

// --------------------------------------------------------------------------------------------------------- 2. identity
async function verifyIdentity(f) {
  // I01 entering, reading, choosing and listing provision nothing.
  for (const uid of [f.mohamed, f.hadir]) {
    await as(uid);
    assert.equal((await rows('SELECT * FROM public.read_public_world_entry_v1()'))[0].verdict, 'ALLOW');
    await rows('SELECT * FROM public.read_own_public_display_v1()');
    await rows('SELECT * FROM public.set_own_public_display_mode_v1($1)', ['PSEUDONYM']);
    await drafts(uid); await sources(uid); await requests(uid);
    assert.deepEqual(await identitiesOf(uid), [], 'I01 no I-05 identity by entering, reading, choosing or listing');
  }
  // I02 the first real authoring act provisions exactly ONE identity, PSEUDONYM = the CURRENT Public ID.
  const [{ public_id: mohamedId }] = await own('SELECT public_id FROM public.users WHERE id = $1', [f.mohamed]);
  const first = await startDraft(f.mohamed, randomUUID());
  assert.equal(first.outcome, 'CREATED');
  assert.equal(first.current_lifecycle, 'DRAFT');
  const [ref] = await identitiesOf(f.mohamed);
  assert.ok(ref, 'I02 the first authoring act created the identity');
  assert.notEqual(ref.public_identity_ref, f.mohamed, 'I02 the opaque ref is not the account id');
  const [display] = await own(`SELECT label_mode, display_label FROM ${T.DISPLAY} WHERE public_identity_ref = $1`, [ref.public_identity_ref]);
  assert.deepEqual(display, { label_mode: 'PSEUDONYM', display_label: mohamedId }, 'I02 PSEUDONYM renders the CURRENT Public ID');
  const [{ controllers }] = await own(`SELECT count(*)::int controllers FROM ${T.CONTROLLERS} WHERE experience_id = $1 AND controller_user_id = $2`,
    [first.experience_id, f.mohamed]);
  assert.equal(controllers, 1, 'I02 control goes to the exact creating human');
  // I03 a retry and a second Draft reuse the ONE identity.
  const retry = await startDraft(f.mohamed, randomUUID());
  assert.equal(retry.outcome, 'CREATED');
  assert.deepEqual(await identitiesOf(f.mohamed), [ref], 'I03 one human, one stable Public Identity');
  // I04 REAL_NAME = the CURRENT full 80-character Name, through to the review, never stale, never truncated.
  const name80 = `Hadir ${'q'.repeat(74)}`;
  assert.equal(name80.length, 80);
  await asRole('postgres');
  // A Name and a Login ID are set together (users_account_identity_pair_check), exactly as sign-up writes them.
  await q('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [f.hadir, name80, `s502h${randomUUID().slice(0, 8)}`]);
  await as(f.hadir);
  assert.equal((await rows('SELECT * FROM public.set_own_public_display_mode_v1($1)', ['REAL_NAME']))[0].outcome, 'UPDATED');
  const hadirDraft = await startDraft(f.hadir, randomUUID());
  const [hadirReview] = await reviewOwn(f.hadir, hadirDraft.experience_id);
  assert.equal(hadirReview.review_state, 'NO_PACKAGE');
  assert.deepEqual([hadirReview.publisher_label_mode, hadirReview.publisher_display_label], ['REAL_NAME', name80],
    'I04 the controller review renders the exact 80-character Name, byte for byte');
  await as(f.hadir);
  assert.equal((await rows('SELECT * FROM public.change_own_account_name_v1($1)', ['Hadir Renamed'])).at(0).outcome, 'CHANGED');
  const [renamed] = await reviewOwn(f.hadir, hadirDraft.experience_id);
  assert.equal(renamed.publisher_display_label, 'Hadir Renamed', 'I04 a Name change leaves no stale label');
  await as(f.hadir);
  await rows('SELECT * FROM public.set_own_public_display_mode_v1($1)', ['PSEUDONYM']);
  const [{ public_id: hadirId }] = await own('SELECT public_id FROM public.users WHERE id = $1', [f.hadir]);
  assert.equal((await reviewOwn(f.hadir, hadirDraft.experience_id))[0].publisher_display_label, hadirId,
    'I04 the mode change renders the CURRENT Public ID');
  // I05 no label, ref or account can be supplied; a signed-out caller reaches nothing.
  await as(f.mohamed);
  await rejected(() => q('SELECT * FROM public.start_own_public_experience_draft_v1($1, $2)', [randomUUID(), 'a chosen label']), ['42883']);
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()]), ['42501']);
  await asRole('authenticated');
  await rejected(() => q('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()]), ['42501']);
  return { mohamedDraft: first.experience_id, hadirDraft: hadirDraft.experience_id };
}

// ------------------------------------------------------------------------------------------------------------ 3. rights
async function verifyRights(f, d) {
  const exp = d.mohamedDraft;
  // R01 the eligible sources: own USER text, and visible, available, resolved Shared text. Nothing hidden or foreign.
  const mine = await sources(f.mohamed);
  assert.deepEqual(mine.filter((s) => s.source_kind === 'PERSONAL').map((s) => s.source_id), [f.userUnit],
    'R01 own committed Personal text, and never Personal QANDEEL analysis');
  assert.deepEqual(mine.filter((s) => s.source_kind === 'SHARED').map((s) => s.source_id).sort(),
    [f.mohamedMaterial, f.hadirMaterial, f.noHumanMaterial, f.f05Material].sort(),
    'R01 visible Shared text with resolved authority; never hidden, unresolved, metadataless or voice material');
  assert.deepEqual((await sources(f.stranger)).map((s) => s.source_id), [], 'R01 a stranger enumerates nothing of anyone');
  // R02 a hidden, a foreign or an absent source is ONE non-enumerating UNAVAILABLE; nothing is written.
  const before = await ownCount(T.MANIFESTS, 'experience_id = $1', [exp]);
  for (const [units, worlds, materials] of [
    [NONE, [f.world], [f.hiddenMaterial]], [NONE, [f.world], [randomUUID()]], [NONE, [randomUUID()], [f.mohamedMaterial]],
  ]) {
    assert.equal((await prepareOwn(f.mohamed, randomUUID(), exp, units, worlds, materials)).outcome, 'UNAVAILABLE', 'R02 hidden / absent');
  }
  assert.equal((await prepareOwn(f.hadir, randomUUID(), d.hadirDraft, [f.userUnit], NONE, NONE)).outcome, 'UNAVAILABLE',
    'R02 another human\'s Personal text is unavailable, the same answer as an absent one');
  assert.equal((await prepareOwn(f.hadir, randomUUID(), d.hadirDraft, [randomUUID()], NONE, NONE)).outcome, 'UNAVAILABLE');
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), exp, NONE, [f.world], [f.voiceMaterial])).outcome, 'NOT_PUBLISHABLE',
    'R02 no Public Voice derivative is fabricated');
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), exp, [f.assistantUnit], NONE, NONE)).outcome, 'NOT_PUBLISHABLE',
    'R02 Personal QANDEEL analysis has no resolvable authority');
  assert.equal((await prepareOwn(f.hadir, randomUUID(), exp, NONE, [f.world], [f.mohamedMaterial])).outcome, 'UNAVAILABLE',
    'R02 nobody prepares another human\'s Draft');
  await as(f.mohamed);
  await rejected(() => q('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
    [randomUUID(), exp, NONE, NONE, NONE]), ['22023']);
  assert.equal(await ownCount(T.MANIFESTS, 'experience_id = $1', [exp]), before, 'R02 a refused preparation writes nothing');
  // R03 the legal package: own Personal text, own Shared text, Hadir's Shared text.
  const prepared = await prepareOwn(f.mohamed, randomUUID(), exp, [f.userUnit], [f.world, f.world], [f.mohamedMaterial, f.hadirMaterial]);
  assert.deepEqual(prepared, { outcome: 'PREPARED', item_count: 3, required_approver_count: 2 });
  const manifest = await manifestOf(exp);
  const required = (await own(`SELECT approver_user_id a FROM ${T.REQUIRED} WHERE manifest_version_id = $1 ORDER BY 1`, [manifest])).map((r) => r.a);
  assert.deepEqual(required, [f.mohamed, f.hadir].sort(), 'R03 the exact rightsholders of the included material, and nobody else');
  // R04 the controller's truthful review: exactly the bytes, the CURRENT display, counts only.
  const review = await reviewOwn(f.mohamed, exp);
  assert.deepEqual(review.map((r) => r.review_state), ['CURRENT', 'CURRENT', 'CURRENT']);
  assert.deepEqual(review.map((r) => r.public_text_body).sort(),
    [f.userText, 'a sentence Mohamed wrote', 'a sentence Hadir wrote'].sort(), 'R04 exactly what is proposed to become public');
  assert.deepEqual([review[0].required_approver_count, review[0].effective_approval_count, review[0].own_approval_state, review[0].ready_allowed],
    [2, 0, 'MISSING', false]);
  for (const column of Object.keys(review[0])) {
    assert.doesNotMatch(column, /user_id|ref$|email|phone|world|material|history|session|turn|provenance|digest|fingerprint/u,
      `R04 the review discloses no ${column}`);
  }
  assert.deepEqual(await reviewOwn(f.hadir, exp), [], 'R04 a rightsholder is not the controller and sees no review');
  assert.deepEqual(await reviewOwn(f.member, exp), [], 'R04 nor does a Shared member');
  // R05 the approver's own request: only their own bytes.
  const hadirRequests = await requests(f.hadir);
  assert.deepEqual(hadirRequests.map((r) => [r.manifest_version_id, r.request_state, r.own_item_count, r.item_count, r.public_text_body]),
    [[manifest, 'CURRENT', 1, 3, 'a sentence Hadir wrote']], 'R05 Hadir sees exactly her own included sentence and nobody else\'s');
  assert.deepEqual(await requests(f.member), [], 'R05 a Shared member who is no rightsholder is asked nothing');
  assert.deepEqual(await requests(f.stranger), []);
  // R06 the wrong human cannot approve; membership is no approval authority; the controller cannot stand in.
  for (const uid of [f.stranger, f.member]) {
    assert.deepEqual(await approveOwn(uid, randomUUID(), manifest), { outcome: 'UNAVAILABLE', own_approval_state: null }, 'R06');
  }
  assert.equal(await ownCount(T.APPROVALS, 'manifest_version_id = $1', [manifest]), 0, 'R06 and nothing was recorded');
  assert.deepEqual(await approveOwn(f.mohamed, randomUUID(), manifest), { outcome: 'APPROVED', own_approval_state: 'EFFECTIVE' });
  assert.deepEqual(await readyOwn(f.mohamed, randomUUID(), exp), { outcome: 'APPROVALS_INCOMPLETE', current_lifecycle: 'DRAFT' },
    'R06 the controller\'s own approval never substitutes for Hadir\'s');
  // R07 approval, then withdrawal: immediate, and never resurrected.
  const approval = randomUUID();
  assert.deepEqual(await approveOwn(f.hadir, approval, manifest), { outcome: 'APPROVED', own_approval_state: 'EFFECTIVE' });
  assert.deepEqual(await approveOwn(f.hadir, approval, manifest), { outcome: 'APPROVED', own_approval_state: 'EFFECTIVE' }, 'R07 an equivalent retry');
  assert.equal((await reviewOwn(f.mohamed, exp))[0].ready_allowed, true, 'R07 every current approval is effective');
  await q('SAVEPOINT withdrawal');
  assert.deepEqual(await withdrawOwn(f.hadir, randomUUID(), manifest), { outcome: 'WITHDRAWN' });
  const afterWithdrawal = (await reviewOwn(f.mohamed, exp))[0];
  assert.deepEqual([afterWithdrawal.effective_approval_count, afterWithdrawal.ready_allowed], [1, false], 'R07 the withdrawal is effective immediately');
  assert.deepEqual(await readyOwn(f.mohamed, randomUUID(), exp), { outcome: 'APPROVALS_INCOMPLETE', current_lifecycle: 'DRAFT' });
  assert.equal((await approveOwn(f.hadir, randomUUID(), manifest)).outcome, 'ALREADY_DECIDED', 'R07 a withdrawn approval is never resurrected');
  assert.equal(await ownCount(T.APPROVALS, 'manifest_version_id = $1', [manifest]), 2, 'R07 the consent history is immutable evidence');
  assert.equal((await requests(f.hadir))[0].own_approval_state, 'WITHDRAWN');
  // The frozen 0121 READY commit counts approval ROWS and ignores 0094 withdrawals; the S5-02 boundary is what closes
  // that, and the frozen primitive itself is executable by no application role.
  await q('SAVEPOINT frozen');
  await asRole('postgres');
  await actAs(f.mohamed);
  const [frozen] = await rt.commitReady(randomUUID(), exp, (await rows(`SELECT current_experience_version_id v FROM ${T.EXPERIENCES} WHERE id = $1`, [exp]))[0].v);
  assert.equal(frozen.outcome, 'READY_FOR_REVIEW', 'R07 (why the gate exists) the raw frozen commit would accept a withdrawn approval');
  await q('ROLLBACK TO SAVEPOINT frozen'); await q('RELEASE SAVEPOINT frozen');
  await q('ROLLBACK TO SAVEPOINT withdrawal'); await q('RELEASE SAVEPOINT withdrawal');
  // R08 source deletion before READY fails closed (and is the F05 erasure, proven in full below).
  await q('SAVEPOINT deletion');
  await asRole('postgres'); await actAs(f.hadir);
  await rt.deleteMaterial(randomUUID(), f.world, f.hadirMaterial, randomUUID());
  assert.deepEqual((await reviewOwn(f.mohamed, exp)).map((r) => [r.review_state, r.public_text_body]), [['UNAVAILABLE', null]],
    'R08 the review fails closed and is never rendered as complete');
  assert.deepEqual(await readyOwn(f.mohamed, randomUUID(), exp), { outcome: 'UNAVAILABLE', current_lifecycle: 'DRAFT' });
  await q('ROLLBACK TO SAVEPOINT deletion'); await q('RELEASE SAVEPOINT deletion');
  // R09 approval never grants control.
  assert.deepEqual(await readyOwn(f.hadir, randomUUID(), exp), { outcome: 'UNAVAILABLE', current_lifecycle: null }, 'R09');
  assert.equal(await ownCount(T.CONTROLLERS, 'experience_id = $1 AND controller_user_id = $2', [exp, f.hadir]), 0);
  // R10 DRAFT → READY_FOR_REVIEW with current complete authority — and nothing further.
  const readyCommand = randomUUID();
  assert.deepEqual(await readyOwn(f.mohamed, readyCommand, exp), { outcome: 'READY_FOR_REVIEW', current_lifecycle: 'READY_FOR_REVIEW' });
  assert.deepEqual(await readyOwn(f.mohamed, readyCommand, exp), { outcome: 'ALREADY_READY', current_lifecycle: 'READY_FOR_REVIEW' }, 'R10 retry');
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), exp, [f.userUnit], NONE, NONE)).outcome, 'NOT_DRAFT', 'R10 no edit after READY');
  assert.equal((await reviewOwn(f.mohamed, exp))[0].current_lifecycle, 'READY_FOR_REVIEW');
  return { exp, manifest };
}

// --------------------------------------------------------------------------------------------------------- 4. privacy
async function verifyPrivacy(f, d, ready) {
  // A package that copies Hadir's sentence AND an analytical item, prepared through the S5-02 boundary; a second
  // Experience whose sources are unrelated, so collateral damage would show.
  const exp = (await startDraft(f.mohamed, randomUUID())).experience_id;
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), exp, NONE, [f.world, f.world], [f.f05Material, f.noHumanMaterial])).outcome, 'PREPARED');
  const manifest = await manifestOf(exp);
  const other = (await startDraft(f.mohamed, randomUUID())).experience_id;
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), other, [f.userUnit], NONE, NONE)).outcome, 'PREPARED');
  // P01 THE UNSAFE PRECONDITION: the exact bytes, and two unsalted digests of them, held by the package.
  const copied = await itemFor(manifest, f.f05Material);
  assert.equal(copied.derivative_classification, 'SOURCE_CONTENT_BEARING_DERIVATIVE');
  assert.equal(await bodyOf(copied.package_item_id), f.f05Text, 'P01 the package holds the exact bytes');
  assert.equal(copied.public_body_digest, `sha256:${sha(f.f05Text)}`);
  assert.equal(copied.captured_source_digest, `sha256:${sha(f.f05Text)}`);
  assert.deepEqual((await censusOf(f.f05Text)).hits.sort(), ['public.public_experience_text_derivative_bodies.public_text_body',
    'public.publication_package_item_provenance.captured_source_digest', 'public.publication_package_manifest_items.public_body_digest',
    'public.shared_world_text_material_bodies.body_text'].sort(), 'P01 the census sees every copy and every verifier before deletion');
  const analytical = await itemFor(manifest, f.noHumanMaterial);
  assert.equal(analytical.derivative_classification, 'ANALYTICAL_DERIVATIVE');
  const identityBefore = await own(`SELECT package_item_id, item_ordinal, derivative_classification FROM ${T.ITEMS} WHERE manifest_version_id = $1 ORDER BY 2`, [manifest]);
  const provenanceBefore = await own(`SELECT package_item_id, source_class, shared_world_id, shared_material_id, shared_history_item_id,
    captured_availability_state, captured_availability_revision FROM ${T.PROVENANCE} WHERE manifest_version_id = $1 ORDER BY 1`, [manifest]);

  // P02 CANONICAL OWNER DELETION ERASES IN ONE TRANSACTION AT THE CANONICAL INSTANT.
  const deleteCommand = randomUUID();
  const deleteEvent = randomUUID();
  await asRole('postgres'); await actAs(f.hadir);
  const [deleted] = await rt.deleteMaterial(deleteCommand, f.world, f.f05Material, deleteEvent);
  assert.equal(deleted.outcome, 'MATERIAL_DELETED');
  const erased = await itemFor(manifest, f.f05Material);
  assert.equal(erased.content_state, 'ERASED_BY_OWNER', 'P02 the item records the erasure');
  assert.equal(erased.public_body_digest, null, 'P02 the public digest is GONE');
  assert.equal(erased.captured_source_digest, null, 'P02 the captured source digest is GONE');
  assert.equal(await bodyOf(erased.package_item_id), null, 'P02 the public bytes are GONE');
  const [{ occurred_at: deletedAt }] = await own('SELECT occurred_at FROM public.shared_world_material_deleted_events WHERE id = $1', [deleteEvent]);
  assert.equal(erased.content_erased_at.getTime(), deletedAt.getTime(), 'P02 at the canonical deletion instant');
  assert.equal(erased.captured_digest_erased_at.getTime(), deletedAt.getTime());
  assert.equal(deleted.deleted_at.getTime(), deletedAt.getTime());
  // P03 NO VERIFIER SURVIVES ANYWHERE: the whole-database census finds neither the bytes nor their digest.
  const census = await censusOf(f.f05Text);
  assert.ok(census.columns > 100, 'P03 the census really read the schema');
  assert.deepEqual(census.hits, [], 'P03 the deleted bytes and their digest exist in no column of any relation');
  // P04 AUDIT IDENTITY SURVIVES.
  assert.deepEqual(await own(`SELECT package_item_id, item_ordinal, derivative_classification FROM ${T.ITEMS} WHERE manifest_version_id = $1 ORDER BY 2`, [manifest]),
    identityBefore, 'P04 every item, ordinal and classification survives');
  assert.deepEqual(await own(`SELECT package_item_id, source_class, shared_world_id, shared_material_id, shared_history_item_id,
    captured_availability_state, captured_availability_revision FROM ${T.PROVENANCE} WHERE manifest_version_id = $1 ORDER BY 1`, [manifest]),
  provenanceBefore, 'P04 the sealed provenance identity survives');
  assert.equal(Number((await own(`SELECT item_count FROM ${T.MANIFESTS} WHERE id = $1`, [manifest]))[0].item_count), 2, 'P04 the manifest is not shrunk');
  // P05 ANALYTICAL ITEMS ARE NOT ERASED, AND ANOTHER PACKAGE IS UNTOUCHED.
  const stillAnalytical = await itemFor(manifest, f.noHumanMaterial);
  assert.equal(stillAnalytical.content_state, 'CONTENT_PRESENT', 'P05 an analytical derivative is not erased because another source went');
  assert.equal(await bodyOf(stillAnalytical.package_item_id), 'output with no protected human subject');
  assert.equal((await reviewOwn(f.mohamed, other))[0].review_state, 'CURRENT', 'P05 an unrelated package is untouched');
  // P06 BOTH REVIEW BOUNDARIES ARE DARK, AND NEVER PARTIAL.
  assert.deepEqual((await reviewOwn(f.mohamed, exp)).map((r) => [r.review_state, r.public_text_body]), [['UNAVAILABLE', null]],
    'P06 the controller is told the package is unavailable, never shown a partial one');
  await asRole('service_role');
  assert.deepEqual(await rt.review(exp, f.mohamed), [], 'P06 the frozen server-only resolver serves nothing of it either');
  assert.ok((await rt.review(other, f.mohamed)).length > 0, 'P06 while an intact package still reviews');
  assert.deepEqual((await requests(f.hadir)).filter((r) => r.manifest_version_id === manifest).map((r) => [r.request_state, r.public_text_body]),
    [['UNAVAILABLE', null]], 'P06 Hadir\'s request is UNAVAILABLE, with no byte: her source is gone');
  await asRole('postgres');
  await rt.assertCompletelyDark(exp, f.reader, {});
  // P07 ONE WAY ONLY, AND EVERYTHING ELSE IS STILL IMMUTABLE — for the table owner too.
  const refusedOps = [
    [`UPDATE ${T.ITEMS} SET content_state = 'CONTENT_PRESENT', public_body_digest = $2, content_erased_at = NULL WHERE package_item_id = $1`, [erased.package_item_id, `sha256:${sha(f.f05Text)}`]],
    [`UPDATE ${T.PROVENANCE} SET captured_source_digest = $2, captured_digest_erased_at = NULL WHERE package_item_id = $1`, [erased.package_item_id, `sha256:${sha('x')}`]],
    [`UPDATE ${T.ITEMS} SET item_ordinal = item_ordinal + 10 WHERE package_item_id = $1`, [erased.package_item_id]],
    [`UPDATE ${T.ITEMS} SET content_erased_at = content_erased_at + interval '1 second' WHERE package_item_id = $1`, [erased.package_item_id]],
    [`INSERT INTO ${T.BODIES} (package_item_id, public_body_form, public_text_body) VALUES ($1, 'PUBLIC_TEXT', 'resurrected')`, [erased.package_item_id], ['55000', '23503', '23505']],
    [`DELETE FROM ${T.BODIES} WHERE package_item_id = $1`, [stillAnalytical.package_item_id]],
    [`UPDATE ${T.BODIES} SET public_text_body = 'redacted' WHERE package_item_id = $1`, [stillAnalytical.package_item_id]],
    [`UPDATE ${T.ITEMS} SET content_state = 'ERASED_BY_OWNER', public_body_digest = NULL, content_erased_at = now() WHERE package_item_id = $1`, [stillAnalytical.package_item_id]],
    [`UPDATE ${T.PROVENANCE} SET captured_source_digest = NULL, captured_digest_erased_at = now() WHERE package_item_id = $1`, [stillAnalytical.package_item_id]],
    [`DELETE FROM ${T.ITEMS} WHERE package_item_id = $1`, [erased.package_item_id]],
    [`DELETE FROM ${T.PROVENANCE} WHERE package_item_id = $1`, [erased.package_item_id]],
  ];
  for (const [sql, values, codes = ['55000']] of refusedOps) {
    await rejected(() => q(sql, values), codes);
  }
  // A live source's copy cannot be erased by hand, even with a matching event-shaped instant.
  const live = await itemFor(await manifestOf(ready.exp), f.mohamedMaterial);
  await rejected(() => q(`UPDATE ${T.PROVENANCE} SET captured_source_digest = NULL, captured_digest_erased_at = now() WHERE package_item_id = $1`,
    [live.package_item_id]), ['55000']);
  await rejected(() => q(`DELETE FROM ${T.BODIES} WHERE package_item_id = $1`, [live.package_item_id]), ['55000']);
  // And a Personal source's copy never: its provenance shape refuses the erased state outright.
  const [personal] = await own(`SELECT package_item_id FROM ${T.PROVENANCE} WHERE manifest_version_id = $1 AND source_class = 'MY_WORLD'`, [await manifestOf(other)]);
  await rejected(() => q(`UPDATE ${T.PROVENANCE} SET captured_source_digest = NULL, captured_digest_erased_at = now() WHERE package_item_id = $1`,
    [personal.package_item_id]), ['55000', '23514']);
  // No application role can reach any package relation or the erasure.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT r'); await asRole(role, f.mohamed);
    for (const table of PACKAGE_RELATIONS) await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    await rejected(() => q('SELECT public_authoring_private.erase_owner_deleted_public_derivatives_v1($1, now())', [f.mohamedMaterial]), ['42501']);
    await q('ROLLBACK TO SAVEPOINT r'); await q('RELEASE SAVEPOINT r');
  }
  await asRole('postgres');
  // P08 AN EQUIVALENT RETRY RE-PROVES THE ERASURE, and refuses a world where a copy came back.
  await actAs(f.hadir);
  const [again] = await rt.deleteMaterial(deleteCommand, f.world, f.f05Material, deleteEvent);
  assert.equal(again.outcome, 'MATERIAL_DELETED', 'P08 the retry answers the committed deletion');
  await q('SAVEPOINT resurrection');
  await asRole('postgres');
  await q(`ALTER TABLE ${T.BODIES} DISABLE TRIGGER public_experience_text_derivative_bodies_no_resurrection`);
  await q(`INSERT INTO ${T.BODIES} (package_item_id, public_body_form, public_text_body) VALUES ($1, 'PUBLIC_TEXT', $2)`, [erased.package_item_id, f.f05Text]);
  await q(`ALTER TABLE ${T.BODIES} ENABLE TRIGGER public_experience_text_derivative_bodies_no_resurrection`);
  await actAs(f.hadir);
  await rejected(() => rt.deleteMaterial(deleteCommand, f.world, f.f05Material, deleteEvent), ['P0001'], /CONTRADICTORY/u);
  await q('ROLLBACK TO SAVEPOINT resurrection'); await q('RELEASE SAVEPOINT resurrection');
  // P09 THE APPLICATION PATH ERASES TOO: a current member deletes their own message through the S4-02 owner command.
  const appExp = (await startDraft(f.mohamed, randomUUID())).experience_id;
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), appExp, NONE, [f.world], [f.mohamedMaterial])).outcome, 'PREPARED');
  const appManifest = await manifestOf(appExp);
  await as(f.mohamed);
  assert.equal((await rows('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [randomUUID(), f.world, f.mohamedMaterial]))[0].outcome, 'DELETED');
  const appErased = await itemFor(appManifest, f.mohamedMaterial);
  assert.deepEqual([appErased.content_state, appErased.public_body_digest, appErased.captured_source_digest, await bodyOf(appErased.package_item_id)],
    ['ERASED_BY_OWNER', null, null, null], 'P09 the application deletion path erases every package copy');
  const readyItem = await itemFor(await manifestOf(ready.exp), f.mohamedMaterial);
  assert.equal(readyItem.content_state, 'ERASED_BY_OWNER', 'P09 including the copy inside a READY_FOR_REVIEW package');
  assert.equal((await reviewOwn(f.mohamed, ready.exp))[0].review_state, 'UNAVAILABLE');
}

// ------------------------------------------------------------------- 4a. MATERIAL vs REASONING dependency (S5-02 R1, G16)
/** A Shared MATERIAL_DEPENDENCY edge (the source precedes the target) or a REASONING_DEPENDENCY edge (opaque context). */
async function dependency(world, kind, target, source) {
  await asRole('postgres');
  await q(`INSERT INTO public.shared_world_material_dependencies
             (id, world_id, dependency_kind, target_material_id, target_established_at,
              source_material_id, source_established_at, source_context_ref)
           SELECT $1, $2, $3, t.id, t.established_at, s.id, s.established_at, $6
             FROM public.shared_world_materials t LEFT JOIN public.shared_world_materials s ON s.id = $5
            WHERE t.id = $4`,
  [randomUUID(), world, kind, target, kind === 'MATERIAL_DEPENDENCY' ? source : null,
    kind === 'REASONING_DEPENDENCY' ? `ctx-${randomUUID()}` : null]);
}

async function verifyDependencyErasure(f) {
  // G01 THE FIXTURE: Hadir's human sentence; a QANDEEL output that MATERIAL_DEPENDS on it; a second QANDEEL output that
  // MATERIAL_DEPENDS on the first (the closure is transitive); and an equivalent QANDEEL output that only
  // REASONING_DEPENDS. All three outputs are ANALYTICAL_DERIVATIVE in Public.
  const human = randomUUID(); const humanText = `S5-02 G16 human source ${randomUUID()}`;
  const target = randomUUID(); const targetText = `S5-02 G16 material target ${randomUUID()}`;
  const hop = randomUUID(); const hopText = `S5-02 G16 transitive target ${randomUUID()}`;
  const reasoning = randomUUID(); const reasoningText = `S5-02 G16 reasoning target ${randomUUID()}`;
  await asRole('postgres');
  await rt.commitMaterial(f.world, human, 'HUMAN_TEXT', f.hadir, humanText,
    'EXACT_HUMAN_APPROVER_SET', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
  for (const [id, text] of [[target, targetText], [hop, hopText], [reasoning, reasoningText]]) {
    await rt.commitMaterial(f.world, id, 'QANDEEL_OUTPUT', null, text,
      'NO_HUMAN_APPROVAL_REQUIRED', 'RESOLVED_NO_HUMAN_REQUIREMENT', [], f.mohamed);
  }
  await dependency(f.world, 'MATERIAL_DEPENDENCY', target, human);
  await dependency(f.world, 'MATERIAL_DEPENDENCY', hop, target);
  await dependency(f.world, 'REASONING_DEPENDENCY', reasoning, null);
  // G02 PUBLIC SNAPSHOTS THE QANDEEL TARGETS: one package with all three outputs, and one with the reasoning output only.
  const exp = (await startDraft(f.mohamed, randomUUID())).experience_id;
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), exp, NONE, [f.world, f.world, f.world], [target, hop, reasoning])).outcome, 'PREPARED');
  const manifest = await manifestOf(exp);
  const onlyReasoning = (await startDraft(f.mohamed, randomUUID())).experience_id;
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), onlyReasoning, NONE, [f.world], [reasoning])).outcome, 'PREPARED');
  for (const [material, text] of [[target, targetText], [hop, hopText], [reasoning, reasoningText]]) {
    const it = await itemFor(manifest, material);
    assert.equal(it.derivative_classification, 'ANALYTICAL_DERIVATIVE', 'G02 the Public label says analytical');
    assert.equal(await bodyOf(it.package_item_id), text, 'G02 the package holds the exact output bytes');
    assert.equal(it.captured_source_digest, `sha256:${sha(text)}`);
  }
  // G03 THE HUMAN SOURCE OWNER DELETES THE SOURCE.
  const command = randomUUID(); const event = randomUUID();
  await asRole('postgres'); await actAs(f.hadir);
  const [deleted] = await rt.deleteMaterial(command, f.world, human, event);
  assert.equal(deleted.outcome, 'MATERIAL_DELETED');
  assert.equal(deleted.invalidated_targets, 2, 'G03 the MATERIAL_DEPENDENCY closure is exactly the two outputs');
  const [{ occurred_at: deletedAt }] = await own('SELECT occurred_at FROM public.shared_world_material_deleted_events WHERE id = $1', [event]);
  // G04 SHARED: the material targets are UNAVAILABLE with their bodies gone; the reasoning target is untouched.
  const state = async (material) => (await own(`SELECT i.availability_state s,
      EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b WHERE b.material_id = m.id) body
      FROM public.shared_world_materials m JOIN public.shared_world_history_items i ON i.id = m.history_item_id WHERE m.id = $1`, [material]))[0];
  assert.deepEqual(await state(target), { s: 'UNAVAILABLE', body: false }, 'G04 the material target is UNAVAILABLE and its body gone');
  assert.deepEqual(await state(hop), { s: 'UNAVAILABLE', body: false }, 'G04 and transitively');
  assert.deepEqual(await state(reasoning), { s: 'AVAILABLE', body: true }, 'G04 the reasoning target is not erased by Shared');
  // G05 PUBLIC: every derivative of a physically erased target loses its bytes and both verifiers — at the instant —
  // although its label says ANALYTICAL_DERIVATIVE; the label itself survives as audit identity.
  for (const [material, text] of [[target, targetText], [hop, hopText]]) {
    const it = await itemFor(manifest, material);
    assert.deepEqual([it.derivative_classification, it.content_state, it.public_body_digest, it.captured_source_digest, await bodyOf(it.package_item_id)],
      ['ANALYTICAL_DERIVATIVE', 'ERASED_BY_OWNER', null, null, null], 'G05 MATERIAL_DEPENDENCY erasure propagates physical Public erasure');
    assert.equal(it.content_erased_at.getTime(), deletedAt.getTime(), 'G05 at the canonical deletion instant');
    assert.equal(it.captured_digest_erased_at.getTime(), deletedAt.getTime());
    assert.deepEqual((await censusOf(text)).hits, [], 'G05 the whole-database census finds neither the bytes nor their digest');
  }
  assert.deepEqual((await censusOf(humanText)).hits, [], 'G05 nor anything of the human source');
  // G06 REVIEW IS DARK, NEVER PARTIAL.
  assert.deepEqual((await reviewOwn(f.mohamed, exp)).map((r) => [r.review_state, r.public_text_body]), [['UNAVAILABLE', null]], 'G06');
  await asRole('service_role');
  assert.deepEqual(await rt.review(exp, f.mohamed), [], 'G06 the frozen resolver serves nothing of it either');
  // G07 REASONING_DEPENDENCY DOES NOT PROPAGATE: the equivalent analytical output keeps its bytes and digests, and its
  // own package still reviews whole.
  const kept = await itemFor(manifest, reasoning);
  assert.deepEqual([kept.content_state, await bodyOf(kept.package_item_id), kept.captured_source_digest],
    ['CONTENT_PRESENT', reasoningText, `sha256:${sha(reasoningText)}`], 'G07 a REASONING_DEPENDENCY target is not physically erased');
  const intact = await reviewOwn(f.mohamed, onlyReasoning);
  assert.deepEqual(intact.map((r) => [r.review_state, r.public_text_body]), [['CURRENT', reasoningText]], 'G07 its own package is intact');
  // G08 THE GUARD STILL REFUSES IT BY HAND, at the deletion's own instant — the reasoning target is not in the closure.
  await asRole('postgres');
  await rejected(() => q(`UPDATE ${T.PROVENANCE} SET captured_source_digest = NULL, captured_digest_erased_at = $2 WHERE package_item_id = $1`,
    [kept.package_item_id, deletedAt]), ['55000']);
  // G09 ONE WAY, AND NO RESURRECTION, for an erased analytical item too.
  const gone = await itemFor(manifest, target);
  await rejected(() => q(`UPDATE ${T.ITEMS} SET content_state = 'CONTENT_PRESENT', public_body_digest = $2, content_erased_at = NULL WHERE package_item_id = $1`,
    [gone.package_item_id, `sha256:${sha(targetText)}`]), ['55000']);
  await rejected(() => q(`INSERT INTO ${T.BODIES} (package_item_id, public_body_form, public_text_body) VALUES ($1, 'PUBLIC_TEXT', $2)`,
    [gone.package_item_id, targetText]), ['55000', '23505']);
  // G10 THE COMMITTED RETRY RE-PROVES THE CLOSURE ERASURE.
  await actAs(f.hadir);
  assert.equal((await rt.deleteMaterial(command, f.world, human, event))[0].outcome, 'MATERIAL_DELETED', 'G10');
  await asRole('postgres');
}

// ------------------------------------------------------------------------------------- 4b. reconciliation of old rows
async function verifyReconciliation(f) {
  const migration = readFileSync(new URL('./migrations/0143_public_authoring_rights_privacy_v1.sql', import.meta.url), 'utf8');
  const start = migration.indexOf('-- A.6 RECONCILING');
  const block = migration.slice(migration.indexOf('DO $$', start), migration.indexOf('END$$;', start) + 'END$$;'.length);
  assert.ok(block.startsWith('DO $$') && block.includes('S5-02: a physically erased Shared source still survives'), 'the reconciliation block was read');
  const material = randomUUID();
  const text = `S5-02 pre-0143 deletion ${randomUUID()}`;
  await asRole('postgres');
  await rt.commitMaterial(f.world, material, 'HUMAN_TEXT', f.hadir, text, 'EXACT_HUMAN_APPROVER_SET', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
  const exp = (await startDraft(f.mohamed, randomUUID())).experience_id;
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), exp, NONE, [f.world], [material])).outcome, 'PREPARED');
  const manifest = await manifestOf(exp);
  // R01 THE OLD RULE, reproduced: a deletion whose erasure did not exist yet.
  await q('SAVEPOINT old_rule');
  await asRole('postgres');
  const [{ def }] = await rows(`SELECT pg_get_functiondef('public_authoring_private.erase_owner_deleted_public_derivatives_v1(uuid, timestamptz)'::regprocedure) def`);
  await q(`CREATE OR REPLACE FUNCTION public_authoring_private.erase_owner_deleted_public_derivatives_v1(p_material_id uuid, p_instant timestamptz)
           RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$ SELECT 0 $fn$`);
  await actAs(f.hadir);
  await rt.deleteMaterial(randomUUID(), f.world, material, randomUUID());
  await asRole('postgres');
  await q(def);
  assert.equal(await bodyOf((await itemFor(manifest, material)).package_item_id), text, 'R01 the unsafe pre-0143 state exists');
  await q(block);
  const fixed = await itemFor(manifest, material);
  assert.deepEqual([fixed.content_state, fixed.public_body_digest, fixed.captured_source_digest, await bodyOf(fixed.package_item_id)],
    ['ERASED_BY_OWNER', null, null, null], 'R01 the reconciliation erases an already-deleted source forward');
  const [{ occurred_at: at }] = await rows('SELECT occurred_at FROM public.shared_world_material_deleted_events WHERE material_id = $1', [material]);
  assert.equal(fixed.content_erased_at.getTime(), at.getTime(), 'R01 at the instant the owner actually deleted it');
  assert.deepEqual((await censusOf(text)).hits, [], 'R01 and nothing of it survives anywhere');
  await q(block);
  assert.equal((await itemFor(manifest, material)).content_state, 'ERASED_BY_OWNER', 'R01 the reconciliation is idempotent');
  await q('ROLLBACK TO SAVEPOINT old_rule'); await q('RELEASE SAVEPOINT old_rule');
  // R03 A MATERIAL_DEPENDENCY TARGET LEFT UNSAFE BY THE OLD RULE is erased forward too, at the upstream deletion's
  // instant, whatever its Public label; a REASONING_DEPENDENCY target is not.
  await q('SAVEPOINT old_closure');
  await asRole('postgres');
  const human = randomUUID(); const target = randomUUID(); const reasoning = randomUUID();
  const targetText = `S5-02 pre-0143 material target ${randomUUID()}`; const reasoningText = `S5-02 pre-0143 reasoning target ${randomUUID()}`;
  await rt.commitMaterial(f.world, human, 'HUMAN_TEXT', f.hadir, `S5-02 pre-0143 human ${randomUUID()}`,
    'EXACT_HUMAN_APPROVER_SET', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
  await rt.commitMaterial(f.world, target, 'QANDEEL_OUTPUT', null, targetText, 'NO_HUMAN_APPROVAL_REQUIRED', 'RESOLVED_NO_HUMAN_REQUIREMENT', [], f.mohamed);
  await rt.commitMaterial(f.world, reasoning, 'QANDEEL_OUTPUT', null, reasoningText, 'NO_HUMAN_APPROVAL_REQUIRED', 'RESOLVED_NO_HUMAN_REQUIREMENT', [], f.mohamed);
  await dependency(f.world, 'MATERIAL_DEPENDENCY', target, human);
  await dependency(f.world, 'REASONING_DEPENDENCY', reasoning, null);
  const closureExp = (await startDraft(f.mohamed, randomUUID())).experience_id;
  assert.equal((await prepareOwn(f.mohamed, randomUUID(), closureExp, NONE, [f.world, f.world], [target, reasoning])).outcome, 'PREPARED');
  const closureManifest = await manifestOf(closureExp);
  await asRole('postgres');
  await q(`CREATE OR REPLACE FUNCTION public_authoring_private.erase_owner_deleted_public_derivatives_v1(p_material_id uuid, p_instant timestamptz)
           RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$ SELECT 0 $fn$`);
  const closureEvent = randomUUID();
  await actAs(f.hadir);
  await rt.deleteMaterial(randomUUID(), f.world, human, closureEvent);
  await asRole('postgres');
  await q(def);
  assert.equal(await bodyOf((await itemFor(closureManifest, target)).package_item_id), targetText, 'R03 the unsafe closure state exists');
  await q(block);
  const closureFixed = await itemFor(closureManifest, target);
  assert.deepEqual([closureFixed.derivative_classification, closureFixed.content_state, closureFixed.public_body_digest,
    closureFixed.captured_source_digest, await bodyOf(closureFixed.package_item_id)],
  ['ANALYTICAL_DERIVATIVE', 'ERASED_BY_OWNER', null, null, null], 'R03 the reconciliation erases the closure target forward');
  const [{ occurred_at: closureAt }] = await rows('SELECT occurred_at FROM public.shared_world_material_deleted_events WHERE id = $1', [closureEvent]);
  assert.equal(closureFixed.content_erased_at.getTime(), closureAt.getTime(), 'R03 at the upstream deletion instant');
  assert.deepEqual((await censusOf(targetText)).hits, [], 'R03 and nothing of it survives anywhere');
  const closureKept = await itemFor(closureManifest, reasoning);
  assert.deepEqual([closureKept.content_state, await bodyOf(closureKept.package_item_id)], ['CONTENT_PRESENT', reasoningText],
    'R03 the reasoning target is not reconciled away');
  await q('ROLLBACK TO SAVEPOINT old_closure'); await q('RELEASE SAVEPOINT old_closure');
  // R02 CONTRADICTORY STATE IS REFUSED, NOT NORMALIZED: a Shared body gone without an owner deletion.
  await q('SAVEPOINT contradiction');
  await asRole('postgres');
  await q('DELETE FROM public.shared_world_text_material_bodies WHERE material_id = $1', [material]);
  await rejected(() => q(block), ['P0001'], /contradictory/u);
  await q('ROLLBACK TO SAVEPOINT contradiction'); await q('RELEASE SAVEPOINT contradiction');
}

// ------------------------------------------------------------------------------------------------------- 6. launch
async function verifyLaunchClosure(f, ready) {
  await asRole('postgres');
  const [clearance] = await rt.prerequisites(ready.exp, ready.manifest);
  assert.equal(clearance.clearance, 'NOT_EVALUATED', 'L01 the CW2-08 seam answers NOT_EVALUATED for a real READY Experience');
  for (const role of APP_ROLES) {
    await q('SAVEPOINT l'); await asRole(role, f.mohamed);
    await rejected(() => q('SELECT * FROM public.publish_public_experience_v1($1, $2, $3)', [randomUUID(), ready.exp, randomUUID()]), ['42501']);
    await q('ROLLBACK TO SAVEPOINT l'); await q('RELEASE SAVEPOINT l');
  }
  await asRole('postgres');
  const [{ visibility_state: state }] = await rt.visibility(ready.exp);
  assert.equal(state, 'NOT_PUBLICLY_VISIBLE', 'L02 READY_FOR_REVIEW widens no audience');
  assert.deepEqual(await rt.serving(ready.exp, f.reader), [], 'L02 and nobody is served');
  const [{ published }] = await rows(`SELECT count(*)::int published FROM ${T.EXPERIENCES} e JOIN ${T.CONTROLLERS} c ON c.experience_id = e.id
    WHERE c.controller_user_id = ANY($1::uuid[]) AND e.current_lifecycle IN ('PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD')`, [[f.mohamed, f.hadir]]);
  assert.equal(published, 0, 'L03 no S5-02 path produced a PUBLISHED Experience');
}

// --------------------------------------------------------------------------------------------------- 5. concurrency
async function verifyConcurrency() {
  const f = rt.newFixture();
  f.materials = Array.from({ length: 8 }, () => randomUUID());
  const experiences = [];
  await asRole('postgres');
  // Committed: real races need committed truth on both connections. The Shared fixture only (the 0095 pattern): the
  // shared teardown removes exactly what it provisions.
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [[f.mohamed, f.hadir, f.stranger, f.reader]]);
  await rt.provisionWorld(f, f.world);
  for (const [index, material] of f.materials.entries()) {
    await rt.commitMaterial(f.world, material, 'HUMAN_TEXT', f.hadir, `S5-02 race ${index} ${randomUUID()}`,
      'EXACT_HUMAN_APPROVER_SET', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
  }
  const { q2, actAs2, close } = await rt.openSecondary();
  const deadlocks = async () => Number((await rows(
    'SELECT COALESCE(sum(deadlocks), 0)::int n FROM pg_stat_database WHERE datname = current_database()'))[0].n);
  const deadlocksBefore = await deadlocks();
  // actAs2 resets the role, so the claims come first and the application role last.
  const asAuth2 = async (uid) => { await actAs2(uid); await q2('SET ROLE authenticated'); };
  try {
    await asRole('postgres');
    // C00 two first authorings by the same human, concurrently, create ONE identity.
    await q('BEGIN'); await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.stranger, role: 'authenticated' })]);
    const [a] = (await q('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()])).rows;
    await asAuth2(f.stranger);
    const second = q2('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()]);
    assert.equal(await rt.stillPending(second), true, 'C00 the second first authoring queues on the account row');
    await q('COMMIT');
    const [b] = (await second).rows;
    experiences.push(a.experience_id, b.experience_id);
    await asRole('postgres');
    assert.equal((await identitiesOf(f.stranger)).length, 1, 'C00 two concurrent first authorings: ONE identity');
    // Mohamed's Draft for the races.
    await asAuth2(f.mohamed);
    const [{ experience_id: exp }] = (await q2('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()])).rows;
    experiences.push(exp);
    const prepareRace = (runner, material) => runner('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
      [randomUUID(), exp, NONE, [f.world], [material]]);
    const deleteRace = (runner, material) => runner('SELECT * FROM public.delete_shared_world_owned_material_v1($1, $2, $3, $4)',
      [randomUUID(), f.world, material, randomUUID()]);
    const packagesOf = async (material) => {
      await asRole('postgres');
      return rows(`SELECT it.package_item_id, it.content_state, it.public_body_digest, p.captured_source_digest,
          EXISTS (SELECT 1 FROM ${T.BODIES} b WHERE b.package_item_id = it.package_item_id) has_body
        FROM ${T.PROVENANCE} p JOIN ${T.ITEMS} it ON it.package_item_id = p.package_item_id WHERE p.shared_material_id = $1`, [material]);
    };

    // C01 DELETE WINS FIRST: the preparation waits on the World row, then fails closed and writes nothing.
    await q2('BEGIN'); await q2('RESET ROLE'); await actAs2(f.hadir);
    await deleteRace(q2, f.materials[0]);
    await q('BEGIN'); await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.mohamed, role: 'authenticated' })]);
    const waiting = prepareRace(q, f.materials[0]);
    assert.equal(await rt.stillPending(waiting), true, 'C01 the preparation queues behind the deletion\'s World lock');
    await q2('COMMIT');
    assert.equal((await waiting).rows[0].outcome, 'UNAVAILABLE', 'C01 the deletion won: the preparation fails closed');
    await q('COMMIT');
    assert.deepEqual(await packagesOf(f.materials[0]), [], 'C01 and no derivative byte was ever created');

    // C02 PREPARE WINS FIRST: the deletion waits, then erases the package it waited for, in its own transaction.
    await q('BEGIN'); await q('SET LOCAL ROLE authenticated');
    await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.mohamed, role: 'authenticated' })]);
    assert.equal((await prepareRace(q, f.materials[1])).rows[0].outcome, 'PREPARED');
    await q2('BEGIN'); await q2('RESET ROLE'); await actAs2(f.hadir);
    const deleting = deleteRace(q2, f.materials[1]);
    assert.equal(await rt.stillPending(deleting), true, 'C02 the deletion queues behind the preparation\'s World lock');
    await q('COMMIT');
    assert.equal((await deleting).rows[0].outcome, 'MATERIAL_DELETED');
    const [beforeCommit] = await packagesOf(f.materials[1]);
    assert.equal(beforeCommit.content_state, 'CONTENT_PRESENT', 'C02 nothing is observable before the deletion commits');
    await q2('COMMIT');
    assert.deepEqual((await packagesOf(f.materials[1])).map((p) => [p.content_state, p.public_body_digest, p.captured_source_digest, p.has_body]),
      [['ERASED_BY_OWNER', null, null, false]], 'C02 the committed deletion erased the package in the same transaction');

    // C03 A BURST OF REAL RACES, both orders: never a committed deletion beside surviving bytes, never a deadlock.
    for (const [index, material] of f.materials.slice(2).entries()) {
      await q('BEGIN'); await q('SET LOCAL ROLE authenticated');
      await q("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.mohamed, role: 'authenticated' })]);
      await q2('BEGIN'); await q2('RESET ROLE'); await actAs2(f.hadir);
      const pair = index % 2 === 0
        ? [prepareRace(q, material), new Promise((r) => { setTimeout(r, 5); }).then(() => deleteRace(q2, material))]
        : [new Promise((r) => { setTimeout(r, 5); }).then(() => prepareRace(q, material)), deleteRace(q2, material)];
      const commits = [pair[0].then(() => q('COMMIT')), pair[1].then(() => q2('COMMIT'))];
      const settled = await Promise.allSettled(commits);
      for (const outcome of settled) assert.equal(outcome.status, 'fulfilled', `C03 race ${index}: ${outcome.reason?.message ?? ''}`);
      const packages = await packagesOf(material);
      for (const p of packages) {
        assert.deepEqual([p.content_state, p.public_body_digest, p.captured_source_digest, p.has_body],
          ['ERASED_BY_OWNER', null, null, false], `C03 race ${index}: a committed deletion never stands beside surviving bytes`);
      }
      assert.equal(Number((await rows(`SELECT count(*) n FROM public.shared_world_material_deleted_events WHERE material_id = $1`, [material]))[0].n), 1);
    }
    assert.equal(await deadlocks(), deadlocksBefore, 'C03 no deadlock: the erasure adds no edge to the canonical lock order');
  } finally {
    await close();
    await asRole('postgres');
    await q('ROLLBACK').catch(() => undefined);
    const [{ ids }] = await rows(`SELECT coalesce(array_agg(e.id), '{}') ids FROM ${T.EXPERIENCES} e
      JOIN ${T.CONTROLLERS} c ON c.experience_id = e.id WHERE c.controller_user_id = ANY($1::uuid[])`, [[f.mohamed, f.stranger, f.hadir]]);
    await rt.removeCommittedFixtures({ experiences: [...new Set([...experiences, ...ids])], humans: [f.mohamed, f.hadir, f.stranger, f.reader], world: f.world });
  }
}

await runVerifier('0143', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  await q('BEGIN');
  try {
    stage('fixture');
    const f = await fixture();
    stage('identity');
    const d = await verifyIdentity(f);
    stage('rights');
    const ready = await verifyRights(f, d);
    stage('privacy');
    await verifyPrivacy(f, d, ready);
    stage('material vs reasoning');
    await verifyDependencyErasure(f);
    stage('reconciliation');
    await verifyReconciliation(f);
    stage('launch closure');
    await verifyLaunchClosure(f, ready);
  } finally {
    await q('ROLLBACK');
  }
  stage('concurrency');
  await verifyConcurrency();
  console.log('Verified migration 0143: ASSURE-F05 owner deletion physically erases every Public copy (body and both digests) of the deleted source and of its transitive MATERIAL_DEPENDENCY closure, whatever the Public label, in the same transaction at the canonical instant, the whole-database census finds no byte or verifier of it, both reviews go dark and never partial, a REASONING_DEPENDENCY output and an unrelated output keep their bytes, the guard is one-way, retries re-prove it and old rows reconcile; delete-first fails the preparation closed and prepare-first is erased, with no deadlock; the first real authorship provisions one identity (also concurrently) rendering the current Public ID or full 80-character Name; only legal sources prepare, only the exact rightsholders approve, withdrawal is immediate and never resurrected, READY needs every current effective approval; nothing can publish and the seam answers NOT_EVALUATED.');
}, async () => { await rt.client.end().catch(() => undefined); });
