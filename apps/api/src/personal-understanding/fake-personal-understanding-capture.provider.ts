import { Injectable } from '@nestjs/common';
import {
  PersonalUnderstandingCaptureProviderError,
  type PersonalUnderstandingCaptureErrorCode,
  type PersonalUnderstandingCaptureOutput,
  type PersonalUnderstandingCaptureProvider,
  type PersonalUnderstandingCaptureRequest,
} from './personal-understanding.types';

/** The test double. With no programmed answer it proposes nothing (an empty, valid answer). */
@Injectable()
export class FakePersonalUnderstandingCaptureProvider implements PersonalUnderstandingCaptureProvider {
  readonly calls: PersonalUnderstandingCaptureRequest[] = [];
  private output: PersonalUnderstandingCaptureOutput = { facts: [], memories: [], context: [] };
  private failure?: PersonalUnderstandingCaptureErrorCode;

  /** An answer without `context` (written before S8A-03 Living Personal Memory) restates and ends nothing. */
  setOutput(output: Omit<PersonalUnderstandingCaptureOutput, 'context'> & Partial<Pick<PersonalUnderstandingCaptureOutput, 'context'>>): void {
    this.output = structuredClone({ context: [], ...output }); this.failure = undefined;
  }
  setFailure(code: PersonalUnderstandingCaptureErrorCode): void { this.failure = code; }

  async capture(request: PersonalUnderstandingCaptureRequest): Promise<PersonalUnderstandingCaptureOutput> {
    this.calls.push(structuredClone(request));
    if (this.failure) throw new PersonalUnderstandingCaptureProviderError(this.failure);
    return structuredClone(this.output);
  }
}
