// Real-PostgreSQL verifier for migration 0103 - I-06B Replay Preview /
// Finalization Runtime (PART B).
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live rows written through the primitives themselves, that:
//
//   catalog / posture
//     * every function is postgres-owned, search_path-pinned and executable by
//       NO application role; the ONE read boundary is service_role-only and
//       discloses no source identity; the canonicalization is IMMUTABLE and
//       declares no source payload parameter;
//
//   the capability matrix, proven rather than asserted
//     * P01 a covered sealed Personal selection previews into ONE complete
//           Replay Version binding all four components;
//     * P02 a stranger and a nonexistent Replay reach ONE bounded class;
//     * P03 SHARED_WORLD fails closed with the bounded capability class, and
//           its I-06A DRAFT stays exactly as valid;
//     * P09 an owned PUBLIC_EXPERIENCE Replay - built through the frozen I-05A
//           publication path and the frozen I-06A Public adapter - fails closed
//           the same way, leaks no Public or private source detail, creates no
//           I-06B state at all, and keeps its DRAFT and its source currency;
//     * P04 a LEGACY UNCOVERED Personal Session fails closed the same way;
//     * P05 the open Live Head can never be frozen as historical truth;
//     * P06 an unproven partial cut cannot preview;
//     * P07 a stale bound source cannot preview;
//     * P08 no application role can execute any I-06B primitive;
//
//   analytical truth
//     * A01 every point binds the canonical K(TC) at the exact represented
//           Session Position, which is the selected item's own position;
//     * A02 an earlier represented point contains NO later knowledge;
//     * A03 the same sealed state digests identically, twice;
//     * A04 a different represented coordinate digests differently;
//     * A05 a world advance that adds no knowledge at a sealed coordinate
//           leaves that coordinate's digest unchanged;
//     * A06 the frozen truth revalidates as CURRENT, and diverges when the
//           canonical analytical answer at a represented coordinate moves;
//
//   cuts, gaps and the render contract
//     * C01 a non-contiguous selection produces the exact discontinuity facts
//           and a contiguous one produces none;
//     * C02 a discontinuity names no omitted item and copies no content;
//     * C03 the render contract binds the exact composition and its digest
//           recomputes from its own row;
//     * C04 an audio-bearing selection cannot build a render contract;
//
//   lifecycle
//     * L01 PREVIEW_READY widens no audience and creates no distribution state;
//     * L02 finalization requires the EXACT current previewed version;
//     * L03 finalization evidence is exact-version bound and append-only, and a
//           retry is idempotent while a reused command id conflicts;
//     * L04 a reopen returns to DRAFT and mutates no old Replay Version - a
//           previously finalized version stays historically finalized;
//     * L05 the next preview after a revision creates a NEW Replay Version;
//
//   concurrency, on committed state across two connections
//     * R01 competing previews serialize and the stale loser fails;
//     * R02 a source deletion racing finalization cannot commit;
//     * R03 competing finalizations cannot both commit;
//
//   forward safety inside a rolled-back SAVEPOINT: the I-06C / I-06D additions
//   leave the catalog proof passing, and seven deliberate weakenings are each
//   refused - every one proven to have LANDED before a refusal is expected.
//
// Every independent scenario reports its own outcome through the permanent
// aggregator, so one defect can never hide the ones after it.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  APP_ROLES, R, SEAM, T, V, VFN, VERSION_DISCLOSURE_BAN, createReplayVersionRuntime, runVerifier,
} from './replay-version-verifier-support.mjs';

const rt = createReplayVersionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const INTERNAL = [VFN.FAMILY, VFN.POINT_DIGEST, VFN.VERSION_DIGEST, VFN.CONTRACT_DIGEST, VFN.CUT, VFN.GAP,
  VFN.PROJECTION, VFN.CONTRACT, VFN.TRUTH, VFN.PREVIEW, VFN.FINALIZE, VFN.REOPEN];
const MUTATING = [VFN.CUT, VFN.GAP, VFN.PROJECTION, VFN.CONTRACT, VFN.PREVIEW, VFN.FINALIZE, VFN.REOPEN];
const PURE = [VFN.FAMILY, VFN.POINT_DIGEST, VFN.VERSION_DIGEST, VFN.CONTRACT_DIGEST];
const COMMAND_TABLES = [V.PREVIEW_COMMANDS, V.FINALIZE_COMMANDS, V.REOPEN_COMMANDS];
/** The exact input list of the canonicalization: `moments` is not in it, ever. */
const CANONICALIZER_INPUTS = ['p_represented_session_position', 'p_emerging_focuses', 'p_live_focus',
  'p_threads', 'p_thread_reading_appearances', 'p_readings', 'p_reading_relations',
  'p_evidence_participations', 'p_materials', 'p_gaps', 'p_questions',
  'p_question_appearances', 'p_confidences'];

/** Every relation whose row count must be unchanged by a preview or a finalization. */
const AUDIENCE_RELATIONS = [T.PUBLICATION_STATE, T.PUBLISH_COMMANDS, T.APPROVALS, T.REQUIRED,
  T.MANIFESTS, T.VERSIONS, T.EXPERIENCES, 'public.shared_world_membership_episodes',
  'public.shared_world_history_items', 'public.shared_world_materials'];

async function audienceCounts() {
  const counts = {};
  for (const table of AUDIENCE_RELATIONS) {
    counts[table] = Number((await rows(`SELECT count(*) n FROM ${table}`))[0].n);
  }
  return counts;
}

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  await rt.verifyPosture({
    internal: INTERNAL.filter((fn) => !PURE.includes(fn)),
    mutating: MUTATING,
    tables: COMMAND_TABLES,
    immutable: [],
  });
  // The pure canonicalizations: postgres-owned, pinned, IMMUTABLE, and
  // executable by nobody. They are deliberately NOT SECURITY DEFINER.
  for (const fn of PURE) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.owner, 'postgres', `${fn} is postgres-owned`);
    assert.equal(p.volatility, 'i', `${fn} is IMMUTABLE, or the same truth could digest differently`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `${fn} pins an empty search_path`);
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false, `${role} must not execute ${fn}`);
    }
  }
  // THE SOURCE-EVENT PAYLOAD IS STRUCTURALLY EXCLUDED: the canonicalization's
  // exact input list carries no moments, text, body or transcript parameter.
  //
  // Read from `proargnames` DIRECTLY rather than through a mode-filtered
  // unnest. PostgreSQL leaves `proargmodes` NULL for a function whose arguments
  // are all IN and whose result is scalar, and `unnest(names, NULL)` yields
  // NOTHING - so a mode filter over this function returns an empty list and
  // every membership check over it is vacuously satisfied. The whole point of
  // this assertion is that it cannot be satisfied vacuously, so it compares the
  // EXACT list and requires it to be non-empty.
  const [{ declared }] = await rows(
    'SELECT pr.proargnames declared FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [VFN.POINT_DIGEST]);
  assert.ok(Array.isArray(declared) && declared.length > 0,
    'the analytical canonicalization declares named parameters this assertion can actually read');
  assert.deepEqual(declared, CANONICALIZER_INPUTS,
    'the analytical canonicalization declares an EXACT input list and no source payload');
  // The truth revalidation is STABLE and writes nothing.
  const truth = await rt.functionPosture(VFN.TRUTH);
  assert.equal(truth.volatility, 's', 'the truth revalidation is STABLE');
  assert.ok(!truth.prosrc.includes('INSERT INTO') && !/UPDATE public/u.test(truth.prosrc),
    'the truth revalidation writes nothing');
  // THE ONE READ BOUNDARY: service_role only, creator-exact, disclosure-bounded.
  const resolver = await rt.functionPosture(VFN.RESOLVER);
  assert.equal(resolver.secdef, true, 'the current-version resolver is SECURITY DEFINER');
  assert.equal(resolver.volatility, 's', 'and STABLE');
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.equal(await rt.canExecute(role, VFN.RESOLVER), false, `${role} must not execute the resolver`);
  }
  assert.equal(await rt.canExecute('service_role', VFN.RESOLVER), true, 'service_role executes the ONE read boundary');
  const columns = await rt.resultColumns(VFN.RESOLVER);
  assert.ok(columns.length >= 10, 'the resolver answers the composition shape');
  for (const column of columns) {
    assert.doesNotMatch(column, VERSION_DISCLOSURE_BAN, `the resolver must not return ${column}`);
  }
  // THE PROJECTION CONSUMES THE CANONICAL HISTORICAL TRUTH AND COMPUTES NONE.
  const projection = await rt.functionPosture(VFN.PROJECTION);
  assert.ok(projection.prosrc.includes('public.get_session_historical_projection_v1(manifest.personal_session_id, item.represented_tc)'),
    'the Personal projection consumes the canonical historical projection at the exact represented coordinate');
  assert.doesNotMatch(projection.prosrc, /historical_reading_events|session_historical_coverage|hypotheses|memories/u,
    'and never reads the historical substrate directly');
  for (const fn of INTERNAL.concat([VFN.RESOLVER])) {
    const p = await rt.functionPosture(fn);
    assert.doesNotMatch(p.prosrc, /(?:openai|anthropic|claude|gpt|llm|prompt|completion|embedding|inference|synthes)/iu,
      `${fn} runs no model over historical source`);
    assert.doesNotMatch(p.prosrc, /PUBLISH_TO_PUBLIC_WORLD|SHARE_EXTERNALLY|DISTRIBUT|SAFETY_ALLOW|LAUNCH_CLEARED|ENTITLED/u,
      `${fn} claims no distribution, Safety or Launch state`);
  }
  // AND THE FROZEN CW2-08 SEAM STILL FAILS CLOSED.
  assert.ok((await rt.functionPosture(SEAM)).prosrc.includes('NOT_EVALUATED'),
    'the frozen CW2-08 prerequisite seam still answers NOT_EVALUATED: I-06B manufactures no launch readiness');
}

