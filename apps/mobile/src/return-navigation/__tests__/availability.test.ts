/**
 * T-07 — RN07-J: the historical Live-meta firewall (R1-02).
 *
 * A historical reader is permitted the GENERIC Live meta — Live continued, a route back to Live —
 * and nothing else. The defect this suite exists to catch is a capability bit derived from raw
 * current `LF`: it is future-relative to the reader's position, so it can reveal that a Thread
 * exists which `K(TC)` does not disclose, and it overstates the act besides, because a live Thread
 * with no place at the current viewpoint is not a landing.
 *
 * The state-only model therefore answers nothing about Live Focus. The capability question is
 * answered only against a disclosed projection PROVEN to be this viewpoint's, by the same
 * locatability substrate the act itself uses.
 */
import { sessionPosition, type CanonicalStore, type LiveFocus } from '../../state';
import { panByTranslation } from '../../map';
import { returnAvailability, RETURN_ACT_IDS } from '../availability';
import { liveFocusReturnAvailability } from '../return-actions';
import { contextAt, returnTestStore, world } from '../__fixtures__/return';

const SP = sessionPosition;

/** The Thread the reader can see at their own historical position. */
const THREAD_PAST = { id: 'thread-past', x: '1000000', y: '0' };
/** A Thread established only later: future truth relative to the reader's position. */
const THREAD_FUTURE = { id: 'thread-future', x: '2000000', y: '0' };

/** The disclosed projection of the reader's own historical viewpoint: it knows nothing later. */
const historicalContext = () => contextAt(world({ depth: 'SESSION', tc: 4, liveHead: 40, threads: [THREAD_PAST] }));

/** Two historical states differing ONLY in current Live Focus. */
function historicalStore(liveFocus: LiveFocus): CanonicalStore {
  const store = returnTestStore({ liveHead: 40, temporal: { kind: 'PINNED', at: SP(4) }, liveFocus, liveFocusAtSp: 30 });
  // The same committed act on both, so viewpoint, camera, inspection and RH are identical.
  expect(panByTranslation(store, 220, 0).outcome).toBe('APPLIED');
  return store;
}

describe('RN07-J — historical Live-meta firewall', () => {
  it('R1-02 differential — LF = NONE and LF = a future Thread produce an identical generic model', () => {
    const a = historicalStore({ kind: 'NONE' });
    const b = historicalStore({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-future' });

    // Same committed historical viewpoint, camera, inspection, RH and Live advancement.
    expect(a.getState().temporal).toEqual(b.getState().temporal);
    expect(a.getState().camera).toEqual(b.getState().camera);
    expect(a.getState().inspection).toEqual(b.getState().inspection);
    expect(a.getState().history).toHaveLength(b.getState().history.length);
    expect(a.getState().live.LH).toBe(b.getState().live.LH);
    // ...and different Live Focus, which is the ONLY difference.
    expect(a.getState().live.LF.value).not.toEqual(b.getState().live.LF.value);

    // The generic model cannot tell them apart, so it reveals nothing about the future Thread.
    expect(returnAvailability(a.getState())).toEqual(returnAvailability(b.getState()));
    expect(JSON.stringify(returnAvailability(b.getState()))).not.toMatch(/thread|future|focus/iu);
    // No key of the model is derived from Live Focus at all.
    expect(Object.keys(returnAvailability(b.getState())).sort()).toEqual([
      'backAvailable',
      'checkpointCount',
      'historical',
      'liveReturnAvailable',
      'worldReturnAvailable',
    ]);
  });

  it('R1-02 differential — the projection-bound capability cannot tell them apart either', () => {
    const context = historicalContext();
    const a = historicalStore({ kind: 'NONE' });
    const b = historicalStore({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-future' });

    // The future Thread genuinely exists — the LIVE projection places it — so this is real future
    // truth, not a nonexistent identity.
    const live = contextAt(world({ depth: 'SESSION', tc: 40, liveHead: 40, threads: [THREAD_PAST, THREAD_FUTURE] }));
    expect(live.scene.homes.map((object) => object.id).sort()).toEqual(['thread-future', 'thread-past']);
    // ...and the reader's own position does not disclose it.
    expect(context.scene.homes.map((object) => object.id)).toEqual(['thread-past']);

    // So there is no landing at K(TC) — the same answer as no Live Focus at all. The reader learns
    // that Return to Live Focus has nowhere to go, never that something exists which they cannot see.
    expect(liveFocusReturnAvailability(a, context)).toEqual({ status: 'UNAVAILABLE' });
    expect(liveFocusReturnAvailability(b, context)).toEqual({ status: 'UNAVAILABLE' });
  });

  it('the generic route back to Live stays available in both, and says only that Live is elsewhere', () => {
    for (const store of [historicalStore({ kind: 'NONE' }), historicalStore({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-future' })]) {
      const availability = returnAvailability(store.getState());
      expect(availability.liveReturnAvailable).toBe(true);
      expect(availability.historical).toBe(true);
      expect(availability.backAvailable).toBe(true);
      expect(availability.checkpointCount).toBe(1);
    }
  });

  it('a Thread that IS disclosed at the reader position is a legitimate, non-hindsight capability', () => {
    const store = historicalStore({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-past' });
    // `thread-past` is part of K(TC): saying the act can land there states a fact about the
    // reader's OWN position, not about live truth relative to it.
    expect(liveFocusReturnAvailability(store, historicalContext())).toEqual({ status: 'AVAILABLE' });
  });

  it('an unproven projection yields no answer at all, not even about whether a Live Focus exists', () => {
    const foreign = contextAt(world({ depth: 'SESSION', sessionId: 'session-other', tc: 4, liveHead: 40, threads: [THREAD_PAST] }));
    const wrongPosition = contextAt(world({ depth: 'SESSION', tc: 9, liveHead: 40, threads: [THREAD_PAST] }));
    const wrongDepth = contextAt(world({ depth: 'THREAD', tc: 4, liveHead: 40, threads: [THREAD_PAST] }));

    for (const context of [foreign, wrongPosition, wrongDepth]) {
      // Both the NONE store and the future-Thread store answer UNPROVEN: the question was never
      // asked, so the difference between them cannot leak through this route either.
      expect(liveFocusReturnAvailability(historicalStore({ kind: 'NONE' }), context)).toEqual({ status: 'UNPROVEN' });
      expect(liveFocusReturnAvailability(historicalStore({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-past' }), context)).toEqual({ status: 'UNPROVEN' });
    }
  });

  it('the state-only model never reads Live Focus, and the six identities stay six', () => {
    expect(RETURN_ACT_IDS).toHaveLength(6);
    // Two states identical except for Live Focus, at the LIVE edge this time: still identical.
    const following = () => returnTestStore({ liveHead: 12 });
    const withFocus = returnTestStore({ liveHead: 12, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-past' } });
    expect(returnAvailability(following().getState())).toEqual(returnAvailability(withFocus.getState()));
    expect(returnAvailability(withFocus.getState()).historical).toBe(false);
  });
});
