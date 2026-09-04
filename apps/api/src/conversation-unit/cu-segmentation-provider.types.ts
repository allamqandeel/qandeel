// T-03A1 - the CU segmentation provider boundary.
//
// Stage 1.2 A2/CU-03 define a CU boundary semantically (an independently
// addressable contribution: an independent assertion or report, a separate
// question or request, an explicit clarification, correction, stance or
// focus-redirection move, a material change in claim attribution) and
// explicitly forbid segmenting on punctuation, commas, pause, code-switching,
// fillers, hesitation, syntactic clauses, named entities or connectives. A
// deterministic segmenter has nothing else to read, so it would necessarily use
// the forbidden evidence; and "one CU per turn, always" is disqualified by the
// frozen grammar itself. The evaluator is therefore hybrid: a provider proposes
// boundaries, deterministic code validates them, and the database commits.
//
// The provider returns EXTRACTIVE anchors only - never offsets, never wording
// of its own. Replay and read paths never invoke a provider.

import type { SourceAnchor } from './cu-anchor-mapper';

export const CU_SEGMENTATION_PROVIDER = Symbol('CU_SEGMENTATION_PROVIDER');
export const CU_SEGMENTATION_SCHEMA_VERSION = 1 as const;

export interface CuSegmentationRequest {
  /** Canonical committed source, exactly as stored. Never normalized. */
  readonly sourceText: string;
  /** The server-forced conversational speaker of the source turn. */
  readonly sourceRole: 'USER' | 'ASSISTANT';
  readonly maxUnits: number;
  readonly maxExcerptChars: number;
  readonly schemaVersion: typeof CU_SEGMENTATION_SCHEMA_VERSION;
}

export interface CuSegmentationProposal {
  /** Ordered anchors. An empty list is the legal zero-CU proposal. */
  readonly units: readonly SourceAnchor[];
}

export interface CuSegmentationProvider {
  propose(request: CuSegmentationRequest): Promise<CuSegmentationProposal>;
}

export type CuSegmentationProviderErrorCode =
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_STRUCTURED_OUTPUT'
  | 'PROVIDER_ERROR';

export class CuSegmentationProviderError extends Error {
  constructor(readonly code: CuSegmentationProviderErrorCode) {
    super('Conversational unit segmentation provider failed.');
    this.name = 'CuSegmentationProviderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
