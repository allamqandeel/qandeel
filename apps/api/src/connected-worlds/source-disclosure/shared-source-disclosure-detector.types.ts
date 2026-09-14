// I-03G - Shared Source Disclosure detection: the server-owned CONTRACT, and
// deliberately not one line of the mechanism behind it.
//
// CW2-02 §20 freezes WHAT the Narrow Source Disclosure Gate must prevent before
// multi-person delivery - private quotes, direct protected source facts,
// source-specific attribution and sealed-provenance disclosure - and CW2-02 §58
// just as explicitly defers "the exact implementation of direct-source
// disclosure detection". This file is exactly that seam: the four frozen
// categories, the request a detector receives, the bounded assessment it may
// answer with, and the injection token a later reviewed slice binds an
// implementation to.
//
// There is therefore no exact-match rule, n-gram window, regular expression,
// string or edit distance, similarity or confidence threshold, embedding, vector
// index, LLM-as-judge prompt, model selection, provider self-classification,
// redaction strategy or rewrite strategy here or anywhere in I-03G. Choosing any
// of them would be inventing the deferred contract rather than defining it.
//
// Two properties of this contract are load-bearing and are enforced by the gate
// that consumes it, not merely described here:
//
//   - the detector is SERVER-OWNED. Nothing a client, a provider or a model can
//     say is an assessment: there is no `sourceDisclosureSafe` input, no
//     provider self-declaration, no client-supplied verdict and no credential or
//     user token anywhere in the request;
//   - an assessment is bound to ONE exact operation. Its binding names the exact
//     EffectiveContext, the exact output identity and the exact protected source
//     set, and the gate refuses an assessment whose binding is not the one it
//     asked about (CW2-02 §7, B6) - an assessment of another output is not
//     weaker evidence, it is no evidence.
//
// The request deliberately carries the generation-time protected reasoning
// content, because a real detector cannot judge whether output discloses
// protected source material without seeing that material. That is a narrow
// internal privacy inspection of an operation artifact the server already holds:
// it is not retrieval, not reconstruction of deleted content, and not a second
// reasoning path (task §9, §10; CW2-02 §27, B19). Production code never logs,
// serializes, persists, returns or exposes it.

import type { PrivateSourceContextRef } from '../effective-context/shared-effective-context.types';

/**
 * Exactly the four protected-disclosure classes CW2-02 §20 freezes. No fifth
 * semantic category exists in v1, and none is needed: higher-level advice is not
 * a finding merely because private context influenced it (CW2-02 §19, B16).
 */
export const SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES = [
  'PRIVATE_QUOTE',
  'DIRECT_PROTECTED_SOURCE_FACT',
  'SOURCE_SPECIFIC_ATTRIBUTION',
  'SEALED_PROVENANCE_DISCLOSURE',
] as const;
export type SharedSourceDisclosureFindingCategory = (typeof SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES)[number];

/**
 * One protected private source of the exact operation: the frozen I-03E source
 * reference, the exact generation-time reasoning bytes and their canonical
 * digest. It carries no grant, no authority decision and no consent state: a
 * detector judges disclosure, never permission.
 */
export interface SharedProtectedSource {
  readonly source: PrivateSourceContextRef;
  /** The exact bytes that influenced generation, byte-for-byte as I-03E admitted them. */
  readonly reasoningContent: string;
  /** `sha256:<64 lowercase hex>` over exactly those bytes. */
  readonly contentDigest: string;
}

/**
 * The immutable inspection request for ONE exact operation. It is built by the
 * gate from an already validated generation artifact and is never assembled from
 * client input, never persisted and never returned.
 */
export interface SharedSourceDisclosureDetectionRequest {
  readonly effectiveContextRef: string;
  /** `sha256:<64 lowercase hex>` over the exact UTF-8 provider output. */
  readonly outputDigest: string;
  /** The exact provider output under inspection. */
  readonly outputText: string;
  /** `sha256:<64 lowercase hex>` over the exact protected source set, in exact admitted order. */
  readonly protectedSourceSetRef: string;
  /** Non-empty, in exact I-03E admitted order. A detector is never invoked for an empty set. */
  readonly protectedSources: ReadonlyArray<SharedProtectedSource>;
}

/**
 * What an assessment claims to be about. Operation references only - never an
 * owner, a source id, content, output or consent state.
 */
export interface SharedSourceDisclosureAssessmentBinding {
  readonly effectiveContextRef: string;
  readonly outputDigest: string;
  readonly protectedSourceSetRef: string;
}

/** Bounded internal reasons a detector could not produce a usable assessment. Never a raw error, exception text, response body or secret. */
export const SHARED_SOURCE_DISCLOSURE_DETECTOR_FAILURES = [
  'DETECTOR_UNAVAILABLE',
  'DETECTOR_FAILED',
  'ASSESSMENT_UNAVAILABLE',
  'CONTRADICTORY_ASSESSMENT',
] as const;
export type SharedSourceDisclosureDetectorFailure = (typeof SHARED_SOURCE_DISCLOSURE_DETECTOR_FAILURES)[number];

/**
 * The closed answer:
 *
 *   CLEAR      - no protected-source disclosure was detected for this exact
 *                output under this exact assessment. It is a statement about one
 *                output, never a grant of disclosure authority (task §22);
 *   DETECTED   - at least one frozen category was positively detected. The
 *                findings are category names only: no owner, no source id, no
 *                quoted content and no raw output may appear in them;
 *   UNRESOLVED - the detector could not answer. Uncertainty is never CLEAR.
 *
 * `assessmentRef` and `detectorPolicyRef` are opaque server-owned strings. This
 * contract deliberately does not freeze their format, because doing so would
 * constrain the deferred implementation's identity and policy versioning.
 */
export type SharedSourceDisclosureDetectorAssessment =
  | {
      readonly state: 'CLEAR';
      readonly assessmentRef: string;
      readonly detectorPolicyRef: string;
      readonly binding: SharedSourceDisclosureAssessmentBinding;
    }
  | {
      readonly state: 'DETECTED';
      readonly assessmentRef: string;
      readonly detectorPolicyRef: string;
      readonly binding: SharedSourceDisclosureAssessmentBinding;
      /** Non-empty and duplicate-free; category names and nothing else. */
      readonly findings: ReadonlyArray<SharedSourceDisclosureFindingCategory>;
    }
  | { readonly state: 'UNRESOLVED'; readonly failure: SharedSourceDisclosureDetectorFailure };

/**
 * The server-owned inspection boundary. I-03G defines it and implements none of
 * it: a real implementation is expected future work under its own independent
 * review, and nothing in this slice forbids one.
 */
export interface SharedSourceDisclosureDetector {
  assess(request: SharedSourceDisclosureDetectionRequest): Promise<SharedSourceDisclosureDetectorAssessment>;
}

/** Injection token for the server-owned detector. No provider is registered by I-03G. */
export const SHARED_SOURCE_DISCLOSURE_DETECTOR = 'SHARED_SOURCE_DISCLOSURE_DETECTOR' as const;
