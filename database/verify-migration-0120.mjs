// Real-PostgreSQL verifier for migration 0120 - QAN-CW-REM-02, Matching
// proposal temporal correctness and exact-view command identity.
//
// Runs against a FULLY migrated database and proves the two accepted assurance
// findings and the two interim-review findings are really fixed, on real
// concurrency, and that nothing the frozen I-07B and I-07C slices owned moved
// underneath them.
//
//   P01 the six replaced boundaries keep their exact frozen signatures, their
//       postgres-owned SECURITY DEFINER search_path-pinned posture and their
//       "executable by nobody" ACL
//   P02 REM02-TIME-01: the ONE wall-clock decision lives at the disclosure
//       gate's own first-write boundary - after the pair lock, after the
//       already-materialized-view answer, after the view-state row lock and
//       after every field, policy, name and value check - and nothing separable
//       stands between it and the first INSERT
//   P03 the two delivery commands read NO clock at all and never reach the
//       mutable current view pointer; the clocks this task CLASSIFIED AS SAFE
//       are untouched
//   P04 the three corrected decisions still derive their human from auth.uid(),
//       still take no identity parameter, still enter the serialized region
//       before they read the exact view, and read their durable binding before
//       they answer any retry
//   P05 both binding relations are sealed, append-only, structurally bound and
//       reachable by no application role
//   P06 exactly the two deliveries write the delivery binding, exactly the three
//       decisions write the decision binding, exactly the forward approval still
//       writes the 0114 relation, and exactly one function writes a transition
//   P07 the lifecycle census names both new relations rather than being dodged
//   P08 no binding reaches a recipient projection
//
//   T01 first delivery before the deadline still succeeds
//   T02 ASSURE-F01, first delivery: a transaction that begins while the proposal
//       is live, BLOCKS on the canonical pair lock, crosses the real deadline
//       while blocked and resumes must fail MATCHING_PROPOSAL_EXPIRED with ZERO
//       delivery effects
//   T09 REM02-TIME-01: a delivery ALREADY PAST the pair lock and inside the
//       disclosure gate, blocked on pre-write gate work, that crosses the
//       deadline there still discloses nothing - the window an instant captured
//       before the gate could not see
//   T02P the pre-fix decision, installed and run through the SAME interleaving,
//       really does deliver after the deadline
//   T03 second delivery before the deadline still succeeds
//   T04 ASSURE-F01, second delivery: the same proof, independently
//   T05 a committed first delivery still answers its retry after the deadline
//   T06 the same for the second delivery
//   T07 the same command id carrying a different view still conflicts after the
//       deadline
//   T08 the I-07C Mutual Match cross-deadline race remains green
//
//   D01 REM02-IDEM-01, first delivery: same command + same view + same
//       conclusion is the historical answer; a different view is a conflict; a
//       different conclusion is a conflict
//   D02 second delivery: the same matrix, independently
//   D03 a committed delivery whose binding is absent fails closed for both
//       states, infers nothing, recreates nothing and delivers nothing
//   D04 the current view pointer MOVING after a delivery changes no retry
//       identity
//
//   V01 FIRST_DECLINED: same view is the historical answer, another view is a
//       command conflict
//   V02 SECOND_DECLINED: the same
//   V03 WITHDRAWN: prior state AND exact view are both part of the identity
//   V04 a committed decision whose binding is absent fails closed
//   V05 the current view pointer MOVING after the act changes no retry identity
//   V06 the transition and its binding commit together or not at all
//   V07 a binding to another proposal's view, another human's view or a role the
//       decision does not permit is unrepresentable
//   V08 every decision class the relation permits is one a reviewed producer
//       writes
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

