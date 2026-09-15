// Real-PostgreSQL verifier for migration 0093 - I-05A Public Experience Draft /
// Approval / READY_FOR_REVIEW Runtime v1 (PART C).
//
// Runs against a FULLY migrated database and proves the BEHAVIOUR of the only
// things that ever write Public World state, from live catalogs and live
// execution rather than from the migration text:
//
//   catalog / posture
//     * every primitive is postgres-owned, SECURITY DEFINER, search_path-pinned,
//       VOLATILE where it mutates and STABLE where it derives, and executable by
//       NO application role - PUBLIC, anon, authenticated and service_role alike;
//     * the ONE review resolver is service_role-executable alone, and its declared
//       RESULT columns - read through `proargmodes`, because `proargnames` on a
//       RETURNS TABLE function holds the parameters AND the result columns in one
//       array - disclose no account, contact endpoint or sealed provenance;
//     * P29 no primitive can produce PUBLISHED or ABSENT_FROM_PUBLIC_WORLD.
//
//   identity and Experience
//     * P03 the Public Identity ref is stable across display-label changes;
//     * P04 a label change creates no Experience version and mutates no manifest;
//     * P05 the review surface exposes no private account or contact endpoint;
//     * P06 stable Experience identity survives several draft versions;
//     * P07 / P21 Experience control and content rights stay distinct.
//
//   Personal source
//     * P08 a human prepares a bounded derivative from their own committed text;
//     * P09 another human cannot prepare that Personal source;
//     * P10 the derivative is a SNAPSHOT: a later Personal change does not rewrite it;
//     * P11 the package creates no navigation path back to the Personal Session;
//     * P12 Personal QANDEEL analysis FAILS CLOSED rather than becoming approval-free.
//
//   Shared source and authority
//     * P13 Mohamed-only material requires Mohamed, not Hadir for membership;
//     * P14 Hadir-owned material requires Hadir;
//     * P15 mixed material requires the exact union;
//     * P16 a FORMER Shared member approves their own included material without
//       regaining any Shared browsing;
//     * P17 material carrying UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT cannot enter
//       a package at all;
//     * P18 a genuinely resolved no-human requirement derives zero approvers, and
//       only when the source state explicitly proves it;
//     * P19 no caller can supply or forge the approver set;
//     * P20 the controller cannot bypass a missing source-owner approval;
//     * P21 a source owner's approval grants no Experience control.
//
//   manifest and lifecycle
//     * P23 a changed included source creates a NEW manifest and a new version;
//     * P24 an approval for manifest A cannot authorize manifest B;
//     * P25 source deletion before the READY commit stales it;
//     * P26 a source authority change before the READY commit stales it;
//     * P27 / P28 DRAFT and READY_FOR_REVIEW produce zero public visibility;
//     * P30 preparing reserves no authority: the commit re-evaluates everything.
//
//   idempotency and concurrency
//     * P31 an exact create / prepare / approve / ready retry is stable;
//     * P32 a conflicting command identity reuse fails;
//     * P33 package change versus approval serializes truthfully;
//     * P34 source deletion versus the READY commit has ONE truthful winner;
//     * P35 an alias change concurrent with package preparation mutates neither
//       the package nor its version;
//     * P36 unrelated Experience activity stales nothing.
//
//   forward safety inside a rolled-back SAVEPOINT, then every regression to
//   something 0093 OWNS planted and still refused; and zero fixture residue.
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

/**
 * Become one exact human for auth.uid(), without leaving the owner role.
 *
 * The claim is set SESSION-scoped rather than transaction-scoped on purpose: the
 * concurrency proofs below run statements outside an explicit transaction, where
 * a transaction-local setting would be gone by the next statement and every
 * auth.uid() would silently read NULL.
 */
