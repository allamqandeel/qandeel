import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recoverDurableIntentProviderResult } from './durable-intent-provider-result';
import type { IntelligenceEffectState, IntelligenceExecution } from './post-response-intelligence.types';

const id = {
  session: '10000000-0000-4000-8000-000000000003',
  turn: '10000000-0000-4000-8000-000000000004',
  evidence: '10000000-0000-4000-8000-000000000006',
  otherSession: '20000000-0000-4000-8000-000000000003',
  otherTurn: '20000000-0000-4000-8000-000000000004',
};
const execution: Pick<IntelligenceExecution, 'session_id' | 'source_turn_id'> = {
  session_id: id.session, source_turn_id: id.turn,
};

type Payload = Record<string, unknown>;
const intent = (): Payload => ({
  problem: { text: 'Why do I repeat this pattern?', source: 'CURRENT_USER_TURN', sourceTurnId: id.turn },
  domain: 'GENERAL',
  scope: { kind: 'CONVERSATION_SESSION', sessionId: id.session, serialized: `CONVERSATION_SESSION:${id.session}` },
  evidenceIds: [`memory:${id.evidence}`],
});
const problemOf = (value: Payload) => value.problem as Payload;
const scopeOf = (value: Payload) => value.scope as Payload;

type Effect = Pick<IntelligenceEffectState, 'result_code' | 'result_reference' | 'result_payload'>;
const recover = (overrides: Partial<Effect> = {}) => recoverDurableIntentProviderResult(
  { result_code: 'INTENT_AUTHORIZED', result_reference: null, result_payload: intent(), ...overrides },
  execution,
);
const rejects = (mutate: (value: Payload) => unknown) => {
  const payload = intent();
  return recover({ result_payload: mutate(payload) ?? payload });
};

describe('recoverDurableIntentProviderResult', () => {
  it('recovers the exact canonical authorized intent without transforming it', () => {
    const result = recover();
    expect(result).toEqual({ status: 'AUTHORIZED', intent: intent() });
    if (result.status !== 'AUTHORIZED') throw new Error('unreachable');
    // Evidence order is authority-preserved: never re-ranked or re-sorted here.
    expect(result.intent.evidenceIds).toEqual([`memory:${id.evidence}`]);
    expect(result.intent.problem.text).toBe('Why do I repeat this pattern?');
  });

  it('recovers a durable NOT_AUTHORIZED without inventing a reason', () => {
    const result = recover({ result_code: 'INTENT_NOT_AUTHORIZED', result_payload: null });
    expect(result).toEqual({ status: 'NOT_AUTHORIZED' });
    expect(result).not.toHaveProperty('reason');
  });

  it.each<[string, Partial<Effect>]>([
    ['legacy pre-0029 completion with no durable result', { result_code: null, result_payload: null }],
    ['authorized code with no payload', { result_payload: null }],
    ['authorized code with undefined payload', { result_payload: undefined }],
    ['not-authorized code carrying a payload', { result_code: 'INTENT_NOT_AUTHORIZED' }],
    ['unknown result code', { result_code: 'INTENT_MAYBE' as never }],
    ['a Memory result code', { result_code: 'FRESH_EVIDENCE_CREATED' }],
    ['a stray result reference', { result_reference: `memory:${id.evidence}` }],
  ])('returns INDETERMINATE for %s, never NOT_AUTHORIZED', (_label, overrides) => {
    expect(recover(overrides)).toEqual({ status: 'INDETERMINATE' });
  });

  it.each<[string, (value: Payload) => unknown]>([
    ['non-object payload', () => 'not-an-object'],
    ['array payload', () => []],
    ['extra top-level key', (v) => ({ ...v, extra: 1 })],
    ['missing top-level key', (v) => { delete v.domain; return v; }],
    ['malformed problem object', (v) => ({ ...v, problem: 'text' })],
    ['extra problem key', (v) => { problemOf(v).extra = 1; return v; }],
    ['blank problem text', (v) => { problemOf(v).text = '   '; return v; }],
    ['oversized problem text', (v) => { problemOf(v).text = 'x'.repeat(2001); return v; }],
    ['wrong problem source', (v) => { problemOf(v).source = 'ASSISTANT_TURN'; return v; }],
    ['invalid sourceTurnId', (v) => { problemOf(v).sourceTurnId = 'not-a-uuid'; return v; }],
    ['invalid domain', (v) => ({ ...v, domain: 'HEALTH' })],
    ['malformed scope object', (v) => ({ ...v, scope: null })],
    ['extra scope key', (v) => { scopeOf(v).extra = 1; return v; }],
    ['wrong scope kind', (v) => { scopeOf(v).kind = 'GLOBAL'; return v; }],
    ['invalid sessionId', (v) => { scopeOf(v).sessionId = 'not-a-uuid'; return v; }],
    ['serialized/session mismatch', (v) => { scopeOf(v).serialized = `CONVERSATION_SESSION:${id.otherSession}`; return v; }],
    ['non-array evidenceIds', (v) => ({ ...v, evidenceIds: `memory:${id.evidence}` })],
    ['zero evidenceIds', (v) => ({ ...v, evidenceIds: [] })],
    ['nine evidenceIds', (v) => ({ ...v, evidenceIds: Array.from({ length: 9 }, (_, index) => `memory:10000000-0000-4000-8000-00000000000${index}`) })],
    ['malformed evidence id', (v) => ({ ...v, evidenceIds: ['memory:not-a-uuid'] })],
    ['non-string evidence id', (v) => ({ ...v, evidenceIds: [1] })],
    ['duplicate evidence ids', (v) => ({ ...v, evidenceIds: [`memory:${id.evidence}`, `memory:${id.evidence}`] })],
  ])('rejects %s as INDETERMINATE', (_label, mutate) => {
    expect(rejects(mutate)).toEqual({ status: 'INDETERMINATE' });
  });

  it.each<[string, (value: Payload) => unknown]>([
    ['a different source turn', (v) => { problemOf(v).sourceTurnId = id.otherTurn; return v; }],
    ['a different session', (v) => { scopeOf(v).sessionId = id.otherSession; scopeOf(v).serialized = `CONVERSATION_SESSION:${id.otherSession}`; return v; }],
  ])('refuses a durable result recorded for %s', (_label, mutate) => {
    expect(rejects(mutate)).toEqual({ status: 'INDETERMINATE' });
  });

  it('is a pure boundary that cannot call a provider, a service, or the database', () => {
    const source = readFileSync(join(__dirname, 'durable-intent-provider-result.ts'), 'utf8');
    for (const forbidden of ['.service', 'Service', 'Repository', 'fetch(', 'async ', 'await ', 'rpc/']) {
      expect(source).not.toContain(forbidden);
    }
  });
});