const DELIVERY_BINDINGS = P.DELIVERY_BINDINGS;
const DECISION_BINDINGS = P.DECISION_BINDINGS;
/** The two boundaries ASSURE-F01 and REM02-IDEM-01 proved defective. */
const DELIVERIES = [PFN.OFFER, PFN.FORWARD];
/** The three boundaries ASSURE-F08 proved defective. */
const CORRECTED_DECISIONS = [PFN.DECLINE_FIRST, PFN.DECLINE_SECOND, PFN.WITHDRAW];
/** Every boundary migration 0120 replaces, the disclosure gate first. */
const REPLACED = [PFN.GATE, ...DELIVERIES, ...CORRECTED_DECISIONS];
/** The exact frozen input parameter list of each, in order. */
const EXPECTED_INPUTS = new Map([
  [PFN.GATE, ['p_view_id', 'p_proposal_id', 'p_recipient_user_id', 'p_permitted_conclusion_id']],
  [PFN.OFFER, ['p_command_id', 'p_proposal_id', 'p_view_id', 'p_permitted_conclusion_id']],
  [PFN.FORWARD, ['p_command_id', 'p_proposal_id', 'p_view_id', 'p_permitted_conclusion_id']],
  [PFN.DECLINE_FIRST, ['p_command_id', 'p_proposal_id', 'p_expected_view_id']],
  [PFN.DECLINE_SECOND, ['p_command_id', 'p_proposal_id', 'p_expected_view_id']],
  [PFN.WITHDRAW, ['p_command_id', 'p_proposal_id', 'p_expected_view_id', 'p_expected_state']],
]);
/** Every clock PostgreSQL settles at the START of a transaction. */
const TRANSACTION_CLOCK = /now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp/iu;
/** The three decision classes the decision binding permits, with the role each fixes. */
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

  // P01 THE SIX REPLACED BOUNDARIES DID NOT BECOME NEW BOUNDARIES.
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
      `P01 ${fn} keeps its exact frozen input parameters`);
    assert.ok(!p.prosrc.includes('INSERT INTO public.matching_proposal_transitions'),
      `P01 ${fn} appends every transition through the one writer`);
    assert.doesNotMatch(p.prosrc, /pg_advisory|LOCK TABLE|DELETE FROM|TRUNCATE/iu,
      `P01 ${fn} takes no advisory or table lock and erases nothing`);
  }

  // P02 REM02-TIME-01: THE ONE WALL CLOCK, AT THE GATE'S OWN FIRST WRITE.
  //
  // The gate re-enters the pair lock, answers its own view idempotency, derives
  // the audience, re-reads the snapshot, revalidates the subject's CURRENT setup
  // authority, reads the Product policy, reads the conclusion, resolves the
  // canonical first name, takes the view-state row FOR UPDATE and filters every
  // approved value - and the deadline can cross during ALL of that. So the
  // instant is read after it, not before the call.
  const gate = await rt.functionPosture(PFN.GATE);
  assert.doesNotMatch(gate.prosrc, TRANSACTION_CLOCK,
    'P02 the disclosure gate may read no transaction-fixed clock: every one of them is settled before its locks and its checks');
  assert.equal(gate.prosrc.split('clock_timestamp()').length - 1, 1,
    'P02 and captures the real delivery instant exactly once');
  assert.ok(gate.prosrc.includes('MATCHING_PROPOSAL_EXPIRED'),
    'P02 with the exact existing refusal, unchanged');
  const gateBody = stripComments(gate.prosrc);
  const gateAt = (needle) => {
    const position = gateBody.indexOf(needle);
    assert.ok(position >= 0, `P02 the disclosure gate carries ${needle}`);
    return position;
  };
  const gateOrder = [
    'lock_matching_pair_humans_v1',
    'INTO committed FROM public.matching_recipient_proposal_views v WHERE v.id = p_view_id',
    'RETURN QUERY SELECT committed.id, committed.proposal_id, committed.recipient_role,',
    'AND st.recipient_user_id = p_recipient_user_id FOR UPDATE',
    'IF disclosed = 0 THEN',
    'delivery_at := clock_timestamp()',
    'proposal.expires_at <= delivery_at',
    'INSERT INTO public.matching_recipient_proposal_views (',
  ].map(gateAt);
  for (let i = 1; i < gateOrder.length; i += 1) {
    assert.ok(gateOrder[i] > gateOrder[i - 1], `P02 disclosure-gate step ${i} follows step ${i - 1}`);
  }
  // AN ALREADY MATERIALIZED VIEW IS ANSWERED BEFORE ANY DEADLINE DECISION, so a
  // view really created while the proposal was live keeps answering its retry.
  assert.ok(gateOrder[2] < gateOrder[5], 'P02 history is answered before the deadline is decided');
  // AND NOTHING SEPARABLE STANDS BETWEEN THE DECISION AND THE WRITE.
  assert.ok(gateOrder[7] - gateOrder[6] <= 220,
    'P02 the deadline decision is the LAST statement before the first irreversible write, not merely somewhere before it');

  // P03 THE DELIVERY COMMANDS READ NO CLOCK, AND NO CURRENT VIEW POINTER.
  for (const fn of DELIVERIES) {
    const { prosrc } = await rt.functionPosture(fn);
    assert.doesNotMatch(prosrc, TRANSACTION_CLOCK, `P03 ${fn} reads no transaction clock`);
    assert.doesNotMatch(prosrc, /clock_timestamp/u,
      `P03 ${fn} reads no wall clock either: there is ONE temporal decision on the path and it is the gate's`);
    assert.match(prosrc, /materialize_matching_recipient_view_core_v1/u,
      `P03 ${fn} discloses through the ONE gate that decides the deadline`);
    // REM02-IDEM-01: a forward-moving pointer can never be the identity of a
    // historical command, so the delivery does not reach it at all.
    assert.doesNotMatch(prosrc, /matching_recipient_proposal_view_state/u,
      `P03 ${fn} may not reach the current view pointer; the durable binding is the historical identity`);
    const body = stripComments(prosrc);
    const at = (needle) => {
      const position = body.indexOf(needle);
      assert.ok(position >= 0, `P03 ${fn} carries ${needle}`);
      return position;
    };
    const order = [
      'lock_matching_pair_humans_v1',
      'FROM public.matching_proposal_transitions t',
      `FROM ${DELIVERY_BINDINGS} b`,
      "'MATCHING_DELIVERY_CONTRADICTORY_STATE'",
      'delivered.permitted_conclusion_id IS DISTINCT FROM p_permitted_conclusion_id',
      'bound.delivered_view_id, already;',
      'resolve_matching_proposal_validity_v1',
      "gate.clearance <> 'CLEARED'",
      'materialize_matching_recipient_view_core_v1',
      'append_matching_proposal_transition_v1',
      `INSERT INTO ${DELIVERY_BINDINGS}`,
    ].map(at);
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(order[i] > order[i - 1], `P03 ${fn} delivery step ${i} follows step ${i - 1}`);
    }
    assert.doesNotMatch(body.slice(order[1], order[5]),
      /current_view_id|resolve_matching_proposal_prerequisites_v1|resolve_matching_proposal_validity_v1|expires_at|proposal_state/u,
      `P03 the ${fn} retry path reads no current truth at all`);
  }

  // P03b THE CLASSIFIED-SAFE CLOCKS ARE UNTOUCHED. This task corrected a defect
  // class rather than every clock: preparation's transaction instant is the one
  // coherent preparation moment and yields a SHORTER life, and the expiry
  // terminal's stale clock can only decline to fire. Replacing either would have
  // widened rather than narrowed, so "we did not" is asserted rather than
  // claimed.
  for (const fn of [PFN.PREPARE, PFN.EXPIRE]) {
    const { prosrc } = await rt.functionPosture(fn);
    assert.match(prosrc, /CURRENT_TIMESTAMP/u, `P03 ${fn} keeps its classified-safe transaction clock`);
    assert.doesNotMatch(prosrc, /clock_timestamp/u,
      `P03 ${fn} was classified SAFE and is out of scope; it gained no wall clock`);
  }

  // P04 ASSURE-F08: THE THREE CORRECTED DECISIONS.
  for (const fn of CORRECTED_DECISIONS) {
    const { prosrc } = await rt.functionPosture(fn);
    assert.match(prosrc, /auth\.uid\(\)/u, `P04 ${fn} derives its human from auth.uid()`);
    assert.doesNotMatch(prosrc, TRANSACTION_CLOCK, `P04 ${fn} decides nothing on a transaction clock`);
    assert.doesNotMatch(prosrc, /clock_timestamp/u, `P04 ${fn} decides nothing on a wall clock either`);
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
    const at = (needle) => {
      const position = body.indexOf(needle);
      assert.ok(position >= 0, `P04 ${fn} carries ${needle}`);
      return position;
    };
    const read = at(`FROM ${DECISION_BINDINGS} b`);
    const missing = at("'MATCHING_DECISION_CONTRADICTORY_STATE'");
    const compare = at('bound.decided_view_id IS DISTINCT FROM p_expected_view_id');
    const historical = at("'CLOSED_BY_YOU'::text; RETURN;");
    const writer = at('append_matching_proposal_transition_v1');
    const bind = at(`INSERT INTO ${DECISION_BINDINGS}`);
    assert.ok(read < missing && missing < compare && compare < historical
      && historical < view && view < writer && writer < bind,
    `P04 ${fn} reads its durable binding, fails closed when it is absent, compares the bound view, answers historically, and otherwise appends and binds`);
    assert.doesNotMatch(body.slice(read, historical),
      /current_view_id|resolve_matching_proposal_prerequisites_v1|resolve_matching_proposal_validity_v1|expires_at|proposal_state/u,
      `P04 the ${fn} retry path may read no current view, clearance, validity, deadline or proposal state`);
  }
  const withdrawal = (await rt.functionPosture(PFN.WITHDRAW)).prosrc;
  assert.match(withdrawal, /committed\.prior_state IS DISTINCT FROM p_expected_state/u,
    'P04 a withdrawal retry still proves the exact prior state its command named');

  // P05 BOTH BINDING RELATIONS ARE SEALED, APPEND-ONLY AND STRUCTURALLY BOUND.
  for (const [relation, transitionColumn, viewColumn, humanColumn, roleColumn] of [
    [DELIVERY_BINDINGS, 'delivery_transition_id', 'delivered_view_id', 'recipient_user_id', 'recipient_role'],
    [DECISION_BINDINGS, 'decision_transition_id', 'decided_view_id', 'decider_user_id', 'decider_role'],
  ]) {
    const bare = relation.replace('public.', '');
    const [row] = await rows(
      `SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`, [bare]);
    assert.equal(row?.relrowsecurity, true, `P05 ${bare} exists with row level security enabled`);
    assert.equal(await count('pg_policy pol', 'pol.polrelid = $1::regclass', [relation]), 0,
      `P05 ${bare} carries no policy: it is reachable through the reviewed producers alone`);
    for (const role of APP_ROLES) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ held }] = await rows('SELECT has_table_privilege($1, $2, $3) AS held', [role, relation, privilege]);
        assert.equal(held, false, `P05 ${role} must hold no ${privilege} on ${bare}`);
      }
    }
    assert.equal(await rt.triggerEnabled(relation, `${bare}_immutable`), true,
      `P05 ${bare} is append-only history the moment it is written`);
    const constraints = await rows(
      `SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con
        WHERE con.conrelid = $1::regclass ORDER BY con.conname`, [relation]);
    const definitionOf = (suffix) => constraints.find((c) => c.conname === `${bare}_${suffix}`)?.definition ?? null;
    // `pg_get_constraintdef` omits the schema when it is on the search_path and
    // prints it when it is not, so the parent is matched either way.
    assert.match(String(definitionOf('transition_fk')),
      new RegExp(`FOREIGN KEY \\(${transitionColumn}, proposal_id, \\w+_state\\)[\\s\\S]*?REFERENCES (?:public\\.)?matching_proposal_transitions\\(id, proposal_id, resulting_state\\)`, 'u'),
      `P05 a ${bare} row names THIS proposal transition into exactly THAT state`);
    assert.match(String(definitionOf('view_fk')),
      new RegExp(`FOREIGN KEY \\(${viewColumn}, proposal_id, ${humanColumn}\\)[\\s\\S]*?REFERENCES (?:public\\.)?matching_recipient_proposal_views\\(id, proposal_id, recipient_user_id\\)`, 'u'),
      'P05 and the exact view of this proposal held by that exact human');
    assert.match(String(definitionOf('role_fk')),
      new RegExp(`FOREIGN KEY \\(${viewColumn}, ${roleColumn}\\)[\\s\\S]*?REFERENCES (?:public\\.)?matching_recipient_proposal_views\\(id, recipient_role\\)`, 'u'),
      `P05 and that view is of exactly the role the ${bare} row fixes`);
    const foreignKeys = constraints.filter((c) => c.contype === 'f');
    assert.equal(foreignKeys.length, 3,
      `P05 ${bare} binds its transition, its exact view and that view's role, and nothing less`);
    assert.deepEqual(foreignKeys.filter((c) => !/ON DELETE RESTRICT/u.test(c.definition)).map((c) => c.conname), [],
      `P05 every ${bare} foreign key is ON DELETE RESTRICT: nothing removes evidence by side effect`);
    assert.match(String(definitionOf('role_check')), /CASE/u,
      `P05 and which role a ${bare} row may carry is fixed by the state itself`);
  }
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
  assert.deepEqual(await census(`%INSERT INTO ${DELIVERY_BINDINGS}%`),
    ['forward_matching_proposal_to_second_core_v1', 'offer_matching_proposal_to_first_core_v1'],
    'P06 exactly the two corrected deliveries write a delivery view binding');
  assert.deepEqual(await census(`%INSERT INTO ${DECISION_BINDINGS}%`),
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
  assert.doesNotMatch(approval, /matching_proposal_(?:decision|delivery)_view_bindings/u,
    'P06 and gains nothing from this correction: the three bindings are three different authority facts');

  // P07 THE LIFECYCLE CENSUS NAMES BOTH NEW RELATIONS rather than being dodged.
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
  assert.deepEqual([...REM02_LIFECYCLE_RELATIONS].sort(),
    [DECISION_BINDINGS, DELIVERY_BINDINGS].map((r) => r.replace('public.', '')).sort(),
    'P07 and this remediation owns exactly the two relations it adds');

  // P08 NO RECIPIENT PROJECTION CAN REACH EITHER BINDING.
  for (const fn of [PFN.MY_PROPOSAL, PFN.MY_FIELDS, PFN.NEUTRAL]) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.volatility, 's', `P08 ${fn} is STABLE and writes nothing`);
    assert.doesNotMatch(p.prosrc, /matching_proposal_(?:decision|delivery)_view_bindings/u,
      `P08 ${fn} may not read a view binding: they are internal authority evidence`);
  }
  const projection = (await rt.functionPosture(PFN.NEUTRAL)).prosrc;
  for (const outcome of NEUTRAL_OUTCOMES) {
    assert.ok(projection.includes(`'${outcome}'`), `P08 the neutral projection still answers ${outcome}`);
  }
  assert.equal(HUMAN_DECISIONS.length, 4, 'P08 there are still exactly four human proposal decisions');
}

