// T-03C R3 - the FINAL semantic establishment of one finalized exchange, as
// the runtime smokes need it.
//
// Production order is: generation/finalization -> durable
// ConversationTurnCompleted publication -> FINAL semantic establishment
// (B1 + B2 + B3 + effective Live Focus, migration 0071, owned by
// ConversationSemanticEstablishmentService). The background post-response
// dispatcher consumes the published event independently, and since R3 its
// subject-grounding universe is cut at the IMMUTABLE causal semantic frontier
// of exactly that source exchange - so a generation whose source exchange has
// not been established yet correctly refuses to build a universe and retries.
//
// The runtime smokes drive the real dispatcher against turns they finalize
// through the canonical server command, but they do not run the foreground
// semantic establishment phase (it needs a live CU segmentation provider and
// four evaluator bindings). This fixture stands in for that phase ONLY: it
// calls the SAME production coordinator the establishment service calls,
// through the SAME service_role transport, with the minimal canonical
// decisions of a two-Moment exchange that starts no focus and establishes no
// Thread - one committed USER CU and one committed ASSISTANT CU, no
// reference, no attention, no Thread action, and the derived effective Live
// Focus NONE. Nothing here is an authority: every value is either the exact
// canonical shape the frozen validators require or the deterministic result
// the frozen reducers derive.
/// <reference path="./pg.d.ts" />
import { randomUUID } from 'node:crypto';
import type { SmokeDbSession } from './smoke-db';

// The provenance a commitment batch records is the SOURCE of its decisions.
// These decisions come from this fixture, not from the production evaluators,
// so the fixture names itself rather than borrowing an evaluator's identity.
const SOURCE = 'smoke-final-semantic-chain-fixture-v1';
const POLICY = 'smoke-final-semantic-chain-fixture-policy-v1';
const PROVENANCE = [SOURCE, POLICY, 'OPENAI', 'gpt-5-mini', SOURCE];
const FOCUS_PROVENANCE = [SOURCE, POLICY, 'OPENAI', 'gpt-5-mini', SOURCE, 1];
const THREAD_PROVENANCE = [SOURCE, POLICY, 'OPENAI', 'gpt-5-mini', SOURCE, 1];
const CONTINUITY_PROVENANCE = [SOURCE, POLICY, 'OPENAI', 'gpt-5-mini', SOURCE, 1, SOURCE];
const LF_REDUCER_VERSION = SOURCE;

const NO_FOCUS = {
  kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE',
  emerging_focus_id: null, creates_focus: false, grounding_reference_index: null,
};

/** One committed CU spanning the whole canonical source text (code points, exactly as the anchor mapper reports them). */
const unit = (content: string, unitId: string) => ({ unit_id: unitId, span_start: 0, span_end: Array.from(content).length });

const bundle = (unitId: string, sequencePosition: string, targetCuId: string | null, functions: readonly string[]) => ({
  unit_id: unitId, functions: [...functions], sequence_position: sequencePosition, target_cu_id: targetCuId,
  references: [], claim_attributions: [], attention: NO_FOCUS,
});

const noEstablishment = (unitId: string) => ({
  unit_id: unitId, decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'NO_INDEPENDENT_FOCUS',
  emerging_focus_id: null, path: null, thread_id: null, home_anchor_id: null,
  thread_established_event_id: null, evidence: [], explicit_selection_grounding: null,
  origin_state: 'NONE', origin_thread_ids: [],
});

const noThreadAction = (unitId: string) => ({
  unit_id: unitId, outcome: 'NO_THREAD_ACTION', emerging_focus_id: null, thread_id: null,
  binding_kind: null, focus_binding_id: null, identity_evidence: [], prior_identity_evidence: [],
  candidate_thread_ids: [], lifecycle_transitions: [],
});

/** A CU that neither starts nor attends a focus keeps the prior LF; with no prior LF the frozen reducer derives NONE and no transition. */
const noLiveFocus = (unitId: string) => ({
  unit_id: unitId, effective_kind: 'NONE', effective_ref: null,
  transition: false, reason_code: null, transition_event_id: null,
});

export interface FinalizedExchangeSemantics {
  readonly sessionId: string;
  readonly userId: string;
  readonly userTurnId: string;
  readonly userText: string;
  readonly assistantTurnId: string;
  readonly assistantText: string;
}

export interface EstablishedExchange {
  readonly liveHead: number;
  readonly userUnitId: string;
  readonly assistantUnitId: string;
}

/**
 * Establishes the FINAL semantic chain of ONE finalized exchange through the
 * production coordinator of migration 0071, exactly as the foreground
 * establishment phase does after the durable ConversationTurnCompleted
 * publication. Returns the resulting Live Head.
 */
export async function establishFinalSemanticChain(
  db: SmokeDbSession, exchange: FinalizedExchangeSemantics,
): Promise<EstablishedExchange> {
  const [clock] = await db.observer<{ current_sp: number | null; seq: string }>(
    'SELECT current_sp, same_sp_event_sequence::text AS seq FROM public.session_semantic_clocks WHERE session_id = $1 AND user_id = $2',
    [exchange.sessionId, exchange.userId]);
  const [identity] = await db.observer<{ version: string }>(
    'SELECT COALESCE((SELECT current_version FROM public.conversation_world_thread_identity_clocks WHERE user_id = $1), 0)::text AS version',
    [exchange.userId]);
  const userUnitId = randomUUID();
  const assistantUnitId = randomUUID();
  const [committed] = await db.asRole<{ live_head: number }>(
    'service_role',
    `SELECT * FROM public.commit_finalized_exchange_with_full_semantic_chain_v1(
      $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
      $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`,
    [
      exchange.sessionId, exchange.userId,
      exchange.userTurnId, randomUUID(),
      JSON.stringify([unit(exchange.userText, userUnitId)]),
      JSON.stringify([bundle(userUnitId, 'INITIATING', null, ['INFORM_REPORT'])]),
      JSON.stringify([noEstablishment(userUnitId)]),
      JSON.stringify([noThreadAction(userUnitId)]),
      JSON.stringify([noLiveFocus(userUnitId)]),
      exchange.assistantTurnId, randomUUID(),
      JSON.stringify([unit(exchange.assistantText, assistantUnitId)]),
      JSON.stringify([bundle(assistantUnitId, 'RESPONSIVE', userUnitId, ['ACKNOWLEDGE'])]),
      JSON.stringify([noEstablishment(assistantUnitId)]),
      JSON.stringify([noThreadAction(assistantUnitId)]),
      JSON.stringify([noLiveFocus(assistantUnitId)]),
      ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION,
      clock?.current_sp ?? null, Number(clock?.seq ?? 0), identity?.version ?? '0',
    ]);
  if (typeof committed?.live_head !== 'number') {
    throw new Error('FINAL semantic establishment fixture did not commit the exchange');
  }
  return { liveHead: committed.live_head, userUnitId, assistantUnitId };
}
