import { BadRequestException } from '@nestjs/common';
import { validateHypothesisUpdateRequest } from './hypothesis-update.policy';
import type { HypothesisUpdateRequest } from './hypothesis-update.types';

const request = (overrides: Partial<HypothesisUpdateRequest> = {}): HypothesisUpdateRequest => ({
  hypothesisId: '30000000-0000-4000-8000-000000000001',
  expectedVersion: 3,
  evidenceId: 'memory:20000000-0000-4000-8000-000000000001',
  evidenceRole: 'SUPPORTING',
  ...overrides,
});

describe('validateHypothesisUpdateRequest (shared foreground/background policy)', () => {
  it('accepts a canonical request for both evidence roles', () => {
    expect(() => validateHypothesisUpdateRequest(request())).not.toThrow();
    expect(() => validateHypothesisUpdateRequest(request({ evidenceRole: 'CONTRADICTING' }))).not.toThrow();
  });

  it('keeps the exact public message for malformed identifiers', () => {
    for (const malformed of [
      request({ hypothesisId: 'not-a-uuid' }),
      request({ evidenceId: '20000000-0000-4000-8000-000000000001' }),
      request({ evidenceId: 'memory:short' }),
      undefined as unknown as HypothesisUpdateRequest,
    ]) {
      expect(() => validateHypothesisUpdateRequest(malformed)).toThrow(BadRequestException);
      expect(() => validateHypothesisUpdateRequest(malformed)).toThrow('Malformed hypothesis update identifiers.');
    }
  });

  it('keeps the exact public message for an invalid expected version', () => {
    for (const version of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => validateHypothesisUpdateRequest(request({ expectedVersion: version })))
        .toThrow('Expected version must be a positive integer.');
    }
  });

  it('keeps the exact public message for an invalid evidence role', () => {
    expect(() => validateHypothesisUpdateRequest(request({ evidenceRole: 'NEUTRAL' as never })))
      .toThrow('Invalid evidence role.');
  });
});