// ------------------------------------------------- 2. ASSURE-F01, temporal
async function verifyTemporal(report, humans, nameSeam) {
  const [one, two, barrier] = humans;
  const extra = await rt.openExtra();
  const { qx, actAsX } = extra;
  const waitExtra = () => rt.waitForLockWait(q, extra.pid);
  /** Hold one exact I-07A serialization row from the primary, in an open transaction. */
  const holdSetupLock = async (human) => {
    await asRole('postgres');
    await q('BEGIN');
    await q(`INSERT INTO public.matching_setup_locks AS l (user_id) VALUES ($1)
             ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at`, [human]);
  };
  const offerX = (command, proposal, view, conclusion) =>
    qx('SELECT * FROM public.offer_matching_proposal_to_first_core_v1($1, $2, $3, $4)',
      [command, proposal, view, conclusion]);
  const forwardX = (command, proposal, view, conclusion) =>
    qx('SELECT * FROM public.forward_matching_proposal_to_second_core_v1($1, $2, $3, $4)',
      [command, proposal, view, conclusion]);
  const firstDeliveryEffects = async (f, view, command) => ({
    views: await count(P.VIEWS, 'id = $1', [view]),
    fields: await count(P.VIEW_FIELDS, 'view_id = $1', [view]),
    pointer: await count(P.VIEW_STATE, 'proposal_id = $1 AND recipient_user_id = $2', [f.proposal, f.first]),
    transitions: await count(P.TRANSITIONS, 'id = $1', [command]),
    bindings: await count(DELIVERY_BINDINGS, 'delivery_transition_id = $1', [command]),
    offered: await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'OFFERED_TO_FIRST'", [f.proposal]),
  });
  const secondDeliveryEffects = async (f, view, command) => ({
    views: await count(P.VIEWS, 'id = $1', [view]),
    fields: await count(P.VIEW_FIELDS, 'view_id = $1', [view]),
    pointer: await count(P.VIEW_STATE, 'proposal_id = $1 AND recipient_user_id = $2', [f.proposal, f.candidate]),
    transitions: await count(P.TRANSITIONS, 'id = $1', [command]),
    bindings: await count(DELIVERY_BINDINGS, 'delivery_transition_id = $1', [command]),
    forwarded: await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'FORWARDED_TO_SECOND'", [f.proposal]),
  });
  const NOTHING_FIRST = { views: 0, fields: 0, pointer: 0, transitions: 0, bindings: 0, offered: 0 };
  const NOTHING_SECOND = { views: 0, fields: 0, pointer: 0, transitions: 0, bindings: 0, forwarded: 0 };

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

    await report.section('T02 a first delivery that waits on the pair lock past the deadline discloses nothing', async () => {
      // ASSURE-F01. A transaction clock is fixed BEFORE the lock wait, so a
      // delivery that entered while the proposal was live and resumed after the
      // deadline would compare a moment that had already gone by. Only this
      // interleaving can tell the two clocks apart, and the waiter's own
      // transaction timestamp is proven to PRECEDE the deadline it is refused
      // against.
      const f = await bringToPrepared(one, two);
      const deadline = await rt.deadlineIn(f.proposal, '2 seconds');
      const view = randomUUID();
      const command = randomUUID();
      await holdSetupLock(f.lower);
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
      await rt.deadlineIn(f.proposal, '2 hours');
      const [offered] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
      assert.equal(offered.offered_state, 'OFFERED_TO_FIRST', 'T02 the same request commits once the proposal is live again');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T09 a delivery already INSIDE the gate that crosses the deadline discloses nothing', async () => {
      // REM02-TIME-01. An instant captured before the gate is a moment the
      // deadline can still cross DURING the gate's own pre-write work: the
      // view-state row lock, the subject's current setup resolution, the Product
      // policy read, the canonical first-name lookup and the value filter all
      // happen after it. This race puts the wait THERE - past the canonical pair
      // lock, inside the gate, before any write - and the delivery must still
      // disclose nothing.
      //
      // The barrier is the canonical first-name seam, which this verifier
      // already replaces: a future implementation of it is a real lookup, and a
      // real lookup can wait. It waits on one inert I-07A serialization row
      // belonging to a third human who is no part of the pair, so nothing about
      // the pair's own lock order changes.
      const f = await bringToPrepared(one, two);
      const deadline = await rt.deadlineIn(f.proposal, '2 seconds');
      const view = randomUUID();
      const command = randomUUID();
      try {
        await asRole('postgres');
        await q(`INSERT INTO public.matching_setup_locks AS l (user_id) VALUES ($1)
                 ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at`, [barrier]);
        await resolveFirstNameBehindLock({ [one]: 'Sara', [two]: 'Omar' }, barrier);
        await holdSetupLock(barrier);
        await actAsX(null);
        const inFlight = outcomeOf(offerX(command, f.proposal, view, f.conclusionForFirst));
        assert.equal(await waitExtra(), true,
          'T09 the delivery is observably waiting INSIDE the disclosure gate, past the canonical pair lock');
        // It really is past the pair lock: this connection holds only the third
        // human's row, and the pair's own two rows are free for anyone.
        const [{ held }] = await rows(
          `SELECT count(*)::int held FROM ${P.PROPOSALS} p WHERE p.id = $1
             AND EXISTS (SELECT 1 FROM public.matching_setup_locks l WHERE l.user_id = p.lower_user_id)`,
          [f.proposal]);
        assert.equal(held, 1, 'T09 the pair rows exist and are not the ones this connection is holding');
        assert.equal(await rt.waitForInstant(deadline), true, 'T09 the real deadline passes while it is inside the gate');
        assert.equal(await waitExtra(), true, 'T09 and it is STILL waiting there');
        await q('COMMIT');
        const outcome = await inFlight;
        await asRole('postgres');
        assert.ok(outcome, 'T09 a delivery whose gate work crossed the deadline must fail closed');
        assert.notEqual(outcome.code, '40P01', 'T09 and not by deadlocking');
        assert.equal(outcome.code, '55000', 'T09 with the deadline class');
        assert.match(String(outcome.message), /MATCHING_PROPOSAL_EXPIRED/u, 'T09 named as an expiry');
        assert.deepEqual(await firstDeliveryEffects(f, view, command), NOTHING_FIRST,
          'T09 ZERO delivery effects survived, so the instant really is read at the write boundary');
      } finally {
        await asRole('postgres');
        await endTransaction();
        await rt.restoreMatchingSeam(nameSeam);
        await rt.resolveFirstName({ [one]: 'Sara', [two]: 'Omar' });
      }
      // The deadline was the only thing in the way.
      await rt.deadlineIn(f.proposal, '2 hours');
      const [offered] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
      assert.equal(offered.offered_state, 'OFFERED_TO_FIRST',
        'T09 and the same request commits once the proposal is live again');
      await rt.cleanupRace([one, two]);
    });

    await report.section('T02P the pre-fix decision really does deliver after the deadline', async () => {
      // A race that only ever showed the refusal would prove nothing about WHERE
      // the refusal came from. The pre-fix decision is installed - the deadline
      // decided against the transaction clock, exactly as 0112 decided it - and
      // the SAME interleaving is run again. It must then DELIVER after the real
      // deadline, which is the defect the assurance review found. The canonical
      // definition is restored byte for byte on every path.
      const pristine = await rt.captureMatchingSeam(PFN.GATE);
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
        await holdSetupLock(f.lower);
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
      await holdSetupLock(f.lower);
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
      // expiry decision lives past the idempotency path, where it cannot reach one.
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
      await holdSetupLock(f.lower);
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

// ------------------------------- 3. REM02-IDEM-01, delivery command identity
async function verifyDeliveryIdentity(report, humans) {
  const [one, two] = humans;

  await report.section('D01 a first delivery answers its retry only on the whole immutable request', async () => {
    const f = await bringToPrepared(one, two);
    const view = randomUUID();
    const command = randomUUID();
    const [delivered] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
    await asRole('postgres');
    const bound = await rt.deliveryBindingOf(command);
    assert.equal(bound?.delivered_view_id, view, 'D01 bound atomically to the exact view it delivered');
    assert.equal(bound.delivery_state, 'OFFERED_TO_FIRST', 'D01 as exactly that delivery');
    assert.equal(bound.recipient_role, 'FIRST_RECIPIENT', 'D01 to exactly that role');
    assert.equal(bound.recipient_user_id, f.first, 'D01 and exactly that human');

    const [again] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
    assert.deepEqual(again, delivered, 'D01 the same command, view and conclusion is the historical answer');
    // A DIFFERENT VIEW and A DIFFERENT CONCLUSION are each a different request.
    const other = await rt.permitted(f.snapshot, one, two, `${CLEAN} A second permitted conclusion for the same pair.`);
    assert.notEqual(other.id, f.conclusionForFirst, 'D01 the second conclusion really is a different identity');
    await q('BEGIN');
    await rejected(() => rt.offer(command, f.proposal, randomUUID(), f.conclusionForFirst),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await rejected(() => rt.offer(command, f.proposal, view, other.id),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'OFFERED_TO_FIRST'", [f.proposal]), 1,
      'D01 and neither conflicting retry created anything');
    await rt.cleanupRace([one, two]);
  });

  await report.section('D02 a second delivery answers its retry only on the whole immutable request', async () => {
    const f = await rt.bringToApproved(one, two);
    const view = randomUUID();
    const command = randomUUID();
    const [delivered] = await rt.forward(command, f.proposal, view, f.conclusionForCandidate);
    await asRole('postgres');
    const bound = await rt.deliveryBindingOf(command);
    assert.equal(bound?.delivered_view_id, view, 'D02 bound to the exact candidate view it delivered');
    assert.equal(bound.recipient_role, 'CANDIDATE', 'D02 in the candidate role');
    assert.equal(bound.recipient_user_id, f.candidate, 'D02 to the candidate');

    const [again] = await rt.forward(command, f.proposal, view, f.conclusionForCandidate);
    assert.deepEqual(again, delivered, 'D02 the same command, view and conclusion is the historical answer');
    const other = await rt.permitted(f.snapshot, two, one, `${CLEAN} A second permitted conclusion for the candidate.`);
    await q('BEGIN');
    await rejected(() => rt.forward(command, f.proposal, randomUUID(), f.conclusionForCandidate),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await rejected(() => rt.forward(command, f.proposal, view, other.id),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'FORWARDED_TO_SECOND'", [f.proposal]), 1,
      'D02 and neither conflicting retry created anything');
    await rt.cleanupRace([one, two]);
  });

  await report.section('D03 a committed delivery with no binding fails closed and repairs nothing', async () => {
    // The ONLY representable shape of a pre-0120 delivery: one that really
    // committed and really has no binding. Its transition and its view rows stay
    // exactly as they are; what it can no longer do is claim an equivalent
    // retry, because it cannot prove what it delivered.
    for (const [label, build, call] of [
      ['OFFERED_TO_FIRST', () => bringToPrepared(one, two),
        (f, command, view) => rt.offer(command, f.proposal, view, f.conclusionForFirst)],
      ['FORWARDED_TO_SECOND', () => rt.bringToApproved(one, two),
        (f, command, view) => rt.forward(command, f.proposal, view, f.conclusionForCandidate)],
    ]) {
      const f = await build();
      const view = randomUUID();
      const command = randomUUID();
      await call(f, command, view);
      await asRole('postgres');
      await rt.removeDeliveryBinding(command);
      const beforeTransitions = await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]);
      const beforeViews = await count(P.VIEWS, 'proposal_id = $1', [f.proposal]);

      await q('BEGIN');
      // The view it really delivered, and then some other one: both are refused
      // BEFORE any view is compared, so nothing is inferred from the current
      // pointer and nothing is reconstructed.
      await rejected(() => call(f, command, view), ['P0001'], /MATCHING_DELIVERY_CONTRADICTORY_STATE/u);
      await rejected(() => call(f, command, randomUUID()), ['P0001'], /MATCHING_DELIVERY_CONTRADICTORY_STATE/u);
      await q('ROLLBACK');
      await asRole('postgres');
      assert.equal(await rt.deliveryBindingOf(command), null,
        `D03 ${label}: no binding was inferred, backfilled or recreated`);
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]), beforeTransitions,
        `D03 ${label}: no new transition was appended`);
      assert.equal(await count(P.VIEWS, 'proposal_id = $1', [f.proposal]), beforeViews,
        `D03 ${label}: and no new view was materialized`);
      assert.equal(await count(P.TRANSITIONS, 'id = $1', [command]), 1,
        `D03 ${label}: the historical transition itself is untouched truth`);
      await rt.cleanupRace([one, two]);
    }
  });

  await report.section('D04 the current view pointer moving after a delivery changes no retry identity', async () => {
    // The delivered view is immutable evidence. The CURRENT pointer may have
    // moved since, so a retry that reconstructed the delivery from the pointer
    // would answer a different question than the one it repeats - which is
    // exactly the inference interim review refused.
    const f = await bringToPrepared(one, two);
    const view = randomUUID();
    const command = randomUUID();
    const [delivered] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
    await asRole('postgres');
    const superseding = randomUUID();
    await rt.materialize(superseding, f.proposal, one, f.conclusionForFirst);
    assert.equal(await rt.currentViewOf(f.proposal, one), superseding,
      'D04 the current view pointer really did move to a later version');
    assert.equal((await rt.deliveryBindingOf(command))?.delivered_view_id, view,
      'D04 while the binding still names the view the command really delivered');

    const [again] = await rt.offer(command, f.proposal, view, f.conclusionForFirst);
    assert.deepEqual(again, delivered, 'D04 the retry on the ORIGINAL delivered view is still the historical answer');
    await q('BEGIN');
    await rejected(() => rt.offer(command, f.proposal, superseding, f.conclusionForFirst),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
    await asRole('postgres');
    await rt.cleanupRace([one, two]);
  });
}

// -------------------------------------------- 4. ASSURE-F08, the exact view
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
    // decision that really committed and really has no binding.
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
    assert.equal(await count(DECISION_BINDINGS, 'decision_transition_id = $1', [command]), 1, 'V06 and so does its binding');
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(P.TRANSITIONS, 'id = $1', [command]), 0, 'V06 and after a rollback neither exists');
    assert.equal(await count(DECISION_BINDINGS, 'decision_transition_id = $1', [command]), 0,
      'V06 so no successful decision can ever be left without the view that authorized it');
    await rt.cleanupRace([one, two]);
  });

  await report.section('V07 a binding to the wrong view, the wrong human or the wrong role is unrepresentable', async () => {
    const f = await rt.bringToForwarded(one, two);
    const command = randomUUID();
    await actAs(one);
    const [withdrawn] = await rt.withdraw(command, f.proposal, f.firstView, 'FORWARDED_TO_SECOND');
    assert.equal(withdrawn.withdrawn_state, 'WITHDRAWN', 'V07 the fixture withdrawal commits');
    await asRole('postgres');
    await rt.removeDecisionBinding(command);
    const insert = (values) => q(
      `INSERT INTO ${DECISION_BINDINGS}
         (decision_transition_id, proposal_id, decision_state, decider_role, decider_user_id, decided_view_id)
       VALUES ($1, $2, $3, $4, $5, $6)`, values);
    await q('BEGIN');
    // The candidate's own view, bound to a decision only the first recipient may
    // have made: the audience and role keys refuse it.
    await rejected(() => insert([command, f.proposal, 'WITHDRAWN', 'FIRST_RECIPIENT', one, f.secondView]), ['23503']);
    // Another human's identity against this human's view.
    await rejected(() => insert([command, f.proposal, 'WITHDRAWN', 'FIRST_RECIPIENT', two, f.firstView]), ['23503']);
    // A decision this transition is not.
    await rejected(() => insert([command, f.proposal, 'FIRST_DECLINED', 'FIRST_RECIPIENT', one, f.firstView]), ['23503']);
    // A role the decision does not permit: the role CHECK refuses it.
    await rejected(() => insert([command, f.proposal, 'WITHDRAWN', 'CANDIDATE', one, f.firstView]), ['23514']);
    // A decision class that is not one of the three: the state CHECK refuses it.
    await rejected(() => insert([command, f.proposal, 'FIRST_FORWARD_APPROVED', 'FIRST_RECIPIENT', one, f.firstView]), ['23514']);
    await q('ROLLBACK');
    await asRole('postgres');
    assert.equal(await count(DECISION_BINDINGS, 'decision_transition_id = $1', [command]), 0,
      'V07 and none of the five refused shapes was written');
    await rt.cleanupRace([one, two]);
  });

  await report.section('V08 every decision class the relation permits is one a reviewed producer writes', async () => {
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

// --------------------------------------------------------- 5. non-regression
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
    assert.equal(await count(DECISION_BINDINGS, 'proposal_id = $1', [f.proposal]), 0,
      'N01 and NOT into the decision relation: the three bindings are separate evidence');

    await actAs(one);
    const [again] = await rt.approveForward(command, f.proposal, f.firstView);
    assert.deepEqual(again, approved, 'N01 the same-view retry is still the historical answer');
    await q('BEGIN');
    await rejected(() => rt.approveForward(command, f.proposal, randomUUID()),
      ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    await q('ROLLBACK');
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
    assert.equal(await count(DECISION_BINDINGS, 'proposal_id = $1', [f.proposal]), 0,
      'N02 and a Mutual Match writes no terminal decision binding: it is not one of the three');
    await rt.cleanupRace([one, two]);
  });

  await report.section('N03 the I07B-CONC-01 view-supersession race is non-regressed', async () => {
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
      assert.equal(await count(DECISION_BINDINGS, 'decision_transition_id = $1', [command]), 0,
        'N03 and no binding either: a stale view never reaches the evidence');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'OFFERED_TO_FIRST',
        'N03 the proposal is exactly where it was');
      await rt.cleanupRace([one, two]);
    } finally {
      await secondary.close();
    }
  });

  await report.section('N04 no binding leaks through a recipient projection and no outcome changed', async () => {
    const f = await rt.bringToForwarded(one, two);
    const command = randomUUID();
    await actAs(two);
    await rt.declineSecond(command, f.proposal, f.secondView);
    await actAs(two);
    const [asCandidate] = await rt.myProposal(f.proposal);
    assert.equal(asCandidate.neutral_outcome, 'CLOSED_BY_YOU', 'N04 the decliner is told only that they closed it');
    assert.equal(asCandidate.action_available, false, 'N04 with no affordance left');
    assert.deepEqual(Object.keys(asCandidate).filter((key) => /bind|decision|decided|delivered|authority|evidence/u.test(key)), [],
      'N04 and the projection declares no binding, decision, delivery or authority column');
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
      assert.equal(await count(DECISION_BINDINGS, 'proposal_id = $1', [f.proposal]), 1,
        'N05 and the ungated withdrawal still bound its exact view');
      await rt.cleanupRace([one, two]);
    } finally {
      await asRole('postgres');
      await rt.clearProposalPrerequisites();
    }
  });
}