// -------------------------------------------------------------- 2. fixtures
async function draftOver(f, session, { items, selected, starts = null, ends = null, sourceClass = 'MY_WORLD', context = null, version = null }) {
  const spec = {
    command: randomUUID(), replay: randomUUID(), manifest: randomUUID(), selection: randomUUID(),
    sourceClass, context: context ?? session, version, items, selected,
    starts: starts ?? selected.map(() => null), ends: ends ?? selected.map(() => null),
    coverage: 'SELECTED_EXCERPT',
  };
  await actAs(f.mohamed);
  const [created] = await rt.createDraft(spec);
  assert.equal(created.outcome, 'REPLAY_DRAFT_CREATED', 'the frozen I-06A draft path still creates a private draft');
  return spec;
}

const previewOf = async (draft, revision = 1) => {
  const command = rt.freshPreview(draft.replay, revision);
  const [answer] = await rt.preview(command);
  return { command, answer };
};

/**
 * The canonicalization's digest of one K(TC), called directly.
 *
 * EVERY jsonb ARGUMENT IS RE-SERIALIZED. A jsonb column comes back from
 * node-postgres already PARSED into a JavaScript value, and node-postgres sends
 * a JavaScript ARRAY back as a PostgreSQL array literal rather than as JSON -
 * so passing `projection.readings` straight through reaches PostgreSQL as
 * `{...}` and fails with "invalid input syntax for type json". The round trip
 * is only in this verifier: the runtime passes the projection's own columns
 * inside the database and never leaves it.
 */
const jsonb = (value) => JSON.stringify(value ?? null);
const pointDigestOf = async (p) => (await rows(
  `SELECT public.replay_analytical_projection_point_digest_v1(
            $1::integer, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb,
            $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb) d`,
  [p.tc, jsonb(p.emerging_focuses), jsonb(p.live_focus), jsonb(p.threads),
    jsonb(p.thread_reading_appearances), jsonb(p.readings), jsonb(p.reading_relations),
    jsonb(p.evidence_participations), jsonb(p.materials), jsonb(p.gaps),
    jsonb(p.questions), jsonb(p.question_appearances), jsonb(p.confidences)]))[0].d;

