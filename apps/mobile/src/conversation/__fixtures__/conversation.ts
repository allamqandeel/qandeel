/**
 * W1A-01 — test scaffolding for the Conversation owner. FIXTURE ONLY.
 *
 * Every conversational string below is fixture text for tests. None of it is Product copy, none of
 * it is reachable from the Product route, and the W1A-01 contract proves this directory is outside
 * the production import closure.
 */
import type {
  ConversationExchangeView,
  ConversationHistoryOutcome,
  ConversationHistoryPageView,
  ConversationSubmitOutcome,
  ConversationTurnSubmission,
} from '../../runtime-entry';
import type { ConversationTransport } from '../conversation-controller';

let counter = 0;
const nextId = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};
const at = (n: number) => `2026-09-28T10:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}.000000+00:00`;

export function exchange(
  content: string,
  options: { key?: string | null; replyState?: 'COMPLETED' | 'FAILED' | 'PENDING'; reply?: string; order?: number } = {},
): ConversationExchangeView {
  const order = options.order ?? counter + 1;
  const userId = nextId();
  const replyState = options.replyState ?? 'COMPLETED';
  return {
    userTurn: { id: userId, content, idempotencyKey: options.key === undefined ? `fixture-key-${order}` : options.key, createdAt: at(order) },
    replyState,
    reply: replyState === 'COMPLETED' ? { id: nextId(), content: options.reply ?? `fixture reply to: ${content}`, createdAt: at(order) } : null,
  };
}

/** The POST route's raw body for one exchange, exactly as the API serializes its rows. */
export function submitBody(view: ConversationExchangeView, sessionId: string, userStatus?: string): unknown {
  const status = userStatus ?? (view.replyState === 'COMPLETED' ? 'COMPLETED' : view.replyState === 'FAILED' ? 'FAILED' : 'GENERATING');
  return {
    userTurn: {
      id: view.userTurn.id, session_id: sessionId, role: 'USER', status, content: view.userTurn.content,
      processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', source_turn_id: null,
      idempotency_key: view.userTurn.idempotencyKey, created_at: view.userTurn.createdAt, updated_at: 'now', completed_at: null,
    },
    ...(view.reply === null ? {} : {
      assistantTurn: {
        id: view.reply.id, session_id: sessionId, role: 'ASSISTANT', status: 'COMPLETED', content: view.reply.content,
        processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', source_turn_id: view.userTurn.id,
        idempotency_key: null, created_at: view.reply.createdAt, updated_at: 'now', completed_at: 'now',
      },
    }),
  };
}

/** The GET route's raw body for one page. */
export function historyBody(exchanges: readonly ConversationExchangeView[], hasOlder = false): unknown {
  return {
    exchanges: exchanges.map((view) => ({
      userTurn: { id: view.userTurn.id, content: view.userTurn.content, idempotencyKey: view.userTurn.idempotencyKey, createdAt: view.userTurn.createdAt },
      replyState: view.replyState,
      assistantTurn: view.reply === null ? null : { id: view.reply.id, content: view.reply.content, createdAt: view.reply.createdAt },
    })),
    hasOlder,
  };
}

export interface ScriptedTransport extends ConversationTransport {
  readonly submissions: { sessionId: string; submission: ConversationTurnSubmission }[];
  readonly reads: { sessionId: string; before?: string }[];
  /** Answer the NEXT submit with this outcome (FIFO). Unanswered submits stay pending. */
  answerSubmit(outcome: ConversationSubmitOutcome): void;
  answerRead(outcome: ConversationHistoryOutcome): void;
  /** How many submits / reads are still waiting for an answer. */
  pending(): { submits: number; reads: number };
}

/** A transport whose every answer the test decides, in order. Nothing resolves by itself. */
export function scriptedTransport(): ScriptedTransport {
  const submissions: ScriptedTransport['submissions'] = [];
  const reads: ScriptedTransport['reads'] = [];
  const waitingSubmits: ((outcome: ConversationSubmitOutcome) => void)[] = [];
  const waitingReads: ((outcome: ConversationHistoryOutcome) => void)[] = [];
  return {
    submissions,
    reads,
    submitTurn(sessionId, submission) {
      submissions.push({ sessionId, submission });
      return new Promise((resolve) => waitingSubmits.push(resolve));
    },
    readHistory(sessionId, options = {}) {
      reads.push({ sessionId, ...(options.before === undefined ? {} : { before: options.before }) });
      return new Promise((resolve) => waitingReads.push(resolve));
    },
    answerSubmit(outcome) {
      const next = waitingSubmits.shift();
      if (next === undefined) throw new Error('no submit is waiting for an answer');
      next(outcome);
    },
    answerRead(outcome) {
      const next = waitingReads.shift();
      if (next === undefined) throw new Error('no read is waiting for an answer');
      next(outcome);
    },
    pending: () => ({ submits: waitingSubmits.length, reads: waitingReads.length }),
  };
}

export const page = (exchanges: readonly ConversationExchangeView[], hasOlder = false): ConversationHistoryOutcome => ({
  kind: 'PAGE',
  page: { exchanges, hasOlder } as ConversationHistoryPageView,
});

/** Let every queued promise continuation run. */
export const flush = async (): Promise<void> => {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
};
