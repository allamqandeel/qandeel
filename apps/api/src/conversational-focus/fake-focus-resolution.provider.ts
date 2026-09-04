// T-03B1a - the deterministic focus-resolution provider used by tests and CI.
//
// CI holds no provider secrets and makes no live provider call, so every
// adversarial fixture runs against this adapter. It is scripted, not clever:
// it returns exactly the proposals, failures or malformed payloads a test asks
// for, in order, and records every request it received so the no-hindsight
// boundary can be proven from what the provider actually saw.

import {
  FocusResolutionProviderError,
  type FocusResolutionProposal,
  type FocusResolutionProvider,
  type FocusResolutionProviderErrorCode,
  type FocusResolutionRequest,
} from './focus-resolution-provider.types';

export type FakeFocusResolutionStep =
  | { readonly kind: 'PROPOSAL'; readonly proposal: FocusResolutionProposal }
  | { readonly kind: 'FAILURE'; readonly code: FocusResolutionProviderErrorCode };

export class FakeFocusResolutionProvider implements FocusResolutionProvider {
  readonly requests: FocusResolutionRequest[] = [];
  private cursor = 0;

  constructor(private readonly script: readonly FakeFocusResolutionStep[]) {}

  /** One proposal, returned for every request. */
  static returning(proposal: FocusResolutionProposal): FakeFocusResolutionProvider {
    return new FakeFocusResolutionProvider([{ kind: 'PROPOSAL', proposal }]);
  }

  /** An ordered script consumed one step per request; a request past the end fails closed. */
  static scripted(proposals: readonly FocusResolutionProposal[]): FakeFocusResolutionProvider {
    return new FakeFocusResolutionProvider(proposals.map((proposal) => ({ kind: 'PROPOSAL', proposal })));
  }

  static failing(code: FocusResolutionProviderErrorCode): FakeFocusResolutionProvider {
    return new FakeFocusResolutionProvider([{ kind: 'FAILURE', code }]);
  }

  async propose(request: FocusResolutionRequest): Promise<FocusResolutionProposal> {
    // Snapshot the request so a later mutation of the caller's context cannot
    // rewrite the evidence of what this call actually saw.
    this.requests.push(JSON.parse(JSON.stringify(request)) as FocusResolutionRequest);
    const step = this.script.length === 1 ? this.script[0] : this.script[this.cursor];
    this.cursor += 1;
    if (!step) throw new FocusResolutionProviderError('PROVIDER_ERROR');
    if (step.kind === 'FAILURE') throw new FocusResolutionProviderError(step.code);
    return step.proposal;
  }
}