// ------------------------------------------------------- 3. the capability matrix
async function verifyCapability(report, f, drafts) {
  const { personal, legacy, shared, publicExperience, openHead, partial } = drafts;

  await report.isolated('P01 a covered sealed Personal selection previews into ONE complete Replay Version', async () => {
    await actAs(f.mohamed);
    const before = await audienceCounts();
    const { command, answer } = await previewOf(personal);
    assert.equal(answer.outcome, 'REPLAY_PREVIEW_READY');
    assert.equal(answer.replay_lifecycle, 'PREVIEW_READY');
    assert.equal(answer.committed_replay_version_id, command.version);
    assert.equal(Number(answer.replay_version_revision), 1);
    await asRole('postgres');
    const [version] = await rows(`SELECT * FROM ${V.VERSIONS} WHERE id = $1`, [command.version]);
    for (const component of ['source_manifest_version_id', 'selection_spec_version_id',
      'analytical_projection_version_id', 'render_contract_version_id']) {
      assert.ok(version[component], `P01 the complete Replay Version binds ${component}`);
    }
    assert.equal(version.analytical_projection_version_id, command.projection);
    assert.equal(version.render_contract_version_id, command.contract);
    assert.equal(Number(answer.projection_point_count), Number(answer.semantic_cut_safe_count),
      'P01 every selected item is projected and every cut is proven safe');
    // L01 PREVIEW_READY WIDENED NOTHING.
    assert.deepEqual(await audienceCounts(), before, 'L01 a preview creates no audience, package, approval or membership row');
    assert.equal(await count(V.LIFECYCLE, "replay_id = $1 AND to_lifecycle = 'PREVIEW_READY'", [personal.replay]), 1,
      'L01 and it appends exactly one lifecycle event');
  });

  await report.isolated('P02 a stranger and a nonexistent Replay reach ONE bounded class', async () => {
    await actAs(f.hadir);
    const byStranger = await rejected(() => rt.preview(rt.freshPreview(personal.replay, 1)),
      ['P0002'], /REPLAY_NOT_AVAILABLE/u);
    const byGuess = await rejected(() => rt.preview(rt.freshPreview(randomUUID(), 1)),
      ['P0002'], /REPLAY_NOT_AVAILABLE/u);
    assert.equal(byStranger.message, byGuess.message, 'P02 a stranger and a nonexistent Replay are ONE class');
    await rejected(() => rt.finalize({ command: randomUUID(), replay: personal.replay, version: randomUUID() }),
      ['P0002'], /REPLAY_NOT_AVAILABLE/u);
    await actAs(null);
    await rejected(() => rt.preview(rt.freshPreview(personal.replay, 1)), ['42501'], /REPLAY_AUTHENTICATION_REQUIRED/u);
    await actAs(f.mohamed);
    // AND THE READ BOUNDARY DISCLOSES NOTHING TO A STRANGER.
    await asRole('service_role');
    assert.equal((await rt.currentVersion(personal.replay, f.hadir)).length, 0,
      'P02 the current-version resolver answers the exact creator and nobody else');
  });

  await report.isolated('P03 an unsupported source class fails closed and its DRAFT survives', async () => {
    await actAs(f.mohamed);
    const error = await rejected(() => rt.preview(rt.freshPreview(shared.replay, 1)),
      ['0A000'], /REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE/u);
    assert.doesNotMatch(error.message, /SHARED|Session|World|material/u,
      'P03 the bounded class leaks no source detail');
    await asRole('postgres');
    // NOTHING WAS SYNTHESIZED, and the I-06A draft is exactly as valid as it was.
    assert.equal(await count(V.PROJECTIONS, 'replay_id = $1', [shared.replay]), 0,
      'P03 no fake zero-element projection was marked complete');
    assert.equal(await count(V.VERSIONS, 'replay_id = $1', [shared.replay]), 0);
    assert.equal((await rows(`SELECT current_lifecycle FROM ${R.REPLAYS} WHERE id = $1`, [shared.replay]))[0].current_lifecycle,
      'DRAFT', 'P03 the Shared Replay remains a valid private DRAFT');
    await asRole('service_role');
    const [composition] = await rt.composition(shared.replay, f.mohamed);
    assert.equal(composition.currency_state, 'CURRENT', 'P03 and its I-06A source composition is untouched');
  });

  await report.isolated('P09 an owned PUBLIC_EXPERIENCE Replay fails closed and its DRAFT survives', async () => {
    await actAs(f.mohamed);
    // The Replay under proof is a REAL one: built through the frozen I-05A
    // publication path and the frozen I-06A Public adapter, over the bounded
    // package of the exact current version the creator CONTROLS. Nothing about
    // it is synthesized to reach this scenario.
    await asRole('postgres');
    const [manifest] = await rows(
      `SELECT source_class, public_experience_id, public_experience_version_id, item_count
         FROM ${R.MANIFESTS} WHERE id = $1`, [publicExperience.manifest]);
    assert.equal(manifest.source_class, 'PUBLIC_EXPERIENCE', 'P09 the fixture really is a Public Experience Replay');
    assert.equal(manifest.public_experience_id, publicExperience.context);
    await actAs(f.mohamed);
    const error = await rejected(() => rt.preview(rt.freshPreview(publicExperience.replay, 1)),
      ['0A000'], /REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE/u);
    // THE SAME BOUNDED CLASS AS EVERY OTHER UNSUPPORTED SOURCE, leaking no
    // Experience, package item, digest or private provenance.
    assert.doesNotMatch(error.message, /PUBLIC|Experience|package|digest|provenance/u,
      'P09 the bounded class leaks no Public or private source detail');
    await asRole('postgres');
    for (const [relation, where] of [[V.PROJECTIONS, 'replay_id = $1'], [V.CONTRACTS, 'replay_id = $1'],
      [V.VERSIONS, 'replay_id = $1'], [V.POINTER, 'replay_id = $1'],
      [V.FINALIZATIONS, 'replay_id = $1'], [V.LIFECYCLE, 'replay_id = $1']]) {
      assert.equal(await count(relation, where, [publicExperience.replay]), 0,
        `P09 no ${relation} row was created for an unsupported source class`);
    }
    assert.equal((await rows(`SELECT current_lifecycle FROM ${R.REPLAYS} WHERE id = $1`, [publicExperience.replay]))[0].current_lifecycle,
      'DRAFT', 'P09 the Public Replay remains a valid private DRAFT');
    // AND ITS AUTHORIZED SOURCE COMPOSITION IS UNCHANGED AND STILL CURRENT.
    await asRole('service_role');
    const [composition] = await rt.composition(publicExperience.replay, f.mohamed);
    assert.equal(composition.source_class, 'PUBLIC_EXPERIENCE');
    assert.equal(composition.currency_state, 'CURRENT', 'P09 its I-06A source composition is untouched');
    assert.equal(Number(composition.draft_revision), 1, 'P09 and its draft did not move');
  });

  await report.isolated('P04 a LEGACY UNCOVERED Personal Session fails closed', async () => {
    await actAs(f.mohamed);
    const error = await rejected(() => rt.preview(rt.freshPreview(legacy.replay, 1)),
      ['0A000'], /REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE/u);
    assert.doesNotMatch(error.message, /LEGACY_UNCOVERED|coverage/u,
      'P04 the refusal never names the internal coverage state');
    await asRole('postgres');
    assert.equal(await count(V.PROJECTIONS, 'replay_id = $1', [legacy.replay]), 0,
      'P04 no history is reconstructed from current rows');
    // And the canonical projection agrees: it refuses that Session outright.
    await actAs(f.mohamed);
    await rejected(() => rt.canonicalProjection(legacy.session, 1), ['55000'], /HISTORICAL_COVERAGE_UNAVAILABLE/u);
  });

  await report.isolated('P05 the open Live Head can never be frozen as historical truth', async () => {
    await actAs(f.mohamed);
    await rejected(() => rt.preview(rt.freshPreview(openHead.replay, 1)),
      ['40001'], /REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD/u);
    await asRole('postgres');
    assert.equal(await count(V.POINTS, 'represented_session_position = $1', [openHead.liveHead]), 0,
      'P05 no point at the open Live Head exists anywhere');
    // The canonical projection is the one that says so, and it still does.
    await actAs(f.mohamed);
    const [open] = await rt.canonicalProjection(openHead.session, openHead.liveHead);
    assert.equal(open.sealed, false, 'P05 the canonical projection reports the Live Head unsealed');
    const [sealed] = await rt.canonicalProjection(openHead.session, openHead.liveHead - 1);
    assert.equal(sealed.sealed, true, 'P05 and reports the position before it sealed');
  });

  await report.isolated('P06 an unproven partial cut cannot preview', async () => {
    await actAs(f.mohamed);
    // FIRST what the derivation records, and only then the refusal. A refused
    // preview is ONE statement: PostgreSQL rolls the whole thing back, so the
    // assessments it wrote on the way to the refusal do not survive it and
    // could not be read afterwards.
    const [derived] = await rows(
      'SELECT * FROM public.derive_replay_semantic_cut_safety_v1($1, clock_timestamp())', [partial.selection]);
    assert.equal(Number(derived.assessed_count), partial.selected.length,
      'P06 every selected item is assessed');
    assert.ok(Number(derived.unsafe_count) >= 1, 'P06 and at least one of them is not proven safe');
    const assessments = await rows(
      `SELECT anchor_kind, assessment_result FROM ${V.CUTS} WHERE selection_spec_version_id = $1 ORDER BY source_item_ordinal`,
      [partial.selection]);
    assert.ok(assessments.some((a) => a.anchor_kind === 'TEXT_CODE_POINT_RANGE' && a.assessment_result === 'UNPROVEN'),
      'P06 a partial range is recorded UNPROVEN, never SAFE');
    assert.ok(assessments.every((a) => a.anchor_kind === 'WHOLE_ITEM' || a.assessment_result !== 'SAFE'),
      'P06 and nothing trimmed is ever SAFE');
    // AND THE PREVIEW REFUSES OVER IT.
    await rejected(() => rt.preview(rt.freshPreview(partial.replay, 1)), ['0A000'], /REPLAY_SEMANTIC_CUT_UNSAFE/u);
    await asRole('postgres');
    assert.equal(await count(V.VERSIONS, 'replay_id = $1', [partial.replay]), 0,
      'P06 and no complete Replay Version was built over it');
    assert.equal(await count(R.SPEC_ITEMS, 'selection_spec_version_id = $1', [partial.selection]),
      partial.selected.length, 'P06 the selection was not widened');
  });

  await report.isolated('P07 a stale bound source cannot preview', async () => {
    // The committed Personal source is append-only, so a loss is SIMULATED with
    // the guards standing aside - inside this scenario's own savepoint, which
    // rolls the whole simulation back.
    await rt.asReplica(async () => {
      await q('DELETE FROM public.conversation_units WHERE id = $1', [personal.items[0]]);
    });
    await actAs(f.mohamed);
    await rejected(() => rt.preview(rt.freshPreview(personal.replay, 1)), ['40001'], /REPLAY_SOURCE_STALE/u);
    await asRole('postgres');
    assert.equal(await count(V.VERSIONS, 'replay_id = $1', [personal.replay]), 0,
      'P07 no Replay Version was built over a source that is no longer there');
  });

  await report.section('P08 no application role can execute any I-06B primitive', async () => {
    await asRole('postgres');
    for (const fn of INTERNAL) {
      for (const role of ['public', ...APP_ROLES]) {
        assert.equal(await rt.canExecute(role, fn), false,
          `P08 ${role} must not execute ${fn} before the frozen CW2-08 Launch Gate exists`);
      }
    }
  });
}

