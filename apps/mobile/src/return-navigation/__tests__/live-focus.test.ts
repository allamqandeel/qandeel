/**
 * T-07 — RN07-F: `RETURN_LIVE_FOCUS`, the D1 one-shot capture.
 *
 * The referent is bound once, at activation. The traps are reading it again at settle, falling back
 * to a newer one when the bound one cannot be placed, and letting a projection that is not this
 * viewpoint's — another Session, another position, another depth, or one the client does not hold —
 * authorize a camera landing.
 */
import { sessionPosition } from '../../state';
import { decodeWorldAnchorRef, panByTranslation } from '../../map';
import { returnLiveFocus } from '../return-actions';
import { focusMapTarget, returnMapContext } from '../focus-target';
import { contextAt, interposingPreview, mutatingDispatchStore, mutatingReadStore, returnSurface, returnTestStore, world } from '../__fixtures__/return';

const SP = sessionPosition;

const THREAD_A = { id: 'thread-a', x: '1000000', y: '0' };
const THREAD_B = { id: 'thread-b', x: '2000000', y: '0' };

/** A disclosure at the reader's own viewpoint, containing both Threads and one Emerging Focus. */
const here = (tc: number, liveHead: number, depth: 'WORLD' | 'THREAD' | 'SESSION' = 'SESSION') =>
  world({ depth, tc, liveHead, threads: [THREAD_A, THREAD_B], focuses: depth === 'SESSION' ? [{ id: 'focus-1', startedSp: 1 }] : [] });

