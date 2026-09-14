// I-03G - the Shared privacy / authority delivery-readiness boundary: the frozen
// CW2-02 §22 order, made structural.
//
//   Provider output
//       -> Source Disclosure Gate          (I-03G)  <- FIRST, always
//       -> Authority Snapshot revalidation  (I-03F)  <- SECOND, only if the first cleared
//       -> Audience Snapshot revalidation   (I-03F)
//       -> System / Safety policy check              <- NOT_EVALUATED here (CW2-08)
//       -> Deliver / commit                          <- NOT granted here (I-04)
//
// The sequence is ordered, not a set. The two gates are therefore never started
// together, never raced and never reordered: a blocked or unresolved Source
// Disclosure Gate stops the operation with the authority revalidator never
// called. That ordering is worth keeping literally - a disclosure leak is an
// irreversible privacy event, while stale authority is a freshness question, and
// there is no reason to resolve current grants and current audience for an
// output that must be discarded regardless.
//
// Both boundaries receive the EXACT same EffectiveContext object and the EXACT
// same output bytes, and their two results are required to name the same
// operation before READY is returned. "Close enough" does not exist: a readiness
// assembled from a gate for one output and a revalidation for another would be
// a proof about nothing (CW2-02 §7, B6).
//
// The two results stay two independent proofs. I-03G's gate passing does NOT
// mutate what the frozen I-03F result means: a CURRENT revalidation still says
// `sourceDisclosureAuthority = NOT_EVALUATED`, because I-03F did not evaluate it
// - this boundary did, separately, and says so in its own field. The I-03F
// result is validated here as untrusted runtime data for the same reason its own
// input is: it may have crossed a process boundary, and a widened or malformed
// CURRENT is uncertainty, never readiness.
//
// What READY means, exactly and only:
//
//   the exact output passed the I-03 Source Disclosure Gate, and its privacy /
//   authority state is current for the exact envelope that produced it.
//
// It is NOT `deliveryAllowed`, `safe`, `approved`, `canDeliver`, `commitReady`
// or `publishAllowed`; none of those is representable in the result vocabulary.
// System / Safety policy and the Launch Gate are `NOT_EVALUATED`, delivery and
// commit authority is `NOT_GRANTED_BY_THIS_BOUNDARY`, and the frozen
// no-disclosure positions are untouched. A later gate may narrow this result; it
// can never manufacture the privacy authority this one required (CW2-02 §46,
// B30, B31; CW2-08 §24-§25).
//
// This boundary persists, commits and mutates nothing, invokes no model or
// provider, re-runs no generation, opens no route and reads no Personal table.
// Choosing to regenerate under current authority belongs to the future Shared
// runtime, not here (task §32, §37-§39).

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  SHARED_DELIVERY_AUTHORITY_STALE_REASONS,
  SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS,
} from '../delivery-authority/shared-delivery-authority.types';
import { SharedDeliveryAuthorityRevalidatorService } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import type { SharedEffectiveContext } from '../effective-context/shared-effective-context.types';
import { SharedSourceDisclosureGateService } from './shared-source-disclosure-gate.service';
import type {
  SharedPrivacyAuthorityDeliveryReadiness,
  SharedPrivacyAuthorityDeliveryReadinessDetail,
  SharedPrivacyAuthorityDeliveryReadinessUnresolvedReason,
  SharedSourceDisclosureClearance,
  SharedSourceDisclosureGateResult,
} from './shared-source-disclosure.types';

export const SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_VERSION = 'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1' as const;

const REVALIDATION_KEYS = ['state', 'revalidation'] as const;
const CURRENT_KEYS = [
  'revalidationRef',
  'effectiveContextRef',
  'outputDigest',
  'targetWorldId',
  'worldStateSnapshotRef',
  'audienceSnapshotRef',
  'authorityStatus',
  'sourceDisclosureAuthority',
  'systemSafetyAuthority',
  'deliveryCommitAuthority',
  'directPrivateDisclosureAuthority',
  'materialDisclosureAuthority',
  'provenanceDisclosure',
] as const;
const BOUNDED_REASON_KEYS = ['state', 'reason'] as const;

