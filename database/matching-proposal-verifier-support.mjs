// Shared support for the I-07B real-PostgreSQL verifiers (migrations 0110-0112).
//
// It composes the I-07A Matching runtime, because every I-07B fixture starts as
// two humans with a complete I-07A setup, and adds everything I-07B needs: the
// relation and function names, the boundaries as named wrappers, a two-human
// fixture that is matchable by construction, transactional installation of the
// configurable Product policies, and the two SEAM replacements without which the
// happy path cannot run at all.
//
// ## Why the seams are replaced rather than worked around
//
// Two boundaries answer fail-closed in production and nothing in this repository
// can make them answer otherwise:
//
//   resolve_matching_proposal_prerequisites_v1  -> NOT_EVALUATED (CW2-08)
//   resolve_matching_canonical_first_name_v1    -> UNRESOLVED_NO_CANONICAL_SOURCE
//
// A verifier that only ever saw the refusal would prove that I-07B refuses and
// nothing else. So each seam is captured from `pg_get_functiondef`, replaced
// inside a transaction, exercised, and restored - and the restoration is
// compared byte for byte against `prosrc`, so a run can never leave a permissive
// definition installed. Both directions are proven: the production answer
// refuses, and the cleared answer completes.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createMatchingRuntime } from './matching-setup-verifier-support.mjs';

// ------------------------------------------------------------------ relations
export const P = Object.freeze({
  PAIRS: 'public.matching_pairs',
  POLICY_VERSIONS: 'public.matching_proposal_policy_versions',
  POLICY_FIELDS: 'public.matching_proposal_safe_field_keys',
  POLICY_STATE: 'public.matching_proposal_policy_state',
  SNAPSHOTS: 'public.matching_eligibility_snapshots',
  HARD_RESULTS: 'public.matching_hard_requirement_results',
  PRIVATE_NOTES: 'public.matching_private_reasoning_notes',
  CONCLUSION_CANDIDATES: 'public.matching_safe_conclusion_candidates',
  PERMITTED_CONCLUSIONS: 'public.matching_permitted_safe_conclusions',
  FILTER_REFUSALS: 'public.matching_sensitive_filter_refusals',
  PROPOSALS: 'public.matching_proposals',
  TRANSITIONS: 'public.matching_proposal_transitions',
  VIEWS: 'public.matching_recipient_proposal_views',
  VIEW_FIELDS: 'public.matching_recipient_proposal_view_fields',
  VIEW_STATE: 'public.matching_recipient_proposal_view_state',
});

/** Every relation 0110 creates, in the order its terminal self-assertion names them. */
export const PROPOSAL_TABLES = [
  P.PAIRS, P.POLICY_VERSIONS, P.POLICY_FIELDS, P.POLICY_STATE,
  P.SNAPSHOTS, P.HARD_RESULTS, P.PRIVATE_NOTES, P.CONCLUSION_CANDIDATES,
  P.PERMITTED_CONCLUSIONS, P.FILTER_REFUSALS, P.PROPOSALS, P.TRANSITIONS,
  P.VIEWS, P.VIEW_FIELDS, P.VIEW_STATE,
];

/** The append-only relations, with the trigger that refuses UPDATE and DELETE. */
export const PROPOSAL_IMMUTABLE = [
  [P.PAIRS, 'matching_pairs_immutable'],
  [P.POLICY_VERSIONS, 'matching_proposal_policy_versions_immutable'],
  [P.POLICY_FIELDS, 'matching_proposal_safe_field_keys_immutable'],
  [P.SNAPSHOTS, 'matching_eligibility_snapshots_immutable'],
  [P.HARD_RESULTS, 'matching_hard_requirement_results_immutable'],
  [P.PRIVATE_NOTES, 'matching_private_reasoning_notes_immutable'],
  [P.CONCLUSION_CANDIDATES, 'matching_safe_conclusion_candidates_immutable'],
  [P.PERMITTED_CONCLUSIONS, 'matching_permitted_safe_conclusions_immutable'],
  [P.FILTER_REFUSALS, 'matching_sensitive_filter_refusals_immutable'],
  [P.TRANSITIONS, 'matching_proposal_transitions_immutable'],
  [P.VIEWS, 'matching_recipient_proposal_views_immutable'],
  [P.VIEW_FIELDS, 'matching_recipient_view_fields_immutable'],
];

/** The controlled relations, with the truth guard that bounds how they may change. */
export const PROPOSAL_GUARDED = [
  [P.PROPOSALS, 'matching_proposals_state_truth'],
  [P.VIEW_STATE, 'matching_recipient_view_state_truth'],
  [P.POLICY_STATE, 'matching_proposal_policy_state_truth'],
];

/** The seven trigger functions 0110 installs. */
export const PROPOSAL_TRIGGER_FUNCTIONS = [
  'public.reject_matching_proposal_mutation_v1()',
  'public.matching_proposal_state_truth_v1()',
  'public.matching_recipient_view_state_truth_v1()',
  'public.matching_proposal_policy_state_truth_v1()',
  'public.matching_proposal_eligibility_truth_v1()',
  'public.matching_snapshot_seal_truth_v1()',
  'public.matching_filter_outcome_truth_v1()',
];

