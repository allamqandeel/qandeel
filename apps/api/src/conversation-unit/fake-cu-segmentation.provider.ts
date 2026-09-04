// T-03A1 - the deterministic CU segmentation provider used by tests and CI.
//
// CI holds no provider secrets and makes no live provider call, so every
// adversarial case runs against this adapter. It is scripted rather than
// clever: it returns exactly the anchors, failures or malformed payloads a test
// asks for, so the evaluator's fail-closed behaviour can be proven precisely
// (including that a provider outage NEVER collapses a turn to one CU).

import type { SourceAnchor } from './cu-anchor-mapper';
import {
  CuSegmentationProviderError,
  type CuSegmentationProposal,
  type CuSegmentationProvider,
  type CuSegmentationProviderErrorCode,
  type CuSegmentationRequest,
} from './cu-segmentation-provider.types';

export type FakeCuSegmentationScript =
  | { readonly kind: 'ANCHORS'; readonly units: readonly SourceAnchor[] }
  | { readonly kind: 'FAILURE'; readonly code: CuSegmentationProviderErrorCode };

export class FakeCuSegmentationProvider implements CuSegmentationProvider {
  readonly requests: CuSegmentationRequest[] = [];

  constructor(private readonly script: FakeCuSegmentationScript) {}

  static withAnchors(units: readonly SourceAnchor[]): FakeCuSegmentationProvider {
    return new FakeCuSegmentationProvider({ kind: 'ANCHORS', units });
  }

  static failing(code: CuSegmentationProviderErrorCode): FakeCuSegmentationProvider {
    return new FakeCuSegmentationProvider({ kind: 'FAILURE', code });
  }

  async propose(request: CuSegmentationRequest): Promise<CuSegmentationProposal> {
    this.requests.push(request);
    if (this.script.kind === 'FAILURE') throw new CuSegmentationProviderError(this.script.code);
    return { units: this.script.units };
  }
}