// ------------------------------------------------------- 4. analytical truth
async function verifyAnalytical(report, f, drafts) {
  const { personal, history } = drafts;

  await report.isolated('A01 every point binds the canonical projection at the selected item own position', async () => {
    await actAs(f.mohamed);
    const { command } = await previewOf(personal);
    await asRole('postgres');
    const points = await rows(
      `SELECT p.selected_ordinal, p.represented_session_position tc, p.projection_sealed sealed,
              p.projection_live_head head, p.point_digest, mi.personal_session_position item_position
         FROM ${V.POINTS} p
         JOIN ${R.SPEC_ITEMS} si ON si.selection_spec_version_id = p.selection_spec_version_id
          AND si.selected_ordinal = p.selected_ordinal
         JOIN ${R.MANIFEST_ITEMS} mi ON mi.manifest_version_id = si.source_manifest_version_id
          AND mi.source_item_ordinal = si.source_item_ordinal
        WHERE p.projection_version_id = $1 ORDER BY p.selected_ordinal`, [command.projection]);
    assert.equal(points.length, personal.selected.length, 'A01 every selected item has exactly one point');
    for (const point of points) {
      assert.equal(point.tc, point.item_position, 'A01 the represented TC IS the selected item canonical Session Position');
      assert.equal(point.sealed, true, 'A01 and it is sealed');
      assert.ok(point.head > point.tc, 'A01 which means strictly before the Live Head');
    }
  });

  await report.isolated('A02 an earlier represented point contains no later knowledge', async () => {
    await actAs(f.mohamed);
    const [first] = await rt.canonicalProjection(history.session, 1);
    const [second] = await rt.canonicalProjection(history.session, 2);
    const [third] = await rt.canonicalProjection(history.session, 3);
    const idsOf = (readings) => readings.map((r) => r.id).sort();
    assert.deepEqual(idsOf(first.readings), [history.readingA],
      'A02 the Reading that appeared at the second position is absent from the first');
    assert.deepEqual(idsOf(second.readings), [history.readingA, history.readingB].sort(),
      'A02 and present at the second');
    assert.equal(first.readings[0].statusAtTc, 'CANDIDATE', 'A02 the later status change is still later at TC 1');
    assert.equal(second.readings.find((r) => r.id === history.readingA).statusAtTc, 'CANDIDATE',
      'A02 and still later at TC 2');
    assert.equal(third.readings.find((r) => r.id === history.readingA).statusAtTc, 'ACTIVE',
      'A02 and is exactly the then-current status at TC 3');
  });

  await report.isolated('A03 the same sealed state digests identically', async () => {
    await actAs(f.mohamed);
    const [projection] = await rt.canonicalProjection(history.session, 2);
    const first = await pointDigestOf(projection);
    const second = await pointDigestOf(projection);
    assert.equal(first, second, 'A03 the canonicalization is deterministic');
    assert.match(first, /^sha256:[0-9a-f]{64}$/u, 'A03 and is a canonical one-way digest');
    // And the ORDER a family arrives in is not part of the truth.
    assert.ok(projection.readings.length >= 2, 'A03 the fixture carries more than one Reading to reorder');
    const [{ same }] = await rows(
      `SELECT public.replay_canonical_projection_family_v1('readings', $1::jsonb, ARRAY[]::text[])
            = public.replay_canonical_projection_family_v1('readings', $2::jsonb, ARRAY[]::text[]) same`,
      [jsonb(projection.readings), jsonb([...projection.readings].reverse())]);
    assert.equal(same, true, 'A03 the canonicalization is stable under element ordering');
  });

  await report.isolated('A04 a different represented coordinate digests differently', async () => {
    await actAs(f.mohamed);
    const digests = [];
    for (const tc of [1, 2, 3]) {
      const [p] = await rt.canonicalProjection(history.session, tc);
      digests.push(await pointDigestOf(p));
    }
    assert.equal(new Set(digests).size, 3,
      'A04 three coordinates whose analytical truth differs produce three different digests');
  });

  await report.isolated('A05 a world advance that adds no knowledge leaves a sealed digest unchanged', async () => {
    await actAs(f.mohamed);
    const { command } = await previewOf(personal);
    await asRole('postgres');
    const before = await rows(
      `SELECT selected_ordinal, point_digest FROM ${V.POINTS} WHERE projection_version_id = $1 ORDER BY selected_ordinal`,
      [command.projection]);
    // Analytical state that becomes known LATER than every represented point:
    // a new Reading at a world version above the Session baseline and at no
    // Session Position this Replay represents.
    await rt.asReplica(async () => {
      const later = randomUUID();
      await q(`INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, version)
               VALUES ($1, $2, 'a reading that arrived after every represented point', 'CAUSAL', 'GENERAL', $3, 'SYSTEM_GENERATED', 'CANDIDATE', 1)`,
      [later, f.mohamed, `CONVERSATION_SESSION:${history.session}`]);
      await q(`INSERT INTO public.historical_reading_events
                 (event_id, user_id, hypothesis_id, event_kind, to_status, to_version,
                  session_id, session_position, same_sp_event_sequence, world_version)
               VALUES ($1, $2, $3, 'CREATED', 'CANDIDATE', 1, $4, $5, 0, $6)`,
      [randomUUID(), f.mohamed, later, history.session, history.liveHead, history.baseline + 9]);
    });
    await actAs(f.mohamed);
    const [currency] = await rt.truthCurrency(command.version);
    assert.equal(currency.currency_state, 'CURRENT',
      'A05 a sealed coordinate is not disturbed by knowledge that arrived after it');
    await asRole('postgres');
    const after = await rows(
      `SELECT selected_ordinal, point_digest FROM ${V.POINTS} WHERE projection_version_id = $1 ORDER BY selected_ordinal`,
      [command.projection]);
    assert.deepEqual(after, before, 'A05 and the frozen digests are byte-identical');
  });

  await report.isolated('A06 the frozen truth revalidates, and diverges when the canonical answer moves', async () => {
    await actAs(f.mohamed);
    const { command } = await previewOf(personal);
    const [intact] = await rt.truthCurrency(command.version);
    assert.equal(intact.currency_state, 'CURRENT', 'A06 the frozen truth is exactly what it froze');
    assert.equal(intact.divergence_class, null);
    // Now MOVE the canonical analytical answer at a represented coordinate, by
    // making a Reading known at a Session Position this Replay represents.
    const represented = Number((await rows(
      `SELECT min(represented_session_position) tc FROM ${V.POINTS} WHERE projection_version_id = $1`,
      [command.projection]))[0].tc);
    await rt.asReplica(async () => {
      const intruder = randomUUID();
      await q(`INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, version)
               VALUES ($1, $2, 'a reading inserted into the past', 'CAUSAL', 'GENERAL', $3, 'SYSTEM_GENERATED', 'CANDIDATE', 1)`,
      [intruder, f.mohamed, `CONVERSATION_SESSION:${history.session}`]);
      await q(`INSERT INTO public.historical_reading_events
                 (event_id, user_id, hypothesis_id, event_kind, to_status, to_version,
                  session_id, session_position, same_sp_event_sequence, world_version)
               VALUES ($1, $2, $3, 'CREATED', 'CANDIDATE', 1, $4, $5, 1, $6)`,
      [randomUUID(), f.mohamed, intruder, history.session, represented, history.baseline + 8]);
    });
    await actAs(f.mohamed);
    const [moved] = await rt.truthCurrency(command.version);
    assert.equal(moved.currency_state, 'DIVERGED', 'A06 a changed canonical answer at a represented coordinate diverges');
    assert.equal(moved.divergence_class, 'PROJECTION_MOVED');
    // AND A FINALIZATION OVER IT CANNOT COMMIT.
    await rejected(() => rt.finalize({ command: randomUUID(), replay: personal.replay, version: command.version }),
      ['40001'], /REPLAY_ANALYTICAL_PROJECTION_STALE/u);
    await asRole('postgres');
    assert.equal(await count(V.FINALIZATIONS, 'replay_version_id = $1', [command.version]), 0,
      'A06 and no finalization evidence was written');
  });
}

