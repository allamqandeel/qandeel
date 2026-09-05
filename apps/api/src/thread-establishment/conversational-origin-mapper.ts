// T-03B2b3 (ED-B2B3-02) - Conservative Grounded Conversational-Origin Mapping.
//
// T-03B2b2 deliberately did not infer Conversational Origin; this slice owns
// it. There is NO Origin model, NO Origin provider and NO Origin prompt: the
// mapping is a pure, deterministic function of ALREADY CANONICAL grounded B1
// conversation structure.
//
// BINDING MEANING (Stage 1.3): Conversational Origin is
//
//   the grounded conversational-history context from which the establishment
//   episode of a new Thread emerged.
//
// It is placement INPUT and durable provenance only. It is NOT parenthood, NOT
// hierarchy, NOT causality, NOT a semantic relation, NOT ownership, NOT
// importance, NOT proximity semantics, NOT mandatory adjacency, NOT a
// Conversation Transition edge, and NOT chronology alone. A primary origin is
// never fabricated: MULTIPLE and AMBIGUOUS are symmetric over all members.
//
// THE ONLY TWO GROUNDING SOURCES (task §5.2):
//
//   A. canonical `target_cu_id` - an episode CU points at a prior CU through
//      canonical B1 sequence semantics, and that prior CU's canonical
//      attention is bound to an already-established Thread's grounding
//      Emerging Focus. Adjacency alone is never enough: an immediate
//      predecessor with no canonical link contributes nothing.
//
//   B. canonical reference-handle grounding - an episode CU carries a RESOLVED
//      reference to a stable handle, or AMBIGUOUS candidate handles, and that
//      handle's canonical prior grounding closes to a focus/Thread binding
//      already present in the authoritative context. Repeated names are not
//      identity; similarity is not identity.
//
// FORBIDDEN INPUTS (task §5.6): embedding or semantic similarity, Grounded
// Semantic Relation count or direction, confidence, importance, emotional
// intensity, popularity, Reading strength, Home distance, viewport or device,
// chronology alone, and any model-generated "best parent". None of them is
// reachable from this module's inputs.
//
// NO HINDSIGHT (task §5.3/§5.5): the caller supplies only the authoritative
// prior history plus the earlier CUs of the SAME finalized exchange that have
// ALREADY been evaluated. A later USER CU, an ASSISTANT CU while an earlier
// USER CU is being judged, a later same-exchange establishment and all future
// history are structurally absent from the input.

import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import { compareThreadIds } from './durable-thread-canonicalizer';
import type { PreparedConversationalOrigin } from './durable-thread-payload.types';
import { ConversationThreadIntegrityError } from './conversation-thread-runtime.types';
import { STABLE_FOCUS_ID_PATTERN } from './thread-establishment.types';

/**
 * The technical identity of this mapping. It is code/test provenance only: no
 * Origin model exists, so nothing here is added to the frozen 0068 durable
 * payload or to its capture fingerprint.
 */
export const CONVERSATIONAL_ORIGIN_MAPPER_VERSION = 'conversational-origin-grounded-v1';

/** One canonical Thread that already exists before the establishing CU. */
export interface OriginEstablishedThread {
  readonly threadId: string;
  /** The stable Emerging Focus the Thread was born of. Immutable lineage, not a label. */
  readonly emergingFocusId: string;
}

/**
 * Everything the mapping may legitimately read. Every field is already
 * canonical B1 or already canonical Thread truth; nothing is provider output,
 * nothing is scored and nothing is temporal beyond canonical order.
 */
