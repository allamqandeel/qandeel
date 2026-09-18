// Real-PostgreSQL verifier for migration 0120 - QAN-CW-REM-02, Matching
// proposal temporal correctness and exact-view decision identity.
//
// Runs against a FULLY migrated database and proves the two accepted assurance
// findings are really fixed, on real concurrency, and that nothing the frozen
// I-07B and I-07C slices owned moved underneath them.
//
//   P01 the five replaced boundaries keep their exact 0112 signatures, their
//       postgres-owned SECURITY DEFINER search_path-pinned posture and their
//       "executable by nobody" ACL
//   P02 neither delivery path reads a transaction-fixed clock at all, each
//       captures ONE wall-clock instant, and it is captured after the canonical
//       pair lock, after the retry path, after revalidation and after the CW2-08
//       gate - and before the first irreversible delivery write
//   P03 the three clocks this task CLASSIFIED AS SAFE are untouched: the
//       correction is a defect class, not a global replacement
//   P04 the three corrected decisions still derive their human from auth.uid(),
//       still take no identity parameter, still enter the serialized region
//       before they read the exact view, and read their durable binding before
//       they answer any retry
//   P05 the binding relation is sealed, append-only, structurally bound and
//       reachable by no application role
//   P06 exactly the three reviewed decisions write it, exactly the forward
//       approval still writes the 0114 relation, and exactly one function still
//       writes a proposal transition
//   P07 the lifecycle census names it rather than being dodged
//
//   T01 first delivery before the deadline still succeeds
//   T02 ASSURE-F01, first delivery: a transaction that begins while the proposal
//       is live, BLOCKS on the canonical pair lock, crosses the real deadline
//       while blocked and resumes must fail MATCHING_PROPOSAL_EXPIRED with ZERO
//       delivery effects - and the pre-fix ordering, installed and run through
//       the SAME interleaving, really does deliver after the deadline
//   T03 second delivery before the deadline still succeeds
//   T04 ASSURE-F01, second delivery: the same proof, independently
//   T05 a first delivery that committed while live still answers its equivalent
//       retry after the deadline has passed
//   T06 the same for the second delivery
//   T07 the same command id carrying a different view still conflicts after the
//       deadline
//   T08 the I-07C Mutual Match cross-deadline race remains green
//
//   V01 FIRST_DECLINED: same view is the historical answer, another view is a
//       command conflict
//   V02 SECOND_DECLINED: the same
//   V03 WITHDRAWN: prior state AND exact view are both part of the identity
//   V04 a committed decision whose binding is absent fails closed, infers
//       nothing, recreates nothing and appends nothing
//   V05 the current view pointer MOVING after the act changes no retry identity
//   V06 the transition and its binding commit together or not at all
//   V07 a binding to another proposal's view, another human's view or a role the
//       decision does not permit is unrepresentable
//
//   N01 the 0114 forward approval is non-regressed in all three directions
//   N02 a full Mutual Match still commits on the exact bound approval view
//   N03 the I07B-CONC-01 view-supersession race is non-regressed
//   N04 no binding leaks through any recipient projection and the neutral
//       outcome vocabulary is unchanged
//   N05 the CW2-08 gate is still required where it was and still absent from
//       withdrawal
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createMatchRuntime, P, PFN, MATCH, matchIds, CLEAN,
  HUMAN_DECISIONS, DECISION_ENTRY_ORDER, NEUTRAL_OUTCOMES, REM02_LIFECYCLE_RELATIONS,
  LATER_SLICE_LIFECYCLE_RELATIONS, runVerifier, APP_ROLES,
} from './matching-match-verifier-support.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const BINDINGS = P.DECISION_BINDINGS;
/** The two boundaries ASSURE-F01 proved defective. */
const DELIVERIES = [PFN.OFFER, PFN.FORWARD];
/** The three boundaries ASSURE-F08 proved defective. */
const CORRECTED_DECISIONS = [PFN.DECLINE_FIRST, PFN.DECLINE_SECOND, PFN.WITHDRAW];
/** Every boundary migration 0120 replaces. */
const REPLACED = [...DELIVERIES, ...CORRECTED_DECISIONS];
/** The exact 0112 input parameter list of each, in order. */
const EXPECTED_INPUTS = new Map([
  [PFN.OFFER, ['p_command_id', 'p_proposal_id', 'p_view_id', 'p_permitted_conclusion_id']],
  [PFN.FORWARD, ['p_command_id', 'p_proposal_id', 'p_view_id', 'p_permitted_conclusion_id']],
  [PFN.DECLINE_FIRST, ['p_command_id', 'p_proposal_id', 'p_expected_view_id']],
  [PFN.DECLINE_SECOND, ['p_command_id', 'p_proposal_id', 'p_expected_view_id']],
  [PFN.WITHDRAW, ['p_command_id', 'p_proposal_id', 'p_expected_view_id', 'p_expected_state']],
]);
/** Every clock PostgreSQL settles at the START of a transaction. */
const TRANSACTION_CLOCK = /now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp/iu;
/** The three decision classes the new relation may carry, with the role each fixes. */
const DECISION_ROLES = [
  ['FIRST_DECLINED', 'FIRST_RECIPIENT'],
  ['SECOND_DECLINED', 'CANDIDATE'],
  ['WITHDRAWN', 'FIRST_RECIPIENT'],
];

const stripComments = (source) => source.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const outcomeOf = (promise) => promise.then(() => null, (error) => error);

/**
 * Ends any transaction the primary connection may still be holding.
 *
 * A race section that threw part way through leaves its BEGIN open, and the
 * seam restoration and teardown that follow must not run inside it. PostgreSQL
 * answers 25P01 here when there was no transaction, which is the ordinary case
 * and not a failure - so it is swallowed deliberately rather than through a
 * `.catch` on a runtime call, which is the shape the hazard detectors refuse.
 */
async function endTransaction() {
  try {
    await q('ROLLBACK');
  } catch {
    // No transaction was open. Nothing to end, and nothing to report.
  }
}

