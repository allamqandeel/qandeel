// Deterministic in-process doubles for the THREE real model/provider
// boundaries of the A2 post-response pipeline. They stand in ONLY for the paid
// model call: every proposal they emit still passes through the REAL
// authority/validation services (association authority, intent authority,
// generation validation policy, canonical database commands), which decide
// whether the output is accepted. Each double records its invocations so the
// smoke can prove exact call counts (1/1/1 on the primary path, unchanged
// after duplicate delivery). No network, no API key, no randomness.
import type { HypothesisEvidenceAssociationProvider } from '../../src/hypothesis/hypothesis-evidence-association-provider.types';
import type {
  HypothesisEvidenceAssociationProposal,
  HypothesisEvidenceAssociationSnapshot,
} from '../../src/hypothesis/hypothesis-evidence-association.types';
import type {
  HypothesisIntentExtractionProvider,
  HypothesisIntentExtractionProviderOutput,
  HypothesisIntentExtractionProviderRequest,
} from '../../src/hypothesis/hypothesis-intent-extraction-provider.types';
import type {
  HypothesisCandidateGenerator,
  HypothesisCandidateProposal,
  HypothesisGenerationRequest,
} from '../../src/hypothesis/hypothesis-generation.types';
import type { EvidenceRole, HypothesisDomain, HypothesisType } from '../../src/hypothesis/hypothesis.types';

/** Proposes attaching the snapshot's fresh Evidence to one fixed seeded Hypothesis. */
export class DeterministicAssociationProposalProvider implements HypothesisEvidenceAssociationProvider {
  readonly snapshots: HypothesisEvidenceAssociationSnapshot[] = [];

  constructor(
    private readonly targetHypothesisId: string,
    private readonly evidenceRole: EvidenceRole,
  ) {}

  get callCount(): number {
    return this.snapshots.length;
  }

  async propose(snapshot: HypothesisEvidenceAssociationSnapshot): Promise<ReadonlyArray<HypothesisEvidenceAssociationProposal>> {
    this.snapshots.push(structuredClone(snapshot));
    return [{ hypothesisId: this.targetHypothesisId, evidenceRole: this.evidenceRole }];
  }
}

/**
 * Emits bounded structured intent output: the exact current-turn text as the
 * grounded problem, one fixed canonical domain, and exactly the eligible
 * Evidence universe the pipeline supplied — a pure function of the request.
 */
export class DeterministicIntentExtractionProvider implements HypothesisIntentExtractionProvider {
  readonly requests: HypothesisIntentExtractionProviderRequest[] = [];

  constructor(private readonly domain: HypothesisDomain) {}

  get callCount(): number {
    return this.requests.length;
  }

  async extract(request: HypothesisIntentExtractionProviderRequest): Promise<HypothesisIntentExtractionProviderOutput> {
    this.requests.push(structuredClone(request) as HypothesisIntentExtractionProviderRequest);
    return {
      problemText: request.currentUserText,
      domain: this.domain,
      selectedEvidenceIds: request.eligibleEvidence.map((item) => item.evidenceId),
    };
  }
}

/**
 * Emits exactly one candidate with a fixed statement (a distinct collision key
 * from the seeded Hypothesis), the authorized Intent domain/scope taken from
 * the assembled request, and only the request's eligible Evidence as support —
 * a pure function of the request.
 */
export class DeterministicCandidateGenerator implements HypothesisCandidateGenerator {
  readonly requests: HypothesisGenerationRequest[] = [];

  constructor(
    private readonly statement: string,
    private readonly type: HypothesisType,
    private readonly assumptions: readonly string[] = [],
  ) {}

  get callCount(): number {
    return this.requests.length;
  }

  async generate(request: HypothesisGenerationRequest): Promise<ReadonlyArray<HypothesisCandidateProposal>> {
    this.requests.push(structuredClone(request) as HypothesisGenerationRequest);
    return [
      {
        statement: this.statement,
        type: this.type,
        domain: request.domain,
        scope: request.scope,
        supportingEvidenceIds: request.eligibleEvidence.map((item) => item.evidenceId),
        contradictingEvidenceIds: [],
        assumptions: [...this.assumptions],
        disconfirmingConditions: [],
      },
    ];
  }
}
