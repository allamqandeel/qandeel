import type { HypothesisCandidateGenerator, HypothesisCandidateProposal, HypothesisGenerationRequest } from './hypothesis-generation.types';
import { HypothesisCandidateGeneratorError, type HypothesisCandidateGeneratorErrorCode } from './hypothesis-candidate-generator-provider.types';

export class FakeHypothesisCandidateGenerator implements HypothesisCandidateGenerator {
  readonly calls: HypothesisGenerationRequest[] = [];
  private output: ReadonlyArray<HypothesisCandidateProposal> = [];
  private failure?: HypothesisCandidateGeneratorErrorCode;

  setOutput(output: ReadonlyArray<HypothesisCandidateProposal>): void {
    this.output = structuredClone(output);
    this.failure = undefined;
  }

  setFailure(code: HypothesisCandidateGeneratorErrorCode): void {
    this.failure = code;
  }

  async generate(request: HypothesisGenerationRequest): Promise<ReadonlyArray<HypothesisCandidateProposal>> {
    this.calls.push(structuredClone(request));
    if (this.failure) throw new HypothesisCandidateGeneratorError(this.failure);
    return structuredClone(this.output);
  }
}