// -------------------------------------------------------------- 1. posture
async function verifyPosture() {
  await asRole('postgres');

  // P01 THE FIVE REPLACED BOUNDARIES DID NOT BECOME NEW BOUNDARIES.
  for (const fn of REPLACED) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.owner, 'postgres', `P01 ${fn} is postgres-owned`);
    assert.equal(p.secdef, true, `P01 ${fn} is SECURITY DEFINER`);
    assert.equal(p.volatility, 'v', `P01 ${fn} is a mutation and VOLATILE`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `P01 ${fn} pins an empty search_path`);
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false,
        `P01 ${role} must not execute ${fn}: a correction widens no consequential boundary`);
    }
    assert.deepEqual(await rt.inputParameters(fn), EXPECTED_INPUTS.get(fn),
      `P01 ${fn} keeps its exact 0112 input parameters`);
    assert.ok(!p.prosrc.includes('INSERT INTO public.matching_proposal_transitions'),
      `P01 ${fn} appends every transition through the one writer`);
    assert.doesNotMatch(p.prosrc, /pg_advisory|LOCK TABLE|DELETE FROM|TRUNCATE/iu,
      `P01 ${fn} takes no advisory or table lock and erases nothing`);
  }

  // P02 ASSURE-F01: THE DELIVERY CLOCK AND ITS PLACEMENT, on the live text.
  for (const fn of DELIVERIES) {
    const { prosrc } = await rt.functionPosture(fn);
    // Over the WHOLE source including comments: a transaction-fixed clock is
    // settled before the canonical lock wait, so a delivery path may not even
    // name one. The migration's own bodies describe the defect without spelling
    // any of these, which is what makes this assertion meaningful rather than
    // self-matching.
    assert.doesNotMatch(prosrc, TRANSACTION_CLOCK,
      `P02 ${fn} may read no transaction-fixed clock: every one of them precedes the pair lock wait`);
    assert.equal(prosrc.split('clock_timestamp()').length - 1, 1,
      `P02 ${fn} captures the real delivery instant exactly once`);
    const body = stripComments(prosrc);
    const at = (needle) => {
      const position = body.indexOf(needle);
      assert.ok(position >= 0, `P02 ${fn} carries ${needle}`);
      return position;
    };
    const lock = at('lock_matching_pair_humans_v1');
    const retry = at('FROM public.matching_proposal_transitions t');
    const validity = at('resolve_matching_proposal_validity_v1');
    const gate = at("gate.clearance <> 'CLEARED'");
    const clock = at('delivery_at := clock_timestamp()');
    const deadline = at('proposal.expires_at <= delivery_at');
    const disclosure = at('materialize_matching_recipient_view_core_v1');
    const writer = at('append_matching_proposal_transition_v1');
    assert.ok(lock < retry && retry < validity && validity < gate && gate < clock
      && clock < deadline && deadline < disclosure && disclosure < writer,
    `P02 ${fn} locks, answers an equivalent retry, revalidates, gates, captures the REAL delivery instant, decides the deadline against it, and only then discloses and appends`);
    assert.ok(prosrc.includes('MATCHING_PROPOSAL_EXPIRED'),
      `P02 ${fn} keeps the exact existing expiry refusal`);
  }

  // P03 THE CLASSIFIED-SAFE CLOCKS ARE UNTOUCHED. This task corrected a defect
  // class rather than every clock: preparation's transaction instant is the one
  // coherent preparation moment and yields a SHORTER life, and the expiry
  // terminal's stale clock can only decline to fire. Replacing either would have
  // widened rather than narrowed, so "we did not" is asserted rather than
  // claimed.
  for (const fn of [PFN.PREPARE, PFN.EXPIRE]) {
    const { prosrc } = await rt.functionPosture(fn);
    assert.match(prosrc, /CURRENT_TIMESTAMP/u,
      `P03 ${fn} keeps its classified-safe transaction clock`);
    assert.doesNotMatch(prosrc, /clock_timestamp/u,
      `P03 ${fn} was classified SAFE and is out of scope; it gained no wall clock`);
  }

  // P04 ASSURE-F08: THE THREE CORRECTED DECISIONS.
  for (const fn of CORRECTED_DECISIONS) {
    const { prosrc } = await rt.functionPosture(fn);
    assert.match(prosrc, /auth\.uid\(\)/u, `P04 ${fn} derives its human from auth.uid()`);
    assert.doesNotMatch(prosrc, TRANSACTION_CLOCK,
      `P04 ${fn} decides nothing on a transaction clock and reads none`);
    assert.doesNotMatch(prosrc, /clock_timestamp/u,
      `P04 ${fn} decides nothing on a wall clock either: a human decision is not a deadline decision`);
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, /user|human|actor|grantor|owner|subject|on_behalf|candidate/u,
        `P04 ${fn} must not accept an identity parameter, found ${name}`);
    }
    const body = stripComments(prosrc);
    const [entry, view] = DECISION_ENTRY_ORDER.map((name) => body.indexOf(name.split('(')[0].replace('public.', '')));
    assert.ok(entry >= 0 && view > entry,
      `P04 ${fn} enters the canonical two-human serialization region BEFORE it checks the exact recipient view (I07B-CONC-01)`);
    assert.doesNotMatch(body, /lock_matching_pair_humans_v1/u,
      `P04 ${fn} reaches the setup locks only through the one entry point`);
    // The retry reads a DURABLE row, fails closed when it is absent, compares the
    // bound view and only then answers historically - and appends and binds in
    // that order for a new act.
    const at = (needle) => {
      const position = body.indexOf(needle);
      assert.ok(position >= 0, `P04 ${fn} carries ${needle}`);
      return position;
    };
    const read = at(`FROM ${BINDINGS} b`);
    const missing = at("'MATCHING_DECISION_CONTRADICTORY_STATE'");
    const compare = at('bound.decided_view_id IS DISTINCT FROM p_expected_view_id');
    const historical = at("'CLOSED_BY_YOU'::text; RETURN;");
    const writer = at('append_matching_proposal_transition_v1');
    const bind = at(`INSERT INTO ${BINDINGS}`);
    assert.ok(read < missing && missing < compare && compare < historical
      && historical < view && view < writer && writer < bind,
    `P04 ${fn} reads its durable binding, fails closed when it is absent, compares the bound view, answers historically, and otherwise appends and binds`);
    // A RETRY CONSULTS NO CURRENT TRUTH AT ALL.
    assert.doesNotMatch(body.slice(read, historical),
      /current_view_id|resolve_matching_proposal_prerequisites_v1|resolve_matching_proposal_validity_v1|expires_at|proposal_state/u,
      `P04 the ${fn} retry path may read no current view, clearance, validity, deadline or proposal state`);
  }
  // Withdrawal alone also proves its exact prior state, because WITHDRAWN is
  // legal from three of them.
  const withdrawal = (await rt.functionPosture(PFN.WITHDRAW)).prosrc;
  assert.match(withdrawal, /committed\.prior_state IS DISTINCT FROM p_expected_state/u,
    'P04 a withdrawal retry still proves the exact prior state its command named');

  // P05 THE BINDING RELATION IS SEALED, APPEND-ONLY AND STRUCTURALLY BOUND.
  const [relation] = await rows(
    `SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`,
    [BINDINGS.replace('public.', '')]);
  assert.equal(relation?.relrowsecurity, true, 'P05 the binding relation exists with row level security enabled');
  assert.equal(await count('pg_policy pol', 'pol.polrelid = $1::regclass', [BINDINGS]), 0,
    'P05 and carries no policy: it is reachable through the reviewed producers alone');
  for (const role of APP_ROLES) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const [{ held }] = await rows('SELECT has_table_privilege($1, $2, $3) AS held', [role, BINDINGS, privilege]);
      assert.equal(held, false, `P05 ${role} must hold no ${privilege} on the binding relation`);
    }
  }
  assert.equal(await rt.triggerEnabled(BINDINGS, 'matching_proposal_decision_view_bindings_immutable'), true,
    'P05 a binding is append-only history the moment it is written');
  const constraints = await rows(
    `SELECT con.conname, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con
      WHERE con.conrelid = $1::regclass ORDER BY con.conname`, [BINDINGS]);
  const definitionOf = (name) => constraints.find((c) => c.conname === name)?.definition ?? null;
  // `pg_get_constraintdef` omits the schema when it is on the search_path and
  // prints it when it is not, so the parent is matched either way.
  assert.match(String(definitionOf('matching_proposal_decision_view_bindings_transition_fk')),
    /REFERENCES (?:public\.)?matching_proposal_transitions\(id, proposal_id, resulting_state\)/u,
    'P05 a binding names THIS proposal transition into exactly THAT decision');
  assert.match(String(definitionOf('matching_proposal_decision_view_bindings_view_fk')),
    /REFERENCES (?:public\.)?matching_recipient_proposal_views\(id, proposal_id, recipient_user_id\)/u,
    'P05 and the exact view of this proposal held by that exact human');
  assert.match(String(definitionOf('matching_proposal_decision_view_bindings_role_fk')),
    /REFERENCES (?:public\.)?matching_recipient_proposal_views\(id, recipient_role\)/u,
    'P05 and that view is of exactly the role the decision fixes');
  assert.match(String(definitionOf('matching_proposal_decision_view_bindings_role_check')),
    /SECOND_DECLINED/u, 'P05 which role may decide is fixed by the decision itself');
  assert.equal(definitionOf('matching_proposal_decision_view_bindings_proposal_key'), 'UNIQUE (proposal_id)',
    'P05 all three decisions are terminal, so a proposal carries at most one binding');
  const cascading = constraints.filter((c) => /FOREIGN KEY/u.test(c.definition) && !/ON DELETE RESTRICT/u.test(c.definition));
  assert.deepEqual(cascading.map((c) => c.conname), [],
    'P05 every binding foreign key is ON DELETE RESTRICT: nothing removes evidence by side effect');
  const [additive] = await rows(
    `SELECT pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con
      WHERE con.conrelid = $1::regclass AND con.conname = $2`,
    [P.VIEWS, 'matching_recipient_proposal_views_role_identity_key']);
  assert.equal(additive?.definition, 'UNIQUE (id, recipient_role)',
    'P05 the additive predecessor candidate key is a key OVER the primary key and refuses nothing 0110 accepted');

  // P06 EXACT PRODUCER OWNERSHIP, live.
  const census = async (needle) => (await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prosrc LIKE $1 ORDER BY 1`, [needle])).map((r) => r.proname);
  assert.deepEqual(await census(`%INSERT INTO ${BINDINGS}%`),
    ['decline_matching_proposal_as_first_core_v1', 'decline_matching_proposal_as_second_core_v1',
      'withdraw_matching_proposal_core_v1'],
    'P06 exactly the three corrected decisions write a decision view binding');
  assert.deepEqual(await census(`%INSERT INTO ${MATCH.BINDINGS}%`),
    ['approve_matching_proposal_forward_core_v1'],
    'P06 and exactly the forward approval still writes the I-07C first-acceptance binding');
  assert.deepEqual(await census(`%INSERT INTO ${P.TRANSITIONS}%`),
    ['append_matching_proposal_transition_v1'],
    'P06 exactly one function still writes a proposal transition');
  const approval = (await rt.functionPosture(PFN.APPROVE)).prosrc;
  assert.match(approval, /matching_forward_approval_view_bindings/u,
    'P06 the forward approval keeps its own 0114 relation');
  assert.doesNotMatch(approval, /matching_proposal_decision_view_bindings/u,
    'P06 and gains nothing from this correction: the two bindings are separate evidence');

  // P07 THE LIFECYCLE CENSUS NAMES THE NEW RELATION rather than being dodged.
  // The point of comparing the LIVE catalog is that a lifecycle relation nobody
  // declared cannot hide from it, so a remediation names what it adds under its
  // own slice rather than renaming it out of the pattern.
  const LIFECYCLE_WORDS = /(candidate|proposal|pair|mutual|commit|slot|snapshot|eligibility|compatib|leaderboard|rank|score)/u;
  const lifecycle = await rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
        AND c.relname ~* '^(matching_|introduction_|pre_match_)'
        AND c.relname ~* '(candidate|proposal|pair|mutual|commit|slot|snapshot|eligibility|compatib|leaderboard|rank|score)'
      ORDER BY 1`);
  assert.deepEqual(lifecycle.map((r) => r.relname),
    LATER_SLICE_LIFECYCLE_RELATIONS.filter((name) => LIFECYCLE_WORDS.test(name)),
    'P07 every lifecycle relation in the Matching namespace is one a named reviewed slice owns');
  assert.deepEqual(REM02_LIFECYCLE_RELATIONS, [BINDINGS.replace('public.', '')],
    'P07 and this remediation owns exactly the one relation it adds');

  // P08 NO RECIPIENT PROJECTION CAN REACH THE NEW EVIDENCE.
  for (const fn of [PFN.MY_PROPOSAL, PFN.MY_FIELDS, PFN.NEUTRAL]) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.volatility, 's', `P08 ${fn} is STABLE and writes nothing`);
    assert.doesNotMatch(p.prosrc, /matching_proposal_decision_view_bindings/u,
      `P08 ${fn} may not read the decision view binding: it is internal authority evidence`);
  }
  // And the frozen recipient vocabulary is exactly the five neutral outcomes.
  const projection = (await rt.functionPosture(PFN.NEUTRAL)).prosrc;
  for (const outcome of NEUTRAL_OUTCOMES) {
    assert.ok(projection.includes(`'${outcome}'`), `P08 the neutral projection still answers ${outcome}`);
  }

  // The four human decisions, as one set, are still the four the slice froze.
  assert.equal(HUMAN_DECISIONS.length, 4, 'P08 there are still exactly four human proposal decisions');
}

