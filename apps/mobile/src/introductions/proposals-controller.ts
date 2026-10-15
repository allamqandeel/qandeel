/**
 * S6-04 — a human's own private Introduction proposals («مقترحات التعارف»), for ONE runtime generation.
 *
 * It holds exactly what the server answered — the proposals delivered to this human, each an opaque identity, a neutral
 * status and the decisions the server offers now — and nothing it has not been told. No identity, credential or
 * persistence of its own: the integration owner builds one per runtime generation and retires it with the generation, so
 * nothing of one account reaches the next.
 *
 *   - Reads happen when asked (the entry when the Personal world is drawn; the space when it is opened). Nothing polls.
 *   - A decision is offered only when the server offered it, and is bound to the exact view the human was shown; the
 *     server decides it under its own lock. A decision on a view that changed decides nothing, and the latest answer is
 *     shown with a calm notice — never re-applied.
 *   - A decision whose answer was lost is retried with the SAME command id, so the server decides it once.
 *   - One decision at a time.
 */
import type { PrivateProposal, ProposalAction, ProposalDecision, ProposalDecisionKind, ProposalsRead } from '../runtime-entry';
import { mintIntroductionsCommandId } from './introductions-controller';

export type ProposalsNotice = 'RECORDED_DECLINE' | 'RECORDED_WITHDRAW' | 'CHANGED' | 'UNAVAILABLE' | 'NOT_NOW' | 'FAILED' | 'INVALID' | null;

export interface ProposalsState {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE' | 'OFFLINE';
  readonly proposals: readonly PrivateProposal[];
  /** The cursor of the next page, or null when the list is complete. */
  readonly next: string | null;
  readonly loadingMore: boolean;
  readonly busy: boolean;
  readonly notice: ProposalsNotice;
}

export interface ProposalsTransport {
  list(after: string | null): Promise<ProposalsRead>;
  decide(kind: ProposalDecisionKind, proposalId: string, commandId: string, viewId: string): Promise<ProposalDecision>;
}

export interface ProposalsController {
  getState(): ProposalsState;
  subscribe(listener: () => void): () => void;
  /** Read the first page afresh. */
  refresh(): void;
  /** Read the next page, when there is one. */
  more(): void;
  /** One offered decision on one proposal, bound to the view the human was shown. */
  decide(proposalId: string, action: ProposalAction): Promise<boolean>;
  dismissNotice(): void;
  retire(): void;
}

export interface ProposalsControllerOptions {
  readonly transport: ProposalsTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}

const KIND: Readonly<Record<ProposalAction, ProposalDecisionKind>> = Object.freeze({
  APPROVE_FORWARD: 'forward-approval', DECLINE: 'decline', WITHDRAW: 'withdrawal',
});

const INITIAL: ProposalsState = Object.freeze({ status: 'IDLE', proposals: Object.freeze([]), next: null, loadingMore: false, busy: false, notice: null });

/** Whether any delivered proposal waits for this human: the one quiet in-app cue (D11). Never a count. */
export const awaitsDecision = (state: ProposalsState): boolean => state.proposals.some((p) => p.status === 'AWAITING_YOU');

export function createProposalsController({ transport, isCurrent, newCommandId = mintIntroductionsCommandId }: ProposalsControllerOptions): ProposalsController {
  let state = INITIAL;
  let retired = false;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();
  const set = (next: Partial<ProposalsState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of listeners) listener();
  };
  let reads = 0;
  /** The last decision whose answer was lost: retried with the same id when the human repeats exactly that decision. */
  let pending: { readonly key: string; readonly id: string } | null = null;

  const replace = (proposalId: string, proposal: PrivateProposal): readonly PrivateProposal[] =>
    Object.freeze(state.proposals.map((p) => (p.proposalId === proposalId ? proposal : p)));

  const refresh = () => {
    const read = ++reads;
    set({ status: state.status === 'READY' ? 'READY' : 'LOADING', loadingMore: false });
    void transport.list(null).then((answer) => {
      if (read !== reads) return;
      if (answer.kind === 'READ') set({ status: 'READY', proposals: Object.freeze([...answer.proposals]), next: answer.next });
      // A failed read shows nothing it cannot vouch for: no earlier page stays on screen with its decisions.
      else set({ status: answer.kind, proposals: INITIAL.proposals, next: null });
    });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    more() {
      if (state.next === null || state.loadingMore || state.status !== 'READY') return;
      const read = reads;
      const after = state.next;
      set({ loadingMore: true });
      void transport.list(after).then((answer) => {
        if (read !== reads) return;
        if (answer.kind !== 'READ') {
          set({ loadingMore: false, notice: answer.kind === 'OFFLINE' ? 'FAILED' : 'UNAVAILABLE' });
          return;
        }
        const known = new Set(state.proposals.map((p) => p.proposalId));
        set({ loadingMore: false, next: answer.next, proposals: Object.freeze([...state.proposals, ...answer.proposals.filter((p) => !known.has(p.proposalId))]) });
      });
    },
    async decide(proposalId, action) {
      const shown = state.proposals.find((p) => p.proposalId === proposalId);
      if (state.busy || !live() || shown === undefined || !shown.actions.includes(action)) return false;
      const key = `${action}|${proposalId}|${shown.viewId}`;
      const id = pending !== null && pending.key === key ? pending.id : newCommandId();
      pending = { key, id };
      // A read already in flight answers about the time before this decision: it is dropped, never laid over its answer.
      reads += 1;
      set({ busy: true, notice: null, loadingMore: false });
      const answer = await transport.decide(KIND[action], proposalId, id, shown.viewId);
      if (!live()) return false;
      if (answer.kind === 'FAILED') {
        set({ busy: false, notice: 'FAILED' });
        return false;
      }
      pending = null;
      if (answer.kind === 'INVALID') {
        set({ busy: false, notice: 'INVALID' });
        return false;
      }
      const notice: ProposalsNotice = answer.outcome === 'RECORDED'
        ? (action === 'DECLINE' ? 'RECORDED_DECLINE' : action === 'WITHDRAW' ? 'RECORDED_WITHDRAW' : null)
        : answer.outcome === 'NOT_AVAILABLE_NOW' ? 'NOT_NOW'
          : answer.outcome === 'UNAVAILABLE' ? 'UNAVAILABLE'
            : 'CHANGED';
      if (answer.proposal === null) {
        // The decision's answer stands; what the human may see now was not read with it, so the list is read again.
        set({ busy: false, notice });
        refresh();
      } else {
        set({ busy: false, proposals: replace(proposalId, answer.proposal), notice });
      }
      return answer.outcome === 'RECORDED';
    },
    dismissNotice() {
      set({ notice: null });
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
