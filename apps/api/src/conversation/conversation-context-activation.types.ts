// QHIA-011A Explicit Session Context Activation Application Entry v1.
//
// The product-facing contracts of the ONE authenticated application entry that
// lets a user explicitly activate an exact, already-existing, already-owned
// cross-context measurement target for an exact owned conversation session.
//
// This boundary creates NO new authority. The database (migration 0055) and
// the existing QHIA-006 application boundary
// (HimSessionContextBindingService -> HimSessionContextBindingRepository)
// remain the only owners of ownership, kind, session-state, target existence,
// idempotency, atomic replacement, append-only history, and race safety.
// QHIA-011A only makes that already-frozen authority reachable from an
// authenticated product request.
//
// Core rule this file exists to keep checkable:
//
//   The Product may explicitly bind an exact existing owned context.
//   QANDEEL may never silently infer or auto-bind one from conversation
//   content.
//
// Therefore: the activation input is an EXACT target ID and nothing else.
// There is no display text, no target label, no reason, no confidence, no
// source selector, no suggestion payload, no provider output, and no free text
// of any kind anywhere in these contracts - and no "latest", "first", "only",
// or "most recently measured" target selection exists to fall back to.
import { HIM_CROSS_CONTEXT_KINDS, type HimCrossContextKind } from '../human-model/him-session-context-binding.types';

// The four cross-context kinds are NOT redeclared here. The QHIA-006 authority
// above is the single owner of that list, so GLOBAL and CONVERSATION_SESSION
// can never become explicit cross-context activations by a local copy drifting
// out of step with it.
export { HIM_CROSS_CONTEXT_KINDS };
export type { HimCrossContextKind };

// The product-facing provenance of every response on this entry. It names the
// EXPLICIT product action, never a model, a provider, an inference, or an
// automatic activation - because no such path may ever reach this boundary.
export const CONVERSATION_CONTEXT_ACTIVATION_SOURCE = 'QANDEEL_EXPLICIT_SESSION_CONTEXT_ACTIVATION_V1' as const;

// QHIA-011A Fix 01: the two sanitized public failure messages of this
// boundary.
//
// A recognised migration-0055 ownership denial - foreign session, unknown
// session, foreign target, unknown target, or wrong-kind target - always
// produces the SAME 403 text, so the product answer never discloses which of
// those it was, whether the resource exists, or who owns it. Neither message
// carries a SQLSTATE, a database message, a function name, a PostgREST
// structure, or any identifier.
export const CONVERSATION_CONTEXT_ACTIVATION_FORBIDDEN_MESSAGE =
  'The requested session or context is not available for this operation.' as const;
export const CONVERSATION_CONTEXT_ACTIVATION_CONFLICT_MESSAGE =
  'The conversation session does not accept this context operation in its current state.' as const;

// The exact set/replace request body: one field, one exact target ID.
export interface ConversationContextActivationRequest {
  contextId: string;
}

// The minimal product projection of one active context. Internal binding
// lifecycle metadata - the binding row id, the binding version, the binding
// source, the canonical provenance, created_at and retired_at - is validated by
// the QHIA-006 service and then deliberately DROPPED here: Product needs to
// know which exact context is active for which exact kind, and nothing else.
export interface ConversationActiveContext {
  contextKind: HimCrossContextKind;
  contextId: string;
}

export interface ConversationContextActivationSetResult {
  contractVersion: 1;
  source: typeof CONVERSATION_CONTEXT_ACTIVATION_SOURCE;
  sessionId: string;
  activeBinding: ConversationActiveContext;
}

export interface ConversationContextActivationClearResult {
  contractVersion: 1;
  source: typeof CONVERSATION_CONTEXT_ACTIVATION_SOURCE;
  sessionId: string;
  contextKind: HimCrossContextKind;
  cleared: boolean;
}

// Zero to four active contexts, at most one per kind, in the canonical fixed
// kind order GOAL, SITUATION, DECISION, RELATIONSHIP that the QHIA-006 read
// authority already guarantees. The order is NOT a recency order, a priority,
// a rank, or a preference, and no primary context is ever chosen here.
export interface ConversationContextActivationReadResult {
  contractVersion: 1;
  source: typeof CONVERSATION_CONTEXT_ACTIVATION_SOURCE;
  sessionId: string;
  bindingCount: number;
  bindings: readonly ConversationActiveContext[];
}