// ------------------------------------------------- 2. ASSURE-F01, temporal
async function verifyTemporal(report, humans) {
  const [one, two] = humans;
  const extra = await rt.openExtra();
  const { qx, actAsX } = extra;
  const waitExtra = () => rt.waitForLockWait(q, extra.pid);
  /** Hold exactly the first row the canonical two-human lock takes, from the primary. */
  const holdPairLock = async (lower) => {
    await asRole('postgres');
    await q('BEGIN');
    await q(`INSERT INTO public.matching_setup_locks AS l (user_id) VALUES ($1)
             ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at`, [lower]);
  };
  const offerX = (command, proposal, view, conclusion) =>
    qx('SELECT * FROM public.offer_matching_proposal_to_first_core_v1($1, $2, $3, $4)',
      [command, proposal, view, conclusion]);
  const forwardX = (command, proposal, view, conclusion) =>
    qx('SELECT * FROM public.forward_matching_proposal_to_second_core_v1($1, $2, $3, $4)',
      [command, proposal, view, conclusion]);
  /** Everything a first-recipient delivery would create, counted by its own identities. */
  const firstDeliveryEffects = async (f, view, command) => ({
    views: await count(P.VIEWS, 'id = $1', [view]),
    fields: await count(P.VIEW_FIELDS, 'view_id = $1', [view]),
    pointer: await count(P.VIEW_STATE, 'proposal_id = $1 AND recipient_user_id = $2',
      [f.proposal, f.first]),
    transitions: await count(P.TRANSITIONS, 'id = $1', [command]),
    offered: await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'OFFERED_TO_FIRST'", [f.proposal]),
  });
  const secondDeliveryEffects = async (f, view, command) => ({
    views: await count(P.VIEWS, 'id = $1', [view]),
    fields: await count(P.VIEW_FIELDS, 'view_id = $1', [view]),
    pointer: await count(P.VIEW_STATE, 'proposal_id = $1 AND recipient_user_id = $2',
      [f.proposal, f.candidate]),
    transitions: await count(P.TRANSITIONS, 'id = $1', [command]),
    forwarded: await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'FORWARDED_TO_SECOND'", [f.proposal]),
  });
  const NOTHING_FIRST = { views: 0, fields: 0, pointer: 0, transitions: 0, offered: 0 };
  const NOTHING_SECOND = { views: 0, fields: 0, pointer: 0, transitions: 0, forwarded: 0 };

  try {
    await report.section('T01 a first delivery before the deadline still succeeds', async () => {
      const f = await bringToPrepared(one, two);
      await rt.deadlineIn(f.proposal, '2 hours');
      const view = randomUUID();
      const [offered] = await rt.offer(randomUUID(), f.proposal, view, f.conclusionForFirst);
      assert.equal(offered.offered_state, 'OFFERED_TO_FIRST', 'T01 the proposal is delivered');
      assert.equal(offered.offered_view_id, view, 'T01 on the exact view the caller named');
      assert.ok(offered.offered_field_count > 0, 'T01 with a real disclosed field set');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T02 a first delivery that waits past the deadline discloses nothing', async () => {
      // ASSURE-F01. A transaction clock is fixed BEFORE the lock wait, so a
      // delivery that entered while the proposal was live and resumed after the
      // deadline would compare a moment that had already gone by and disclose
      // protected material the proposal no longer authorized. Only this
      // interleaving can tell the two clocks apart, and the waiter's own
      // transaction timestamp is proven to PRECEDE the deadline it is refused
      // against.
      const f = await bringToPrepared(one, two);
      const deadline = await rt.deadlineIn(f.proposal, '2 seconds');
      const view = randomUUID();
      const command = randomUUID();
      await holdPairLock(f.lower);
      await actAsX(null);
      const inFlight = outcomeOf(offerX(command, f.proposal, view, f.conclusionForFirst));
      assert.equal(await waitExtra(), true, 'T02 the delivery is observably waiting on the canonical human lock');
      const [waiter] = await rows('SELECT xact_start FROM pg_stat_activity WHERE pid = $1', [extra.pid]);
      assert.ok(new Date(waiter.xact_start) < new Date(deadline),
        'T02 the waiting delivery entered while the proposal was still live: its transaction clock precedes the deadline it will be refused against');
      assert.equal(await rt.waitForInstant(deadline), true, 'T02 the real deadline passes while the delivery is still blocked');
      assert.equal(await waitExtra(), true, 'T02 and it is STILL waiting, so it can only resume after the deadline');
      await q('COMMIT');
      const outcome = await inFlight;
      await asRole('postgres');
      assert.ok(outcome, 'T02 a delivery that resumes past the deadline must fail closed');
      assert.notEqual(outcome.code, '40P01', 'T02 and not by deadlocking');
      assert.equal(outcome.code, '55000', 'T02 with the deadline class');
      assert.match(String(outcome.message), /MATCHING_PROPOSAL_EXPIRED/u, 'T02 named as an expiry and nothing else');
      assert.deepEqual(await firstDeliveryEffects(f, view, command), NOTHING_FIRST,
        'T02 ZERO first-recipient delivery effects survived');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'PREPARED',
        'T02 and the refusal terminalizes nothing: expiry is the boundary that does that');
      // The deadline was the only thing in the way.
      await rt.deadlineIn(f.proposal, '2 hours');
      const [offered] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
      assert.equal(offered.offered_state, 'OFFERED_TO_FIRST', 'T02 the same request commits once the proposal is live again');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T02P the pre-fix ordering really does deliver after the deadline', async () => {
      // A race that only ever showed the refusal would prove nothing about WHERE
      // the refusal came from. The pre-fix decision is installed - the deadline
      // decided against the transaction clock, exactly as 0112 decided it - and
      // the SAME interleaving is run again. It must then DELIVER after the real
      // deadline, which is the defect the assurance review found. The canonical
      // definition is restored byte for byte on every path.
      const pristine = await rt.captureMatchingSeam(PFN.OFFER);
      try {
        const corrected = '  delivery_at := clock_timestamp();\n  IF proposal.expires_at <= delivery_at THEN\n';
        const defective = '  IF proposal.expires_at <= CURRENT_TIMESTAMP THEN\n';
        assert.ok(pristine.definition.includes(corrected),
          'T02P the canonical definition carries the corrected decision, so the mutation below has something to replace');
        const weakened = pristine.definition.replace(corrected, defective);
        assert.notEqual(weakened, pristine.definition, 'T02P the weakening actually changed the definition');
        assert.ok(!weakened.includes('clock_timestamp()'),
          'T02P and it really did put the deadline back on the transaction clock');
        await asRole('postgres');
        await q(weakened);

        const f = await bringToPrepared(one, two);
        const deadline = await rt.deadlineIn(f.proposal, '2 seconds');
        const view = randomUUID();
        const command = randomUUID();
        await holdPairLock(f.lower);
        await actAsX(null);
        const inFlight = outcomeOf(offerX(command, f.proposal, view, f.conclusionForFirst));
        assert.equal(await waitExtra(), true, 'T02P the pre-fix delivery is waiting on the same lock');
        assert.equal(await rt.waitForInstant(deadline), true, 'T02P the real deadline passes while it is blocked');
        assert.equal(await waitExtra(), true, 'T02P and it is still waiting');
        await q('COMMIT');
        const accepted = await inFlight;
        await asRole('postgres');
        assert.equal(accepted, null,
          'T02P without the correction a stale transaction clock really does authorize a delivery after the real deadline');
        assert.equal(await count(P.VIEWS, 'id = $1', [view]), 1,
          'T02P and protected proposal material was disclosed past the deadline, which is exactly ASSURE-F01');
        assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'OFFERED_TO_FIRST',
          'T02P the proposal really did advance');
        await rt.cleanupRace([one, two]);
      } finally {
        await asRole('postgres');
        await endTransaction();
        await rt.restoreMatchingSeam(pristine);
      }
    });

    await report.section('T03 a second delivery before the deadline still succeeds', async () => {
      const f = await rt.bringToApproved(one, two);
      await rt.deadlineIn(f.proposal, '2 hours');
      const view = randomUUID();
      const [forwarded] = await rt.forward(randomUUID(), f.proposal, view, f.conclusionForCandidate);
      assert.equal(forwarded.forwarded_state, 'FORWARDED_TO_SECOND', 'T03 the candidate proposal is delivered');
      assert.equal(forwarded.forwarded_view_id, view, 'T03 on the exact view the caller named');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T04 a second delivery that waits past the deadline discloses nothing', async () => {
      // Independently required: the second delivery has its own lock wait, its
      // own gates and its own disclosure about a different human, so second
      // delivery correctness is never inferred from the first.
      const f = await rt.bringToApproved(one, two);
      const deadline = await rt.deadlineIn(f.proposal, '2 seconds');
      const view = randomUUID();
      const command = randomUUID();
      await holdPairLock(f.lower);
      await actAsX(null);
      const inFlight = outcomeOf(forwardX(command, f.proposal, view, f.conclusionForCandidate));
      assert.equal(await waitExtra(), true, 'T04 the forward is observably waiting on the canonical human lock');
      const [waiter] = await rows('SELECT xact_start FROM pg_stat_activity WHERE pid = $1', [extra.pid]);
      assert.ok(new Date(waiter.xact_start) < new Date(deadline),
        'T04 it entered while the proposal was still live');
      assert.equal(await rt.waitForInstant(deadline), true, 'T04 the real deadline passes while it is blocked');
      assert.equal(await waitExtra(), true, 'T04 and it is STILL waiting');
      await q('COMMIT');
      const outcome = await inFlight;
      await asRole('postgres');
      assert.ok(outcome, 'T04 a forward that resumes past the deadline must fail closed');
      assert.notEqual(outcome.code, '40P01', 'T04 and not by deadlocking');
      assert.equal(outcome.code, '55000', 'T04 with the deadline class');
      assert.match(String(outcome.message), /MATCHING_PROPOSAL_EXPIRED/u, 'T04 named as an expiry');
      assert.deepEqual(await secondDeliveryEffects(f, view, command), NOTHING_SECOND,
        'T04 ZERO candidate-side delivery effects survived');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FIRST_FORWARD_APPROVED',
        'T04 and the proposal is exactly where the first party left it');
      await rt.deadlineIn(f.proposal, '2 hours');
      const [forwarded] = await rt.forward(command, f.proposal, view, f.conclusionForCandidate);
      assert.equal(forwarded.forwarded_state, 'FORWARDED_TO_SECOND', 'T04 the deadline was the only thing in the way');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T05 a committed first delivery still answers its retry after the deadline', async () => {
      // A historical retry is never re-decided against today's deadline: the
      // expiry check stays AFTER the idempotency path, where it cannot reach one.
      const f = await bringToPrepared(one, two);
      const view = randomUUID();
      const command = randomUUID();
      const [first] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
      await rt.backdate(f.proposal);
      const [{ expired }] = await rows(
        `SELECT (p.expires_at <= clock_timestamp()) AS expired FROM ${P.PROPOSALS} p WHERE p.id = $1`, [f.proposal]);
      assert.equal(expired, true, 'T05 the real deadline really has passed');
      const [again] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
      assert.deepEqual(again, first, 'T05 the equivalent retry returns the original committed answer');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T06 a committed second delivery still answers its retry after the deadline', async () => {
      const f = await rt.bringToApproved(one, two);
      const view = randomUUID();
      const command = randomUUID();
      const [first] = await rt.forward(command, f.proposal, view, f.conclusionForCandidate);
      await rt.backdate(f.proposal);
      const [again] = await rt.forward(command, f.proposal, view, f.conclusionForCandidate);
      assert.deepEqual(again, first, 'T06 the equivalent retry returns the original committed answer');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T07 a delivery command id carrying a different view still conflicts after the deadline', async () => {
      const f = await bringToPrepared(one, two);
      const view = randomUUID();
      const command = randomUUID();
      await rt.offer(command, f.proposal, view, f.conclusionForFirst);
      await rt.backdate(f.proposal);
      await q('BEGIN');
      await rejected(() => rt.offer(command, f.proposal, randomUUID(), f.conclusionForFirst),
        ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      await q('ROLLBACK');
      assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'OFFERED_TO_FIRST'", [f.proposal]), 1,
        'T07 and exactly the one committed delivery exists');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T08 the I-07C Mutual Match cross-deadline race is non-regressed', async () => {
      // I07C-TIME-01, re-proven here because this task moved the sibling clocks
      // and a regression in the Match core would look exactly like a pass in the
      // 0114 verifier's own static half.
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      const deadline = await rt.deadlineIn(f.proposal, '2 seconds');
      await holdPairLock(f.lower);
      await actAsX(two);
      const inFlight = outcomeOf(qx(
        'SELECT * FROM public.commit_matching_mutual_match_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [ids.command, f.proposal, f.secondView, ids.world, ids.record, ids.firstEpisode, ids.candidateEpisode,
          ids.firstClaim, ids.candidateClaim, ids.firstPause, ids.candidatePause, ids.handoff]));
      assert.equal(await waitExtra(), true, 'T08 the Match is observably waiting on the canonical human lock');
      assert.equal(await rt.waitForInstant(deadline), true, 'T08 the deadline passes while it is blocked');
      assert.equal(await waitExtra(), true, 'T08 and it is still waiting');
      await q('COMMIT');
      const outcome = await inFlight;
      await asRole('postgres');
      assert.ok(outcome, 'T08 a Match that resumes past the deadline must still fail closed');
      assert.equal(outcome.code, '55000', 'T08 with the deadline class');
      assert.match(String(outcome.message), /MATCHING_PROPOSAL_EXPIRED/u, 'T08 named as an expiry');
      assert.equal(await count(MATCH.COMMITS, 'id = $1', [ids.command]), 0, 'T08 and no Match committed');
      assert.equal(await count('public.shared_worlds', 'id = $1', [ids.world]), 0, 'T08 and no World was born');
      await rt.cleanupRace([one, two]);
    });
  } finally {
    await endTransaction();
    await extra.close();
  }
}