// ------------------------------------------------------ I-07C relations
/**
 * The I-07C Match relations (migrations 0113 / 0114), named HERE because the
 * shared I-07B teardown must peel them before any I-07B row they bind: since
 * I-07C a forward approval writes a view binding onto its own transition, and a
 * committed Match binds transitions, views, proposals, pairs, participation
 * acts, membership episodes and Worlds - every one of those keys restrictive.
 * A verifier that removed its committed proposals without first removing the
 * Match rows that bind them would be refused row by row.
 */
export const MATCH = Object.freeze({
  BINDINGS: 'public.matching_forward_approval_view_bindings',
  COMMITS: 'public.matching_match_commits',
  RECORDS: 'public.introduction_records',
  BIRTHS: 'public.shared_world_matching_birth_events',
  STARTS: 'public.shared_world_introduction_started_events',
  CLAIMS: 'public.matching_active_introduction_claims',
  CANCELLATIONS: 'public.matching_match_competing_cancellations',
  PACKAGES: 'public.matching_match_handoff_package_versions',
  SUBJECTS: 'public.matching_match_handoff_subjects',
  FIELDS: 'public.matching_match_handoff_fields',
});

/** Every relation 0113 creates, in the order its terminal self-assertion names them. */
export const MATCH_TABLES = [
  MATCH.BINDINGS, MATCH.COMMITS, MATCH.RECORDS, MATCH.BIRTHS, MATCH.STARTS,
  MATCH.CLAIMS, MATCH.CANCELLATIONS, MATCH.PACKAGES, MATCH.SUBJECTS, MATCH.FIELDS,
];

/** Every guard 0113 installs, immutability and truth alike, with the relation it guards. */
export const MATCH_GUARDS = [
  [MATCH.BINDINGS, 'matching_forward_approval_view_bindings_immutable'],
  [MATCH.COMMITS, 'matching_match_commits_immutable'],
  [MATCH.COMMITS, 'matching_match_commits_truth'],
  [MATCH.RECORDS, 'introduction_records_truth'],
  [MATCH.BIRTHS, 'shared_world_matching_birth_events_immutable'],
  [MATCH.STARTS, 'shared_world_introduction_started_events_immutable'],
  [MATCH.CLAIMS, 'matching_active_introduction_claims_truth'],
  [MATCH.CANCELLATIONS, 'matching_match_competing_cancellations_immutable'],
  [MATCH.PACKAGES, 'matching_match_handoff_package_versions_immutable'],
  [MATCH.SUBJECTS, 'matching_match_handoff_subjects_immutable'],
  [MATCH.SUBJECTS, 'matching_match_handoff_subjects_truth'],
  [MATCH.FIELDS, 'matching_match_handoff_fields_immutable'],
  [MATCH.FIELDS, 'matching_match_handoff_fields_truth'],
];

/**
 * The ONE reviewed producer of MUTUAL_MATCH_COMMITTED, CANCELLED_BY_COMPETING_MATCH
 * and the ACTIVE_INTRODUCTION pause. The 0112 verifier's producer law is an
 * EQUALITY against this name: not "at least one", and not any function a later
 * slice adds without review.
 */
export const I07C_MATCH_PRODUCER = 'commit_matching_mutual_match_v1';

