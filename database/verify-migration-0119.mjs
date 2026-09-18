// Real-PostgreSQL verifier for migration 0119 - QAN-CW-REM-01, Shared
// historical authority resolution.
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows, that a QANDEEL Shared material whose protected-human requirement was
// never established is no longer recorded as a PROVEN EMPTY requirement, that
// already-committed material carrying that unproven clearance is reconciled
// forward, and that every audience-widening consumer now fails closed on it -
// while ordinary baseline participation is untouched in both frozen World modes.
//
//   P01 posture: the four replaced functions keep their exact signatures, owners,
//       security posture and ACLs; no application role reaches any of them; the
//       reconciliation function is postgres-only, fail-closed-direction-only and
//       writes exactly one relation; the frozen preparation-time widening gate is
//       still installed
//
//   ASSURE-F02, through the REAL frozen commit boundaries
//     A01 a zero-dependency Standard QANDEEL output commits to its baseline audience
//     A02 and still persists INDEPENDENT_TARGET_TRUTH provenance
//     A03 and records UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT
//     A04 and never RESOLVED_NO_HUMAN_REQUIREMENT - it is the exact durable shape
//         the reasoning-only case already had
//     A17 reasoning-only QANDEEL material is still UNRESOLVED
//     A18 exact material-owner propagation is non-regressed
//     A19 human Shared material authority is unchanged
//     A21 a derivative of a zero-dependency output cannot launder it back to proven-empty
//
//   A05 a zero-dependency Introduction QANDEEL output commits to the exact
//       two-human baseline audience
//   A06 and records UNRESOLVED authority
//   A07 and both matched humans retain normal visibility of it
//   A20 the Introduction EXPLICIT_DISCLOSURE producer and both human kinds are unchanged
//
//   A08 an unresolved zero-dependency item cannot enter a NEW history package
//   A09 and therefore cannot produce a NEW history grant
//   A10 a stale PRE-remediation prepared manifest cannot commit a POST-remediation grant
//   A11 baseline visibility survives unresolved authority
//   A12 grant-only widened visibility does NOT survive it
//   A13 a READ_ONLY_CLOSED / STANDARD snapshot does not preserve the invalid widening,
//       and the Introduction closed snapshot structurally cannot carry one
//
//   A14 an unresolved zero-dependency Shared source cannot enter a NEW Public package
//   A15 the current Public authority derivation does not reinterpret it as zero approvers
//   A16 continuing Public eligibility fails closed for an already-published one
//
//   R01 the reconciliation moves a PRE-remediation row, exactly as production wrote it
//   R02 it is idempotent
//   R03 it moves nothing else
//   R04 it rewrites no source history
//
//   ASSURE-F04, on real PostgreSQL with barrier-pinned interleaving
//     C01 the exact claimed cycle is reconstructed from the live function bodies
//     C02 both transactions provably reach their intended blocking rows
//     C03 the wait state is observed through PostgreSQL's own lock/activity view
//     C04 REPRODUCED or REFUTED, from pg_stat_database deadlock accounting
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createIntroductionRuntime, D, DFN, PFN, evidenceFor, runVerifier, APP_ROLES,
} from './introduction-lifecycle-verifier-support.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, actAs, rejected } = rt;

const UNAVAILABLE = ['P0002'];
const INCOMPLETE = ['55000'];
const CONTRADICTORY = ['P0001'];

const QANDEEL_SIG = 'public.commit_shared_world_qandeel_material_v1(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[])';
const GRANT_SIG = 'public.commit_shared_world_history_access_grant_v1(uuid, uuid, uuid, uuid)';
const ENTRY_SIG = 'public.resolve_shared_world_history_visibility_v1(uuid, uuid)';
const CLOSED_SIG = 'public.resolve_shared_world_closed_history_visibility_v1(uuid, uuid)';
const RECONCILE_SIG = 'public.reconcile_shared_world_material_historical_authority_v1()';
const DELETE_SIG = 'public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid)';
const PREPARE_PUBLIC_SIG = 'public.prepare_public_experience_manifest_v1(uuid, uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], uuid[])';
const PREPARE_HISTORY_SIG = 'public.prepare_shared_world_history_package_v1(uuid, uuid, uuid, uuid[])';
const PUBLIC_SEAM = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)';

const AUTHORITY = 'public.shared_world_material_historical_authority';
const DEPENDENCIES = 'public.shared_world_material_dependencies';
const MANIFESTS = 'public.shared_world_history_package_manifest_versions';
const MANIFEST_ITEMS = 'public.shared_world_history_package_manifest_items';
const GRANTS = 'public.shared_world_history_access_grants';
const STANDARD_ENTITLEMENTS = 'public.shared_world_standard_closed_view_entitlements';
const STANDARD_ENTITLEMENT_ITEMS = 'public.shared_world_standard_closed_view_entitlement_items';

// ---- the frozen boundaries this verifier drives, as named wrappers
const preparePackage = (manifest, world, grantee, items) => rows(
  `SELECT outcome, prepared_manifest_version_id, prepared_required_approver_count
     FROM public.prepare_shared_world_history_package_v1($1,$2,$3,$4)`, [manifest, world, grantee, items]);
const approvePackage = (approval, manifest) => rows(
  'SELECT outcome, committed_approval_id FROM public.commit_shared_world_history_package_approval_v1($1,$2)',
  [approval, manifest]);
const commitGrant = (command, manifest, grant, event) => rows(
  `SELECT outcome, history_command_id, committed_grant_id
     FROM public.commit_shared_world_history_access_grant_v1($1,$2,$3,$4)`, [command, manifest, grant, event]);
const reconcile = () => rows(
  'SELECT reconciled_material_count, remaining_unproven_count, remaining_laundered_count'
  + ' FROM public.reconcile_shared_world_material_historical_authority_v1()');
const ensureIdentity = (command, ref, mode, label) => rows(
  'SELECT * FROM public.ensure_public_identity_v1($1,$2,$3,$4)', [command, ref, mode, label]);
const createDraft = (command, experience) => rows(
  'SELECT * FROM public.create_public_experience_draft_v1($1,$2)', [command, experience]);
const preparePublic = (command, experience, manifest, version, sharedItems, sharedWorlds, sharedMaterials) => rows(
  `SELECT * FROM public.prepare_public_experience_manifest_v1($1,$2,$3,$4,
     ARRAY[]::uuid[], ARRAY[]::uuid[], $5::uuid[], $6::uuid[], $7::uuid[])`,
  [command, experience, manifest, version, sharedItems, sharedWorlds, sharedMaterials]);
const approvePublic = (approval, manifest) => rows(
  'SELECT * FROM public.approve_public_experience_manifest_v1($1,$2)', [approval, manifest]);
const commitReady = (command, experience, version) => rows(
  'SELECT * FROM public.commit_public_experience_ready_for_review_v1($1,$2,$3)', [command, experience, version]);
const publish = (command, experience, version) => rows(
  'SELECT * FROM public.publish_public_experience_v1($1,$2,$3)', [command, experience, version]);
const deriveAuthority = (manifest) => rows(
  'SELECT * FROM public.derive_public_publication_authority_v1($1)', [manifest]);
const continuingEligibility = (experience) => rows(
  'SELECT * FROM public.derive_public_continuing_eligibility_v1($1)', [experience]);

/** Strips `--` comment lines, so a positional assertion cannot be satisfied by prose. */
const stripComments = (source) => source.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n');
const sourceOf = async (signature) =>
  (await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [signature]))[0].prosrc;

const authorityOf = async (material) =>
  (await rows(`SELECT resolution_state s FROM ${AUTHORITY} WHERE material_id = $1`, [material]))[0]?.s ?? null;
const modeOf = async (item) =>
  (await rows(`SELECT authority_requirement_mode m FROM ${D.ITEMS} WHERE id = $1`, [item]))[0]?.m ?? null;
const dependencyKindsOf = async (material) => (await rows(
  `SELECT dependency_kind k FROM ${DEPENDENCIES} WHERE target_material_id = $1 ORDER BY 1`, [material]))
  .map((row) => row.k);

/**
 * A live ACTIVE / STANDARD World with one open episode per human, written as the
 * database owner. Every material below it is committed through the REAL frozen
 * entry points; only the World and its episodes are seeded, exactly as the
 * frozen I-04F, I-04G and I-05A verifiers seed theirs.
 */
async function seedStandardWorld(humans) {
  const world = randomUUID();
  await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at)
           VALUES ($1,'ACTIVE','STANDARD','ACCEPTED_INVITATION', clock_timestamp())`, [world]);
  const episodes = {};
  for (const human of humans) {
    episodes[human] = randomUUID();
    await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at)
             VALUES ($1,$2,$3, clock_timestamp())`, [episodes[human], world, human]);
  }
  return { world, episodes };
}