// -------------------------------------------- 3. ASSURE-F08, the exact view
async function verifyExactView(report, humans) {
  const [one, two] = humans;

  await report.section('V01 a first decline answers its retry only on the exact view it bound', async () => {
    const f = await rt.bringToOffered(one, two);
    const command = randomUUID();
    await actAs(one);
    const [declined] = await rt.declineFirst(command, f.proposal, f.firstView);
    assert.equal(declined.declined_state, 'FIRST_DECLINED', 'V01 the decline commits');
    await asRole('postgres');
    const bound = await rt.decisionBindingOf(command);
    assert.equal(bound?.decided_view_id, f.firstView, 'V01 bound atomically to the exact view that authorized it');
    assert.equal(bound.decision_state, 'FIRST_DECLINED', 'V01 as exactly that decision');
    assert.equal(bound.decider_role, 'FIRST_RECIPIENT', 'V01 in exactly that role');
    assert.equal(bound.decider_user_id, one, 'V01 by exactly that human');

    await actAs(one);
    const [again] = await rt.declineFirst(command, f.proposal, f.firstView);
    assert.deepEqual(again, declined, 'V01 the same command on the same view is the historical answer');
    await q('BEGIN');
    await rejected(() => rt.declineFirst(command, f.proposal, randomUUID()),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'FIRST_DECLINED'", [f.proposal]), 1,
      'V01 and the conflicting retry created nothing');
    await rt.cleanupRace([one, two]);
  });

  await report.section('V02 a second decline answers its retry only on the exact candidate view', async () => {
    const f = await rt.bringToForwarded(one, two);
    const command = randomUUID();
    await actAs(two);
    const [declined] = await rt.declineSecond(command, f.proposal, f.secondView);
    assert.equal(declined.declined_state, 'SECOND_DECLINED', 'V02 the decline commits');
    await asRole('postgres');
    const bound = await rt.decisionBindingOf(command);
    assert.equal(bound?.decided_view_id, f.secondView, 'V02 bound to the exact candidate view');
    assert.equal(bound.decider_role, 'CANDIDATE', 'V02 in the candidate role');
    assert.equal(bound.decider_user_id, two, 'V02 by the candidate');

    await actAs(two);
    const [again] = await rt.declineSecond(command, f.proposal, f.secondView);
    assert.deepEqual(again, declined, 'V02 the same command on the same view is the historical answer');
    await q('BEGIN');
    await rejected(() => rt.declineSecond(command, f.proposal, randomUUID()),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'SECOND_DECLINED'", [f.proposal]), 1,
      'V02 and the conflicting retry created nothing');
    await rt.cleanupRace([one, two]);
  });

  await report.section('V03 a withdrawal binds BOTH its exact prior state and its exact view', async () => {
    const f = await rt.bringToOffered(one, two);
    const command = randomUUID();
    await actAs(one);
    const [withdrawn] = await rt.withdraw(command, f.proposal, f.firstView, 'OFFERED_TO_FIRST');
    assert.equal(withdrawn.withdrawn_state, 'WITHDRAWN', 'V03 the withdrawal commits');
    await asRole('postgres');
    assert.equal((await rt.decisionBindingOf(command))?.decided_view_id, f.firstView,
      'V03 bound to the exact view the withdrawing human held');

    await actAs(one);
    const [again] = await rt.withdraw(command, f.proposal, f.firstView, 'OFFERED_TO_FIRST');
    assert.deepEqual(again, withdrawn, 'V03 same command, same prior state, same view is the historical answer');
    // THE WHOLE MATRIX. Any difference in either immutable input is one bounded
    // conflict, decided from durable rows with no currentness consulted.
    await q('BEGIN');
    await rejected(() => rt.withdraw(command, f.proposal, randomUUID(), 'OFFERED_TO_FIRST'),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await rejected(() => rt.withdraw(command, f.proposal, f.firstView, 'FIRST_FORWARD_APPROVED'),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await rejected(() => rt.withdraw(command, f.proposal, randomUUID(), 'FIRST_FORWARD_APPROVED'),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'WITHDRAWN'", [f.proposal]), 1,
      'V03 and none of the three conflicting retries created anything');
    await rt.cleanupRace([one, two]);
  });

  await report.section('V04 a committed decision with no binding fails closed and repairs nothing', async () => {
    // The ONLY representable shape of a pre-0120 transition: a terminal human
    // decision that really committed and really has no binding. It keeps its
    // row, its private reason and its terminal lifecycle; what it can no longer
    // do is claim an equivalent retry, because it cannot prove the exact view
    // that authorized it.
    for (const [label, build, call, role] of [
      ['FIRST_DECLINED', () => rt.bringToOffered(one, two),
        (f, command, view) => rt.declineFirst(command, f.proposal, view), 'first'],
      ['SECOND_DECLINED', () => rt.bringToForwarded(one, two),
        (f, command, view) => rt.declineSecond(command, f.proposal, view), 'second'],
      ['WITHDRAWN', () => rt.bringToOffered(one, two),
        (f, command, view) => rt.withdraw(command, f.proposal, view, 'OFFERED_TO_FIRST'), 'first'],
    ]) {
      const f = await build();
      const actor = role === 'first' ? one : two;
      const view = role === 'first' ? f.firstView : f.secondView;
      const command = randomUUID();
      await actAs(actor);
      await call(f, command, view);
      await asRole('postgres');
      await rt.removeDecisionBinding(command);
      const before = await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]);

      await actAs(actor);
      await q('BEGIN');
      // The view the human really held, and then some other one: both are
      // refused BEFORE any view is compared, so nothing is inferred from the
      // current pointer and nothing is reconstructed.
      await rejected(() => call(f, command, view), ['P0001'], /MATCHING_DECISION_CONTRADICTORY_STATE/u);
      await rejected(() => call(f, command, randomUUID()), ['P0001'], /MATCHING_DECISION_CONTRADICTORY_STATE/u);
      await q('ROLLBACK');
      await asRole('postgres');
      assert.equal(await rt.decisionBindingOf(command), null,
        `V04 ${label}: no binding was inferred, backfilled or recreated`);
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]), before,
        `V04 ${label}: no new transition was appended`);
      assert.equal(await count(P.TRANSITIONS, 'id = $1', [command]), 1,
        `V04 ${label}: the historical transition itself is untouched truth`);
      await rt.cleanupRace([one, two]);
    }
  });

  await report.section('V05 the current view pointer moving after the act changes no retry identity', async () => {
    // The historical exact view is immutable evidence. The CURRENT view may have
    // moved since the act, so a retry that inferred the original from the
    // pointer would answer a different question than the one it repeats.
    const f = await rt.bringToOffered(one, two);
    const command = randomUUID();
    await actAs(one);
    const [declined] = await rt.declineFirst(command, f.proposal, f.firstView);
    await asRole('postgres');
    const superseding = randomUUID();
    await rt.materialize(superseding, f.proposal, one, f.conclusionForFirst);
    assert.equal(await rt.currentViewOf(f.proposal, one), superseding,
      'V05 the current view pointer really did move to a later version');

    await actAs(one);
    const [again] = await rt.declineFirst(command, f.proposal, f.firstView);
    assert.deepEqual(again, declined,
      'V05 the retry on the ORIGINAL bound view is still the historical answer');
    await q('BEGIN');
    await rejected(() => rt.declineFirst(command, f.proposal, superseding),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal((await rt.decisionBindingOf(command))?.decided_view_id, f.firstView,
      'V05 and the binding still names the view that really authorized the act');
    await rt.cleanupRace([one, two]);
  });

  await report.section('V06 the transition and its binding commit together or not at all', async () => {
    const f = await rt.bringToOffered(one, two);
    const command = randomUUID();
    await actAs(one);
    await q('BEGIN');
    await rt.declineFirst(command, f.proposal, f.firstView);
    await asRole('postgres');
    assert.equal(await count(P.TRANSITIONS, 'id = $1', [command]), 1, 'V06 inside the transaction the transition exists');
    assert.equal(await count(BINDINGS, 'decision_transition_id = $1', [command]), 1, 'V06 and so does its binding');
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(P.TRANSITIONS, 'id = $1', [command]), 0, 'V06 and after a rollback neither exists');
    assert.equal(await count(BINDINGS, 'decision_transition_id = $1', [command]), 0,
      'V06 so no successful decision can ever be left without the view that authorized it');
    await rt.cleanupRace([one, two]);
  });

  await report.section('V07 a binding to the wrong view, the wrong human or the wrong role is unrepresentable', async () => {
    // The producers are reviewed, but the ceiling is structural rather than
    // conventional: these are refused by the database itself, as the owner.
    const f = await rt.bringToForwarded(one, two);
    const command = randomUUID();
    await actAs(one);
    const [declined] = await rt.withdraw(command, f.proposal, f.firstView, 'FORWARDED_TO_SECOND');
    assert.equal(declined.withdrawn_state, 'WITHDRAWN', 'V07 the fixture withdrawal commits');
    await asRole('postgres');
    await rt.removeDecisionBinding(command);
    const insert = (values) => q(
      `INSERT INTO ${BINDINGS}
         (decision_transition_id, proposal_id, decision_state, decider_role, decider_user_id, decided_view_id)
       VALUES ($1, $2, $3, $4, $5, $6)`, values);
    await q('BEGIN');
    // The candidate's own view, bound to a decision only the first recipient may
    // have made: the role foreign key refuses it.
    await rejected(() => insert([command, f.proposal, 'WITHDRAWN', 'FIRST_RECIPIENT', one, f.secondView]), ['23503']);
    // Another human's identity against this human's view: the audience key refuses it.
    await rejected(() => insert([command, f.proposal, 'WITHDRAWN', 'FIRST_RECIPIENT', two, f.firstView]), ['23503']);
    // A decision this transition is not: the transition key refuses it.
    await rejected(() => insert([command, f.proposal, 'FIRST_DECLINED', 'FIRST_RECIPIENT', one, f.firstView]), ['23503']);
    // A role the decision does not permit: the role CHECK refuses it.
    await rejected(() => insert([command, f.proposal, 'WITHDRAWN', 'CANDIDATE', one, f.firstView]), ['23514']);
    // A decision class that is not one of the three: the state CHECK refuses it.
    await rejected(() => insert([command, f.proposal, 'FIRST_FORWARD_APPROVED', 'FIRST_RECIPIENT', one, f.firstView]), ['23514']);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(BINDINGS, 'decision_transition_id = $1', [command]), 0,
      'V07 and none of the five refused shapes was written');
    await rt.cleanupRace([one, two]);
  });

  await report.section('V08 every decision class the relation permits is one a reviewed producer writes', async () => {
    // Non-vacuity for the vocabulary above: each of the three really is produced,
    // with the role the CHECK fixes, by the real boundary.
    const produced = [];
    for (const [state, role] of DECISION_ROLES) {
      const f = state === 'SECOND_DECLINED' ? await rt.bringToForwarded(one, two) : await rt.bringToOffered(one, two);
      const actor = role === 'CANDIDATE' ? two : one;
      const command = randomUUID();
      await actAs(actor);
      if (state === 'FIRST_DECLINED') await rt.declineFirst(command, f.proposal, f.firstView);
      else if (state === 'SECOND_DECLINED') await rt.declineSecond(command, f.proposal, f.secondView);
      else await rt.withdraw(command, f.proposal, f.firstView, 'OFFERED_TO_FIRST');
      await asRole('postgres');
      const bound = await rt.decisionBindingOf(command);
      produced.push([bound?.decision_state, bound?.decider_role]);
      await rt.cleanupRace([one, two]);
    }
    assert.deepEqual(produced, DECISION_ROLES,
      'V08 all three decision classes are produced, each in exactly the role the relation fixes for it');
  });
}

