// Shared support for the I-05B real-PostgreSQL verifiers (migrations 0094-0097).
//
// The four verifiers prove four migrations, but they reach their subjects
// through ONE fixture shape - the frozen I-04 Shared source, the frozen 0064
// Personal source, the I-05A identity / draft / package / approval / READY
// runtime - and they share ONE way of simulating the CW2-08 prerequisite gate.
// Four copies of that would be four places for it to drift, so it lives here.
//
// Nothing in this module asserts anything about a migration on its own: it
// provides fixtures, wrappers and the posture checks every verifier repeats.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

// ------------------------------------------------------------------ relations
export const T = Object.freeze({
  WORLD: 'public.public_world_state',
  POLICY: 'public.public_audience_policy_state',
  EXPERIENCES: 'public.public_experiences',
  VERSIONS: 'public.public_experience_versions',
  LIFECYCLE: 'public.public_experience_lifecycle_events',
  CONTROLLERS: 'public.public_experience_controllers',
  IDENTITIES: 'public.public_identities',
  DISPLAY: 'public.public_identity_display_state',
  MANIFESTS: 'public.publication_package_manifest_versions',
  ITEMS: 'public.publication_package_manifest_items',
  BODIES: 'public.public_experience_text_derivative_bodies',
  PROVENANCE: 'public.publication_package_item_provenance',
  ITEM_AUTHORITY: 'public.publication_package_item_authority',
  REQUIRED: 'public.publication_manifest_required_approvers',
  APPROVALS: 'public.publication_manifest_approvals',
  WITHDRAWAL_COMMANDS: 'public.publication_approval_withdrawal_commands',
  WITHDRAWAL_EVENTS: 'public.publication_approval_withdrawal_events',
  PUBLISH_COMMANDS: 'public.public_experience_publish_commands',
  PUBLICATION_STATE: 'public.public_experience_publication_state',
  PLACEMENTS: 'public.public_experience_semantic_placements',
  PLACEMENT_COMMANDS: 'public.public_experience_semantic_placement_commands',
  POSTS: 'public.public_discussion_posts',
  POST_COMMANDS: 'public.public_discussion_post_commands',
  RESPONSES: 'public.public_qandeel_responses',
  RESPONSE_COMMANDS: 'public.public_qandeel_response_commands',
  VITALITY: 'public.public_experience_vitality_state',
  PROJECTION: 'public.public_experience_search_projection',
});

export const APP_ROLES = ['anon', 'authenticated', 'service_role'];
export const NONE = [];
export const SEAM = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)';

/** Result columns no Public read boundary may ever declare. */
export const DISCLOSURE_BAN = /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id|provenance|digest|fingerprint/u;

/**
 * Every append-only relation a committed fixture can touch, with the trigger
 * that guards it. Teardown lifts these inside ONE transaction and puts them
 * back inside the same one.
 */
export const IMMUTABLE_RELATIONS = [
  [T.VERSIONS, 'public_experience_versions_immutable'],
  [T.LIFECYCLE, 'public_experience_lifecycle_events_immutable'],
  [T.MANIFESTS, 'publication_package_manifest_versions_immutable'],
  [T.ITEMS, 'publication_package_manifest_items_immutable'],
  [T.BODIES, 'public_experience_text_derivative_bodies_immutable'],
  [T.PROVENANCE, 'publication_package_item_provenance_immutable'],
  [T.ITEM_AUTHORITY, 'publication_package_item_authority_immutable'],
  [T.REQUIRED, 'publication_manifest_required_approvers_immutable'],
  [T.APPROVALS, 'publication_manifest_approvals_immutable'],
  [T.WITHDRAWAL_EVENTS, 'publication_approval_withdrawal_events_immutable'],
  [T.PUBLICATION_STATE, 'public_experience_publication_state_immutable'],
  [T.PLACEMENTS, 'public_experience_semantic_placements_immutable'],
  [T.POSTS, 'public_discussion_posts_immutable'],
  [T.RESPONSES, 'public_qandeel_responses_immutable'],
];