/** One human joins an existing World later, with an episode that starts NOW. */
async function joinLater(world, human) {
  const id = randomUUID();
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at)
           VALUES ($1,$2,$3, clock_timestamp())`, [id, world, human]);
  return id;
}

/**
 * ONE Shared material in EXACTLY the shape the PRE-remediation producer wrote for
 * a zero-dependency QANDEEL output: an approval-free history item with no
 * approver row, a QANDEEL material, INDEPENDENT_TARGET_TRUTH provenance and a
 * historical authority of RESOLVED_NO_HUMAN_REQUIREMENT.
 *
 * It is seeded rather than committed because migration 0119 makes that state
 * unreachable from the producer by design: a post-0119 database cannot produce a
 * pre-0119 row through the boundary, and falsifying immutable history to fake one
 * would prove less than reproducing the exact rows the old arm really wrote.
 * Every column here is taken from the 0118 core's own INSERT list.
 */
async function seedPreRemediationMaterial(world, baselineViewers, body) {
  const item = randomUUID();
  const material = randomUUID();
  await q(`INSERT INTO ${D.ITEMS}
             (id, world_id, occurred_at, authority_requirement_mode, availability_state,
              availability_revision, registered_at)
           VALUES ($1,$2, clock_timestamp(), 'NO_HUMAN_APPROVAL_REQUIRED', 'AVAILABLE', 1, clock_timestamp())`,
  [item, world]);
  for (const viewer of baselineViewers) {
    await q(`INSERT INTO ${D.VIEWERS} (history_item_id, user_id) VALUES ($1,$2)`, [item, viewer]);
  }
  await q(`INSERT INTO ${D.MATERIALS}
             (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
           SELECT $1,$2,$3,'QANDEEL_OUTPUT','QANDEEL','TEXT',NULL, i.occurred_at
             FROM ${D.ITEMS} i WHERE i.id = $3`, [material, world, item]);
  await q(`INSERT INTO public.shared_world_text_material_bodies (material_id, body_form, body_text)
           VALUES ($1,'TEXT',$2)`, [material, body]);
  await q(`INSERT INTO ${DEPENDENCIES}
             (id, world_id, dependency_kind, target_material_id, target_established_at)
           SELECT gen_random_uuid(), $2, 'INDEPENDENT_TARGET_TRUTH', $1, m.established_at
             FROM ${D.MATERIALS} m WHERE m.id = $1`, [material, world]);
  await q(`INSERT INTO ${AUTHORITY} (material_id, world_id, history_item_id, resolution_state)
           VALUES ($1,$2,$3,'RESOLVED_NO_HUMAN_REQUIREMENT')`, [material, world, item]);
  return { item, material };
}

// ---------------------------------------------------------------------------
// P01 - posture, from the live catalog.
// ---------------------------------------------------------------------------

async function verifyPosture() {
  await asRole('postgres');

  // THE PRODUCER: same signature, same result shape, same posture, corrected arm.
  const [producer] = await rows(
    `SELECT pr.proowner::regrole::text owner, pr.prosecdef, pr.provolatile, pr.proconfig
       FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [QANDEEL_SIG]);
  assert.ok(producer, 'the QANDEEL commit core still resolves at its exact frozen signature');
  assert.equal(producer.owner, 'postgres');
  assert.equal(producer.prosecdef, true, 'it is still SECURITY DEFINER');
  assert.equal(producer.provolatile, 'v', 'it still mutates and is VOLATILE');
  assert.ok((producer.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'));

  // THE PARAMETER LIST IS SPLIT IN SQL, NOT IN JAVASCRIPT. `proargmodes` is a
  // `"char"[]`, which the driver has no array parser for and hands back as the
  // raw literal `{i,i,...}` - so filtering `proargnames` by index against it in
  // JS would index into a STRING and silently compare the wrong characters.
  const parametersOf = async (signature, mode) => (await rows(
    `SELECT a.name FROM pg_proc pr,
            unnest(pr.proargnames, pr.proargmodes) WITH ORDINALITY AS a(name, mode, n)
      WHERE pr.oid = $1::regprocedure AND a.mode = $2 ORDER BY a.n`, [signature, mode])).map((row) => row.name);
  const inputs = await parametersOf(QANDEEL_SIG, 'i');
  const results = await parametersOf(QANDEEL_SIG, 't');
  // THE INPUT LIST IS PINNED BY NAME AND POSITION, not by a word list. Two
  // frozen parameters are legitimately NAMED for authority and audience because
  // they carry the frozen I-03 revalidation and audience-snapshot EVIDENCE
  // references; only the exact list can tell those apart from a new claim.
  assert.deepEqual(inputs, [
    'p_command_id', 'p_world_id', 'p_material_id', 'p_history_item_id',
    'p_material_kind', 'p_body_text',
    'p_effective_context_ref', 'p_output_digest', 'p_source_disclosure_gate_ref',
    'p_authority_revalidation_ref', 'p_readiness_ref', 'p_audience_snapshot_ref',
    'p_material_source_ids', 'p_reasoning_source_refs',
  ], 'P01 the producer keeps the EXACT frozen input list: no authority claim was added to it');
  assert.equal(results.length, 11, 'P01 and its exact 11 result columns');
  const [{ n: overloads }] = await rows(
    `SELECT count(*) n FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.proname = 'commit_shared_world_qandeel_material_v1'`);
  assert.equal(Number(overloads), 1, 'P01 the producer is still ONE function: no overload was created beside it');

  // THE CORRECTION ITSELF, read from the real stored body with its prose removed.
  const body = stripComments(await sourceOf(QANDEEL_SIG));
  assert.match(body, /WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u,
    'P01 the reasoning arm is unchanged');
  assert.match(body, /WHEN approvers > 0 THEN 'RESOLVED_EXACT_HUMAN_REQUIREMENT'/u,
    'P01 the known-owner arm is unchanged');
  assert.match(body, /WHEN unresolved_sources > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u,
    'P01 an unresolved MATERIAL_DEPENDENCY source makes an unresolved target');
  assert.ok(body.indexOf('WHEN unresolved_sources > 0') < body.indexOf('WHEN approvers > 0'),
    'P01 and it is evaluated BEFORE the known-owner arm: known owners must not answer an unknown requirement');
  assert.match(body, /ELSE 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' END;/u,
    'P01 and the corrected arm records unknown as unknown');
  assert.match(body, /INTO unresolved_sources/u,
    'P01 source authority is derived from the canonical relation rather than from approver rows alone');
  assert.doesNotMatch(body, /authority_resolution := CASE[^;]*RESOLVED_NO_HUMAN_REQUIREMENT/u,
    'P01 no arm of the resolution can reach the proven-empty clearance');
  assert.match(body, /authority_mode := CASE WHEN authority_resolution = 'RESOLVED_NO_HUMAN_REQUIREMENT'/u,
    'P01 approval-free is still derived ONLY from a genuinely resolved empty requirement');
  assert.match(body, /'INDEPENDENT_TARGET_TRUTH'/u, 'P01 provenance is untouched and still written');
  assert.doesNotMatch(body, /auth\.uid/u, 'P01 QANDEEL is still a system actor that derives no human');
  assert.match(body, /FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE/u,
    'P01 the World row is still locked FIRST');
  assert.match(body, /ELSIF world\.phase = 'INTRODUCTION' THEN/u,
    'P01 the I-07D Introduction extension survives the correction');
  assert.equal((body.match(/clock_timestamp\(\)/gu) ?? []).length, 1,
    'P01 one database-owned instant, read exactly once');

  // THE CONSUMERS: each reads the CURRENT authority state.
  const grantBody = await sourceOf(GRANT_SIG);
  assert.match(grantBody, /public\.shared_world_material_historical_authority/u,
    'P01 the grant boundary revalidates current authority at the instant it widens');
  assert.match(grantBody, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u,
    'P01 with the SAME bounded class the frozen preparation gate raises: one model, asked twice');
  assert.doesNotMatch(grantBody, /auth\.uid/u, 'P01 a history grant still has no granting actor');

  const entry = (await rows(
    'SELECT pr.prosrc, pr.provolatile FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [ENTRY_SIG]))[0];
  assert.equal(entry.provolatile, 's', 'P01 the ONE entry point is still STABLE');
  assert.match(entry.prosrc, /public\.shared_world_material_historical_authority/u,
    'P01 the widened basis consumes current authority state');
  assert.match(entry.prosrc, /i\.occurred_at >= e\.joined_at/u,
    'P01 the membership-period basis keeps its exact frozen temporal bounds');
  assert.equal((entry.prosrc.match(/shared_world_history_package_manifest_items/gu) ?? []).length, 1,
    'P01 the grant basis is still STANDARD-only: it appears exactly once');

  const closed = (await rows(
    'SELECT pr.prosrc, pr.provolatile FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [CLOSED_SIG]))[0];
  assert.equal(closed.provolatile, 's', 'P01 the closed reader is still STABLE');
  assert.doesNotMatch(closed.prosrc, /shared_world_membership_episodes/u,
    'P01 closed viewing is still entitlement, never membership');
  assert.match(closed.prosrc, /shared_world_standard_closed_view_entitlement_items/u);
  assert.match(closed.prosrc, /introduction_closed_view_entitlement_items/u,
    'P01 both frozen closed branches survive');
  assert.match(closed.prosrc, /public\.shared_world_material_historical_authority/u,
    'P01 and a closure snapshot no longer preserves a widening whose authority is unresolved');

  // THE FROZEN PREPARATION-TIME GATE IS STILL THERE. This migration adds a second
  // ASK, never a second MODEL.
  const [{ n: gate }] = await rows(
    `SELECT count(*) n FROM pg_trigger t
      WHERE t.tgrelid = 'public.shared_world_history_package_manifest_items'::regclass
        AND NOT t.tgisinternal AND t.tgname = 'shared_world_material_historical_widening_gate'
        AND t.tgenabled <> 'D'`);
  assert.equal(Number(gate), 1, 'P01 the frozen preparation-time widening gate is installed and enabled');

  // THE RECONCILIATION: one relation, one direction, no source history.
  const [recon] = await rows(
    `SELECT pr.proowner::regrole::text owner, pr.prosecdef, pr.prosrc, pr.proconfig
       FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [RECONCILE_SIG]);
  assert.ok(recon, 'the reconciliation function exists');
  assert.equal(recon.owner, 'postgres');
  assert.equal(recon.prosecdef, true);
  assert.ok((recon.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'));
  assert.equal((recon.prosrc.match(/UPDATE public\./gu) ?? []).length, 1,
    'P01 the reconciliation writes exactly one relation');
  assert.doesNotMatch(recon.prosrc, /DELETE FROM|INSERT INTO|TRUNCATE/iu, 'P01 and destroys nothing');
  // Provenance is READ, to walk the closure, and never written - the single
  // `UPDATE public.` asserted above is the whole of what it writes - so the
  // dependency relation is excluded from this ban and given its own below.
  assert.doesNotMatch(recon.prosrc,
    /authority_requirement_mode|shared_world_history_items|_material_bodies|DISABLE TRIGGER|ALTER TABLE/u,
    'P01 it rewrites no source history and disables no frozen guard');
  assert.doesNotMatch(recon.prosrc, /UPDATE public\.shared_world_material_dependencies/u,
    'P01 and never rewrites provenance: a dependency edge is evidence, not a thing a correction edits');
  assert.match(recon.prosrc, /WITH RECURSIVE tainted/u,
    'P01 it reaches the laundering descendants transitively, to a fixed point');
  assert.match(recon.prosrc, /a\.resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT'/u,
    'P01 and it can only ever move the unproven clearance forward');

  // THE ONE FUNCTION THAT MAY MOVE A HISTORICAL AUTHORITY RESOLUTION IS THIS
  // ONE. The CENSUS is deliberately left to the migration's own deploy-time
  // assertion, which runs against a clean database: a global pg_proc ceiling
  // asserted from a verifier is a ceiling every later slice and every sibling
  // verifier's forward-safety probe can break without being wrong, and this
  // repository has spent a round on that before.
  const [{ n: isMover }] = await rows(
    `SELECT count(*) n FROM pg_proc pr
      WHERE pr.oid = $1::regprocedure
        AND pr.prosrc ~ 'UPDATE public\\.shared_world_material_historical_authority'`, [RECONCILE_SIG]);
  assert.equal(Number(isMover), 1, 'P01 the reconciliation is the reviewed mover of a historical authority resolution');

  // AND NOBODY MAY CALL ANY OF IT. The ONE frozen resolver grant is exactly where
  // it was, and nothing else gained EXECUTE.
  for (const signature of [QANDEEL_SIG, GRANT_SIG, CLOSED_SIG, RECONCILE_SIG]) {
    const [{ allowed }] = await rows("SELECT has_function_privilege('public', $1, 'EXECUTE') allowed", [signature]);
    assert.equal(allowed, false, `P01 PUBLIC must not execute ${signature}`);
    for (const role of APP_ROLES) {
      const [{ allowed: roleAllowed }] = await rows(
        'SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
      assert.equal(roleAllowed, false, `P01 ${role} must not execute ${signature}`);
    }
  }
  const [{ allowed: serviceEntry }] = await rows(
    "SELECT has_function_privilege('service_role', $1, 'EXECUTE') allowed", [ENTRY_SIG]);
  assert.equal(serviceEntry, true, 'P01 service_role still executes the ONE historical visibility entry point');
  for (const role of ['public', 'anon', 'authenticated']) {
    const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, ENTRY_SIG, 'EXECUTE']);
    assert.equal(allowed, false, `P01 ${role} must not execute the ONE entry point`);
  }

  // NO ROW ANYWHERE STILL CARRIES THE UNPROVEN CLEARANCE after deployment.
  const [{ n: unproven }] = await rows(
    `SELECT count(*) n FROM ${AUTHORITY} WHERE resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT'`);
  assert.equal(Number(unproven), 0,
    'P01 the migration left no material recording a human requirement it never proved empty');
}

// ---------------------------------------------------------------------------
// A01 - A04, A17 - A19, A21: the producer, through the REAL boundary.
// ---------------------------------------------------------------------------

async function verifyProducer(report, humans) {
  const [author, counterpart] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('A01-A04 a zero-dependency QANDEEL output commits, and records UNRESOLVED rather than proven-empty', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      const output = await rt.commitQandeel(w.world, 'an output with no declared source at all', { kind: 'QANDEEL_OUTPUT' });

      // A01 IT STILL COMMITS, AND ITS EXACT BASELINE AUDIENCE IS UNCHANGED. This
      // is the requirement, not a side effect: the correction narrows WIDENING,
      // not ordinary participation.
      assert.equal(output.outcome, 'MATERIAL_COMMITTED', 'A01 a zero-dependency output still commits');
      assert.equal(Number(output.audience_size), 2, 'A01 to its exact derived baseline audience');
      assert.equal(Number(output.authority_size), 0, 'A01 with no approver invented');
      assert.deepEqual(await rt.baselineViewersOf(output.item), [author, counterpart].sort(),
        'A01 the baseline viewers are exactly the current audience, derived and never supplied');
      for (const human of [author, counterpart]) {
        assert.deepEqual(await rt.visibleItems(w.world, human), [output.item],
          'A01 and both already-authorized humans see it through the ONE visibility entry point');
      }
      const [resolved] = await rt.resolveMaterial(w.world, counterpart);
      assert.equal(resolved.text_body, 'an output with no declared source at all',
        'A01 the narrow material resolver still returns the real body');

      // A02 PROVENANCE IS UNCHANGED AND STILL TRUE.
      assert.deepEqual(await dependencyKindsOf(output.material), ['INDEPENDENT_TARGET_TRUTH'],
        'A02 INDEPENDENT_TARGET_TRUTH is still persisted: it is provenance, and provenance did not change');
      assert.equal(Number(output.material_dependency_edges), 0);
      assert.equal(Number(output.reasoning_dependency_edges), 0);

      // A03 / A04 THE AUTHORITY IS UNKNOWN, AND IS RECORDED AS UNKNOWN.
      assert.equal(await authorityOf(output.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'A03 the historical authority records an unresolved additional human requirement');
      assert.notEqual(await authorityOf(output.material), 'RESOLVED_NO_HUMAN_REQUIREMENT',
        'A04 and never the clearance nothing established');
      assert.equal(await modeOf(output.item), 'EXACT_HUMAN_APPROVER_SET',
        'A04 the item is not approval-free, so the frozen I-04F package path can never read it as one');
      assert.deepEqual(await rt.requiredApproversOf(output.item), [],
        'A04 and no approver was manufactured to make it so');

      // AND THE ANALYSIS KIND BEHAVES IDENTICALLY.
      const analysis = await rt.commitQandeel(w.world, 'an analysis with no declared source at all');
      assert.equal(analysis.committed_material_kind, 'QANDEEL_ANALYSIS');
      assert.equal(await authorityOf(analysis.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'A04 both QANDEEL kinds reach the corrected arm');
    });

    await report.isolated('A17 reasoning-only QANDEEL material is still UNRESOLVED, on its own frozen rationale', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      const reasoned = await rt.commitQandeel(w.world, 'an analysis shaped by authorized private reasoning',
        { reasoning: ['ctx:personal:rem01'] });
      assert.equal(await authorityOf(reasoned.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'A17 the reasoning arm is unchanged');
      assert.equal(await modeOf(reasoned.item), 'EXACT_HUMAN_APPROVER_SET');
      assert.deepEqual(await rt.requiredApproversOf(reasoned.item), [],
        'A17 and a reasoning grantor is still never turned into an approver');
      assert.deepEqual(await dependencyKindsOf(reasoned.material), ['REASONING_DEPENDENCY']);

      // THE ZERO-DEPENDENCY CASE NOW REACHES THE EXACT SAME DURABLE STATE. That
      // is the whole claim of this remediation, asserted as an equality rather
      // than as two separate expectations.
      const independent = await rt.commitQandeel(w.world, 'an output with no declared source at all');
      assert.deepEqual(
        [await authorityOf(independent.material), await modeOf(independent.item), await rt.requiredApproversOf(independent.item)],
        [await authorityOf(reasoned.material), await modeOf(reasoned.item), await rt.requiredApproversOf(reasoned.item)],
        'A17 unknown-because-no-source and unknown-because-reasoning are recorded identically');
    });

    await report.isolated('A18 / A19 exact material-owner authority is non-regressed for QANDEEL and for humans', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      const said = await rt.commitText(w.world, author, 'a statement the analysis reproduces');

      // A19 HUMAN MATERIAL IS UNTOUCHED.
      assert.equal(await authorityOf(said.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A19 human material still resolves to the exact human requirement');
      assert.equal(await modeOf(said.item), 'EXACT_HUMAN_APPROVER_SET');
      assert.deepEqual(await rt.requiredApproversOf(said.item), [author],
        'A19 the author alone: membership still creates no co-ownership');
      const note = await rt.commitVoice(w.world, counterpart, `media/${randomUUID()}`, 'a transcript', 3000);
      assert.equal(await authorityOf(note.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A19 and so does a voice note');

      // A18 KNOWN MATERIAL OWNERS STILL RESOLVE THE EXACT REQUIREMENT.
      const derived = await rt.commitQandeel(w.world, 'an analysis over a known human owner',
        { sources: [said.material] });
      assert.equal(await authorityOf(derived.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A18 propagated exact owners still resolve the requirement');
      assert.equal(Number(derived.authority_size), 1);
      assert.deepEqual(await rt.requiredApproversOf(derived.item), [author],
        'A18 as the exact union over its MATERIAL_DEPENDENCY sources, and nothing else');
      assert.equal(await modeOf(derived.item), 'EXACT_HUMAN_APPROVER_SET');

      // AND A MIXED CASE IS STILL UNRESOLVED: known owners do not resolve the whole.
      const mixed = await rt.commitQandeel(w.world, 'an analysis with a known owner AND private reasoning',
        { sources: [said.material], reasoning: ['ctx:personal:mixed'] });
      assert.equal(await authorityOf(mixed.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');
      assert.deepEqual(await rt.requiredApproversOf(mixed.item), [author],
        'the known owner IS required - that part was always resolved');
    });

    await report.isolated('A21 a derivative cannot launder a zero-dependency output back to proven-empty', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      const independent = await rt.commitQandeel(w.world, 'an output with no declared source at all');
      assert.equal(await authorityOf(independent.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');

      // Its history item is NOT approval-free, so the frozen source-authority
      // floor of the commit core refuses to build on it at all: an exact approver
      // set with no enumerable approver is contradictory in the frozen I-04F
      // vocabulary, which is exactly what "the requirement exists and cannot be
      // resolved" looks like there.
      await rejected(() => rt.commitQandeel(w.world, 'an analysis that reproduces the independent output',
        { sources: [independent.material] }), ['P0001'], /SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE/u);

      // AND THE SAME IS ALREADY TRUE OF THE REASONING-ONLY CASE, which is the
      // frozen behaviour this one now matches rather than a new refusal.
      const reasoned = await rt.commitQandeel(w.world, 'an analysis shaped by private reasoning',
        { reasoning: ['ctx:personal:launder'] });
      await rejected(() => rt.commitQandeel(w.world, 'an analysis that reproduces the reasoned analysis',
        { sources: [reasoned.material] }), ['P0001'], /SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE/u);

      // A PRE-remediation row keeps its approval-free MODE, so it CAN still be a
      // source - and the corrected arm is what stops the derivative inheriting a
      // clearance from it. This is the path a mode-only fix would have left open.
      const old = await seedPreRemediationMaterial(w.world, [author, counterpart], 'an old output committed under the old arm');
      const derivative = await rt.commitQandeel(w.world, 'an analysis over the old output', { sources: [old.material] });
      assert.equal(Number(derivative.authority_size), 0, 'A21 the old row propagates no approver, because it has none');
      assert.equal(await authorityOf(derivative.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'A21 and the derivative is UNRESOLVED rather than inheriting a clearance nothing established');
    });

    await report.isolated('A22 a KNOWN owner does not answer an unknown additional requirement across a MATERIAL_DEPENDENCY edge', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      // H -> Q1 (material H + reasoning) -> Q2 (material Q1 only).
      //
      // Q1 is the shape the repository has always produced for a mixed case:
      // UNRESOLVED, with the known owner genuinely required. Q2 declares NO
      // reasoning of its own and inherits one real approver, so before this
      // correction the known-owner arm resolved it EXACT - laundering Q1's
      // unknown half away in exactly one edge.
      const human = await rt.commitText(w.world, author, 'a statement a later analysis reproduces');
      const q1 = await rt.commitQandeel(w.world, 'an analysis over a human statement AND private reasoning',
        { sources: [human.material], reasoning: ['ctx:personal:rem01-auth-01'] });
      assert.equal(await authorityOf(q1.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'A22 Q1 is unresolved, as it always was');
      assert.deepEqual(await rt.requiredApproversOf(q1.item), [author],
        'A22 with the known owner genuinely required - that half really is resolved');
      assert.equal(await modeOf(q1.item), 'EXACT_HUMAN_APPROVER_SET');

      const q2 = await rt.commitQandeel(w.world, 'an analysis that reproduces the unresolved analysis',
        { sources: [q1.material] });
      assert.equal(q2.outcome, 'MATERIAL_COMMITTED',
        'A22 committing over an unresolved source is allowed: this narrows widening, not participation');
      assert.equal(await authorityOf(q2.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'A22 and the target inherits the WHOLE requirement, not just the half it could enumerate');
      assert.deepEqual(await rt.requiredApproversOf(q2.item), [author],
        'A22 the known approver rows are still derived and still written: they are truthful');
      assert.equal(Number(q2.authority_size), 1);
      assert.equal(await modeOf(q2.item), 'EXACT_HUMAN_APPROVER_SET',
        'A22 unresolved material is never approval-free');
    });

    await report.isolated('A23 the propagation is transitive: an unresolved ancestor keeps every descendant unresolved', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      const human = await rt.commitText(w.world, author, 'a statement at the root of the chain');
      const q1 = await rt.commitQandeel(w.world, 'the unresolved analysis',
        { sources: [human.material], reasoning: ['ctx:personal:chain'] });
      const q2 = await rt.commitQandeel(w.world, 'one edge downstream', { sources: [q1.material] });
      const q3 = await rt.commitQandeel(w.world, 'two edges downstream', { sources: [q2.material] });
      for (const [label, m] of [['Q1', q1], ['Q2', q2], ['Q3', q3]]) {
        assert.equal(await authorityOf(m.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
          `A23 ${label} is unresolved: distance from the unknown does not resolve it`);
      }
      assert.deepEqual(await rt.requiredApproversOf(q3.item), [author],
        'A23 and the known owner is still carried the whole way down');

      // A MIXED PACKAGE OF SOURCES FAILS CLOSED ON THE UNRESOLVED ONE, rather
      // than being rescued by the resolved one beside it.
      const clean = await rt.commitText(w.world, counterpart, 'a second statement with resolved authority');
      const mixed = await rt.commitQandeel(w.world, 'an analysis over one resolved and one unresolved source',
        { sources: [clean.material, q2.material] });
      assert.equal(await authorityOf(mixed.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'A23 one unresolved source is enough, however many resolved ones sit beside it');
      assert.deepEqual(await rt.requiredApproversOf(mixed.item), [author, counterpart].sort(),
        'A23 while the exact union of known owners is still exactly right');
    });

    await report.isolated('A26 a genuinely resolved source with no unresolved ancestry still resolves its target exactly', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      // THE LOAD-BEARING NEGATIVE. If the arm above refused everything, the
      // correction would be a ban rather than a rule - so the ordinary exact
      // path is proven to still work, two edges deep.
      const human = await rt.commitText(w.world, author, 'a statement with genuinely resolved authority');
      const q1 = await rt.commitQandeel(w.world, 'an analysis over it, with no reasoning of its own',
        { sources: [human.material] });
      assert.equal(await authorityOf(q1.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A26 a resolved source still resolves its target exactly');
      assert.deepEqual(await rt.requiredApproversOf(q1.item), [author]);

      const q2 = await rt.commitQandeel(w.world, 'an analysis over the resolved analysis', { sources: [q1.material] });
      assert.equal(await authorityOf(q2.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A26 and so does a resolved chain, two edges deep');
      assert.deepEqual(await rt.requiredApproversOf(q2.item), [author]);

      // AND IT IS STILL PACKAGEABLE, which is what proves the correction did not
      // quietly disable ordinary selective history for everything downstream of
      // a human statement.
      const manifest = randomUUID();
      const [prepared] = await preparePackage(manifest, w.world, counterpart, [q2.item]);
      assert.equal(prepared.outcome, 'PREPARED',
        'A26 a fully resolved chain still enters a history package normally');
      assert.equal(Number(prepared.prepared_required_approver_count), 1,
        'A26 requiring exactly the one human owner the chain really propagated');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ---------------------------------------------------------------------------
// R01 - R04: the forward reconciliation, on a real PRE-remediation row.
// ---------------------------------------------------------------------------

async function verifyReconciliation(report, humans) {
  const [author, counterpart] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('R01-R04 the reconciliation moves exactly the unproven clearance, idempotently, rewriting no history', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      const old = await seedPreRemediationMaterial(w.world, [author, counterpart], 'material committed under the old arm');
      const human = await rt.commitText(w.world, author, 'a statement whose authority was always exact');
      const reasoned = await rt.commitQandeel(w.world, 'an analysis shaped by private reasoning',
        { reasoning: ['ctx:personal:recon'] });

      // THE EXACT PRE-REMEDIATION SHAPE, asserted before anything moves.
      assert.equal(await authorityOf(old.material), 'RESOLVED_NO_HUMAN_REQUIREMENT',
        'R01 the fixture really is in the state the old arm wrote');
      assert.equal(await modeOf(old.item), 'NO_HUMAN_APPROVAL_REQUIRED');
      assert.deepEqual(await dependencyKindsOf(old.material), ['INDEPENDENT_TARGET_TRUTH']);

      const before = (await rows(
        `SELECT i.id, i.occurred_at, i.registered_at, i.authority_requirement_mode, i.availability_state,
                i.availability_revision, m.established_at,
                (SELECT count(*) FROM ${D.VIEWERS} b WHERE b.history_item_id = i.id) viewers,
                (SELECT count(*) FROM ${D.APPROVERS} a WHERE a.history_item_id = i.id) approvers,
                (SELECT count(*) FROM ${DEPENDENCIES} d WHERE d.target_material_id = m.id) edges,
                (SELECT body_text FROM public.shared_world_text_material_bodies b WHERE b.material_id = m.id) body
           FROM ${D.ITEMS} i JOIN ${D.MATERIALS} m ON m.history_item_id = i.id
          WHERE i.world_id = $1 ORDER BY i.id`, [w.world]));

      const [first] = await reconcile();
      assert.equal(Number(first.reconciled_material_count), 1,
        'R01 exactly the one unproven row moved');
      assert.equal(Number(first.remaining_unproven_count), 0,
        'R01 and nothing anywhere still records the clearance');
      assert.equal(await authorityOf(old.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'R01 the old row now records the truth: the requirement was never established');

      // R02 IDEMPOTENT. A second run can only ever be a no-op, which is what makes
      // it safe to re-run against a replica or a restored backup.
      const [second] = await reconcile();
      assert.equal(Number(second.reconciled_material_count), 0, 'R02 a second run moves nothing');
      assert.equal(Number(second.remaining_unproven_count), 0);

      // R03 NOTHING ELSE MOVED, in either direction.
      assert.equal(await authorityOf(human.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'R03 an exact human requirement is never touched');
      assert.equal(await authorityOf(reasoned.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'R03 and an already-unresolved row is left exactly as it was');

      // R04 NO SOURCE HISTORY WAS REWRITTEN. The frozen immutability trigger was
      // neither disabled nor bypassed: the old item still carries the mode it was
      // really committed under, and every instant, viewer, approver, edge and body
      // is byte-identical.
      const after = (await rows(
        `SELECT i.id, i.occurred_at, i.registered_at, i.authority_requirement_mode, i.availability_state,
                i.availability_revision, m.established_at,
                (SELECT count(*) FROM ${D.VIEWERS} b WHERE b.history_item_id = i.id) viewers,
                (SELECT count(*) FROM ${D.APPROVERS} a WHERE a.history_item_id = i.id) approvers,
                (SELECT count(*) FROM ${DEPENDENCIES} d WHERE d.target_material_id = m.id) edges,
                (SELECT body_text FROM public.shared_world_text_material_bodies b WHERE b.material_id = m.id) body
           FROM ${D.ITEMS} i JOIN ${D.MATERIALS} m ON m.history_item_id = i.id
          WHERE i.world_id = $1 ORDER BY i.id`, [w.world]));
      assert.deepEqual(after, before,
        'R04 source bodies, provenance, instants, availability, baseline viewers, required approvers and the frozen authority mode are all unchanged');
      assert.equal(await modeOf(old.item), 'NO_HUMAN_APPROVAL_REQUIRED',
        'R04 in particular the old item still says what it really said: the past is recorded, not rewritten');

      // AND CURRENT BASELINE DELIVERY OF THE RECONCILED ITEM IS UNAFFECTED.
      for (const person of [author, counterpart]) {
        assert.ok((await rt.visibleItems(w.world, person)).includes(old.item),
          'R04 the exact already-authorized baseline audience still sees the reconciled material');
      }
    });

    await report.isolated('A25 the reconciliation reaches the laundering descendants, transitively, to a fixed point', async () => {
      const w = await seedStandardWorld([author, counterpart]);
      // THE EXACT PRE-REMEDIATION CHAIN, in the shape the OLD producer really
      // wrote it: Q1 correctly unresolved with a known owner, and Q2 and Q3
      // wrongly RESOLVED_EXACT because the old arm classified a target from its
      // known approver COUNT alone. Every row below is a shape the old runtime
      // could and did produce.
      const human = await rt.commitText(w.world, author, 'a statement at the root of the laundered chain');
      const q1 = await rt.commitQandeel(w.world, 'the analysis that was correctly unresolved',
        { sources: [human.material], reasoning: ['ctx:personal:laundered'] });
      assert.equal(await authorityOf(q1.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');
      const q2 = await rt.commitQandeel(w.world, 'one edge downstream', { sources: [q1.material] });
      const q3 = await rt.commitQandeel(w.world, 'two edges downstream', { sources: [q2.material] });

      // The post-0119 producer already refuses to launder, so the OLD state is
      // restored on exactly the two descendant rows - the one column the old
      // producer would have written differently, and nothing else.
      await q(`UPDATE ${AUTHORITY} SET resolution_state = 'RESOLVED_EXACT_HUMAN_REQUIREMENT'
                WHERE material_id = ANY($1::uuid[])`, [[q2.material, q3.material]]);
      assert.equal(await authorityOf(q2.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A25 the fixture really is the laundered state');
      assert.equal(await authorityOf(q3.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT');
      const approversBefore = {
        q1: await rt.requiredApproversOf(q1.item),
        q2: await rt.requiredApproversOf(q2.item),
        q3: await rt.requiredApproversOf(q3.item),
      };
      const modesBefore = [await modeOf(q1.item), await modeOf(q2.item), await modeOf(q3.item)];

      const [result] = await reconcile();
      assert.equal(Number(result.remaining_laundered_count), 0,
        'A25 no material still claims an exact resolution its own ancestry does not support');
      assert.ok(Number(result.reconciled_material_count) >= 2,
        'A25 and both laundering descendants really moved');

      for (const [label, m] of [['Q1', q1], ['Q2', q2], ['Q3', q3]]) {
        assert.equal(await authorityOf(m.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
          `A25 ${label} is unresolved after the fixed point`);
      }
      // THE KNOWN REQUIREMENTS SURVIVE UNCHANGED. Reconciliation removes no
      // truthful requirement; it only stops claiming an unknown one is answered.
      assert.deepEqual(
        [await rt.requiredApproversOf(q1.item), await rt.requiredApproversOf(q2.item), await rt.requiredApproversOf(q3.item)],
        [approversBefore.q1, approversBefore.q2, approversBefore.q3],
        'A25 every known required approver row is exactly as it was');
      assert.deepEqual([await modeOf(q1.item), await modeOf(q2.item), await modeOf(q3.item)], modesBefore,
        'A25 and no frozen authority mode was rewritten');
      // THE HUMAN ROOT IS UNTOUCHED: its authority really was established.
      assert.equal(await authorityOf(human.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A25 the human statement the chain descends from keeps its exact resolution');

      // A24 AND NO DESCENDANT CAN BE WIDENED. Both paths refuse, which is the
      // consequence the whole reconciliation exists to produce.
      for (const item of [q2.item, q3.item]) {
        await rejected(() => preparePackage(randomUUID(), w.world, counterpart, [item]),
          INCOMPLETE, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u);
      }
      await actAs(author);
      await ensureIdentity(randomUUID(), randomUUID(), 'PSEUDONYM', 'the publisher');
      const experience = randomUUID();
      await createDraft(randomUUID(), experience);
      await rejected(() => preparePublic(randomUUID(), experience, randomUUID(), randomUUID(),
        [randomUUID()], [w.world], [q3.material]),
      INCOMPLETE, /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
      await asRole('postgres');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ---------------------------------------------------------------------------
// A08 - A13: historical widening, the stale manifest and effective visibility.
// ---------------------------------------------------------------------------

async function verifyHistoricalWidening(report, humans) {
  const [author, grantee] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('A08 / A09 an unresolved zero-dependency item can enter no NEW package and produce no NEW grant', async () => {
      const w = await seedStandardWorld([author]);
      const output = await rt.commitQandeel(w.world, 'an output committed while the grantee was absent');
      await joinLater(w.world, grantee);
      assert.equal(await authorityOf(output.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');

      // A08 IT CANNOT BE PACKAGED - and the refusal is asserted as it REALLY is
      // rather than as the one this migration added.
      //
      // TWO independent fail-closed paths cover a zero-dependency item, and the
      // FROZEN one reaches it first: an item claiming an exact approver set with
      // no enumerable approver is already contradictory in the I-04F vocabulary,
      // which is exactly what "the requirement exists and cannot be resolved"
      // looks like there. This is the same framing migration 0090's verifier
      // already uses for the reasoning-only item, for the same reason.
      const said = await rt.commitText(w.world, author, 'a statement the grantee may lawfully receive');
      await rejected(() => preparePackage(randomUUID(), w.world, grantee, [output.item]),
        CONTRADICTORY, /SHARED_WORLD_HISTORY_CONTRADICTORY_STATE/u);
      await rejected(() => preparePackage(randomUUID(), w.world, grantee, [said.item, output.item]),
        CONTRADICTORY, /SHARED_WORLD_HISTORY_CONTRADICTORY_STATE/u);

      // AND THE I-04G WIDENING GATE IS THE ONE THAT CATCHES THE CASE THE FROZEN
      // RULE CANNOT SEE: an unresolved item whose metadata is perfectly coherent
      // because it really does have a known required human. Nothing in the I-04F
      // vocabulary can tell that apart from a resolved item, which is the whole
      // reason the gate exists - and it is now reachable through an ordinary
      // MATERIAL_DEPENDENCY chain as well as through a reasoning dependency.
      const unresolvedWithOwner = await rt.commitQandeel(w.world, 'an analysis over a human statement AND private reasoning',
        { sources: [said.material], reasoning: ['ctx:personal:a08'] });
      assert.equal(await authorityOf(unresolvedWithOwner.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');
      assert.deepEqual(await rt.requiredApproversOf(unresolvedWithOwner.item), [author],
        'A08 its metadata is coherent: it really does have a known required human');
      await rejected(() => preparePackage(randomUUID(), w.world, grantee, [unresolvedWithOwner.item]),
        INCOMPLETE, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u);
      // AND IT POISONS A PACKAGE IT IS MERELY PART OF, rather than being dropped.
      await rejected(() => preparePackage(randomUUID(), w.world, grantee, [said.item, unresolvedWithOwner.item]),
        INCOMPLETE, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u);
      // And so does its MATERIAL_DEPENDENCY descendant, which is REM01-AUTH-01.
      const descendant = await rt.commitQandeel(w.world, 'an analysis one edge downstream',
        { sources: [unresolvedWithOwner.material] });
      await rejected(() => preparePackage(randomUUID(), w.world, grantee, [descendant.item]),
        INCOMPLETE, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u);

      // A09 SO NO NEW GRANT CAN EXIST FOR IT: there is no manifest to grant.
      const [{ n: manifests }] = await rows(
        `SELECT count(*) n FROM ${MANIFEST_ITEMS} WHERE history_item_id = $1`, [output.item]);
      assert.equal(Number(manifests), 0, 'A09 no manifest anywhere includes the unresolved item');

      // A LAWFUL ITEM IN THE SAME WORLD IS STILL PACKAGEABLE AND GRANTABLE, which
      // is what proves the refusal is about authority rather than about the World.
      const manifest = randomUUID();
      const [prepared] = await preparePackage(manifest, w.world, grantee, [said.item]);
      assert.equal(prepared.outcome, 'PREPARED', 'A09 ordinary selective history still works');
      await actAs(author);
      await approvePackage(randomUUID(), manifest);
      await asRole('postgres');
      const [granted] = await commitGrant(randomUUID(), manifest, randomUUID(), randomUUID());
      assert.equal(granted.outcome, 'HISTORY_GRANTED', 'A09 and its grant still commits');
    });

    await report.isolated('A10 a manifest prepared BEFORE the correction cannot commit a grant after it', async () => {
      const w = await seedStandardWorld([author]);
      const old = await seedPreRemediationMaterial(w.world, [author], 'material widened under the old arm');
      const granteeEpisode = await joinLater(w.world, grantee);
      assert.ok(granteeEpisode, 'the grantee is a current member, so only the authority can refuse this');

      // THE MANIFEST IS PREPARED WHILE THE OLD STATE STILL STANDS. The frozen
      // preparation-time trigger passes, exactly as it did in production.
      const manifest = randomUUID();
      const [prepared] = await preparePackage(manifest, w.world, grantee, [old.item]);
      assert.equal(prepared.outcome, 'PREPARED', 'A10 preparation succeeded under the pre-remediation state');
      assert.equal(Number(prepared.prepared_required_approver_count), 0,
        'A10 with zero required approvers - which is the fail-open the manifest froze');

      // NOW THE CORRECTION LANDS. The manifest is immutable and predates it.
      await reconcile();
      assert.equal(await authorityOf(old.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');
      const [{ n: stillThere }] = await rows(
        `SELECT count(*) n FROM ${MANIFEST_ITEMS} WHERE manifest_version_id = $1`, [manifest]);
      assert.equal(Number(stillThere), 1,
        'A10 the manifest is untouched: immutable history is evidence, and it is not rewritten');

      // AND THE CONSEQUENTIAL COMMIT FAILS CLOSED, because it re-asks.
      await rejected(() => commitGrant(randomUUID(), manifest, randomUUID(), randomUUID()),
        INCOMPLETE, /SHARED_WORLD_MATERIAL_HISTORICAL_AUTHORITY_UNRESOLVED/u);
      const [{ n: grants }] = await rows(
        `SELECT count(*) n FROM ${GRANTS} WHERE manifest_version_id = $1`, [manifest]);
      assert.equal(Number(grants), 0, 'A10 no grant was created by the refused commit');
    });

    await report.isolated('A11 / A12 baseline visibility survives, and a grant-only widening does not', async () => {
      const w = await seedStandardWorld([author]);
      const old = await seedPreRemediationMaterial(w.world, [author], 'material widened before the correction');
      await joinLater(w.world, grantee);

      // THE GRANT IS REALLY COMMITTED, under the old state, through the frozen
      // primitive. Nothing below simulates it.
      const manifest = randomUUID();
      await preparePackage(manifest, w.world, grantee, [old.item]);
      const [granted] = await commitGrant(randomUUID(), manifest, randomUUID(), randomUUID());
      assert.equal(granted.outcome, 'HISTORY_GRANTED');
      await asRole('service_role');
      assert.ok((await rt.visibleItems(w.world, grantee)).includes(old.item),
        'A12 the grantee really did receive the item through the widening, before the correction');
      await asRole('postgres');

      const authorBefore = await rt.visibleItems(w.world, author);
      await reconcile();

      // A11 THE BASELINE HUMAN LOSES NOTHING.
      await asRole('service_role');
      assert.deepEqual(await rt.visibleItems(w.world, author), authorBefore,
        'A11 the human who was always in the item baseline audience sees exactly what they saw');
      assert.ok((await rt.visibleItems(w.world, author)).includes(old.item),
        'A11 including the reconciled material itself');

      // A12 THE HUMAN WHOSE ONLY BASIS WAS THE WIDENING DOES NOT.
      assert.ok(!(await rt.visibleItems(w.world, grantee)).includes(old.item),
        'A12 an unresolved item no longer reaches a human whose only basis is the old grant');
      await asRole('postgres');

      // THE GRANT ROW ITSELF SURVIVES AS EVIDENCE. It is history, and history is
      // not deleted to make a correction look tidy.
      const [{ n: grantRows }] = await rows(
        `SELECT count(*) n FROM ${GRANTS} WHERE manifest_version_id = $1`, [manifest]);
      assert.equal(Number(grantRows), 1, 'A12 the committed grant is retained as durable historical evidence');
      const [{ n: events }] = await rows(
        'SELECT count(*) n FROM public.shared_world_history_granted_events WHERE manifest_version_id = $1', [manifest]);
      assert.equal(Number(events), 1, 'A12 and so is the append-only HISTORY_GRANTED fact');
    });

    await report.isolated('A13 a closed Standard snapshot does not preserve the invalid widening', async () => {
      const w = await seedStandardWorld([author]);
      const old = await seedPreRemediationMaterial(w.world, [author], 'material widened before a later closure');
      await joinLater(w.world, grantee);
      const manifest = randomUUID();
      await preparePackage(manifest, w.world, grantee, [old.item]);
      assert.equal((await commitGrant(randomUUID(), manifest, randomUUID(), randomUUID()))[0].outcome, 'HISTORY_GRANTED');

      // THE WORLD REALLY CLOSES, through the frozen I-04F governance path, while
      // the widening is still valid - so the snapshot freezes it in, exactly as a
      // pre-remediation closure would have.
      const proposal = randomUUID();
      await rows(`SELECT outcome FROM public.prepare_shared_world_standard_end_governance_v1($1,$2,$3,$4)`,
        [proposal, randomUUID(), randomUUID(), w.world]);
      for (const human of [author, grantee]) {
        await actAs(human);
        await rows('SELECT outcome FROM public.commit_shared_world_governance_approval_v1($1,$2)', [randomUUID(), proposal]);
      }
      await asRole('postgres');
      const [closed] = await rows(
        `SELECT outcome, closed_entitlement_count FROM public.commit_shared_world_standard_end_v1($1,$2,$3)`,
        [randomUUID(), proposal, randomUUID()]);
      assert.equal(closed.outcome, 'WORLD_ENDED', 'A13 the World really is READ_ONLY_CLOSED');
      const [{ n: frozenIn }] = await rows(
        `SELECT count(*) n FROM ${STANDARD_ENTITLEMENT_ITEMS} WHERE world_id = $1 AND user_id = $2 AND history_item_id = $3`,
        [w.world, grantee, old.item]);
      assert.equal(Number(frozenIn), 1,
        'A13 and the widened item really was frozen into the grantee closed-view snapshot');

      // NOW THE CORRECTION LANDS, AFTER CLOSURE.
      await reconcile();
      await asRole('service_role');
      assert.ok(!(await rt.visibleItems(w.world, grantee)).includes(old.item),
        'A13 a closure snapshot does not preserve a widening whose authority is now unresolved');
      assert.ok((await rt.visibleItems(w.world, author)).includes(old.item),
        'A13 while the baseline human keeps their closed view of it unchanged');
      await asRole('postgres');

      // THE SNAPSHOT ROW SURVIVES: the entitlement is evidence, and the reader
      // decides, exactly as availability already worked.
      const [{ n: stillFrozen }] = await rows(
        `SELECT count(*) n FROM ${STANDARD_ENTITLEMENT_ITEMS} WHERE world_id = $1 AND user_id = $2 AND history_item_id = $3`,
        [w.world, grantee, old.item]);
      assert.equal(Number(stillFrozen), 1, 'A13 the entitlement row itself is retained rather than deleted');
      const [{ n: entitlements }] = await rows(
        `SELECT count(*) n FROM ${STANDARD_ENTITLEMENTS} WHERE world_id = $1`, [w.world]);
      assert.equal(Number(entitlements), 2, 'A13 and both humans keep their closure entitlement');
    });

    await report.section('A13 the Introduction closed snapshot structurally cannot carry a widened item', async () => {
      // The Introduction branch of the ONE entry point has NO grant basis at all,
      // and migration 0116 builds the Introduction closed-view snapshot through
      // that exact branch - so an Introduction entitlement item is always already
      // a baseline item of the human holding it, and there is nothing for a
      // correction to subtract. Proven from the live bodies rather than assumed.
      const entry = await sourceOf(ENTRY_SIG);
      const introductionBranch = entry.slice(
        entry.indexOf("IF world.phase = 'INTRODUCTION' THEN"),
        entry.indexOf('-- ACTIVE / STANDARD'));
      assert.ok(introductionBranch.length > 0, 'the Introduction branch is locatable in the ONE entry point');
      assert.doesNotMatch(introductionBranch, /shared_world_history_package_manifest_items|shared_world_history_access_grants/u,
        'the ACTIVE / INTRODUCTION branch has no selective-history basis of any kind');
      assert.match(introductionBranch, /shared_world_history_item_baseline_viewers/u,
        'it is the baseline-audience conjunction alone');
      const [{ n: writers }] = await rows(
        `SELECT count(*) n FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public'
            AND pr.prosrc ~ 'INSERT INTO public\\.introduction_closed_view_entitlement_items'`);
      assert.equal(Number(writers), 1, 'exactly one reviewed producer writes an Introduction closed-view item');
      const [{ prosrc: snapshotWriter }] = await rows(
        `SELECT pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public'
            AND pr.prosrc ~ 'INSERT INTO public\\.introduction_closed_view_entitlement_items'`);
      assert.match(snapshotWriter, /resolve_shared_world_history_visibility_v1/u,
        'and it builds the snapshot through the ONE canonical visibility entry point, never from a grant');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ---------------------------------------------------------------------------
// A14 - A16: the Public downstream, by composition of the frozen derivations.
// ---------------------------------------------------------------------------

async function verifyPublicDownstream(report, humans) {
  const [author, reader] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    const seam = (await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [PUBLIC_SEAM]))[0];
    assert.ok(seam.prosrc.includes('NOT_EVALUATED') && !seam.prosrc.includes("'CLEARED'"),
      'the production CW2-08 seam fails closed before this section touches it');

    await report.isolated('A14 an unresolved zero-dependency Shared source cannot enter a NEW Public package', async () => {
      const w = await seedStandardWorld([author]);
      const output = await rt.commitQandeel(w.world, 'an output with no declared source at all');
      const said = await rt.commitText(w.world, author, 'a statement the publisher owns');
      await actAs(author);
      await ensureIdentity(randomUUID(), randomUUID(), 'PSEUDONYM', 'the publisher');
      const experience = randomUUID();
      await createDraft(randomUUID(), experience);

      await rejected(() => preparePublic(randomUUID(), experience, randomUUID(), randomUUID(),
        [randomUUID()], [w.world], [output.material]),
      INCOMPLETE, /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
      // And beside lawful material the WHOLE preparation fails closed.
      await rejected(() => preparePublic(randomUUID(), experience, randomUUID(), randomUUID(),
        [randomUUID(), randomUUID()], [w.world, w.world], [said.material, output.material]),
      INCOMPLETE, /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
      await asRole('postgres');
    });

    await report.isolated('A15 the current Public authority derivation never reinterprets it as zero approvers', async () => {
      const w = await seedStandardWorld([author]);
      const old = await seedPreRemediationMaterial(w.world, [author], 'a Public source packaged before the correction');
      await actAs(author);
      await ensureIdentity(randomUUID(), randomUUID(), 'PSEUDONYM', 'the publisher');
      const experience = randomUUID();
      const manifest = randomUUID();
      const version = randomUUID();
      await createDraft(randomUUID(), experience);
      const [prepared] = await preparePublic(randomUUID(), experience, manifest, version,
        [randomUUID()], [w.world], [old.material]);
      assert.equal(prepared.outcome, 'PACKAGE_PREPARED', 'A15 it packaged under the pre-remediation state');
      assert.equal(Number(prepared.required_approver_count), 0,
        'A15 with zero rightsholders - which is the fail-open the package froze');
      const [derivedBefore] = await deriveAuthority(manifest);
      assert.equal(Number(derivedBefore.required_approver_count), 0,
        'A15 and the authority derivation answered zero approvers, exactly as the finding described');

      await asRole('postgres');
      await reconcile();

      // THE FROZEN DERIVATION NOW RAISES rather than answering zero. No Public
      // code changed: correcting the SOURCE state is the whole Public fix.
      await rejected(() => deriveAuthority(manifest), INCOMPLETE, /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
      await actAs(author);
      await rejected(() => commitReady(randomUUID(), experience, version),
        INCOMPLETE, /PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED/u);
      await asRole('postgres');
    });

    await report.isolated('A16 continuing Public eligibility fails closed for an already-published one', async () => {
      const w = await seedStandardWorld([author]);
      const old = await seedPreRemediationMaterial(w.world, [author], 'a Public source published before the correction');
      await actAs(author);
      await ensureIdentity(randomUUID(), randomUUID(), 'PSEUDONYM', 'the publisher');
      const experience = randomUUID();
      const manifest = randomUUID();
      const version = randomUUID();
      await createDraft(randomUUID(), experience);
      await preparePublic(randomUUID(), experience, manifest, version, [randomUUID()], [w.world], [old.material]);
      const [ready] = await commitReady(randomUUID(), experience, version);
      assert.equal(ready.outcome, 'READY_FOR_REVIEW', 'A16 it reached review under the pre-remediation state');

      // PUBLISHED, through the frozen primitive, with the CW2-08 seam simulated
      // inside this transaction alone and restored immediately afterwards.
      await asRole('postgres');
      await q(`CREATE OR REPLACE FUNCTION public.resolve_public_publication_prerequisites_v1(p_experience_id uuid, p_manifest_version_id uuid)
               RETURNS TABLE(clearance text, clearance_basis text)
               LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $probe$
               BEGIN
                 IF p_experience_id IS NULL OR p_manifest_version_id IS NULL THEN
                   RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
                 END IF;
                 RETURN QUERY SELECT 'CLEARED'::text,
                   'QAN-CW-REM-01 VERIFIER PROBE: simulated CW2-08 clearance inside a verifier transaction'::text;
               END$probe$`);
      try {
        await actAs(author);
        const [published] = await publish(randomUUID(), experience, version);
        assert.equal(published.outcome, 'PUBLISHED', 'A16 the fixture really is a live Public publication');
      } finally {
        await asRole('postgres');
        await q(seam.definition);
        const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [PUBLIC_SEAM]);
        assert.equal(prosrc, seam.prosrc, 'A16 the production CW2-08 seam is restored byte for byte');
      }

      const [before] = await continuingEligibility(experience);
      assert.equal(before.eligibility_state, 'ELIGIBLE', 'A16 and it is currently serving');

      await reconcile();

      const [after] = await continuingEligibility(experience);
      assert.equal(after.eligibility_state, 'INELIGIBLE',
        'A16 a publication whose source authority is now unresolved stops being eligible');
      assert.equal(after.ineligibility_class, 'PUBLICATION_AUTHORITY_INVALIDATED',
        'A16 through the frozen authority chain rather than through any new Public rule');

      // AND NO PUBLIC LIFECYCLE MOVED. This remediation invents no recall,
      // withdrawal or deletion semantics: eligibility is DERIVED, not written.
      const [{ current_lifecycle: lifecycle }] = await rows(
        'SELECT current_lifecycle FROM public.public_experiences WHERE id = $1', [experience]);
      assert.equal(lifecycle, 'PUBLISHED',
        'A16 the Experience lifecycle is untouched: no retroactive Public removal was invented');
    });

    // AND NEITHER FROZEN PUBLIC DERIVATION WAS EDITED TO ACHIEVE ANY OF IT.
    await report.section('A14-A16 the Public half is composition, not modification', async () => {
      for (const name of ['prepare_public_experience_manifest_v1', 'derive_public_publication_authority_v1']) {
        const [{ n }] = await rows(
          `SELECT count(*) n FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace
            WHERE ns.nspname = 'public' AND pr.proname = $1
              AND pr.prosrc ~ 'shared_world_material_historical_authority'
              AND pr.prosrc ~ 'PUBLIC_EXPERIENCE_SOURCE_AUTHORITY_UNRESOLVED'`, [name]);
        assert.equal(Number(n), 1, `${name} still fails Public inclusion closed on unresolved source authority`);
      }
      const [{ prosrc: eligibility }] = await rows(
        `SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = 'public.derive_public_continuing_eligibility_v1(uuid)'::regprocedure`);
      assert.match(eligibility, /derive_public_publication_authority_v1/u,
        'continuing eligibility still consumes the ONE authority derivation');
      assert.match(eligibility, /PUBLICATION_AUTHORITY_INVALIDATED/u,
        'and still turns its raise into a fail-closed answer rather than an oracle');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ---------------------------------------------------------------------------
// A05 - A07, A20: the Introduction phase, through the REAL I-07 boundaries.
// ---------------------------------------------------------------------------

async function verifyIntroduction(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('A05-A07 a zero-dependency Introduction output reaches both humans and is UNRESOLVED', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const welcome = await rt.commitQandeel(f.world, 'a welcome that breaks the ice', { kind: 'QANDEEL_OUTPUT' });

      // A05 IT COMMITS TO THE EXACT TWO-HUMAN BASELINE AUDIENCE.
      assert.equal(welcome.outcome, 'MATERIAL_COMMITTED', 'A05 QANDEEL can still speak in an Introduction');
      assert.equal(Number(welcome.audience_size), 2, 'A05 to exactly the two matched humans');
      assert.deepEqual(await rt.baselineViewersOf(welcome.item), [f.lower, f.higher].sort());

      // A06 AND ITS AUTHORITY IS UNKNOWN. This is the phase the finding was about:
      // an analysis here can concern both humans while carrying no representable
      // dependency edge at all.
      assert.equal(await authorityOf(welcome.material), 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT',
        'A06 the Introduction output records an unresolved additional human requirement');
      assert.equal(await modeOf(welcome.item), 'EXACT_HUMAN_APPROVER_SET');
      assert.deepEqual(await rt.requiredApproversOf(welcome.item), [],
        'A06 and the counterpart was NOT manufactured into an approver');
      assert.deepEqual(await dependencyKindsOf(welcome.material), ['INDEPENDENT_TARGET_TRUTH'],
        'A06 while its provenance is unchanged and still true');

      // A07 BOTH HUMANS SEE IT, NORMALLY. Nothing about ordinary Introduction
      // conversation is narrowed by the correction.
      for (const human of [f.lower, f.higher]) {
        assert.deepEqual(await rt.visibleItems(f.world, human), [welcome.item],
          'A07 both matched humans retain normal visibility of it');
        const [resolved] = await rt.resolveMaterial(f.world, human);
        assert.equal(resolved.text_body, 'a welcome that breaks the ice',
          'A07 and resolve its real body through the narrow material resolver');
      }

      // AND IT CANNOT BECOME AN APPROVAL-FREE WIDENING. An ACTIVE / INTRODUCTION
      // World has no selective-history path at all, so the reachable widening is
      // the Public one, and it fails closed on the source state.
      await rejected(() => preparePackage(randomUUID(), f.world, f.higher, [welcome.item]),
        UNAVAILABLE, /SHARED_WORLD_HISTORY_NOT_AVAILABLE/u);
    });

    await report.isolated('A20 the Introduction disclosure producer and both human kinds are unchanged', async () => {
      const f = await rt.bringToIntroduction(one, two);

      // THE RESERVED EXPLICIT_DISCLOSURE PRODUCER STILL WRITES THE EXACT OWNER.
      // A field key belongs to DEEPER_PERSONAL_FIELD alone, which the frozen
      // producer enforces as an exact biconditional - so a FULL_NAME carries none.
      const { ids, answer } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.equal(answer.outcome, 'DISCLOSURE_GRANTED', 'A20 the one disclosure producer is untouched');
      assert.equal(await authorityOf(ids.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A20 a disclosure still resolves to the exact human requirement: its owner');
      assert.deepEqual(await rt.requiredApproversOf(ids.item), [f.lower],
        'A20 which is the owner, and nobody else');
      assert.equal(await modeOf(ids.item), 'EXACT_HUMAN_APPROVER_SET');

      // AND ORDINARY HUMAN MATERIAL IS EXACTLY AS I-07D LEFT IT.
      const said = await rt.commitText(f.world, f.higher, 'an ordinary thing said in the Introduction');
      assert.equal(await authorityOf(said.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT');
      assert.deepEqual(await rt.requiredApproversOf(said.item), [f.higher]);
      const note = await rt.commitVoice(f.world, f.lower, `introduction-audio/${randomUUID()}`, 'a transcript', 2500);
      assert.equal(await authorityOf(note.material), 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'A20 a voice note is still owned by its exact author');

      // NO MATCHING PRIVATE STATE ENTERED SHARED AUTHORITY.
      const [{ n: leaked }] = await rows(
        `SELECT count(*) n FROM ${AUTHORITY} a JOIN ${D.MATERIALS} m ON m.id = a.material_id
          WHERE m.world_id = $1 AND a.resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT'`, [f.world]);
      assert.equal(Number(leaked), 0, 'A20 nothing in the Introduction records a clearance nothing established');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ---------------------------------------------------------------------------
// ASSURE-F04: the claimed cross-World row-lock cycle, on real PostgreSQL.
// ---------------------------------------------------------------------------

/**
 * Reconstructs the EXACT cycle the phase-wide assurance claimed, from the live
 * function bodies, and then decides it with three real connections and a
 * barrier-pinned interleaving rather than with sleeps.
 *
 * The claim: `prepare_public_experience_manifest_v1` locks Shared World rows by
 * the World ids the CALLER named, but locks Shared materials by material id
 * ALONE - so a request naming mismatched `(world_ids, material_ids)` arrays takes
 * row locks inside a World whose World row it does not hold, and can therefore
 * close a directed cycle against `delete_shared_world_owned_material_v1`, which
 * holds its exact material X and then waits for its transitive target Y.
 *
 * The decisive fact is that migration 0089 orders dependency edges TEMPORALLY -
 * `source_established_at < target_established_at` - and not on the uuid, so a
 * target Y may hold a smaller id than its source X. The deletion then walks
 * X then Y while every other site walks ascending id, and the two orders cross.
 */
async function verifyLockCycle(report, fixture) {
  // --------------------------------------------------------------- C01
  await report.section('C01 the reproduced cycle is reconstructed, and every lock statement is now World-scoped', async () => {
    const publicPrepare = stripComments(await sourceOf(PREPARE_PUBLIC_SIG));
    const deletion = stripComments(await sourceOf(DELETE_SIG));
    const historyPrepare = stripComments(await sourceOf(PREPARE_HISTORY_SIG));
    const producer = stripComments(await sourceOf(QANDEEL_SIG));

    // THE PRECONDITIONS THAT MADE THE CYCLE POSSIBLE ARE STRUCTURAL, and they
    // are unchanged: this correction does not pretend the hazard was imaginary.
    //
    // The deletion's order is World, X, X's item, then the transitive closure
    // ASCENDING - so its sequence is X then Y whenever Y sorts below X.
    const deleteWorldAt = deletion.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
    const deleteExactAt = deletion.indexOf('FROM public.shared_world_materials m WHERE m.id = p_material_id FOR UPDATE');
    const deleteTargetsAt = deletion.indexOf('WHERE m.id = ANY(targets) ORDER BY m.id FOR UPDATE');
    assert.ok(deleteWorldAt >= 0 && deleteExactAt > deleteWorldAt && deleteTargetsAt > deleteExactAt,
      'C01 the deletion still locks its World, then its exact material, then its transitive targets');
    // And the edge order really is temporal rather than lexical, which is what
    // makes a target sorting below its source possible at all. Had migration
    // 0089 ordered edges on the uuid, this finding would have been refuted.
    const [{ definition }] = await rows(
      `SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c
        WHERE c.conrelid = 'public.shared_world_material_dependencies'::regclass
          AND c.conname = 'shared_world_material_dependencies_source_precedes_check'`);
    assert.match(definition, /source_established_at < target_established_at/u,
      'C01 dependency precedence is temporal, never lexical on the uuid');
    assert.ok(fixture.target < fixture.source,
      'C01 and the fixture really does hold a target whose id sorts BELOW its source');

    // AND THE CORRECTION IS IN PLACE: no statement locks a globally unique row
    // identity without also pinning the World it already knows.
    assert.match(publicPrepare,
      /WHERE m\.id = ANY\(p_shared_source_material_ids\)\s*\n?\s*AND m\.world_id = ANY\(p_shared_source_world_ids\) ORDER BY m\.id FOR SHARE/u,
      'C01 the Public preparation locks Shared materials only inside the Worlds it named and locked');
    assert.match(publicPrepare, /AND i\.world_id = ANY\(p_shared_source_world_ids\)\s*\n?\s*ORDER BY i\.id FOR SHARE/u,
      'C01 and their history items the same way');
    assert.match(historyPrepare,
      /WHERE i\.id = ANY\(selected\) AND i\.world_id = p_world_id ORDER BY i\.id FOR UPDATE/u,
      'C01 the history preparation locks items only inside the World it locked first');
    assert.match(producer,
      /WHERE m\.id = ANY\(sources\) AND m\.world_id = p_world_id ORDER BY m\.id FOR UPDATE/u,
      'C01 and the QANDEEL producer locks sources only inside the World it locked first');
    // The World-containment half of the producer check moved AHEAD of the lock,
    // which is what keeps the refusal class exactly what it was.
    const containmentAt = producer.indexOf("WHERE m.id = ANY(sources) AND m.world_id <> p_world_id");
    const producerLockAt = producer.indexOf('WHERE m.id = ANY(sources) AND m.world_id = p_world_id ORDER BY m.id FOR UPDATE');
    assert.ok(containmentAt > 0 && producerLockAt > containmentAt,
      'C01 with World containment decided BEFORE the lock, because a material World is immutable');

    // AND NOTHING WAS TRADED FOR IT. No advisory lock, no table lock, and the
    // World row is still taken first everywhere.
    for (const [label, body] of [['the Public preparation', publicPrepare], ['the history preparation', historyPrepare],
      ['the QANDEEL producer', producer], ['owner deletion', deletion]]) {
      assert.doesNotMatch(body, /pg_advisory|LOCK TABLE/iu, `C01 ${label} takes only canonical row locks`);
    }
  });

  // --------------------------------------------------------------- C02 - C04
  const deadlocksBefore = Number((await rows(
    "SELECT COALESCE(sum(deadlocks),0)::int n FROM pg_stat_database WHERE datname = current_database()"))[0].n);
  let verdict = 'REFUTED';
  let evidence = '';

  const holder = await rt.openExtra();
  const deleter = await rt.openExtra();
  const publisher = await rt.openExtra();
  try {
    /** Whether a pending query finishes inside `ms`, without deciding anything by sleeping. */
    const settlesWithin = (pending, ms) => Promise.race([
      pending.then((value) => ({ settled: true, value })),
      new Promise((done) => { setTimeout(() => done({ settled: false }), ms); }),
    ]);

    await report.section('C02 / C03 the deletion reaches its row, and the foreign-World request no longer reaches it at all', async () => {
      // THE BARRIER. A third connection holds the history item of X, which the
      // deletion locks BETWEEN X and its transitive targets - so the deletion is
      // pinned holding X and not yet holding Y. No sleep decides anything here.
      await holder.qx('BEGIN');
      await holder.qx('SELECT 1 FROM public.shared_world_history_items WHERE id = $1 FOR UPDATE', [fixture.sourceItem]);

      await deleter.actAsX(fixture.author);
      await deleter.qx('BEGIN');
      const deleting = deleter.qx(
        'SELECT outcome FROM public.delete_shared_world_owned_material_v1($1,$2,$3,$4)',
        [randomUUID(), fixture.world, fixture.source, randomUUID()]).catch((error) => error);
      assert.equal(await rt.waitForLockWait(q, deleter.pid), true,
        'C02 the deletion is observably waiting on the exact history item the barrier holds, while holding its material');

      // THE FOREIGN-WORLD REQUEST. It names a World it really controls and
      // materials that live in ANOTHER World, which is the whole precondition.
      await publisher.actAsX(fixture.publisher);
      await publisher.qx('BEGIN');
      const preparing = publisher.qx(
        `SELECT outcome FROM public.prepare_public_experience_manifest_v1($1,$2,$3,$4,
           ARRAY[]::uuid[], ARRAY[]::uuid[], $5::uuid[], $6::uuid[], $7::uuid[])`,
        [randomUUID(), fixture.experience, randomUUID(), randomUUID(),
          [randomUUID(), randomUUID()], [fixture.otherWorld, fixture.otherWorld], [fixture.source, fixture.target]])
        .catch((error) => error);

      // C03 THE FOREIGN-WORLD REQUEST NEVER TOUCHES THE HELD ROW. Before the
      // correction it took the material of another World, blocked on the
      // deletion, and closed the cycle; now it is refused by the containment
      // check it always had, WITHOUT having taken a lock inside that World - so
      // it settles while the deletion is still pinned on the barrier.
      const settled = await settlesWithin(preparing, 3000);
      assert.equal(settled.settled, true,
        'C03 the foreign-World preparation completes while the deletion still holds its material');
      assert.equal(await rt.waitForLockWait(q, deleter.pid), true,
        'C03 and the deletion is still the one waiting, which is what makes that a real observation');
      const [{ n: waitingOnDeleter }] = await rows(
        `SELECT count(*) n FROM pg_locks w
           JOIN pg_locks h ON h.locktype = 'transactionid' AND h.transactionid = w.transactionid AND h.granted
          WHERE w.pid = $1 AND NOT w.granted AND w.locktype = 'transactionid' AND h.pid = $2`,
        [publisher.pid, deleter.pid]);
      assert.equal(Number(waitingOnDeleter), 0,
        'C03 nothing in the foreign-World transaction is blocked on the deletion: the edge that closed the cycle is gone');

      // RELEASE THE BARRIER. Before the correction the deletion resumed, asked
      // for its transitive target, found the foreign-World transaction holding
      // it, and the two deadlocked. Now the foreign-World transaction never took
      // that row at all, so there is nothing to wait for.
      await holder.qx('ROLLBACK');
      const deleteOutcome = await deleting;
      const prepareOutcome = await preparing;
      const codes = [deleteOutcome, prepareOutcome].map((r) => r?.code ?? null);
      verdict = codes.includes('40P01') ? 'CYCLE STILL CLOSES' : 'CYCLE BROKEN';
      evidence = `delete=${deleteOutcome?.code ?? 'ok'} prepare=${prepareOutcome?.code ?? 'ok'}`;

      // C05 THE SAME ATTACK NOW COMPLETES WITHOUT A DEADLOCK.
      assert.ok(!codes.includes('40P01'),
        `C05 the reproduced cycle no longer closes: neither transaction saw 40P01 (${evidence})`);
      assert.ok(!codes.includes('55P03'), 'C05 and neither timed out waiting for a lock either');

      // C08 AND THE RESULT SEMANTICS ARE EXACTLY WHAT THEY WERE. A mismatched
      // request is still refused, with the frozen class, for the frozen reason.
      assert.equal(deleteOutcome?.code ?? 'ok', 'ok',
        'C08 the privacy operation completes: its availability was the whole cost of the defect');
      assert.equal(prepareOutcome?.code, 'P0002',
        'C08 the mismatched publication request is still refused, with the class it always raised');
      assert.match(String(prepareOutcome?.message ?? ''), /PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE/u,
        'C08 for the reason it always gave, now reached without taking a lock in a World it does not hold');

      await deleter.qx('ROLLBACK').catch(() => undefined);
      await publisher.qx('ROLLBACK').catch(() => undefined);
    });
  } finally {
    await holder.close();
    await deleter.close();
    await publisher.close();
  }

  await report.section('C06 / C07 legitimate same-World concurrency still serializes, and unrelated Worlds stay concurrent', async () => {
    // C06 A REQUEST THAT NAMES ITS WORLD HONESTLY STILL SERIALIZES ON IT. This
    // is the behaviour the finding said was already correct, and the correction
    // must not have traded it away: the publisher takes the Shared World row
    // FOR SHARE and therefore queues behind the deletion holding it FOR UPDATE,
    // holding nothing of that World while it waits - which is why it is a queue
    // and not a cycle.
    await deleter.actAsX(fixture.author);
    await deleter.qx('BEGIN');
    await deleter.qx('SELECT 1 FROM public.shared_worlds WHERE id = $1 FOR UPDATE', [fixture.world]);

    await publisher.actAsX(fixture.publisher);
    await publisher.qx('BEGIN');
    const honest = publisher.qx(
      `SELECT outcome FROM public.prepare_public_experience_manifest_v1($1,$2,$3,$4,
         ARRAY[]::uuid[], ARRAY[]::uuid[], $5::uuid[], $6::uuid[], $7::uuid[])`,
      [randomUUID(), fixture.experience, randomUUID(), randomUUID(),
        [randomUUID()], [fixture.world], [fixture.source]]).catch((error) => error);
    assert.equal(await rt.waitForLockWait(q, publisher.pid), true,
      'C06 an honest request queues on the exact Shared World row the deletion holds');
    await deleter.qx('ROLLBACK');
    const honestOutcome = await honest;
    assert.notEqual(honestOutcome?.code, '40P01', 'C06 and then proceeds rather than deadlocking');
    assert.notEqual(honestOutcome?.code, '55P03', 'C06 without timing out');
    await publisher.qx('ROLLBACK').catch(() => undefined);

    // C07 AND AN UNRELATED WORLD IS NOT DELAYED BY ANY OF IT.
    await deleter.actAsX(fixture.author);
    await deleter.qx('BEGIN');
    await deleter.qx('SELECT 1 FROM public.shared_worlds WHERE id = $1 FOR UPDATE', [fixture.world]);
    await publisher.actAsX(fixture.publisher);
    const unrelated = await settlesWithin(publisher.qx(
      `SELECT outcome FROM public.commit_shared_world_human_text_v1($1,$2,$3,$4,$5)`,
      [randomUUID(), fixture.otherWorld, randomUUID(), randomUUID(), 'a statement in an unrelated World'])
      .catch((error) => error), 5000);
    assert.equal(unrelated.settled, true,
      'C07 work in a different Shared World is not blocked by a deletion holding another one');
    assert.notEqual(unrelated.value?.code, '40P01', 'C07 and never deadlocks against it');
    await deleter.qx('ROLLBACK');
    await publisher.qx('ROLLBACK').catch(() => undefined);
  });

  await report.section(`C04 ASSURE-F04 on real PostgreSQL: REPRODUCED before the correction, ${verdict} after it`, async () => {
    const deadlocksAfter = Number((await rows(
      "SELECT COALESCE(sum(deadlocks),0)::int n FROM pg_stat_database WHERE datname = current_database()"))[0].n);
    const counted = deadlocksAfter - deadlocksBefore;
    console.log(`  ASSURE-F04 verdict before the correction : REPRODUCED (focused run on the pre-correction head)`);
    console.log(`  ASSURE-F04 verdict after the correction  : ${verdict}`);
    console.log(`  ASSURE-F04 evidence                      : ${evidence}`);
    console.log(`  pg_stat_database deadlocks during the attempt: ${counted}`);
    // PostgreSQL'S OWN ACCOUNTING IS THE WITNESS, not the absence of an error we
    // happened to catch: a cycle that closed would be counted here even if some
    // wrapper had swallowed the 40P01.
    assert.equal(counted, 0,
      'C04 the reproduced cycle closes no more: PostgreSQL counted no deadlock during the attack');
    assert.equal(verdict, 'CYCLE BROKEN', 'C04 and neither transaction observed one');
  });

  return { verdict, evidence };
}

/** The COMMITTED fixture the three-connection race needs, and its exact teardown. */
async function provisionCycleFixture(author, publisher) {
  await asRole('postgres');
  const w = await seedStandardWorld([author]);
  const other = await seedStandardWorld([publisher]);

  // X is a human statement its author may delete; Y is the QANDEEL derivative
  // that reproduces it. The ids are drawn until Y sorts BELOW X, which is the
  // coin flip the finding depends on and which a fixture must not leave to chance.
  let source = randomUUID();
  let target = randomUUID();
  while (!(target < source)) { source = randomUUID(); target = randomUUID(); }

  await actAs(author);
  const [said] = await rows(
    `SELECT outcome, committed_material_id, committed_history_item_id
       FROM public.commit_shared_world_human_text_v1($1,$2,$3,$4,$5)`,
    [randomUUID(), w.world, source, randomUUID(), 'a statement that a later analysis reproduces']);
  assert.equal(said.outcome, 'MATERIAL_COMMITTED', 'cycle fixture: the source material committed');
  await asRole('postgres');
  const body = 'an analysis that reproduces the statement';
  const evidence = evidenceFor(body, 'rem01-cycle', await rt.audienceSnapshotRef(w.world));
  const [derived] = await rows(
    `SELECT outcome FROM public.commit_shared_world_qandeel_material_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [randomUUID(), w.world, target, randomUUID(), 'QANDEEL_ANALYSIS', body,
      evidence.effectiveContextRef, evidence.outputDigest, evidence.sourceDisclosureGateRef,
      evidence.authorityRevalidationRef, evidence.readiness, evidence.audienceSnapshotRef,
      [source], []]);
  assert.equal(derived.outcome, 'MATERIAL_COMMITTED', 'cycle fixture: the derivative committed');

  await actAs(publisher);
  await ensureIdentity(randomUUID(), randomUUID(), 'PSEUDONYM', 'the foreign publisher');
  const experience = randomUUID();
  await createDraft(randomUUID(), experience);
  await asRole('postgres');

  return {
    author, publisher, world: w.world, otherWorld: other.world, experience,
    source, target, sourceItem: said.committed_history_item_id,
  };
}

async function removeCycleFixture(fixture, humans) {
  await asRole('postgres');
  const worlds = [fixture.world, fixture.otherWorld];
  await q('DELETE FROM public.publication_package_prepare_commands WHERE experience_id = $1', [fixture.experience]);
  await q('DELETE FROM public.public_experience_lifecycle_events WHERE experience_id = $1', [fixture.experience]);
  await q('DELETE FROM public.public_experience_draft_commands WHERE experience_id = $1', [fixture.experience]);
  await q('DELETE FROM public.public_experience_controllers WHERE experience_id = $1', [fixture.experience]);
  await q('DELETE FROM public.public_experiences WHERE id = $1', [fixture.experience]);
  await q('DELETE FROM public.public_identity_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
  await q('DELETE FROM public.public_identity_display_state WHERE user_id = ANY($1::uuid[])', [humans]);
  await q('DELETE FROM public.public_identities WHERE user_id = ANY($1::uuid[])', [humans]);
  const materials = `(SELECT m.id FROM ${D.MATERIALS} m WHERE m.world_id = ANY($1::uuid[]))`;
  await q(`DELETE FROM public.shared_world_material_delete_commands WHERE material_id IN ${materials}`, [worlds]);
  await q(`DELETE FROM public.shared_world_material_deleted_events WHERE material_id IN ${materials}`, [worlds]);
  await q(`DELETE FROM ${AUTHORITY} WHERE world_id = ANY($1::uuid[])`, [worlds]);
  await q(`DELETE FROM ${DEPENDENCIES} WHERE world_id = ANY($1::uuid[])`, [worlds]);
  await q(`DELETE FROM public.shared_world_text_material_bodies WHERE material_id IN ${materials}`, [worlds]);
  await q(`DELETE FROM public.shared_world_voice_note_material_bodies WHERE material_id IN ${materials}`, [worlds]);
  await q(`DELETE FROM public.shared_world_qandeel_material_evidence WHERE world_id = ANY($1::uuid[])`, [worlds]);
  await q(`DELETE FROM public.shared_world_material_commit_commands WHERE world_id = ANY($1::uuid[])`, [worlds]);
  await q(`DELETE FROM ${D.MATERIALS} WHERE world_id = ANY($1::uuid[])`, [worlds]);
  const items = `(SELECT i.id FROM ${D.ITEMS} i WHERE i.world_id = ANY($1::uuid[]))`;
  await q(`DELETE FROM ${D.APPROVERS} WHERE history_item_id IN ${items}`, [worlds]);
  await q(`DELETE FROM ${D.VIEWERS} WHERE history_item_id IN ${items}`, [worlds]);
  await q(`DELETE FROM ${D.ITEMS} WHERE world_id = ANY($1::uuid[])`, [worlds]);
  await q(`DELETE FROM ${D.EPISODES} WHERE world_id = ANY($1::uuid[])`, [worlds]);
  await q(`DELETE FROM ${D.WORLDS} WHERE id = ANY($1::uuid[])`, [worlds]);
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
const cycleHumans = [randomUUID(), randomUUID()];
let cycleVerdict = { verdict: 'NOT RUN', evidence: '' };

await runVerifier('0119', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '60s'");

  setStage('fixtures');
  await rt.provisionHumans([...humans, ...cycleHumans]);

  // POSTURE IS A RECORDED SCENARIO RATHER THAN A FAIL-FAST PRELUDE. A posture
  // failure that aborted the run would turn every other latent defect into its
  // own CI round, which is the exact cost this repository's scenario report
  // exists to remove - and a verifier written against a database this host
  // cannot run is written blind, so every round has to carry all of its news.
  const report = createScenarioReport('0119', { query: q, restore: () => asRole('postgres') });
  setStage('posture');
  await report.section('P01 posture: signatures, the corrected resolution, every consumer and the ACLs', verifyPosture);
  const seams = [];
  for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    seams.push(await rt.captureMatchingSeam(fn));
  }
  try {
    setStage('producer');
    await verifyProducer(report, humans);
    setStage('reconciliation');
    await verifyReconciliation(report, humans);
    setStage('historical widening');
    await verifyHistoricalWidening(report, humans);
    setStage('public downstream');
    await verifyPublicDownstream(report, humans);

    setStage('introduction');
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla' });
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    await verifyIntroduction(report, humans);
  } finally {
    await asRole('postgres');
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }

  // ASSURE-F04 comes LAST, because it is the only section whose fixtures really
  // commit: three connections must be able to see the same rows.
  setStage('ASSURE-F04 cross-World lock cycle');
  let fixture = null;
  try {
    fixture = await provisionCycleFixture(cycleHumans[0], cycleHumans[1]);
    cycleVerdict = await verifyLockCycle(report, fixture);
  } finally {
    if (fixture) await removeCycleFixture(fixture, cycleHumans);
  }

  report.print();
  console.log(`0119 ASSURE-F04 verdict: ${cycleVerdict.verdict} (${cycleVerdict.evidence})`);
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  for (const seam of ['public.resolve_introduction_disclosure_prerequisites_v1',
    'public.resolve_introduction_success_prerequisites_v1',
    'public.resolve_matching_reactivation_prerequisites_v1']) {
    assert.equal(await rt.seamClearance(seam), 'NOT_EVALUATED', `${seam} is fail-closed again after the run`);
  }
  const [{ prosrc: publicSeam }] = await rows(
    'SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [PUBLIC_SEAM]);
  assert.match(publicSeam, /NOT_EVALUATED/u, 'the CW2-08 Public seam is fail-closed again after the run');
  assert.doesNotMatch(publicSeam, /'CLEARED'/u, 'and answers CLEARED to nobody');

  await rt.removeFixtureHumans([...humans, ...cycleHumans]);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${D.MATERIALS}) + (SELECT count(*) FROM ${D.ITEMS})
          + (SELECT count(*) FROM ${AUTHORITY}) + (SELECT count(*) FROM ${DEPENDENCIES})
          + (SELECT count(*) FROM ${MANIFESTS}) + (SELECT count(*) FROM ${GRANTS})
          + (SELECT count(*) FROM public.shared_world_material_commit_commands) AS residue`);
  assert.equal(Number(residue), 0, 'no fixture row of any kind remains after the run');
  const [{ n: unproven }] = await rows(
    `SELECT count(*) n FROM ${AUTHORITY} WHERE resolution_state = 'RESOLVED_NO_HUMAN_REQUIREMENT'`);
  assert.equal(Number(unproven), 0, 'and nothing records a human requirement this repository never proved empty');
}, async () => {
  await rt.client.end().catch(() => undefined);
});
