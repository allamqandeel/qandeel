// Real-PostgreSQL verifier for migration 0118 - ordinary Shared material in an
// ACTIVE / INTRODUCTION World.
//
// Runs against a FULLY migrated database and proves, from live catalogs and
// live rows, that the two frozen I-04G commit cores now serve BOTH frozen World
// modes through ONE canonical truth and history model - and that the
// Introduction branch is strictly the narrower of the two.
//
// This closes a gap independent review found in I-07D: after a Mutual Match the
// two humans were given a Shared World they could not speak in. Migration 0115
// gave the phase one producer - the reserved EXPLICIT_DISCLOSURE - and the
// ordinary cores still refused every World that was not ACTIVE / STANDARD.
//
// Every fixture reaches a live ACTIVE / INTRODUCTION World through the REAL
// I-07A, I-07B and I-07C boundaries as the humans involved, never by a direct
// write, and every Shared material is committed through the REAL frozen I-04G
// entry points - the same ones a Standard World calls, with no Introduction
// wrapper anywhere.
//
//   P01 posture: both cores are postgres-owned SECURITY DEFINER, search_path
//       pinned and executable by no application role; the lifecycle gate is
//       unconditional; the Introduction branch additionally requires a LIVE
//       Introduction Record and exactly two humans; an unspelled World mode is
//       still refused; the human core still derives auth.uid() and QANDEEL still
//       derives no human; neither core deletes, mutates a World, an episode or a
//       Record, writes a grant or entitlement, or consults Matching authority;
//       both still lock the World row first; both typed human entry points still
//       delegate and hold no gate of their own; the live censuses hold - three
//       material producers, three history producers, one disclosure producer,
//       two body stores, one destroyer
//
//   M01 HUMAN_TEXT commits in an Introduction and is visible to exactly the two
//   M02 HUMAN_VOICE_NOTE commits with the same exact audience
//   M03 QANDEEL_OUTPUT and QANDEEL_ANALYSIS commit under the EXISTING I-03
//       evidence envelope, and stale or tampered evidence is still refused
//   M04 a third human and a non-member get nothing, through every reader
//   M05 ordinary material and an EXPLICIT_DISCLOSURE coexist in ONE history
//   M06 the author still owns their own Introduction material and can delete it
//   M07 the Introduction branch is STRICTER: no live Record, no commit
//   M08 an equivalent retry is idempotent and a used command id fails closed
//
//   T01 END wins first: new material cannot commit into a closed Introduction
//   T02 material wins first: END snapshots it into the exact closed-view
//       entitlement, and both humans keep exactly what they could see
//   T03 SUCCESS wins: the SAME material and history continue into ACTIVE /
//       STANDARD with nothing copied, rewritten or re-derived, and ordinary
//       Standard commit works on the continued World
//
//   C01 material commit versus END, pinned on an observable lock-wait barrier
//   C02 material commit versus SUCCESS, pinned the same way, with no hybrid
//
//   G01 NO GHOST: a late transactional failure leaves ZERO surviving effects
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createIntroductionRuntime, D, DFN, I07D_GUARDS,
  evidenceFor, digestOutput, runVerifier, APP_ROLES, PFN,
} from './introduction-lifecycle-verifier-support.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, actAs, rejected } = rt;

const INVALID = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONTRADICTORY = ['P0001'];
const CONFLICT = ['23505'];
const STALE = ['40001'];

const HUMAN_CORE = 'public.commit_shared_world_human_material_v1';
const QANDEEL_CORE = 'public.commit_shared_world_qandeel_material_v1';
const HUMAN_SIG = `${HUMAN_CORE}(uuid, uuid, uuid, uuid, text, text, text, text, integer)`;
const QANDEEL_SIG = `${QANDEEL_CORE}(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid[], text[])`;
const TEXT_ENTRY = 'public.commit_shared_world_human_text_v1';
const VOICE_ENTRY = 'public.commit_shared_world_human_voice_note_v1';

const terminalIds = () => ({ command: randomUUID(), lowerAct: randomUUID(), higherAct: randomUUID() });

/** Strips `--` comment lines, so a positional assertion cannot be satisfied by prose. */
const stripComments = (source) => source.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n');

const sourceOf = async (signature) =>
  (await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [signature]))[0].prosrc;

const censusOf = async (pattern) => Number((await rows(
  `SELECT count(*) n FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid AND pr.prosrc ~ $1`, [pattern]))[0].n);

// ---------------------------------------------------------------------------
// P01 - posture, from the live catalog.
// ---------------------------------------------------------------------------

