// Real-PostgreSQL verifier for migration 0115 - I-07D Introduction progressive
// disclosure and Introduction historical visibility.
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live rows, that one human can disclose one exact resource to their exact
// counterpart and to nobody else, that the disclosure is real Shared history
// the owner still owns, that nothing about it is reciprocal or reusable, and
// that the ONE canonical historical visibility entry point learned Introduction
// without changing a single Standard answer.
//
// Every fixture reaches a live ACTIVE / INTRODUCTION World through the REAL
// I-07A, I-07B and I-07C boundaries as the humans involved - never by a direct
// write. Every seam replaced for the run is restored byte for byte on every
// path.
//
//   P01 posture: the seven relations are sealed and policy-free; the disclosure
//       command is postgres-owned SECURITY DEFINER, search_path-pinned and
//       executable by no application role; it accepts no counterpart, owner,
//       actor, audience or clock parameter; the read resolver is service_role
//       only and composes the ONE entry point; the entry point is still the ONE
//       server-role historical visibility boundary and the closed reader is
//       still internal to everybody; the live producer censuses hold
//
//   PD01 an owner discloses FULL_NAME and the exact counterpart resolves it
//   PD02 a third human and a non-member resolve nothing
//   PD03 the counterpart cannot manufacture the owner's disclosure
//   PD04 A's disclosure creates NO reciprocal B authority, resource or event
//   PD05 the reverse disclosure exists only after B explicitly acts
//   PD06 PARTIAL_IMAGE and FULL_IMAGE are two independent resource versions
//   PD07 a partial image authorizes no full image
//   PD08 a text resource cannot carry a media payload
//   PD09 an image resource cannot carry a text payload
//   PD10 an equivalent retry is exactly idempotent and creates nothing
//   PD11 the same command id naming a different resource or payload fails closed
//   PD12 disclosure is refused outside ACTIVE / INTRODUCTION
//   PD13 the production CW2-08 seam refuses with ZERO effects
//   PD14 owner deletion destroys the payload and the effective visibility
//   PD15 a later authority or profile change erases no delivered history
//   PD16 no Matching Context Grant and no private Matching reasoning crosses
//   PD17 the exact audience is owner + counterpart, and the exact authority is
//        the owner alone
//   PD18 no generic contact route or pre-Match path is created
//
//   V01 ACTIVE / INTRODUCTION returns the exact baseline-audience conjunction
//   V02 a human with no open episode gets a truthful empty answer
//   V03 availability dominates the Introduction branch
//   V04 ACTIVE / STANDARD is unchanged, grant basis included
//   V05 READ_ONLY_CLOSED / INTRODUCTION consults no active membership
//   V06 an unspelled World mode is still refused
//
//   G01 NO GHOST: a late transactional failure leaves ZERO surviving effects
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createIntroductionRuntime, D, DFN, I07D_DISCLOSURE_TABLES, I07D_GUARDS, I07D_SEAM_PARAMETERS,
  DISCLOSURE_COLUMNS, I07D_RESULT_BAN, RESOURCE_TYPES, TEXT_RESOURCE_TYPES, IMAGE_RESOURCE_TYPES,
  disclosureIds, mediaRef, runVerifier, APP_ROLES, PFN,
} from './introduction-lifecycle-verifier-support.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const INVALID = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONTRADICTORY = ['P0001'];
const CONFLICT = ['23505'];
const REFUSED = ['55000'];
const CHECK_VIOLATION = ['23514'];
const FK_VIOLATION = ['23503'];
const UNSUPPORTED = ['0A000'];

/** Strips `--` comment lines, so a positional assertion cannot be satisfied by prose. */
const stripComments = (source) => source.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n');

/** A disclosure produced nothing: every semantic cardinality is zero. */
const NOTHING = Object.freeze({
  commands: 0, versions: 0, texts: 0, media: 0, grants: 0, materials: 0,
  items: 0, viewers: 0, approvers: 0, provenance: 0, authority: 0,
});

/** One text disclosure produced everything exactly once. */
const TEXT_DELIVERED = Object.freeze({
  commands: 1, versions: 1, texts: 1, media: 0, grants: 1, materials: 1,
  items: 1, viewers: 2, approvers: 1, provenance: 1, authority: 1,
});

/** One image disclosure produced everything exactly once. */
const MEDIA_DELIVERED = Object.freeze({ ...TEXT_DELIVERED, texts: 0, media: 1 });

