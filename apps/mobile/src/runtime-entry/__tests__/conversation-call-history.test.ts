/**
 * S8B-06 CP3 — the history's additive call field: a call reply's delivery state (S8B-05 CP2). It is optional (an exchange
 * without it decodes as before); a malformed value refuses the whole page, as every other field of this route does.
 */
import { decodeHistoryResponse } from '../conversation/conversation-turn-api';
import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';

function withFields(fields: Record<string, unknown>, replyState: 'COMPLETED' | 'FAILED' = 'COMPLETED') {
  const body = historyBody([exchange('hello', { replyState })]) as { exchanges: Record<string, unknown>[] };
  body.exchanges[0] = { ...body.exchanges[0], ...fields };
  return body;
}

describe('S8B-06 CP3 — the call field of the history', () => {
  it('an exchange without them decodes exactly as before', () => {
    const decoded = decodeHistoryResponse(withFields({}));
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && decoded.value.exchanges[0]).not.toHaveProperty('deliveryState');
  });

  it.each(['COMPLETE', 'INTERRUPTED', 'WITHHELD_TAIL', 'FAILED'] as const)('the delivery state %s rides beside a reply', (state) => {
    const decoded = decodeHistoryResponse(withFields({ deliveryState: state }));
    expect(decoded.ok && decoded.value.exchanges[0].deliveryState).toBe(state);
  });

  it('a delivery state without a reply, or not one of the four, refuses the page', () => {
    expect(decodeHistoryResponse(withFields({ deliveryState: 'COMPLETE' }, 'FAILED')).ok).toBe(false);
    expect(decodeHistoryResponse(withFields({ deliveryState: 'PARTIAL' })).ok).toBe(false);
    expect(decodeHistoryResponse(withFields({ deliveryState: 3 })).ok).toBe(false);
  });
});