// ------------------------------------------------------------------- runtime
export function createRuntime(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
  const client = new Client({ connectionString: databaseUrl });
  const q = (text, values = []) => client.query(text, values);
  const rows = async (text, values = []) => (await q(text, values)).rows;

  /** Become one exact human for auth.uid(), session-scoped, without leaving the owner role. */
  async function actAs(uid) {
    await q('RESET ROLE');
    await q("SELECT set_config('request.jwt.claims', $1, false)",
      [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
  }
  async function asRole(role, uid = null) {
    await q('RESET ROLE');
    if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
    await q("SELECT set_config('request.jwt.claims', $1, false)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
  }
  async function rejected(operation, codes, message = null) {
    await q('SAVEPOINT s');
    let error;
    try { await operation(); } catch (caught) { error = caught; } finally {
      await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
    }
    assert.ok(error, 'operation unexpectedly succeeded');
    assert.ok(codes.includes(error.code),
      `unexpected rejection code ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
    if (message) assert.match(error.message, message);
    return error;
  }
  const count = async (table, where, values) => Number((await rows(`SELECT count(*) n FROM ${table} WHERE ${where}`, values))[0].n);

  // ---- I-05A primitives (0093)
  const ensureIdentity = (command, ref, mode, label) =>
    rows('SELECT * FROM public.ensure_public_identity_v1($1, $2, $3, $4)', [command, ref, mode, label]);
  const updateLabel = (command, mode, label) =>
    rows('SELECT * FROM public.update_public_display_label_v1($1, $2, $3)', [command, mode, label]);
  const createDraft = (command, experience) =>
    rows('SELECT * FROM public.create_public_experience_draft_v1($1, $2)', [command, experience]);
  const prepare = (command, experience, manifest, version, personalItems, personalUnits, sharedItems, sharedWorlds, sharedMaterials) =>
    rows('SELECT * FROM public.prepare_public_experience_manifest_v1($1,$2,$3,$4,$5::uuid[],$6::uuid[],$7::uuid[],$8::uuid[],$9::uuid[])',
      [command, experience, manifest, version, personalItems, personalUnits, sharedItems, sharedWorlds, sharedMaterials]);
  const approve = (approval, manifest) =>
    rows('SELECT * FROM public.approve_public_experience_manifest_v1($1, $2)', [approval, manifest]);
  const commitReady = (command, experience, version) =>
    rows('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)', [command, experience, version]);
  const review = (experience, user) =>
    rows('SELECT * FROM public.resolve_public_experience_review_v1($1, $2)', [experience, user]);
  const deleteMaterial = (command, world, material, event) =>
    rows('SELECT * FROM public.delete_shared_world_owned_material_v1($1, $2, $3, $4)', [command, world, material, event]);
  const deriveAuthority = (manifest) =>
    rows('SELECT * FROM public.derive_public_publication_authority_v1($1)', [manifest]);

  // ---- 0094
  const deriveApprovalState = (approval) =>
    rows('SELECT * FROM public.derive_publication_approval_effective_state_v1($1)', [approval]);
  const deriveManifestApprovals = (manifest) =>
    rows('SELECT * FROM public.derive_publication_manifest_effective_approvals_v1($1)', [manifest]);
  const withdraw = (command, approval) =>
    rows('SELECT * FROM public.withdraw_publication_approval_v1($1, $2)', [command, approval]);

  // ---- 0095
  const publish = (command, experience, version) =>
    rows('SELECT * FROM public.publish_public_experience_v1($1, $2, $3)', [command, experience, version]);
  const visibility = (experience) =>
    rows('SELECT * FROM public.resolve_public_visibility_state_v1($1)', [experience]);
  const admission = (viewer) =>
    rows('SELECT * FROM public.resolve_public_audience_admission_v1($1)', [viewer]);
  const serving = (experience, viewer) =>
    rows('SELECT * FROM public.resolve_public_experience_serving_v1($1, $2)', [experience, viewer]);
  const prerequisites = (experience, manifest) =>
    rows('SELECT * FROM public.resolve_public_publication_prerequisites_v1($1, $2)', [experience, manifest]);

  // ---- 0096
  const recordPlacement = (command, placement, experience, version, lens, label) =>
    rows('SELECT * FROM public.record_public_experience_semantic_placement_v1($1, $2, $3, $4, $5, $6)',
      [command, placement, experience, version, lens, label]);
  const currentPlacement = (version) =>
    rows('SELECT * FROM public.derive_public_experience_current_placement_v1($1)', [version]);
  const resolvePlacement = (experience, viewer) =>
    rows('SELECT * FROM public.resolve_public_experience_semantic_placement_v1($1, $2)', [experience, viewer]);
  const post = (command, postId, experience, parent, body) =>
    rows('SELECT * FROM public.post_public_discussion_v1($1, $2, $3, $4, $5)', [command, postId, experience, parent, body]);
  const resolveDiscussion = (experience, viewer) =>
    rows('SELECT * FROM public.resolve_public_discussion_v1($1, $2)', [experience, viewer]);
  const recordResponse = (command, response, experience, replyTo, body, consumed) =>
    rows('SELECT * FROM public.record_public_qandeel_response_v1($1, $2, $3, $4, $5, $6::uuid[])',
      [command, response, experience, replyTo, body, consumed]);
  const resolveResponses = (experience, viewer) =>
    rows('SELECT * FROM public.resolve_public_qandeel_responses_v1($1, $2)', [experience, viewer]);

  // ---- 0097
  const recomputeVitality = (experience) =>
    rows('SELECT * FROM public.recompute_public_experience_vitality_v1($1)', [experience]);
  const resolveVitality = (experience, viewer) =>
    rows('SELECT * FROM public.resolve_public_experience_vitality_v1($1, $2)', [experience, viewer]);
  const rebuildProjection = (experience) =>
    rows('SELECT * FROM public.rebuild_public_experience_projection_v1($1)', [experience]);
  const search = (viewer, query) =>
    rows('SELECT * FROM public.search_public_experiences_v1($1, $2)', [viewer, query]);
  const lens = (viewer, key) =>
    rows('SELECT * FROM public.resolve_public_lens_v1($1, $2)', [viewer, key]);
  const panel = (experience, viewer) =>
    rows('SELECT * FROM public.resolve_public_panel_v1($1, $2)', [experience, viewer]);

  // ---- catalog
  /** Every foreign key from `table` into `parent`, with both column lists in key order. */
  async function foreignKeysInto(table, parent) {
    return rows(
      `SELECT c.conname, c.confdeltype,
              (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS local_columns,
              (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
                 JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum) AS parent_columns
         FROM pg_constraint c
        WHERE c.conrelid = $1::regclass AND c.contype = 'f' AND c.confrelid = $2::regclass
        ORDER BY c.conname`, [table, parent]);
  }
  /** The columns of one named UNIQUE constraint, in key order; null when it does not exist. */
  async function uniqueKeyColumns(table, name) {
    const [key] = await rows(
      `SELECT (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS columns
         FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2 AND c.contype = 'u'`, [table, name]);
    return key ? key.columns : null;
  }
  /**
   * `table` binds `parent` as ONE exact row: some restrictive foreign key maps exactly
   * `local` onto `parentColumns`, and NO foreign key into `parent` is an independent
   * partial one (fewer columns). Two independent partial keys are the shape the exact
   * binding exists to forbid - each half can be satisfied by a different parent row.
   */
  async function assertExactBinding(table, parent, local, parentColumns) {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const bindings = await foreignKeysInto(table, parent);
    for (const binding of bindings) {
      assert.equal(binding.parent_columns.length, parentColumns.length,
        `${table}: ${binding.conname} must not bind ${parent} through an independent partial foreign key`);
    }
    assert.ok(bindings.some((binding) => binding.confdeltype === 'r' && same(binding.local_columns, local) && same(binding.parent_columns, parentColumns)),
      `${table} binds ${parent} as ONE exact row: (${local.join(', ')}) -> (${parentColumns.join(', ')}), restrictively`);
  }
  async function functionPosture(fn) {
    const [p] = await rows(
      `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc,
              pg_get_userbyid(pr.proowner) owner FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [fn]);
    assert.ok(p, `${fn} exists`);
    return p;
  }
  async function canExecute(role, fn) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', [role, fn, 'EXECUTE']);
    assert.equal(typeof allowed, 'boolean', `has_function_privilege answered for ${fn}`);
    return allowed;
  }
  const argumentNames = async (fn, mode) => (await rows(
    `SELECT arg.name FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
      WHERE pr.oid = $1::regprocedure AND arg.mode = $2`, [fn, mode])).map((r) => r.name);
  const resultColumns = (fn) => argumentNames(fn, 't');
  const inputParameters = (fn) => argumentNames(fn, 'i');
  async function triggerEnabled(table, trigger) {
    const [tg] = await rows(
      'SELECT tg.tgenabled FROM pg_trigger tg WHERE tg.tgrelid = $1::regclass AND tg.tgname = $2 AND NOT tg.tgisinternal',
      [table, trigger]);
    return Boolean(tg) && tg.tgenabled === 'O';
  }

  /**
   * The posture every I-05B migration repeats: internal functions executable by
   * nobody, derivations STABLE and write-free, mutations VOLATILE, resolvers
   * service_role-only and disclosure-bounded, relations sealed, guards enabled.
   */
  async function verifyPosture(spec) {
    for (const fn of spec.internal ?? []) {
      const p = await functionPosture(fn);
      assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
      assert.equal(p.secdef, true, `${fn} is SECURITY DEFINER`);
      assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `${fn} pins an empty search_path`);
      for (const role of ['public', ...APP_ROLES]) {
        assert.equal(await canExecute(role, fn), false,
          `${role} must not execute ${fn} before the frozen CW2-08 Launch Gate exists`);
      }
      assert.doesNotMatch(p.prosrc, /pg_advisory|LOCK TABLE|TRUNCATE/iu, `${fn} takes no advisory or table lock`);
    }
    for (const fn of spec.triggers ?? []) {
      // The frozen 0091 trigger shape: postgres-owned, search_path-pinned, RETURNS
      // trigger, invoked directly by nobody. Not SECURITY DEFINER, on purpose.
      const p = await functionPosture(fn);
      assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
      assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `${fn} pins an empty search_path`);
      const [{ returns }] = await rows('SELECT pr.prorettype::regtype::text returns FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fn]);
      assert.equal(returns, 'trigger', `${fn} returns trigger and is callable as nothing else`);
      for (const role of ['public', ...APP_ROLES]) {
        assert.equal(await canExecute(role, fn), false, `${role} must not execute ${fn}`);
      }
    }
    for (const fn of spec.mutating ?? []) {
      const p = await functionPosture(fn);
      assert.equal(p.volatility, 'v', `${fn} is VOLATILE`);
      assert.doesNotMatch(p.prosrc, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/iu,
        `${fn} accepts no clock but one read of the database's own`);
    }
    for (const fn of spec.reading ?? []) {
      const p = await functionPosture(fn);
      assert.equal(p.volatility, 's', `${fn} is STABLE`);
      assert.ok(!p.prosrc.includes('INSERT INTO') && !p.prosrc.includes('DELETE FROM') && !/UPDATE public/u.test(p.prosrc),
        `${fn} writes nothing`);
    }
    for (const fn of spec.resolvers ?? []) {
      const p = await functionPosture(fn);
      assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
      assert.equal(p.secdef, true, `${fn} is SECURITY DEFINER`);
      assert.equal(p.volatility, 's', `${fn} is STABLE`);
      assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `${fn} pins an empty search_path`);
      for (const role of ['public', 'anon', 'authenticated']) {
        assert.equal(await canExecute(role, fn), false, `${role} must not execute ${fn}`);
      }
      assert.equal(await canExecute('service_role', fn), true, `service_role executes ${fn}`);
      assert.ok(!p.prosrc.includes('publication_package_item_provenance'), `${fn} never reads sealed provenance`);
      assert.ok(p.prosrc.includes('resolve_public_visibility_state_v1') && p.prosrc.includes('resolve_public_audience_admission_v1'),
        `${fn} consumes the canonical visibility state and the audience admission gate`);
      assert.ok(!p.prosrc.includes('current_lifecycle'), `${fn} tests no lifecycle for itself`);
      const columns = await resultColumns(fn);
      assert.ok(columns.length > 0, `${fn} declares result columns`);
      for (const column of columns) {
        assert.doesNotMatch(column, DISCLOSURE_BAN, `${fn} must not return ${column}`);
      }
    }
    for (const table of spec.tables ?? []) {
      const [{ rls, owner }] = await rows(
        'SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass', [table]);
      assert.equal(typeof rls, 'boolean', `${table} row-security flag arrived`);
      assert.equal(rls, true, `${table} has RLS enabled`);
      assert.equal(owner, 'postgres', `${table} is postgres-owned`);
      const [{ policies }] = await rows('SELECT count(*) policies FROM pg_policy WHERE polrelid = $1::regclass', [table]);
      assert.equal(Number(policies), 0, `${table} carries zero policies`);
      for (const role of ['public', ...APP_ROLES]) {
        const [{ any_privilege }] = await rows(
          `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) any_privilege
             FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p`, [role, table]);
        assert.equal(any_privilege, false, `${role} holds no privilege on ${table}`);
      }
    }
    for (const [table, trigger] of spec.immutable ?? []) {
      assert.equal(await triggerEnabled(table, trigger), true, `${trigger} guards ${table}`);
    }
  }

  // ---- the CW2-08 prerequisite seam, simulated and restored
  async function captureSeam() {
    const [row] = await rows(
      `SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [SEAM]);
    assert.ok(row && row.definition.includes('CREATE OR REPLACE FUNCTION'), 'the prerequisite seam definition is readable');
    assert.ok(row.prosrc.includes('NOT_EVALUATED') && !row.prosrc.includes("'CLEARED'"),
      'the production seam fails closed: it answers NOT_EVALUATED and never CLEARED');
    return row;
  }
  /**
   * The ONLY way any verifier reaches PUBLISHED: replace the seam body inside the
   * current transaction (rolled back afterwards) or inside a committed fixture
   * section that restores it and proves the restoration. Never a migration,
   * never a grant, never a launch-ready row.
   */
  async function clearPrerequisites() {
    await q(`CREATE OR REPLACE FUNCTION public.resolve_public_publication_prerequisites_v1(p_experience_id uuid, p_manifest_version_id uuid)
             RETURNS TABLE(clearance text, clearance_basis text)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $probe$
             BEGIN
               IF p_experience_id IS NULL OR p_manifest_version_id IS NULL THEN
                 RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
               END IF;
               RETURN QUERY SELECT 'CLEARED'::text,
                 'I-05B VERIFIER PROBE: simulated CW2-08 clearance inside a verifier transaction; never a production state'::text;
             END$probe$`);
  }
  async function restorePrerequisites(seam) {
    await q(seam.definition);
    const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [SEAM]);
    assert.equal(prosrc, seam.prosrc, 'the production prerequisite seam is restored byte for byte');
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await canExecute(role, SEAM), false, `${role} still cannot execute the restored seam`);
    }
  }
  /** Clear, publish as the given human, restore - all inside the caller's transaction. */
  async function publishCleared(seam, actor, command, experience, version) {
    await clearPrerequisites();
    let result;
    try {
      await actAs(actor);
      result = await publish(command, experience, version);
    } finally {
      await restorePrerequisites(seam);
    }
    return result;
  }

  // ---- fixtures
  function newFixture() {
    return {
      mohamed: randomUUID(), hadir: randomUUID(), stranger: randomUUID(), reader: randomUUID(),
      mohamedRef: randomUUID(), hadirRef: randomUUID(), strangerRef: randomUUID(),
      session: randomUUID(), turn: randomUUID(), batch: randomUUID(),
      userUnit: randomUUID(), assistantUnit: randomUUID(),
      userText: 'the exact committed human sentence', assistantText: 'the analysis QANDEEL produced',
      world: randomUUID(), mohamedMaterial: randomUUID(), hadirMaterial: randomUUID(),
      unresolvedMaterial: randomUUID(), noHumanMaterial: randomUUID(), voiceMaterial: randomUUID(),
      metadatalessMaterial: randomUUID(), hiddenMaterial: randomUUID(),
      experience: randomUUID(), manifest: randomUUID(), version: randomUUID(),
    };
  }
  /** The predecessor state I-05B consumes, in the exact shape its producers leave behind. */
  async function provision(f) {
    await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [[f.mohamed, f.hadir, f.stranger, f.reader]]);
    await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')",
      [f.session, f.mohamed]);
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
             VALUES ($1, $2, $3, 'USER', 'COMPLETED', $4)`, [f.turn, f.session, f.mohamed, f.userText]);
    await q(`INSERT INTO public.conversation_unit_commit_batches
               (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
                unit_count, evaluator_version, policy_version, segmentation_provider, segmentation_model,
                segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256('fp'::bytea), sha256($5::bytea), 2, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [f.batch, f.mohamed, f.session, f.turn, Buffer.from(f.userText, 'utf8')]);
    const unit = (id, role, text, ordinal, sp) => q(
      `INSERT INTO public.conversation_units
         (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
          source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text,
          source_content_sha256, session_position)
       VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'TEXT', $7, 0, $8, $9, sha256(convert_to($9, 'UTF8')), $10)`,
      [id, f.mohamed, f.session, f.turn, f.batch, role, ordinal, [...text].length, text, sp]);
    await unit(f.userUnit, 'USER', f.userText, 0, 1);
    await unit(f.assistantUnit, 'ASSISTANT', f.assistantText, 1, 2);
    await provisionWorld(f, f.world);
  }
  /** A Shared World where Mohamed is a member and Hadir is a FORMER member. */
  async function provisionWorld(f, world) {
    await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at)
             VALUES ($1, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', now())`, [world]);
    await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
             VALUES ($1, $2, $3, now(), NULL)`, [randomUUID(), world, f.mohamed]);
    await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
             VALUES ($1, $2, $3, now(), now())`, [randomUUID(), world, f.hadir]);
    await provisionMaterials(f, world);
  }
  async function commitMaterial(world, id, kind, author, text, mode, resolution, approvers, baselineViewer) {
    const historyItem = randomUUID();
    await q(`INSERT INTO public.shared_world_history_items
               (id, world_id, occurred_at, authority_requirement_mode, availability_state,
                availability_revision, registered_at)
             VALUES ($1, $2, clock_timestamp(), $3, 'AVAILABLE', 1, clock_timestamp())`, [historyItem, world, mode]);
    await q('INSERT INTO public.shared_world_history_item_baseline_viewers (history_item_id, user_id) VALUES ($1, $2)',
      [historyItem, baselineViewer]);
    for (const approver of approvers) {
      await q('INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id) VALUES ($1, $2)',
        [historyItem, approver]);
    }
    await q(`INSERT INTO public.shared_world_materials
               (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
             SELECT $1, $2, $3, $4, $5, $6, $7, i.occurred_at FROM public.shared_world_history_items i WHERE i.id = $3`,
    [id, world, historyItem, kind, kind.startsWith('HUMAN') ? 'HUMAN' : 'QANDEEL',
      kind === 'HUMAN_VOICE_NOTE' ? 'VOICE_NOTE' : 'TEXT', kind.startsWith('HUMAN') ? author : null]);
    if (kind === 'HUMAN_VOICE_NOTE') {
      await q(`INSERT INTO public.shared_world_voice_note_material_bodies (material_id, body_form, audio_object_ref)
               VALUES ($1, 'VOICE_NOTE', 'opaque-media-object-ref')`, [id]);
    } else {
      await q('INSERT INTO public.shared_world_text_material_bodies (material_id, body_form, body_text) VALUES ($1, $2, $3)',
        [id, 'TEXT', text]);
    }
    if (resolution) {
      await q(`INSERT INTO public.shared_world_material_historical_authority
                 (material_id, world_id, history_item_id, resolution_state) VALUES ($1, $2, $3, $4)`,
      [id, world, historyItem, resolution]);
    }
    return historyItem;
  }
  async function provisionMaterials(f, world) {
    const EXACT = 'EXACT_HUMAN_APPROVER_SET';
    await commitMaterial(world, f.hiddenMaterial, 'HUMAN_TEXT', f.hadir, 'a sentence Mohamed never saw',
      EXACT, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.hadir);
    await commitMaterial(world, f.mohamedMaterial, 'HUMAN_TEXT', f.mohamed, 'a sentence Mohamed wrote',
      EXACT, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.mohamed], f.mohamed);
    await commitMaterial(world, f.hadirMaterial, 'HUMAN_TEXT', f.hadir, 'a sentence Hadir wrote',
      EXACT, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
    await commitMaterial(world, f.unresolvedMaterial, 'QANDEEL_ANALYSIS', null, 'analysis over protected human material',
      EXACT, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT', [f.mohamed], f.mohamed);
    await commitMaterial(world, f.noHumanMaterial, 'QANDEEL_OUTPUT', null, 'output with no protected human subject',
      'NO_HUMAN_APPROVAL_REQUIRED', 'RESOLVED_NO_HUMAN_REQUIREMENT', [], f.mohamed);
    await commitMaterial(world, f.voiceMaterial, 'HUMAN_VOICE_NOTE', f.hadir, null,
      EXACT, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
    await commitMaterial(world, f.metadatalessMaterial, 'QANDEEL_ANALYSIS', null, 'analysis with no recorded resolution',
      EXACT, null, [f.mohamed], f.mohamed);
  }
  /** Mohamed's and Hadir's stable Public Identities, get-or-create. */
  async function provisionIdentities(f) {
    await actAs(f.mohamed);
    await ensureIdentity(randomUUID(), f.mohamedRef, 'PSEUDONYM', 'the publisher');
    await actAs(f.hadir);
    await ensureIdentity(randomUUID(), f.hadirRef, 'PSEUDONYM', 'hadir public');
    await actAs(f.stranger);
    await ensureIdentity(randomUUID(), f.strangerRef, 'REAL_NAME', 'a stranger');
    await actAs(f.mohamed);
  }
  /**
   * Take one Experience from nothing to READY_FOR_REVIEW through the frozen
   * I-05A primitives alone: draft, prepare, every required approval, READY.
   */
  async function bringToReady(f, { experience, manifest, version, personal = true, shared = [f.mohamedMaterial, f.hadirMaterial] }) {
    await actAs(f.mohamed);
    await createDraft(randomUUID(), experience);
    const [prepared] = await prepare(randomUUID(), experience, manifest, version,
      personal ? [randomUUID()] : NONE, personal ? [f.userUnit] : NONE,
      shared.map(() => randomUUID()), shared.map(() => f.world), shared);
    assert.equal(prepared.outcome, 'PACKAGE_PREPARED', 'fixture: the package prepared');
    const required = (await rows(`SELECT approver_user_id a FROM ${T.REQUIRED} WHERE manifest_version_id = $1 ORDER BY 1`, [manifest]))
      .map((r) => r.a);
    const approvals = new Map();
    for (const approver of required) {
      await actAs(approver);
      const id = randomUUID();
      const [approved] = await approve(id, manifest);
      assert.equal(approved.outcome, 'APPROVED', 'fixture: a required rightsholder approved');
      approvals.set(approver, id);
    }
    await actAs(f.mohamed);
    const [ready] = await commitReady(randomUUID(), experience, version);
    assert.equal(ready.outcome, 'READY_FOR_REVIEW', 'fixture: READY_FOR_REVIEW committed');
    return { experience, manifest, version, approvals, required, fingerprint: ready.authority_request_fingerprint };
  }

  /**
   * VERIFIER-ONLY SIMULATION of a later reviewed successor publication.
   *
   * No product primitive can do this - a READY or PUBLISHED Experience admits no
   * new package through the frozen preparation, and the publication record is
   * append-only for every role - and successor-publication semantics belong to a
   * later slice. The caller runs this inside a transaction it rolls back. It
   * writes, as the table owner: a second manifest of the SAME Experience (a copy
   * of the published one under a new identity), a second version bound to it,
   * the immutable publication record re-pointed at both with its guard lifted
   * and restored, and the current pointer moved - so the ONE visibility
   * derivation now answers the successor. It exists so the exact-version closure
   * of discussion, Public QANDEEL and vitality can be proven against a visible
   * V2 that has REAL V1 history behind it, written by the real writers.
   */
  async function simulateSuccessorVersion(experience, manifest) {
    await asRole('postgres');
    const successorManifest = randomUUID();
    const successorVersion = randomUUID();
    await q(`INSERT INTO ${T.MANIFESTS} (id, experience_id, public_world_singleton, publisher_public_identity_ref, publisher_user_id,
               intended_publication_action, target_audience_class, authority_readiness, prepared_authority_snapshot_version, item_count, created_at)
             SELECT $1, experience_id, true, publisher_public_identity_ref, publisher_user_id, intended_publication_action,
                    target_audience_class, authority_readiness, prepared_authority_snapshot_version, item_count, clock_timestamp()
               FROM ${T.MANIFESTS} WHERE id = $2`, [successorManifest, manifest]);
    const [{ next }] = await rows(`SELECT coalesce(max(version_ordinal), 0) + 1 AS next FROM ${T.VERSIONS} WHERE experience_id = $1`, [experience]);
    await q(`INSERT INTO ${T.VERSIONS} (id, experience_id, package_manifest_version_id, version_ordinal, created_at)
             VALUES ($1, $2, $3, $4, clock_timestamp())`, [successorVersion, experience, successorManifest, next]);
    await q(`ALTER TABLE ${T.PUBLICATION_STATE} DISABLE TRIGGER public_experience_publication_state_immutable`);
    await q(`UPDATE ${T.PUBLICATION_STATE}
                SET published_experience_version_id = $2, published_manifest_version_id = $3,
                    publication_revision = publication_revision + 1
              WHERE experience_id = $1`, [experience, successorVersion, successorManifest]);
    await q(`ALTER TABLE ${T.PUBLICATION_STATE} ENABLE TRIGGER public_experience_publication_state_immutable`);
    await q(`UPDATE ${T.EXPERIENCES} SET current_experience_version_id = $2 WHERE id = $1`, [experience, successorVersion]);
    const [vs] = await visibility(experience);
    assert.equal(vs.visibility_state, 'PUBLICLY_VISIBLE', 'successor simulation: the successor version is the visible one');
    assert.equal(vs.visible_experience_version_id, successorVersion);
    assert.equal(vs.visible_manifest_version_id, successorManifest);
    return { successorManifest, successorVersion, successorOrdinal: Number(next) };
  }

  /** Remove every committed fixture, lifting the append-only guards inside ONE transaction. */
  async function removeCommittedFixtures(c) {
    await asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of IMMUTABLE_RELATIONS) await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      const manifests = `SELECT id FROM ${T.MANIFESTS} WHERE experience_id = ANY($1::uuid[])`;
      const ex = [c.experiences];
      await q(`DELETE FROM ${T.PROJECTION} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.VITALITY} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.RESPONSE_COMMANDS} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.RESPONSES} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.POST_COMMANDS} WHERE experience_id = ANY($1::uuid[])`, ex);
      // Replies reference their parent with RESTRICT, which is checked per row: remove leaves first.
      for (let pass = 0; pass < 12; pass += 1) {
        const removed = await q(`DELETE FROM ${T.POSTS} p WHERE p.experience_id = ANY($1::uuid[])
                                    AND NOT EXISTS (SELECT 1 FROM ${T.POSTS} child WHERE child.parent_post_id = p.id)`, ex);
        if (removed.rowCount === 0) break;
      }
      await q(`DELETE FROM ${T.PLACEMENT_COMMANDS} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.PLACEMENTS} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.PUBLISH_COMMANDS} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.PUBLICATION_STATE} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.WITHDRAWAL_COMMANDS} WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM ${T.WITHDRAWAL_EVENTS} WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM public.public_experience_review_ready_commands WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM public.publication_package_prepare_commands WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.APPROVALS} WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM ${T.REQUIRED} WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM ${T.ITEM_AUTHORITY} WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM ${T.PROVENANCE} WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM ${T.BODIES} WHERE package_item_id IN
                 (SELECT package_item_id FROM ${T.ITEMS} WHERE manifest_version_id IN (${manifests}))`, ex);
      await q(`DELETE FROM ${T.LIFECYCLE} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`UPDATE ${T.EXPERIENCES} SET current_experience_version_id = NULL WHERE id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.ITEMS} WHERE manifest_version_id IN (${manifests})`, ex);
      await q(`DELETE FROM ${T.VERSIONS} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.MANIFESTS} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.CONTROLLERS} WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM public.public_experience_draft_commands WHERE experience_id = ANY($1::uuid[])`, ex);
      await q(`DELETE FROM ${T.EXPERIENCES} WHERE id = ANY($1::uuid[])`, ex);
      await q('DELETE FROM public.public_identity_commands WHERE actor_user_id = ANY($1::uuid[])', [c.humans]);
      await q(`DELETE FROM ${T.DISPLAY} WHERE public_identity_ref IN
                 (SELECT public_identity_ref FROM ${T.IDENTITIES} WHERE user_id = ANY($1::uuid[]))`, [c.humans]);
      await q(`DELETE FROM ${T.IDENTITIES} WHERE user_id = ANY($1::uuid[])`, [c.humans]);
      // The Shared source, in the frozen I-04G order.
      await q('DELETE FROM public.shared_world_material_delete_commands WHERE world_id = $1', [c.world]);
      await q('DELETE FROM public.shared_world_material_deleted_events WHERE world_id = $1', [c.world]);
      await q('DELETE FROM public.shared_world_material_historical_authority WHERE world_id = $1', [c.world]);
      await q(`DELETE FROM public.shared_world_text_material_bodies WHERE material_id IN
                 (SELECT id FROM public.shared_world_materials WHERE world_id = $1)`, [c.world]);
      await q(`DELETE FROM public.shared_world_voice_note_material_bodies WHERE material_id IN
                 (SELECT id FROM public.shared_world_materials WHERE world_id = $1)`, [c.world]);
      await q('DELETE FROM public.shared_world_materials WHERE world_id = $1', [c.world]);
      await q(`DELETE FROM public.shared_world_history_item_required_approvers WHERE history_item_id IN
                 (SELECT id FROM public.shared_world_history_items WHERE world_id = $1)`, [c.world]);
      await q(`DELETE FROM public.shared_world_history_item_baseline_viewers WHERE history_item_id IN
                 (SELECT id FROM public.shared_world_history_items WHERE world_id = $1)`, [c.world]);
      await q('DELETE FROM public.shared_world_history_items WHERE world_id = $1', [c.world]);
      await q('DELETE FROM public.shared_world_membership_episodes WHERE world_id = $1', [c.world]);
      await q('DELETE FROM public.shared_worlds WHERE id = $1', [c.world]);
      await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [c.humans]);
      await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [c.humans]);
      for (const [table, trigger] of IMMUTABLE_RELATIONS) await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
    } finally {
      await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
    }
    for (const [table, trigger] of IMMUTABLE_RELATIONS) {
      assert.equal(await triggerEnabled(table, trigger), true, `${trigger} is enabled again after fixture teardown`);
    }
  }

  /** A second connection for the races, with database-enforced wait bounds on both. */
  async function openSecondary() {
    const second = new Client({ connectionString: databaseUrl });
    await second.connect();
    const q2 = (text, values = []) => second.query(text, values);
    const actAs2 = async (uid) => {
      await q2('RESET ROLE');
      await q2("SELECT set_config('request.jwt.claims', $1, false)",
        [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
    };
    for (const run of [q, q2]) {
      await run("SET lock_timeout = '10s'");
      await run("SET statement_timeout = '15s'");
    }
    const close = async () => {
      await q('ROLLBACK').catch(() => undefined);
      await q("SET lock_timeout = '0'").catch(() => undefined);
      await q("SET statement_timeout = '0'").catch(() => undefined);
      await second.end().catch(() => undefined);
    };
    return { q2, actAs2, close };
  }
  /** True when a launched promise is still in flight after the observation window. */
  async function stillPending(promise, milliseconds = 400) {
    let settled = false;
    promise.then(() => { settled = true; }, () => { settled = true; });
    await new Promise((resolve) => { setTimeout(resolve, milliseconds); });
    return !settled;
  }

  return {
    client, q, rows, count, actAs, asRole, rejected,
    ensureIdentity, updateLabel, createDraft, prepare, approve, commitReady, review, deleteMaterial, deriveAuthority,
    deriveApprovalState, deriveManifestApprovals, withdraw,
    publish, visibility, admission, serving, prerequisites,
    recordPlacement, currentPlacement, resolvePlacement, post, resolveDiscussion, recordResponse, resolveResponses,
    recomputeVitality, resolveVitality, rebuildProjection, search, lens, panel,
    foreignKeysInto, uniqueKeyColumns, assertExactBinding,
    functionPosture, canExecute, resultColumns, inputParameters, triggerEnabled, verifyPosture,
    captureSeam, clearPrerequisites, restorePrerequisites, publishCleared,
    newFixture, provision, provisionWorld, provisionMaterials, provisionIdentities, commitMaterial, bringToReady,
    simulateSuccessorVersion, removeCommittedFixtures, openSecondary, stillPending,
  };
}

/**
 * Run one verifier's main with the shared stage-reporting envelope.
 *
 * `cleanup` runs on EVERY path - success, assertion failure, harness crash - and
 * is where the verifier ends its database client. A client left open after a
 * failure keeps the Node process alive with nothing to do, and a CI step that
 * never exits reports nothing: the first I-05B head hung its grouped step for
 * this exact reason. After cleanup a bounded fallback exit guarantees the
 * process ends even if some other handle survived; the exit code is already set.
 */
export async function runVerifier(label, body, cleanup = null) {
  let stage = 'connect';
  const setStage = (next) => { stage = next; console.log(`${label} stage: ${next}`); };
  try {
    await body(setStage);
    console.log(`migration ${label} verified`);
  } catch (error) {
    console.error(`migration ${label} verification failed at stage: ${stage}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      if (cleanup) await cleanup();
    } catch (error) {
      console.error(`migration ${label} cleanup failed`);
      console.error(error);
      process.exitCode = 1;
    }
    setTimeout(() => process.exit(process.exitCode ?? 0), 5000).unref();
  }
}
