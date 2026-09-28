/**
 * W1A-01 — the Conversation presentation owner for ONE runtime generation and ONE Session.
 *
 * It holds what the Conversation surface shows and nothing that is Product truth elsewhere: the
 * conversation-so-far as the server last reported it, the composer's text, and the one logical
 * submission that may be unresolved. It is not a canonical store, not a second semantic world and
 * not persistence. The Analysis world learns about a new reply only through the existing live
 * catch-up seam (`onReplyCommitted`), never through this object.
 *
 * ## The send rules it enforces (Product Owner, W1A-01 §3)
 *
 *   - ONE logical submission at a time. While it is unresolved the composer is locked and nothing
 *     else can be sent.
 *   - The reader's words stay in the composer until the server CONFIRMS the committed turn. They
 *     are never shown as a committed utterance before that, because the utterance role means
 *     committed human words.
 *   - ONE idempotency key per logical submission, minted when the reader presses Send and never
 *     reused for different words. "Try again" after an unconfirmed outcome re-issues the SAME words
 *     under the SAME key, which the server resolves to the same turn, so it cannot duplicate.
 *   - A committed turn whose reply FAILED stays in the conversation with its failure and has NO
 *     retry here: the frozen turn-state machine makes FAILED terminal and forbids a replacement
 *     turn, so reply retry is outside W1A-01.
 *   - No automatic repetition of a submission. An ambiguous outcome is first RESOLVED BY READING
 *     the history (which admits nothing): a turn found under this submission's key is the answer.
 *     The single automatic request this owner ever sends on its own is the same-key replay of a
 *     turn that reading has ALREADY shown COMPLETED — the server's explicitly supported, idempotent
 *     re-entry into post-finalization establishment, which cannot generate or admit anything.
 */
import type {
  ConversationExchangeView,
  ConversationHistoryOutcome,
  ConversationSubmitOutcome,
  ConversationTurnSubmission,
} from '../runtime-entry';

/** The transport this owner needs. Production passes the T-12P `ConversationTurnApiClient`. */
export interface ConversationTransport {
  submitTurn(sessionId: string, submission: ConversationTurnSubmission): Promise<ConversationSubmitOutcome>;
  readHistory(sessionId: string, options?: { readonly before?: string }): Promise<ConversationHistoryOutcome>;
}

/**
 * The phase of the one logical submission.
 *
 *   AWAITING    — issued; the server has not answered yet. Composer locked, waiting line shown.
 *   UNCONFIRMED — no answer could confirm whether the words were admitted. The words stay in the
 *                 locked composer, the approved unconfirmed line is shown, and "Try again" re-issues
 *                 the SAME submission.
 */
export type SubmissionPhase = 'AWAITING' | 'UNCONFIRMED';

export interface PendingSubmission {
  readonly content: string;
  readonly key: string;
  readonly phase: SubmissionPhase;
}

/** Where the first read of the conversation-so-far stands. */
export type HistoryStatus = 'LOADING' | 'READY' | 'UNAVAILABLE';

export interface ConversationPresentationState {
  readonly history: HistoryStatus;
  /** The conversation-so-far, oldest to newest, one entry per committed user turn. */
  readonly exchanges: readonly ConversationExchangeView[];
  readonly hasOlder: boolean;
  readonly loadingOlder: boolean;
  /** The composer's text. While a submission is unresolved it is that submission's words. */
  readonly draft: string;
  readonly submission: PendingSubmission | null;
}

export interface ConversationController {
  getState(): ConversationPresentationState;
  subscribe(listener: () => void): () => void;
  /** Read the conversation-so-far once. Idempotent; a later call only refreshes the newest page. */
  ensureHistory(): void;
  /** Re-read the history after it failed to load (the approved "Try again" of that state). */
  retryHistory(): void;
  /** Read the next older page, when there is one and none is in flight. */
  loadOlder(): void;
  setDraft(text: string): void;
  /** Send the composer's words as ONE new logical submission. Refused while one is unresolved. */
  send(): void;
  /** Re-issue the unconfirmed submission, same words and same key. Refused in any other phase. */
  retrySubmission(): void;
  /** Retire with the runtime generation. Every later outcome is dropped. */
  retire(): void;
}