// --------------------------------------------------------- 4. non-regression
async function verifyNonRegression(report, humans, gateSeam) {
  const [one, two] = humans;

  await report.section('N01 the 0114 forward-approval exact-view binding is non-regressed', async () => {
    const f = await rt.bringToOffered(one, two);
    const command = randomUUID();
    await actAs(one);
    const [approved] = await rt.approveForward(command, f.proposal, f.firstView);
    assert.equal(approved.approved_state, 'FIRST_FORWARD_APPROVED', 'N01 the approval commits');
    await asRole('postgres');
    assert.equal((await rt.bindingOf(f.proposal))?.approved_view_id, f.firstView,
      'N01 into its own 0114 relation, on the exact approved view');
    assert.equal(await count(BINDINGS, 'proposal_id = $1', [f.proposal]), 0,
      'N01 and NOT into the new decision relation: the two bindings are separate evidence');

    await actAs(one);
    const [again] = await rt.approveForward(command, f.proposal, f.firstView);
    assert.deepEqual(again, approved, 'N01 the same-view retry is still the historical answer');
    await q('BEGIN');
    await rejected(() => rt.approveForward(command, f.proposal, randomUUID()),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
    // And a committed approval whose binding is missing still fails closed.
    await asRole('postgres');
    await q(`ALTER TABLE ${MATCH.BINDINGS} DISABLE TRIGGER matching_forward_approval_view_bindings_immutable`);
    await q(`DELETE FROM ${MATCH.BINDINGS} WHERE approval_transition_id = $1`, [command]);
    await q(`ALTER TABLE ${MATCH.BINDINGS} ENABLE TRIGGER matching_forward_approval_view_bindings_immutable`);
    await actAs(one);
    await q('BEGIN');
    await rejected(() => rt.approveForward(command, f.proposal, f.firstView),
      ['P0001'], /MATCHING_MATCH_CONTRADICTORY_STATE/u);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await rt.triggerEnabled(MATCH.BINDINGS, 'matching_forward_approval_view_bindings_immutable'), true,
      'N01 and the I-07C append-only guard is enabled again');
    await rt.cleanupRace([one, two]);
  });

  await report.section('N02 a full Mutual Match still commits on the exact bound approval view', async () => {
    const f = await rt.bringToForwarded(one, two);
    const ids = matchIds();
    await actAs(two);
    const [committed] = await rt.commitMatch(ids, f.proposal, f.secondView);
    assert.equal(committed.outcome, 'MATCHED', 'N02 the Match commits');
    await asRole('postgres');
    const commit = await rt.commitRow(ids.command);
    assert.equal(commit.first_approved_view_id, f.firstView, 'N02 on the exact first-approval view the 0114 binding names');
    assert.equal(commit.candidate_accepted_view_id, f.secondView, 'N02 and the exact current candidate view');
    assert.equal(await count(BINDINGS, 'proposal_id = $1', [f.proposal]), 0,
      'N02 and a Mutual Match writes no terminal decision binding: it is not one of the three');
    await rt.cleanupRace([one, two]);
  });

  await report.section('N03 the I07B-CONC-01 view-supersession race is non-regressed', async () => {
    // A recipient view superseded under the canonical pair lock between a human
    // reading it and acting on it must still defeat the act. The exact-view
    // binding is written AFTER that guard, so a stale view can never reach it.
    const [{ pid }] = await rows('SELECT pg_backend_pid() AS pid');
    const secondary = await rt.openSecondary();
    const { q2 } = secondary;
    try {
      const f = await rt.bringToOffered(one, two);
      const superseding = randomUUID();
      await q2('BEGIN');
      await q2('SELECT public.lock_matching_pair_humans_v1($1, $2)', [f.lower, f.higher]);
      await q2('SELECT * FROM public.materialize_matching_recipient_view_core_v1($1, $2, $3, $4)',
        [superseding, f.proposal, one, f.conclusionForFirst]);

      await actAs(one);
      const command = randomUUID();
      const inFlight = outcomeOf(rt.declineFirst(command, f.proposal, f.firstView));
      assert.equal(await rt.waitForLockWait(q2, pid), true,
        'N03 the decline reached the serialization point and is waiting for the lock the other connection holds');
      await q2('COMMIT');
      const outcome = await inFlight;
      await asRole('postgres');
      assert.ok(outcome, 'N03 the human action must fail closed rather than act on the superseded view');
      assert.equal(outcome.code, '40001', 'N03 with the bounded stale-state class');
      assert.match(String(outcome.message), /RECIPIENT_VIEW_STALE/u, 'N03 naming the exact-view staleness');
      assert.equal(await count(P.TRANSITIONS, 'id = $1', [command]), 0, 'N03 no transition from the stale view exists');
      assert.equal(await count(BINDINGS, 'decision_transition_id = $1', [command]), 0,
        'N03 and no binding either: a stale view never reaches the evidence');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'OFFERED_TO_FIRST',
        'N03 the proposal is exactly where it was');
      await rt.cleanupRace([one, two]);
    } finally {
      await secondary.close();
    }
  });

  await report.section('N04 the binding leaks through no recipient projection and no outcome changed', async () => {
    const f = await rt.bringToForwarded(one, two);
    const command = randomUUID();
    await actAs(two);
    await rt.declineSecond(command, f.proposal, f.secondView);
    // The decliner sees their own act; the other party sees one indistinguishable
    // ending, with no reason, no terminal state name and no evidence identity.
    await actAs(two);
    const [asCandidate] = await rt.myProposal(f.proposal);
    assert.equal(asCandidate.neutral_outcome, 'CLOSED_BY_YOU', 'N04 the decliner is told only that they closed it');
    assert.equal(asCandidate.action_available, false, 'N04 with no affordance left');
    assert.deepEqual(Object.keys(asCandidate).filter((key) => /bind|decision|decided|authority|evidence/u.test(key)), [],
      'N04 and the projection declares no binding, decision or authority column');
    await actAs(one);
    const [asFirst] = await rt.myProposal(f.proposal);
    assert.equal(asFirst.neutral_outcome, 'NO_LONGER_AVAILABLE',
      'N04 the other party gets the one neutral ending every other ending also gives');
    for (const value of Object.values(asFirst)) {
      assert.notEqual(value, 'SECOND_DECLINED', 'N04 and never a terminal state name');
      assert.notEqual(value, 'RECIPIENT_DECLINED', 'N04 and never the private reason');
    }
    await asRole('postgres');
    assert.equal((await rt.decisionBindingOf(command))?.decided_view_id, f.secondView,
      'N04 while the evidence itself is durable, exact and internal');
    await rt.cleanupRace([one, two]);
  });

  await report.section('N05 the CW2-08 gate is still required where it was and still absent from withdrawal', async () => {
    try {
      const f = await rt.bringToOffered(one, two);
      // The PRODUCTION refusal, restored byte for byte for exactly this scenario
      // from the definition captured before the run replaced it.
      await asRole('postgres');
      await rt.restoreMatchingSeam(gateSeam);
      await actAs(one);
      await q('BEGIN');
      await rejected(() => rt.declineFirst(randomUUID(), f.proposal, f.firstView),
        ['55000'], /LAUNCH_PREREQUISITE_UNRESOLVED/u);
      await q('ROLLBACK');
      // Withdrawal ends exposure rather than creating it, so an unavailable gate
      // must not be able to trap a human inside a live proposal.
      await actAs(one);
      const [withdrawn] = await rt.withdraw(randomUUID(), f.proposal, f.firstView, 'OFFERED_TO_FIRST');
      assert.equal(withdrawn.withdrawn_state, 'WITHDRAWN',
        'N05 a human can still end their own exposure while the launch gate refuses everything else');
      await asRole('postgres');
      assert.equal(await count(BINDINGS, 'proposal_id = $1', [f.proposal]), 1,
        'N05 and the ungated withdrawal still bound its exact view');
      await rt.cleanupRace([one, two]);
    } finally {
      await asRole('postgres');
      await rt.clearProposalPrerequisites();
    }
  });
}

