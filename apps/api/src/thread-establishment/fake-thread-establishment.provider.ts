// T-03B2a - the deterministic Thread-establishment provider used by tests and CI.
//
// CI holds no provider secrets and makes no live provider call, so every
// adversarial fixture runs against this adapter. It is scripted, not clever:
// it returns exactly the proposals, failures or malformed payloads a test asks
// for, in order, and records every request it received so the no-hindsight
// boundary and the zero-provider short-circuits can be proven from what the
// provider actually saw.

import {
  ThreadEstablishmentProviderError,
  type ThreadEstablishmentProposal,
  type ThreadEstablishmentProvider,
  type ThreadEstablishmentProviderErrorCode,
  type ThreadEstablishmentRequest,
} from './thread-establishment-provider.types';

export type FakeThreadEstablishmentStep =
  | { readonly kind: 'PROPOSAL'; readonly proposal: ThreadEstablishmentProposal }
  | { readonly kind: 'FAILURE'; readonly code: ThreadEstablishmentProviderErrorCode };

export class FakeThreadEstablishmentProvider implements ThreadEstablishmentProvider {
  readonly requests: ThreadEstablishmentRequest[] = [];
  private cursor = 0;

  constructor(private readonly script: readonly FakeThreadEstablishmentStep[]) {}

  /** One proposal, returned for every request. */
  static returning(proposal: ThreadEstablishmentProposal): FakeThreadEstablishmentProvider {
    return new FakeThreadEstablishmentProvider([{ kind: 'PROPOSAL', proposal }]);
  }

  /** An ordered script consumed one step per request; a request past the end fails closed. */
  static scripted(proposals: readonly ThreadEstablishmentProposal[]): FakeThreadEstablishmentProvider {
    return new FakeThreadEstablishmentProvider(proposals.map((proposal) => ({ kind: 'PROPOSAL', proposal })));
  }

  static failing(code: ThreadEstablishmentProviderErrorCode): FakeThreadEstablishmentProvider {
    return new FakeThreadEstablishmentProvider([{ kind: 'FAILURE', code }]);
  }

  async propose(request: ThreadEstablishmentRequest): Promise<ThreadEstablishmentProposal> {
    // Snapshot the request so a later mutation of the caller's context cannot
    // rewrite the evidence of what this call actually saw.
    this.requests.push(JSON.parse(JSON.stringify(request)) as ThreadEstablishmentRequest);
    const step = this.script.length === 1 ? this.script[0] : this.script[this.cursor];
    this.cursor += 1;
    if (!step) throw new ThreadEstablishmentProviderError('PROVIDER_ERROR');
    if (step.kind === 'FAILURE') throw new ThreadEstablishmentProviderError(step.code);
    return step.proposal;
  }
}
