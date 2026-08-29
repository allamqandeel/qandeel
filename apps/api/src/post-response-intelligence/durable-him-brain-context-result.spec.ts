import {
  HIM_BRAIN_CONTEXT_EFFECT_RESULT_CODES,
  parseHimBrainContextDurablePayload,
  recoverHimBrainContextResult,
} from './durable-him-brain-context-result';
import type { HimBrainContextDurablePayload } from '../human-model/him-brain-context.types';

// QHIA-012 durable managed Brain Context result contract.
//
// The durable receipt is the ONLY thing the next turn may consume, so it is
// parsed for SHAPE and IDENTITY only: no table is read, no binding is
// re-evaluated, and no current value is consulted. Anything unrecognisable is
// INDETERMINATE - never repaired, reordered, reinterpreted, or recomputed from
// current world state, because a later binding change must not be able to
// rewrite a committed receipt.
const SOURCE_TURN = '00000000-0000-4000-8000-000000000001';
const OTHER_TURN = '00000000-0000-4000-8000-000000000002';
const DECISION_CONTEXT = '00000000-0000-4000-8000-0000000000d1';
const GOAL_CONTEXT = '00000000-0000-4000-8000-0000000000c1';

const decisionSignal = () => ({
  slotOrder: 1, slot: 'DECISION_SELF_CONFIDENCE', contextKind: 'DECISION', contextId: DECISION_CONTEXT,
  numericValue: 3, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE',
  freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED',
});
const goalSignal = () => ({
  slotOrder: 5, slot: 'GOAL_CONSISTENCY', contextKind: 'GOAL', contextId: GOAL_CONTEXT,
  numericValue: 2, semanticMappingStatus: 'UNRESOLVED', semanticType: null,
  freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED',
});
const payload = (signals: unknown[] = [decisionSignal(), goalSignal()]): Record<string, unknown> => ({
  contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1', sourceTurnId: SOURCE_TURN, signals,
});
const completed = (result_code: string, result_payload: unknown) => ({
  result_code, result_reference: null as string | null, result_payload,
});