// ------------------------------------------------------------ 5. fixtures
/**
 * A proposal PREPARED and not yet offered, through the real boundaries.
 *
 * The I-07C fixture ladder starts at OFFERED because a Match needs one, but
 * ASSURE-F01's first-delivery race needs the state BEFORE the offer, so this
 * assembles exactly the same fixture one rung lower.
 */
async function bringToPrepared(first, candidate, options = {}) {
  const f = await rt.seedEligible(first, candidate, options);
  const forFirst = await rt.permitted(f.snapshot, first, candidate,
    `${CLEAN} A settled and unhurried outlook on both sides.`);
  const forCandidate = await rt.permitted(f.snapshot, candidate, first,
    `${CLEAN} The same unhurried outlook, from the other side of it.`);
  const proposal = randomUUID();
  await rt.prepare(proposal, f.snapshot, first);
  return {
    ...f, first, candidate, proposal,
    conclusionForFirst: forFirst.id, conclusionForCandidate: forCandidate.id,
  };
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID()];
await runVerifier('0120', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('posture');
  await verifyPosture();

  const report = createScenarioReport('0120', { query: q, restore: () => asRole('postgres') });
  const nameSeam = await rt.captureMatchingSeam(PFN.FIRST_NAME);
  const gateSeam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  try {
    // Both seams answer fail-closed in production and are proven to do so by the
    // 0111 verifier. A verifier that only ever saw the refusal would prove that
    // Matching refuses and nothing else, so both are replaced here and restored -
    // byte for byte - in the finally below, on every path.
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar' });
    await rt.clearProposalPrerequisites();

    setStage('temporal');
    await verifyTemporal(report, humans);
    setStage('exact-view');
    await verifyExactView(report, humans);
    setStage('non-regression');
    await verifyNonRegression(report, humans, gateSeam);
  } finally {
    await asRole('postgres');
    await rt.restoreMatchingSeam(nameSeam);
    await rt.restoreMatchingSeam(gateSeam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  const [gate] = await rows('SELECT * FROM public.resolve_matching_proposal_prerequisites_v1($1)', [randomUUID()]);
  assert.equal(gate.clearance, 'NOT_EVALUATED', 'the CW2-08 seam is fail-closed again after the run');
  const [name] = await rows('SELECT * FROM public.resolve_matching_canonical_first_name_v1($1)', [humans[0]]);
  assert.equal(name.resolution, 'UNRESOLVED_NO_CANONICAL_SOURCE', 'and the canonical first-name seam is fail-closed again');
  assert.equal(await rt.triggerEnabled(BINDINGS, 'matching_proposal_decision_view_bindings_immutable'), true,
    'the decision binding append-only guard is enabled at the end of the run');
  const restored = await rt.captureMatchingSeam(PFN.OFFER);
  assert.ok(restored.prosrc.includes('delivery_at := clock_timestamp()'),
    'and the corrected delivery clock is installed again after the pre-fix probe');
  await rt.removeCommittedProposalState(humans);
  await rt.removeCommittedPolicies();
  await rt.removeCommittedMatchingSetup(humans);
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${BINDINGS}) + (SELECT count(*) FROM ${MATCH.BINDINGS})
          + (SELECT count(*) FROM ${MATCH.COMMITS}) + (SELECT count(*) FROM ${P.PROPOSALS})
          + (SELECT count(*) FROM ${P.POLICY_STATE})
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier committed was removed again');
}, () => rt.client.end().catch(() => undefined));
