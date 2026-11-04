/**
 * S8B-06 CP3 (D-05-07 T1) — the Conversation's ONE transport, made call-aware. The conversation controller is unchanged:
 * it still sends one logical submission under its own key and reads the history; this transport decides only WHICH road
 * the words take.
 *
 *   - No call up: the ordinary turn route, exactly as before (the server itself refuses a REST turn during a live call).
 *   - A call up: the call carries it (TEXT_TURN on the call's channel); the answer is the conversation's ordinary outcome.
 *     A message the call proved it did not carry (it ended first, and its truth and history say so) takes the ordinary
 *     route then, under the same submission key — once.
 *   - A committed call turn has the server's `live-call:` key, which the turn route never admits: the controller's re-check
 *     of such a PENDING turn is answered from the history and never issued as a new turn.
 */
import type { ConversationTransport } from '../conversation/conversation-controller';
import { LIVE_CALL_KEY_PREFIX, type CallOwner } from './call-owner';

export function createCallAwareConversationTransport(base: ConversationTransport, owner: Pick<CallOwner, 'carryText'>): ConversationTransport {
  return {
    readHistory: (sessionId, options) => base.readHistory(sessionId, options),
    async submitTurn(sessionId, submission) {
      if (submission.idempotencyKey.startsWith(LIVE_CALL_KEY_PREFIX)) {
        const read = await base.readHistory(sessionId);
        const found = read.kind === 'PAGE' ? read.page.exchanges.find((exchange) => exchange.userTurn.idempotencyKey === submission.idempotencyKey) : undefined;
        return found === undefined ? { kind: 'NOT_ISSUED' } : { kind: 'ANSWERED', exchange: found };
      }
      const carried = owner.carryText(submission);
      if (carried === null) return base.submitTurn(sessionId, submission);
      const outcome = await carried;
      return outcome.kind === 'WRITE_NORMALLY' ? base.submitTurn(sessionId, submission) : outcome;
    },
  };
}