async function verifyPosture() {
  await asRole('postgres');

  for (const signature of [HUMAN_SIG, QANDEEL_SIG]) {
    const [fn] = await rows(
      `SELECT pr.proowner::regrole::text owner, pr.prosecdef, pr.provolatile, pr.proconfig
         FROM pg_proc pr WHERE pr.oid = $1::regprocedure`, [signature]);
    assert.ok(fn, `${signature} exists`);
    assert.equal(fn.owner, 'postgres', `${signature} is owned by postgres`);
    assert.equal(fn.prosecdef, true, `${signature} is SECURITY DEFINER`);
    assert.equal(fn.provolatile, 'v', `${signature} mutates and is VOLATILE`);
    assert.ok((fn.proconfig ?? []).some((cfg) => cfg === 'search_path=' || cfg === 'search_path=""'),
      `${signature} pins an empty search_path`);

    const [{ allowed: publicExecute }] = await rows(
      "SELECT has_function_privilege('public', $1, 'EXECUTE') allowed", [signature]);
    assert.equal(publicExecute, false, `PUBLIC must not execute ${signature}`);
    for (const role of APP_ROLES) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) allowed', [role, signature, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not execute ${signature} before the CW2-08 Launch Gate exists`);
    }

    // THE GATE, read from the real stored body with its prose removed, so an
    // explanatory comment can never satisfy a structural assertion.
    const body = stripComments(await sourceOf(signature));
    assert.match(body, /IF world\.lifecycle <> 'ACTIVE' THEN/u,
      `${signature} refuses every World that is not ACTIVE, before it considers any phase`);
    assert.match(body, /ELSIF world\.phase = 'INTRODUCTION' THEN/u,
      `${signature} branches on the Introduction phase rather than refusing it`);
    assert.match(body, /FROM public\.introduction_records r/u,
      `${signature} admits an Introduction World only against its canonical Record`);
    assert.match(body, /r\.world_id = p_world_id AND r\.introduction_status = 'ACTIVE'/u,
      `${signature} requires that exact Record to still be ACTIVE - the narrower envelope`);
    assert.match(body, /IF world\.phase = 'INTRODUCTION' AND array_length\(audience, 1\) <> 2 THEN/u,
      `${signature} refuses an Introduction whose derived audience is not exactly two humans`);
    assert.match(body, /ELSIF world\.phase <> 'STANDARD' THEN/u,
      `${signature} still refuses every World mode outside the two frozen ones`);

    // AND THE 0090 POSTURE IS UNCHANGED, clause by clause.
    assert.doesNotMatch(body, /DELETE FROM/iu, `${signature} deletes nothing: committing destroys nothing`);
    assert.doesNotMatch(body, /UPDATE public\.shared_worlds|INSERT INTO public\.shared_worlds/u,
      `${signature} creates, closes and mutates no Shared World`);
    assert.doesNotMatch(body, /INSERT INTO public\.shared_world_membership_episodes|UPDATE public\.shared_world_membership_episodes/u,
      `${signature} creates and mutates no membership episode`);
    assert.doesNotMatch(body, /UPDATE public\.introduction_records|INSERT INTO public\.introduction_records/u,
      `${signature} reads the Introduction Record and never moves it`);
    assert.doesNotMatch(body, /shared_world_history_access_grants|shared_world_standard_closed_view_entitlements|introduction_closed_view_entitlements/u,
      `${signature} writes no history grant and no closed-World entitlement`);
    assert.doesNotMatch(body, /matching_context_grants|matching_active_introduction_claims|introduction_terminal_commits/u,
      `${signature} consults no Matching authority: speaking in an Introduction is not a Matching act`);
    assert.doesNotMatch(body, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/u,
      `${signature} persists one database-owned instant, never a transaction clock`);
    assert.doesNotMatch(body, /pg_advisory|LOCK TABLE/iu, `${signature} takes only canonical row locks`);
    assert.match(body, /FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE/u,
      `${signature} still locks the exact World row FIRST`);
    assert.match(body, /public\.resolve_shared_world_human_audience_snapshot_v1\(p_world_id\)/u,
      `${signature} still derives its audience through the frozen I-03D boundary`);
    assert.equal((body.match(/clock_timestamp\(\)/gu) ?? []).length, 1,
      `${signature} reads the canonical instant exactly once`);
    assert.doesNotMatch(body, /'EXPLICIT_DISCLOSURE'/u,
      `${signature} did not acquire the reserved disclosure kind by being extended`);
  }

  // THE ACTOR RULES ARE UNCHANGED IN BOTH DIRECTIONS.
  assert.match(await sourceOf(HUMAN_SIG), /auth\.uid\(\)/u, 'the human commit core still derives its human from auth.uid()');
  assert.doesNotMatch(await sourceOf(QANDEEL_SIG), /auth\.uid/u,
    'the QANDEEL commit core derives no human: a system actor is never a consent or ownership principal, in either phase');
  assert.match(await sourceOf(QANDEEL_SIG), /WHEN reasoning_edges > 0 THEN 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'/u,
    'and an unresolvable additional human requirement is still recorded as unresolved');

  // THE TYPED HUMAN ENTRY POINTS STILL DELEGATE AND GATE NOTHING, which is what
  // makes replacing the ONE core sufficient for both of them.
  for (const entry of [TEXT_ENTRY, VOICE_ENTRY]) {
    const [{ src }] = await rows(
      `SELECT pr.prosrc src FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
        WHERE n.nspname = 'public' AND pr.proname = $1`, [entry.replace('public.', '')]);
    assert.match(src, /public\.commit_shared_world_human_material_v1/u, `${entry} still delegates to the ONE core`);
    assert.doesNotMatch(stripComments(src), /world\.phase|world\.lifecycle/u,
      `${entry} holds no lifecycle gate of its own`);
  }

  // ONE CANONICAL SHARED TRUTH MODEL. This is the load-bearing architectural
  // claim: the Introduction did not get a material system of its own.
  assert.equal(await censusOf('INSERT INTO public\\.shared_world_materials\\y'), 3,
    'exactly three reviewed producers write a Shared material: the human core, the QANDEEL core and the one disclosure producer');
  assert.equal(await censusOf('INSERT INTO public\\.shared_world_history_items\\y'), 3,
    'exactly three reviewed producers write a Shared history item, and they are the same three');
  const [{ n: disclosureProducers }] = await rows(
    `SELECT count(*) n FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND pr.prosrc ~ '''EXPLICIT_DISCLOSURE''' AND pr.prosrc ~ 'INSERT INTO public\\.shared_world_materials\\y'`);
  assert.equal(Number(disclosureProducers), 1, 'and exactly one of them writes the reserved EXPLICIT_DISCLOSURE material');
  const [{ n: bodyStores }] = await rows(
    `SELECT count(*) n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname ~ '^shared_world_.*_material_bodies$'`);
  assert.equal(Number(bodyStores), 2, 'the two frozen body relations are still the only Shared material body stores');
  assert.equal(await censusOf(
    'DELETE FROM public\\.shared_world_text_material_bodies|DELETE FROM public\\.shared_world_voice_note_material_bodies'
    + '|DELETE FROM public\\.introduction_disclosure_text_payloads|DELETE FROM public\\.introduction_disclosure_media_payloads'), 1,
  'and exactly the one canonical owner-deletion primitive may destroy a body or a disclosure payload');
}