export interface ConversationControllerOptions {
  readonly sessionId: string;
  readonly transport: ConversationTransport;
  /** The runtime generation's own liveness check. An answer arriving after retirement changes nothing. */
  readonly isCurrent: () => boolean;
  /** A reply was committed: ask the Analysis owners to catch up now. Never a second store writer. */
  readonly onReplyCommitted: () => void;
  /** Mints a submission key. Injectable so a test can name keys; production uses the default. */
  readonly newSubmissionKey?: () => string;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/** The largest submission the server admits (`validateTurnInput`). The composer never exceeds it. */
export const MAX_SUBMISSION_LENGTH = 20000;

/**
 * How long a submission is waited for before it is treated as unconfirmed.
 *
 * This is the frozen server generation lease (migration 0039, 120 seconds): past it, the server
 * itself stops treating the generation as live. The platform HTTP stacks set no response timeout
 * of their own, so without this a dropped connection would keep the composer locked indefinitely.
 * A late answer that arrives afterwards is still authoritative and is still applied.
 */
export const SUBMISSION_CONFIRMATION_WINDOW_MS = 120_000;

/**
 * A submission key: unique per logical submission within the Session, never a credential and never
 * a Session identity. It carries no reader data, so it is safe in presentation state.
 */
export function mintSubmissionKey(): string {
  const random = () => Math.floor(Math.random() * 0x100000000).toString(36).padStart(7, '0');
  return `w1a-${Date.now().toString(36)}-${random()}${random()}${random()}`;
}

const compareExchanges = (a: ConversationExchangeView, b: ConversationExchangeView): number => {
  if (a.userTurn.createdAt !== b.userTurn.createdAt) return a.userTurn.createdAt < b.userTurn.createdAt ? -1 : 1;
  if (a.userTurn.id === b.userTurn.id) return 0;
  return a.userTurn.id < b.userTurn.id ? -1 : 1;
};

/** Merge server-reported exchanges into the held ones. The newer report of the same turn wins. */
function mergeExchanges(held: readonly ConversationExchangeView[], incoming: readonly ConversationExchangeView[]): ConversationExchangeView[] {
  const byId = new Map<string, ConversationExchangeView>();
  for (const exchange of held) byId.set(exchange.userTurn.id, exchange);
  for (const exchange of incoming) byId.set(exchange.userTurn.id, exchange);
  return [...byId.values()].sort(compareExchanges);
}

export function createConversationController(options: ConversationControllerOptions): ConversationController {
  const { sessionId, transport, isCurrent, onReplyCommitted } = options;
  const newKey = options.newSubmissionKey ?? mintSubmissionKey;
  const setTimer = options.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let state: ConversationPresentationState = Object.freeze({
    history: 'LOADING',
    exchanges: Object.freeze([]),
    hasOlder: false,
    loadingOlder: false,
    draft: '',
    submission: null,
  });
  const listeners = new Set<() => void>();
  let retired = false;
  let historyRequested = false;
  let historyInFlight = false;
  let confirmationTimer: unknown = null;

  const live = () => !retired && isCurrent();

  function update(patch: Partial<ConversationPresentationState>): void {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of Array.from(listeners)) listener();
  }

  function stopConfirmationWindow(): void {
    if (confirmationTimer !== null) clearTimer(confirmationTimer);
    confirmationTimer = null;
  }

  /** Is `key` still the unresolved submission? Every late answer is checked against this. */
  const owns = (key: string) => state.submission !== null && state.submission.key === key;

  /** The server confirmed the committed turn: it becomes history and the composer is freed. */
  function commit(key: string, exchange: ConversationExchangeView): void {
    if (!owns(key)) return;
    stopConfirmationWindow();
    update({ exchanges: mergeExchanges(state.exchanges, [exchange]), submission: null, draft: '' });
    if (exchange.replyState === 'COMPLETED') onReplyCommitted();
  }

  /**
   * The explicitly supported recovery of already-COMPLETED work: re-enter post-finalization
   * establishment with the same key. Fire-and-forget; its answer can only confirm what is shown.
   */
  function reenterEstablishment(content: string, key: string): void {
    void transport.submitTurn(sessionId, { content, idempotencyKey: key }).then((outcome) => {
      if (!live()) return;
      if (outcome.kind === 'ANSWERED') {
        update({ exchanges: mergeExchanges(state.exchanges, [outcome.exchange]) });
        if (outcome.exchange.replyState === 'COMPLETED') onReplyCommitted();
      }
    });
  }

