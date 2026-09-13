// I-01A - audience expansion intent and Context Admission scopes.
//
// This file defines the VOCABULARY that a later authority evaluator (I-03) will
// consume as required input. It performs no authority evaluation itself.
//
// Connected Worlds Context Admission is NOT the Human Intelligence
// `cross-context` concept. Nothing here imports or reuses a HIM type.

import type { ConsentPrincipal } from './principal.types';
import type { SharedWorldId } from './world.types';

// ---------------------------------------------------------------------------
// Audience expansion.
// ---------------------------------------------------------------------------

export const AUDIENCE_EXPANSION_INTENTS = ['AUDIENCE_EXPANSION', 'NO_AUDIENCE_EXPANSION'] as const;
export type AudienceExpansionIntent = (typeof AUDIENCE_EXPANSION_INTENTS)[number];

/**
 * The operations whose audience effect the kernel can classify. Unknown
 * operations are classified fail-closed as AUDIENCE_EXPANSION by
 * `classifyAudienceExpansion`.
 */
export type AudienceOperation =
  /** Publication into the Public World. Always audience expansion. */
  | { readonly operation: 'PUBLISH_TO_PUBLIC_WORLD' }
  /** External / shareable Replay distribution. Always audience expansion. */
  | { readonly operation: 'DISTRIBUTE_REPLAY_EXTERNALLY' }
  /**
   * Explicit transfer / disclosure of private source material into a Shared
   * audience. Audience expansion unless that audience already possessed it.
   */
  | { readonly operation: 'DISCLOSE_SOURCE_MATERIAL_TO_SHARED_AUDIENCE'; readonly audienceAlreadyPossessed: boolean }
  /** Creation of an internal Replay draft. Not audience expansion by itself. */
  | { readonly operation: 'CREATE_INTERNAL_REPLAY_DRAFT' }
  /** Context Admission for reasoning, without source-material disclosure. Not audience expansion by itself. */
  | { readonly operation: 'ADMIT_CONTEXT_FOR_REASONING' }
  /** Private inspection of one's own material. Not audience expansion. */
  | { readonly operation: 'INSPECT_OWN_MATERIAL' };

export type AudienceOperationName = AudienceOperation['operation'];

// ---------------------------------------------------------------------------
// Context Admission.
// ---------------------------------------------------------------------------

/**
 * The only Context Admission scopes at this architecture stage. There is NO
 * Public World scope: Public private Context Admission is structurally
 * unsupported in v1 and no variant is reserved for it.
 */
export const CONTEXT_ADMISSION_SCOPES = ['SHARED_EXACT_WORLD', 'MATCHING'] as const;
export type ContextAdmissionScope = (typeof CONTEXT_ADMISSION_SCOPES)[number];

/**
 * owner human + exact target Shared World + Shared reasoning purpose.
 * Authorizes eligible private context to participate in QANDEEL reasoning for
 * that exact Shared World. It does NOT by itself authorize material disclosure.
 */
export interface SharedExactWorldAdmission {
  readonly scope: 'SHARED_EXACT_WORLD';
  readonly owner: ConsentPrincipal;
  readonly targetWorldId: SharedWorldId;
  readonly purpose: 'SHARED_REASONING';
}

/**
 * user's own Personal context + Matching capability purpose. Capability-scoped.
 * It does NOT transfer into the Shared World born after a Mutual Match.
 */
export interface MatchingAdmission {
  readonly scope: 'MATCHING';
  readonly owner: ConsentPrincipal;
  readonly purpose: 'MATCHING_CAPABILITY';
}

export type ContextAdmission = SharedExactWorldAdmission | MatchingAdmission;

/** The structural questions an admission can be asked. Every other question is answered `false`. */
export type ContextAdmissionQuestion =
  | { readonly question: 'REASONING_FOR_SHARED_WORLD'; readonly worldId: SharedWorldId }
  | { readonly question: 'REASONING_FOR_MATCHING' }
  | { readonly question: 'MATERIAL_DISCLOSURE' };

/**
 * Rejections of `validateContextAdmission`. A raw candidate may never carry its
 * own world identifier: `UNBRANDED_TARGET_WORLD` fails closed whenever it does,
 * because a `SharedWorldId` is minted by Shared World birth alone and an
 * admission can only reference a World that already exists (passed separately
 * as a born / branded World reference).
 */
export const CONTEXT_ADMISSION_REJECTIONS = [
  'UNSUPPORTED_SCOPE',
  'NON_HUMAN_OWNER',
  'UNBRANDED_TARGET_WORLD',
  'MISSING_TARGET_WORLD',
  'TARGET_WORLD_NOT_APPLICABLE',
  'PURPOSE_SCOPE_MISMATCH',
] as const;
export type ContextAdmissionRejection = (typeof CONTEXT_ADMISSION_REJECTIONS)[number];

export type ContextAdmissionValidation =
  | { readonly valid: true; readonly admission: ContextAdmission }
  | { readonly valid: false; readonly rejection: ContextAdmissionRejection };