describe('durable HIM Brain Context result', () => {
  it('declares exactly two typed result codes with no partial, failed, or degraded completion', () => {
    expect(HIM_BRAIN_CONTEXT_EFFECT_RESULT_CODES).toEqual(['NO_HIM_BRAIN_CONTEXT', 'HIM_BRAIN_CONTEXT_MATERIALIZED']);
  });

  it('parses a canonical payload bound to the exact source turn', () => {
    const parsed = parseHimBrainContextDurablePayload(payload(), SOURCE_TURN);
    expect(parsed).toEqual<HimBrainContextDurablePayload>({
      contractVersion: 1,
      source: 'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1',
      sourceTurnId: SOURCE_TURN,
      signals: [
        { slotOrder: 1, slot: 'DECISION_SELF_CONFIDENCE', contextKind: 'DECISION', contextId: DECISION_CONTEXT, numericValue: 3, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
        { slotOrder: 5, slot: 'GOAL_CONSISTENCY', contextKind: 'GOAL', contextId: GOAL_CONTEXT, numericValue: 2, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
      ],
    });
  });

  it('refuses a payload bound to a different source turn: a receipt is never read on another turn\'s behalf', () => {
    expect(parseHimBrainContextDurablePayload(payload(), OTHER_TURN)).toBeUndefined();
    expect(recoverHimBrainContextResult(completed('HIM_BRAIN_CONTEXT_MATERIALIZED', payload()), OTHER_TURN).status).toBe('INDETERMINATE');
  });

  it('rejects every malformed payload shape', () => {
    const rejected: Array<[string, unknown]> = [
      ['a null payload', null],
      ['an array payload', []],
      ['a missing key', { contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1', sourceTurnId: SOURCE_TURN }],
      ['an extra key', { ...payload(), extra: 1 }],
      ['a wrong contract version', { ...payload(), contractVersion: 2 }],
      ['a wrong source', { ...payload(), source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1' }],
      ['a non-UUID source turn', { ...payload(), sourceTurnId: 'not-a-uuid' }],
      ['zero signals', payload([])],
      ['nine signals', payload([...Array(9)].map((_value, index) => ({ ...decisionSignal(), slotOrder: index + 1 })))],
      ['a duplicated slot', payload([decisionSignal(), decisionSignal()])],
      ['a registry order inversion', payload([goalSignal(), decisionSignal()])],
      ['an unknown slot ordinal', payload([{ ...decisionSignal(), slotOrder: 9 }])],
      ['a slot label that does not match its ordinal', payload([{ ...decisionSignal(), slot: 'GOAL_CONSISTENCY' }])],
      ['a context kind that does not match its slot', payload([{ ...decisionSignal(), contextKind: 'GOAL' }])],
      ['a non-UUID context identity', payload([{ ...decisionSignal(), contextId: 'not-a-uuid' }])],
      ['a numeric value below the v1 structured scale', payload([{ ...decisionSignal(), numericValue: 0 }])],
      ['a numeric value above the v1 structured scale', payload([{ ...decisionSignal(), numericValue: 6 }])],
      ['a fractional numeric value', payload([{ ...decisionSignal(), numericValue: 3.5 }])],
      ['a RESOLVED mapping with a null semantic type', payload([{ ...decisionSignal(), semanticType: null }])],
      ['an UNRESOLVED mapping carrying a semantic type', payload([{ ...goalSignal(), semanticType: 'STATE' }])],
      ['an unknown semantic mapping status', payload([{ ...decisionSignal(), semanticMappingStatus: 'PARTIAL' }])],
      ['an assessed freshness state', payload([{ ...decisionSignal(), freshnessState: 'FRESH' }])],
      ['an assessed confidence state', payload([{ ...decisionSignal(), confidenceState: 'HIGH' }])],
      ['a signal with an extra key', payload([{ ...decisionSignal(), metricKey: 'hse.self-confidence' }])],
      ['a signal with a missing key', payload([{ slotOrder: 1, slot: 'DECISION_SELF_CONFIDENCE' }])],
    ];
    const survived = rejected
      .filter(([, value]) => parseHimBrainContextDurablePayload(value, SOURCE_TURN) !== undefined)
      .map(([label]) => label);
    expect(survived).toEqual([]);
  });

  it('recovers the two valid durable results and nothing else', () => {
    expect(recoverHimBrainContextResult(completed('NO_HIM_BRAIN_CONTEXT', null), SOURCE_TURN))
      .toEqual({ status: 'NO_HIM_BRAIN_CONTEXT' });
    expect(recoverHimBrainContextResult(completed('NO_HIM_BRAIN_CONTEXT', undefined), SOURCE_TURN))
      .toEqual({ status: 'NO_HIM_BRAIN_CONTEXT' });
    const recovered = recoverHimBrainContextResult(completed('HIM_BRAIN_CONTEXT_MATERIALIZED', payload()), SOURCE_TURN);
    expect(recovered.status).toBe('HIM_BRAIN_CONTEXT_MATERIALIZED');
  });

  it('treats every impossible code, reference, or code/payload pairing as INDETERMINATE, never as a guess', () => {
    const indeterminate: Array<[string, ReturnType<typeof completed>]> = [
      ['a result-less completion', completed(null as unknown as string, null)],
      ['an unknown code', completed('HIM_BRAIN_CONTEXT_PARTIAL', payload())],
      ['a NO_HIM_BRAIN_CONTEXT carrying a payload', completed('NO_HIM_BRAIN_CONTEXT', payload())],
      ['a MATERIALIZED carrying no payload', completed('HIM_BRAIN_CONTEXT_MATERIALIZED', null)],
      ['a MATERIALIZED carrying a malformed payload', completed('HIM_BRAIN_CONTEXT_MATERIALIZED', payload([]))],
      ['a result carrying a reference', { result_code: 'NO_HIM_BRAIN_CONTEXT', result_reference: 'memory:x', result_payload: null }],
    ];
    for (const [, effect] of indeterminate) {
      expect(recoverHimBrainContextResult(effect, SOURCE_TURN).status).toBe('INDETERMINATE');
    }
  });
});
