import type { AuthorizedHypothesisGenerationIntent } from './hypothesis-generation-intent-authority.types';
import { HypothesisGenerationRequestAssemblerService } from './hypothesis-generation-request-assembler.service';

describe('HypothesisGenerationRequestAssemblerService', () => {
  const turnId = '10000000-0000-4000-8000-000000000001';
  const sessionId = '20000000-0000-4000-8000-000000000002';
  const evidenceIds = Array.from(
    { length: 8 },
    (_, index) => `memory:30000000-0000-4000-8000-00000000000${index + 1}`,
  );
  const service = new HypothesisGenerationRequestAssemblerService();
  const intent = (ids = evidenceIds.slice(0, 1)): AuthorizedHypothesisGenerationIntent => ({
    problem: { text: 'Why do I repeat this decision?', source: 'CURRENT_USER_TURN', sourceTurnId: turnId },
    domain: 'DECISION',
    scope: {
      kind: 'CONVERSATION_SESSION', sessionId,
      serialized: `CONVERSATION_SESSION:${sessionId}`,
    },
    evidenceIds: ids,
  });

  it.each([[1], [8]])('maps %i authorized Evidence IDs exactly and in canonical order', (count) => {
    const input = intent(evidenceIds.slice(0, count));
    expect(service.assemble(input)).toEqual({
      status: 'READY',
      request: {
        problem: input.problem.text,
        domain: input.domain,
        scope: input.scope.serialized,
        evidenceIds: input.evidenceIds,
      },
    });
  });

  it('is deterministic and does not mutate or semantically transform canonical fields', () => {
    const input = intent(evidenceIds.slice(0, 2));
    const first = service.assemble(input);
    const second = service.assemble(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      status: 'READY',
      request: {
        problem: 'Why do I repeat this decision?', domain: 'DECISION',
        scope: `CONVERSATION_SESSION:${sessionId}`, evidenceIds: evidenceIds.slice(0, 2),
      },
    });
    expect(input.evidenceIds).toEqual(evidenceIds.slice(0, 2));
    expect(first).not.toHaveProperty('supportingEvidenceIds');
    expect(first).not.toHaveProperty('contradictingEvidenceIds');
  });

  it('does not accept raw provider output as an authority bypass', () => {
    expect(service.assemble({
      problemText: 'Why do I repeat this decision?', domain: 'DECISION', selectedEvidenceIds: [evidenceIds[0]],
    } as never)).toEqual({ status: 'NOT_READY', reason: 'INVALID_AUTHORIZED_INTENT' });
  });

  it.each([
    [{ ...intent(), problem: { ...intent().problem, text: 'x'.repeat(2_001) } }, 'BOUND_VIOLATION'],
    [{ ...intent(), evidenceIds: evidenceIds.concat('memory:30000000-0000-4000-8000-000000000009') }, 'BOUND_VIOLATION'],
    [{ ...intent(), scope: { ...intent().scope, serialized: `CONVERSATION_SESSION:40000000-0000-4000-8000-000000000004` } }, 'SCOPE_SERIALIZATION_FAILED'],
    [{ ...intent(), evidenceIds: [evidenceIds[0], evidenceIds[0]] }, 'INVARIANT_REJECTED'],
    [{ ...intent(), domain: 'UNKNOWN' }, 'INVARIANT_REJECTED'],
  ] as const)('fails closed without repairing invariant-breaking authorized input %#', (input, reason) => {
    expect(service.assemble(input as never)).toEqual({ status: 'NOT_READY', reason });
  });

  it('is a pure zero-dependency, zero-query, zero-provider bridge', () => {
    expect(HypothesisGenerationRequestAssemblerService.length).toBe(0);
    expect(Object.keys(service)).toEqual([]);
    expect(service.assemble(intent())).toMatchObject({ status: 'READY' });
  });
});