// -------------------------------------- 5. cuts, gaps and the render contract
async function verifyRenderTruth(report, f, drafts) {
  const { personal, gapped, voice } = drafts;

  await report.isolated('C01 a non-contiguous selection produces exact discontinuity facts', async () => {
    await actAs(f.mohamed);
    const { answer } = await previewOf(gapped);
    assert.ok(Number(answer.temporal_discontinuity_count) >= 1,
      'C01 a real gap in the captured source universe is recorded');
    await asRole('postgres');
    const gaps = await rows(
      `SELECT * FROM ${V.GAPS} WHERE selection_spec_version_id = $1 ORDER BY after_selected_ordinal`, [gapped.selection]);
    assert.equal(gaps.length, Number(answer.temporal_discontinuity_count));
    for (const gap of gaps) {
      assert.equal(gap.right_selected_ordinal, gap.after_selected_ordinal + 1, 'C01 the endpoints are adjacent selections');
      assert.ok(Number(gap.omitted_source_item_count) > 0, 'C01 and a real number of authorized items lies between them');
    }
    // A CONTIGUOUS SELECTION CREATES NO FAKE DISCONTINUITY.
    await actAs(f.mohamed);
    const contiguous = await previewOf(personal);
    assert.equal(Number(contiguous.answer.temporal_discontinuity_count), 0,
      'C01 a contiguous selection creates no discontinuity at all');
    await asRole('postgres');
    assert.equal(await count(V.GAPS, 'selection_spec_version_id = $1', [personal.selection]), 0);
  });

  await report.section('C02 a discontinuity names no omitted item and copies no content', async () => {
    await asRole('postgres');
    const columns = (await rows(
      `SELECT a.attname name, ty.typname type FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
        WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`, [V.GAPS])).map((c) => c);
    for (const column of columns) {
      assert.doesNotMatch(column.name, /body|_text$|transcript|audio|content|payload|digest|author|kind|classification/u,
        `C02 ${column.name} would disclose what was omitted`);
      assert.ok(!['json', 'jsonb', 'bytea'].includes(column.type));
    }
    const generated = (await rows(
      `SELECT a.attgenerated g FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attname = 'omitted_source_item_count'`,
      [V.GAPS]))[0].g;
    assert.equal(generated, 's', 'C02 the omitted count is GENERATED and no writer can author it');
  });

  await report.isolated('C03 the render contract binds the exact composition and its digest recomputes', async () => {
    await actAs(f.mohamed);
    const { command } = await previewOf(personal);
    await asRole('postgres');
    const [contract] = await rows(`SELECT * FROM ${V.CONTRACTS} WHERE id = $1`, [command.contract]);
    assert.equal(contract.analytical_projection_version_id, command.projection,
      'C03 the contract belongs to the exact analytical projection');
    assert.equal(contract.source_medium_class, rt.CONTRACT_POLICY.medium);
    assert.equal(contract.timing_integrity_policy, rt.CONTRACT_POLICY.timing);
    const [projection] = await rows(`SELECT * FROM ${V.PROJECTIONS} WHERE id = $1`, [command.projection]);
    const [{ recomputed }] = await rows(
      `SELECT public.replay_render_contract_digest_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                                                      $14, $15, $16, $17, $18, $19, $20, $21) recomputed`,
      [contract.replay_id, contract.source_manifest_version_id, contract.selection_spec_version_id,
        contract.analytical_projection_version_id, projection.projection_digest, contract.contract_schema_id,
        contract.source_medium_class, contract.original_medium_policy, contract.source_text_policy,
        contract.semantic_cut_policy, contract.temporal_discontinuity_policy, contract.timing_integrity_policy,
        contract.analytical_projection_policy, contract.camera_emphasis_policy, contract.motion_policy,
        contract.caption_provenance_policy, contract.accessibility_parity_policy,
        contract.reduced_motion_parity_policy, contract.editorial_annotation_policy,
        contract.discontinuity_count, projection.point_count]);
    assert.equal(recomputed, contract.contract_digest,
      'C03 the contract digest recomputes from its own bound composition, which is what finalization revalidates');
  });

  await report.isolated('C04 an audio-bearing selection cannot build a render contract', async () => {
    await actAs(f.mohamed);
    // The ONLY original-audio source this repository has is a Shared voice
    // note, whose frozen I-04G digest is a body IDENTITY over an opaque object
    // reference and a transcript: it attests no media bytes and grants no
    // delivery. At this baseline the source-class census refuses such a Replay
    // FIRST, so the procedural medium gate is unreachable - and the structural
    // one is what actually holds the line. Both are proven: the bounded class
    // here, and the 0102 CHECK that makes an audio-bearing contract row
    // unrepresentable (verify-migration-0102.mjs, V07).
    await rejected(() => rt.preview(rt.freshPreview(voice.replay, 1)),
      ['0A000'], /REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE/u);
    await asRole('postgres');
    assert.equal(await count(V.CONTRACTS, 'replay_id = $1', [voice.replay]), 0,
      'C04 no contract claiming an undeliverable medium exists');
    const medium = (await rows(
      `SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c
        WHERE c.conrelid = $1::regclass AND c.conname = 'replay_render_contract_versions_medium_check'`,
      [V.CONTRACTS]))[0].def;
    assert.match(medium, /ORIGINAL_TEXT_ONLY/u,
      'C04 and an audio-bearing render contract is structurally unrepresentable');
    // The captured item really is original-audio identity, so this scenario is
    // about a real audio-bearing Replay rather than a text one mislabelled.
    const [item] = await rows(
      `SELECT mi.original_medium FROM ${R.MANIFEST_ITEMS} mi WHERE mi.manifest_version_id = $1`, [voice.manifest]);
    assert.equal(item.original_medium, 'ORIGINAL_AUDIO', 'C04 the fixture really is an audio-bearing source');
  });
}