// ------------------------------------------------------------------ functions
export const PFN = Object.freeze({
  // 0111 pure classifiers
  CONTACT_ROUTE: 'public.matching_text_carries_contact_route_v1(text)',
  PROVENANCE: 'public.matching_text_carries_hidden_provenance_v1(text)',
  RANKING: 'public.matching_text_carries_visible_ranking_v1(text)',
  SENSITIVE: 'public.matching_text_carries_sensitive_fact_v1(text)',
  QUOTED: 'public.matching_text_carries_quoted_span_v1(text)',
  CANONICAL_PAIR: 'public.matching_canonical_pair_v1(uuid,uuid)',
  // 0111 resolvers, seams and cores
  SETUP_STATE: 'public.resolve_matching_setup_state_v1(uuid)',
  ACTIVE_INTRODUCTION: 'public.resolve_matching_active_introduction_v1(uuid)',
  PREREQUISITES: 'public.resolve_matching_proposal_prerequisites_v1(uuid)',
  FIRST_NAME: 'public.resolve_matching_canonical_first_name_v1(uuid)',
  LOCK_PAIR: 'public.lock_matching_pair_humans_v1(uuid,uuid)',
  ENSURE_PAIR: 'public.ensure_matching_pair_core_v1(uuid,uuid,uuid)',
  DISCOVER: 'public.discover_matching_candidates_core_v1(uuid,integer)',
  CAPTURE: 'public.capture_matching_eligibility_snapshot_core_v1(uuid,uuid,uuid,uuid)',
  EVALUATE: 'public.evaluate_matching_hard_requirement_core_v1(uuid,uuid,text,text,text)',
  PRIVATE_NOTE: 'public.record_matching_private_reasoning_core_v1(uuid,uuid,uuid,text,text)',
  SUBMIT: 'public.submit_matching_safe_conclusion_core_v1(uuid,uuid,uuid,uuid,text)',
  FILTER: 'public.apply_matching_sensitive_conclusion_filter_core_v1(uuid,uuid)',
  GATE: 'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)',
  // 0112 choreography
  SNAPSHOT_VALIDITY: 'public.resolve_matching_snapshot_validity_v1(uuid)',
  PROPOSAL_VALIDITY: 'public.resolve_matching_proposal_validity_v1(uuid)',
  APPEND: 'public.append_matching_proposal_transition_v1(uuid,uuid,text,text,uuid,uuid,text)',
  ENTER_DECISION: 'public.enter_matching_proposal_decision_v1(uuid,uuid)',
  ASSERT_VIEW: 'public.assert_matching_recipient_view_current_v1(uuid,uuid,uuid,text)',
  PREPARE: 'public.prepare_matching_proposal_core_v1(uuid,uuid,uuid)',
  OFFER: 'public.offer_matching_proposal_to_first_core_v1(uuid,uuid,uuid,uuid)',
  FORWARD: 'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)',
  DECLINE_FIRST: 'public.decline_matching_proposal_as_first_core_v1(uuid,uuid,uuid)',
  APPROVE: 'public.approve_matching_proposal_forward_core_v1(uuid,uuid,uuid)',
  DECLINE_SECOND: 'public.decline_matching_proposal_as_second_core_v1(uuid,uuid,uuid)',
  WITHDRAW: 'public.withdraw_matching_proposal_core_v1(uuid,uuid,uuid,text)',
  EXPIRE: 'public.expire_matching_proposal_core_v1(uuid,uuid)',
  REVALIDATE: 'public.revalidate_matching_proposal_core_v1(uuid,uuid)',
  NEUTRAL: 'public.resolve_matching_proposal_neutral_outcome_v1(uuid,uuid)',
  MY_PROPOSAL: 'public.resolve_my_matching_proposal_v1(uuid)',
  MY_FIELDS: 'public.resolve_my_matching_proposal_fields_v1(uuid)',
});

/** Everything 0111 and 0112 create. NO role may execute any of it. */
export const PROPOSAL_BOUNDARIES = Object.values(PFN);

/** The pure classifiers, which take no identity and read no relation. */
export const PURE_CLASSIFIERS = [PFN.CONTACT_ROUTE, PFN.PROVENANCE, PFN.RANKING, PFN.SENSITIVE, PFN.QUOTED];

/** The read-only private resolvers that may never write. */
export const READ_ONLY_RESOLVERS = [
  PFN.SETUP_STATE, PFN.ACTIVE_INTRODUCTION, PFN.PREREQUISITES, PFN.FIRST_NAME,
  PFN.DISCOVER, PFN.SNAPSHOT_VALIDITY, PFN.PROPOSAL_VALIDITY, PFN.NEUTRAL,
  PFN.MY_PROPOSAL, PFN.MY_FIELDS, PFN.ASSERT_VIEW,
];

/**
 * The ordered pair every human decision must call in THIS order.
 *
 * `enter_matching_proposal_decision_v1` answers the bounded not-found and then
 * takes the canonical two-human lock; the exact-view check must follow it, under
 * that lock, because a recipient-view materialization supersedes a view while
 * holding the same lock. Checking first and locking afterwards leaves a window
 * in which V1 is accepted and V2 is committed before the act.
 */
export const DECISION_ENTRY_ORDER = [PFN.ENTER_DECISION, PFN.ASSERT_VIEW];

/** The four human decision cores: auth.uid()-derived, exact-view bound. */
export const HUMAN_DECISIONS = [PFN.DECLINE_FIRST, PFN.APPROVE, PFN.DECLINE_SECOND, PFN.WITHDRAW];

/** The two boundaries an audience could eventually be shown. */
export const AUDIENCE_PROJECTIONS = [PFN.MY_PROPOSAL, PFN.MY_FIELDS];

