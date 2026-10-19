/**
 * S7-02 — a displayed message maps to its ACTUAL historical positions, from the committed-unit events only; anything
 * the events cannot prove is refused, never reconciled.
 */
import { exchange } from '../../conversation/__fixtures__/conversation';
import { displayedMessageAt, displayedMessageIds, partRange, proveAnchors, selectionMarks, wholeRange, type AnchorProof } from '../replay-anchors';
import { OTHER_SESSION, SESSION, headOf, timeline, turnEvent } from '../__fixtures__/replay';

const proven = (events: ReturnType<typeof timeline>, head = headOf(events)): AnchorProof => {
  const result = proveAnchors(SESSION, events, head);
  if (!result.ok) throw new Error(`expected a proof, got ${result.reason}`);
  return result.proof;
};

describe('S7-02 — the proof is built from the events, never from the list', () => {
  const history = [exchange('one'), exchange('two'), exchange('three')];
  // Uneven sizes: a message's size is the server's, so no "two positions per exchange" can be assumed.
  const sizes = new Map<string, number>([[history[0].userTurn.id, 1], [history[0].reply!.id, 4], [history[1].userTurn.id, 3]]);
  const events = timeline(history, { units: (id) => sizes.get(id) ?? 2 });

  it('maps each message to its own block of positions, in Session Position order', () => {
    const proof = proven(events);
    expect(proof.blocks.get(history[0].userTurn.id)).toEqual({ firstSp: 1, lastSp: 1 });
    expect(proof.blocks.get(history[0].reply!.id)).toEqual({ firstSp: 2, lastSp: 5 });
    expect(proof.blocks.get(history[1].userTurn.id)).toEqual({ firstSp: 6, lastSp: 8 });
    expect(proof.order).toEqual(displayedMessageIds(history));
    expect(proof.liveHead).toBe(14);
  });

  it('the whole conversation is 1 .. Live Head, counted from the proof — not from what is loaded on screen', () => {
    const proof = proven(events);
    expect(wholeRange(proof)).toEqual({ firstTc: 1, lastTc: 14, messageCount: 6, reachesOpenHead: true, whole: true });
  });

  it('joins several batches of one turn into one message', () => {
    const [a, b] = [exchange('a'), exchange('b')];
    const split = [turnEvent(a.userTurn.id, 1, 2), turnEvent(a.userTurn.id, 3, 3), turnEvent(a.reply!.id, 4, 5), ...timeline([b], { from: 6 })];
    const proof = proven(split);
    expect(proof.blocks.get(a.userTurn.id)).toEqual({ firstSp: 1, lastSp: 3 });
    expect(proof.order).toHaveLength(4);
  });

  it('a conversation with nothing committed is EMPTY', () => {
    expect(proveAnchors(SESSION, [], null)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it.each([
    ['another Session’s event', () => [turnEvent('x', 1, 2, OTHER_SESSION)], 2],
    ['a missing event (a gap)', () => [turnEvent('x', 1, 2), turnEvent('y', 4, 5)], 5],
    ['not starting at position 1', () => [turnEvent('x', 2, 3)], 3],
    ['a unit count that disagrees with its positions', () => [{ ...turnEvent('x', 1, 3), unitCount: 2 }], 3],
    ['a turn that reappears after another turn', () => [turnEvent('x', 1, 1), turnEvent('y', 2, 2), turnEvent('x', 3, 3)], 3],
    ['a Live Head beyond the last event', () => [turnEvent('x', 1, 2)], 3],
    ['a Live Head behind the last event', () => [turnEvent('x', 1, 2)], 1],
    ['events with no Live Head', () => [turnEvent('x', 1, 2)], null],
    ['a Live Head with no events', () => [], 2],
  ])('%s is no proof', (_name, make, head) => {
    expect(proveAnchors(SESSION, make(), head as number | null)).toEqual({ ok: false, reason: 'INCONSISTENT' });
  });
});

describe('S7-02 — a part is one contiguous range of whole, provable messages', () => {
  const history = [exchange('h1'), exchange('h2'), exchange('h3'), exchange('h4')];
  const proof = proven(timeline(history));
  const ids = displayedMessageIds(history);

  it('first and last message, everything between, both inclusive — in either tap order', () => {
    const forward = partRange(proof, ids, history[1].userTurn.id, history[2].reply!.id);
    expect(forward).toEqual({ firstTc: 5, lastTc: 12, messageCount: 4, reachesOpenHead: false, whole: false });
    expect(partRange(proof, ids, history[2].reply!.id, history[1].userTurn.id)).toEqual(forward);
  });

  it('one message is a part of its own', () => {
    expect(partRange(proof, ids, history[0].reply!.id, history[0].reply!.id)).toEqual({ firstTc: 3, lastTc: 4, messageCount: 1, reachesOpenHead: false, whole: false });
  });

  it('a part that ends at the newest message reaches the open head; first to last is the whole conversation', () => {
    expect(partRange(proof, ids, history[3].userTurn.id, history[3].reply!.id)?.reachesOpenHead).toBe(true);
    expect(partRange(proof, ids, history[0].userTurn.id, history[3].reply!.id)).toMatchObject({ firstTc: 1, lastTc: 16, whole: true });
  });

  it('older pages not loaded yet: a part of the newest page still maps to its own historical positions', () => {
    const shown = displayedMessageIds(history.slice(2));
    expect(partRange(proof, shown, history[2].userTurn.id, history[3].userTurn.id)).toEqual({ firstTc: 9, lastTc: 14, messageCount: 3, reachesOpenHead: false, whole: false });
    // An end that is not on screen cannot be chosen.
    expect(partRange(proof, shown, history[0].userTurn.id, history[3].userTurn.id)).toBeNull();
  });

  it('an incomplete reply is not a message yet: it cannot be an end', () => {
    const pending = exchange('pending', { replyState: 'PENDING' });
    const shown = displayedMessageIds([...history, pending]);
    expect(partRange(proof, shown, history[3].reply!.id, pending.userTurn.id)).toBeNull();
    expect(selectionMarks(proof, shown, { kind: 'WHOLE' }).get(pending.userTurn.id)).toEqual({ mark: 'NONE', joinAbove: false, joinBelow: false });
  });

  it('an exchange with no committed units (its reply failed) is skipped by the positions and never drawn as inside', () => {
    const failed = exchange('failed', { replyState: 'FAILED' });
    const all = [history[0], failed, history[1]];
    const events = timeline(all, { skip: new Set([failed.userTurn.id]) });
    const p = proven(events);
    const shown = displayedMessageIds(all);
    expect(partRange(p, shown, history[0].userTurn.id, history[1].reply!.id)).toEqual({ firstTc: 1, lastTc: 8, messageCount: 4, reachesOpenHead: true, whole: true });
    const marks = selectionMarks(p, shown, { kind: 'PART', firstId: history[0].userTurn.id, lastId: history[1].reply!.id });
    expect(marks.get(failed.userTurn.id)).toEqual({ mark: 'NONE', joinAbove: false, joinBelow: false });
    expect(marks.get(history[0].reply!.id)).toEqual({ mark: 'IN', joinAbove: true, joinBelow: false });
    expect(marks.get(history[1].userTurn.id)).toEqual({ mark: 'IN', joinAbove: false, joinBelow: true });
  });

  it('a display that disagrees with the Session Position order is refused, never reconciled', () => {
    const swapped = [...ids];
    [swapped[2], swapped[4]] = [swapped[4], swapped[2]];
    expect(partRange(proof, swapped, swapped[0], swapped[2])).toBeNull();
  });

  it('a message the proof does not know (another conversation’s id) is no end', () => {
    expect(partRange(proof, [...ids, 'ffffffff-ffff-4fff-8fff-ffffffffffff'], ids[0], 'ffffffff-ffff-4fff-8fff-ffffffffffff')).toBeNull();
  });

  it('the saved draft’s ends are found again by their positions, when they are on screen', () => {
    expect(displayedMessageAt(proof, ids, 'first', 5)).toBe(history[1].userTurn.id);
    expect(displayedMessageAt(proof, ids, 'last', 12)).toBe(history[2].reply!.id);
    expect(displayedMessageAt(proof, ids, 'first', 6)).toBeNull();
  });

  it('ids compare without case', () => {
    expect(partRange(proof, ids, history[1].userTurn.id.toUpperCase(), history[1].reply!.id.toUpperCase())).not.toBeNull();
  });
});
