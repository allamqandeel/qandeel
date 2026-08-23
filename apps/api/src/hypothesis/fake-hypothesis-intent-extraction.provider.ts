import { Injectable } from '@nestjs/common';
import {
  HypothesisIntentExtractionProviderError,
  type HypothesisIntentExtractionProvider,
  type HypothesisIntentExtractionProviderErrorCode,
  type HypothesisIntentExtractionProviderOutput,
  type HypothesisIntentExtractionProviderRequest,
} from './hypothesis-intent-extraction-provider.types';

@Injectable()
export class FakeHypothesisIntentExtractionProvider implements HypothesisIntentExtractionProvider {
  readonly calls: HypothesisIntentExtractionProviderRequest[] = [];
  private output?: HypothesisIntentExtractionProviderOutput;
  private failure?: HypothesisIntentExtractionProviderErrorCode;

  setOutput(output: HypothesisIntentExtractionProviderOutput): void { this.output = structuredClone(output); this.failure = undefined; }
  setFailure(code: HypothesisIntentExtractionProviderErrorCode): void { this.failure = code; this.output = undefined; }

  async extract(request: HypothesisIntentExtractionProviderRequest): Promise<HypothesisIntentExtractionProviderOutput> {
    this.calls.push(structuredClone(request));
    if (this.failure) throw new HypothesisIntentExtractionProviderError(this.failure);
    if (!this.output) throw new HypothesisIntentExtractionProviderError('INVALID_STRUCTURED_OUTPUT');
    return structuredClone(this.output);
  }
}