/**
 * The exact frozen I-03F positions a CURRENT result must still carry (task §31).
 * A revalidation that claims source disclosure was evaluated or granted, that
 * claims system safety was evaluated, or that widens any of the three frozen
 * no-disclosure positions is not the boundary this one composes with.
 */
const EXPECTED_CURRENT_POSITIONS = Object.freeze({
  authorityStatus: 'CURRENT',
  sourceDisclosureAuthority: 'NOT_EVALUATED',
  systemSafetyAuthority: 'NOT_EVALUATED',
  deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
  directPrivateDisclosureAuthority: 'NOT_GRANTED',
  materialDisclosureAuthority: 'NOT_GRANTED',
  provenanceDisclosure: 'SEALED',
} as const);

/** What the frozen I-03F dependency established, reduced to what this boundary maps. */
type AuthorityVerdict =
  | { readonly kind: 'CURRENT'; readonly revalidationRef: string }
  | { readonly kind: 'STALE' }
  | { readonly kind: 'UNRESOLVED'; readonly reason: SharedPrivacyAuthorityDeliveryReadinessUnresolvedReason };

const AUTHORITY_UNRESOLVED: AuthorityVerdict = Object.freeze({ kind: 'UNRESOLVED', reason: 'AUTHORITY_UNRESOLVED' } as const);
const OPERATION_BINDING_MISMATCH: AuthorityVerdict = Object.freeze({ kind: 'UNRESOLVED', reason: 'OPERATION_BINDING_MISMATCH' } as const);

function unresolved(reason: SharedPrivacyAuthorityDeliveryReadinessUnresolvedReason): SharedPrivacyAuthorityDeliveryReadiness {
  return Object.freeze({ state: 'UNRESOLVED', reason } as const);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => present.includes(key));
}

/** Exactly one of a frozen bounded reason vocabulary, in the exact two-key shape. */
function isBoundedResult(value: Record<string, unknown>, state: string, reasons: ReadonlyArray<string>): boolean {
  return value.state === state && hasExactKeys(value, BOUNDED_REASON_KEYS) && reasons.includes(value.reason as string);
}

/**
 * The deterministic readiness fingerprint (task §33). It binds the envelope
 * identity, the exact output identity and the two boundary references this
 * readiness rests on - and nothing else. No raw output, no private content, no
 * clock, no random identity, no secret, and not a bearer permission. Exported so
 * tests can prove determinism and every required sensitivity.
 */
export function fingerprintSharedPrivacyAuthorityDeliveryReadiness(facts: {
  readonly effectiveContextRef: string;
  readonly outputDigest: string;
  readonly sourceDisclosureGateRef: string;
  readonly authorityRevalidationRef: string;
}): string {
  const lines = [
    SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_VERSION,
    `effectiveContext=${facts.effectiveContextRef}`,
    `output=${facts.outputDigest}`,
    `sourceDisclosureGate=${facts.sourceDisclosureGateRef}`,
    `authorityRevalidation=${facts.authorityRevalidationRef}`,
  ];
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}

/**
 * Validates the frozen I-03F result as untrusted runtime data, and requires it to
 * describe the SAME operation the Source Disclosure Gate cleared (task §29, §31,
 * §32).
 */
function authorityVerdict(value: unknown, gate: SharedSourceDisclosureClearance): AuthorityVerdict {
  if (!isRecord(value)) return AUTHORITY_UNRESOLVED;
  // Known staleness stays known: it is the one outcome that tells a caller that
  // regenerating under current authority will help.
  if (isBoundedResult(value, 'STALE', SHARED_DELIVERY_AUTHORITY_STALE_REASONS)) return Object.freeze({ kind: 'STALE' } as const);
  if (isBoundedResult(value, 'UNRESOLVED', SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS)) return AUTHORITY_UNRESOLVED;
  if (value.state !== 'CURRENT' || !hasExactKeys(value, REVALIDATION_KEYS)) return AUTHORITY_UNRESOLVED;
  const revalidation = value.revalidation;
  if (!isRecord(revalidation) || !hasExactKeys(revalidation, CURRENT_KEYS)) return AUTHORITY_UNRESOLVED;
  if (!isNonBlankString(revalidation.revalidationRef)) return AUTHORITY_UNRESOLVED;
  for (const [key, expected] of Object.entries(EXPECTED_CURRENT_POSITIONS)) {
    if (revalidation[key] !== expected) return AUTHORITY_UNRESOLVED;
  }
  // The exact same operation, on both references. Neither is allowed to be
  // merely compatible.
  if (revalidation.effectiveContextRef !== gate.effectiveContextRef) return OPERATION_BINDING_MISMATCH;
  if (revalidation.outputDigest !== gate.outputDigest) return OPERATION_BINDING_MISMATCH;
  return Object.freeze({ kind: 'CURRENT', revalidationRef: revalidation.revalidationRef } as const);
}