describe('RN07-F — Return to Live Focus (D1)', () => {
  it('F44 — LF = A when the act binds, LF = B before it settles: it targets A and never chases B', () => {
    const inner = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    // Live attention moves to B after the referent is bound and the landing resolved, and before
    // anything is written.
    const store = mutatingDispatchStore(inner, () => {
      inner.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' }, atSp: SP(6) });
    });

    const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 6)) });
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('LANDED');
    // The landing is Thread A's Home, not Thread B's, even though `LF` now names B.
    const anchor = decodeWorldAnchorRef(inner.getState().camera.anchor);
    expect(anchor.ok && anchor.address.x).toBe(1000000n);
    expect(inner.getState().live.LF.value).toEqual({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' });
    // `LF` itself was never written by the act, and the temporal position never moved.
    expect(inner.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
  });

  it('F44 — the referent is bound at activation, so a transition delivered before it binds is the one used', () => {
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const preview = interposingPreview(() => {
      store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' }, atSp: SP(6) });
    });

    expect(returnLiveFocus({ store, preview }, { context: contextAt(here(6, 6)) }).outcome).toBe('APPLIED');
    const anchor = decodeWorldAnchorRef(store.getState().camera.anchor);
    expect(anchor.ok && anchor.address.x).toBe(2000000n);
  });

  it('F44 — a Live Focus transition AFTER the act does not retarget it, and creates no follow', () => {
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    expect(returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 6)) }).outcome).toBe('APPLIED');
    const landed = store.getState().camera;

    store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' }, atSp: SP(6) });
    // No persistent follow exists: the camera stays exactly where the one-shot act put it.
    expect(store.getState().camera).toBe(landed);
    expect(store.getState().history).toHaveLength(1);
  });

  it('F45, F47 — a bound referent with no legitimate place moves nothing, and never falls back', () => {
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-1' } });
    const before = store.getState();
    const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 6)) });
    // An Emerging Focus is pregeographic: zero legitimate loci is a truthful answer, and no Thread
    // Home is borrowed for it.
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'NO_LEGITIMATE_LANDING', locate: 'NOT_LOCATABLE' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('F46 — LF = NONE at activation is a no-op with nothing recorded', () => {
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(6) } });
    const before = store.getState();
    const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 6)) });
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'NO_LEGITIMATE_LANDING', locate: 'NO_FOCUS' });
    expect(store.getState()).toBe(before);
  });

  it('F48, F50 — an established Thread lands on its one entitled Home, and landing there twice records once', () => {
    const store = returnTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const request = { context: contextAt(here(6, 6)) };

    const first = returnLiveFocus(returnSurface(store), request);
    expect(first.outcome === 'APPLIED' && first.locate).toBe('LANDED');
    expect(store.getState().history).toHaveLength(1);
    const landed = store.getState().camera;

    // Already at the exact entitled landing: a true no-op, and no redundant checkpoint.
    const second = returnLiveFocus(returnSurface(store), request);
    expect(second).toEqual({ outcome: 'NO_OP', reason: 'NO_EFFECTIVE_CHANGE', locate: 'ALREADY_THERE' });
    expect(store.getState().camera).toBe(landed);
    expect(store.getState().history).toHaveLength(1);
  });

  it('F49 — a historical position before the Thread exists yields no landing and no future hint', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' } });
    // At TC 3 only Thread A is part of K(TC): Thread B is future truth and is simply not disclosed.
    const earlier = world({ depth: 'SESSION', tc: 3, liveHead: 9, threads: [THREAD_A] });
    const before = store.getState();

    const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(earlier) });
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'NO_LEGITIMATE_LANDING', locate: 'NOT_ENTITLED' });
    expect(store.getState()).toBe(before);
    // The result names no Thread, no coordinate, no direction and no count.
    expect(JSON.stringify(outcome)).not.toMatch(/thread|1000000|2000000/iu);
  });

  it('F51, F52, F53 — a scene from another position, another depth or another Session authorizes nothing', () => {
    const focus = { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } as const;
    for (const [label, disclosure] of [
      ['another position', world({ depth: 'SESSION', tc: 4, liveHead: 9, threads: [THREAD_A] })],
      ['another depth', world({ depth: 'THREAD', tc: 6, liveHead: 9, threads: [THREAD_A] })],
      ['another Session', world({ depth: 'SESSION', sessionId: 'session-other', tc: 6, liveHead: 9, threads: [THREAD_A] })],
    ] as const) {
      const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: focus });
      const before = store.getState();
      const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(disclosure) });
      expect(outcome.outcome).toBe('REJECTED');
      expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('STALE_PROJECTION');
      expect(store.getState()).toBe(before);
      expect(store.getState().history).toHaveLength(0);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('F51 — a scene that was current becomes stale the moment a later temporal change commits', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const context = contextAt(here(6, 9));
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(5) }).outcome).toBe('APPLIED');
    const before = store.getState();

    const outcome = returnLiveFocus(returnSurface(store), { context });
    expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('STALE_PROJECTION');
    expect(store.getState()).toBe(before);
  });

  it('F54 — an unfetched or refused projection is a technical answer, never a fabricated "nowhere to go"', () => {
    const request = { sessionId: 'session-1', tc: SP(6), depth: 'SESSION' } as const;
    const notFetched = returnMapContext({ status: 'NOT_FETCHED' }, request);
    expect(notFetched).toEqual({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: expect.stringContaining('has not been fetched') });

    const unavailable = returnMapContext({ status: 'UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' }, request);
    expect(unavailable.ok).toBe(false);
    expect(unavailable.ok === false && unavailable.code).toBe('PROJECTION_NOT_AVAILABLE');

    // A held disclosure that describes a different viewpoint is technical too, not semantic.
    const mismatched = returnMapContext({ status: 'FETCHED', value: here(4, 9), sealed: true }, request);
    expect(mismatched.ok === false && mismatched.code).toBe('PROJECTION_NOT_AVAILABLE');
    // No branch of it ever says NOT_LOCATABLE.
    expect(JSON.stringify([notFetched, unavailable, mismatched])).not.toMatch(/NOT_LOCATABLE/u);
  });

  it('the LF mapping uses frozen identities only, and NONE has no target', () => {
    expect(focusMapTarget({ kind: 'NONE' })).toBeNull();
    expect(focusMapTarget({ kind: 'ESTABLISHED_THREAD', threadId: 't1' })).toEqual({ family: 'THREAD', id: 't1' });
    expect(focusMapTarget({ kind: 'EMERGING_FOCUS', emergingFocusId: 'f1' })).toEqual({ family: 'EMERGING_FOCUS', id: 'f1' });
  });

  it('several legitimate loci is structurally unreachable for both Live Focus families', () => {
    // A Thread has exactly ONE permanent Home in a derived scene, and an Emerging Focus is
    // pregeographic and has none. So the ambiguous branch cannot be reached with a legal fixture,
    // and that impossibility is asserted rather than manufactured.
    const scene = contextAt(here(6, 9)).scene;
    for (const object of scene.objects) {
      if (object.family === 'THREAD') expect(object.loci).toHaveLength(1);
      if (object.family === 'EMERGING_FOCUS') expect(object.loci).toHaveLength(0);
    }
  });

  // R1-01 — freshness must be established BEFORE any semantic entitlement or locatability answer can
  // escape. A stale scene that simply does not contain the bound referent is a fact about the client;
  // reporting it as "not disclosed here" or "has no place here" would be a false statement about the
  // world, made from a projection of somewhere else.
  it('R1-01 — a wrong-position context whose scene lacks the referent is STALE, never NOT_ENTITLED', () => {
    const store = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    // A scene for a DIFFERENT position that happens not to contain Thread A at all.
    const elsewhere = contextAt(world({ depth: 'SESSION', tc: 12, liveHead: 20, threads: [THREAD_B] }));
    const before = store.getState();

    const outcome = returnLiveFocus(returnSurface(store), { context: elsewhere });
    expect(outcome.outcome).toBe('REJECTED');
    expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('STALE_PROJECTION');
    expect(JSON.stringify(outcome)).not.toMatch(/NOT_ENTITLED|NOT_LOCATABLE/u);
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('R1-01 — a wrong-depth context with an ungeographic referent is STALE, never NOT_LOCATABLE', () => {
    const store = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-1' } });
    // At the THREAD rung the Session rung is withheld, so an Emerging Focus resolves to nothing —
    // which would read as a semantic answer if freshness were checked afterwards.
    const wrongDepth = contextAt(here(6, 20, 'THREAD'));
    const before = store.getState();

    const outcome = returnLiveFocus(returnSurface(store), { context: wrongDepth });
    expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('STALE_PROJECTION');
    expect(JSON.stringify(outcome)).not.toMatch(/NOT_ENTITLED|NOT_LOCATABLE/u);
    expect(store.getState()).toBe(before);
  });

  it('R1-01 — a foreign-Session context with no landing is a technical refusal, never semantic', () => {
    const store = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const foreign = contextAt(world({ depth: 'SESSION', sessionId: 'session-other', tc: 6, liveHead: 20, threads: [] }));
    const before = store.getState();

    const outcome = returnLiveFocus(returnSurface(store), { context: foreign });
    expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('STALE_PROJECTION');
    expect(JSON.stringify(outcome)).not.toMatch(/NOT_ENTITLED|NOT_LOCATABLE/u);
    expect(store.getState()).toBe(before);
  });

  it('R1-01 anti-over-fix — a CURRENT context with a legitimately absent referent is still NOT_ENTITLED', () => {
    const store = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-later' } });
    // The projection IS this viewpoint's; the Thread genuinely is not part of K(TC).
    const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 20)) });
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'NO_LEGITIMATE_LANDING', locate: 'NOT_ENTITLED' });
  });

  it('R1-01 anti-over-fix — a CURRENT context with a legitimately ungeographic referent is still NOT_LOCATABLE', () => {
    const store = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-1' } });
    const outcome = returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 20)) });
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'NO_LEGITIMATE_LANDING', locate: 'NOT_LOCATABLE' });
  });

  it('R1-01 — the authorization-time recheck survives: a viewpoint that moves AFTER the preflight cannot land', () => {
    const context = contextAt(here(6, 20));
    const focus = { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } as const;

    // Control: with nothing interposed, this exact call lands. So if the act refuses below, the
    // refusal came from a check that ran after the interposed move — not from the preflight.
    const control = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: focus });
    expect(returnLiveFocus(returnSurface(control), { context }).outcome).toBe('APPLIED');

    // Now the reader's committed position moves immediately after the PREFLIGHT's own read of
    // canonical state, retiring the scene the landing was resolved from.
    const inner = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: focus });
    const counting = mutatingReadStore(inner, 2, () => {
      expect(inner.dispatch({ type: 'COMMIT_MOMENT', moment: SP(5) }).outcome).toBe('APPLIED');
    });
    const camera = inner.getState().camera;

    const outcome = returnLiveFocus(returnSurface(counting.store), { context });
    expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('STALE_PROJECTION');
    // A read happened after the move, so a second freshness proof genuinely ran and refused.
    expect(counting.reads()).toBeGreaterThan(2);
    expect(inner.getState().camera).toBe(camera);
    // The only checkpoint is the interposed move's own; the refused return act recorded nothing.
    expect(inner.getState().history.map((entry) => entry.act)).toEqual(['COMMIT_MOMENT']);
  });

  it('the act never writes the temporal mode, even when it lands', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(6) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    expect(panByTranslation(store, 300, 0).outcome).toBe('APPLIED');
    expect(returnLiveFocus(returnSurface(store), { context: contextAt(here(6, 9)) }).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    expect(store.getState().live.LF.value).toEqual({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' });
  });
});