// ---------------------------------------------------------------- vocabularies
export const PROPOSAL_STATES = [
  'PREPARED', 'OFFERED_TO_FIRST', 'FIRST_DECLINED', 'FIRST_FORWARD_APPROVED',
  'FORWARDED_TO_SECOND', 'SECOND_DECLINED', 'WITHDRAWN', 'EXPIRED', 'STALE',
  'CANCELLED_BY_COMPETING_MATCH', 'MUTUAL_MATCH_COMMITTED',
];
/** The two with NO I-07B producer: representable, never written by anything here. */
export const RESERVED_I07C_STATES = ['CANCELLED_BY_COMPETING_MATCH', 'MUTUAL_MATCH_COMMITTED'];
export const LIVE_STATES = ['PREPARED', 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND'];
export const I07B_PRODUCED_STATES = PROPOSAL_STATES.filter((s) => !RESERVED_I07C_STATES.includes(s));
/** The state that does not exist, in every spelling the contract names. */
export const ABSENT_ACCEPTANCE_STATES = [
  'SECOND_ACCEPTED', 'ACCEPTED_PENDING_MATCH', 'MATCH_PENDING', 'INTRODUCTION_RESERVED',
];
export const REQUIREMENT_OUTCOMES = ['PASS', 'FAIL', 'UNKNOWN'];
export const EVIDENCE_SOURCE_CLASSES = [
  'SELF_AUTHORED_PERSONAL', 'EXPLICIT_MATCHING_ANSWER',
  'INTRODUCTION_PROFILE', 'CANONICAL_PRODUCT_ACCOUNT_STATE', 'NOT_ESTABLISHED',
];
/** Source classes that CANNOT be spelled: a third-party claim is not a source. */
export const FORBIDDEN_SOURCE_CLASSES = [
  'THIRD_PARTY_CLAIM', 'INFERRED_FROM_NAME', 'INFERRED_FROM_PHOTO', 'INFERRED_FROM_VOICE',
  'INFERRED_FROM_LANGUAGE_STYLE', 'ASSUMED', 'MODEL_INFERENCE',
];
export const NEUTRAL_OUTCOMES = [
  'AWAITING_YOU', 'IN_PROGRESS', 'CLOSED_BY_YOU', 'NO_LONGER_AVAILABLE', 'MATCH_CONCLUDED',
];
export const FILTER_REFUSAL_CLASSES = [
  'CONTACT_ROUTE', 'PRIVATE_QUOTE', 'HIDDEN_PROVENANCE',
  'VISIBLE_RANKING', 'SENSITIVE_FACT', 'UNCLASSIFIED_RESULT',
];
export const POLICY_KINDS = [
  'PROPOSAL_CADENCE', 'PENDING_PROPOSAL_LIMIT', 'PROPOSAL_EXPIRY',
  'PROPOSAL_SAFE_FIELDS', 'SENSITIVE_CONCLUSION_FILTER',
];

/**
 * Result columns a RECIPIENT-facing boundary may never declare.
 *
 * A recipient answer is an opaque view identity, an opaque proposal identity, a
 * first name, a filtered conclusion, a neutral outcome and one affordance. A
 * counterparty identifier, an eligibility or authority identity, private
 * evidence, a private reason, a terminal state name or anything ranked would
 * each be a leak, so each is refused by NAME.
 */
export const RECIPIENT_DISCLOSURE_BAN =
  /user_id|subject|candidate|counterpart|auth|email|phone|contact|handle|snapshot|authority|profile_version|requirement|evidence|provenance|source|private|reason|score|rank|percent|pair|proposal_state|world|session/u;

/** Text corpora the CHECK constraints and the pure classifiers must agree on. */
export const CONTACT_ROUTE_CORPUS = [
  'reach me at sara.nour@example.com',
  'my handle is @sara_nour',
  'see https://example.com/sara',
  'find me at example.com today',
  'call 0100 123 4567',
  'we both use WhatsApp a lot',
  'telegram is easiest for me',
];
export const CLEAN_TEXT_CORPUS = [
  'You both value a quiet home life and treat family commitments as the centre of a week.',
  'A shared sense of humour and the same unhurried pace.',
  'Both of you plan carefully before deciding, and neither likes being rushed.',
];

// -------------------------------------------------------------------- runtime
export function createProposalRuntime(databaseUrl) {
  const rt = createMatchingRuntime(databaseUrl);
  const { q, rows } = rt;

  // ---- the I-07B boundaries, as named wrappers
  const ensurePair = (pair, a, b) =>
    rows('SELECT * FROM public.ensure_matching_pair_core_v1($1, $2, $3)', [pair, a, b]);
  const discover = (human, max) =>
    rows('SELECT * FROM public.discover_matching_candidates_core_v1($1, $2)', [human, max]);
  const setupState = (human) =>
    rows('SELECT * FROM public.resolve_matching_setup_state_v1($1)', [human]);
  const activeIntroduction = async (human) =>
    (await rows('SELECT * FROM public.resolve_matching_active_introduction_v1($1)', [human]))[0].has_active_introduction;
  const capture = (snapshot, pair, a, b) =>
    rows('SELECT * FROM public.capture_matching_eligibility_snapshot_core_v1($1, $2, $3, $4)', [snapshot, pair, a, b]);
  const evaluate = (snapshot, human, key, outcome, source) =>
    rows('SELECT * FROM public.evaluate_matching_hard_requirement_core_v1($1, $2, $3, $4, $5)',
      [snapshot, human, key, outcome, source]);
  const privateNote = (note, snapshot, about, source, text) =>
    rows('SELECT * FROM public.record_matching_private_reasoning_core_v1($1, $2, $3, $4, $5)',
      [note, snapshot, about, source, text]);
  const submitConclusion = (conclusion, snapshot, forRecipient, about, text) =>
    rows('SELECT * FROM public.submit_matching_safe_conclusion_core_v1($1, $2, $3, $4, $5)',
      [conclusion, snapshot, forRecipient, about, text]);
  const filterConclusion = (decision, conclusion) =>
    rows('SELECT * FROM public.apply_matching_sensitive_conclusion_filter_core_v1($1, $2)', [decision, conclusion]);
  const materialize = (view, proposal, recipient, conclusion) =>
    rows('SELECT * FROM public.materialize_matching_recipient_view_core_v1($1, $2, $3, $4)',
      [view, proposal, recipient, conclusion]);
  const prepare = (proposal, snapshot, firstRecipient) =>
    rows('SELECT * FROM public.prepare_matching_proposal_core_v1($1, $2, $3)', [proposal, snapshot, firstRecipient]);
  const offer = (command, proposal, view, conclusion) =>
    rows('SELECT * FROM public.offer_matching_proposal_to_first_core_v1($1, $2, $3, $4)',
      [command, proposal, view, conclusion]);
  const forward = (command, proposal, view, conclusion) =>
    rows('SELECT * FROM public.forward_matching_proposal_to_second_core_v1($1, $2, $3, $4)',
      [command, proposal, view, conclusion]);
  const declineFirst = (command, proposal, view) =>
    rows('SELECT * FROM public.decline_matching_proposal_as_first_core_v1($1, $2, $3)', [command, proposal, view]);
  const approveForward = (command, proposal, view) =>
    rows('SELECT * FROM public.approve_matching_proposal_forward_core_v1($1, $2, $3)', [command, proposal, view]);
  const declineSecond = (command, proposal, view) =>
    rows('SELECT * FROM public.decline_matching_proposal_as_second_core_v1($1, $2, $3)', [command, proposal, view]);
  const withdraw = (command, proposal, view, state) =>
    rows('SELECT * FROM public.withdraw_matching_proposal_core_v1($1, $2, $3, $4)', [command, proposal, view, state]);
  const expire = (command, proposal) =>
    rows('SELECT * FROM public.expire_matching_proposal_core_v1($1, $2)', [command, proposal]);
  const revalidate = (command, proposal) =>
    rows('SELECT * FROM public.revalidate_matching_proposal_core_v1($1, $2)', [command, proposal]);
  const neutral = async (proposal, viewer) =>
    (await rows('SELECT * FROM public.resolve_matching_proposal_neutral_outcome_v1($1, $2)',
      [proposal, viewer]))[0].neutral_outcome;
  const myProposal = (proposal) => rows('SELECT * FROM public.resolve_my_matching_proposal_v1($1)', [proposal]);
  const myFields = (proposal) => rows('SELECT * FROM public.resolve_my_matching_proposal_fields_v1($1)', [proposal]);
  const classify = async (fn, text) =>
    (await rows(`SELECT ${fn.split('(')[0]}($1) AS hit`, [text]))[0].hit;

  const proposalRow = async (id) => (await rows(`SELECT * FROM ${P.PROPOSALS} p WHERE p.id = $1`, [id]))[0] ?? null;
  const currentViewOf = async (proposal, recipient) => {
    const [row] = await rows(
      `SELECT st.current_view_id id FROM ${P.VIEW_STATE} st
        WHERE st.proposal_id = $1 AND st.recipient_user_id = $2`, [proposal, recipient]);
    return row?.id ?? null;
  };

  // ---- the configurable Product policies, installed transactionally
  /**
   * Installs one exact version of every policy kind the runtime requires.
   *
   * No migration ships a policy row, so an unconfigured runtime fails closed -
   * which is the production posture and is proven separately. A verifier installs
   * exact test values inside a transaction it rolls back, so nothing permissive
   * ever survives a run.
   */
  async function installPolicies({ windowDays = 7, cadenceMax = 5, pendingMax = 3,
    expiryHours = 72, safeFieldKeys = [] } = {}) {
    await rt.asRole('postgres');
    const ids = {
      cadence: randomUUID(), pending: randomUUID(), expiry: randomUUID(),
      fields: randomUUID(), filter: randomUUID(),
    };
    await q(`INSERT INTO ${P.POLICY_VERSIONS} (id, policy_kind, window_days, max_count, expiry_hours)
             VALUES ($1, 'PROPOSAL_CADENCE', $2, $3, NULL),
                    ($4, 'PENDING_PROPOSAL_LIMIT', NULL, $5, NULL),
                    ($6, 'PROPOSAL_EXPIRY', NULL, NULL, $7),
                    ($8, 'PROPOSAL_SAFE_FIELDS', NULL, NULL, NULL),
                    ($9, 'SENSITIVE_CONCLUSION_FILTER', NULL, NULL, NULL)`,
    [ids.cadence, windowDays, cadenceMax, ids.pending, pendingMax, ids.expiry, expiryHours,
      ids.fields, ids.filter]);
    if (safeFieldKeys.length > 0) {
      await q(`INSERT INTO ${P.POLICY_FIELDS} (policy_version_id, field_key)
               SELECT $1, unnest($2::text[])`, [ids.fields, safeFieldKeys]);
    }
    await q(`INSERT INTO ${P.POLICY_STATE} (policy_kind, current_policy_version_id)
             VALUES ('PROPOSAL_CADENCE', $1), ('PENDING_PROPOSAL_LIMIT', $2), ('PROPOSAL_EXPIRY', $3),
                    ('PROPOSAL_SAFE_FIELDS', $4), ('SENSITIVE_CONCLUSION_FILTER', $5)`,
    [ids.cadence, ids.pending, ids.expiry, ids.fields, ids.filter]);
    return ids;
  }

  /** Supersedes one policy kind with a NEW version, which is what stales a proposal. */
  async function supersedePolicy(kind, priorVersionId, values = {}) {
    await rt.asRole('postgres');
    const next = randomUUID();
    await q(`INSERT INTO ${P.POLICY_VERSIONS}
               (id, policy_kind, prior_policy_version_id, window_days, max_count, expiry_hours)
             VALUES ($1, $2, $3, $4, $5, $6)`,
    [next, kind, priorVersionId, values.windowDays ?? null, values.maxCount ?? null, values.expiryHours ?? null]);
    await q(`UPDATE ${P.POLICY_STATE} SET current_policy_version_id = $1, updated_at = CURRENT_TIMESTAMP
              WHERE policy_kind = $2`, [next, kind]);
    return next;
  }

  // ---- the two fail-closed seams, replaced and restored byte for byte
  /**
   * Captures one seam's CANONICAL definition.
   *
   * `pg_get_functiondef` rather than the migration text, because PostgreSQL
   * regenerates a signature in its own form and an anchor taken from a
   * migration's line wrapping matches nothing - the exact defect that cost I-06A
   * a CI round and that the H5 hazard detector now refuses.
   */
  async function captureMatchingSeam(fn) {
    await rt.asRole('postgres');
    const [row] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [fn]);
    assert.ok(row?.definition, `${fn} exists and has a canonical definition`);
    return { fn, ...row };
  }

  async function restoreMatchingSeam(seam) {
    await rt.asRole('postgres');
    await q(seam.definition);
    const [restored] = await rows(
      'SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [seam.fn]);
    assert.equal(restored.prosrc, seam.prosrc,
      `${seam.fn} is restored byte for byte, so no permissive definition survives this run`);
  }

  /** Makes the CW2-08 seam answer CLEARED, exactly as a future Launch Gate would. */
  async function clearProposalPrerequisites() {
    await rt.asRole('postgres');
    await q(`CREATE OR REPLACE FUNCTION public.resolve_matching_proposal_prerequisites_v1(p_proposal_id uuid)
             RETURNS TABLE(clearance text, basis text)
             LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $seam$
             BEGIN
               RETURN QUERY SELECT 'CLEARED'::text, 'verifier fixture clearance'::text;
             END$seam$`);
  }

  /**
   * Makes the canonical first-name seam RESOLVE, exactly as a future account
   * source would, for the exact fixture humans and for nobody else.
   *
   * The mapping is inlined as a CASE over UUID literals rather than read from a
   * table, so the replacement seam stays as free of dependencies as the
   * production one and a rolled-back fixture cannot leave it half-working. Only
   * `randomUUID()` values and verifier-owned ASCII names are ever interpolated,
   * and both are asserted before they reach the statement.
   */
  async function resolveFirstName(nameByUser) {
    await rt.asRole('postgres');
    const branches = Object.entries(nameByUser).map(([id, name]) => {
      assert.match(id, /^[0-9a-f-]{36}$/u, 'a seam mapping key is a UUID');
      assert.match(name, /^[A-Za-z ]{1,64}$/u, 'a seam mapping name is bounded ASCII');
      return `WHEN '${id}'::uuid THEN '${name}'::text`;
    }).join(' ');
    assert.ok(branches.length > 0, 'the first-name seam replacement maps at least one human');
    await q(`CREATE OR REPLACE FUNCTION public.resolve_matching_canonical_first_name_v1(p_user_id uuid)
             RETURNS TABLE(resolution text, first_name text)
             LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $seam$
             DECLARE found text;
             BEGIN
               found := CASE p_user_id ${branches} ELSE NULL END;
               IF found IS NULL THEN
                 RETURN QUERY SELECT 'UNRESOLVED_NO_CANONICAL_SOURCE'::text, NULL::text;
               ELSE
                 RETURN QUERY SELECT 'RESOLVED'::text, found;
               END IF;
             END$seam$`);
  }

  // ---- fixtures
  /**
   * Two humans, each MATCHABLE by construction: ACTIVE participation, a Matching
   * Context Grant, an Introduction Profile, a requirement set and a Pre-Match
   * Disclosure Authority over that exact profile version.
   *
   * Every one of those is created through the I-07A HUMAN command as that human,
   * never by a direct write, so the fixture cannot accidentally prove something
   * the real consent path would refuse.
   */
  async function provisionMatchableHuman(human, { profile, requirements, approvedKeys }) {
    await rt.actAs(human);
    await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', null);
    const grant = randomUUID();
    await rt.grantContext(randomUUID(), grant, null);
    const profileVersion = randomUUID();
    await rt.setProfile(profileVersion, profile, null);
    const requirementVersion = randomUUID();
    await rt.setRequirements(randomUUID(), requirements, null);
    const authority = randomUUID();
    await rt.grantDisclosure(randomUUID(), authority, profileVersion, approvedKeys, null);
    const [state] = await setupState(human);
    assert.equal(state.matchable, true, 'the fixture human is matchable by construction');
    return { human, grant, profileVersion, requirementVersion: state.matching_requirement_version_id, authority };
  }

  /**
   * Remove every COMMITTED I-07C row of the given humans, leaf-first, BEFORE the
   * I-07B rows they bind.
   *
   * The commit row goes first: every key it holds is outgoing and immediate,
   * while every key that points AT it is deferred, so its children can be
   * removed afterwards inside the same transaction and the deferred checks find
   * nothing left at COMMIT. The Worlds a Match bore are captured from the
   * Introduction Records before those are deleted, because every link back to
   * the fixture humans runs through the records.
   */
  async function removeCommittedMatchState(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      // The commit binds its children immediately and its children bind the
      // commit restrictively - RESTRICT is checked at once even when deferrable
      // - so by design nothing can delete a Match row by row. The teardown of
      // COMMITTED race fixtures therefore lifts every trigger on the Match
      // relations, referential ones included, as the superuser inside this one
      // transaction, and restores them all before it commits.
      for (const table of MATCH_TABLES) {
        await q(`ALTER TABLE ${table} DISABLE TRIGGER ALL`);
      }
      const pairs = `(SELECT pr.id FROM ${P.PAIRS} pr
                       WHERE pr.lower_user_id = ANY($1::uuid[]) OR pr.higher_user_id = ANY($1::uuid[]))`;
      const proposals = `(SELECT p.id FROM ${P.PROPOSALS} p WHERE p.pair_id IN ${pairs})`;
      const commits = `(SELECT c.id FROM ${MATCH.COMMITS} c
                         WHERE c.lower_user_id = ANY($1::uuid[]) OR c.higher_user_id = ANY($1::uuid[]))`;
      const records = `(SELECT r.id FROM ${MATCH.RECORDS} r
                         WHERE r.lower_user_id = ANY($1::uuid[]) OR r.higher_user_id = ANY($1::uuid[]))`;
      const bornWorlds = (await rows(
        `SELECT r.world_id FROM ${MATCH.RECORDS} r
          WHERE r.lower_user_id = ANY($1::uuid[]) OR r.higher_user_id = ANY($1::uuid[])`, [humans]))
        .map((r) => r.world_id);
      await q(`DELETE FROM ${MATCH.COMMITS} WHERE id IN ${commits}`, [humans]);
      await q(`DELETE FROM ${MATCH.FIELDS} WHERE package_version_id IN
                 (SELECT h.id FROM ${MATCH.PACKAGES} h WHERE h.introduction_record_id IN ${records})`, [humans]);
      await q(`DELETE FROM ${MATCH.SUBJECTS} WHERE package_version_id IN
                 (SELECT h.id FROM ${MATCH.PACKAGES} h WHERE h.introduction_record_id IN ${records})`, [humans]);
      await q(`DELETE FROM ${MATCH.PACKAGES} WHERE introduction_record_id IN ${records}`, [humans]);
      await q(`DELETE FROM ${MATCH.CANCELLATIONS} WHERE cancelled_proposal_id IN ${proposals}`, [humans]);
      await q(`DELETE FROM ${MATCH.CLAIMS} WHERE user_id = ANY($1::uuid[]) OR introduction_record_id IN ${records}`, [humans]);
      await q(`DELETE FROM ${MATCH.STARTS} WHERE introduction_record_id IN ${records}`, [humans]);
      await q(`DELETE FROM ${MATCH.BIRTHS} WHERE introduction_record_id IN ${records}`, [humans]);
      await q(`DELETE FROM ${MATCH.RECORDS} WHERE id IN ${records}`, [humans]);
      await q('DELETE FROM public.shared_world_membership_episodes WHERE world_id = ANY($1::uuid[])', [bornWorlds]);
      await q('DELETE FROM public.shared_worlds WHERE id = ANY($1::uuid[])', [bornWorlds]);
      await q(`DELETE FROM ${MATCH.BINDINGS} WHERE proposal_id IN ${proposals}`, [humans]);
      for (const table of MATCH_TABLES) {
        await q(`ALTER TABLE ${table} ENABLE TRIGGER ALL`);
      }
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK').catch(() => undefined);
      throw error;
    }
    for (const [table, trigger] of MATCH_GUARDS) {
      assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled again after I-07C teardown`);
    }
  }

  /** Remove every COMMITTED I-07B row, leaf-first, then hand off to the I-07A teardown. */
  async function removeCommittedProposalState(humans) {
    // The I-07C rows bind the I-07B rows restrictively, so they go first.
    await removeCommittedMatchState(humans);
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of [...PROPOSAL_IMMUTABLE, ...PROPOSAL_GUARDED]) {
        await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      }
      const pairs = `(SELECT pr.id FROM ${P.PAIRS} pr
                       WHERE pr.lower_user_id = ANY($1::uuid[]) OR pr.higher_user_id = ANY($1::uuid[]))`;
      const proposals = `(SELECT p.id FROM ${P.PROPOSALS} p WHERE p.pair_id IN ${pairs})`;
      const snapshots = `(SELECT s.id FROM ${P.SNAPSHOTS} s WHERE s.pair_id IN ${pairs})`;
      const views = `(SELECT v.id FROM ${P.VIEWS} v WHERE v.proposal_id IN ${proposals})`;
      await q(`DELETE FROM ${P.VIEW_FIELDS} WHERE view_id IN ${views}`, [humans]);
      await q(`DELETE FROM ${P.VIEW_STATE} WHERE proposal_id IN ${proposals}`, [humans]);
      // The view chain is self-referencing and restrictive, so it peels leaf-first.
      for (let pass = 0; pass < 64; pass += 1) {
        const result = await q(
          `DELETE FROM ${P.VIEWS} v WHERE v.proposal_id IN ${proposals}
             AND NOT EXISTS (SELECT 1 FROM ${P.VIEWS} c WHERE c.prior_view_id = v.id)`, [humans]);
        if (result.rowCount === 0) break;
      }
      await q(`UPDATE ${P.PROPOSALS} SET current_transition_id = NULL, proposal_state = 'PREPARED'
                WHERE id IN ${proposals}`, [humans]);
      for (let pass = 0; pass < 64; pass += 1) {
        const result = await q(
          `DELETE FROM ${P.TRANSITIONS} t WHERE t.proposal_id IN ${proposals}
             AND NOT EXISTS (SELECT 1 FROM ${P.TRANSITIONS} c WHERE c.prior_transition_id = t.id)`, [humans]);
        if (result.rowCount === 0) break;
      }
      await q(`DELETE FROM ${P.PROPOSALS} WHERE pair_id IN ${pairs}`, [humans]);
      await q(`DELETE FROM ${P.PERMITTED_CONCLUSIONS} WHERE conclusion_candidate_id IN
                 (SELECT c.id FROM ${P.CONCLUSION_CANDIDATES} c WHERE c.eligibility_snapshot_id IN ${snapshots})`, [humans]);
      await q(`DELETE FROM ${P.FILTER_REFUSALS} WHERE conclusion_candidate_id IN
                 (SELECT c.id FROM ${P.CONCLUSION_CANDIDATES} c WHERE c.eligibility_snapshot_id IN ${snapshots})`, [humans]);
      await q(`DELETE FROM ${P.CONCLUSION_CANDIDATES} WHERE eligibility_snapshot_id IN ${snapshots}`, [humans]);
      await q(`DELETE FROM ${P.PRIVATE_NOTES} WHERE eligibility_snapshot_id IN ${snapshots}`, [humans]);
      await q(`DELETE FROM ${P.HARD_RESULTS} WHERE eligibility_snapshot_id IN ${snapshots}`, [humans]);
      await q(`DELETE FROM ${P.SNAPSHOTS} WHERE pair_id IN ${pairs}`, [humans]);
      await q(`DELETE FROM ${P.PAIRS} WHERE lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])`, [humans]);
      for (const [table, trigger] of [...PROPOSAL_IMMUTABLE, ...PROPOSAL_GUARDED]) {
        await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
      }
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK').catch(() => undefined);
      throw error;
    }
    for (const [table, trigger] of [...PROPOSAL_IMMUTABLE, ...PROPOSAL_GUARDED]) {
      assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled again after I-07B teardown`);
    }
  }

  /** Remove every COMMITTED policy row, so a run leaves no configured Product policy. */
  async function removeCommittedPolicies() {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of [[P.POLICY_VERSIONS, 'matching_proposal_policy_versions_immutable'],
        [P.POLICY_FIELDS, 'matching_proposal_safe_field_keys_immutable'],
        [P.POLICY_STATE, 'matching_proposal_policy_state_truth']]) {
        await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      }
      await q(`DELETE FROM ${P.POLICY_STATE}`);
      await q(`DELETE FROM ${P.POLICY_FIELDS}`);
      for (let pass = 0; pass < 64; pass += 1) {
        const result = await q(
          `DELETE FROM ${P.POLICY_VERSIONS} v
             WHERE NOT EXISTS (SELECT 1 FROM ${P.POLICY_VERSIONS} c WHERE c.prior_policy_version_id = v.id)`);
        if (result.rowCount === 0) break;
      }
      for (const [table, trigger] of [[P.POLICY_VERSIONS, 'matching_proposal_policy_versions_immutable'],
        [P.POLICY_FIELDS, 'matching_proposal_safe_field_keys_immutable'],
        [P.POLICY_STATE, 'matching_proposal_policy_state_truth']]) {
        await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
      }
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  return {
    ...rt, P, PFN,
    ensurePair, discover, setupState, activeIntroduction, capture, evaluate, privateNote,
    submitConclusion, filterConclusion, materialize, prepare, offer, forward,
    declineFirst, approveForward, declineSecond, withdraw, expire, revalidate,
    neutral, myProposal, myFields, classify, proposalRow, currentViewOf,
    installPolicies, supersedePolicy, captureMatchingSeam, restoreMatchingSeam,
    clearProposalPrerequisites, resolveFirstName,
    provisionMatchableHuman, removeCommittedMatchState, removeCommittedProposalState, removeCommittedPolicies,
  };
}

export { runVerifier, APP_ROLES } from './matching-setup-verifier-support.mjs';
export {
  MATCHING_TABLES, MATCHING_IMMUTABLE, MATCHING_GUARDED, MATCHING_COMMANDS, MFN, M,
  LATER_SLICE_LIFECYCLE_RELATIONS, I07B_LIFECYCLE_RELATIONS, I07C_LIFECYCLE_RELATIONS, lifecycleCensusOf,
} from './matching-setup-verifier-support.mjs';