async function actAs(uid) {
  await q('RESET ROLE');
  await q("SELECT set_config('request.jwt.claims', $1, false)", [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
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
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')}): ${error.message}`);
  if (message) assert.match(error.message, message);
  return error;
}

const EXPERIENCES = 'public.public_experiences';
const VERSIONS = 'public.public_experience_versions';
const LIFECYCLE = 'public.public_experience_lifecycle_events';
const CONTROLLERS = 'public.public_experience_controllers';
const IDENTITIES = 'public.public_identities';
const DISPLAY = 'public.public_identity_display_state';
const MANIFESTS = 'public.publication_package_manifest_versions';
const ITEMS = 'public.publication_package_manifest_items';
const BODIES = 'public.public_experience_text_derivative_bodies';
const PROVENANCE = 'public.publication_package_item_provenance';
const ITEM_AUTHORITY = 'public.publication_package_item_authority';
const REQUIRED = 'public.publication_manifest_required_approvers';
const APPROVALS = 'public.publication_manifest_approvals';
const COMMAND_TABLES = ['public.public_identity_commands', 'public.public_experience_draft_commands',
  'public.publication_package_prepare_commands', 'public.public_experience_review_ready_commands'];

const MUTATIONS = [
  'public.ensure_public_identity_v1(uuid, uuid, text, text)',
  'public.update_public_display_label_v1(uuid, text, text)',
  'public.create_public_experience_draft_v1(uuid, uuid)',
  'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])',
  'public.approve_public_experience_manifest_v1(uuid, uuid)',
  'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)',
];
const DERIVATIONS = [
  'public.derive_public_publication_authority_v1(uuid)',
  'public.resolve_public_package_items_v1(uuid[], uuid[], uuid[], uuid[], uuid[])',
];
const RESOLVER = 'public.resolve_public_experience_review_v1(uuid, uuid)';
const APP_ROLES = ['anon', 'authenticated', 'service_role'];

const NONE = [];
const ensureIdentity = (command, ref, mode, label) =>
  rows('SELECT * FROM public.ensure_public_identity_v1($1, $2, $3, $4)', [command, ref, mode, label]);
const updateLabel = (command, mode, label) =>
  rows('SELECT * FROM public.update_public_display_label_v1($1, $2, $3)', [command, mode, label]);
const createDraft = (command, experience) =>
  rows('SELECT * FROM public.create_public_experience_draft_v1($1, $2)', [command, experience]);
const prepare = (command, experience, manifest, version, personalItems, personalUnits, sharedItems, sharedWorlds, sharedMaterials) =>
  rows(`SELECT * FROM public.prepare_public_experience_manifest_v1($1,$2,$3,$4,$5::uuid[],$6::uuid[],$7::uuid[],$8::uuid[],$9::uuid[])`,
    [command, experience, manifest, version, personalItems, personalUnits, sharedItems, sharedWorlds, sharedMaterials]);
const approve = (approval, manifest) =>
  rows('SELECT * FROM public.approve_public_experience_manifest_v1($1, $2)', [approval, manifest]);
const commitReady = (command, experience, version) =>
  rows('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)', [command, experience, version]);
const review = (experience, user) =>
  rows('SELECT * FROM public.resolve_public_experience_review_v1($1, $2)', [experience, user]);

// ---------------------------------------------------------------------- catalog

async function verifyCatalog() {
  for (const fn of [...MUTATIONS, ...DERIVATIONS]) {
    const [p] = await rows(
      `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc,
              pg_get_userbyid(pr.proowner) owner FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [fn]);
    assert.ok(p, `${fn} exists`);
    assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
    assert.equal(p.secdef, true, `${fn} is SECURITY DEFINER`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `${fn} pins an empty search_path`);
    assert.equal(p.volatility, MUTATIONS.includes(fn) ? 'v' : 's',
      `${fn} is ${MUTATIONS.includes(fn) ? 'VOLATILE' : 'STABLE'}`);
    for (const role of ['public', ...APP_ROLES]) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', [role, fn, 'EXECUTE']);
      assert.equal(allowed, false,
        `${role} must not execute ${fn} before the frozen CW2-08 Launch Gate exists`);
    }
    // P29 no primitive can produce a public lifecycle. `prosrc` includes comments.
    assert.ok(!p.prosrc.includes('PUBLISHED'), `P29 ${fn} cannot produce PUBLISHED`);
    assert.ok(!p.prosrc.includes('ABSENT_FROM_PUBLIC_WORLD'), `P29 ${fn} cannot produce ABSENT_FROM_PUBLIC_WORLD`);
  }
  for (const fn of DERIVATIONS) {
    const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fn]);
    assert.ok(!prosrc.includes('INSERT INTO') && !prosrc.includes('DELETE FROM'), `${fn} writes nothing`);
  }
  // Every mutation takes the canonical locks and no advisory or table lock.
  for (const fn of MUTATIONS) {
    const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fn]);
    assert.doesNotMatch(prosrc, /pg_advisory|LOCK TABLE|TRUNCATE/iu, `${fn} takes no advisory or table lock`);
    assert.doesNotMatch(prosrc, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/iu,
      `${fn} accepts no clock but one read of the database's own`);
    // FIX-A narrowed this. Re-implementing Shared entitlement is banned;
    // CONSUMING the canonical I-04F entry point is required, and the SHARE lock
    // on the Shared World row is what keeps its answer from going stale.
    for (const forbidden of ['shared_world_membership_episodes', 'shared_world_history_access_grants',
      'shared_world_standard_closed_view_entitlements', 'shared_world_history_package_manifest_items']) {
      assert.ok(!prosrc.includes(forbidden),
        `${fn} must not re-implement Shared authorization out of ${forbidden}`);
    }
  }
  // The one place a Shared body is copied proves source-view authority through
  // the canonical entry point, while holding the Shared World row.
  const [{ prosrc: prepareSrc }] = await rows(
    'SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
    ['public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])']);
  assert.ok(prepareSrc.includes('resolve_shared_world_history_visibility_v1'),
    'preparation proves the initiator may currently SEE each selected Shared history item');
  assert.ok(prepareSrc.indexOf('public.shared_worlds w') < prepareSrc.indexOf('resolve_shared_world_history_visibility_v1'),
    'and it holds the Shared World row before resolving that answer');
  const [{ allowed: entryPoint }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed',
    ['service_role', 'public.resolve_shared_world_history_visibility_v1(uuid, uuid)', 'EXECUTE']);
  assert.equal(entryPoint, true, 'the frozen I-04F visibility entry point is still reachable');
  // FIX-B the fingerprint binds the intended protected action, not the command.
  const [{ prosrc: deriveSrc }] = await rows(
    'SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
    ['public.derive_public_publication_authority_v1(uuid)']);
  assert.ok(deriveSrc.includes('manifest.intended_publication_action'),
    'AB02 the authority fingerprint binds the intended publication action');
  assert.ok(!deriveSrc.includes('PREPARE_PUBLICATION'), 'and never the preparation command');

  // The ONE review resolver.
  const [resolver] = await rows(
    `SELECT pr.prosecdef secdef, pr.provolatile volatility, pr.proconfig config, pr.prosrc,
            pg_get_userbyid(pr.proowner) owner FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [RESOLVER]);
  assert.equal(resolver.owner, 'postgres');
  assert.equal(resolver.secdef, true);
  assert.equal(resolver.volatility, 's', 'the review resolver is STABLE');
  assert.ok((resolver.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'));
  assert.ok(!resolver.prosrc.includes('publication_package_item_provenance'),
    'the review resolver never reads sealed provenance');
  for (const role of ['public', 'anon', 'authenticated']) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', [role, RESOLVER, 'EXECUTE']);
    assert.equal(allowed, false, `${role} must not execute the review resolver`);
  }
  const [{ allowed: serviceRole }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed',
    ['service_role', RESOLVER, 'EXECUTE']);
  assert.equal(serviceRole, true, 'service_role executes the ONE review resolver');

  // Its RESULT columns, read through proargmodes. `proargnames` alone would be
  // the input parameters AND the result columns in one array.
  const resultColumns = (await rows(
    `SELECT arg.name FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
      WHERE pr.oid = $1::regprocedure AND arg.mode = 't'`, [RESOLVER])).map((r) => r.name);
  assert.ok(resultColumns.length > 0, 'the review resolver declares result columns');
  for (const column of resultColumns) {
    assert.doesNotMatch(column,
      /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material_id|history_item|availability|context_ref|world_id/u,
      `P05 the review resolver must not return ${column}`);
  }
  // And no mutation accepts an authority, approver, audience or instant PARAMETER.
  for (const fn of MUTATIONS) {
    const inputs = (await rows(
      `SELECT arg.name FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
        WHERE pr.oid = $1::regprocedure AND arg.mode = 'i'`, [fn])).map((r) => r.name);
    for (const name of inputs) {
      assert.doesNotMatch(name,
        /approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|body_text|ordinal|count|classification|revision|fingerprint/u,
        `P19 ${fn} may not accept ${name}`);
    }
  }

  for (const table of COMMAND_TABLES) {
    const [{ rls, owner }] = await rows(
      'SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass', [table]);
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

  // The frozen predecessor boundaries this slice consumes are intact.
  for (const [table, trigger] of [['public.conversation_units', 'conversation_units_immutable'],
    ['public.shared_world_history_package_manifest_items', 'shared_world_material_historical_widening_gate']]) {
    const [tg] = await rows(
      'SELECT tg.tgenabled FROM pg_trigger tg WHERE tg.tgrelid = $1::regclass AND tg.tgname = $2 AND NOT tg.tgisinternal',
      [table, trigger]);
    assert.ok(tg && tg.tgenabled === 'O', `the frozen ${trigger} is still in place`);
  }
}

// --------------------------------------------------------- identity / Experience

async function verifyIdentityAndExperience(f) {
  await actAs(f.mohamed);
  const [created] = await ensureIdentity(randomUUID(), f.mohamedRef, 'PSEUDONYM', 'a chosen name');
  assert.equal(created.outcome, 'CREATED');
  assert.equal(created.public_identity_ref, f.mohamedRef);
  // The ref may not BE the account id, and a caller cannot claim otherwise.
  await rejected(() => ensureIdentity(randomUUID(), f.mohamed, 'PSEUDONYM', 'x'), ['22023'],
    /PUBLIC_EXPERIENCE_COMMAND_INVALID/u);
  await rejected(() => ensureIdentity(randomUUID(), randomUUID(), 'VERIFIED', 'x'), ['22023']);
  await rejected(() => ensureIdentity(randomUUID(), randomUUID(), 'PSEUDONYM', '   '), ['22023']);
  // `ensure` is get-or-create and never rewrites a chosen label.
  const [again] = await ensureIdentity(randomUUID(), randomUUID(), 'REAL_NAME', 'something else');
  assert.equal(again.outcome, 'ALREADY_PRESENT');
  assert.equal(again.public_identity_ref, f.mohamedRef, 'P03 the Public Identity ref is stable');
  assert.equal(again.display_label, 'a chosen name', 'and a creation retry never rewrites a chosen alias');

  // P03 / P04 a label change moves the label and NOTHING else.
  const [relabelled] = await updateLabel(randomUUID(), 'REAL_NAME', 'a chosen real name');
  assert.equal(relabelled.outcome, 'UPDATED');
  assert.equal(relabelled.public_identity_ref, f.mohamedRef, 'P03 the ref survives the label change');
  assert.equal(Number(relabelled.label_revision), 2);
  // Another human cannot rename this public presentation: there is no identity parameter.
  await actAs(f.stranger);
  await rejected(() => updateLabel(randomUUID(), 'PSEUDONYM', 'hijacked'), ['42501'],
    /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(f.mohamed);

  // A human with no Public Identity cannot create a Public Experience.
  await actAs(f.stranger);
  await rejected(() => createDraft(randomUUID(), randomUUID()), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(f.hadir);
  await ensureIdentity(randomUUID(), f.hadirRef, 'PSEUDONYM', 'hadir public');
  await actAs(f.mohamed);

  const [draft] = await createDraft(f.draftCommand, f.experience);
  assert.equal(draft.outcome, 'DRAFT_CREATED');
  assert.equal(draft.current_lifecycle, 'DRAFT');
  assert.equal(draft.created_by_public_identity_ref, f.mohamedRef,
    'the creating human is attributed by their own stable public identity, which no parameter named');
  // Creation gives control to the exact creating human and nobody else.
  const controllers = await rows(`SELECT controller_user_id FROM ${CONTROLLERS} WHERE experience_id = $1`, [f.experience]);
  assert.deepEqual(controllers.map((r) => r.controller_user_id), [f.mohamed]);
  // P31 an exact retry is stable; P32 a conflicting identity reuse fails.
  const [retry] = await createDraft(f.draftCommand, f.experience);
  assert.equal(retry.outcome, 'ALREADY_COMMITTED');
  assert.equal(retry.experience_id, f.experience);
  await rejected(() => createDraft(f.draftCommand, randomUUID()), ['23505'],
    /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  // And one Experience identity commits at most once.
  await rejected(() => createDraft(randomUUID(), f.experience), ['23505']);
}

// ------------------------------------------------------------- Personal source

async function verifyPersonalSource(f) {
  await actAs(f.mohamed);
  // P08 a human prepares a bounded derivative from their own committed text.
  const [prepared] = await prepare(f.prepareCommand, f.experience, f.manifest, f.version,
    [f.personalItem], [f.userUnit], NONE, NONE, NONE);
  assert.equal(prepared.outcome, 'PACKAGE_PREPARED');
  assert.equal(Number(prepared.item_count), 1);
  assert.equal(Number(prepared.version_ordinal), 1);
  assert.equal(Number(prepared.required_approver_count), 1, 'the exact owning human is the content authority');
  assert.match(prepared.authority_request_fingerprint, /^sha256:[0-9a-f]{64}$/u);
  const [{ approver }] = await rows(`SELECT approver_user_id approver FROM ${REQUIRED} WHERE manifest_version_id = $1`,
    [f.manifest]);
  assert.equal(approver, f.mohamed);
  // The public body is the EXACT committed source text, in its own row.
  const [{ public_text_body: body }] = await rows(`SELECT public_text_body FROM ${BODIES} WHERE package_item_id = $1`,
    [f.personalItem]);
  assert.equal(body, f.userText);
  // The stored item count is the real one.
  const [{ n: realItems }] = await rows(`SELECT count(*) n FROM ${ITEMS} WHERE manifest_version_id = $1`, [f.manifest]);
  assert.equal(Number(realItems), Number(prepared.item_count));
  // The per-item authority is RESOLVED and agrees with its count.
  const [itemAuthority] = await rows(`SELECT * FROM ${ITEM_AUTHORITY} WHERE package_item_id = $1`, [f.personalItem]);
  assert.equal(itemAuthority.resolution_state, 'RESOLVED_EXACT_HUMAN_REQUIREMENT');
  assert.equal(Number(itemAuthority.required_approver_count), 1);

  // P11 the package creates NO navigation path back to the Personal Session or
  // World: the only binding is sealed provenance, and the item row carries none.
  const [provenance] = await rows(`SELECT * FROM ${PROVENANCE} WHERE package_item_id = $1`, [f.personalItem]);
  assert.equal(provenance.source_class, 'MY_WORLD');
  assert.equal(provenance.personal_conversation_unit_id, f.userUnit);
  assert.equal(provenance.personal_owner_user_id, f.mohamed, 'derived from the locked source row, not from a parameter');
  const itemColumns = (await rows(
    'SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped',
    [ITEMS])).map((r) => r.attname);
  for (const column of itemColumns) {
    assert.doesNotMatch(column, /session|turn|conversation_unit|world_id|shared_/u,
      `P11 the public item carries no ${column}`);
  }

  // P09 another human cannot prepare that Personal source.
  await actAs(f.hadir);
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    [randomUUID()], [f.userUnit], NONE, NONE, NONE), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(f.mohamed);

  // P12 Personal QANDEEL analysis FAILS CLOSED. It is not approval-free, and no
  // parameter can declare it so.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    [randomUUID()], [f.assistantUnit], NONE, NONE, NONE), ['55000'],
  /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
  // Including it BESIDE resolvable material fails the whole preparation closed.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    [randomUUID(), randomUUID()], [f.userUnit, f.assistantUnit], NONE, NONE, NONE), ['55000'],
  /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);

  // A source that does not exist is refused rather than silently skipped.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    [randomUUID()], [randomUUID()], NONE, NONE, NONE), ['P0002'], /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);
  // An empty package is refused.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    NONE, NONE, NONE, NONE, NONE), ['22023'], /PUBLIC_EXPERIENCE_COMMAND_INVALID/u);
  // Misaligned or duplicated selections are refused.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    [randomUUID()], [f.userUnit, f.userUnit], NONE, NONE, NONE), ['22023']);
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    [randomUUID(), randomUUID()], [f.userUnit, f.userUnit], NONE, NONE, NONE), ['22023']);

  // P31 / P32 preparation idempotency binds the WHOLE immutable request.
  const [prepareRetry] = await prepare(f.prepareCommand, f.experience, f.manifest, f.version,
    [f.personalItem], [f.userUnit], NONE, NONE, NONE);
  assert.equal(prepareRetry.outcome, 'ALREADY_COMMITTED');
  assert.equal(prepareRetry.manifest_version_id, f.manifest);
  assert.equal(prepareRetry.authority_request_fingerprint, prepared.authority_request_fingerprint);
  await rejected(() => prepare(f.prepareCommand, f.experience, randomUUID(), randomUUID(),
    [randomUUID()], [f.userUnit], NONE, NONE, NONE), ['23505'], /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);

  // P10 the derivative is a SNAPSHOT. The committed unit is append-only, so the
  // source change a Personal runtime can really make is a NEW committed unit and
  // a rewritten operational turn; neither reaches the public body.
  await q("UPDATE public.conversation_turns SET content = 'the human rewrote the turn' WHERE id = $1", [f.turn]);
  await q(`INSERT INTO public.conversation_units
             (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state,
              source_modality, ordinal_within_turn, source_span_start, source_span_end, committed_text,
              source_content_sha256, session_position)
           VALUES ($1, $2, $3, $4, $5, 'USER', 'RESOLVED', 'TEXT', 9, 0, 12, 'a later unit',
                   sha256(convert_to('a later unit', 'UTF8')), 9)`,
  [randomUUID(), f.mohamed, f.session, f.turn, f.batch]);
  const [{ public_text_body: unchanged }] = await rows(
    `SELECT public_text_body FROM ${BODIES} WHERE package_item_id = $1`, [f.personalItem]);
  assert.equal(unchanged, f.userText, 'P10 a later Personal change does not rewrite the public derivative');
}

// --------------------------------------------------- Shared source and authority

async function verifySharedAuthority(f) {
  await actAs(f.mohamed);
  const requiredOf = async (manifest) => (await rows(
    `SELECT approver_user_id a FROM ${REQUIRED} WHERE manifest_version_id = $1 ORDER BY approver_user_id`, [manifest]))
    .map((r) => r.a).sort();

  // P13 a package of Mohamed-only Shared material requires Mohamed, and does NOT
  // require Hadir merely because she is a member of the same Shared World.
  const m13 = randomUUID(); const v13 = randomUUID();
  const [p13] = await prepare(randomUUID(), f.experience, m13, v13, NONE, NONE,
    [randomUUID()], [f.world], [f.mohamedMaterial]);
  assert.equal(Number(p13.required_approver_count), 1);
  assert.deepEqual(await requiredOf(m13), [f.mohamed],
    'P13 World membership creates no approval requirement for unincluded material');

  // P14 a package containing Hadir-owned material requires Hadir.
  const m14 = randomUUID(); const v14 = randomUUID();
  const [p14] = await prepare(randomUUID(), f.experience, m14, v14, NONE, NONE,
    [randomUUID()], [f.world], [f.hadirMaterial]);
  assert.equal(Number(p14.required_approver_count), 1);
  assert.deepEqual(await requiredOf(m14), [f.hadir]);

  // P15 mixed material requires the EXACT union.
  const m15 = randomUUID(); const v15 = randomUUID();
  const [p15] = await prepare(randomUUID(), f.experience, m15, v15, [randomUUID()], [f.userUnit],
    [randomUUID(), randomUUID()], [f.world, f.world], [f.mohamedMaterial, f.hadirMaterial]);
  assert.equal(Number(p15.required_approver_count), 2);
  assert.deepEqual(await requiredOf(m15), [f.mohamed, f.hadir].sort());

  // P17 material carrying UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT cannot enter a
  // package at all. Public World does not reinterpret unresolved as zero approvers.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID()], [f.world], [f.unresolvedMaterial]), ['55000'],
  /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
  // Including it beside resolvable material fails the WHOLE preparation closed.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID(), randomUUID()], [f.world, f.world], [f.mohamedMaterial, f.unresolvedMaterial]), ['55000']);
  // And so does material with NO source-side authority metadata at all.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID()], [f.world], [f.metadatalessMaterial]), ['55000'],
  /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);

  // P18 a genuinely resolved no-human requirement derives ZERO approvers - and
  // only because the source state explicitly proves it.
  const m18 = randomUUID(); const v18 = randomUUID();
  const [p18] = await prepare(randomUUID(), f.experience, m18, v18, NONE, NONE,
    [randomUUID()], [f.world], [f.noHumanMaterial]);
  assert.equal(Number(p18.required_approver_count), 0, 'P18 zero human approval is valid when the state proves it');
  assert.deepEqual(await requiredOf(m18), []);
  const [{ resolution_state: noHumanState }] = await rows(
    `SELECT a.resolution_state FROM ${ITEM_AUTHORITY} a
      JOIN ${PROVENANCE} p ON p.package_item_id = a.package_item_id
     WHERE p.manifest_version_id = $1`, [m18]);
  assert.equal(noHumanState, 'RESOLVED_NO_HUMAN_REQUIREMENT');

  // A Shared kind with no public body form is refused rather than half-published.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID()], [f.world], [f.voiceMaterial]), ['0A000'], /PUBLIC_EXPERIENCE_SOURCE_KIND_RESERVED/u);

  // A Shared material named in the wrong World is refused.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID()], [randomUUID()], [f.mohamedMaterial]), ['P0002'], /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);

  // P23 a CHANGED included source creates a NEW manifest and a NEW version, and
  // the stable Experience identity is untouched.
  const experiences = await rows(`SELECT id, experience_revision FROM ${EXPERIENCES} WHERE id = $1`, [f.experience]);
  assert.equal(experiences.length, 1, 'P06 one stable Experience');
  const versions = await rows(`SELECT id, version_ordinal FROM ${VERSIONS} WHERE experience_id = $1 ORDER BY version_ordinal`,
    [f.experience]);
  assert.ok(versions.length >= 5, 'P06 / P23 several immutable versions, one per prepared package');
  assert.deepEqual(versions.map((r) => Number(r.version_ordinal)), versions.map((_, i) => i + 1),
    'version ordinals are a deterministic predecessor relation');
  const [{ current_experience_version_id: current }] = await rows(
    `SELECT current_experience_version_id FROM ${EXPERIENCES} WHERE id = $1`, [f.experience]);
  assert.equal(current, v18, 'the Experience points at the newest prospective version');

  return { m13, v13, m14, v14, m15, v15, m18, v18 };
}

// ---------------------------------------------------- approval and READY commit

async function verifyApprovalAndCommit(f, prepared) {
  // P24 an approval for manifest A cannot authorize manifest B: an approver of A
  // is not required by B, and the composite foreign key refuses the row.
  await actAs(f.hadir);
  await rejected(() => approve(randomUUID(), prepared.m13), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(f.mohamed);
  await rejected(() => approve(randomUUID(), prepared.m14), ['42501'], /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);

  // The package this Experience will actually commit: Hadir-owned material only,
  // prepared LAST so it is the Experience's current version. Nothing here reaches
  // around a primitive to set that up.
  await actAs(f.mohamed);
  const manifest = randomUUID(); const version = randomUUID();
  await prepare(randomUUID(), f.experience, manifest, version, NONE, NONE,
    [randomUUID()], [f.world], [f.hadirMaterial]);

  // P20 the controller cannot bypass a missing source-owner approval. Mohamed
  // controls the Experience and Hadir owns the included material.
  await rejected(() => commitReady(randomUUID(), f.experience, version), ['P0002'],
    /PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE/u);

  // P16 / P21 the FORMER Shared member approves her own included material. She
  // left the Shared World before this ran, she regains no browsing, and the
  // approval grants her no Experience control.
  const [{ n: stillMember }] = await rows(
    'SELECT count(*) n FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL',
    [f.world, f.hadir]);
  assert.equal(Number(stillMember), 0, 'P16 Hadir is a FORMER member at the moment she approves');
  await actAs(f.hadir);
  const [approved] = await approve(f.approval, manifest);
  assert.equal(approved.outcome, 'APPROVED');
  assert.equal(approved.approving_user_id, f.hadir);
  assert.match(approved.bound_authority_fingerprint, /^sha256:[0-9a-f]{64}$/u);
  const controllersNow = await rows(`SELECT controller_user_id FROM ${CONTROLLERS} WHERE experience_id = $1`, [f.experience]);
  assert.deepEqual(controllersNow.map((r) => r.controller_user_id), [f.mohamed],
    'P21 approving included content grants NO Experience control');
  // And approving restored no Shared browsing: this slice writes no membership.
  const [{ n: episodes }] = await rows(
    'SELECT count(*) n FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL',
    [f.world, f.hadir]);
  assert.equal(Number(episodes), 0, 'P16 a former member who approves regains no Shared membership');
  // P31 / P32 approval idempotency.
  const [approveRetry] = await approve(f.approval, manifest);
  assert.equal(approveRetry.outcome, 'ALREADY_APPROVED');
  await rejected(() => approve(f.approval, prepared.m13), ['23505'], /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  await rejected(() => approve(randomUUID(), manifest), ['23505'], /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);

  // Only the controller commits READY, and only for the CURRENT version.
  await actAs(f.hadir);
  await rejected(() => commitReady(randomUUID(), f.experience, version), ['42501'],
    /PUBLIC_EXPERIENCE_NOT_AUTHORIZED/u);
  await actAs(f.mohamed);
  await rejected(() => commitReady(randomUUID(), f.experience, prepared.v13), ['40001'],
    /PUBLIC_EXPERIENCE_STALE/u);

  const [ready] = await commitReady(f.readyCommand, f.experience, version);
  assert.equal(ready.outcome, 'READY_FOR_REVIEW');
  assert.equal(ready.current_lifecycle, 'READY_FOR_REVIEW');
  assert.equal(Number(ready.satisfied_approval_count), 1);
  assert.equal(ready.manifest_version_id, manifest);
  const [{ current_lifecycle: lifecycleNow }] = await rows(
    `SELECT current_lifecycle FROM ${EXPERIENCES} WHERE id = $1`, [f.experience]);
  assert.equal(lifecycleNow, 'READY_FOR_REVIEW');
  const transitions = await rows(
    `SELECT from_lifecycle, to_lifecycle FROM ${LIFECYCLE} WHERE experience_id = $1 ORDER BY occurred_at`, [f.experience]);
  assert.deepEqual(transitions, [{ from_lifecycle: null, to_lifecycle: 'DRAFT' },
    { from_lifecycle: 'DRAFT', to_lifecycle: 'READY_FOR_REVIEW' }],
  'P29 the only transitions I-05A produced are the two it owns');
  // P31 the READY retry is stable.
  const [readyRetry] = await commitReady(f.readyCommand, f.experience, version);
  assert.equal(readyRetry.outcome, 'ALREADY_COMMITTED');
  assert.equal(readyRetry.authority_request_fingerprint, ready.authority_request_fingerprint);
  await rejected(() => commitReady(f.readyCommand, f.experience, prepared.v13), ['23505'],
    /PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT/u);
  // I-05A owns no transition out of READY_FOR_REVIEW.
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), [randomUUID()],
    [f.userUnit], NONE, NONE, NONE), ['55000'], /PUBLIC_EXPERIENCE_LIFECYCLE_INVALID/u);

  // P27 / P28 zero public visibility, at DRAFT and at READY_FOR_REVIEW alike. The
  // review surface answers the exact controller and NOBODY else.
  const controllerView = await review(f.experience, f.mohamed);
  assert.ok(controllerView.length > 0, 'the controller sees their own prepared package');
  assert.equal(controllerView[0].current_lifecycle, 'READY_FOR_REVIEW');
  assert.equal(controllerView[0].publisher_public_identity_ref, f.mohamedRef);
  assert.equal(controllerView[0].publisher_display_label, 'a chosen real name',
    'the CURRENT display label renders, and the stable ref is what the package bound');
  assert.equal(controllerView[0].approvals_complete, true);
  for (const outsider of [f.hadir, f.stranger]) {
    assert.deepEqual(await review(f.experience, outsider), [],
      'P27 / P28 a non-controller receives zero rows, which discloses no existence');
  }
  assert.deepEqual(await review(randomUUID(), f.mohamed), [],
    'and an Experience that does not exist discloses nothing either');
  // No application role can reach any Public relation directly.
  for (const role of APP_ROLES) {
    await q('SAVEPOINT v');
    await asRole(role, f.mohamed);
    for (const table of [EXPERIENCES, VERSIONS, MANIFESTS, ITEMS, BODIES, PROVENANCE, APPROVALS]) {
      await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501']);
    }
    await asRole('postgres');
    await q('ROLLBACK TO SAVEPOINT v'); await q('RELEASE SAVEPOINT v');
  }
  // P04 an alias change now changes NEITHER the package nor the version.
  const before = await rows(`SELECT id, package_manifest_version_id FROM ${VERSIONS} WHERE experience_id = $1 ORDER BY version_ordinal`,
    [f.experience]);
  await actAs(f.mohamed);
  await updateLabel(randomUUID(), 'PSEUDONYM', 'renamed again');
  const after = await rows(`SELECT id, package_manifest_version_id FROM ${VERSIONS} WHERE experience_id = $1 ORDER BY version_ordinal`,
    [f.experience]);
  assert.deepEqual(after, before, 'P04 an alias change creates no Experience version and mutates no manifest');
  const [{ publisher_public_identity_ref: stillBound }] = await rows(
    `SELECT publisher_public_identity_ref FROM ${MANIFESTS} WHERE id = $1`, [manifest]);
  assert.equal(stillBound, f.mohamedRef, 'the package bound the stable ref, never the label');
}

// ----------------------------------------------------- staleness and revalidation

async function verifyStaleness(f) {
  // A fresh Experience so the staleness proofs are independent of the one above.
  await actAs(f.mohamed);
  const experience = randomUUID();
  await createDraft(randomUUID(), experience);

  // P26 a source AUTHORITY change before the READY commit stales it. Moving the
  // source-side historical authority forward is exactly what a later reviewed
  // subject-authority resolver does, in the direction that must fail closed.
  const m = randomUUID(); const v = randomUUID();
  await prepare(randomUUID(), experience, m, v, NONE, NONE, [randomUUID()], [f.world], [f.hadirMaterial]);
  await actAs(f.hadir);
  await approve(randomUUID(), m);
  await q('SAVEPOINT authority_change');
  await q(`UPDATE public.shared_world_material_historical_authority
              SET resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' WHERE material_id = $1`,
  [f.hadirMaterial]);
  await actAs(f.mohamed);
  await rejected(() => commitReady(randomUUID(), experience, v), ['55000'],
    /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
  await q('ROLLBACK TO SAVEPOINT authority_change'); await q('RELEASE SAVEPOINT authority_change');

  // P25 source DELETION before the READY commit stales it. The frozen I-04G owner
  // deletion transitions the history item and bumps its availability revision.
  await q('SAVEPOINT source_deletion');
  await actAs(f.hadir);
  await rows('SELECT * FROM public.delete_shared_world_owned_material_v1($1, $2, $3, $4)',
    [randomUUID(), f.world, f.hadirMaterial, randomUUID()]);
  await actAs(f.mohamed);
  await rejected(() => commitReady(randomUUID(), experience, v), ['P0002'],
    /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);
  await q('ROLLBACK TO SAVEPOINT source_deletion'); await q('RELEASE SAVEPOINT source_deletion');

  // P30 preparing reserves NO authority: the commit re-evaluates from current
  // state, and a change to the Public World authority snapshot stales it too.
  await q('SAVEPOINT snapshot_change');
  await q('UPDATE public.public_world_state SET state_version = state_version + 1');
  await actAs(f.mohamed);
  await rejected(() => commitReady(randomUUID(), experience, v), ['40001'], /PUBLIC_EXPERIENCE_STALE/u);
  await q('ROLLBACK TO SAVEPOINT snapshot_change'); await q('RELEASE SAVEPOINT snapshot_change');

  // P23 a changed package creates a NEW manifest, and the OLD version can no
  // longer commit - old approvals never float to a changed package.
  await actAs(f.mohamed);
  const m2 = randomUUID(); const v2 = randomUUID();
  await prepare(randomUUID(), experience, m2, v2, NONE, NONE,
    [randomUUID(), randomUUID()], [f.world, f.world], [f.hadirMaterial, f.mohamedMaterial]);
  assert.notEqual(m2, m, 'P23 a changed included source is a NEW manifest');
  await rejected(() => commitReady(randomUUID(), experience, v), ['40001'], /PUBLIC_EXPERIENCE_STALE/u);
  await rejected(() => commitReady(randomUUID(), experience, v2), ['P0002'],
    /PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE/u);
  const [{ n: carried }] = await rows(`SELECT count(*) n FROM ${APPROVALS} WHERE manifest_version_id = $1`, [m2]);
  assert.equal(Number(carried), 0, 'P24 no approval carried across to the changed package');

  // P36 unrelated Experience activity stales nothing here.
  const other = randomUUID();
  await createDraft(randomUUID(), other);
  await prepare(randomUUID(), other, randomUUID(), randomUUID(), [randomUUID()], [f.userUnit], NONE, NONE, NONE);
  await actAs(f.hadir);
  await approve(randomUUID(), m2);
  await actAs(f.mohamed);
  await approve(randomUUID(), m2);
  const [committed] = await commitReady(randomUUID(), experience, v2);
  assert.equal(committed.outcome, 'READY_FOR_REVIEW',
    'P36 an unrelated Experience being prepared in between stales nothing');
  assert.equal(Number(committed.satisfied_approval_count), 2);
}

// ------------------------------------------------------------------ concurrency

/**
 * The append-only truth this slice deploys is the reason committed fixtures need
 * a deliberate teardown: every Experience Version, every committed lifecycle
 * transition and every package relation refuses UPDATE and DELETE for EVERY role,
 * the table owner included. So the guards are lifted inside ONE transaction and
 * put back inside the same one - a crash rolls the whole thing back with the
 * guards intact, and the caller proves afterwards that every trigger is enabled.
 */
const IMMUTABLE_RELATIONS = [
  [VERSIONS, 'public_experience_versions_immutable'],
  [LIFECYCLE, 'public_experience_lifecycle_events_immutable'],
  [MANIFESTS, 'publication_package_manifest_versions_immutable'],
  [ITEMS, 'publication_package_manifest_items_immutable'],
  [BODIES, 'public_experience_text_derivative_bodies_immutable'],
  [PROVENANCE, 'publication_package_item_provenance_immutable'],
  [ITEM_AUTHORITY, 'publication_package_item_authority_immutable'],
  [REQUIRED, 'publication_manifest_required_approvers_immutable'],
  [APPROVALS, 'publication_manifest_approvals_immutable'],
];

async function removeConcurrencyFixtures(c) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    for (const [table, trigger] of IMMUTABLE_RELATIONS) {
      await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
    }
    const manifests = `SELECT id FROM ${MANIFESTS} WHERE experience_id = ANY($1::uuid[])`;
    await q(`DELETE FROM public.public_experience_review_ready_commands WHERE experience_id = ANY($1::uuid[])`, [c.experiences]);
    await q(`DELETE FROM public.publication_package_prepare_commands WHERE experience_id = ANY($1::uuid[])`, [c.experiences]);
    await q(`DELETE FROM ${APPROVALS} WHERE manifest_version_id IN (${manifests})`, [c.experiences]);
    await q(`DELETE FROM ${REQUIRED} WHERE manifest_version_id IN (${manifests})`, [c.experiences]);
    await q(`DELETE FROM ${ITEM_AUTHORITY} WHERE manifest_version_id IN (${manifests})`, [c.experiences]);
    await q(`DELETE FROM ${PROVENANCE} WHERE manifest_version_id IN (${manifests})`, [c.experiences]);
    await q(`DELETE FROM ${BODIES} WHERE package_item_id IN
               (SELECT package_item_id FROM ${ITEMS} WHERE manifest_version_id IN (${manifests}))`, [c.experiences]);
    await q(`DELETE FROM ${LIFECYCLE} WHERE experience_id = ANY($1::uuid[])`, [c.experiences]);
    await q(`UPDATE ${EXPERIENCES} SET current_experience_version_id = NULL WHERE id = ANY($1::uuid[])`, [c.experiences]);
    await q(`DELETE FROM ${ITEMS} WHERE manifest_version_id IN (${manifests})`, [c.experiences]);
    await q(`DELETE FROM ${VERSIONS} WHERE experience_id = ANY($1::uuid[])`, [c.experiences]);
    await q(`DELETE FROM ${MANIFESTS} WHERE experience_id = ANY($1::uuid[])`, [c.experiences]);
    await q(`DELETE FROM ${CONTROLLERS} WHERE experience_id = ANY($1::uuid[])`, [c.experiences]);
    await q(`DELETE FROM public.public_experience_draft_commands WHERE experience_id = ANY($1::uuid[])`, [c.experiences]);
    await q(`DELETE FROM ${EXPERIENCES} WHERE id = ANY($1::uuid[])`, [c.experiences]);
    await q('DELETE FROM public.public_identity_commands WHERE actor_user_id = ANY($1::uuid[])', [c.humans]);
    await q(`DELETE FROM ${DISPLAY} WHERE public_identity_ref IN
               (SELECT public_identity_ref FROM ${IDENTITIES} WHERE user_id = ANY($1::uuid[]))`, [c.humans]);
    await q(`DELETE FROM ${IDENTITIES} WHERE user_id = ANY($1::uuid[])`, [c.humans]);
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
    for (const [table, trigger] of IMMUTABLE_RELATIONS) {
      await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
    }
  } finally {
    await q('COMMIT').catch(async () => { await q('ROLLBACK'); });
  }
  // The guards are back, which is the only acceptable end state.
  for (const [table, trigger] of IMMUTABLE_RELATIONS) {
    const [tg] = await rows(
      'SELECT tg.tgenabled FROM pg_trigger tg WHERE tg.tgrelid = $1::regclass AND tg.tgname = $2 AND NOT tg.tgisinternal',
      [table, trigger]);
    assert.ok(tg && tg.tgenabled === 'O', `${trigger} is enabled again after fixture teardown`);
  }
}

async function verifyConcurrency(c) {
  const second = new Client({ connectionString: databaseUrl });
  await second.connect();
  const q2 = (text, values = []) => second.query(text, values);
  const actAs2 = async (uid) => {
    await q2('RESET ROLE');
    await q2("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  };
  try {
    // P33 PACKAGE CHANGE VERSUS APPROVAL. One holds the Experience row; the other
    // blocks on it, and whichever order they land in, the result is truthful.
    await asRole('postgres');
    await actAs(c.mohamed);
    const manifestA = randomUUID(); const versionA = randomUUID();
    await prepare(randomUUID(), c.experience, manifestA, versionA, NONE, NONE,
      [randomUUID()], [c.world], [c.hadirMaterial]);

    await q('BEGIN');
    await actAs(c.mohamed);
    const manifestB = randomUUID(); const versionB = randomUUID();
    await prepare(randomUUID(), c.experience, manifestB, versionB, NONE, NONE,
      [randomUUID(), randomUUID()], [c.world, c.world], [c.hadirMaterial, c.mohamedMaterial]);

    await q2('BEGIN');
    await actAs2(c.hadir);
    const blocked = q2('SELECT * FROM public.approve_public_experience_manifest_v1($1, $2)',
      [randomUUID(), manifestA]);
    let settled = false;
    blocked.then(() => { settled = true; }, () => { settled = true; });
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    assert.equal(settled, false, 'P33 the approval blocks on the Experience the preparation holds');
    await q('COMMIT');
    await blocked;
    await q2('COMMIT');
    // The approval landed on manifest A, which is no longer the current package.
    // That is truthful history, and it can never commit: the current version is B.
    await actAs(c.mohamed);
    await rejected(() => commitReady(randomUUID(), c.experience, versionA), ['40001'],
      /PUBLIC_EXPERIENCE_STALE/u);
    const [{ n: carried }] = await rows(`SELECT count(*) n FROM ${APPROVALS} WHERE manifest_version_id = $1`, [manifestB]);
    assert.equal(Number(carried), 0, 'P33 and no approval floated onto the changed package');

    // P34 SOURCE DELETION VERSUS THE READY COMMIT: exactly one truthful winner.
    await actAs(c.mohamed);
    const manifestC = randomUUID(); const versionC = randomUUID();
    await prepare(randomUUID(), c.experience, manifestC, versionC, NONE, NONE,
      [randomUUID()], [c.world], [c.mohamedMaterial]);
    await approve(randomUUID(), manifestC);

    await q2('BEGIN');
    await actAs2(c.mohamed);
    // The owner deletion locks the Shared World and then the material - the frozen
    // I-04G order this slice deliberately never inverts.
    await q2('SELECT * FROM public.delete_shared_world_owned_material_v1($1, $2, $3, $4)',
      [randomUUID(), c.world, c.mohamedMaterial, randomUUID()]);

    await q('BEGIN');
    await actAs(c.mohamed);
    const commitAttempt = q('SELECT * FROM public.commit_public_experience_ready_for_review_v1($1, $2, $3)',
      [randomUUID(), c.experience, versionC]);
    let commitSettled = false;
    commitAttempt.then(() => { commitSettled = true; }, () => { commitSettled = true; });
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    assert.equal(commitSettled, false,
      'P34 the READY commit blocks on the exact source row the deletion holds - no cross-domain deadlock, and no race past it');
    await q2('COMMIT');
    await assert.rejects(commitAttempt, (error) => error.code === 'P0002',
      'P34 the deletion won, so the commit refuses rather than publishing a deleted source');
    await q('ROLLBACK');
    const [{ current_lifecycle: stillDraft }] = await rows(
      `SELECT current_lifecycle FROM ${EXPERIENCES} WHERE id = $1`, [c.experience]);
    assert.equal(stillDraft, 'DRAFT', 'P34 and the Experience stayed exactly where it was');

    // SA07 A SOURCE-VISIBILITY CHANGE RACING WITH PREPARATION has one truthful
    // winner, and no stale hidden-body copy commits. The membership change takes
    // `shared_worlds FOR UPDATE` exactly as every I-04 mutation does; preparation
    // holds the same row FOR SHARE, so the two serialize rather than interleave.
    await q('BEGIN');
    await asRole('postgres');
    await q(`SELECT 1 FROM public.shared_worlds w WHERE w.id = $1 FOR UPDATE`, [c.world]);
    await q(`UPDATE public.shared_world_membership_episodes e SET ended_at = now()
              WHERE e.world_id = $1 AND e.user_id = $2 AND e.ended_at IS NULL`, [c.world, c.mohamed]);

    await q2('BEGIN');
    await actAs2(c.mohamed);
    const racing = q2(`SELECT * FROM public.prepare_public_experience_manifest_v1($1,$2,$3,$4,$5::uuid[],$6::uuid[],$7::uuid[],$8::uuid[],$9::uuid[])`,
      [randomUUID(), c.experience, randomUUID(), randomUUID(), NONE, NONE,
        [randomUUID()], [c.world], [c.hadirMaterial]]);
    let racingSettled = false;
    racing.then(() => { racingSettled = true; }, () => { racingSettled = true; });
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    assert.equal(racingSettled, false,
      'SA07 preparation blocks on the exact Shared World row the membership change holds');
    await q('COMMIT');
    await assert.rejects(racing, (error) => error.code === 'P0002',
      'SA07 the membership change won, so the source is no longer visible and no body is copied');
    await q2('ROLLBACK');
    // Restore the fixture standing for the remaining races.
    await asRole('postgres');
    await q(`UPDATE public.shared_world_membership_episodes e SET ended_at = NULL
              WHERE e.world_id = $1 AND e.user_id = $2`, [c.world, c.mohamed]);

    // P35 AN ALIAS CHANGE CONCURRENT WITH PACKAGE PREPARATION changes neither the
    // package nor its version - and, because the identity primitives take no
    // global lock, it does not even wait for it.
    const countVersions = async () => Number((await q2(
      `SELECT count(*) n FROM ${VERSIONS} WHERE experience_id = $1`, [c.experience])).rows[0].n);
    const versionsBefore = await countVersions();
    await q('BEGIN');
    await actAs(c.mohamed);
    const manifestD = randomUUID(); const versionD = randomUUID();
    await prepare(randomUUID(), c.experience, manifestD, versionD, NONE, NONE,
      [randomUUID()], [c.world], [c.hadirMaterial]);
    await actAs2(c.mohamed);
    const [relabelled] = (await q2('SELECT * FROM public.update_public_display_label_v1($1, $2, $3)',
      [randomUUID(), 'PSEUDONYM', 'renamed during a preparation'])).rows;
    assert.equal(relabelled.outcome, 'UPDATED',
      'P35 an alias change does not wait behind an in-flight package preparation');
    assert.equal(await countVersions(), versionsBefore,
      'P35 and the alias change created no Experience version of its own');
    await q('COMMIT');
    const [manifestRow] = await rows(`SELECT publisher_public_identity_ref FROM ${MANIFESTS} WHERE id = $1`,
      [manifestD]);
    assert.equal(manifestRow.publisher_public_identity_ref, c.mohamedRef,
      'P35 the package bound the stable ref, so the alias change altered no package meaning');
    assert.equal(await countVersions(), versionsBefore + 1,
      'P35 the preparation created exactly one version, and the alias change none');
  } finally {
    await second.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------- forward safety

async function verifyForwardSafety() {
  await q('SAVEPOINT forward_safety');
  try {
    await q(`CREATE TABLE public.i05a93_probe_semantic_placement (
               experience_version_id uuid PRIMARY KEY REFERENCES ${VERSIONS} (id), placement_ref text NOT NULL)`);
    await q(`CREATE TABLE public.i05a93_probe_public_discussion (
               id uuid PRIMARY KEY, experience_id uuid NOT NULL REFERENCES ${EXPERIENCES} (id))`);
    await q('CREATE TABLE public.i05a93_probe_public_qandeel (id uuid PRIMARY KEY, thread_id uuid NOT NULL)');
    await q('CREATE TABLE public.i05a93_probe_vitality (experience_id uuid PRIMARY KEY, heat integer NOT NULL)');
    await q('CREATE TABLE public.i05a93_probe_search_projection (experience_id uuid PRIMARY KEY, lens text NOT NULL)');
    await q('CREATE TABLE public.i05a93_probe_replay_source (package_item_id uuid PRIMARY KEY, replay_id uuid NOT NULL)');
    await q('CREATE TABLE public.i05a93_probe_launch_gate (id uuid PRIMARY KEY, capability text NOT NULL)');
    // FIX-C. Final publication must be able to reject an approval withdrawn
    // before publish, so the later reviewed effective-state and withdrawal
    // objects I-05B composes must not be regressions against anything I-05A
    // froze. The historical approval row stays untouched evidence beside them.
    await q(`CREATE TABLE public.i05a93_probe_approval_effective_state (
               approval_id uuid PRIMARY KEY REFERENCES ${APPROVALS} (id),
               effective_state text NOT NULL
                 CHECK (effective_state IN ('EFFECTIVE', 'WITHDRAWN', 'SUPERSEDED')))`);
    await q(`CREATE TABLE public.i05a93_probe_approval_withdrawal_events (
               id uuid PRIMARY KEY, approval_id uuid NOT NULL REFERENCES ${APPROVALS} (id),
               occurred_at timestamptz NOT NULL)`);
    await q(`CREATE FUNCTION public.i05a93_probe_withdraw_approval_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.i05a93_probe_approval_effective_state s
                      SET effective_state = 'WITHDRAWN' WHERE s.approval_id = p_id; END$fn$`);
    await q(`CREATE FUNCTION public.i05a93_probe_publish_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
             BEGIN UPDATE public.public_experiences e
                      SET current_lifecycle = 'PUBLISHED' WHERE e.id = p_id; END$fn$`);
    await q(`CREATE FUNCTION public.i05a93_probe_owner_deletion_v1(p_id uuid) RETURNS void
             LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN NULL; END$fn$`);
    await q('GRANT EXECUTE ON FUNCTION public.i05a93_probe_publish_v1(uuid) TO service_role');
    await q(`CREATE INDEX i05a93_probe_command_idx ON public.publication_package_prepare_commands (experience_id)`);
    await q(`CREATE FUNCTION public.i05a93_probe_audit_v1() RETURNS trigger
             LANGUAGE plpgsql AS $fn$ BEGIN RETURN NEW; END$fn$`);
    await q(`CREATE TRIGGER i05a93_probe_audit AFTER INSERT ON public.publication_package_prepare_commands
             FOR EACH ROW EXECUTE FUNCTION public.i05a93_probe_audit_v1()`);
    await q(`ALTER TABLE public.publication_package_prepare_commands ADD COLUMN i05a93_probe_note text`);

    await verifyCatalog();

    const refuses = { name: 'AssertionError' };
    await q('SAVEPOINT r1');
    await q(`GRANT EXECUTE ON FUNCTION public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[]) TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses,
      'a consequential primitive becoming reachable before the Launch Gate is a regression');
    await q('ROLLBACK TO SAVEPOINT r1');

    await q('SAVEPOINT r2');
    await q(`GRANT EXECUTE ON FUNCTION ${RESOLVER} TO authenticated`);
    await assert.rejects(verifyCatalog(), refuses, 'the review resolver opening to authenticated is a regression');
    await q('ROLLBACK TO SAVEPOINT r2');

    await q('SAVEPOINT r3');
    await q(`REVOKE EXECUTE ON FUNCTION ${RESOLVER} FROM service_role`);
    await assert.rejects(verifyCatalog(), refuses, 'the ONE review boundary becoming unreachable is a regression');
    await q('ROLLBACK TO SAVEPOINT r3');

    await q('SAVEPOINT r4');
    await q('ALTER TABLE public.publication_package_prepare_commands DISABLE ROW LEVEL SECURITY');
    await assert.rejects(verifyCatalog(), refuses, 'a command relation losing RLS is a regression');
    await q('ROLLBACK TO SAVEPOINT r4');

    await q('SAVEPOINT r5');
    // CREATE OR REPLACE cannot change a function's RESULT ROW TYPE - PostgreSQL
    // answers 42P13 at the DDL - so replacing the resolver in place never installed
    // the mutant and the assertion below was never evaluated. A DDL that fails is
    // NOT an anti-vacuity proof: the mutant has to install and then be refused.
    // Drop and recreate inside this savepoint instead, which the rollback undoes.
    await q(`DROP FUNCTION ${RESOLVER}`);
    await q(`CREATE FUNCTION public.resolve_public_experience_review_v1(p_experience_id uuid, p_user_id uuid)
             RETURNS TABLE(experience_id uuid, current_lifecycle text, experience_version_id uuid,
                           version_ordinal integer, manifest_version_id uuid, publisher_public_identity_ref uuid,
                           publisher_label_mode text, publisher_display_label text, publisher_user_id uuid,
                           package_item_id uuid, item_ordinal integer, derivative_classification text,
                           public_body_form text, public_text_body text, required_approver_count integer,
                           satisfied_approval_count integer, approvals_complete boolean)
             LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $fn$ BEGIN RETURN; END$fn$`);
    // A freshly created function carries EXECUTE for PUBLIC by default. Left alone,
    // the ACL assertion would fire first and this probe would "pass" while proving
    // something else entirely, so the mutant is restored to the exact posture the
    // real resolver has: every property legitimate, and ONE forbidden output column.
    await q(`REVOKE ALL ON FUNCTION ${RESOLVER} FROM PUBLIC`);
    await q(`GRANT EXECUTE ON FUNCTION ${RESOLVER} TO service_role`);
    await assert.rejects(verifyCatalog(),
      { name: 'AssertionError', message: /P05 the review resolver must not return publisher_user_id/u },
      'the review resolver disclosing the account behind a public identity is a regression');
    await q('ROLLBACK TO SAVEPOINT r5');

    await q('SAVEPOINT r6');
    await q(`CREATE OR REPLACE FUNCTION public.commit_public_experience_ready_for_review_v1(
               p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid)
             RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid,
                           manifest_version_id uuid, current_lifecycle text, satisfied_approval_count integer,
                           authority_request_fingerprint text, committed_at timestamptz)
             LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $fn$
             BEGIN UPDATE public.public_experiences e SET current_lifecycle = 'PUBLISHED' WHERE e.id = p_experience_id;
                   RETURN; END$fn$`);
    await assert.rejects(verifyCatalog(), refuses,
      'P29 an I-05A primitive gaining a PUBLISHED transition is a regression');
    await q('ROLLBACK TO SAVEPOINT r6');

    await q('SAVEPOINT r7');
    await q('ALTER TABLE public.conversation_units DISABLE TRIGGER conversation_units_immutable');
    await assert.rejects(verifyCatalog(), refuses,
      'the frozen committed Personal source losing its append-only guard is a regression');
    await q('ROLLBACK TO SAVEPOINT r7');

    await q('SAVEPOINT r8');
    await q('ALTER TABLE public.shared_world_history_package_manifest_items DISABLE TRIGGER shared_world_material_historical_widening_gate');
    await assert.rejects(verifyCatalog(), refuses,
      'the frozen I-04G historical widening gate being disabled is a regression');
    await q('ROLLBACK TO SAVEPOINT r8');
  } finally {
    await q('ROLLBACK TO SAVEPOINT forward_safety');
    await q('RELEASE SAVEPOINT forward_safety');
  }
}

// -------------------------------------------------------------------- fixtures

/**
 * The predecessor state I-05A consumes, written directly as the migration owner.
 * Each predecessor's OWN verifier proves its producer; what this one needs is the
 * exact shape those producers leave behind.
 */
async function provision(f) {
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [[f.mohamed, f.hadir, f.stranger]]);

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

  await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at)
           VALUES ($1, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', now())`, [f.world]);
  // Mohamed stays; Hadir's episode is CLOSED, so every approval she gives below is
  // a FORMER member exercising surviving material authority.
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
           VALUES ($1, $2, $3, now(), NULL)`, [randomUUID(), f.world, f.mohamed]);
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
           VALUES ($1, $2, $3, now(), now())`, [randomUUID(), f.world, f.hadir]);

  await provisionMaterials(f, f.world);
}

/**
 * One committed Shared material, in the exact shape I-04G leaves behind. The
 * required approvers are passed explicitly rather than derived from the author,
 * because QANDEEL material has NO author and still carries an exact approver set.
 */
async function commitMaterial(world, id, kind, author, text, mode, resolution, approvers, baselineViewer) {
  const historyItem = randomUUID();
  await q(`INSERT INTO public.shared_world_history_items
             (id, world_id, occurred_at, authority_requirement_mode, availability_state,
              availability_revision, registered_at)
           VALUES ($1, $2, clock_timestamp(), $3, 'AVAILABLE', 1, clock_timestamp())`,
  [historyItem, world, mode]);
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
  // FIX-A fixture. Mohamed's baseline visibility is what the canonical I-04F
  // resolver reads, so a material whose ONLY baseline viewer is Hadir is
  // material Mohamed genuinely may not see - the SA02 case - while everything
  // else below is material he was actually present for.
  if (f.hiddenMaterial) {
    await commitMaterial(world, f.hiddenMaterial, 'HUMAN_TEXT', f.hadir, 'a sentence Mohamed never saw',
      EXACT, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.hadir);
  }
  await commitMaterial(world, f.mohamedMaterial, 'HUMAN_TEXT', f.mohamed, 'a sentence Mohamed wrote',
    EXACT, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.mohamed], f.mohamed);
  await commitMaterial(world, f.hadirMaterial, 'HUMAN_TEXT', f.hadir, 'a sentence Hadir wrote',
    EXACT, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
  // QANDEEL analysis whose ADDITIONAL protected-human requirement is unresolved.
  // Its exact-approver metadata is self-consistent on purpose, so the refusal
  // below is unambiguously about the RESOLUTION and not about missing rows.
  await commitMaterial(world, f.unresolvedMaterial, 'QANDEEL_ANALYSIS', null, 'analysis over protected human material',
    EXACT, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT', [f.mohamed], f.mohamed);
  await commitMaterial(world, f.noHumanMaterial, 'QANDEEL_OUTPUT', null, 'output with no protected human subject',
    'NO_HUMAN_APPROVAL_REQUIRED', 'RESOLVED_NO_HUMAN_REQUIREMENT', [], f.mohamed);
  await commitMaterial(world, f.voiceMaterial, 'HUMAN_VOICE_NOTE', f.hadir, null,
    EXACT, 'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.hadir], f.mohamed);
  // Material with NO source-side authority metadata at all: missing never means empty.
  await commitMaterial(world, f.metadatalessMaterial, 'QANDEEL_ANALYSIS', null, 'analysis with no recorded resolution',
    EXACT, null, [f.mohamed], f.mohamed);
}

/**
 * A CLOSED Shared World carrying the exact frozen I-04F/0088 closed-view
 * entitlement, so SA06 asks the canonical resolver's closed branch a real
 * question: one entitled item and one outside the entitlement.
 */
async function provisionClosedWorld(f) {
  const episode = randomUUID();
  await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at, closed_at)
           VALUES ($1, 'READ_ONLY_CLOSED', 'STANDARD', 'ACCEPTED_INVITATION', now(), now())`, [f.closedWorld]);
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
           VALUES ($1, $2, $3, now(), now())`, [episode, f.closedWorld, f.mohamed]);
  const entitled = await commitMaterial(f.closedWorld, f.closedEntitledMaterial, 'HUMAN_TEXT', f.mohamed,
    'a sentence inside the closed entitlement', 'EXACT_HUMAN_APPROVER_SET',
    'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.mohamed], f.mohamed);
  await commitMaterial(f.closedWorld, f.closedOutsideMaterial, 'HUMAN_TEXT', f.mohamed,
    'a sentence outside the closed entitlement', 'EXACT_HUMAN_APPROVER_SET',
    'RESOLVED_EXACT_HUMAN_REQUIREMENT', [f.mohamed], f.mohamed);
  await q(`INSERT INTO public.shared_world_standard_closed_view_entitlements
             (world_id, user_id, membership_episode_id, entitled_at) VALUES ($1, $2, $3, now())`,
  [f.closedWorld, f.mohamed, episode]);
  // The entitlement is BOUNDED: exactly one of the two items is inside it.
  await q(`INSERT INTO public.shared_world_standard_closed_view_entitlement_items
             (world_id, user_id, history_item_id) VALUES ($1, $2, $3)`,
  [f.closedWorld, f.mohamed, entitled]);
}

// ------------------------------------------------- FIX-A source-access authority

async function verifySourceAccessAuthority(f) {
  // SA01 a currently authorized Shared viewer prepares a visible item.
  await actAs(f.mohamed);
  const sa01 = randomUUID();
  const [prepared] = await prepare(randomUUID(), f.experience, sa01, randomUUID(), NONE, NONE,
    [randomUUID()], [f.world], [f.hadirMaterial]);
  assert.equal(prepared.outcome, 'PACKAGE_PREPARED',
    'SA01 a human who may currently see the item may prepare it');

  // SA02 a CURRENT member whose selected item is outside their authorized history
  // visibility is denied. Mohamed has an open episode and full standing in this
  // World - he simply was never in this item's baseline audience.
  const visible = await rows(
    'SELECT history_item_id FROM public.resolve_shared_world_history_visibility_v1($1, $2)', [f.world, f.mohamed]);
  const hiddenItem = (await rows('SELECT history_item_id FROM public.shared_world_materials WHERE id = $1',
    [f.hiddenMaterial]))[0].history_item_id;
  assert.ok(!visible.some((r) => r.history_item_id === hiddenItem),
    'SA02 fixture: the canonical resolver really does hide this item from Mohamed');
  assert.ok(visible.length > 0, 'SA02 fixture: and Mohamed is otherwise a fully entitled viewer');
  const denial = await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    NONE, NONE, [randomUUID()], [f.world], [f.hiddenMaterial]), ['P0002'],
  /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);

  // SA08 the denial is INDISTINGUISHABLE from a source that does not exist: a
  // caller learns nothing about whether the identifier they guessed is real.
  const absent = await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(),
    NONE, NONE, [randomUUID()], [f.world], [randomUUID()]), ['P0002'],
  /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);
  assert.equal(denial.message, absent.message,
    'SA08 a hidden Shared source and a nonexistent one produce the identical bounded error');
  assert.equal(denial.code, absent.code);

  // SA03 an UNRELATED Public controller holding exact valid Shared identifiers is
  // denied, and nothing partial is left behind.
  await actAs(f.stranger);
  await ensureIdentity(randomUUID(), f.strangerRef, 'PSEUDONYM', 'a stranger');
  await createDraft(randomUUID(), f.strangerExperience);
  const forgedManifest = randomUUID(); const forgedVersion = randomUUID(); const forgedItem = randomUUID();
  await rejected(() => prepare(randomUUID(), f.strangerExperience, forgedManifest, forgedVersion,
    NONE, NONE, [forgedItem], [f.world], [f.mohamedMaterial]), ['P0002'],
  /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);
  const [{ n: residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${MANIFESTS} WHERE id = $1)
          + (SELECT count(*) FROM ${ITEMS} WHERE package_item_id = $2)
          + (SELECT count(*) FROM ${BODIES} WHERE package_item_id = $2)
          + (SELECT count(*) FROM ${PROVENANCE} WHERE package_item_id = $2)
          + (SELECT count(*) FROM ${VERSIONS} WHERE id = $3) AS n`,
    [forgedManifest, forgedItem, forgedVersion]);
  assert.equal(Number(residue), 0,
    'SA03 no manifest, item, derivative body, provenance row or version survives the refusal');

  // SA04 a FORMER member with surviving material authority but no current
  // source-view entitlement cannot use preparation as a browsing backdoor.
  await actAs(f.hadir);
  await createDraft(randomUUID(), f.hadirExperience);
  const hadirVisible = await rows(
    'SELECT history_item_id FROM public.resolve_shared_world_history_visibility_v1($1, $2)', [f.world, f.hadir]);
  assert.equal(hadirVisible.length, 0,
    'SA04 fixture: a closed episode leaves the canonical resolver with nothing to show');
  await rejected(() => prepare(randomUUID(), f.hadirExperience, randomUUID(), randomUUID(),
    NONE, NONE, [randomUUID()], [f.world], [f.hadirMaterial]), ['P0002'],
  /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u,);
  // ...not even for material whose publication authority is HERS.
  const [{ approver }] = await rows(
    `SELECT ra.approver_user_id approver FROM public.shared_world_history_item_required_approvers ra
      JOIN public.shared_world_materials m ON m.history_item_id = ra.history_item_id WHERE m.id = $1`,
    [f.hadirMaterial]);
  assert.equal(approver, f.hadir,
    'SA04 / SA05 the same human still holds the material authority the refusal did not touch');

  // SA06 a CLOSED-World viewer may prepare only what their exact frozen
  // entitlement contains - and the canonical resolver is what decides that.
  await actAs(f.mohamed);
  const closedVisible = await rows(
    'SELECT history_item_id FROM public.resolve_shared_world_history_visibility_v1($1, $2)',
    [f.closedWorld, f.mohamed]);
  assert.equal(closedVisible.length, 1, 'SA06 fixture: the closed entitlement is bounded to one item');
  const [inside] = await prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID()], [f.closedWorld], [f.closedEntitledMaterial]);
  assert.equal(inside.outcome, 'PACKAGE_PREPARED',
    'SA06 an item inside the closed entitlement may be prepared');
  await rejected(() => prepare(randomUUID(), f.experience, randomUUID(), randomUUID(), NONE, NONE,
    [randomUUID()], [f.closedWorld], [f.closedOutsideMaterial]), ['P0002'],
  /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u);

  // AB01 / AB02 preparing widened no audience, and the package binds the FUTURE
  // protected action rather than the command that just ran.
  const [manifestRow] = await rows(
    `SELECT intended_publication_action, target_audience_class, authority_readiness FROM ${MANIFESTS} WHERE id = $1`,
    [sa01]);
  assert.equal(manifestRow.intended_publication_action, 'PUBLISH_TO_PUBLIC_WORLD',
    'AB02 the manifest binds the protected audience-expansion action');
  assert.equal(manifestRow.authority_readiness, 'PRIVACY_OWNERSHIP_AUTHORITY_ONLY',
    'and asserts no Safety, Launch or entitlement clearance');
  const [command] = await rows(
    'SELECT command_action, request_ref FROM public.publication_package_prepare_commands WHERE manifest_version_id = $1',
    [sa01]);
  assert.equal(command.command_action, 'PREPARE_PUBLICATION',
    'AB04 while the command that ran stays in its own namespace');
  const [{ fingerprint }] = await rows(
    'SELECT authority_fingerprint fingerprint FROM public.derive_public_publication_authority_v1($1)', [sa01]);
  assert.notEqual(command.request_ref, fingerprint,
    'AB04 a preparation request reference is not the publication authority identity');
  // AB03 changing only the intended action changes the authority identity.
  const [{ same, altered }] = await rows(
    `SELECT encode(sha256(convert_to('action=' || $1, 'UTF8')), 'hex') same,
            encode(sha256(convert_to('action=' || $2, 'UTF8')), 'hex') altered`,
    ['PUBLISH_TO_PUBLIC_WORLD', 'PREPARE_PUBLICATION']);
  assert.notEqual(same, altered,
    'AB03 the action is inside the hashed identity, so a different action is a different authority request');
  // And the manifest cannot be made to intend the command instead.
  await rejected(() => q(`UPDATE ${MANIFESTS} SET intended_publication_action = 'PREPARE_PUBLICATION' WHERE id = $1`,
    [sa01]), ['55000'], /PUBLICATION_PACKAGE_IS_IMMUTABLE/u);
}

// --------------------------------------------------------------------------

async function main() {
  try {
    await client.connect();
    stage = 'catalog';
    await asRole('postgres');
    await verifyCatalog();

    const f = {
      mohamed: randomUUID(), hadir: randomUUID(), stranger: randomUUID(),
      mohamedRef: randomUUID(), hadirRef: randomUUID(),
      session: randomUUID(), turn: randomUUID(), batch: randomUUID(),
      userUnit: randomUUID(), assistantUnit: randomUUID(),
      userText: 'the exact committed human sentence', assistantText: 'the analysis QANDEEL produced',
      world: randomUUID(), mohamedMaterial: randomUUID(), hadirMaterial: randomUUID(),
      unresolvedMaterial: randomUUID(), noHumanMaterial: randomUUID(), voiceMaterial: randomUUID(),
      metadatalessMaterial: randomUUID(), hiddenMaterial: randomUUID(),
      closedWorld: randomUUID(), closedEntitledMaterial: randomUUID(), closedOutsideMaterial: randomUUID(),
      strangerRef: randomUUID(), strangerExperience: randomUUID(), hadirExperience: randomUUID(),
      experience: randomUUID(), draftCommand: randomUUID(), prepareCommand: randomUUID(),
      readyCommand: randomUUID(), approval: randomUUID(),
      manifest: randomUUID(), version: randomUUID(), personalItem: randomUUID(),
    };

    // EVERYTHING below runs inside ONE transaction that is rolled back. It is not
    // convenience: `conversation_units`, every Experience Version, every committed
    // lifecycle transition and every package relation is append-only for EVERY
    // role, the table owner included - so a committed fixture here could never be
    // removed afterwards, and a verifier that cannot clean up is a verifier that
    // pollutes the database it verifies.
    await q('BEGIN');
    try {
      stage = 'fixtures';
      await provision(f);
      stage = 'identity and Experience';
      await verifyIdentityAndExperience(f);
      stage = 'Personal source';
      await verifyPersonalSource(f);
      stage = 'source-access authority';
      await provisionClosedWorld(f);
      await verifySourceAccessAuthority(f);
      stage = 'Shared source and authority';
      const prepared = await verifySharedAuthority(f);
      stage = 'approval and READY commit';
      await verifyApprovalAndCommit(f, prepared);
      stage = 'staleness and revalidation';
      await verifyStaleness(f);
      stage = 'forward safety';
      await asRole('postgres');
      await verifyForwardSafety();
    } finally {
      await q('ROLLBACK');
    }

    // A race needs two connections seeing each other's COMMITTED work, so this
    // section - and only this section - uses committed fixtures. It deliberately
    // uses no Personal source: `conversation_units` is append-only for every role
    // and a committed unit could never be removed afterwards.
    stage = 'concurrency';
    const c = {
      mohamed: randomUUID(), hadir: randomUUID(), mohamedRef: randomUUID(),
      world: randomUUID(), mohamedMaterial: randomUUID(), hadirMaterial: randomUUID(),
      unresolvedMaterial: randomUUID(), noHumanMaterial: randomUUID(),
      voiceMaterial: randomUUID(), metadatalessMaterial: randomUUID(),
      experience: randomUUID(),
    };
    c.humans = [c.mohamed, c.hadir];
    c.experiences = [c.experience];
    try {
      await asRole('postgres');
      await q('BEGIN');
      try {
        await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [c.humans]);
        await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at)
                 VALUES ($1, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', now())`, [c.world]);
        await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
                 VALUES ($1, $2, $3, now(), NULL)`, [randomUUID(), c.world, c.mohamed]);
        await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
                 VALUES ($1, $2, $3, now(), now())`, [randomUUID(), c.world, c.hadir]);
        await provisionMaterials(c, c.world);
        await actAs(c.mohamed);
        await ensureIdentity(randomUUID(), c.mohamedRef, 'PSEUDONYM', 'concurrency publisher');
        await createDraft(randomUUID(), c.experience);
        await asRole('postgres');
      } finally {
        await q('COMMIT');
      }
      await verifyConcurrency(c);
    } finally {
      stage = 'concurrency: fixture removal';
      await removeConcurrencyFixtures(c);
    }

    stage = 'fixture residue';
    await asRole('postgres');
    const humans = [f.mohamed, f.hadir, f.stranger, c.mohamed, c.hadir];
    const [{ n }] = await rows(
      `SELECT (SELECT count(*) FROM ${IDENTITIES} WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${MANIFESTS} WHERE publisher_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${APPROVALS} WHERE approver_user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM ${EXPERIENCES} WHERE id = ANY($4::uuid[]))
            + (SELECT count(*) FROM public.conversation_units WHERE user_id = ANY($1::uuid[]))
            + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY(ARRAY[$2::uuid, $3::uuid, $5::uuid]))
            + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
            + (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[])) AS n`,
      [humans, f.world, c.world, [f.experience, c.experience, f.strangerExperience, f.hadirExperience],
        f.closedWorld]);
    assert.equal(Number(n), 0, 'every fixture this verifier created was rolled back or removed');
    const [{ worlds }] = await rows('SELECT count(*) worlds FROM public.public_world_state');
    assert.equal(Number(worlds), 1, 'and exactly one logical Public World still exists');

    console.log('migration 0093 verified: publication authority derived from included material, and nothing public served');
  } catch (error) {
    console.error(`migration 0093 verification failed at stage: ${stage}`);
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