  /** Resolve an ambiguous outcome by READING. Admits nothing; repeats nothing. */
  async function reconcile(content: string, key: string): Promise<void> {
    const read = await transport.readHistory(sessionId);
    if (!live() || !owns(key)) return;
    if (read.kind === 'PAGE') {
      const found = read.page.exchanges.find((exchange) => exchange.userTurn.idempotencyKey === key);
      if (found !== undefined) {
        update({ exchanges: mergeExchanges(state.exchanges, read.page.exchanges) });
        commit(key, found);
        if (found.replyState === 'COMPLETED') reenterEstablishment(content, key);
        return;
      }
    }
    stopConfirmationWindow();
    update({ submission: { content, key, phase: 'UNCONFIRMED' } });
  }

  function apply(content: string, key: string, outcome: ConversationSubmitOutcome): void {
    if (!live() || !owns(key)) return;
    switch (outcome.kind) {
      case 'ANSWERED':
        commit(key, outcome.exchange);
        return;
      case 'REFUSED':
      case 'NOT_ISSUED':
        // Refused before admission: nothing was committed. The words go back to the reader,
        // editable, and the submission is over. (No approved wording exists for this state, so it
        // speaks none — see the implementation record.)
        stopConfirmationWindow();
        update({ submission: null, draft: content });
        return;
      case 'OUTCOME_UNKNOWN':
        void reconcile(content, key);
        return;
    }
  }

  function issue(content: string, key: string): void {
    update({ submission: { content, key, phase: 'AWAITING' }, draft: content });
    stopConfirmationWindow();
    confirmationTimer = setTimer(() => {
      confirmationTimer = null;
      if (!live() || !owns(key) || state.submission?.phase !== 'AWAITING') return;
      void reconcile(content, key);
    }, SUBMISSION_CONFIRMATION_WINDOW_MS);
    void transport.submitTurn(sessionId, { content, idempotencyKey: key }).then((outcome) => apply(content, key, outcome));
  }

  function readNewest(): void {
    if (historyInFlight) return;
    historyInFlight = true;
    void transport.readHistory(sessionId).then((read) => {
      historyInFlight = false;
      if (!live()) return;
      if (read.kind === 'PAGE') {
        const first = state.history !== 'READY';
        update({
          history: 'READY',
          exchanges: mergeExchanges(state.exchanges, read.page.exchanges),
          // Only the first page decides whether older turns exist; a refresh never hides them.
          hasOlder: first ? read.page.hasOlder : state.hasOlder,
        });
      } else if (state.history !== 'READY') {
        update({ history: 'UNAVAILABLE' });
      }
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ensureHistory() {
      if (!live()) return;
      historyRequested = true;
      readNewest();
    },
    retryHistory() {
      if (!live() || !historyRequested || state.history !== 'UNAVAILABLE') return;
      update({ history: 'LOADING' });
      readNewest();
    },
    loadOlder() {
      if (!live() || !state.hasOlder || state.loadingOlder || state.exchanges.length === 0) return;
      const before = state.exchanges[0].userTurn.id;
      update({ loadingOlder: true });
      void transport.readHistory(sessionId, { before }).then((read) => {
        if (!live()) return;
        if (read.kind === 'PAGE') {
          update({ loadingOlder: false, hasOlder: read.page.hasOlder, exchanges: mergeExchanges(state.exchanges, read.page.exchanges) });
        } else {
          // Nothing to say: the held conversation is still true, and scrolling up asks again.
          update({ loadingOlder: false });
        }
      });
    },
    setDraft(text) {
      if (!live() || state.submission !== null) return;
      update({ draft: text.length > MAX_SUBMISSION_LENGTH ? text.slice(0, MAX_SUBMISSION_LENGTH) : text });
    },
    send() {
      if (!live() || state.submission !== null) return;
      const content = state.draft;
      if (content.trim().length === 0 || content.length > MAX_SUBMISSION_LENGTH) return;
      issue(content, newKey());
    },
    retrySubmission() {
      if (!live() || state.submission === null || state.submission.phase !== 'UNCONFIRMED') return;
      const { content, key } = state.submission;
      issue(content, key);
    },
    retire() {
      if (retired) return;
      retired = true;
      stopConfirmationWindow();
      listeners.clear();
    },
  };
}
