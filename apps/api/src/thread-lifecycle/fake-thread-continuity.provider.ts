// T-03B3 - the deterministic Thread Continuity provider used by tests and CI.
//
// CI holds no provider secrets and makes no live provider call, so every
// adversarial fixture runs against this adapter. It is scripted, not clever:
// it answers screening and resolution requests from the functions a test
// supplies, and records every request it received so the exhaustive
// deterministic screening, the input firewall and the zero-provider
// short-circuits can be proven from what the provider actually saw.

import {
  ThreadContinuityProviderError,
  type ThreadContinuityProvider,
  type ThreadContinuityProviderErrorCode,
  type ThreadContinuityResolutionProposal,
  type ThreadContinuityResolutionRequest,
  type ThreadContinuityScreeningProposal,
  type ThreadContinuityScreeningRequest,
} from './thread-continuity-provider.types';

export type FakeScreeningAnswer = (request: ThreadContinuityScreeningRequest) => ThreadContinuityScreeningProposal | ThreadContinuityProviderError;
export type FakeResolutionAnswer = (request: ThreadContinuityResolutionRequest) => ThreadContinuityResolutionProposal | ThreadContinuityProviderError;

export class FakeThreadContinuityProvider implements ThreadContinuityProvider {
  readonly screeningRequests: ThreadContinuityScreeningRequest[] = [];
  readonly resolutionRequests: ThreadContinuityResolutionRequest[] = [];
  private inFlight = 0;
  maxInFlight = 0;

  constructor(
    private readonly screening: FakeScreeningAnswer,
    private readonly resolution: FakeResolutionAnswer,
  ) {}

  /** Nominates every supplied candidate and answers the resolution with `proposal`. */
  static nominatingAll(proposal: ThreadContinuityResolutionProposal): FakeThreadContinuityProvider {
    return new FakeThreadContinuityProvider(
      (request) => ({ possibleSameThreadIds: request.candidates.map((candidate) => candidate.threadId) }),
      () => proposal,
    );
  }

  /** Nominates nothing anywhere: the deterministic DISTINCT_NEW short-circuit is proven with zero resolution calls. */
  static nominatingNone(): FakeThreadContinuityProvider {
    return new FakeThreadContinuityProvider(() => ({ possibleSameThreadIds: [] }), () => new ThreadContinuityProviderError('PROVIDER_ERROR'));
  }

  static failing(code: ThreadContinuityProviderErrorCode): FakeThreadContinuityProvider {
    return new FakeThreadContinuityProvider(() => new ThreadContinuityProviderError(code), () => new ThreadContinuityProviderError(code));
  }

  async screen(request: ThreadContinuityScreeningRequest): Promise<ThreadContinuityScreeningProposal> {
    return this.answer(this.screeningRequests, request, this.screening);
  }

  async resolve(request: ThreadContinuityResolutionRequest): Promise<ThreadContinuityResolutionProposal> {
    return this.answer(this.resolutionRequests, request, this.resolution);
  }

  private async answer<Request, Proposal>(
    log: Request[],
    request: Request,
    respond: (request: Request) => Proposal | ThreadContinuityProviderError,
  ): Promise<Proposal> {
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    // Snapshot the request so a later mutation of the caller's context cannot
    // rewrite the evidence of what this call actually saw.
    log.push(JSON.parse(JSON.stringify(request)) as Request);
    await new Promise((resolve) => setTimeout(resolve, 1));
    try {
      const answer = respond(request);
      if (answer instanceof ThreadContinuityProviderError) throw answer;
      return answer;
    } finally {
      this.inFlight -= 1;
    }
  }
}
