// Real-PostgreSQL verifier for migration 0111 - I-07B private candidate
// evaluation, the Safe Compatibility Conclusion boundary, the Sensitive
// Conclusion Filter and the Matching Proposal Disclosure Gate.
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows, that private Matching reasoning becomes an authorized recipient view
// only through one gate, and only after two independent authorities agree.
//
//   A01 every boundary is postgres-owned, search_path-pinned and executable by
//       NO ROLE AT ALL - not PUBLIC, not anon, not authenticated, not
//       service_role - because the CW2-08 Launch Gate that must clear a
//       consequential Matching disclosure does not exist in this repository
//   A02 every private resolver is STABLE and writes nothing, so none of them can
//       manufacture, widen or withdraw a human's Matching consent
//   A03 the two seams fail closed and cannot be made to answer otherwise
//   A04 the five pure classifiers agree with the CHECK constraints they mirror,
//       over one corpus, so the runtime half and the structural half of the same
//       rule cannot drift apart silently
//
//   B01 PAIR_KEY(A,B) and PAIR_KEY(B,A) are the same answer, a human is never
//       paired with themselves, and a second ensure converges on one row
//   B02 the setup resolver fails closed: absence is OFF, and `matchable` needs
//       ACTIVE participation AND all four current identities
//   B03 an active Introduction is derived from the canonical Shared World
//       substrate, and I-07B implements no slot of its own
//   B04 discovery is bounded, current, silent, unranked, and excludes a human
//       who is paused, off, mid-Introduction or already in a live pair
//
//   C01 eligibility capture binds both humans' exact current identities, refuses
//       a non-matchable human without naming which one, refuses an active
//       Introduction, refuses an unconfigured policy, and answers a retry from
//       the committed row
//   C02 a hard requirement is evaluated only from an allowed source class, an
//       UNKNOWN can never carry one, a SOFT_PREFERENCE is never evaluated as a
//       gate, and a committed result is never rewritten
//
//   D01 the filter PERMITS a clean conclusion and refuses every leak class:
//       a contact route, a source identifier, a quoted span, A PRIVATE NOTE
//       QUOTED WITHOUT QUOTATION MARKS, ranking language and a sensitive fact
//   D02 an unclassifiable conclusion is recorded as a REFUSAL, never a pass
//   D03 an unconfigured filter policy refuses the call outright: there is no
//       "filter unavailable, so allow" path
//   D04 one conclusion has exactly one verdict, and a retry answers with it
//
//   E01 the gate materializes a view from the INTERSECTION of what the human
//       approved and what Product permits, with the first name from the seam
//   E02 a moved profile version or disclosure authority stales the gate
//   E03 an unconfigured Product field policy discloses nothing
//   E04 a conclusion written for the other party is refused
//   E05 an approved profile VALUE carrying a contact route is refused BY NAME
//   E06 an empty intersection is refused
//   E07 with the production first-name seam the whole path fails closed
//   E08 the candidate view is an INDEPENDENT disclosure over a different
//       subject, authority and conclusion - never the first view with the names
//       swapped - and the gate cannot even be asked to reuse one
//
//   F1..F3 forward safety: each of the gate's three refusals is load-bearing.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createProposalRuntime, P, PFN, PROPOSAL_BOUNDARIES, PURE_CLASSIFIERS,
  READ_ONLY_RESOLVERS, EVIDENCE_SOURCE_CLASSES, FORBIDDEN_SOURCE_CLASSES,
  CONTACT_ROUTE_CORPUS, CLEAN_TEXT_CORPUS, runVerifier, APP_ROLES,
} from './matching-proposal-verifier-support.mjs';

const rt = createProposalRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const PROFILE = [['life_stage', 'settled and ready'], ['children_plan', 'yes in time']];
const REQUIREMENTS = [
  ['faith_practice_level', 'HARD_DEALBREAKER', 'practising'],
  ['shared_language', 'SOFT_PREFERENCE', 'arabic and english'],
];
const APPROVED = ['life_stage'];
const CLEAN = CLEAN_TEXT_CORPUS[0];
const PRIVATE_NOTE = 'she left her first marriage after a long and difficult year';

// -------------------------------------------------------------- 1. posture
async function verifyPosture() {
  await asRole('postgres');
  for (const fn of PROPOSAL_BOUNDARIES) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `A01 ${fn} pins an empty search_path`);
    // NO ROLE EXECUTES ANY OF IT.
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false,
        `A01 ${role} must not execute ${fn} before the CW2-08 Launch Gate exists`);
    }
  }
  for (const fn of PURE_CLASSIFIERS) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.volatility, 'i', `A01 ${fn} is IMMUTABLE: it takes no identity and reads no relation`);
  }
  for (const fn of READ_ONLY_RESOLVERS) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.volatility, 's', `A02 ${fn} is STABLE`);
    assert.doesNotMatch(p.prosrc, /INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE/u,
      `A02 ${fn} is a private resolver and writes nothing: it cannot manufacture human consent`);
  }
  // A03 THE TWO SEAMS FAIL CLOSED IN PRODUCTION.
  const [gate] = await rows('SELECT * FROM public.resolve_matching_proposal_prerequisites_v1($1)', [randomUUID()]);
  assert.equal(gate.clearance, 'NOT_EVALUATED',
    'A03 the CW2-08 prerequisite seam answers NOT_EVALUATED and nothing else');
  assert.match(gate.basis, /CW2-08/u, 'A03 and says why');
  const [name] = await rows('SELECT * FROM public.resolve_matching_canonical_first_name_v1($1)', [randomUUID()]);
  assert.equal(name.resolution, 'UNRESOLVED_NO_CANONICAL_SOURCE',
    'A03 the canonical first-name seam answers UNRESOLVED and nothing else');
  assert.equal(name.first_name, null, 'A03 and carries no name');
  // The gate really does consume both, and really does filter every value.
  const gateSource = (await rt.functionPosture(PFN.GATE)).prosrc;
  assert.match(gateSource, /resolve_matching_canonical_first_name_v1/u,
    'A03 the disclosure gate consumes the canonical first-name seam');
  assert.match(gateSource, /matching_text_carries_contact_route_v1/u,
    'A03 and filters every disclosed value rather than copying approved text');
  assert.doesNotMatch(gateSource, /public\.matching_private_reasoning_notes|public\.matching_safe_conclusion_candidates/u,
    'A03 and never reads private reasoning or an unfiltered conclusion');
}

