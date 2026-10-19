/**
 * S7-02 — the proof that a displayed message IS a whole historical message at known Session Positions.
 *
 * A message on the Conversation surface carries its turn id (`userTurn.id`, `reply.id`) and nothing temporal: the
 * exchange row is a presentation unit, and its place in the list is not a Session Position. The positions come from the
 * ONE existing source of that truth, the frozen T-03A2 committed-unit events
 * (`GET /conversation/sessions/:sessionId/temporal/events`), joined to the message by the event's own `sourceTurnId`:
 *
 *   - every event is one non-empty commitment batch of ONE turn, carrying exactly its units' positions
 *     (`firstSp .. lastSp`, migration 0065; pinned by `verify-migration-0065` "the event first_sp matches the stored
 *     batch");
 *   - a message is all the units of one turn (migration 0169 `resolve_personal_range_v1`: "a turn's units are one
 *     message"), so a message's block is the union of its turn's events.
 *
 * Nothing here infers a position. Not from a list index, not from a message count, not from "two positions per
 * exchange". A proof holds only when the events are this Session's, ascend without a gap from position 1 to the Live
 * Head the server reports, and keep each turn's units together. Anything else is no proof at all, and the selection
 * fails closed. The server re-proves every range on its own (`NOT_WHOLE_MESSAGES`, `UNAVAILABLE`); the client only
 * refuses to send a range it cannot prove.
 */
import type { ConversationalUnitsCommittedWireEvent } from '@qandeel/runtime';

import type { ConversationExchangeView } from '../runtime-entry';

/** One whole message's committed positions. */
export interface MessageBlock {
  readonly firstSp: number;
  readonly lastSp: number;
}

export interface AnchorProof {
  readonly sessionId: string;
  /** The Live Head the events reach: the newest committed position, still the conversation's OPEN head. */
  readonly liveHead: number;
  /** Turn id (lower case) → the message's whole block. */
  readonly blocks: ReadonlyMap<string, MessageBlock>;
  /** Turn ids in Session Position order. */
  readonly order: readonly string[];
  /** The events the proof was built from, kept so a later catch-up extends it instead of re-reading. */
  readonly events: readonly ConversationalUnitsCommittedWireEvent[];
}

export type AnchorProofResult =
  | { readonly ok: true; readonly proof: AnchorProof }
  /** No committed message exists yet: nothing can be selected. */
  | { readonly ok: false; readonly reason: 'EMPTY' }
  /** The events do not prove a whole-message timeline (foreign, out of order, a gap, a split turn, a stale head). */
  | { readonly ok: false; readonly reason: 'INCONSISTENT' };

/** A range the client may send: two Session Positions, and what they cover. */
export interface ProvenRange {
  readonly firstTc: number;
  readonly lastTc: number;
  /** How many whole messages the range covers, counted from the proof — never from what is loaded on screen. */
  readonly messageCount: number;
  /** The range reaches the open Live Head (frozen sealing law: its newest moment is not sealed yet). */
  readonly reachesOpenHead: boolean;
  /** The range is the complete committed conversation (positions 1 .. Live Head). */
  readonly whole: boolean;
}

export type MessageMark = 'IN' | 'OUT' | 'NONE';

export interface MessageSelectionMark {
  /** IN / OUT for a provable message; NONE for one that is not (yet) a whole historical message. */
  readonly mark: MessageMark;
  readonly joinAbove: boolean;
  readonly joinBelow: boolean;
}

const lower = (id: string) => id.toLowerCase();

/** The displayed messages, in display order: each exchange's own words, then QANDEEL's reply when it exists. */
export function displayedMessageIds(exchanges: readonly ConversationExchangeView[]): string[] {
  const ids: string[] = [];
  for (const exchange of exchanges) {
    ids.push(lower(exchange.userTurn.id));
    if (exchange.reply !== null) ids.push(lower(exchange.reply.id));
  }
  return ids;
}

/** Prove the events of `sessionId` against the Live Head the server reports. Pure. */
export function proveAnchors(
  sessionId: string,
  events: readonly ConversationalUnitsCommittedWireEvent[],
  liveHead: number | null,
): AnchorProofResult {
  if (liveHead === null) return events.length === 0 ? { ok: false, reason: 'EMPTY' } : { ok: false, reason: 'INCONSISTENT' };
  if (events.length === 0) return { ok: false, reason: 'INCONSISTENT' };
  const blocks = new Map<string, { firstSp: number; lastSp: number }>();
  const order: string[] = [];
  let expected = 1;
  let previousTurn: string | null = null;
  for (const event of events) {
    if (lower(event.sessionId) !== lower(sessionId) || event.firstSp !== expected || event.lastSp < event.firstSp
        || event.unitCount !== event.lastSp - event.firstSp + 1) {
      return { ok: false, reason: 'INCONSISTENT' };
    }
    const turn = lower(event.sourceTurnId);
    const held = blocks.get(turn);
    if (held !== undefined) {
      // A later batch of the same turn appends to it; a turn that reappears after another turn is not one whole block.
      if (previousTurn !== turn) return { ok: false, reason: 'INCONSISTENT' };
      held.lastSp = event.lastSp;
    } else {
      blocks.set(turn, { firstSp: event.firstSp, lastSp: event.lastSp });
      order.push(turn);
    }
    previousTurn = turn;
    expected = event.lastSp + 1;
  }
  if (expected - 1 !== liveHead) return { ok: false, reason: 'INCONSISTENT' };
  const frozen = new Map<string, MessageBlock>();
  for (const [turn, block] of blocks) frozen.set(turn, Object.freeze({ ...block }));
  return {
    ok: true,
    proof: Object.freeze({ sessionId: lower(sessionId), liveHead, blocks: frozen, order: Object.freeze(order), events: Object.freeze([...events]) }),
  };
}