// ------------------------------------------------------------- 6. lifecycle
async function verifyLifecycle(report, f, drafts) {
  const { personal } = drafts;

  await report.isolated('L02 finalization requires the EXACT current previewed version', async () => {
    await actAs(f.mohamed);
    const { command } = await previewOf(personal);
    const before = await audienceCounts();
    await rejected(() => rt.finalize({ command: randomUUID(), replay: personal.replay, version: randomUUID() }),
      ['40001'], /REPLAY_VERSION_STALE/u);
    const [finalized] = await rt.finalize({ command: randomUUID(), replay: personal.replay, version: command.version });
    assert.equal(finalized.outcome, 'REPLAY_VERSION_FINALIZED');
    assert.equal(finalized.replay_lifecycle, 'FINALIZED');
    assert.equal(finalized.committed_replay_version_id, command.version);
    await asRole('postgres');
    assert.deepEqual(await audienceCounts(), before,
      'L02 FINALIZED creates no audience, no package, no approval and no external artifact');
    assert.equal(await count(V.FINALIZATIONS, 'replay_version_id = $1', [command.version]), 1,
      'L02 and appends exact-version evidence I-06C can read directly');
  });

  await report.isolated('L03 finalization evidence is append-only and a retry is idempotent', async () => {
    await actAs(f.mohamed);
    const { command } = await previewOf(personal);
    const finalizeCommand = randomUUID();
    const [first] = await rt.finalize({ command: finalizeCommand, replay: personal.replay, version: command.version });
    const [retry] = await rt.finalize({ command: finalizeCommand, replay: personal.replay, version: command.version });
    assert.equal(retry.outcome, 'ALREADY_COMMITTED', 'L03 an equivalent retry returns the original committed answer');
    assert.equal(retry.committed_replay_version_id, first.committed_replay_version_id);
    assert.equal(retry.committed_at.toISOString(), first.committed_at.toISOString());
    // The SAME command id carrying a DIFFERENT request is a deterministic conflict.
    await rejected(() => rt.finalize({ command: finalizeCommand, replay: personal.replay, version: randomUUID() }),
      ['23505'], /REPLAY_COMMAND_ID_CONFLICT/u);
    await asRole('postgres');
    await rejected(() => q(`UPDATE ${V.FINALIZATIONS} SET finalized_at = clock_timestamp() WHERE replay_version_id = $1`,
      [command.version]), ['55000'], /REPLAY_VERSION_COMPONENT_IS_IMMUTABLE/u);
    assert.equal(await count(V.FINALIZE_COMMANDS, 'replay_id = $1', [personal.replay]), 1,
      'L03 exactly one finalization command was committed');
  });

  await report.isolated('L04 a reopen mutates no old Replay Version and erases no finalization', async () => {
    await actAs(f.mohamed);
    const { command } = await previewOf(personal);
    await rt.finalize({ command: randomUUID(), replay: personal.replay, version: command.version });
    await asRole('postgres');
    const before = await rt.versionSnapshot(personal.replay);
    await actAs(f.mohamed);
    const [reopened] = await rt.reopen({ command: randomUUID(), replay: personal.replay, version: command.version });
    assert.equal(reopened.outcome, 'REPLAY_REOPENED_FOR_REVISION');
    assert.equal(reopened.replay_lifecycle, 'DRAFT');
    await asRole('postgres');
    const after = await rt.versionSnapshot(personal.replay);
    assert.deepEqual(after.versions, before.versions, 'L04 the old Replay Version is byte-identical');
    assert.deepEqual(after.projections, before.projections);
    assert.deepEqual(after.points, before.points);
    assert.deepEqual(after.contracts, before.contracts);
    assert.deepEqual(after.finalizations, before.finalizations,
      'L04 a previously finalized version stays historically finalized after later editing');
    assert.equal(await count(V.FINALIZATIONS, 'replay_version_id = $1', [command.version]), 1,
      'L04 and I-06C can still ask whether THIS exact version was finalized');
  });

  await report.isolated('L05 the next preview after a revision creates a NEW Replay Version', async () => {
    await actAs(f.mohamed);
    const first = await previewOf(personal);
    await rt.finalize({ command: randomUUID(), replay: personal.replay, version: first.command.version });
    await rt.reopen({ command: randomUUID(), replay: personal.replay, version: first.command.version });
    const second = await previewOf(personal);
    assert.notEqual(second.command.version, first.command.version, 'L05 a later preview is a NEW Replay Version');
    assert.equal(Number(second.answer.replay_version_revision), 2);
    await asRole('postgres');
    assert.equal(await count(V.VERSIONS, 'replay_id = $1', [personal.replay]), 2,
      'L05 both complete versions exist and neither was rewritten');
    const [pointer] = await rows(`SELECT * FROM ${V.POINTER} WHERE replay_id = $1`, [personal.replay]);
    assert.equal(pointer.current_replay_version_id, second.command.version);
    assert.equal(Number(pointer.pointer_revision), 2, 'L05 the pointer advanced exactly one revision');
    const history = await rows(
      `SELECT from_lifecycle, to_lifecycle FROM ${V.LIFECYCLE} WHERE replay_id = $1 ORDER BY event_ordinal`,
      [personal.replay]);
    assert.deepEqual(history.map((e) => `${e.from_lifecycle}->${e.to_lifecycle}`),
      ['DRAFT->PREVIEW_READY', 'PREVIEW_READY->FINALIZED', 'FINALIZED->DRAFT', 'DRAFT->PREVIEW_READY'],
      'L05 the append-only lifecycle history records exactly what happened');
  });

  await report.isolated('L01 a preview retry is idempotent and a reused command id conflicts', async () => {
    await actAs(f.mohamed);
    // A preview composed against a draft revision that has since MOVED cannot
    // silently commit over whatever is current.
    await rt.reviseDraft({ command: randomUUID(), replay: personal.replay, expectedRevision: 1,
      selection: randomUUID(), selected: personal.selected });
    await rejected(() => rt.preview(rt.freshPreview(personal.replay, 1)), ['40001'], /REPLAY_DRAFT_STALE/u);
    const command = rt.freshPreview(personal.replay, 2);
    const [first] = await rt.preview(command);
    const [retry] = await rt.preview(command);
    assert.equal(retry.outcome, 'ALREADY_COMMITTED', 'L01 an equivalent preview retry returns the committed answer');
    assert.equal(retry.committed_replay_version_id, first.committed_replay_version_id);
    await rejected(() => rt.preview({ ...command, version: randomUUID() }), ['23505'], /REPLAY_COMMAND_ID_CONFLICT/u);
    // A SECOND PREVIEW OF AN ALREADY PREVIEWED REPLAY IS REFUSED, not applied.
    await rejected(() => rt.preview(rt.freshPreview(personal.replay, 2)), ['55000'], /REPLAY_LIFECYCLE_INVALID/u);
    // And a preview composed against a draft revision that moved is stale.
    await rejected(() => rt.reopen({ command: randomUUID(), replay: personal.replay, version: randomUUID() }),
      ['40001'], /REPLAY_VERSION_STALE/u);
  });
}

