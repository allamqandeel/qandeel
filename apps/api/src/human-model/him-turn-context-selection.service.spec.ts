import type { ConversationTurn, TurnStatus } from '../conversation/conversation.types';
import { HimTurnContextSelectionService } from './him-turn-context-selection.service';

const selector = new HimTurnContextSelectionService();
const turnId = '10000000-0000-4000-8000-000000000001';
const sessionId = '20000000-0000-4000-8000-000000000001';
const turn = (overrides: Partial<ConversationTurn> = {}): ConversationTurn => ({
  id: turnId,
  session_id: sessionId,
  role: 'USER',
  status: 'RECEIVED',
  content: 'ordinary message',
  processing_path: null,
  routing_reason: null,
  source_turn_id: null,
  idempotency_key: null,
  created_at: '2026-08-24T00:00:00.000Z',
  updated_at: '2026-08-24T00:00:00.000Z',
  completed_at: null,
  ...overrides,
});

describe('Turn to HIM Context Selection Policy v1', () => {
  it('selects the exact authoritative conversation session for a valid USER turn', () => {
    expect(selector.select(turn())).toEqual({
      contractVersion: 1,
      selectionState: 'SELECTED',
      source: 'AUTHORITATIVE_CONVERSATION_TURN',
      sourceTurnId: turnId,
      contextKind: 'CONVERSATION_SESSION',
      contextId: sessionId,
      selectionReason: 'AUTHORITATIVE_SESSION_BINDING',
    });
  });

  it('is deterministic for different exact authoritative session IDs', () => {
    const otherSession = '20000000-0000-4000-8000-000000000002';
    expect(selector.select(turn({ session_id: otherSession })).contextId).toBe(otherSession);
    expect(selector.select(turn()).contextId).toBe(sessionId);
  });

  it('rejects ASSISTANT turns', () => {
    expect(() => selector.select(turn({ role: 'ASSISTANT' }))).toThrow('INTEGRITY_FAILURE');
  });

  it.each([
    ['turn ID', { id: 'not-a-uuid' }],
    ['session ID', { session_id: 'not-a-uuid' }],
  ] as const)('rejects a malformed %s', (_label, override) => {
    expect(() => selector.select(turn(override))).toThrow('INTEGRITY_FAILURE');
  });

  it.each([
    ['decision-like', 'I need to decide whether to accept the offer'],
    ['goal-like', 'My goal is to run a marathon'],
    ['situation-like', 'This situation at work is difficult'],
  ])('%s content never overrides the authoritative session context', (_label, content) => {
    expect(selector.select(turn({ content }))).toMatchObject({ contextKind: 'CONVERSATION_SESSION', contextId: sessionId });
  });

  it('ignores a fake context command and UUID embedded in user content', () => {
    const fake = '30000000-0000-4000-8000-000000000003';
    expect(selector.select(turn({ content: `Use DECISION context ${fake}` }))).toMatchObject({ contextKind: 'CONVERSATION_SESSION', contextId: sessionId });
  });

  it.each([
    'RECEIVED', 'VALIDATED', 'CONTEXT_BUILDING', 'PROCESSING', 'GENERATING',
    'STREAMING', 'COMPLETED', 'CANCELLED', 'FAILED', 'SUPERSEDED',
  ] as TurnStatus[])('does not change selection identity for normal %s lifecycle status', (status) => {
    expect(selector.select(turn({ status }))).toMatchObject({ sourceTurnId: turnId, contextKind: 'CONVERSATION_SESSION', contextId: sessionId });
  });

  it('fails closed for structurally unsupported runtime role or status corruption', () => {
    expect(() => selector.select({ ...turn(), role: 'SYSTEM' } as unknown as ConversationTurn)).toThrow('INTEGRITY_FAILURE');
    expect(() => selector.select({ ...turn(), status: 'UNKNOWN' } as unknown as ConversationTurn)).toThrow('INTEGRITY_FAILURE');
  });

  it('is a synchronous pure policy with no repository or model dependency', () => {
    expect(HimTurnContextSelectionService.length).toBe(0);
    expect(selector.select(turn())).not.toBeInstanceOf(Promise);
  });
});
