/**
 * S8A-05 CP2 — «شارك في العالم العام» / Share in Public World, from THIS conversation: the reader chooses, message by
 * message, what a Public topic is made from — the whole conversation, a contiguous part, separate whole messages, their
 * own words and QANDEEL's replies alike — and a private topic draft is created holding that choice.
 *
 * The choice is a REFERENCE only. It is proven with the S7-02 anchor proof (`../replay-entry/replay-anchors`): every
 * message named is a whole committed message at known Session Positions, read from the frozen committed-unit events and
 * never inferred from the list. What is sent is the range's two ends, the whole messages inside it that were left out,
 * and whether QANDEEL's replies are in — never a text, a speaker or an order. The server re-proves all of it.
 *
 * It READS the conversation and never writes it: cancelling returns to the live conversation unchanged. Nothing is
 * stored on the device and nothing is logged. Nothing here publishes: the draft is private, and opening it is the
 * composition's.
 */
import type { CommittedEventsResult, ConversationExchangeView, TemporalHeadResult } from '../runtime-entry';
import type { PublicComposeCreateResult, PublicComposeSourceChoice } from '../public-compose';
import { displayedMessageIds, proveAnchors, type AnchorProof } from '../replay-entry/replay-anchors';
import { MAX_TEMPORAL_EVENT_PAGE } from '../temporal';

/** The temporal reads the proof needs (the S7-02 `ReplayApiClient` satisfies it). */
export interface PublicShareTransport {
  liveHead(sessionId: string): Promise<TemporalHeadResult>;
  committedEvents(sessionId: string, afterSp?: number): Promise<CommittedEventsResult>;
}

export interface PublicShareConversation {
  getState(): { readonly exchanges: readonly ConversationExchangeView[] };
  subscribe(listener: () => void): () => void;
}

/**
 * NOTHING      — no message is chosen yet;
 * UNPROVABLE   — the conversation's messages could not be proven whole right now;
 * FAILED       — the draft could not be created (no definite answer);
 * REFUSED      — the account refused the choice (`refusal` says why).
 */
export type PublicShareProblem = 'NOTHING' | 'UNPROVABLE' | 'FAILED' | 'REFUSED';

export interface PublicShareState {
  readonly selecting: boolean;
  readonly proof: 'LOADING' | 'UNAVAILABLE' | AnchorProof | null;
  /** The chosen messages, by their own turn ids (lower case) — never list positions. */
  readonly chosen: ReadonlySet<string>;
  readonly busy: boolean;
  readonly problem: PublicShareProblem | null;
  readonly refusal: Extract<PublicComposeCreateResult, { kind: 'REFUSED' }>['outcome'] | null;
  /** The private draft just created, for the composition to open in Public World once (`takeHandoff`). */
  readonly handoff: string | null;
}

export interface PublicShareController {
  getState(): PublicShareState;
  subscribe(listener: () => void): () => void;
  open(): void;
  cancel(): void;
  toggle(messageId: string): void;
  chooseWhole(): void;
  /** Create the private draft from the choice; on success the selection closes and `handoff` names the draft. */
  proceed(): void;
  /** The composition took the hand-off: it is cleared. */
  takeHandoff(): void;
  retire(): void;
}

export interface PublicShareControllerOptions {
  readonly sessionId: string;
  readonly transport: PublicShareTransport;
  readonly conversation: PublicShareConversation;
  readonly isCurrent: () => boolean;
  /** Creates the draft holding the source (the Public compose controller's `createFromSource`). */
  readonly create: (choice: PublicComposeSourceChoice) => Promise<PublicComposeCreateResult>;
}

const MAX_PROOF_PAGES = 64;
const CLOSED: PublicShareState = Object.freeze({ selecting: false, proof: null, chosen: new Set<string>(), busy: false, problem: null, refusal: null, handoff: null });
const lower = (id: string) => id.toLowerCase();

/**
 * The reference a choice makes: the range from the first chosen message to the last, the whole messages inside it that
 * were not chosen, and whether QANDEEL's replies are in. `replies` names the reply messages. Pure.
 */