// ------------------------------------------------------------------ 1. posture
async function verifyPosture() {
  await asRole('postgres');

  // THE SEVEN RELATIONS: sealed, policy-free, blob-free.
  for (const table of I07D_DISCLOSURE_TABLES) {
    const [{ rls, owner }] = await rows(
      'SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(rls, true, `P01 ${table} has RLS enabled`);
    assert.equal(owner, 'postgres', `P01 ${table} is postgres-owned`);
    const [{ policies }] = await rows('SELECT count(*) policies FROM pg_policy WHERE polrelid = $1::regclass', [table]);
    assert.equal(Number(policies), 0, `P01 ${table} carries zero policies`);
    for (const role of ['public', ...APP_ROLES]) {
      const [{ any_privilege }] = await rows(
        `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) any_privilege
           FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p`, [role, table]);
      assert.equal(any_privilege, false, `P01 ${role} holds no privilege on ${table}`);
    }
    const [{ blobs }] = await rows(
      `SELECT count(*) blobs FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND ('public.' || c.table_name) = $1
          AND c.data_type IN ('json','jsonb','ARRAY','bytea')`, [table]);
    assert.equal(Number(blobs), 0, `P01 ${table} carries no JSON, array or binary payload`);
  }

  // THE DISCLOSURE COMMAND.
  await rt.verifyPosture({ internal: [DFN.DISCLOSE] });
  const command = await rt.functionPosture(DFN.DISCLOSE);
  assert.equal(command.volatility, 'v', 'P01 the disclosure command is VOLATILE');
  assert.ok(command.prosrc.includes('u uuid := auth.uid();'), 'P01 the owner is derived from auth.uid()');
  const inputs = await rt.inputParameters(DFN.DISCLOSE);
  assert.deepEqual(inputs, ['p_command_id', 'p_world_id', 'p_resource_version_id', 'p_material_id',
    'p_history_item_id', 'p_disclosure_granted_event_id', 'p_resource_type', 'p_field_key',
    'p_text_value', 'p_media_object_ref'], 'P01 the disclosure command accepts exactly the frozen v1 surface');
  for (const name of inputs) {
    assert.doesNotMatch(name, /counterpart|recipient|audience|viewer|owner|actor|user_id|human|subject|grantee|grantor|on_behalf|approver|episode|authority|count|timestamp|instant|_at$|clock|launch|gate/u,
      `P01 the disclosure command must not accept ${name}: the owner is auth.uid() and the counterpart is derived`);
  }
  const outputs = await rt.resultColumns(DFN.DISCLOSE);
  for (const column of outputs) {
    assert.doesNotMatch(column, I07D_RESULT_BAN, `P01 the disclosure command must not return ${column}`);
  }

  // The published order, over the comment-stripped body.
  const body = stripComments(command.prosrc);
  const at = (needle) => {
    const position = body.indexOf(needle);
    assert.ok(position >= 0, `P01 the disclosure command carries ${needle}`);
    return position;
  };
  const world = at('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE');
  const record = at('WHERE r.world_id = p_world_id FOR UPDATE');
  const derived = at('counterpart := CASE WHEN u = record_row.lower_user_id');
  const gate = at('resolve_introduction_disclosure_prerequisites_v1');
  const clock = at('disclose_at := clock_timestamp()');
  const write = at('INSERT INTO public.shared_world_history_items');
  assert.ok(world < record && record < derived && derived < gate && gate < clock && clock < write,
    'P01 the command locks the World, then the exact Record, derives the counterpart, gates last, captures one instant, then writes');
  assert.equal(body.split('clock_timestamp()').length - 1, 1, 'P01 exactly one instant is captured');
  assert.doesNotMatch(body, /now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp/iu,
    'P01 the captured instant is the only clock the command reads at all');
  // DISCLOSURE IS SHARED-WORLD-LOCAL: no Matching lock and no Matching state.
  assert.doesNotMatch(body, /matching_setup_locks|pg_advisory|LOCK TABLE/u,
    'P01 disclosure takes no Matching setup lock, no advisory lock and no table lock');
  assert.doesNotMatch(body, /matching_context_grants|pre_match_disclosure|matching_proposal|matching_recipient|matching_private|matching_participation/u,
    'P01 no Matching authority, proposal, private reasoning or participation state crosses into Shared disclosure');
  assert.doesNotMatch(body, /shared_world_standing_context_grants/u,
    'P01 a disclosure manufactures no Shared Standing Context Grant');
  assert.doesNotMatch(body, /DELETE FROM|TRUNCATE/u, 'P01 a disclosure destroys nothing');
  assert.ok(body.includes("'EXPLICIT_DISCLOSURE', 'HUMAN', 'RESERVED'"),
    'P01 the producer writes exactly the reserved 0089 envelope');

  // THE READ RESOLVER: composed, bounded, service_role only.
  const resolver = await rt.functionPosture(DFN.RESOLVE_DISCLOSURE);
  assert.equal(resolver.owner, 'postgres', 'P01 the disclosure resolver is postgres-owned');
  assert.equal(resolver.secdef, true, 'P01 the disclosure resolver is SECURITY DEFINER');
  assert.equal(resolver.volatility, 's', 'P01 the disclosure resolver is STABLE');
  assert.ok(resolver.prosrc.includes('public.resolve_shared_world_history_visibility_v1(p_world_id, p_user_id)'),
    'P01 the disclosure resolver CONSUMES the ONE canonical visibility entry point');
  assert.doesNotMatch(resolver.prosrc, /matching_|introduction_records|introduction_disclosure_commands|shared_world_material_dependencies|shared_world_membership_episodes/u,
    'P01 the disclosure resolver discloses no Matching state, no command history, no provenance and no membership');
  assert.deepEqual(await rt.resultColumns(DFN.RESOLVE_DISCLOSURE), DISCLOSURE_COLUMNS,
    'P01 the disclosure resolver returns exactly the bounded renderable disclosure');
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.equal(await rt.canExecute(role, DFN.RESOLVE_DISCLOSURE), false,
      `P01 ${role} must not execute the disclosure resolver`);
  }
  assert.equal(await rt.canExecute('service_role', DFN.RESOLVE_DISCLOSURE), true,
    'P01 service_role executes the ONE narrow disclosure resolver');

  // THE ONE ENTRY POINT is still the ONE, and the closed reader is still internal.
  assert.equal(await rt.canExecute('service_role', DFN.VISIBILITY), true,
    'P01 service_role still executes the ONE historical visibility entry point');
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.equal(await rt.canExecute(role, DFN.VISIBILITY), false, `P01 ${role} must not execute the entry point`);
  }
  for (const role of ['public', ...APP_ROLES]) {
    assert.equal(await rt.canExecute(role, DFN.CLOSED_VISIBILITY), false,
      `P01 ${role} must not execute the internal closed reader: there is ONE entry point`);
  }
  const entry = await rt.functionPosture(DFN.VISIBILITY);
  assert.equal(entry.volatility, 's', 'P01 the entry point is still STABLE');
  assert.doesNotMatch(entry.prosrc, /INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt/u,
    'P01 the entry point still mutates nothing, locks nothing and trusts no client claim');
  assert.match(entry.prosrc, /i\.availability_state = 'AVAILABLE'/u, 'P01 availability still dominates every mode');
  assert.match(entry.prosrc, /shared_world_history_item_baseline_viewers/u,
    'P01 a membership interval alone is still never historical visibility');
  assert.equal(entry.prosrc.split('shared_world_history_package_manifest_items').length - 1, 1,
    'P01 the explicit history-grant basis belongs to STANDARD alone, exactly once');
  const closed = await rt.functionPosture(DFN.CLOSED_VISIBILITY);
  assert.match(closed.prosrc, /shared_world_standard_closed_view_entitlement_items/u,
    'P01 the Standard closed branch is preserved exactly');
  assert.match(closed.prosrc, /introduction_closed_view_entitlement_items/u,
    'P01 the closed reader carries the reviewed Introduction branch');
  assert.doesNotMatch(closed.prosrc, /shared_world_membership_episodes/u,
    'P01 closed viewing is entitlement, never active membership, in either mode');

  // OWNER DELETION learned exactly one branch and lost nothing.
  const deletion = await rt.functionPosture(DFN.DELETE_MATERIAL);
  const deletes = [...deletion.prosrc.matchAll(/DELETE FROM public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual([...new Set(deletes)].sort(),
    ['introduction_disclosure_media_payloads', 'introduction_disclosure_text_payloads',
      'shared_world_text_material_bodies', 'shared_world_voice_note_material_bodies'],
    'P01 every DELETE owner deletion issues targets a material body or a disclosure payload, and nothing else');
  assert.match(deletion.prosrc, /owned\.material_kind = 'EXPLICIT_DISCLOSURE'/u,
    'P01 the new owner-deletion branch names the exact reserved kind');
  assert.doesNotMatch(deletion.prosrc, /WORLD_EVENT_DERIVED_MATERIAL/u,
    'P01 no OTHER reserved material kind became deletable through guessed semantics');
  assert.doesNotMatch(deletion.prosrc, /SET lifecycle|SET phase|SET closed_at/u,
    'P01 a privacy material mutation still never reopens or changes World lifecycle');

  // THE SEAM answers NOT_EVALUATED and nothing else.
  const [seam] = await rows(`SELECT * FROM ${DFN.DISCLOSURE_GATE.replace(/\(.*\)$/u, '')}($1)`, [randomUUID()]);
  assert.equal(seam.clearance, 'NOT_EVALUATED', 'P01 the disclosure prerequisite seam is fail-closed in production');

  // EXACTLY ONE LIVE PRODUCER of the reserved material kind.
  const producers = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND pr.prosrc ~ '''EXPLICIT_DISCLOSURE''' AND pr.prosrc ~ 'INSERT INTO public\\.shared_world_materials'
      ORDER BY 1`);
  assert.deepEqual(producers.map((r) => r.proname), ['commit_introduction_progressive_disclosure_v1'],
    'P01 exactly the reviewed I-07D producer writes an EXPLICIT_DISCLOSURE material');

  // THE COMPOSITION CONSEQUENCE, asserted rather than assumed.
  //
  // Extending the ONE canonical entry point necessarily widens what every
  // consumer that COMPOSES it can see, because that is what composing it means.
  // Three consumers exist, and each is checked here rather than left to be
  // discovered: the I-04G material resolver, the I-06A Replay Shared-source
  // adapter and the I-06D current-eligibility derivation.
  //
  // The material resolver is the important one, and it is safe by construction:
  // it returns a material only when a TEXT or VOICE_NOTE body row exists, and an
  // EXPLICIT_DISCLOSURE carries neither - its body form is RESERVED and no 0089
  // body relation accepts that form. So the generic material read boundary can
  // never render a disclosure payload, whatever the entry point now answers.
  const material = await rt.functionPosture('public.resolve_shared_world_material_v1(uuid, uuid)');
  assert.match(material.prosrc, /public\.resolve_shared_world_history_visibility_v1\(p_world_id, p_user_id\)/u,
    'P01 the I-04G material resolver still composes the ONE entry point, unchanged');
  assert.match(material.prosrc, /t\.material_id IS NOT NULL OR v\.material_id IS NOT NULL/u,
    'P01 and still returns only a material that has a TEXT or VOICE_NOTE body');
  assert.doesNotMatch(material.prosrc, /introduction_disclosure/u,
    'P01 so a RESERVED-bodied EXPLICIT_DISCLOSURE can never be rendered through the generic material boundary');
  // Every OTHER live consumer of the entry point is named, so the composition
  // is a known set rather than a surprise. Each one still composes it unchanged
  // - this slice replaced the entry point's body, not any caller - and each
  // keeps whatever fail-closed gate it already had.
  const consumers = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public'
        AND pr.prosrc ~ 'public\\.resolve_shared_world_history_visibility_v1\\('
        AND pr.proname <> 'resolve_shared_world_history_visibility_v1' ORDER BY 1`);
  assert.deepEqual(consumers.map((r) => r.proname), [
    'commit_introduction_end_v1',
    'commit_shared_world_standard_end_v1',
    'derive_replay_source_manifest_currency_v1',
    'prepare_public_experience_manifest_v1',
    'publish_public_experience_v1',
    'replay_capture_source_manifest_v1',
    'resolve_shared_world_introduction_disclosure_v1',
    'resolve_shared_world_material_v1',
  ], 'P01 the consumers of the ONE entry point are exactly this known set, and the set is what the extension widens');
  // The two Public consumers are the reason the disclosure producer records an
  // EXACT material authority rather than none: whatever those boundaries can now
  // SEE, they can only ever publish with the exact owner's approval, because the
  // required-approver set of a disclosure item is the owner and nobody else.
  // PD17 proves that set on real rows; this proves the authority relation it
  // feeds is the one those boundaries actually derive from.
  const [{ derives }] = await rows(
    `SELECT count(*)::int derives FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.proname = 'derive_public_publication_authority_v1'
        AND pr.prosrc ~ 'shared_world_history_item_required_approvers'`);
  assert.equal(derives, 1,
    'P01 Public publication authority is still derived from the exact required-approver set a disclosure item carries');

  // THE FROZEN 0089 ENVELOPE still reserves the kind's body form.
  const [{ definition }] = await rows(
    `SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c
      WHERE c.conrelid = 'public.shared_world_materials'::regclass
        AND c.conname = 'shared_world_materials_body_form_check'`);
  assert.match(definition, /EXPLICIT_DISCLOSURE/u, 'P01 EXPLICIT_DISCLOSURE keeps its frozen RESERVED body form');
  assert.match(definition, /RESERVED/u, 'P01 and RESERVED is still what that kind carries');
}