/**
 * A04 THE CROSS-CHECK. Each classifier is the runtime half of a CHECK the
 * database already carries, and nothing but this would notice if one of them
 * drifted from the other. Both halves are asked about the SAME corpus.
 */
async function verifyClassifierAgreement(report, snapshot, policy, lo, hi) {
  await report.isolated('A04 the classifiers and the CHECK constraints agree over one corpus', async () => {
    for (const text of CONTACT_ROUTE_CORPUS) {
      assert.equal(await rt.classify(PFN.CONTACT_ROUTE, text), true,
        `A04 the classifier sees a contact route in ${JSON.stringify(text)}`);
      const candidateId = randomUUID();
      await q(`INSERT INTO ${P.CONCLUSION_CANDIDATES}
                 (id, eligibility_snapshot_id, for_recipient_user_id, about_user_id, conclusion_text)
               VALUES ($1, $2, $3, $4, $5)`, [candidateId, snapshot, lo, hi, text]);
      await rejected(() => q(`INSERT INTO ${P.PERMITTED_CONCLUSIONS}
                 (id, conclusion_candidate_id, for_recipient_user_id, about_user_id,
                  filter_policy_version_id, permitted_text)
               VALUES ($1, $2, $3, $4, $5, $6)`, [randomUUID(), candidateId, lo, hi, policy, text]),
      ['23514'], /route_ban_check/u);
    }
    for (const text of CLEAN_TEXT_CORPUS) {
      for (const classifier of PURE_CLASSIFIERS) {
        assert.equal(await rt.classify(classifier, text), false,
          `A04 ${classifier} is silent on clean text: ${JSON.stringify(text)}`);
      }
      const candidateId = randomUUID();
      await q(`INSERT INTO ${P.CONCLUSION_CANDIDATES}
                 (id, eligibility_snapshot_id, for_recipient_user_id, about_user_id, conclusion_text)
               VALUES ($1, $2, $3, $4, $5)`, [candidateId, snapshot, lo, hi, text]);
      await q(`INSERT INTO ${P.PERMITTED_CONCLUSIONS}
                 (id, conclusion_candidate_id, for_recipient_user_id, about_user_id,
                  filter_policy_version_id, permitted_text)
               VALUES ($1, $2, $3, $4, $5, $6)`, [randomUUID(), candidateId, lo, hi, policy, text]);
    }
    // A gate that fired on everything would be a gate nobody could use, so the
    // corpus proves silence as well as refusal.
    assert.ok(CLEAN_TEXT_CORPUS.length >= 3 && CONTACT_ROUTE_CORPUS.length >= 6,
      'A04 the corpus exercises both directions');
  });
}

