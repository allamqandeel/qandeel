import {
  LEGACY_ROUTING_REASONS,
  RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE,
  RUNTIME_ROUTING_POLICY_VERSION,
  RUNTIME_ROUTING_V2_REASONS,
  isLegacyRoutingReason,
  isLegalCurrentRoutePair,
  isLegalDurableRoutePair,
  isRuntimeRoutingV2Reason,
} from './fast-deep-routing-contract';

const LEGAL_V2_PAIRS = [
  ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
  ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE'],
  ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION'],
  ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART'],
  ['DEEP', 'RUNTIME_ROUTING_V2_DEEP_COMPOSITE'],
] as const;
const LEGACY_PAIRS = [
  ['FAST', 'FAST_DEFAULT'],
  ['DEEP', 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'],
] as const;

describe('QIR-002 FAST/DEEP route-pair contract', () => {
  it('freezes the exact v2 vocabulary', () => {
    expect(RUNTIME_ROUTING_POLICY_VERSION).toBe(2);
    expect(RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE).toBe(7);
    expect([...RUNTIME_ROUTING_V2_REASONS]).toEqual([
      'RUNTIME_ROUTING_V2_FAST_DEFAULT',
      'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE',
      'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION',
      'RUNTIME_ROUTING_V2_DEEP_MULTI_PART',
      'RUNTIME_ROUTING_V2_DEEP_COMPOSITE',
    ]);
    expect([...LEGACY_ROUTING_REASONS]).toEqual(['FAST_DEFAULT', 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT']);
    expect(Object.isFrozen(RUNTIME_ROUTING_V2_REASONS)).toBe(true);
    expect(Object.isFrozen(LEGACY_ROUTING_REASONS)).toBe(true);
  });

  it('classifies reasons without overlap', () => {
    for (const reason of RUNTIME_ROUTING_V2_REASONS) {
      expect(isRuntimeRoutingV2Reason(reason)).toBe(true);
      expect(isLegacyRoutingReason(reason)).toBe(false);
    }
    for (const reason of LEGACY_ROUTING_REASONS) {
      expect(isLegacyRoutingReason(reason)).toBe(true);
      expect(isRuntimeRoutingV2Reason(reason)).toBe(false);
    }
    for (const value of [null, undefined, 42, {}, [], 'UNKNOWN_REASON', '']) {
      expect(isRuntimeRoutingV2Reason(value)).toBe(false);
      expect(isLegacyRoutingReason(value)).toBe(false);
    }
  });

  describe('current claim authority', () => {
    it.each(LEGAL_V2_PAIRS)('accepts %s + %s', (path, reason) => {
      expect(isLegalCurrentRoutePair(path, reason)).toBe(true);
    });

    it.each(LEGACY_PAIRS)('refuses the legacy pair %s + %s for new claims', (path, reason) => {
      expect(isLegalCurrentRoutePair(path, reason)).toBe(false);
    });

    it('refuses cross pairs, unknown reasons and half-null states', () => {
      const illegal: Array<[unknown, unknown]> = [
        ['FAST', 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE'],
        ['FAST', 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION'],
        ['FAST', 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART'],
        ['FAST', 'RUNTIME_ROUTING_V2_DEEP_COMPOSITE'],
        ['DEEP', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
        ['FAST', 'INVENTED_REASON'],
        ['DEEP', 'INVENTED_REASON'],
        ['TURBO', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
        ['FAST', null],
        [null, 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
        [null, null],
        [undefined, undefined],
      ];
      for (const [path, reason] of illegal) expect(isLegalCurrentRoutePair(path, reason)).toBe(false);
    });
  });

  describe('durable read/event authority', () => {
    it.each([...LEGAL_V2_PAIRS, ...LEGACY_PAIRS])('accepts the durable pair %s + %s', (path, reason) => {
      expect(isLegalDurableRoutePair(path, reason)).toBe(true);
    });

    it('accepts the pre-routing null/null state', () => {
      expect(isLegalDurableRoutePair(null, null)).toBe(true);
    });

    it('refuses cross pairs, unknown reasons and half-null states', () => {
      const illegal: Array<[unknown, unknown]> = [
        ['FAST', 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'],
        ['DEEP', 'FAST_DEFAULT'],
        ['FAST', 'RUNTIME_ROUTING_V2_DEEP_COMPOSITE'],
        ['DEEP', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
        ['FAST', 'INVENTED_REASON'],
        ['SLOW', 'FAST_DEFAULT'],
        ['FAST', null],
        [null, 'FAST_DEFAULT'],
        [null, 'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
        ['FAST', 7],
        [undefined, null],
        [null, undefined],
      ];
      for (const [path, reason] of illegal) expect(isLegalDurableRoutePair(path, reason)).toBe(false);
    });

    it('is strictly wider than the current claim authority and never narrower', () => {
      for (const [path, reason] of LEGAL_V2_PAIRS) {
        expect(isLegalCurrentRoutePair(path, reason)).toBe(true);
        expect(isLegalDurableRoutePair(path, reason)).toBe(true);
      }
      for (const [path, reason] of LEGACY_PAIRS) {
        expect(isLegalCurrentRoutePair(path, reason)).toBe(false);
        expect(isLegalDurableRoutePair(path, reason)).toBe(true);
      }
    });
  });
});