// ------------------------------------------------- 2. progressive disclosure
async function verifyDisclosure(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('PD01 an owner discloses FULL_NAME and the exact counterpart resolves it', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const { ids, answer } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.equal(answer.outcome, 'DISCLOSURE_GRANTED', 'PD01 the disclosure is delivered');
      assert.equal(answer.disclosed_resource_type, 'FULL_NAME', 'PD01 carrying the exact resource type');
      assert.deepEqual(await rt.disclosureEffects(ids), TEXT_DELIVERED,
        'PD01 exactly one of everything: version, payload, grant fact, material, item, audience, authority, provenance');
      const seen = await rt.resolveDisclosure(f.world, f.higher);
      assert.equal(seen.length, 1, 'PD01 the exact counterpart resolves exactly one disclosure');
      assert.equal(seen[0].text_value, 'Sara Kamel', 'PD01 and reads the exact disclosed value');
      assert.equal(seen[0].owner_user_id, f.lower, 'PD01 attributed to the exact owner');
      assert.equal(seen[0].media_object_ref, null, 'PD01 with no media reference on a text resource');
      // The owner sees their own disclosure too: they are in its baseline audience.
      assert.equal((await rt.resolveDisclosure(f.world, f.lower)).length, 1,
        'PD01 the owner resolves their own delivered disclosure');
      const material = await rt.materialRow(ids.material);
      assert.deepEqual([material.material_kind, material.producer_kind, material.body_form, material.author_user_id],
        ['EXPLICIT_DISCLOSURE', 'HUMAN', 'RESERVED', f.lower],
        'PD01 the Shared material is the reserved kind, produced by the exact human owner, with no generic body');
    });

    await report.isolated('PD02 a third human and a non-member resolve nothing', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.deepEqual(await rt.resolveDisclosure(f.world, three), [],
        'PD02 a human who is not in this Introduction resolves nothing at all');
      assert.deepEqual(await rt.visibility(f.world, three), [],
        'PD02 and the canonical entry point gives them a truthful empty answer rather than a distinguishable error');
    });

    await report.isolated('PD03 the counterpart cannot manufacture the owneru{2019}s disclosure', async () => {
      const f = await rt.bringToIntroduction(one, two);
      // The counterpart CAN disclose - as themselves. What they cannot do is
      // produce a resource owned by the other human, because the owner is
      // auth.uid() and there is no owner parameter to supply.
      const { ids } = await rt.discloseAs(f.higher, f.world, 'FULL_NAME', { text: 'Omar Hadi' });
      const version = await rt.versionRow(ids.version);
      assert.equal(version.owner_user_id, f.higher, 'PD03 a disclosure is owned by the human who made it');
      assert.equal(version.counterpart_user_id, f.lower, 'PD03 and its counterpart is the derived other human');
      assert.equal(await count(D.VERSIONS, 'id = $1 AND owner_user_id = $2', [ids.version, f.lower]), 0,
        'PD03 no command shape can name the other human as owner');
    });

    await report.isolated('PD04 Au{2019}s disclosure creates NO reciprocal B authority, resource or event', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'CONTACT_METHOD', { text: '+20 100 000 0000' });
      assert.equal(await count(D.VERSIONS, 'world_id = $1 AND owner_user_id = $2', [f.world, f.higher]), 0,
        'PD04 the counterpart owns no resource version');
      assert.equal(await count(D.GRANTS, 'world_id = $1 AND owner_user_id = $2', [f.world, f.higher]), 0,
        'PD04 and granted nothing');
      assert.equal(await count(D.COMMANDS, 'world_id = $1 AND owner_user_id = $2', [f.world, f.higher]), 0,
        'PD04 and issued no command');
      assert.equal(await count(D.VERSIONS, 'world_id = $1', [f.world]), 1,
        'PD04 exactly one resource version exists in this Introduction, in one direction');
      assert.equal(await requiredApproverCount(ids.item, f.higher), 0,
        'PD04 receiving a disclosure creates no material authority over it');
    });

    await report.isolated('PD05 the reverse disclosure exists only after B explicitly acts', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.equal(await count(D.VERSIONS, 'world_id = $1 AND owner_user_id = $2', [f.world, f.higher]), 0,
        'PD05 before B acts there is no reverse resource');
      const { ids } = await rt.discloseAs(f.higher, f.world, 'FULL_NAME', { text: 'Omar Hadi' });
      assert.equal(await count(D.VERSIONS, 'world_id = $1 AND owner_user_id = $2', [f.world, f.higher]), 1,
        'PD05 and after B explicitly acts there is exactly one');
      assert.equal((await rt.versionRow(ids.version)).counterpart_user_id, f.lower,
        'PD05 pointing the other way, as its own independent delivery');
      const forLower = await rt.resolveDisclosure(f.world, f.lower);
      assert.equal(forLower.length, 2, 'PD05 each human now sees both deliveries, because both are Shared history');
    });

    await report.isolated('PD06 PARTIAL_IMAGE and FULL_IMAGE are two independent resource versions', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const partialRef = mediaRef('partial');
      const fullRef = mediaRef('full');
      const partial = await rt.discloseAs(f.lower, f.world, 'PARTIAL_IMAGE', { media: partialRef });
      const full = await rt.discloseAs(f.lower, f.world, 'FULL_IMAGE', { media: fullRef });
      assert.deepEqual(await rt.disclosureEffects(partial.ids), MEDIA_DELIVERED, 'PD06 the partial image is one delivery');
      assert.deepEqual(await rt.disclosureEffects(full.ids), MEDIA_DELIVERED, 'PD06 the full image is another');
      assert.notEqual(partial.ids.version, full.ids.version, 'PD06 they are two distinct resource versions');
      const seen = await rt.resolveDisclosure(f.world, f.higher);
      assert.deepEqual(seen.map((r) => r.resource_type).sort(), ['FULL_IMAGE', 'PARTIAL_IMAGE'],
        'PD06 and the counterpart sees exactly the two types that were disclosed');
      assert.deepEqual(seen.map((r) => r.media_object_ref).sort(), [fullRef, partialRef].sort(),
        'PD06 each carrying its own opaque media object reference');
      for (const row of seen) {
        assert.doesNotMatch(row.media_object_ref, /:\/\/|[?#]/u, 'PD06 a media reference is never a URL');
        assert.equal(row.text_value, null, 'PD06 and an image resource carries no text value');
      }
    });

    await report.isolated('PD07 a partial image authorizes no full image', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await rt.discloseAs(f.lower, f.world, 'PARTIAL_IMAGE', { media: mediaRef('partial') });
      const seen = await rt.resolveDisclosure(f.world, f.higher);
      assert.deepEqual(seen.map((r) => r.resource_type), ['PARTIAL_IMAGE'],
        'PD07 disclosing a partial image discloses exactly a partial image');
      assert.equal(await count(D.VERSIONS, "world_id = $1 AND resource_type = 'FULL_IMAGE'", [f.world]), 0,
        'PD07 and creates no full-image version, because there is no authority object spanning the two');
    });

    await report.isolated('PD08 a text resource cannot carry a media payload', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await actAs(f.lower);
      for (const type of TEXT_RESOURCE_TYPES) {
        const ids = disclosureIds();
        await rejected(() => rt.disclose(ids, f.world, type, { media: mediaRef('wrong'), fieldKey: type === 'DEEPER_PERSONAL_FIELD' ? 'life_stage' : null }),
          INVALID, /INTRODUCTION_DISCLOSURE_COMMAND_INVALID/u);
      }
      await asRole('postgres');
      // And the schema refuses it too, however the row is produced: a media
      // payload composite-binds a version whose type is an image type, so a
      // text version can carry neither its own type nor an image one.
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await rejected(() => q(`INSERT INTO ${D.MEDIA} (resource_version_id, resource_type, media_object_ref)
                              VALUES ($1, 'FULL_NAME', $2)`, [ids.version, mediaRef('forced')]),
        CHECK_VIOLATION, /media_payloads_type_check/u);
      await rejected(() => q(`INSERT INTO ${D.MEDIA} (resource_version_id, resource_type, media_object_ref)
                              VALUES ($1, 'FULL_IMAGE', $2)`, [ids.version, mediaRef('forced')]),
        FK_VIOLATION, /media_payloads_version_fk/u);
    });

    await report.isolated('PD09 an image resource cannot carry a text payload', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await actAs(f.lower);
      for (const type of IMAGE_RESOURCE_TYPES) {
        const ids = disclosureIds();
        await rejected(() => rt.disclose(ids, f.world, type, { text: 'not an image' }),
          INVALID, /INTRODUCTION_DISCLOSURE_COMMAND_INVALID/u);
      }
      await asRole('postgres');
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_IMAGE', { media: mediaRef('full') });
      await rejected(() => q(`INSERT INTO ${D.TEXT} (resource_version_id, resource_type, field_key, text_value)
                              VALUES ($1, 'FULL_IMAGE', NULL, 'forced')`, [ids.version]),
        CHECK_VIOLATION, /text_payloads_type_check/u);
      await rejected(() => q(`INSERT INTO ${D.TEXT} (resource_version_id, resource_type, field_key, text_value)
                              VALUES ($1, 'FULL_NAME', NULL, 'forced')`, [ids.version]),
        FK_VIOLATION, /text_payloads_version_fk/u);
    });

    await report.isolated('PD10 an equivalent retry is exactly idempotent and creates nothing', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const ids = disclosureIds();
      await actAs(f.lower);
      const [first] = await rt.discloseText(ids, f.world, 'FULL_NAME', 'Sara Kamel');
      const [retry] = await rt.discloseText(ids, f.world, 'FULL_NAME', 'Sara Kamel');
      await asRole('postgres');
      assert.deepEqual(retry, first, 'PD10 the retry is answered from the committed row, byte for byte');
      assert.deepEqual(await rt.disclosureEffects(ids), TEXT_DELIVERED, 'PD10 and creates nothing a second time');
      assert.equal((await rt.resolveDisclosure(f.world, f.higher)).length, 1,
        'PD10 the counterpart still sees exactly one disclosure');
    });

    await report.isolated('PD11 the same command id naming a different resource or payload fails closed', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const ids = disclosureIds();
      await actAs(f.lower);
      await rt.discloseText(ids, f.world, 'FULL_NAME', 'Sara Kamel');
      // A different payload, a different type, a different resource version, a
      // different material, a different history item and a different grant fact
      // are each a different request under the same command id.
      await rejected(() => rt.discloseText(ids, f.world, 'FULL_NAME', 'Somebody Else'),
        CONFLICT, /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
      await rejected(() => rt.discloseText(ids, f.world, 'CONTACT_METHOD', 'Sara Kamel'),
        CONFLICT, /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
      for (const key of ['version', 'material', 'item', 'event']) {
        await rejected(() => rt.discloseText({ ...ids, [key]: randomUUID() }, f.world, 'FULL_NAME', 'Sara Kamel'),
          CONFLICT, /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
      }
      // And the same command id issued by the OTHER human is a different owner.
      await actAs(f.higher);
      await rejected(() => rt.discloseText(ids, f.world, 'FULL_NAME', 'Sara Kamel'),
        CONFLICT, /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
    });

    await report.isolated('PD12 disclosure is refused outside ACTIVE / INTRODUCTION', async () => {
      const f = await rt.bringToIntroduction(one, two);
      // An ordinary Standard World, written directly as the owner: it carries
      // no Introduction Record at all, which is what an Introduction command
      // must refuse.
      const standard = randomUUID();
      await q(`INSERT INTO ${D.WORLDS} (id, lifecycle, phase, birth_basis, born_at)
               VALUES ($1, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', clock_timestamp())`, [standard]);
      await q(`INSERT INTO ${D.EPISODES} (id, world_id, user_id, joined_at)
               VALUES ($1, $2, $3, clock_timestamp())`, [randomUUID(), standard, f.lower]);
      await actAs(f.lower);
      await rejected(() => rt.discloseText(disclosureIds(), standard, 'FULL_NAME', 'Sara Kamel'),
        UNAVAILABLE, /INTRODUCTION_DISCLOSURE_NOT_AVAILABLE/u);
      await rejected(() => rt.discloseText(disclosureIds(), randomUUID(), 'FULL_NAME', 'Sara Kamel'),
        UNAVAILABLE, /INTRODUCTION_DISCLOSURE_NOT_AVAILABLE/u);
      // A human who is not one of the exact two matched humans reaches the SAME
      // bounded class, so this is not a membership or existence oracle.
      await actAs(three);
      await rejected(() => rt.discloseText(disclosureIds(), f.world, 'FULL_NAME', 'Layla Amin'),
        UNAVAILABLE, /INTRODUCTION_DISCLOSURE_NOT_AVAILABLE/u);
      // An archived Introduction World refuses too. The real terminal closure
      // is migration 0116's to produce; what is proven here is the gate.
      await asRole('postgres');
      await q(`UPDATE ${D.WORLDS} SET lifecycle = 'READ_ONLY_CLOSED', closed_at = clock_timestamp() WHERE id = $1`, [f.world]);
      await actAs(f.lower);
      await rejected(() => rt.discloseText(disclosureIds(), f.world, 'FULL_NAME', 'Sara Kamel'),
        UNAVAILABLE, /INTRODUCTION_DISCLOSURE_NOT_AVAILABLE/u);
      await asRole('postgres');
    });

    await report.isolated('PD13 the production CW2-08 seam refuses with ZERO effects', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const seam = await rt.captureMatchingSeam(DFN.DISCLOSURE_GATE);
      try {
        await rt.restoreMatchingSeam(seam);
        // Restore the PRODUCTION definition for this probe, then prove the gate
        // is the LAST one: every authority and privacy gate above it has passed.
        await q(`CREATE OR REPLACE FUNCTION public.resolve_introduction_disclosure_prerequisites_v1(p_world_id uuid)
                 RETURNS TABLE(clearance text, basis text)
                 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $probe$
                 BEGIN
                   RETURN QUERY SELECT 'NOT_EVALUATED'::text, 'probe'::text;
                 END$probe$`);
        const ids = disclosureIds();
        await actAs(f.lower);
        await rejected(() => rt.discloseText(ids, f.world, 'FULL_NAME', 'Sara Kamel'),
          REFUSED, /INTRODUCTION_DISCLOSURE_PREREQUISITE_UNRESOLVED/u);
        await asRole('postgres');
        assert.deepEqual(await rt.disclosureEffects(ids), NOTHING,
          'PD13 a refused disclosure leaves no version, no payload, no grant, no material and no history item');
      } finally {
        await asRole('postgres');
        await rt.clearSeam(I07D_SEAM_PARAMETERS[0]);
      }
    });

    await report.isolated('PD14 owner deletion destroys the payload and the effective visibility', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const kept = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      const doomed = await rt.discloseAs(f.lower, f.world, 'CONTACT_METHOD', { text: '+20 100 000 0000' });
      assert.equal((await rt.resolveDisclosure(f.world, f.higher)).length, 2, 'PD14 both are visible first');
      await actAs(f.lower);
      const [deleted] = await rt.deleteMaterial(randomUUID(), f.world, doomed.ids.material, randomUUID());
      await asRole('postgres');
      assert.equal(deleted.outcome, 'MATERIAL_DELETED', 'PD14 the owner deletes their own disclosure');
      assert.equal(await rt.textPayload(doomed.ids.version), null,
        'PD14 the protected payload is physically gone: there is nothing left to reconstruct from');
      assert.equal((await rt.itemRow(doomed.ids.item)).availability_state, 'DELETED_BY_OWNER',
        'PD14 and the history item is terminally owner-deleted');
      const seen = await rt.resolveDisclosure(f.world, f.higher);
      assert.deepEqual(seen.map((r) => r.resource_version_id), [kept.ids.version],
        'PD14 the counterpart now resolves only the surviving disclosure, with no placeholder for the other');
      // AUDIT IDENTITY SURVIVES WITHOUT SOURCE CONTENT.
      assert.ok(await rt.versionRow(doomed.ids.version), 'PD14 the resource version identity survives');
      assert.ok(await rt.grantEvent(doomed.ids.version), 'PD14 and so does its DISCLOSURE_GRANTED fact');
      assert.ok(await rt.materialRow(doomed.ids.material), 'PD14 and its Shared material envelope');
      // The counterpart cannot delete the owner's material, and the owner
      // cannot delete the counterpart's.
      await actAs(f.higher);
      await rejected(() => rt.deleteMaterial(randomUUID(), f.world, kept.ids.material, randomUUID()),
        UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
      await asRole('postgres');
    });

    await report.isolated('PD15 a later authority or profile change erases no delivered history', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      // The owner revokes their Matching Context Grant and their Pre-Match
      // Disclosure Authority and rewrites their Introduction Profile. None of
      // them is the authority a delivered Shared disclosure rests on.
      await actAs(f.lower);
      await rt.revokeContext(randomUUID(), f.byUser[f.lower].grant);
      await rt.revokeDisclosure(randomUUID(), f.byUser[f.lower].authority);
      await rt.setProfile(randomUUID(), [['life_stage', 'changed my mind']], f.byUser[f.lower].profile);
      await asRole('postgres');
      assert.deepEqual(await rt.disclosureEffects(ids), TEXT_DELIVERED,
        'PD15 the delivered disclosure is untouched by every later Matching authority change');
      assert.equal((await rt.resolveDisclosure(f.world, f.higher))[0].text_value, 'Sara Kamel',
        'PD15 and the counterpart still sees exactly what was delivered');
    });

    await report.isolated('PD16 no Matching Context Grant and no private Matching reasoning crosses', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'DEEPER_PERSONAL_FIELD',
        { text: 'the quieter side of town', fieldKey: 'home_city_region' });
      // The provenance edge says the owner established their OWN truth. It is
      // NOT a reasoning dependency, which would assert an influence that did
      // not happen and would be the shape private Matching context travels in.
      const [edge] = await rows(
        `SELECT * FROM public.shared_world_material_dependencies d WHERE d.target_material_id = $1`, [ids.material]);
      assert.equal(edge.dependency_kind, 'INDEPENDENT_TARGET_TRUTH',
        'PD16 a disclosure establishes its own truth and records no reasoning influence');
      assert.equal(edge.source_context_ref, null, 'PD16 carrying no private context reference');
      assert.equal(edge.source_material_id, null, 'PD16 and no source material');
      // No Standing Context Grant is manufactured by delivering a disclosure.
      assert.equal(await count('public.shared_world_standing_context_grants', 'world_id = $1', [f.world]), 0,
        'PD16 direct source disclosure is not ongoing private reasoning authority');
      // The bounded read shape carries no Matching operational state at all.
      const seen = await rt.resolveDisclosure(f.world, f.higher);
      assert.deepEqual(Object.keys(seen[0]), DISCLOSURE_COLUMNS, 'PD16 the render shape is exactly the bounded one');
    });

    await report.isolated('PD17 the exact audience is owner + counterpart, and the authority is the owner alone', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.deepEqual(await rt.baselineViewersOf(ids.item), [f.lower, f.higher].sort(),
        'PD17 the exact original audience is the owner and the exact derived counterpart, and nobody else');
      assert.deepEqual(await rt.requiredApproversOf(ids.item), [f.lower],
        'PD17 and the exact material authority is the owner alone');
      const [authority] = await rows(
        'SELECT * FROM public.shared_world_material_historical_authority a WHERE a.material_id = $1', [ids.material]);
      assert.equal(authority.resolution_state, 'RESOLVED_EXACT_HUMAN_REQUIREMENT',
        'PD17 a human disclosing their own resource has exactly one known human authority: themselves');
      assert.equal((await rt.grantEvent(ids.version)).counterpart_user_id, f.higher,
        'PD17 and the DISCLOSURE_GRANTED fact names the exact derived counterpart');
    });

    await report.isolated('PD18 no generic contact route or pre-Match path is created', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await actAs(f.lower);
      // A DEEPER_PERSONAL_FIELD may never become a second, unreviewed contact
      // route under an invented key: CONTACT_METHOD is the ONE reviewed way.
      for (const key of ['whatsapp_handle', 'email_address', 'phone_number', 'instagram_username']) {
        await rejected(() => rt.discloseText(disclosureIds(), f.world, 'DEEPER_PERSONAL_FIELD', 'reachable here', key),
          INVALID, /INTRODUCTION_DISCLOSURE_COMMAND_INVALID/u);
      }
      // And no resource type outside the frozen five can be spelled at all.
      for (const type of ['CONTACT_ROUTE', 'ANYTHING', 'RESOURCE_KIND', 'FULL_ADDRESS']) {
        await rejected(() => rt.discloseText(disclosureIds(), f.world, type, 'value'),
          INVALID, /INTRODUCTION_DISCLOSURE_COMMAND_INVALID/u);
      }
      await asRole('postgres');
      const [{ definition }] = await rows(
        `SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c
          WHERE c.conrelid = $1::regclass AND c.conname = 'introduction_disclosure_resource_versions_type_check'`,
        [D.VERSIONS]);
      for (const type of RESOURCE_TYPES) {
        assert.ok(definition.includes(`'${type}'`), `PD18 ${type} is representable`);
      }
      assert.equal((definition.match(/'[A-Z_]+'/gu) ?? []).length, RESOURCE_TYPES.length,
        'PD18 and the vocabulary is exactly those five: there is no generic resource kind');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

/** How many required material approvers one exact human holds over one item. */
const requiredApproverCount = async (item, human) =>
  Number((await rows(
    `SELECT count(*) n FROM ${D.APPROVERS} a WHERE a.history_item_id = $1 AND a.approver_user_id = $2`,
    [item, human]))[0].n);

// --------------------------------------------- 3. Introduction history visibility
async function verifyHistoryVisibility(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('V01 ACTIVE / INTRODUCTION returns the exact baseline-audience conjunction', async () => {
      const f = await rt.bringToIntroduction(one, two);
      assert.deepEqual(await rt.visibility(f.world, f.lower), [],
        'V01 an Introduction with no material yet is truthfully empty');
      const first = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      const second = await rt.discloseAs(f.higher, f.world, 'FULL_NAME', { text: 'Omar Hadi' });
      const visible = (await rt.visibility(f.world, f.lower)).map((r) => r.history_item_id);
      assert.deepEqual(visible.sort(), [first.ids.item, second.ids.item].sort(),
        'V01 both matched humans are in both itemsu{2019} exact baseline audience, so both see both');
      // An item whose baseline audience does NOT contain this human is not
      // visible to them, even though they are a current member.
      const outsiderItem = randomUUID();
      await q(`INSERT INTO ${D.ITEMS} (id, world_id, occurred_at, authority_requirement_mode,
                                       availability_state, availability_revision, registered_at)
               VALUES ($1, $2, clock_timestamp(), 'NO_HUMAN_APPROVAL_REQUIRED', 'AVAILABLE', 1, clock_timestamp())`,
        [outsiderItem, f.world]);
      await q(`INSERT INTO ${D.VIEWERS} (history_item_id, user_id) VALUES ($1, $2)`, [outsiderItem, three]);
      const stillVisible = (await rt.visibility(f.world, f.lower)).map((r) => r.history_item_id);
      assert.ok(!stillVisible.includes(outsiderItem),
        'V01 membership alone is never historical visibility: the exact baseline audience decides');
      // And selective history packages are NOT extended into an Introduction.
      const entry = await rt.functionPosture(DFN.VISIBILITY);
      const introductionBranch = entry.prosrc.slice(entry.prosrc.indexOf("world.phase = 'INTRODUCTION'"),
        entry.prosrc.indexOf('ACTIVE / STANDARD: exactly the frozen I-04F union'));
      assert.ok(!introductionBranch.includes('shared_world_history_package_manifest_items'),
        'V01 the Introduction branch has no explicit history-grant basis: there is no absence period to bridge');
    });

    await report.isolated('V02 a human with no open episode gets a truthful empty answer', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.deepEqual(await rt.visibility(f.world, three), [],
        'V02 a human with no episode in this World sees nothing, and is told nothing about why');
      // Closing the matched human''s own episode directly makes their answer
      // empty too - the entry point requires a CURRENTLY OPEN episode.
      await q(`UPDATE ${D.EPISODES} SET ended_at = clock_timestamp(), end_reason = 'WORLD_CLOSED'
                WHERE world_id = $1 AND user_id = $2`, [f.world, f.higher]);
      assert.deepEqual(await rt.visibility(f.world, f.higher), [],
        'V02 and a matched human whose episode has closed browses nothing in an ACTIVE World');
      assert.equal((await rt.visibility(f.world, f.lower)).length, 1,
        'V02 while the still-open human is unaffected');
    });

    await report.isolated('V03 availability dominates the Introduction branch', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.equal((await rt.visibility(f.world, f.higher)).length, 1, 'V03 an AVAILABLE item is visible');
      await q(`UPDATE ${D.ITEMS} SET availability_state = 'UNAVAILABLE', availability_revision = availability_revision + 1
                WHERE id = $1`, [ids.item]);
      assert.deepEqual(await rt.visibility(f.world, f.higher), [],
        'V03 and an UNAVAILABLE one is not returned at all, with no placeholder');
      assert.deepEqual(await rt.resolveDisclosure(f.world, f.higher), [],
        'V03 so the disclosure resolver, which composes it, returns nothing either');
    });

    await report.isolated('V04 ACTIVE / STANDARD is unchanged, grant basis included', async () => {
      // A Standard World with two members, one item each human can see, and one
      // item the second human can see ONLY through an explicit history grant -
      // the exact I-04F union, which the Introduction extension must not have
      // narrowed.
      const world = randomUUID();
      await q(`INSERT INTO ${D.WORLDS} (id, lifecycle, phase, birth_basis, born_at)
               VALUES ($1, 'ACTIVE', 'STANDARD', 'ACCEPTED_INVITATION', clock_timestamp() - interval '2 days')`, [world]);
      const episodes = { [one]: randomUUID(), [two]: randomUUID() };
      await q(`INSERT INTO ${D.EPISODES} (id, world_id, user_id, joined_at)
               VALUES ($1, $3, $4, clock_timestamp() - interval '2 days'),
                      ($2, $3, $5, clock_timestamp() - interval '1 day')`,
        [episodes[one], episodes[two], world, one, two]);
      const early = randomUUID();
      const late = randomUUID();
      await q(`INSERT INTO ${D.ITEMS} (id, world_id, occurred_at, authority_requirement_mode,
                                       availability_state, availability_revision, registered_at)
               VALUES ($1, $3, clock_timestamp() - interval '36 hours', 'EXACT_HUMAN_APPROVER_SET', 'AVAILABLE', 1, clock_timestamp()),
                      ($2, $3, clock_timestamp() - interval '2 hours', 'EXACT_HUMAN_APPROVER_SET', 'AVAILABLE', 1, clock_timestamp())`,
        [early, late, world]);
      await q(`INSERT INTO ${D.VIEWERS} (history_item_id, user_id)
               VALUES ($1, $3), ($2, $3), ($2, $4)`, [early, late, one, two]);
      // The early item predates the second human''s episode AND is not in their
      // baseline audience: membership-period visibility gives them the late one only.
      assert.deepEqual((await rt.visibility(world, two)).map((r) => r.history_item_id), [late],
        'V04 the Standard membership-period basis is exactly the frozen conjunction');
      assert.deepEqual((await rt.visibility(world, one)).map((r) => r.history_item_id), [early, late],
        'V04 and the longer-standing member sees both');
      // Now the explicit history-grant basis, written directly in the frozen
      // I-04F shape: it widens the second human''s view to the early item.
      const manifest = randomUUID();
      await q(`INSERT INTO public.shared_world_history_package_manifest_versions
                 (id, world_id, grantee_user_id, grantee_membership_episode_id, created_at)
               VALUES ($1, $2, $3, $4, clock_timestamp())`, [manifest, world, two, episodes[two]]);
      await q(`INSERT INTO public.shared_world_history_package_manifest_items
                 (manifest_version_id, world_id, history_item_id, captured_availability_revision)
               VALUES ($1, $2, $3, 1)`, [manifest, world, early]);
      await q(`INSERT INTO public.shared_world_history_access_grants
                 (id, world_id, grantee_user_id, grantee_membership_episode_id, manifest_version_id, granted_at)
               VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
        [randomUUID(), world, two, episodes[two], manifest]);
      assert.deepEqual((await rt.visibility(world, two)).map((r) => r.history_item_id), [early, late],
        'V04 the explicit history-grant basis still widens a Standard view exactly as I-04F froze it');
    });

    await report.isolated('V05 READ_ONLY_CLOSED / INTRODUCTION consults no active membership', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      // Archive the World directly. The real terminal closure - and the exact
      // entitlement snapshot - belong to migration 0116; what is proven here is
      // that the closed branch reads the entitlement family and nothing else.
      await q(`UPDATE ${D.WORLDS} SET lifecycle = 'READ_ONLY_CLOSED', closed_at = clock_timestamp() WHERE id = $1`, [f.world]);
      assert.deepEqual(await rt.visibility(f.world, f.lower), [],
        'V05 with no entitlement, a human who was a member a moment ago sees nothing');
      assert.deepEqual(await rt.closedVisibility(f.world, f.lower), [],
        'V05 and the internal closed reader agrees, with no distinguishable error');
      assert.equal(await count(D.EPISODES, 'world_id = $1 AND ended_at IS NULL', [f.world]), 2,
        'V05 even though both membership episodes are still open: closed viewing never consults them');
    });

    await report.isolated('V06 an unspelled World mode is still refused', async () => {
      // A MUTUAL_MATCH World, deliberately: the frozen 0075 direct-birth CHECK
      // pins an ACCEPTED_INVITATION World to STANDARD at every persisted point,
      // so moving the phase on one of those would violate a SECOND invariant and
      // the probe would prove the weather rather than the resolver.
      const world = randomUUID();
      await q(`INSERT INTO ${D.WORLDS} (id, lifecycle, phase, birth_basis, born_at)
               VALUES ($1, 'ACTIVE', 'STANDARD', 'MUTUAL_MATCH', clock_timestamp())`, [world]);
      // The phase CHECK is what makes an unspelled mode unrepresentable, so the
      // forward guard inside the resolver is proven by suspending exactly that
      // one constraint for the probe and restoring it immediately.
      await q(`ALTER TABLE ${D.WORLDS} DROP CONSTRAINT shared_worlds_phase_check`);
      await q(`UPDATE ${D.WORLDS} SET phase = 'SOMETHING_ELSE' WHERE id = $1`, [world]);
      await rejected(() => rt.visibility(world, one), UNSUPPORTED,
        /SHARED_WORLD_HISTORY_VISIBILITY_UNSUPPORTED_WORLD_MODE/u);
      await q(`UPDATE ${D.WORLDS} SET phase = 'STANDARD' WHERE id = $1`, [world]);
      await q(`ALTER TABLE ${D.WORLDS} ADD CONSTRAINT shared_worlds_phase_check
               CHECK (phase IN ('STANDARD', 'INTRODUCTION'))`);
      const [{ present }] = await rows(
        `SELECT count(*)::int present FROM pg_constraint c
          WHERE c.conrelid = $1::regclass AND c.conname = 'shared_worlds_phase_check'`, [D.WORLDS]);
      assert.equal(present, 1, 'V06 the canonical phase constraint is restored immediately');
      // A nonexistent World is still a bounded error rather than an empty answer.
      await rejected(() => rt.visibility(randomUUID(), one), UNAVAILABLE, /SHARED_WORLD_HISTORY_NOT_AVAILABLE/u);
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ------------------------------------------------------------- 4. no ghost
async function verifyNoGhost(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('G01 NO GHOST: a late transactional failure leaves ZERO surviving effects', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const ids = disclosureIds();
      // A verifier-local trigger on the LAST insert the command performs. Every
      // other write - the history item, the audience, the authority, the
      // envelope, the provenance, the resource version, the payload and the
      // grant fact - is already in place when it fires, so what rolls back is
      // a genuinely late failure rather than an early refusal.
      await q(`CREATE FUNCTION public.qandeel_i07d_ghost_probe_v1() RETURNS trigger
               LANGUAGE plpgsql AS $probe$
               BEGIN
                 RAISE EXCEPTION 'I07D_GHOST_PROBE' USING ERRCODE='P0001';
               END$probe$`);
      await q(`CREATE TRIGGER qandeel_i07d_ghost_probe BEFORE INSERT ON ${D.COMMANDS}
               FOR EACH ROW EXECUTE FUNCTION public.qandeel_i07d_ghost_probe_v1()`);
      try {
        await actAs(f.lower);
        await rejected(() => rt.discloseText(ids, f.world, 'FULL_NAME', 'Sara Kamel'),
          CONTRADICTORY, /I07D_GHOST_PROBE/u);
        await asRole('postgres');
        assert.deepEqual(await rt.disclosureEffects(ids), NOTHING,
          'G01 no resource version, no payload, no grant event, no history item, no baseline audience and no material survives');
        assert.deepEqual(await rt.resolveDisclosure(f.world, f.higher), [],
          'G01 and the counterpart sees nothing at all');
      } finally {
        await asRole('postgres');
        await q(`DROP TRIGGER IF EXISTS qandeel_i07d_ghost_probe ON ${D.COMMANDS}`);
        await q('DROP FUNCTION IF EXISTS public.qandeel_i07d_ghost_probe_v1()');
      }
      // The probe left nothing behind, and the real command works again.
      const [{ probes }] = await rows(
        `SELECT count(*)::int probes FROM pg_trigger t
          WHERE t.tgrelid = $1::regclass AND t.tgname = 'qandeel_i07d_ghost_probe'`, [D.COMMANDS]);
      assert.equal(probes, 0, 'G01 the verifier-local probe is removed');
      const after = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.deepEqual(await rt.disclosureEffects(after.ids), TEXT_DELIVERED,
        'G01 and a real disclosure commits everything again afterwards');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0115', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('posture');
  await verifyPosture();

  const report = createScenarioReport('0115', { query: q, restore: () => asRole('postgres') });
  const seams = [];
  for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE]) {
    seams.push(await rt.captureMatchingSeam(fn));
  }
  try {
    // The I-07B seams the fixture ladder needs, and the I-07D disclosure seam
    // this migration owns. All three answer fail-closed in production - which
    // PD13 proves against the real definition - and all three are restored byte
    // for byte in the finally below, on every path.
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla' });
    await rt.clearProposalPrerequisites();
    await rt.clearSeam(I07D_SEAM_PARAMETERS[0]);

    setStage('disclosure');
    await verifyDisclosure(report, humans);
    setStage('visibility');
    await verifyHistoryVisibility(report, humans);
    setStage('no-ghost');
    await verifyNoGhost(report, humans);
  } finally {
    await asRole('postgres');
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  assert.equal(await rt.seamClearance('public.resolve_introduction_disclosure_prerequisites_v1'), 'NOT_EVALUATED',
    'the I-07D disclosure seam is fail-closed again after the run');
  const [gate] = await rows('SELECT * FROM public.resolve_matching_proposal_prerequisites_v1($1)', [randomUUID()]);
  assert.equal(gate.clearance, 'NOT_EVALUATED', 'and so is the I-07B proposal seam');
  for (const [table, trigger] of I07D_GUARDS) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled at the end of the run`);
  }
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${D.VERSIONS}) + (SELECT count(*) FROM ${D.COMMANDS})
          + (SELECT count(*) FROM ${D.GRANTS}) + (SELECT count(*) FROM ${D.TEXT})
          + (SELECT count(*) FROM ${D.MEDIA}) + (SELECT count(*) FROM ${D.ENTITLEMENTS})
          + (SELECT count(*) FROM ${D.MATERIALS} WHERE material_kind = 'EXPLICIT_DISCLOSURE')
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0,
    'every fixture this verifier created was rolled back: it commits nothing outside public.users');
}, () => rt.client.end().catch(() => undefined));
