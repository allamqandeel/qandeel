import { Injectable } from '@nestjs/common';
import {
  PersonalUnderstandingCaptureProviderError,
  type PersonalUnderstandingCaptureErrorCode,
  type PersonalUnderstandingCaptureOutputV3,
  type PersonalUnderstandingCaptureProviderV3,
  type PersonalUnderstandingCaptureRequestV3,
} from './personal-understanding.types';

/** The test double (capture schema v3). With no programmed answer it proposes nothing (an empty, valid answer). */
@Injectable()
export class FakePersonalUnderstandingCaptureProvider implements PersonalUnderstandingCaptureProviderV3 {
  readonly calls: PersonalUnderstandingCaptureRequestV3[] = [];
  private output: PersonalUnderstandingCaptureOutputV3 = { facts: [], memories: [], context: [], commands: [] };
  private failure?: PersonalUnderstandingCaptureErrorCode;

  /** Omitted lists propose nothing. */
  setOutput(output: Partial<PersonalUnderstandingCaptureOutputV3>): void {
    this.output = structuredClone({ facts: [], memories: [], context: [], commands: [], ...output }); this.failure = undefined;
  }
  setFailure(code: PersonalUnderstandingCaptureErrorCode): void { this.failure = code; }

  async captureV3(request: PersonalUnderstandingCaptureRequestV3): Promise<PersonalUnderstandingCaptureOutputV3> {
    this.calls.push(structuredClone(request));
    if (this.failure) throw new PersonalUnderstandingCaptureProviderError(this.failure);
    return structuredClone(this.output);
  }
}