// ---------------------------------------------------------------------------
// M - ordinary material inside a live Introduction.
// ---------------------------------------------------------------------------

async function verifyMaterial(report, humans) {
  const [one, two, third] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await runMaterial(report, one, two, third);
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

async function runMaterial(report, one, two, third) {
  await report.isolated('M01 HUMAN_TEXT commits in an Introduction and is visible to exactly the two matched humans', async () => {
    const f = await rt.bringToIntroduction(one, two);
    const said = await rt.commitText(f.world, f.lower, 'a first ordinary thing said inside the Introduction');
    assert.equal(said.outcome, 'MATERIAL_COMMITTED', 'M01 the frozen human entry point commits into an Introduction World');
    assert.equal(said.committed_material_kind, 'HUMAN_TEXT');
    assert.equal(Number(said.audience_size), 2, 'M01 the derived audience is exactly the two matched humans');

    // THE EXACT AUDIENCE, from the canonical open membership episodes.
    assert.deepEqual(await rt.baselineViewersOf(said.item), [f.lower, f.higher].sort(),
      'M01 the baseline viewers are exactly the two humans, derived and never supplied');
    assert.deepEqual(await rt.requiredApproversOf(said.item), [f.lower],
      'M01 and the material authority is the author alone: membership creates no co-ownership');

    // BOTH HUMANS SEE IT, through the ONE canonical visibility entry point.
    for (const human of [f.lower, f.higher]) {
      assert.deepEqual(await rt.visibleItems(f.world, human), [said.item],
        `M01 ${human === f.lower ? 'the author' : 'the counterpart'} sees the statement`);
    }
    const [resolved] = await rt.resolveMaterial(f.world, f.higher);
    assert.equal(resolved.text_body, 'a first ordinary thing said inside the Introduction',
      'M01 and the counterpart resolves the real body through the ONE narrow material resolver');
    assert.equal(resolved.author_user_id, f.lower, 'M01 attributed to its real author');

    // THE WORLD ITSELF IS UNTOUCHED: speaking is not a lifecycle act.
    const [world] = await rows('SELECT lifecycle, phase, closed_at FROM public.shared_worlds WHERE id = $1', [f.world]);
    assert.deepEqual([world.lifecycle, world.phase, world.closed_at], ['ACTIVE', 'INTRODUCTION', null],
      'M01 the World is still exactly the live Introduction it was');
    const record = await rt.recordRow(f.record);
    assert.equal(record.introduction_status, 'ACTIVE', 'M01 and its Record never moved');
  });

  await report.isolated('M02 HUMAN_VOICE_NOTE commits with the same exact audience', async () => {
    const f = await rt.bringToIntroduction(one, two);
    const audio = `introduction-audio/${randomUUID()}`;
    const note = await rt.commitVoice(f.world, f.higher, audio, 'a transcript of the note', 4200);
    assert.equal(note.outcome, 'MATERIAL_COMMITTED');
    assert.equal(note.committed_material_kind, 'HUMAN_VOICE_NOTE', 'M02 the kind is the typed entry point, not a caller choice');
    assert.equal(Number(note.audience_size), 2, 'M02 the same exact two-human audience');
    assert.deepEqual(await rt.baselineViewersOf(note.item), [f.lower, f.higher].sort());
    assert.deepEqual(await rt.requiredApproversOf(note.item), [f.higher], 'M02 owned by its own author');
    const [resolved] = await rt.resolveMaterial(f.world, f.lower);
    assert.equal(resolved.audio_object_ref, audio, 'M02 the counterpart resolves the real opaque media reference');
    assert.equal(resolved.transcript_text, 'a transcript of the note');
    assert.equal(resolved.text_body, null, 'M02 and a voice note never masquerades as text');
  });

  await report.isolated('M03 QANDEEL commits under the EXISTING I-03 evidence envelope, and bad evidence is still refused', async () => {
    const f = await rt.bringToIntroduction(one, two);
    // QANDEEL welcomes the pair. It is a SYSTEM actor: no session subject at all.
    const welcome = await rt.commitQandeel(f.world, 'a welcome that breaks the ice', { kind: 'QANDEEL_OUTPUT' });
    assert.equal(welcome.outcome, 'MATERIAL_COMMITTED');
    assert.equal(welcome.committed_material_kind, 'QANDEEL_OUTPUT');
    assert.equal(Number(welcome.audience_size), 2, 'M03 delivered to exactly the two humans');
    assert.equal((await rt.materialRow(welcome.material)).author_user_id, null,
      'M03 and QANDEEL is recorded as a system actor with no human author');

    const said = await rt.commitText(f.world, f.lower, 'something safe to analyse');
    const analysis = await rt.commitQandeel(f.world, 'a bounded safe observation about what you share', {
      kind: 'QANDEEL_ANALYSIS', sources: [said.material],
    });
    assert.equal(analysis.outcome, 'MATERIAL_COMMITTED');
    assert.equal(Number(analysis.material_dependency_edges), 1, 'M03 the analysis binds its exact source');

    // NO EXTRA PRIVACY AUTHORITY ARRIVES WITH THE PHASE. The exact same
    // evidence rules that govern a Standard output govern this one.
    const stale = evidenceFor('an output for a different audience', 'stale',
      await rt.audienceSnapshotRef(f.world));
    await rejected(() => rt.commitQandeel(f.world, 'a DIFFERENT body under the same evidence',
      { evidence: { ...stale, outputDigest: digestOutput('an output for a different audience') } }),
    INVALID, /SHARED_WORLD_MATERIAL_EVIDENCE_INVALID/u);
    const tampered = evidenceFor('an untampered body', 'tampered', await rt.audienceSnapshotRef(f.world));
    await rejected(() => rt.commitQandeel(f.world, 'an untampered body',
      { evidence: { ...tampered, readiness: digestOutput('not the fingerprint') } }),
    INVALID, /SHARED_WORLD_MATERIAL_EVIDENCE_INVALID/u);
    await rejected(() => rt.commitQandeel(f.world, 'an output proven for another World',
      { evidence: evidenceFor('an output proven for another World', 'foreign', `sha256:${'a'.repeat(64)}`) }),
    STALE, /SHARED_WORLD_MATERIAL_STALE/u);
  });

  await report.isolated('M04 a third human and a non-member get nothing, through every reader', async () => {
    const f = await rt.bringToIntroduction(one, two);
    const said = await rt.commitText(f.world, f.lower, 'a private thing between exactly two people');
    const stranger = randomUUID();
    for (const outsider of [third, stranger]) {
      assert.deepEqual(await rt.visibleItems(f.world, outsider), [],
        'M04 a human with no open episode in this World sees nothing at all');
      assert.deepEqual(await rt.resolveMaterial(f.world, outsider), [],
        'M04 and resolves no material, with no distinguishable error');
    }
    assert.deepEqual((await rt.baselineViewersOf(said.item)).filter((v) => v === third || v === stranger), [],
      'M04 and neither was ever in the delivery audience');
    // A third human cannot COMMIT into the World either.
    await rejected(() => rt.commitText(f.world, third, 'not mine to say'),
      UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  });

  await report.isolated('M05 ordinary material and an EXPLICIT_DISCLOSURE coexist in ONE history', async () => {
    const f = await rt.bringToIntroduction(one, two);
    const said = await rt.commitText(f.world, f.lower, 'before the disclosure');
    const disclosed = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Q', fieldKey: null });
    const analysed = await rt.commitQandeel(f.world, 'after the disclosure', { kind: 'QANDEEL_ANALYSIS' });

    const items = await rt.visibleItems(f.world, f.higher);
    assert.equal(items.length, 3, 'M05 the counterpart sees all three in ONE history, not two separate ones');
    assert.deepEqual(items, [said.item, disclosed.ids.item, analysed.item],
      'M05 in one canonical chronological order, from the ONE visibility entry point');

    // ONE material relation, three kinds, one history relation.
    const kinds = (await rows(
      `SELECT m.material_kind FROM ${D.MATERIALS} m WHERE m.world_id = $1 ORDER BY m.established_at`, [f.world]))
      .map((row) => row.material_kind);
    assert.deepEqual(kinds, ['HUMAN_TEXT', 'EXPLICIT_DISCLOSURE', 'QANDEEL_ANALYSIS'],
      'M05 all three live in the ONE canonical material relation');
  });

  await report.isolated('M06 the author still owns their own Introduction material and can delete it', async () => {
    const f = await rt.bringToIntroduction(one, two);
    const said = await rt.commitText(f.world, f.lower, 'said, then withdrawn');
    const analysis = await rt.commitQandeel(f.world, 'derived from what was said', { sources: [said.material] });

    // The counterpart is not the owner and cannot delete it.
    await actAs(f.higher);
    await rejected(() => rt.deleteMaterial(randomUUID(), f.world, said.material, randomUUID()),
      UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
    await asRole('postgres');

    await actAs(f.lower);
    const [deleted] = await rt.deleteMaterial(randomUUID(), f.world, said.material, randomUUID());
    await asRole('postgres');
    assert.equal(deleted.outcome, 'MATERIAL_DELETED', 'M06 the author deletes their own material, exactly as in a Standard World');
    assert.equal(Number(deleted.invalidated_targets), 1, 'M06 and the derivative is invalidated with it');
    assert.deepEqual(await rt.visibleItems(f.world, f.higher), [analysis.item],
      'M06 the deleted item leaves the counterpart visibility and the derivative remains as a real historical event');
  });

  await report.isolated('M07 the Introduction branch is STRICTER: without a live Record nothing commits', async () => {
    const f = await rt.bringToIntroduction(one, two);
    await q('SAVEPOINT m07_record');
    try {
      // The Record is moved out of ACTIVE beneath the World, which the frozen
      // lifecycle never does on its own. The commit must refuse rather than
      // trust the phase alone - the coherence floor the branch adds.
      await q('UPDATE public.introduction_records SET introduction_status = $1 WHERE id = $2', ['CLOSED', f.record]);
      await rejected(() => rt.commitText(f.world, f.lower, 'into an Introduction that is no longer live'),
        UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
      await rejected(() => rt.commitQandeel(f.world, 'an analysis of a settled Introduction'),
        UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
    } finally {
      await q('ROLLBACK TO SAVEPOINT m07_record');
      await q('RELEASE SAVEPOINT m07_record');
      await asRole('postgres');
    }
    // And with the Record restored, the very same commit succeeds - so the
    // refusal above was the Record and nothing else.
    const said = await rt.commitText(f.world, f.lower, 'into a live Introduction');
    assert.equal(said.outcome, 'MATERIAL_COMMITTED', 'M07 the same commit succeeds once the Record is live again');
  });

  await report.isolated('M08 an equivalent retry is idempotent and a used command id fails closed', async () => {
    const f = await rt.bringToIntroduction(one, two);
    const ids = { command: randomUUID(), material: randomUUID(), item: randomUUID() };
    const first = await rt.commitText(f.world, f.lower, 'an idempotent statement', ids);
    const again = await rt.commitText(f.world, f.lower, 'an idempotent statement', ids);
    assert.deepEqual(again, first, 'M08 an equivalent retry is historically stable in an Introduction too');
    await actAs(f.lower);
    await rejected(() => rows(
      `SELECT * FROM public.commit_shared_world_human_text_v1($1,$2,$3,$4,$5)`,
      [ids.command, f.world, ids.material, ids.item, 'a DIFFERENT statement']),
    CONFLICT, /SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT/u);
    await asRole('postgres');
    assert.equal(Number((await rows(
      `SELECT count(*) n FROM ${D.MATERIALS} m WHERE m.world_id = $1`, [f.world]))[0].n), 1,
    'M08 and exactly one material exists: the refused retry mutated nothing');
  });
}

// ---------------------------------------------------------------------------
// T - how ordinary material composes with the two terminal outcomes.
// ---------------------------------------------------------------------------

async function verifyTerminalComposition(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await runTerminal(report, one, two);
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

async function runTerminal(report, one, two) {
  await report.isolated('T01 END wins first: new material cannot commit into a closed Introduction', async () => {
    const f = await rt.bringToIntroduction(one, two);
    await rt.commitText(f.world, f.lower, 'said while it was still open');
    await actAs(f.lower);
    await rt.commitEnd(terminalIds(), f.world);
    await asRole('postgres');

    await rejected(() => rt.commitText(f.world, f.lower, 'said after the Introduction ended'),
      UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
    await rejected(() => rt.commitVoice(f.world, f.higher, `introduction-audio/${randomUUID()}`),
      UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
    await rejected(() => rt.commitQandeel(f.world, 'an analysis after closure'),
      UNAVAILABLE, /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u);
  });

  await report.isolated('T02 material wins first: END snapshots it into the exact closed-view entitlement', async () => {
    const f = await rt.bringToIntroduction(one, two);
    const said = await rt.commitText(f.world, f.lower, 'said before it ended');
    const note = await rt.commitVoice(f.world, f.higher, `introduction-audio/${randomUUID()}`, null, 900);
    const analysed = await rt.commitQandeel(f.world, 'observed before it ended', { kind: 'QANDEEL_OUTPUT' });
    const expected = [said.item, note.item, analysed.item];

    // What each human could see WHILE the Introduction was live.
    const before = {
      [f.lower]: await rt.visibleItems(f.world, f.lower),
      [f.higher]: await rt.visibleItems(f.world, f.higher),
    };
    assert.deepEqual(before[f.lower], expected, 'T02 both humans could see all three before the end');
    assert.deepEqual(before[f.higher], expected);

    await actAs(f.higher);
    await rt.commitEnd(terminalIds(), f.world);
    await asRole('postgres');

    // THE SNAPSHOT IS THE EXACT SET, frozen through the ONE visibility entry
    // point before the World closed - ordinary material included, with no
    // separate disclosure-only path.
    for (const human of [f.lower, f.higher]) {
      assert.deepEqual(await rt.entitlementItemsOf(f.world, human), [...expected].sort(),
        'T02 the closed-view entitlement holds exactly what that human could see');
      assert.deepEqual(await rt.visibleItems(f.world, human), expected,
        'T02 and the closed World still answers with exactly that, from the frozen snapshot');
    }
    const [world] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
    assert.deepEqual([world.lifecycle, world.phase], ['READ_ONLY_CLOSED', 'INTRODUCTION'],
      'T02 the World closed in place and kept its phase');
  });

  await report.isolated('T03 SUCCESS: the SAME material continues into ACTIVE / STANDARD, uncopied', async () => {
    const f = await rt.bringToSuccessApproved(one, two);
    const said = await rt.commitText(f.world, f.lower, 'said during the Introduction');
    const analysed = await rt.commitQandeel(f.world, 'observed during the Introduction', { kind: 'QANDEEL_ANALYSIS' });
    const before = await rows(
      `SELECT m.id, m.history_item_id, m.material_kind, m.established_at, m.author_user_id
         FROM ${D.MATERIALS} m WHERE m.world_id = $1 ORDER BY m.established_at`, [f.world]);
    const beforeItems = await rt.visibleItems(f.world, f.higher);

    await rt.commitSuccess(terminalIds(), f.version);
    await asRole('postgres');

    const [world] = await rows('SELECT lifecycle, phase, closed_at FROM public.shared_worlds WHERE id = $1', [f.world]);
    assert.deepEqual([world.lifecycle, world.phase, world.closed_at], ['ACTIVE', 'STANDARD', null],
      'T03 the SAME World is now an ordinary Standard World');

    // NOTHING WAS COPIED, REWRITTEN OR RE-DERIVED.
    const after = await rows(
      `SELECT m.id, m.history_item_id, m.material_kind, m.established_at, m.author_user_id
         FROM ${D.MATERIALS} m WHERE m.world_id = $1 ORDER BY m.established_at`, [f.world]);
    assert.deepEqual(after, before, 'T03 every material row is byte-identical: the transition copied nothing');
    assert.deepEqual(await rt.visibleItems(f.world, f.higher), beforeItems,
      'T03 and the same history is visible to the same human, through the Standard branch now');
    assert.deepEqual(await rt.entitlementItemsOf(f.world, f.higher), [],
      'T03 a successful Introduction froze no closed view: nothing ended');

    // AND ORDINARY STANDARD COMMIT WORKS ON THE CONTINUED WORLD, which is the
    // Standard path of the very same extended cores.
    const afterSuccess = await rt.commitText(f.world, f.higher, 'said after it became a Standard World');
    assert.equal(afterSuccess.outcome, 'MATERIAL_COMMITTED', 'T03 the Standard branch commits on the continued World');
    assert.equal(Number(afterSuccess.audience_size), 2, 'T03 with the same exact two-human audience');
    const standardAnalysis = await rt.commitQandeel(f.world, 'observed after the transition');
    assert.equal(standardAnalysis.outcome, 'MATERIAL_COMMITTED', 'T03 and so does QANDEEL');
    assert.deepEqual(await rt.visibleItems(f.world, f.lower),
      [said.item, analysed.item, afterSuccess.item, standardAnalysis.item],
      'T03 one continuous history spans the Introduction and the Standard World that grew out of it');
  });
}

// ---------------------------------------------------------------------------
// C - real two-connection races, pinned on an observable lock-wait barrier.
// ---------------------------------------------------------------------------

async function verifyRaces(report, humans) {
  const [one, two] = humans;
  const extra = await rt.openExtra();
  const { qx, actAsX } = extra;
  const waitExtra = () => rt.waitForLockWait(q, extra.pid);
  const noDeadlock = (error, label) => {
    if (!error) return;
    assert.notEqual(error.code, '40P01', `${label} no deadlock: every lock is taken in one canonical order`);
    assert.notEqual(error.code, '55P03', `${label} no lock timeout`);
  };
  const outcomeOf = (promise) => promise.then(() => null, (error) => error);
  const textX = (world, body) => qx(
    'SELECT * FROM public.commit_shared_world_human_text_v1($1,$2,$3,$4,$5)',
    [randomUUID(), world, randomUUID(), randomUUID(), body]);

  /** One race whose COMMITTED fixtures are always removed, including on failure. */
  const race = (name, body) => report.section(name, async () => {
    try {
      await body();
    } finally {
      await q('ROLLBACK');
      await asRole('postgres');
      await rt.cleanupIntroductionRace([one, two]);
    }
  });

  try {
    await race('C01 material commit versus END: the World row serializes them, with no hybrid', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await q('BEGIN');
      await actAs(f.lower);
      // END takes the World row first and holds it.
      await rt.commitEnd(terminalIds(), f.world);
      await actAsX(f.higher);
      const contender = outcomeOf(textX(f.world, 'said into the closing door'));
      assert.equal(await waitExtra(), true,
        'C01 the material commit is observably waiting on the World lock END holds');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C01');
      assert.ok(outcome, 'C01 the material commit loses and is refused: it cannot land in a closed Introduction');
      assert.match(String(outcome.message), /SHARED_WORLD_MATERIAL_NOT_AVAILABLE/u,
        'C01 with the bounded availability class, which discloses nothing about the terminal outcome');
      assert.equal(Number((await rows(
        `SELECT count(*) n FROM ${D.MATERIALS} m WHERE m.world_id = $1`, [f.world]))[0].n), 0,
      'C01 and no material, body, history item or command survived the refusal');
      assert.equal(Number((await rows(
        `SELECT count(*) n FROM ${D.ITEMS} i WHERE i.world_id = $1`, [f.world]))[0].n), 0);
      assert.equal((await rt.terminalRow(f.record)).terminal_outcome, 'CLOSED', 'C01 END won, completely and alone');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await race('C01b the other way: material wins, and END still closes over exactly what committed', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await q('BEGIN');
      await actAs(f.lower);
      const [said] = await rows(
        'SELECT * FROM public.commit_shared_world_human_text_v1($1,$2,$3,$4,$5)',
        [randomUUID(), f.world, randomUUID(), randomUUID(), 'said just before the end']);
      await actAsX(f.higher);
      const ids = terminalIds();
      const contender = outcomeOf(qx('SELECT * FROM public.commit_introduction_end_v1($1,$2,$3,$4)',
        [ids.command, f.world, ids.lowerAct, ids.higherAct]));
      assert.equal(await waitExtra(), true, 'C01b END is observably waiting on the World lock the commit holds');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C01b');
      assert.equal(outcome, null, 'C01b END proceeds once the commit releases the World row');
      assert.deepEqual(await rt.entitlementItemsOf(f.world, f.higher), [said.committed_history_item_id],
        'C01b and the snapshot it froze includes the material that won the race');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await race('C02 material commit versus SUCCESS: no hybrid and no partial outcome', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      await q('BEGIN');
      // SUCCESS takes the World row first.
      await rt.commitSuccess(terminalIds(), f.version);
      await actAsX(f.higher);
      const contender = outcomeOf(textX(f.world, 'said across the transition'));
      assert.equal(await waitExtra(), true,
        'C02 the material commit is observably waiting on the World lock SUCCESS holds');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C02');
      assert.equal(outcome, null,
        'C02 the material commits once SUCCESS releases the row: a successful Introduction continues, it does not close');
      const [world] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
      assert.deepEqual([world.lifecycle, world.phase], ['ACTIVE', 'STANDARD'],
        'C02 and the material landed in the Standard World the transition produced');
      assert.equal(Number((await rows(
        `SELECT count(*) n FROM ${D.MATERIALS} m WHERE m.world_id = $1`, [f.world]))[0].n), 1,
      'C02 exactly one material exists: there is no hybrid and no partial commit');
      assert.equal((await rt.terminalRow(f.record)).terminal_outcome, 'COMPLETED',
        'C02 and exactly one terminal outcome settled the Introduction');
      await rt.cleanupIntroductionRace([one, two]);
    });
  } finally {
    await extra.close();
  }
}

// ---------------------------------------------------------------------------
// G01 - no ghost.
// ---------------------------------------------------------------------------

async function verifyNoGhost(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await runNoGhost(report, one, two);
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

async function runNoGhost(report, one, two) {
  await report.isolated('G01 NO GHOST: a late transactional failure leaves ZERO surviving effects', async () => {
    const f = await rt.bringToIntroduction(one, two);
    {
      // A verifier-local guard on the LAST write the commit makes. Everything
      // before it has already happened when it fires, so if any of it could
      // survive a failure, this is what would prove it.
      await q(`CREATE FUNCTION public.i07d_ghost_probe_v1() RETURNS trigger
               LANGUAGE plpgsql AS $fn$ BEGIN
                 RAISE EXCEPTION 'I07D_GHOST_PROBE' USING ERRCODE='P0001';
               END$fn$`);
      await q(`CREATE TRIGGER i07d_ghost_probe BEFORE INSERT ON public.shared_world_material_commit_commands
               FOR EACH ROW EXECUTE FUNCTION public.i07d_ghost_probe_v1()`);
      await rejected(() => rt.commitText(f.world, f.lower, 'a statement that will never exist'),
        CONTRADICTORY, /I07D_GHOST_PROBE/u);
      await q('DROP TRIGGER i07d_ghost_probe ON public.shared_world_material_commit_commands');
      await q('DROP FUNCTION public.i07d_ghost_probe_v1()');

      const [{ ghosts }] = await rows(
        `SELECT (SELECT count(*) FROM ${D.MATERIALS} WHERE world_id = $1)
              + (SELECT count(*) FROM ${D.ITEMS} WHERE world_id = $1)
              + (SELECT count(*) FROM public.shared_world_material_commit_commands WHERE world_id = $1)
              + (SELECT count(*) FROM public.shared_world_material_historical_authority WHERE world_id = $1)
              + (SELECT count(*) FROM public.shared_world_material_dependencies WHERE world_id = $1) AS ghosts`,
        [f.world]);
      assert.equal(Number(ghosts), 0,
        'G01 no material, history item, command, authority row or dependency edge survived the failure');

      // And the World is exactly what it was: a refused commit is not a lifecycle event.
      const [world] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
      assert.deepEqual([world.lifecycle, world.phase], ['ACTIVE', 'INTRODUCTION'], 'G01 and the Introduction is untouched');
    }
  });
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0118', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '30s'");
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('posture');
  await verifyPosture();

  const report = createScenarioReport('0118', { query: q, restore: () => asRole('postgres') });
  const seams = [];
  for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    seams.push(await rt.captureMatchingSeam(fn));
  }
  try {
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla' });
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();

    setStage('material');
    await verifyMaterial(report, humans);
    setStage('terminal');
    await verifyTerminalComposition(report, humans);
    setStage('no-ghost');
    await verifyNoGhost(report, humans);
    // The races come LAST because they are the only scenarios that really
    // commit: everything above runs inside one transaction that is rolled back,
    // so nothing it built can still be holding a row when two connections start
    // contending for it.
    setStage('races');
    await verifyRaces(report, humans);
  } finally {
    await asRole('postgres');
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  // EVERY REPLACED SEAM IS FAIL-CLOSED AGAIN. A run that left a permissive
  // definition behind would make the next one prove nothing at all.
  for (const seam of ['public.resolve_introduction_disclosure_prerequisites_v1',
    'public.resolve_introduction_success_prerequisites_v1',
    'public.resolve_matching_reactivation_prerequisites_v1']) {
    assert.equal(await rt.seamClearance(seam), 'NOT_EVALUATED', `${seam} is fail-closed again after the run`);
  }
  for (const [table, trigger] of I07D_GUARDS) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled at the end of the run`);
  }
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${D.MATERIALS}) + (SELECT count(*) FROM ${D.ITEMS})
          + (SELECT count(*) FROM public.shared_world_material_commit_commands)
          + (SELECT count(*) FROM public.shared_world_qandeel_material_evidence)
          + (SELECT count(*) FROM ${D.ENTITLEMENTS})
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0,
    'every fixture this verifier created was rolled back: it commits nothing outside public.users');
}, () => rt.client.end().catch(() => undefined));