@Injectable()
export class SharedPrivacyAuthorityDeliveryReadinessService {
  constructor(
    private readonly sourceDisclosure: SharedSourceDisclosureGateService,
    private readonly authority: SharedDeliveryAuthorityRevalidatorService,
  ) {}

  /**
   * Evaluates one exact previously generated Shared output against the exact
   * EffectiveContext that produced it, through both I-03 privacy / authority
   * gates in their frozen order. Returns - never throws - a frozen
   * `SharedPrivacyAuthorityDeliveryReadiness`. The result carries no finding
   * category, owner, source identity, grant, private content, provider output,
   * detector error or consent state.
   */
  async evaluate(effectiveContext: SharedEffectiveContext, outputText: string): Promise<SharedPrivacyAuthorityDeliveryReadiness> {
    // FIRST gate. It is awaited to completion before anything else is started:
    // no Promise.all, no eager second call, no reordering.
    let disclosure: SharedSourceDisclosureGateResult;
    try {
      disclosure = await this.sourceDisclosure.evaluate(effectiveContext, outputText);
    } catch {
      return unresolved('SOURCE_DISCLOSURE_UNRESOLVED');
    }
    if (disclosure.state === 'BLOCKED') return Object.freeze({ state: 'BLOCKED', reason: 'SOURCE_DISCLOSURE_BLOCKED' } as const);
    if (disclosure.state === 'UNRESOLVED') {
      // A malformed generation artifact is the caller's own contradiction and
      // keeps its own class; every other gate failure is source-disclosure
      // uncertainty. Neither leaks the detail behind it.
      return unresolved(disclosure.reason === 'MALFORMED_GENERATION_ARTIFACT' ? 'MALFORMED_GENERATION_ARTIFACT' : 'SOURCE_DISCLOSURE_UNRESOLVED');
    }

    // SECOND gate, reached only by a cleared first one, and given the EXACT same
    // envelope object and the EXACT same output bytes.
    let revalidation: unknown;
    try {
      revalidation = await this.authority.revalidate(effectiveContext, outputText);
    } catch {
      return unresolved('AUTHORITY_UNRESOLVED');
    }
    const verdict = authorityVerdict(revalidation, disclosure.gate);
    if (verdict.kind === 'STALE') return Object.freeze({ state: 'STALE', reason: 'AUTHORITY_STALE' } as const);
    if (verdict.kind === 'UNRESOLVED') return unresolved(verdict.reason);

    const readiness: SharedPrivacyAuthorityDeliveryReadinessDetail = Object.freeze({
      readinessRef: fingerprintSharedPrivacyAuthorityDeliveryReadiness({
        effectiveContextRef: disclosure.gate.effectiveContextRef,
        outputDigest: disclosure.gate.outputDigest,
        sourceDisclosureGateRef: disclosure.gate.gateRef,
        authorityRevalidationRef: verdict.revalidationRef,
      }),
      effectiveContextRef: disclosure.gate.effectiveContextRef,
      outputDigest: disclosure.gate.outputDigest,
      sourceDisclosureGateRef: disclosure.gate.gateRef,
      authorityRevalidationRef: verdict.revalidationRef,
      sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED',
      authorityStatus: 'CURRENT',
      systemSafetyStatus: 'NOT_EVALUATED',
      launchGateStatus: 'NOT_EVALUATED',
      deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
    } as const);
    return Object.freeze({ state: 'READY_FOR_LATER_DELIVERY_GATES', readiness } as const);
  }
}