// ------------------------------------------------------------- 2. resolvers
async function verifyResolvers(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('B01 the canonical pair is the same answer in both directions', async () => {
      const [ab] = await rows('SELECT * FROM public.matching_canonical_pair_v1($1, $2)', [one, two]);
      const [ba] = await rows('SELECT * FROM public.matching_canonical_pair_v1($2, $1)', [one, two]);
      assert.deepEqual(ab, ba, 'B01 PAIR_KEY(A,B) and PAIR_KEY(B,A) are one answer');
      assert.ok(ab.lower_user_id < ab.higher_user_id, 'B01 and it is the two members smallest first');
      const self = await rows('SELECT * FROM public.matching_canonical_pair_v1($1, $1)', [one]);
      assert.deepEqual(self, [], 'B01 a human is never paired with themselves');

      const first = randomUUID();
      const [created] = await rt.ensurePair(first, one, two);
      assert.equal(created.pair_id, first, 'B01 the first ensure creates the pair');
      assert.equal(created.created, true, 'B01 and says so');
      // A SECOND ENSURE FROM THE OTHER DIRECTION CONVERGES ON THE SAME ROW. It
      // does not create a reverse duplicate and does not fail; it reads the
      // winner's identity back.
      const [converged] = await rt.ensurePair(randomUUID(), two, one);
      assert.equal(converged.pair_id, first, 'B01 the reverse-direction ensure converges on the existing identity');
      assert.equal(converged.created, false, 'B01 and reports that it created nothing');
      assert.equal(await count(P.PAIRS, 'lower_user_id = $1 OR higher_user_id = $1', [one]), 1,
        'B01 exactly one pair row exists for the unordered pair');
      await rejected(() => rt.ensurePair(randomUUID(), one, one), ['22023'], /PAIR_MEMBERS_INVALID/u);
    });

    await report.isolated('B02 the setup resolver fails closed and never infers', async () => {
      // ABSENCE IS OFF. A human with no participation history is not matchable,
      // whatever else they have.
      const [empty] = await rt.setupState(three);
      assert.equal(empty.participation_state, 'OFF', 'B02 absence of a participation pointer is OFF');
      assert.equal(empty.matchable, false, 'B02 and OFF is never matchable');
      // A profile, a grant, a requirement set and a disclosure authority do not
      // add up to participation.
      await seedSetup(three, { skipParticipation: true });
      const [withSetup] = await rt.setupState(three);
      assert.equal(withSetup.participation_state, 'OFF',
        'B02 participation is never inferred from a profile, a grant or a disclosure authority');
      assert.equal(withSetup.matchable, false, 'B02 and a complete setup with no participation is still not matchable');
      // ACTIVE alone is not enough either: all four identities are required.
      const full = await seedSetup(one);
      const [matchable] = await rt.setupState(one);
      assert.equal(matchable.participation_state, 'ACTIVE', 'B02 an activated human is ACTIVE');
      assert.equal(matchable.matchable, true, 'B02 and with all four identities they are matchable');
      assert.equal(matchable.matching_context_grant_id, full.grant, 'B02 the resolver reports the exact grant identity');
      assert.equal(matchable.introduction_profile_version_id, full.profile, 'B02 and the exact profile version');
      // A PAUSE STOPS IT IMMEDIATELY, with no special case anywhere.
      await pause(one, full.event);
      const [paused] = await rt.setupState(one);
      assert.equal(paused.participation_state, 'PAUSED', 'B02 a paused human is PAUSED');
      assert.equal(paused.matchable, false, 'B02 and a paused human is not matchable');
      assert.equal(paused.pause_reason, 'USER_PAUSED', 'B02 with the pause reason on the private side only');
    });

    await report.isolated('B03 an active Introduction comes from the canonical Shared World substrate', async () => {
      assert.equal(await rt.activeIntroduction(one), false, 'B03 a human in no World holds no Introduction');
      // A STANDARD World is not an Introduction...
      await seedWorld(one, 'STANDARD', 'ACTIVE');
      assert.equal(await rt.activeIntroduction(one), false, 'B03 a STANDARD World is not an Introduction');
      // ... a CLOSED Introduction is not an active one ...
      await seedWorld(one, 'INTRODUCTION', 'READ_ONLY_CLOSED');
      assert.equal(await rt.activeIntroduction(one), false, 'B03 a closed Introduction is not an active one');
      // ... and an open episode in an ACTIVE INTRODUCTION World is.
      await seedWorld(one, 'INTRODUCTION', 'ACTIVE');
      assert.equal(await rt.activeIntroduction(one), true,
        'B03 an open membership episode in an ACTIVE INTRODUCTION World is an active Introduction');
      // The resolver reads the Shared World substrate and nothing I-07B invented.
      // `prosrc` INCLUDES COMMENTS, and this body's own comment says the word
      // `slot` in order to say there is none - so the executable lines are the
      // only honest thing to assert against. A detector that read its own
      // explanation would report the explanation.
      const source = (await rt.functionPosture(PFN.ACTIVE_INTRODUCTION)).prosrc;
      const executable = source.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
      assert.match(executable, /public\.shared_world_membership_episodes/u,
        'B03 the resolver reads the canonical substrate 0075 owns');
      assert.doesNotMatch(executable, /slot/iu,
        'B03 and reads no Introduction slot relation, because I-07B implements none');
      assert.equal(await count('pg_class', `relname ~* '(introduction|matching).*slot'`, []), 0,
        'B03 and no Introduction slot relation exists anywhere for it to read');
    });

    await report.isolated('B04 discovery is bounded current silent and unranked', async () => {
      const a = await seedSetup(one);
      await seedSetup(two);
      await seedSetup(three);
      const found = await rt.discover(one, 10);
      assert.deepEqual(found.map((r) => r.candidate_user_id).sort(), [two, three].sort(),
        'B04 discovery finds every currently matchable human but the caller');
      for (const row of found) {
        assert.ok(row.lower_user_id < row.higher_user_id, 'B04 and answers with canonical pair members');
      }
      assert.deepEqual(Object.keys(found[0]).sort(), ['candidate_user_id', 'higher_user_id', 'lower_user_id'],
        'B04 the answer carries no rank, score, percentage or ordering column of any kind');
      // CURRENT truth, not a cached participation fact: a pause removes a human
      // from the very next call.
      await pause(two, (await seedSetupEvent(two)));
      assert.deepEqual((await rt.discover(one, 10)).map((r) => r.candidate_user_id), [three],
        'B04 a paused human disappears from the next call, because discovery reads current eligibility');
      // A human in an active Introduction is not available either.
      await seedWorld(three, 'INTRODUCTION', 'ACTIVE');
      assert.deepEqual(await rt.discover(one, 10), [],
        'B04 and a human holding an active Introduction is not a candidate');
      // The caller themselves must be matchable, and the request is bounded.
      await rejected(() => rt.discover(one, 0), ['22023'], /DISCOVERY_REQUEST_INVALID/u);
      await rejected(() => rt.discover(one, 10000), ['22023'], /DISCOVERY_REQUEST_INVALID/u);
      await pause(one, a.event);
      await rejected(() => rt.discover(one, 10), ['55000'], /PARTICIPATION_NOT_MATCHABLE/u);
      // DISCOVERING A HUMAN NOTIFIES THEM OF NOTHING: no row about them exists.
      assert.equal(await count(P.PAIRS, 'true', []), 0, 'B04 discovery creates no pair');
      assert.equal(await count(P.PROPOSALS, 'true', []), 0, 'B04 and no proposal');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------- 3. eligibility and filter
async function verifyEvaluation(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('C01 eligibility capture binds the exact current identities', async () => {
      const f = await seedMatchablePair(one, two);
      const snapshot = randomUUID();
      const [captured] = await rt.capture(snapshot, f.pair, one, two);
      assert.equal(captured.eligibility_snapshot_id, snapshot, 'C01 the snapshot is the command id');
      assert.equal(captured.hard_requirement_count, 2, 'C01 and it reports both humans hard dealbreakers');
      const [row] = await rows(`SELECT * FROM ${P.SNAPSHOTS} WHERE id = $1`, [snapshot]);
      assert.equal(row.lower_profile_version_id, f.byUser[f.lower].profile,
        'C01 the lower human profile version is bound exactly');
      assert.equal(row.higher_disclosure_authority_id, f.byUser[f.higher].authority,
        'C01 and the higher human disclosure authority');
      assert.equal(row.no_active_introduction_at_capture, true,
        'C01 a snapshot taken while an Introduction existed is unrepresentable');
      // AN EQUIVALENT RETRY ANSWERS FROM THE COMMITTED ROW.
      const [retry] = await rt.capture(snapshot, f.pair, two, one);
      assert.equal(retry.eligibility_snapshot_id, snapshot, 'C01 an equivalent retry returns the committed snapshot');
      assert.equal(await count(P.SNAPSHOTS, 'pair_id = $1', [f.pair]), 1, 'C01 and writes nothing new');
      // THE SAME COMMAND ID CARRYING A DIFFERENT REQUEST FAILS CLOSED. The
      // second pair shares a human with the first, which is exactly why
      // `seedSetup` is idempotent within a scenario.
      const other = await seedMatchablePair(one, humans[2]);
      await rejected(() => rt.capture(snapshot, other.pair, one, humans[2]), ['23505'], /COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('C01 capture refuses a non-matchable human without naming which', async () => {
      const f = await seedMatchablePair(one, two);
      await pause(one, f.byUser[one].event);
      const error = await rejected(() => rt.capture(randomUUID(), f.pair, one, two),
        ['55000'], /PAIR_NOT_ELIGIBLE/u);
      // THE ANTI-ORACLE PROPERTY: the refusal names no human, so it cannot tell
      // one human anything about the other's participation.
      assert.doesNotMatch(String(error.message) + String(error.detail ?? ''), new RegExp(one, 'u'),
        'C01 the refusal names neither human');
      assert.doesNotMatch(String(error.message) + String(error.detail ?? ''), new RegExp(two, 'u'),
        'C01 so it can never disclose which of the two is not participating');
    });

    await report.isolated('C01 capture refuses an active Introduction', async () => {
      const f = await seedMatchablePair(one, two);
      await seedWorld(two, 'INTRODUCTION', 'ACTIVE');
      await rejected(() => rt.capture(randomUUID(), f.pair, one, two),
        ['55000'], /ACTIVE_INTRODUCTION_PRESENT/u);
      await q(`DELETE FROM public.shared_world_membership_episodes WHERE user_id = $1`, [two]);
      const [captured] = await rt.capture(randomUUID(), f.pair, one, two);
      assert.ok(captured.eligibility_snapshot_id,
        'C01 and the same call succeeds once the Introduction is over, so the refusal was the Introduction');
    });

    await report.isolated('C01 capture refuses an unconfigured policy', async () => {
      // AN UNCONFIGURED POLICY IS NEVER A PERMISSIVE DEFAULT. The fixture is
      // built WITHOUT the expiry policy rather than by deleting its pointer: a
      // current policy pointer is durable by design, and production ships with
      // no policy row at all, so never-configured is also the honest shape.
      const f = await seedMatchablePair(one, two, { omit: ['PROPOSAL_EXPIRY'] });
      await rejected(() => rt.capture(randomUUID(), f.pair, one, two),
        ['55000'], /POLICY_UNCONFIGURED/u);
    });

    await report.isolated('C02 a hard requirement is evaluated only from an allowed source', async () => {
      const f = await seedMatchablePair(one, two);
      const snapshot = randomUUID();
      await rt.capture(snapshot, f.pair, one, two);
      // A THIRD-PARTY CLAIM AND AN INFERENCE ARE NOT SOURCES.
      for (const invented of FORBIDDEN_SOURCE_CLASSES) {
        await rejected(() => rt.evaluate(snapshot, one, 'faith_practice_level', 'PASS', invented),
          ['22023'], /EVIDENCE_SOURCE_NOT_ALLOWED/u);
      }
      // UNKNOWN IS NOT SATISFACTION and cannot be dressed as one.
      await rejected(() => rt.evaluate(snapshot, one, 'faith_practice_level', 'UNKNOWN', 'INTRODUCTION_PROFILE'),
        ['22023'], /UNKNOWN_IS_NOT_SATISFACTION/u);
      await rejected(() => rt.evaluate(snapshot, one, 'faith_practice_level', 'PASS', 'NOT_ESTABLISHED'),
        ['22023'], /UNKNOWN_IS_NOT_SATISFACTION/u);
      // A SOFT PREFERENCE IS NEVER CONVERTED INTO A GATE.
      await rejected(() => rt.evaluate(snapshot, one, 'shared_language', 'PASS', 'INTRODUCTION_PROFILE'),
        ['22023'], /REQUIREMENT_IS_NOT_HARD/u);
      await rejected(() => rt.evaluate(snapshot, one, 'never_declared', 'PASS', 'INTRODUCTION_PROFILE'),
        ['22023'], /REQUIREMENT_NOT_IN_VERSION/u);
      // The allowed path works, is idempotent, and a committed answer is never
      // rewritten into a different one.
      const [recorded] = await rt.evaluate(snapshot, one, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
      assert.equal(recorded.requirement_outcome, 'PASS', 'C02 an allowed source really does establish a PASS');
      const [again] = await rt.evaluate(snapshot, one, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
      assert.equal(again.requirement_outcome, 'PASS', 'C02 an equivalent retry returns the committed result');
      await rejected(() => rt.evaluate(snapshot, one, 'faith_practice_level', 'FAIL', 'EXPLICIT_MATCHING_ANSWER'),
        ['23505'], /REQUIREMENT_RESULT_CONFLICT/u);
      assert.equal(EVIDENCE_SOURCE_CLASSES.length, 5, 'C02 four allowed source classes plus the absence of one');
    });

    await report.isolated('D01 the filter permits a clean conclusion and refuses every leak class', async () => {
      const f = await seedEligibleSnapshot(one, two);
      await rt.privateNote(randomUUID(), f.snapshot, two, 'SELF_AUTHORED_PERSONAL', PRIVATE_NOTE);
      const permit = async (text) => {
        const candidateId = randomUUID();
        await rt.submitConclusion(candidateId, f.snapshot, one, two, text);
        const [verdict] = await rt.filterConclusion(randomUUID(), candidateId);
        return verdict;
      };
      const clean = await permit(CLEAN);
      assert.equal(clean.filter_verdict, 'PERMITTED', 'D01 a clean conclusion is permitted');
      assert.ok(clean.permitted_conclusion_id, 'D01 and a permitted record exists for it');
      assert.equal(clean.private_refusal_class, null, 'D01 with no refusal class');

      for (const [text, expected] of [
        ['you can reach her on 0100 123 4567', 'CONTACT_ROUTE'],
        ['the note 3f2504e0-4f89-41d3-9a0c-0305e82c3301 explains it', 'HIDDEN_PROVENANCE'],
        ['she told us "I have never told anyone about that at all"', 'PRIVATE_QUOTE'],
        // THE ONE A REGEX-ONLY REDACTION LAYER NEVER CATCHES: the private note,
        // word for word, with no quotation marks anywhere.
        [`what stood out is that ${PRIVATE_NOTE}, which shaped how she chooses`, 'PRIVATE_QUOTE'],
        ['a 92 percent compatibility score puts him in your top 3', 'VISIBLE_RANKING'],
        ['he is open about his diabetes and manages it well', 'SENSITIVE_FACT'],
      ]) {
        const verdict = await permit(text);
        assert.equal(verdict.filter_verdict, 'REFUSED', `D01 ${expected} is refused`);
        assert.equal(verdict.private_refusal_class, expected, `D01 and classified as ${expected}`);
        assert.equal(verdict.permitted_conclusion_id, null, `D01 with no permitted record: absence IS refusal`);
      }
      // D02 AN UNCLASSIFIABLE RESULT IS A REFUSAL, NEVER A PASS.
      const long = await permit(`${CLEAN} `.repeat(200).slice(0, 2000));
      assert.equal(long.filter_verdict, 'UNCLASSIFIED', 'D02 a conclusion the permitted relation could not hold is UNCLASSIFIED');
      assert.equal(long.private_refusal_class, 'UNCLASSIFIED_RESULT', 'D02 and recorded as a refusal');
      // D04 ONE CONCLUSION HAS EXACTLY ONE VERDICT, and a retry answers with it.
      const candidateId = randomUUID();
      await rt.submitConclusion(candidateId, f.snapshot, one, two, CLEAN);
      const [first] = await rt.filterConclusion(randomUUID(), candidateId);
      const [repeat] = await rt.filterConclusion(randomUUID(), candidateId);
      assert.equal(repeat.filter_verdict, 'PERMITTED', 'D04 a second filter call answers with the committed verdict');
      assert.equal(repeat.permitted_conclusion_id, first.permitted_conclusion_id, 'D04 and the committed identity');
      // The PRIVATE reason never leaves the private relation: the permitted
      // record carries no refusal class column at all.
      const permittedColumns = await rows(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'matching_permitted_safe_conclusions'`);
      assert.deepEqual(permittedColumns.map((r) => r.column_name).filter((c) => /refus|reason|private/u.test(c)), [],
        'D01 the permitted relation carries no private refusal reason');
    });

    await report.isolated('D03 an unconfigured filter policy refuses the call outright', async () => {
      const f = await seedEligibleSnapshot(one, two, { omit: ['SENSITIVE_CONCLUSION_FILTER'] });
      const candidateId = randomUUID();
      await rt.submitConclusion(candidateId, f.snapshot, one, two, CLEAN);
      // THERE IS NO "FILTER UNAVAILABLE, SO ALLOW" PATH.
      await rejected(() => rt.filterConclusion(randomUUID(), candidateId),
        ['55000'], /SENSITIVE_FILTER_UNCONFIGURED/u);
      assert.equal(await count(P.PERMITTED_CONCLUSIONS, 'conclusion_candidate_id = $1', [candidateId]), 0,
        'D03 and nothing is permitted while the filter is unconfigured');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// -------------------------------------------------------- 4. disclosure gate
async function verifyDisclosureGate(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('E07 with the production first-name seam the path fails closed', async () => {
      const f = await seedProposalFixture(one, two);
      await rejected(() => rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst),
        ['55000'], /CANONICAL_FIRST_NAME_UNRESOLVED/u);
      assert.equal(await count(P.VIEWS, 'proposal_id = $1', [f.proposal]), 0,
        'E07 and no recipient view exists while the seam is unresolved');
    });

    // From here the first-name seam is REPLACED, because a verifier that only
    // ever saw the refusal would prove that I-07B refuses and nothing else. It
    // is restored, and the restoration is checked, after this section.
    await rt.resolveFirstName({ [one]: 'Sara', [two]: 'Omar' });

    await report.isolated('E01 the gate discloses the intersection and nothing else', async () => {
      const f = await seedProposalFixture(one, two);
      const view = randomUUID();
      const [materialized] = await rt.materialize(view, f.proposal, one, f.conclusionForFirst);
      assert.equal(materialized.recipient_view_id, view, 'E01 the view is the command id');
      assert.equal(materialized.recipient_role, 'FIRST_RECIPIENT', 'E01 and the role is derived, never passed');
      assert.equal(materialized.disclosed_field_count, 1, 'E01 exactly the intersection is disclosed');
      const fields = await rows(`SELECT field_key, disclosed_value FROM ${P.VIEW_FIELDS} WHERE view_id = $1`, [view]);
      assert.deepEqual(fields.map((r) => r.field_key), APPROVED,
        'E01 and it is exactly the key the human approved AND Product permits');
      const [row] = await rows(`SELECT * FROM ${P.VIEWS} WHERE id = $1`, [view]);
      assert.equal(row.subject_first_name, 'Omar', 'E01 the first name comes from the canonical seam');
      assert.equal(row.subject_user_id, two, 'E01 the subject is the counterparty, derived from the direction');
      // The one approved key was `life_stage`; `children_plan` is a real field of
      // the same version that the human did NOT approve, and it does not cross.
      assert.equal(fields.length, 1, 'E01 an unapproved field of the same version does not cross');
    });

    await report.isolated('E02 a moved profile version or authority stales the gate', async () => {
      const f = await seedProposalFixture(one, two);
      // The subject publishes a new Introduction Profile version. The authority
      // the snapshot bound is now over an EARLIER version, and an authority over
      // V1 never silently covers V2.
      await actAs(two);
      await rt.setProfile(randomUUID(), PROFILE, f.byUser[two].profile);
      await asRole('postgres');
      await rejected(() => rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst),
        ['40001'], /DISCLOSURE_AUTHORITY_STALE/u);
    });

    await report.isolated('E03 an unconfigured Product field policy discloses nothing', async () => {
      // HUMAN AUTHORITY IS NECESSARY AND NOT SUFFICIENT: with no Product policy
      // at all, a human who approved a field still discloses nothing.
      const f = await seedProposalFixture(one, two, { omit: ['PROPOSAL_SAFE_FIELDS'] });
      await rejected(() => rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst),
        ['55000'], /POLICY_UNCONFIGURED/u);
    });

    await report.isolated('E04 a conclusion written for the other party is refused', async () => {
      const f = await seedProposalFixture(one, two);
      await rejected(() => rt.materialize(randomUUID(), f.proposal, one, f.conclusionForCandidate),
        ['22023'], /SAFE_CONCLUSION_AUDIENCE_MISMATCH/u);
      // ... and a caller who is not a member of this proposal has no role at all.
      await rejected(() => rt.materialize(randomUUID(), f.proposal, humans[2], f.conclusionForFirst),
        ['22023'], /RECIPIENT_NOT_IN_PROPOSAL/u);
    });

    await report.isolated('E05 an approved value carrying a contact route is refused by name', async () => {
      // The subject writes a NEW profile whose approved field VALUE carries a
      // phone number. I-07A bans a contact-route field KEY; this proves a benign
      // key cannot smuggle one through free text.
      const f = await seedProposalFixture(one, two, {
        subjectProfile: [['life_stage', 'settled - call me on 0100 123 4567'], ['children_plan', 'yes in time']],
      });
      const error = await rejected(() => rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst),
        ['55000'], /PROPOSAL_FIELD_VALUE_REFUSED/u);
      assert.match(String(error.detail ?? ''), /life_stage/u,
        'E05 and the refusal names the exact offending field, so it is answerable');
    });

    await report.isolated('E06 an empty intersection is refused', async () => {
      const f = await seedProposalFixture(one, two, { safeFieldKeys: ['children_plan'] });
      // The human approved `life_stage`; Product permits only `children_plan`.
      // Nothing is in both, so there is no proposal to make.
      await rejected(() => rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst),
        ['55000'], /PROPOSAL_DISCLOSURE_EMPTY/u);
    });

    await report.isolated('E08 the candidate view is an independent disclosure', async () => {
      const f = await seedProposalFixture(one, two);
      const firstView = randomUUID();
      const candidateView = randomUUID();
      await rt.materialize(firstView, f.proposal, one, f.conclusionForFirst);
      await rt.materialize(candidateView, f.proposal, two, f.conclusionForCandidate);
      const [first] = await rows(`SELECT * FROM ${P.VIEWS} WHERE id = $1`, [firstView]);
      const [candidate] = await rows(`SELECT * FROM ${P.VIEWS} WHERE id = $1`, [candidateView]);
      // DIFFERENT SUBJECT, DIFFERENT AUTHORITY, DIFFERENT PROFILE VERSION,
      // DIFFERENT CONCLUSION. It is not the first view with the names swapped,
      // and there is no path in the gate that could make it one.
      assert.notEqual(first.subject_user_id, candidate.subject_user_id, 'E08 the two views have different subjects');
      assert.notEqual(first.subject_disclosure_authority_id, candidate.subject_disclosure_authority_id,
        'E08 and are built on different human authorities');
      assert.notEqual(first.subject_profile_version_id, candidate.subject_profile_version_id,
        'E08 and different profile versions');
      assert.notEqual(first.permitted_conclusion_id, candidate.permitted_conclusion_id,
        'E08 and different recipient-specific conclusions');
      assert.equal(first.recipient_role, 'FIRST_RECIPIENT', 'E08 with the roles derived from the proposal direction');
      assert.equal(candidate.recipient_role, 'CANDIDATE', 'E08 for each of the two members');
      // A retry with the same command id answers from the committed row.
      const [retry] = await rt.materialize(firstView, f.proposal, one, f.conclusionForFirst);
      assert.equal(retry.recipient_view_id, firstView, 'E08 an equivalent retry returns the committed view');
      assert.equal(await count(P.VIEWS, 'proposal_id = $1', [f.proposal]), 2,
        'E08 and writes no third view');
    });

    await report.isolated('F1 the Product field policy gate is load-bearing', async () => {
      const f = await seedProposalFixture(one, two, { safeFieldKeys: ['children_plan'] });
      await rejected(() => rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst),
        ['55000'], /PROPOSAL_DISCLOSURE_EMPTY/u);
      // With `life_stage` permitted by Product as well, the same call succeeds -
      // so the empty intersection really was Product's refusal and not an
      // accident of the fixture.
      await q(`INSERT INTO ${P.POLICY_FIELDS} (policy_version_id, field_key) VALUES ($1, 'life_stage')`,
        [f.safeFieldPolicy]);
      const [ok] = await rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst);
      assert.equal(ok.disclosed_field_count, 1, 'F1 adding the key to the Product policy is what changes the answer');
    });

    await report.isolated('F2 the value filter is load-bearing', async () => {
      const f = await seedProposalFixture(one, two, {
        subjectProfile: [['life_stage', 'settled - call me on 0100 123 4567'], ['children_plan', 'yes in time']],
      });
      await rejected(() => rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst),
        ['55000'], /PROPOSAL_FIELD_VALUE_REFUSED/u);
      // The CHECK behind it refuses the same value independently, so the gate
      // and the structural floor agree rather than one covering for the other.
      assert.equal(await rt.classify(PFN.CONTACT_ROUTE, 'settled - call me on 0100 123 4567'), true,
        'F2 the classifier and the CHECK see the same contact route');
    });

    await report.isolated('F3 the filter is the only way to a permitted conclusion', async () => {
      const writers = await rows(
        `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\\.matching_permitted_safe_conclusions'
          ORDER BY 1`);
      assert.deepEqual(writers.map((r) => r.proname), ['apply_matching_sensitive_conclusion_filter_core_v1'],
        'F3 exactly one function in the database can mint a permitted conclusion');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------ fixtures
async function seedSetupEvent(human) {
  const [row] = await rows(
    `SELECT current_event_id id FROM public.matching_participation_state WHERE participant_user_id = $1`, [human]);
  return row?.id ?? null;
}

async function pause(human, priorEvent) {
  const id = randomUUID();
  await q(`INSERT INTO public.matching_participation_events
             (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason, prior_event_id)
           VALUES ($1, $2, 'PAUSE', 'PAUSED', 'USER_PAUSED', $3)`, [id, human, priorEvent]);
  await q(`UPDATE public.matching_participation_state SET current_event_id = $2, updated_at = CURRENT_TIMESTAMP
            WHERE participant_user_id = $1`, [human, id]);
  return id;
}

async function seedWorld(human, phase, lifecycle) {
  const world = randomUUID();
  await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, closed_at)
           VALUES ($1, $2, $3, $4, CASE WHEN $2 = 'READ_ONLY_CLOSED' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
  [world, lifecycle, phase, phase === 'INTRODUCTION' ? 'MUTUAL_MATCH' : 'ACCEPTED_INVITATION']);
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`, [randomUUID(), world, human]);
  return world;
}

/**
 * One human's complete I-07A setup, written directly.
 *
 * It is IDEMPOTENT WITHIN A SCENARIO: a human who already has a participation
 * pointer keeps their identities and is returned unchanged. A scenario that
 * builds two pairs sharing a human would otherwise collide on
 * `matching_participation_state_pkey`, and the collision says nothing about the
 * migration under test.
 */
async function seedSetup(human, { skipParticipation = false, profile = PROFILE, approved = APPROVED } = {}) {
  const [existing] = await rows(
    `SELECT s.current_event_id AS event, g.id AS grant, ps.current_profile_version_id AS profile,
            rs.current_requirement_version_id AS requirements, a.id AS authority
       FROM public.matching_participation_state s
       LEFT JOIN public.matching_context_grants g ON g.grantor_user_id = s.participant_user_id AND g.status = 'ACTIVE'
       LEFT JOIN public.introduction_profile_state ps ON ps.owner_user_id = s.participant_user_id
       LEFT JOIN public.matching_requirement_state rs ON rs.owner_user_id = s.participant_user_id
       LEFT JOIN public.pre_match_disclosure_authorities a
              ON a.grantor_user_id = s.participant_user_id AND a.status = 'ACTIVE'
      WHERE s.participant_user_id = $1`, [human]);
  if (existing) return existing;
  let event = null;
  if (!skipParticipation) {
    event = randomUUID();
    await q(`INSERT INTO public.matching_participation_events
               (id, participant_user_id, participation_act, resulting_state, activation_entry_channel)
             VALUES ($1, $2, 'ACTIVATE', 'ACTIVE', 'MANUAL_MY_WORLD_ENTRY')`, [event, human]);
    await q(`INSERT INTO public.matching_participation_state (participant_user_id, current_event_id)
             VALUES ($1, $2)`, [human, event]);
  }
  const grant = randomUUID();
  await q(`INSERT INTO public.matching_context_grants (id, grantor_user_id, status)
           VALUES ($1, $2, 'ACTIVE')`, [grant, human]);
  const profileVersion = randomUUID();
  await q(`INSERT INTO public.introduction_profile_versions (id, owner_user_id) VALUES ($1, $2)`,
    [profileVersion, human]);
  await q(`INSERT INTO public.introduction_profile_field_values (profile_version_id, field_key, field_value)
           SELECT $1, k, v FROM unnest($2::text[], $3::text[]) AS f(k, v)`,
  [profileVersion, profile.map(([k]) => k), profile.map(([, v]) => v)]);
  await q(`INSERT INTO public.introduction_profile_state (owner_user_id, current_profile_version_id)
           VALUES ($1, $2)`, [human, profileVersion]);
  const requirements = randomUUID();
  await q(`INSERT INTO public.matching_requirement_versions (id, owner_user_id) VALUES ($1, $2)`, [requirements, human]);
  await q(`INSERT INTO public.matching_requirement_items
             (requirement_version_id, requirement_key, requirement_strength, requirement_value)
           SELECT $1, k, s, v FROM unnest($2::text[], $3::text[], $4::text[]) AS r(k, s, v)`,
  [requirements, REQUIREMENTS.map(([k]) => k), REQUIREMENTS.map(([, s]) => s), REQUIREMENTS.map(([, , v]) => v)]);
  await q(`INSERT INTO public.matching_requirement_state (owner_user_id, current_requirement_version_id)
           VALUES ($1, $2)`, [human, requirements]);
  const authority = randomUUID();
  await q(`INSERT INTO public.pre_match_disclosure_authorities
             (id, grantor_user_id, introduction_profile_version_id, status)
           VALUES ($1, $2, $3, 'ACTIVE')`, [authority, human, profileVersion]);
  await q(`INSERT INTO public.pre_match_disclosure_authority_fields
             (authority_id, introduction_profile_version_id, field_key)
           SELECT $1, $2, unnest($3::text[])`, [authority, profileVersion, approved]);
  return { event, grant, profile: profileVersion, requirements, authority };
}

/**
 * One version of each policy kind, and a current pointer for each.
 *
 * `omit` leaves a kind UNCONFIGURED by never installing it. A current policy
 * pointer is durable - the 0110 truth trigger refuses to delete one, on purpose
 * - so "unconfigured" is a fixture that was never configured rather than one
 * that had its pointer removed. That is also the honest shape: production ships
 * with no policy row at all.
 */
const POLICY_KEY = {
  PROPOSAL_CADENCE: 'cadence', PENDING_PROPOSAL_LIMIT: 'pending', PROPOSAL_EXPIRY: 'expiry',
  PROPOSAL_SAFE_FIELDS: 'fields', SENSITIVE_CONCLUSION_FILTER: 'filter',
};

async function seedPolicies({ safeFieldKeys = APPROVED, omit = [] } = {}) {
  // There is ONE current pointer per policy kind, so a second install in the
  // same scenario would collide on its primary key. An already-configured
  // runtime is reused, which is also what a real one looks like. A scenario that
  // deliberately omits a kind always starts from an unconfigured fixture, so it
  // never reaches this branch.
  if (omit.length === 0) {
    const configured = await rows(`SELECT policy_kind, current_policy_version_id id FROM ${P.POLICY_STATE}`);
    if (configured.length === Object.keys(POLICY_KEY).length) {
      return Object.fromEntries(configured.map((r) => [POLICY_KEY[r.policy_kind], r.id]));
    }
  }
  const ids = { cadence: randomUUID(), pending: randomUUID(), expiry: randomUUID(),
    fields: randomUUID(), filter: randomUUID() };
  const kinds = [
    ['PROPOSAL_CADENCE', ids.cadence, 7, 5, null],
    ['PENDING_PROPOSAL_LIMIT', ids.pending, null, 3, null],
    ['PROPOSAL_EXPIRY', ids.expiry, null, null, 72],
    ['PROPOSAL_SAFE_FIELDS', ids.fields, null, null, null],
    ['SENSITIVE_CONCLUSION_FILTER', ids.filter, null, null, null],
  ].filter(([kind]) => !omit.includes(kind));
  for (const [kind, id, windowDays, maxCount, expiryHours] of kinds) {
    await q(`INSERT INTO ${P.POLICY_VERSIONS} (id, policy_kind, window_days, max_count, expiry_hours)
             VALUES ($1, $2, $3, $4, $5)`, [id, kind, windowDays, maxCount, expiryHours]);
    await q(`INSERT INTO ${P.POLICY_STATE} (policy_kind, current_policy_version_id) VALUES ($1, $2)`, [kind, id]);
  }
  if (safeFieldKeys.length > 0 && !omit.includes('PROPOSAL_SAFE_FIELDS')) {
    await q(`INSERT INTO ${P.POLICY_FIELDS} (policy_version_id, field_key) SELECT $1, unnest($2::text[])`,
      [ids.fields, safeFieldKeys]);
  }
  return ids;
}

async function seedMatchablePair(a, b, options = {}) {
  const byUser = {};
  byUser[a] = await seedSetup(a, options.profileFor?.[a] ? { profile: options.profileFor[a] } : {});
  byUser[b] = await seedSetup(b, options.profileFor?.[b] ? { profile: options.profileFor[b] } : {});
  const policy = await seedPolicies(options);
  const pairId = randomUUID();
  const [pair] = await rt.ensurePair(pairId, a, b);
  return { pair: pair.pair_id, lower: pair.lower_user_id, higher: pair.higher_user_id, byUser, policy };
}

async function seedEligibleSnapshot(a, b, options = {}) {
  const f = await seedMatchablePair(a, b, options);
  const snapshot = randomUUID();
  await rt.capture(snapshot, f.pair, a, b);
  await rt.evaluate(snapshot, a, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
  await rt.evaluate(snapshot, b, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
  return { ...f, snapshot };
}

/** A prepared proposal plus one permitted conclusion aimed at each recipient. */
async function seedProposalFixture(first, candidate, options = {}) {
  const f = await seedEligibleSnapshot(first, candidate, {
    ...options,
    profileFor: options.subjectProfile ? { [candidate]: options.subjectProfile } : undefined,
  });
  const proposal = randomUUID();
  await q(`INSERT INTO ${P.PROPOSALS}
             (id, pair_id, lower_user_id, higher_user_id, first_recipient_user_id, candidate_user_id,
              eligibility_snapshot_id, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP + interval '72 hours')`,
  [proposal, f.pair, f.lower, f.higher, first, candidate, f.snapshot]);
  const conclusionForFirst = await permitted(f.snapshot, f.policy.filter, first, candidate);
  const conclusionForCandidate = await permitted(f.snapshot, f.policy.filter, candidate, first);
  return { ...f, proposal, conclusionForFirst, conclusionForCandidate, safeFieldPolicy: f.policy.fields };
}

async function permitted(snapshot, filterPolicy, forRecipient, about) {
  const candidateId = randomUUID();
  await rt.submitConclusion(candidateId, snapshot, forRecipient, about, CLEAN);
  const [verdict] = await rt.filterConclusion(randomUUID(), candidateId);
  assert.equal(verdict.filter_verdict, 'PERMITTED', 'the fixture conclusion is permitted by the real filter');
  return verdict.permitted_conclusion_id;
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0111', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('posture');
  await verifyPosture();

  const report = createScenarioReport('0111', { query: q, restore: () => asRole('postgres') });
  const nameSeam = await rt.captureMatchingSeam(PFN.FIRST_NAME);
  try {
    setStage('resolvers');
    await verifyResolvers(report, humans);
    setStage('evaluation');
    await verifyEvaluation(report, humans);

    setStage('classifier agreement');
    await asRole('postgres');
    await q('BEGIN');
    try {
      const f = await seedEligibleSnapshot(humans[0], humans[1]);
      await verifyClassifierAgreement(report, f.snapshot, f.policy.filter, humans[0], humans[1]);
    } finally {
      await q('ROLLBACK');
    }

    setStage('disclosure gate');
    await verifyDisclosureGate(report, humans);
  } finally {
    // The seam replacement lived inside a transaction that has rolled back, so
    // this re-applies the CAPTURED production definition and compares it byte
    // for byte: no run can leave a permissive seam installed, on any path.
    await rt.restoreMatchingSeam(nameSeam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  const [after] = await rows('SELECT * FROM public.resolve_matching_canonical_first_name_v1($1)', [humans[0]]);
  assert.equal(after.resolution, 'UNRESOLVED_NO_CANONICAL_SOURCE',
    'the production first-name seam is fail-closed again after the run');
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${P.PAIRS}) + (SELECT count(*) FROM ${P.SNAPSHOTS})
          + (SELECT count(*) FROM ${P.POLICY_STATE}) + (SELECT count(*) FROM ${P.PROPOSALS})
          + (SELECT count(*) FROM ${P.PERMITTED_CONCLUSIONS})
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