export interface ConversationalOriginContext {
  /**
   * One canonical B1 bundle per CU legitimately visible to this decision:
   * the authoritative prior history, the earlier already-evaluated CUs of this
   * exchange, and the establishing CU itself. Nothing later exists here.
   */
  readonly semanticsByCuId: ReadonlyMap<string, CanonicalCuFocusSemanticPayload>;
  /**
   * stable emerging_focus_id -> the canonical reference handles that ground
   * it. Derived from the authoritative focus candidates and from the
   * START_NEW_FOCUS bundles of the same-exchange prefix, exactly as the
   * durable `conversation_emerging_focuses.grounding_handle_id` is.
   */
  readonly focusGroundingHandleIds: ReadonlyMap<string, readonly string[]>;
  /** Canonical Thread truth already established before the establishing CU. */
  readonly establishedThreads: readonly OriginEstablishedThread[];
}

/** ONE Thread-establishment decision's episode. */
export interface ConversationalOriginRequest {
  readonly establishingCuId: string;
  /** The stable focus being promoted. A Thread is never its own origin. */
  readonly targetEmergingFocusId: string;
  /** The committed CUs the promotion rests on, in canonical evidence order, ending with the establishing CU. */
  readonly evidenceCuIds: readonly string[];
}

const invalid = (): never => { throw new ConversationThreadIntegrityError('INVALID_CONVERSATIONAL_ORIGIN_CONTEXT'); };
const isStableId = (value: unknown): value is string => typeof value === 'string' && STABLE_FOCUS_ID_PATTERN.test(value);

/**
 * Derives the closed Conversational Origin of ONE establishment episode.
 *
 * Classification (task §5.4):
 *
 *   NONE       no prior established Thread carries a grounded origin link.
 *              A first Thread, an abrupt new subject, and an immediate
 *              predecessor without a canonical link all stay NONE.
 *   RESOLVED   exactly one distinct prior Thread carries resolved grounded
 *              links, and no unresolved competing candidate set makes the
 *              provenance ambiguous.
 *   MULTIPLE   two or more distinct prior Threads each carry INDEPENDENT
 *              resolved grounded links. No member is primary.
 *   AMBIGUOUS  canonical B1 ambiguity leaves two or more grounded prior
 *              Thread candidates and no resolved evidence truthfully settles
 *              one resolved origin set.
 *
 * A contradictory or structurally impossible context fails closed with
 * INVALID_CONVERSATIONAL_ORIGIN_CONTEXT. Nothing is guessed.
 */
