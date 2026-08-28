// QHIA-006 Authoritative Cross-Context Binding / Relevance v1.
//
// Typed contracts for the separate explicit Runtime relevance authority: an
// authenticated exact binding between one owned conversation session and one
// exact owned cross-context measurement target. A binding row proves ONLY
// that the explicit authenticated binding command was executed and that
// database ownership/kind/session integrity was proven - never that a model
// understood the conversation, that the target is objectively relevant, that
// any metric is KNOWN or should be consumed, or that any question or
// recommendation is authorized. No target text, relevance score, confidence,
// free-text reason, or metric value exists anywhere on this boundary.

// The four frozen cross-context kinds, in the canonical fixed order the
// database read authority returns them. CONVERSATION_SESSION and GLOBAL can
// never be explicit cross-context bindings.
export const HIM_CROSS_CONTEXT_KINDS = Object.freeze([
  'GOAL',
  'SITUATION',
  'DECISION',
  'RELATIONSHIP',
] as const);

export type HimCrossContextKind = (typeof HIM_CROSS_CONTEXT_KINDS)[number];

export const HIM_SESSION_CONTEXT_BINDING_SOURCE = 'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING' as const;
export const HIM_SESSION_CONTEXT_BINDING_PROVENANCE = 'QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1' as const;

// One raw row of public.him_session_context_bindings exactly as the three
// narrow RPCs return it. This is transport shape only; the service validates
// every field fail-closed before anything is projected.
export interface HimSessionContextBindingSourceRow {
  id: string;
  user_id: string;
  conversation_session_id: string;
  context_kind: string;
  context_id: string;
  binding_version: number;
  status: string;
  binding_source: string;
  created_at: string;
  retired_at: string | null;
  canonical_provenance: string;
}

// One validated ACTIVE binding in the Runtime projection: exact identity
// facts only.
export interface HimActiveSessionContextBinding {
  bindingId: string;
  bindingVersion: number;
  contextKind: HimCrossContextKind;
  contextId: string;
}

// The validated one-request Runtime projection of a session's current ACTIVE
// cross-context bindings: zero to four bindings, at most one per kind, in the
// canonical fixed kind order.
export interface HimActiveSessionContextBindings {
  contractVersion: 1;
  source: typeof HIM_SESSION_CONTEXT_BINDING_SOURCE;
  sessionId: string;
  bindingCount: number;
  bindings: readonly HimActiveSessionContextBinding[];
}

// Narrow typed command results. Set always returns the one ACTIVE binding it
// established (new or idempotently unchanged); clear reports whether an
// ACTIVE binding of the named kind existed and, when it did, the exact
// retired binding identity.
export interface HimSessionContextBindingSetResult {
  contractVersion: 1;
  source: typeof HIM_SESSION_CONTEXT_BINDING_SOURCE;
  sessionId: string;
  binding: HimActiveSessionContextBinding;
}

export interface HimRetiredSessionContextBinding {
  bindingId: string;
  bindingVersion: number;
  contextKind: HimCrossContextKind;
  contextId: string;
}

export interface HimSessionContextBindingClearResult {
  contractVersion: 1;
  source: typeof HIM_SESSION_CONTEXT_BINDING_SOURCE;
  sessionId: string;
  cleared: boolean;
  retiredBinding: HimRetiredSessionContextBinding | null;
}