export function shareChoiceOf(proof: AnchorProof, chosen: ReadonlySet<string>, replies: ReadonlySet<string>) {
  const picked = proof.order.filter((turn) => chosen.has(turn));
  if (picked.length === 0) return null;
  const first = proof.blocks.get(picked[0])!.firstSp;
  const last = proof.blocks.get(picked[picked.length - 1])!.lastSp;
  const includeQandeelReplies = picked.some((turn) => replies.has(turn));
  const excludedMessagePositions = proof.order.filter((turn) => {
    const block = proof.blocks.get(turn)!;
    // A reply left out need not be named when no reply is in: the server leaves every reply out then.
    return block.firstSp >= first && block.lastSp <= last && !chosen.has(turn) && (includeQandeelReplies || !replies.has(turn));
  }).map((turn) => proof.blocks.get(turn)!.firstSp);
  return {
    sessionId: proof.sessionId, firstPosition: first, lastPosition: last, includeQandeelReplies, excludedMessagePositions,
    emphasizedMessagePositions: [] as number[],
  };
}

export function createPublicShareController({ sessionId, transport, conversation, isCurrent, create }: PublicShareControllerOptions): PublicShareController {
  const listeners = new Set<() => void>();
  let state: PublicShareState = CLOSED;
  let retired = false;
  let generation = 0;
  const live = () => !retired && isCurrent();
  const update = (patch: Partial<PublicShareState>) => {
    state = Object.freeze({ ...state, ...patch });
    if (!live()) return;
    for (const listener of Array.from(listeners)) listener();
  };

  async function loadProof(): Promise<AnchorProof | null> {
    const events: Array<Extract<CommittedEventsResult, { kind: 'READ' }>['events'][number]> = [];
    let cursor: number | undefined;
    for (let page = 0; page < MAX_PROOF_PAGES; page += 1) {
      const read = await transport.committedEvents(sessionId, cursor);
      if (read.kind !== 'READ') return null;
      events.push(...read.events);
      if (read.events.length < MAX_TEMPORAL_EVENT_PAGE) {
        const head = await transport.liveHead(sessionId);
        if (head.kind !== 'READ') return null;
        const proven = proveAnchors(sessionId, events, head.liveHead);
        return proven.ok ? proven.proof : null;
      }
      cursor = read.events[read.events.length - 1].lastSp;
    }
    return null;
  }

  const replies = () => new Set(conversation.getState().exchanges.flatMap((exchange) => (exchange.reply === null ? [] : [lower(exchange.reply.id)])));

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open() {
      if (state.selecting) return;
      generation += 1;
      const mine = generation;
      update({ ...CLOSED, selecting: true, proof: 'LOADING' });
      void loadProof().catch(() => null).then((proof) => {
        if (mine !== generation || !state.selecting) return;
        update(proof === null ? { proof: 'UNAVAILABLE', problem: 'UNPROVABLE' } : { proof });
      });
    },
    cancel() {
      generation += 1;
      update(CLOSED);
    },
    toggle(messageId) {
      const proof = state.proof;
      const id = lower(messageId);
      if (!state.selecting || state.busy || typeof proof !== 'object' || proof === null || !proof.blocks.has(id)) return;
      const chosen = new Set(state.chosen);
      if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
      update({ chosen, problem: null, refusal: null });
    },
    chooseWhole() {
      const proof = state.proof;
      if (!state.selecting || state.busy || typeof proof !== 'object' || proof === null) return;
      update({ chosen: new Set(proof.order), problem: null, refusal: null });
    },
    proceed() {
      const proof = state.proof;
      if (!state.selecting || state.busy || typeof proof !== 'object' || proof === null) return;
      const choice = shareChoiceOf(proof, state.chosen, replies());
      if (choice === null) { update({ problem: 'NOTHING' }); return; }
      const mine = generation;
      update({ busy: true, problem: null, refusal: null });
      void create({ kind: 'CONVERSATION', choice }).catch((): PublicComposeCreateResult => ({ kind: 'FAILED' })).then((result) => {
        if (mine !== generation) return;
        if (result.kind === 'CREATED') {
          generation += 1;
          update({ ...CLOSED, handoff: result.draftId });
          return;
        }
        update({ busy: false, problem: result.kind === 'REFUSED' ? 'REFUSED' : 'FAILED', refusal: result.kind === 'REFUSED' ? result.outcome : null });
      });
    },
    takeHandoff() {
      if (state.handoff !== null) update({ handoff: null });
    },
    retire() {
      retired = true;
      generation += 1;
      listeners.clear();
    },
  };
}

/** The displayed messages, in display order (re-exported for the selection's marks). */
export { displayedMessageIds };