// ---------------------------------------------------------- 7. forward safety
async function verifyForwardSafety(report, f, drafts) {
  await asRole('postgres');
  const pristine = {};
  for (const [name, fn] of [['projection', VFN.PROJECTION], ['contract', VFN.CONTRACT], ['cut', VFN.CUT],
    ['preview', VFN.PREVIEW], ['finalize', VFN.FINALIZE], ['resolver', VFN.RESOLVER]]) {
    pristine[name] = (await rows('SELECT pg_get_functiondef($1::regprocedure) definition', [fn]))[0].definition;
  }

  await report.isolated('forward safety: the I-06C and I-06D additions leave the catalog proof passing', async () => {
    await q(`CREATE TABLE public.replay_distribution_package_versions (
               id uuid PRIMARY KEY,
               replay_version_id uuid NOT NULL REFERENCES ${V.VERSIONS} (id) ON DELETE RESTRICT,
               destination_class text NOT NULL, prepared_at timestamptz NOT NULL)`);
    await q(`CREATE TABLE public.replay_source_loss_records (
               source_manifest_version_id uuid PRIMARY KEY REFERENCES ${R.MANIFESTS} (id) ON DELETE RESTRICT,
               noted_at timestamptz NOT NULL)`);
    await q(`CREATE FUNCTION public.launch_gated_prepare_replay_preview_v1(p_command_id uuid, p_replay_id uuid)
             RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN PERFORM 1; END$fn$`);
    await q('GRANT EXECUTE ON FUNCTION public.launch_gated_prepare_replay_preview_v1(uuid, uuid) TO authenticated');
    await q(`ALTER TABLE ${V.PREVIEW_COMMANDS} ADD COLUMN client_ref text`);
    await verifyCatalog();
  });

  // Every probe binds its mutation to a NAME and proves the mutation CHANGED
  // the text before it expects a refusal. A weakening that matched nothing
  // recreates the function unchanged and then reports that the contract
  // accepted a weakening that was never made - the anti-vacuity half.
  const probe = async (name, { from, mutate, marker, expect }) => {
    await report.isolated(name, async () => {
      const weakened = mutate(pristine[from]);
      assert.notEqual(weakened, pristine[from], `${name}: the weakening matched nothing, so nothing was proven`);
      if (marker) assert.ok(weakened.includes(marker), `${name}: the weakening did not introduce ${marker}`);
      await q(weakened);
      await expect();
    });
  };

  const refuses = { name: 'AssertionError' };
  await probe('f1 a projection over an unsupported source class is a regression', {
    from: 'projection',
    mutate: (definition) => definition.replace("IF manifest.source_class <> 'MY_WORLD' THEN", 'IF false THEN'),
    marker: 'IF false THEN',
    expect: async () => {
      await actAs(f.mohamed);
      // With the census gate removed the core reaches a Shared manifest anyway,
      // and STILL cannot produce a projection: the structural class binding and
      // the absent Personal coordinate both refuse it. Defence in depth, proven
      // rather than assumed.
      await rejected(() => rt.preview(rt.freshPreview(drafts.shared.replay, 1)),
        ['0A000', '23514', '23503', 'P0001']);
      await asRole('postgres');
      assert.equal(await count(V.PROJECTIONS, 'replay_id = $1', [drafts.shared.replay]), 0,
        'f1 a Shared manifest can never carry a Personal historical projection, even with the guard removed');
    },
  });

  await probe('f2 a frozen open-head projection is a regression', {
    from: 'projection',
    mutate: (definition) => definition.replace('IF NOT projected.sealed THEN', 'IF false THEN'),
    marker: 'IF false THEN',
    expect: async () => {
      await actAs(f.mohamed);
      const error = await rejected(() => rt.preview(rt.freshPreview(drafts.openHead.replay, 1)), ['23514']);
      assert.match(error.message, /replay_analytical_projection_points_(sealed|live_head)_check/u,
        'f2 the 0102 sealed CHECK refuses an open-head point even when the procedure stops looking');
      await asRole('postgres');
    },
  });

  await probe('f3 a blindly safe partial cut is a regression', {
    from: 'cut',
    mutate: (definition) => definition.replace(
      "CASE WHEN si.anchor_kind = 'WHOLE_ITEM' THEN 'SAFE' ELSE 'UNPROVEN' END", "'SAFE'"),
    marker: "'SAFE',",
    expect: async () => {
      await actAs(f.mohamed);
      const error = await rejected(() => rt.preview(rt.freshPreview(drafts.partial.replay, 1)), ['23514']);
      assert.match(error.message, /replay_semantic_cut_assessments_(safe|partial)_check/u,
        'f3 the 0102 conservative CHECK refuses a SAFE partial cut even when the derivation stops deriving');
      await asRole('postgres');
    },
  });

  await probe('f4 a preview that commits over a stale source is a regression', {
    from: 'preview',
    mutate: (definition) => definition.replace("IF currency IS DISTINCT FROM 'CURRENT' THEN", 'IF false THEN'),
    marker: 'IF false THEN',
    expect: async () => {
      await rt.asReplica(async () => {
        await q('DELETE FROM public.conversation_units WHERE id = $1', [drafts.personal.items[0]]);
      });
      await actAs(f.mohamed);
      const command = rt.freshPreview(drafts.personal.replay, 1);
      const [answer] = await rt.preview(command);
      assert.equal(answer.outcome, 'REPLAY_PREVIEW_READY',
        'f4 anti-vacuity: the weakened preview DID build a complete Replay Version over a source that is gone');
      // Which the frozen I-06A derivation still reports, so the regression is
      // detectable exactly where the removed gate used to consult it.
      const [currency] = await rt.currency(drafts.personal.manifest);
      assert.equal(currency.currency_state, 'STALE',
        'f4 and the canonical source currency says the bound source is no longer there');
      await asRole('postgres');
    },
  });

  await probe('f5 a finalization that skips projection revalidation is a regression', {
    from: 'finalize',
    mutate: (definition) => definition.replace("WHERE t.currency_state = 'DIVERGED';", 'WHERE false;'),
    marker: 'WHERE false;',
    expect: async () => {
      await actAs(f.mohamed);
      const { command } = await previewOf(drafts.personal);
      await rt.asReplica(async () => {
        const intruder = randomUUID();
        await q(`INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status, version)
                 VALUES ($1, $2, 'a reading inserted into the past', 'CAUSAL', 'GENERAL', $3, 'SYSTEM_GENERATED', 'CANDIDATE', 1)`,
        [intruder, f.mohamed, `CONVERSATION_SESSION:${drafts.history.session}`]);
        await q(`INSERT INTO public.historical_reading_events
                   (event_id, user_id, hypothesis_id, event_kind, to_status, to_version,
                    session_id, session_position, same_sp_event_sequence, world_version)
                 VALUES ($1, $2, $3, 'CREATED', 'CANDIDATE', 1, $4, 1, 2, $5)`,
        [randomUUID(), f.mohamed, intruder, drafts.history.session, drafts.history.baseline + 7]);
      });
      await actAs(f.mohamed);
      const [answer] = await rt.finalize({ command: randomUUID(), replay: drafts.personal.replay, version: command.version });
      assert.equal(answer.outcome, 'REPLAY_VERSION_FINALIZED',
        'f5 anti-vacuity: the weakened finalization DID commit over a moved analytical answer');
      // Which the canonical revalidation still reports, so the regression is
      // detectable exactly where the gate used to be.
      const [currency] = await rt.truthCurrency(command.version);
      assert.equal(currency.currency_state, 'DIVERGED',
        'f5 and the canonical truth revalidation says the frozen answer moved');
      await asRole('postgres');
    },
  });

  await probe('f6 a preview reachable by an application role is a regression', {
    from: 'preview',
    mutate: (definition) => `${definition};\nGRANT EXECUTE ON FUNCTION ${VFN.PREVIEW} TO authenticated`,
    marker: 'GRANT EXECUTE',
    expect: async () => {
      assert.equal(await rt.canExecute('authenticated', VFN.PREVIEW), true,
        'f6 anti-vacuity: the weakened grant really did reach an application role');
      await assert.rejects(verifyCatalog, refuses, 'f6 the canonical posture proof ACCEPTED an application-reachable preview');
    },
  });

  await probe('f7 a read boundary that answers a stranger is a regression', {
    from: 'resolver',
    mutate: (definition) => definition.replace(
      'WHERE r.id = p_replay_id AND r.created_by_user_id = p_user_id;', 'WHERE r.id = p_replay_id;'),
    marker: 'WHERE r.id = p_replay_id;',
    expect: async () => {
      await actAs(f.mohamed);
      await previewOf(drafts.personal);
      await asRole('service_role');
      assert.equal((await rt.currentVersion(drafts.personal.replay, f.hadir)).length, 1,
        'f7 anti-vacuity: the weakened boundary really did answer a stranger');
      // BOTH SIDES, inside one probe: the pristine boundary answers that same
      // stranger with zero rows over the same committed state.
      await asRole('postgres');
      await q(pristine.resolver);
      await asRole('service_role');
      assert.equal((await rt.currentVersion(drafts.personal.replay, f.hadir)).length, 0,
        'f7 the creator-exact boundary discloses nothing to a human who created no Replay');
      assert.equal((await rt.currentVersion(drafts.personal.replay, f.mohamed)).length, 1,
        'f7 while still answering the exact creator');
      await asRole('postgres');
    },
  });
}

