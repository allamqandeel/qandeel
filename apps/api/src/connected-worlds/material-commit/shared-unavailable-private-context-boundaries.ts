// S4-02 — the two I-03 dependency contracts no reviewed slice has implemented, bound FAIL-CLOSED.
//
// The frozen I-03G Source Disclosure Gate depends on a server-owned detector, and the frozen I-03F revalidator on a
// private source-state resolver. CW2-02 §58 defers the detector's implementation and I-03F leaves the source-state
// boundary to whichever later slice owns Personal source exposure; neither exists in this repository. Both are reached
// ONLY when an EffectiveContext admitted private reasoning context, and S4-02 offers none (no Personal Standing Context
// collector exists), so in S4-02 neither is ever invoked.
//
// They still need a binding for the frozen services to be composed at all, and the only truthful binding is "this cannot
// be answered": a detector that is never CLEAR and a source state that is never AVAILABLE. An answer of either kind
// makes the frozen gate / revalidator return UNRESOLVED, which blocks delivery — so if a later change ever offered a
// private candidate before the real boundaries exist, the reply would be refused, never delivered.

import { Injectable } from '@nestjs/common';
import type { PrivateSourceContextRef } from '../effective-context/shared-effective-context.types';
import type { SharedPrivateSourceStateResolution, SharedPrivateSourceStateResolver } from '../delivery-authority/shared-private-source-state-resolver.types';
import type {
  SharedSourceDisclosureDetectionRequest,
  SharedSourceDisclosureDetector,
  SharedSourceDisclosureDetectorAssessment,
} from '../source-disclosure/shared-source-disclosure-detector.types';

@Injectable()
export class UnimplementedSourceDisclosureDetector implements SharedSourceDisclosureDetector {
  async assess(request: SharedSourceDisclosureDetectionRequest): Promise<SharedSourceDisclosureDetectorAssessment> {
    void request;
    return Object.freeze({ state: 'UNRESOLVED', failure: 'DETECTOR_UNAVAILABLE' } as const);
  }
}

@Injectable()
export class UnimplementedPrivateSourceState implements SharedPrivateSourceStateResolver {
  async resolveCurrent(source: PrivateSourceContextRef): Promise<SharedPrivateSourceStateResolution> {
    void source;
    return Object.freeze({ state: 'UNRESOLVED', failure: 'SOURCE_STATE_UNAVAILABLE' } as const);
  }
}