/** The complete committed conversation: 1 .. Live Head, every message, whatever is loaded on screen. */
export function wholeRange(proof: AnchorProof): ProvenRange {
  return Object.freeze({ firstTc: 1, lastTc: proof.liveHead, messageCount: proof.order.length, reachesOpenHead: true, whole: true });
}

/**
 * The contiguous range from one displayed message to another, both inclusive, or `null` when it is not provable.
 *
 * Provable means: both ends are whole historical messages; and the messages the positions cover are EXACTLY the
 * provable messages displayed between the two ends — every one of them on screen, inside the two ends, and none
 * outside. A display that disagrees with the Session Position order around the range is refused, never reconciled.
 */
export function partRange(proof: AnchorProof, displayed: readonly string[], firstId: string, lastId: string): ProvenRange | null {
  const index = new Map<string, number>();
  displayed.forEach((id, i) => index.set(lower(id), i));
  let from = index.get(lower(firstId));
  let to = index.get(lower(lastId));
  if (from === undefined || to === undefined) return null;
  if (from > to) [from, to] = [to, from];
  const first = proof.blocks.get(displayed[from]);
  const last = proof.blocks.get(displayed[to]);
  if (first === undefined || last === undefined || first.firstSp > last.lastSp) return null;
  const covered = proof.order.filter((turn) => {
    const block = proof.blocks.get(turn)!;
    return block.firstSp >= first.firstSp && block.lastSp <= last.lastSp;
  });
  const coveredSet = new Set(covered);
  for (const turn of covered) {
    const at = index.get(turn);
    if (at === undefined || at < from || at > to) return null;
  }
  for (let i = from; i <= to; i += 1) {
    if (proof.blocks.has(displayed[i]) && !coveredSet.has(displayed[i])) return null;
  }
  return Object.freeze({
    firstTc: first.firstSp,
    lastTc: last.lastSp,
    messageCount: covered.length,
    reachesOpenHead: last.lastSp === proof.liveHead,
    whole: first.firstSp === 1 && last.lastSp === proof.liveHead,
  });
}

/** The displayed message whose block starts / ends at a position, if it is on screen (re-entry into a saved draft). */
export function displayedMessageAt(proof: AnchorProof, displayed: readonly string[], edge: 'first' | 'last', sp: number): string | null {
  for (const id of displayed) {
    const block = proof.blocks.get(id);
    if (block !== undefined && (edge === 'first' ? block.firstSp : block.lastSp) === sp) return id;
  }
  return null;
}

/**
 * The mark of every displayed message for a selection: the range (both inclusive, by display index) or the whole
 * conversation. A message that is not provable is NONE, and the range's joining line breaks around it: it is not part
 * of what will be saved, so it is never drawn as if it were.
 */
export function selectionMarks(
  proof: AnchorProof | null,
  displayed: readonly string[],
  selection: { readonly kind: 'WHOLE' } | { readonly kind: 'PART'; readonly firstId: string | null; readonly lastId: string | null },
): ReadonlyMap<string, MessageSelectionMark> {
  const anchored = (id: string) => proof !== null && proof.blocks.has(id);
  let from = -1;
  let to = -1;
  if (proof !== null) {
    if (selection.kind === 'WHOLE') {
      from = displayed.findIndex(anchored);
      for (let i = displayed.length - 1; i >= 0; i -= 1) if (anchored(displayed[i])) { to = i; break; }
    } else if (selection.firstId !== null && selection.lastId !== null) {
      const a = displayed.indexOf(lower(selection.firstId));
      const b = displayed.indexOf(lower(selection.lastId));
      if (a >= 0 && b >= 0) [from, to] = a <= b ? [a, b] : [b, a];
    }
  }
  const inside = (i: number) => from >= 0 && i >= from && i <= to;
  const marks = new Map<string, MessageSelectionMark>();
  displayed.forEach((id, i) => {
    const mark: MessageMark = !anchored(id) ? 'NONE' : inside(i) ? 'IN' : 'OUT';
    const joined = (j: number) => j >= 0 && j < displayed.length && inside(j) && anchored(displayed[j]);
    marks.set(id, Object.freeze({
      mark,
      joinAbove: mark === 'IN' && joined(i - 1),
      joinBelow: mark === 'IN' && joined(i + 1),
    }));
  });
  return marks;
}