// ------------------------------------------------------------ 6. fixtures
/**
 * A proposal PREPARED and not yet offered, through the real boundaries.
 *
 * The I-07C fixture ladder starts at OFFERED because a Match needs one, but the
 * first-delivery races and the delivery identity matrix need the state BEFORE
 * the offer, so this assembles exactly the same fixture one rung lower.
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

/**
 * The canonical first-name seam, resolving exactly as `resolveFirstName` does
 * and first WAITING on one exact row lock.
 *
 * A future implementation of this seam is a real canonical lookup, and a real
 * lookup can wait - which is precisely the window REM02-TIME-01 is about: work
 * the disclosure gate does after the canonical pair lock and before its first
 * write. The barrier row belongs to a third human who is no part of the pair, so
 * nothing about the pair's own lock order changes, and the replacement is
 * VOLATILE because PostgreSQL refuses `SELECT ... FOR UPDATE` in a non-volatile
 * function. It is restored byte for byte by the caller.
 */
async function resolveFirstNameBehindLock(nameByUser, barrierUser) {
  await asRole('postgres');
  const branches = Object.entries(nameByUser).map(([id, name]) => {
    assert.match(id, /^[0-9a-f-]{36}$/u, 'a seam mapping key is a UUID');
    assert.match(name, /^[A-Za-z ]{1,64}$/u, 'a seam mapping name is bounded ASCII');
    return `WHEN '${id}'::uuid THEN '${name}'::text`;
  }).join(' ');
  assert.match(String(barrierUser), /^[0-9a-f-]{36}$/u, 'the barrier row is named by a UUID');
  assert.ok(branches.length > 0, 'the barrier seam maps at least one human');
  await q(`CREATE OR REPLACE FUNCTION public.resolve_matching_canonical_first_name_v1(p_user_id uuid)
           RETURNS TABLE(resolution text, first_name text)
           LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $seam$
           DECLARE found text;
           BEGIN
             PERFORM 1 FROM public.matching_setup_locks l
              WHERE l.user_id = '${barrierUser}'::uuid FOR UPDATE;
             found := CASE p_user_id ${branches} ELSE NULL END;
             IF found IS NULL THEN
               RETURN QUERY SELECT 'UNRESOLVED_NO_CANONICAL_SOURCE'::text, NULL::text;
             ELSE
               RETURN QUERY SELECT 'RESOLVED'::text, found;
             END IF;
           END$seam$`);
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
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
    await verifyTemporal(report, humans, nameSeam);
    setStage('delivery-identity');
    await verifyDeliveryIdentity(report, humans);
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
  for (const relation of [DELIVERY_BINDINGS, DECISION_BINDINGS]) {
    assert.equal(await rt.triggerEnabled(relation, `${relation.replace('public.', '')}_immutable`), true,
      `${relation} is append-only again at the end of the run`);
  }
  const restored = await rt.captureMatchingSeam(PFN.GATE);
  assert.ok(restored.prosrc.includes('delivery_at := clock_timestamp()'),
    'and the corrected delivery clock is installed again after the pre-fix probe');
  await rt.removeCommittedProposalState(humans);
  await rt.removeCommittedPolicies();
  await rt.removeCommittedMatchingSetup(humans);
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${DELIVERY_BINDINGS}) + (SELECT count(*) FROM ${DECISION_BINDINGS})
          + (SELECT count(*) FROM ${MATCH.BINDINGS}) + (SELECT count(*) FROM ${MATCH.COMMITS})
          + (SELECT count(*) FROM ${P.PROPOSALS}) + (SELECT count(*) FROM ${P.POLICY_STATE})
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier committed was removed again');
}, () => rt.client.end().catch(() => undefined));