// ------------------------------------------------------------ 8. concurrency
async function verifyConcurrency(report, c, committed) {
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    await report.section('R01 competing previews serialize and the stale loser fails', async () => {
      await rt.actAs(c.mohamed);
      await q('BEGIN');
      const winner = rt.freshPreview(committed.personal.replay, 1);
      await rt.preview(winner);
      await actAs2(c.mohamed);
      const loser = q2('SELECT * FROM public.prepare_replay_preview_v1($1, $2, $3, $4, $5, $6)',
        [randomUUID(), committed.personal.replay, 1, randomUUID(), randomUUID(), randomUUID()]);
      assert.equal(await rt.stillPending(loser), true, 'R01 the second preview waits on the Replay row');
      await q('COMMIT');
      await assert.rejects(loser, (error) => error.code === '55000' && /REPLAY_LIFECYCLE_INVALID/u.test(error.message),
        'R01 the stale loser is refused rather than applied to whatever is current');
      await asRole('postgres');
      assert.equal(await count(V.VERSIONS, 'replay_id = $1', [committed.personal.replay]), 1,
        'R01 exactly one complete Replay Version exists');
      committed.currentVersion = winner.version;
    });

    await report.section('R03 competing finalizations cannot both commit', async () => {
      await rt.actAs(c.mohamed);
      await q('BEGIN');
      await rt.finalize({ command: randomUUID(), replay: committed.personal.replay, version: committed.currentVersion });
      await actAs2(c.mohamed);
      const finalizing = q2('SELECT * FROM public.finalize_replay_version_v1($1, $2, $3)',
        [randomUUID(), committed.personal.replay, committed.currentVersion]);
      assert.equal(await rt.stillPending(finalizing), true, 'R03 the second finalization waits on the Replay row');
      await q('COMMIT');
      await assert.rejects(finalizing, (error) => error.code === '55000' && /REPLAY_LIFECYCLE_INVALID/u.test(error.message),
        'R03 the second finalization is refused');
      await asRole('postgres');
      assert.equal(await count(V.FINALIZATIONS, 'replay_version_id = $1', [committed.currentVersion]), 1,
        'R03 exactly one finalization of that exact version exists');
      assert.equal(await count(V.FINALIZE_COMMANDS, 'replay_id = $1', [committed.personal.replay]), 1);
    });

    await report.section('R02 a source deletion racing finalization cannot commit', async () => {
      // A fresh version to finalize, then the source disappears under it.
      await rt.actAs(c.mohamed);
      await rt.reopen({ command: randomUUID(), replay: committed.personal.replay, version: committed.currentVersion });
      const next = rt.freshPreview(committed.personal.replay, 1);
      await rt.preview(next);
      // The other connection removes a bound source and holds it uncommitted.
      await q2('BEGIN');
      await q2("SET LOCAL session_replication_role = 'replica'");
      await q2('DELETE FROM public.conversation_units WHERE id = $1', [committed.personal.items[0]]);
      await rt.actAs(c.mohamed);
      const finalizing = q('SELECT * FROM public.finalize_replay_version_v1($1, $2, $3)',
        [randomUUID(), committed.personal.replay, next.version]);
      assert.equal(await rt.stillPending(finalizing), true,
        'R02 the finalization waits on the source row the other connection is removing');
      await q2('COMMIT');
      await assert.rejects(finalizing, (error) => error.code === '40001' || error.code === '0A000',
        'R02 a stale finalization cannot commit once the source is gone');
      await asRole('postgres');
      assert.equal(await count(V.FINALIZATIONS, 'replay_version_id = $1', [next.version]), 0,
        'R02 and no finalization evidence was written for it');
      committed.currentVersion = next.version;
    });
  } finally {
    await close();
  }
}

// -------------------------------------------------------------------- main
runVerifier('0103', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0103', { query: q, restore: () => asRole('postgres') });
  stage('catalog');
  // Through the aggregator, not ahead of it: a catalog defect is independent of
  // every row-level scenario below, and stopping the run on it would cost a
  // whole focused round per finding - which is exactly what this gate exists to
  // prevent.
  await report.section('catalog posture, the ONE read boundary and the canonical projection it consumes',
    verifyCatalog);

  const f = rt.newFixture();
  await q('BEGIN');
  try {
    stage('fixtures');
    await rt.provision(f);
    await rt.provisionIdentities(f);
    const history = await rt.provisionHistoricalSession(f.mohamed, { units: 5 });
    const legacySession = await rt.provisionLegacySession(f.mohamed);
    // ONE owned Public Experience, taken to READY_FOR_REVIEW through the frozen
    // I-05A primitives alone, so the Public Replay below is a real one.
    const ready = await rt.bringToReady(f, { experience: f.experience, manifest: f.manifest, version: f.version,
      shared: [f.mohamedMaterial] });
    await asRole('postgres');
    const packageItems = (await rows(
      `SELECT package_item_id id FROM public.publication_package_manifest_items
        WHERE manifest_version_id = $1 ORDER BY item_ordinal`, [ready.manifest])).map((item) => item.id);
    assert.ok(packageItems.length >= 1, 'the fixture Public package carries bounded items to select');
    const units = history.units;
    const drafts = {
      history,
      personal: await draftOver(f, history.session, { items: units.slice(0, 3), selected: units.slice(0, 3) }),
      gapped: await draftOver(f, history.session, { items: units, selected: [units[0], units[3]] }),
      partial: await draftOver(f, history.session, { items: units.slice(0, 2), selected: units.slice(0, 2),
        starts: [null, 0], ends: [null, 4] }),
      openHead: { ...await draftOver(f, history.session, { items: units, selected: [units[units.length - 1]] }),
        session: history.session, liveHead: history.liveHead },
      legacy: { ...await draftOver(f, legacySession.session, { items: [legacySession.unit], selected: [legacySession.unit] }),
        session: legacySession.session },
      shared: await draftOver(f, null, { sourceClass: 'SHARED_WORLD', context: f.world,
        items: [f.mohamedMaterial], selected: [f.mohamedMaterial] }),
      voice: await draftOver(f, null, { sourceClass: 'SHARED_WORLD', context: f.world,
        items: [f.voiceMaterial], selected: [f.voiceMaterial] }),
      publicExperience: await draftOver(f, null, { sourceClass: 'PUBLIC_EXPERIENCE', context: f.experience,
        version: ready.version, items: packageItems, selected: packageItems }),
    };
    await asRole('postgres');

    stage('capability matrix');
    await verifyCapability(report, f, drafts);
    stage('analytical truth');
    await verifyAnalytical(report, f, drafts);
    stage('render truth');
    await verifyRenderTruth(report, f, drafts);
    stage('lifecycle');
    await verifyLifecycle(report, f, drafts);

    stage('forward safety');
    await asRole('postgres');
    await q('SAVEPOINT forward_safety');
    try {
      await verifyForwardSafety(report, f, drafts);
    } finally {
      await q('ROLLBACK TO SAVEPOINT forward_safety').catch(() => undefined);
      await q('RELEASE SAVEPOINT forward_safety').catch(() => undefined);
      await asRole('postgres');
    }
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back section', verifyCatalog);

  stage('concurrency');
  const c = rt.newFixture();
  c.humans = [c.mohamed, c.hadir, c.stranger, c.reader];
  c.experiences = [];
  let committed = null;
  try {
    await asRole('postgres');
    await q('BEGIN');
    try {
      await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [c.humans]);
      const history = await rt.provisionHistoricalSession(c.mohamed, { units: 4 });
      const personal = await draftOver(c, history.session,
        { items: history.units.slice(0, 3), selected: history.units.slice(0, 3) });
      committed = { history, personal: { ...personal, items: history.units } };
      await asRole('postgres');
    } finally {
      await q('COMMIT');
    }
    await verifyConcurrency(report, c, committed);
  } finally {
    stage('concurrency: fixture removal');
    await rt.removeCommittedReplayVersions(c.humans);
    await rt.removeCommittedReplays(c.humans);
    await rt.removeHistoricalFixture(c.humans);
    await rt.removeFixtureHumans(c.humans);
  }

  stage('report');
  await asRole('postgres');
  await report.section('the catalog is exactly what the migration installed, after every fixture is gone',
    verifyCatalog);
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${V.VERSIONS} WHERE replay_id IN
               (SELECT id FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])))
          + (SELECT count(*) FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.hypotheses WHERE user_id = ANY($1::uuid[])) AS residue`,
    [[f.mohamed, f.hadir, f.stranger, f.reader, ...c.humans]]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