export function deriveConversationalOrigin(
  request: ConversationalOriginRequest,
  context: ConversationalOriginContext,
): PreparedConversationalOrigin {
  if (!isStableId(request.establishingCuId) || !isStableId(request.targetEmergingFocusId)) return invalid();
  if (request.evidenceCuIds.length === 0) return invalid();
  if (request.evidenceCuIds[request.evidenceCuIds.length - 1] !== request.establishingCuId) return invalid();
  if (new Set(request.evidenceCuIds).size !== request.evidenceCuIds.length) return invalid();

  // The already-canonical Thread world of this decision: unique Thread ids,
  // unique grounding focuses, and never the focus being promoted right now.
  const threadByFocusId = new Map<string, string>();
  const threadIds = new Set<string>();
  for (const thread of context.establishedThreads) {
    if (!isStableId(thread.threadId) || !isStableId(thread.emergingFocusId)) return invalid();
    if (threadIds.has(thread.threadId) || threadByFocusId.has(thread.emergingFocusId)) return invalid();
    if (thread.emergingFocusId === request.targetEmergingFocusId) return invalid();
    threadIds.add(thread.threadId);
    threadByFocusId.set(thread.emergingFocusId, thread.threadId);
  }

  // handle -> focus, closed over the canonical grounding of the same context.
  // A handle that canonically grounds two different focuses is structurally
  // impossible (UNIQUE(session_id, grounding_handle_id) in migration 0066).
  const focusByHandleId = new Map<string, string>();
  for (const [focusId, handleIds] of context.focusGroundingHandleIds) {
    if (!isStableId(focusId)) return invalid();
    for (const handleId of handleIds) {
      if (!isStableId(handleId)) return invalid();
      const existing = focusByHandleId.get(handleId);
      if (existing !== undefined && existing !== focusId) return invalid();
      focusByHandleId.set(handleId, focusId);
    }
  }

  const originOf = (focusId: string | null): string | undefined => {
    if (focusId === null || focusId === request.targetEmergingFocusId) return undefined;
    return threadByFocusId.get(focusId);
  };

  const resolvedThreadIds = new Set<string>();
  const ambiguousCandidateSets: string[][] = [];

  for (const cuId of request.evidenceCuIds) {
    const bundle = context.semanticsByCuId.get(cuId);
    if (bundle === undefined || bundle.unit_id !== cuId) return invalid();

    // A. Canonical sequence link. Adjacency alone is NOT a link: only an
    //    explicit canonical `target_cu_id` is read, and only through the
    //    TARGET CU's own canonical attention binding.
    if (bundle.target_cu_id !== null) {
      const target = context.semanticsByCuId.get(bundle.target_cu_id);
      // A link into material this decision cannot legitimately see is a
      // structurally impossible context, never a silently dropped link.
      if (target === undefined) return invalid();
      if (target.attention.kind !== 'NO_INDEPENDENT_FOCUS') {
        const originThreadId = originOf(target.attention.emerging_focus_id);
        if (originThreadId !== undefined) resolvedThreadIds.add(originThreadId);
      }
    }

    // B. Canonical reference-handle grounding.
    for (const reference of bundle.references) {
      if (reference.state === 'RESOLVED') {
        const originThreadId = originOf(focusByHandleId.get(reference.resolved_handle_id ?? '') ?? null);
        if (originThreadId !== undefined) resolvedThreadIds.add(originThreadId);
        continue;
      }
      if (reference.state !== 'AMBIGUOUS') continue;
      const candidates: string[] = [];
      for (const handleId of reference.candidate_handle_ids) {
        const originThreadId = originOf(focusByHandleId.get(handleId) ?? null);
        if (originThreadId !== undefined && !candidates.includes(originThreadId)) candidates.push(originThreadId);
      }
      if (candidates.length > 0) ambiguousCandidateSets.push(candidates);
    }
  }

  const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort(compareThreadIds);

  // Two or more independently RESOLVED Threads: symmetric MULTIPLE. An
  // additional unresolved candidate set cannot unmake a resolved link, so it
  // never downgrades an already-resolved multi-member origin.
  if (resolvedThreadIds.size >= 2) {
    return Object.freeze({ state: 'MULTIPLE' as const, originThreadIds: Object.freeze(sorted(resolvedThreadIds)) });
  }

  const competing = ambiguousCandidateSets.filter((set) => set.some((threadId) => !resolvedThreadIds.has(threadId)));

  if (resolvedThreadIds.size === 1) {
    if (competing.length === 0) {
      const [only] = sorted(resolvedThreadIds);
      return Object.freeze({ state: 'RESOLVED' as const, originThreadIds: Object.freeze([only] as [string]) });
    }
    // A resolved link plus a genuinely competing unresolved candidate set:
    // provenance is not settled, so the truthful answer is AMBIGUOUS over all
    // grounded candidates - never a "best" pick.
    return Object.freeze({
      state: 'AMBIGUOUS' as const,
      originThreadIds: Object.freeze(sorted([...resolvedThreadIds, ...competing.flat()])),
    });
  }

  const ambiguousThreadIds = sorted(ambiguousCandidateSets.flat());
  // A single grounded candidate behind canonical B1 ambiguity is NOT a
  // resolved origin: B1 itself did not resolve the reference, so promoting it
  // would invent certainty. NONE is the truthful answer.
  if (ambiguousThreadIds.length >= 2) {
    return Object.freeze({ state: 'AMBIGUOUS' as const, originThreadIds: Object.freeze(ambiguousThreadIds) });
  }
  return Object.freeze({ state: 'NONE' as const });
}
