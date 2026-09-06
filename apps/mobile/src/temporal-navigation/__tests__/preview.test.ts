/**
 * T-06 — TN06-01, TN06-02, TN06-08, TN06-23, TN06-24.
 *
 * A preview is ephemeral. The strongest available statement of that is object identity: canonical
 * state is deep-frozen and republished on every real write, so if the published state object is the
 * SAME object before and after, nothing canonical happened — no field moved, no RH entry was
 * appended, and no transaction was even attempted.
 */
import { canonicalStateShapeIssue, createCanonicalStore, isRhActionId, sessionPosition } from '../../state';
import { WORLD_ORIGIN, initialCameraIntent } from '../../map';
import { createTemporalPreviewController } from '../preview';
import { temporalTargeting } from '../targeting';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

describe('TN06-01 — preview isolation', () => {
  it('changes no CanonicalState field and appends no RH, however many times it retargets', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const preview = createTemporalPreviewController();
    const before = store.getState();

    for (const sp of [1, 4, 2, 6, 3]) {
      const result = preview.preview(fullyDisclosedTargeting(store), sp, 'EXACT_ENTRY');
      expect(result.outcome).toBe('PREVIEWING');
    }

    // Object identity: the kernel republishes on every effective write, so an unchanged object is
    // proof that no write was even attempted — not merely that the values happen to match.
    expect(store.getState()).toBe(before);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().inspection).toBeNull();
  });

  it('keeps the committed origin as evidence and never writes it back', () => {
    const store = temporalTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(5) } });
    const preview = createTemporalPreviewController();
    preview.preview(fullyDisclosedTargeting(store), 2, 'DISCLOSED_TARGET');
    const snapshot = preview.getSnapshot();
    expect(snapshot.status).toBe('PREVIEWING');
    if (snapshot.status !== 'PREVIEWING') throw new Error('unreachable');
    expect(snapshot.origin).toEqual({ sessionId: 'session-1', mode: 'PINNED', tc: 5 });
    // Committed truth is exactly where it was.
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 5 });
  });

  it('re-asking for the target already previewed publishes nothing and invalidates no in-flight work', () => {
    const preview = createTemporalPreviewController();
    const store = temporalTestStore({ liveHead: 6 });
    const bounds = fullyDisclosedTargeting(store);
    let notifications = 0;
    preview.subscribe(() => {
      notifications += 1;
    });

    const first = preview.preview(bounds, 3, 'DISCLOSED_TARGET');
    expect(first.outcome).toBe('PREVIEWING');
    if (first.outcome !== 'PREVIEWING') throw new Error('unreachable');
    const generation = first.preview.generation;

    expect(preview.preview(bounds, 3, 'DISCLOSED_TARGET').outcome).toBe('UNCHANGED');
    expect(preview.preview(bounds, 3, 'DISCLOSED_TARGET').outcome).toBe('UNCHANGED');
    expect(notifications).toBe(1);
    expect(preview.isCurrent(generation)).toBe(true);
  });
});

describe('TN06-02 — cancel preview', () => {
  it('clears only ephemeral preview state and creates no transaction', () => {
    const store = temporalTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) } });
    const preview = createTemporalPreviewController();
    const committed = store.getState();
    preview.preview(fullyDisclosedTargeting(store), 2, 'DISCLOSED_TARGET');

    expect(preview.cancel()).toEqual({ outcome: 'CLEARED' });

    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(store.getState()).toBe(committed);
    expect(store.getState().history).toHaveLength(0);
  });

  it('is safe with nothing to cancel, and repeatedly', () => {
    const preview = createTemporalPreviewController();
    expect(preview.cancel()).toEqual({ outcome: 'UNCHANGED' });
    expect(preview.cancel()).toEqual({ outcome: 'UNCHANGED' });
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
  });

  it('invalidates every in-flight generation, so work started for a cancelled preview is discarded', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const preview = createTemporalPreviewController();
    const started = preview.preview(fullyDisclosedTargeting(store), 3, 'DISCLOSED_TARGET');
    if (started.outcome !== 'PREVIEWING') throw new Error('unreachable');

    preview.cancel();
    expect(preview.isCurrent(started.preview.generation)).toBe(false);

    // A later preview never reuses a generation, so late work cannot be mistaken for current work.
    const again = preview.preview(fullyDisclosedTargeting(store), 3, 'DISCLOSED_TARGET');
    if (again.outcome !== 'PREVIEWING') throw new Error('unreachable');
    expect(again.preview.generation).toBeGreaterThan(started.preview.generation);
    expect(preview.isCurrent(started.preview.generation)).toBe(false);
  });
});

describe('TN06-08 — addressability fails closed', () => {
  const store = temporalTestStore({ liveHead: 4 });
  const preview = createTemporalPreviewController();
  const bounds = fullyDisclosedTargeting(store);

  it.each([
    [0, 'NOT_ADDRESSABLE'],
    [-1, 'NOT_ADDRESSABLE'],
    [1.5, 'NOT_ADDRESSABLE'],
    [Number.NaN, 'NOT_ADDRESSABLE'],
    [Number.POSITIVE_INFINITY, 'NOT_ADDRESSABLE'],
    [5, 'BEYOND_LIVE_HEAD'],
    [10_000, 'BEYOND_LIVE_HEAD'],
  ])('refuses %p with %s', (candidate, code) => {
    const result = preview.preview(bounds, candidate, 'EXACT_ENTRY');
    expect(result).toEqual({ outcome: 'REJECTED', code, detail: expect.any(String) });
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
  });

  it.each([['a string'], [null], [undefined], [{}], [[]]])('refuses the malformed target %p', (candidate) => {
    expect(preview.preview(bounds, candidate, 'EXACT_ENTRY').outcome).toBe('REJECTED');
  });

  it('refuses everything before the first mirrored Moment', () => {
    const empty = temporalTargeting(
      { ...store.getState(), live: { LH: null, LF: { value: { kind: 'NONE' }, atSp: null } } },
      trackOf('session-1', 0),
    );
    expect(preview.preview(empty, 1, 'EXACT_ENTRY')).toEqual({
      outcome: 'REJECTED',
      code: 'NO_ADDRESSABLE_POSITION',
      detail: expect.any(String),
    });
  });
});

describe('R1-01 — disclosed interaction availability is not canonical addressability', () => {
  // The reviewed shape: the mirror knows about 100 Moments and only 80 of them are disclosed.
  const store = () => temporalTestStore({ liveHead: 100 });
  const disclosedThrough = (target: ReturnType<typeof store>, count: number) => temporalTargeting(target.getState(), trackOf('session-1', count));

  it('refuses an exact entry that LH allows but nothing has disclosed, with zero mutation and zero RH', () => {
    const canonical = store();
    const preview = createTemporalPreviewController();
    const before = canonical.getState();

    const result = preview.preview(disclosedThrough(canonical, 80), 81, 'EXACT_ENTRY');
    expect(result).toEqual({ outcome: 'REJECTED', code: 'NOT_DISCLOSED', detail: expect.any(String) });
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(canonical.getState()).toBe(before);
    expect(canonical.getState().history).toHaveLength(0);
    // SP(95) is a perfectly valid Moment and still not an interaction target.
    expect(preview.preview(disclosedThrough(canonical, 80), 95, 'EXACT_ENTRY')).toMatchObject({ code: 'NOT_DISCLOSED' });
  });

  it('allows an exact entry at the disclosure horizon itself', () => {
    const canonical = store();
    const preview = createTemporalPreviewController();
    expect(preview.preview(disclosedThrough(canonical, 80), 80, 'EXACT_ENTRY').outcome).toBe('PREVIEWING');
    expect(preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 80 });
  });

  it('keeps the two refusals distinguishable rather than collapsing them into one', () => {
    const canonical = store();
    const preview = createTemporalPreviewController();
    const targeting = disclosedThrough(canonical, 80);
    // Beyond the Live Head: not a Moment at all.
    expect(preview.preview(targeting, 101, 'EXACT_ENTRY')).toMatchObject({ code: 'BEYOND_LIVE_HEAD' });
    // Within the Live Head, outside disclosure: a Moment, but not an interaction target.
    expect(preview.preview(targeting, 81, 'EXACT_ENTRY')).toMatchObject({ code: 'NOT_DISCLOSED' });
  });

  it('lets disclosure growth make a later target available, without rewriting anything earlier', () => {
    const canonical = store();
    const preview = createTemporalPreviewController();

    expect(preview.preview(disclosedThrough(canonical, 80), 81, 'EXACT_ENTRY')).toMatchObject({ code: 'NOT_DISCLOSED' });
    // The Track grows. The same deliberate action now reaches further; nothing about the earlier
    // refusal, the committed position or RH is rewritten by that.
    expect(preview.preview(disclosedThrough(canonical, 81), 81, 'EXACT_ENTRY').outcome).toBe('PREVIEWING');
    expect(preview.getSnapshot()).toMatchObject({ ptc: 81 });
    expect(canonical.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(canonical.getState().history).toHaveLength(0);
  });

  it('never infers disclosed membership from the numeric value of the Live Head', () => {
    const canonical = store();
    const preview = createTemporalPreviewController();
    // An empty Track discloses nothing at all, however large `LH` is.
    const nothing = disclosedThrough(canonical, 0);
    expect(nothing.disclosed.horizon).toBeNull();
    for (const candidate of [1, 50, 80, 100]) {
      expect(preview.preview(nothing, candidate, 'EXACT_ENTRY')).toMatchObject({ code: 'NOT_DISCLOSED' });
    }
  });

  it('drops disclosed authority when the Session is replaced', () => {
    const canonical = store();
    const preview = createTemporalPreviewController();
    const foreign = temporalTargeting(canonical.getState(), trackOf('session-2', 100));
    expect(preview.preview(foreign, 5, 'EXACT_ENTRY')).toMatchObject({ code: 'SESSION_MISMATCH' });
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
  });

  it('drops an open preview whose target stops being disclosed', () => {
    const canonical = store();
    const preview = createTemporalPreviewController();
    preview.preview(disclosedThrough(canonical, 80), 80, 'EXACT_ENTRY');
    expect(preview.getSnapshot().status).toBe('PREVIEWING');

    expect(preview.reconcile(disclosedThrough(canonical, 80))).toEqual({ outcome: 'UNCHANGED' });
    expect(preview.reconcile(disclosedThrough(canonical, 40))).toEqual({ outcome: 'CLEARED' });
    expect(canonical.getState().history).toHaveLength(0);
  });
});

describe('R1-01 — relative forward continuation stops at the disclosure horizon', () => {
  it('may reach the horizon and must then hold, without reaching past it', () => {
    const store = temporalTestStore({ liveHead: 100, temporal: { kind: 'PINNED', at: sessionPosition(79) } });
    const preview = createTemporalPreviewController();
    const targeting = temporalTargeting(store.getState(), trackOf('session-1', 80));

    expect(preview.stepForward(targeting).outcome).toBe('PREVIEWING');
    expect(preview.getSnapshot()).toMatchObject({ ptc: 80, source: 'RELATIVE_FORWARD' });

    for (let i = 0; i < 10; i += 1) expect(preview.stepForward(targeting)).toEqual({ outcome: 'UNCHANGED' });
    // It held at 80 and never manufactured 81, even though the Live Head is 100.
    expect(preview.getSnapshot()).toMatchObject({ ptc: 80 });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 79 });
    expect(store.getState().history).toHaveLength(0);
  });

  it('reaches further once disclosure grows, on a later deliberate step', () => {
    const store = temporalTestStore({ liveHead: 100, temporal: { kind: 'PINNED', at: sessionPosition(79) } });
    const preview = createTemporalPreviewController();
    preview.stepForward(temporalTargeting(store.getState(), trackOf('session-1', 80)));
    expect(preview.getSnapshot()).toMatchObject({ ptc: 80 });

    expect(preview.stepForward(temporalTargeting(store.getState(), trackOf('session-1', 82))).outcome).toBe('PREVIEWING');
    expect(preview.getSnapshot()).toMatchObject({ ptc: 81 });
  });

  it('holds at the Live Head when disclosure reaches it, and still never means Live intent', () => {
    const store = temporalTestStore({ liveHead: 4, temporal: { kind: 'PINNED', at: sessionPosition(3) } });
    const preview = createTemporalPreviewController();
    const targeting = fullyDisclosedTargeting(store);
    expect(preview.stepForward(targeting).outcome).toBe('PREVIEWING');
    expect(preview.stepForward(targeting)).toEqual({ outcome: 'UNCHANGED' });
    expect(preview.getSnapshot()).toMatchObject({ ptc: 4 });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 3 });
  });
});

describe('TN06-23 — canonical shape firewall', () => {
  it('rejects any attempt to insert a preview, presentation or animation key into CanonicalState', () => {
    const state = temporalTestStore().getState();
    for (const smuggled of ['ptc', 'PTC', 'preview', 'previewTarget', 'window', 'offset', 'position', 'animation', 'progress', 'gesture']) {
      const candidate = { ...state, [smuggled]: 3 };
      expect(canonicalStateShapeIssue(candidate, isRhActionId)).toBe(`state: unknown key ${smuggled}`);
    }
  });

  it('rejects a transition that tries to publish a preview cursor, even with TypeScript bypassed', () => {
    const camera = initialCameraIntent(WORLD_ORIGIN, undefined, 'SESSION');
    // Built through the production factory with ONE injected transition: the exact-shape validator
    // and the per-field guard still run on its result, which is the point being proven.
    const guarded = createCanonicalStore(
      {
        session: { id: 'session-1' },
        live: { LH: sessionPosition(4), LF: { value: { kind: 'NONE' }, atSp: null } },
        temporal: { kind: 'PINNED', at: sessionPosition(2) },
        inspection: null,
        camera,
      },
      {
        actionTransitions: {
          COMMIT_LIVE_EDGE: (() => ({ temporal: { kind: 'FOLLOW_LIVE' }, inspection: null, camera, ptc: 2 })) as never,
        },
      },
    );
    expect(() => guarded.dispatch({ type: 'COMMIT_LIVE_EDGE' })).toThrow(/unknown key ptc/u);
    expect(guarded.getState().temporal).toEqual({ kind: 'PINNED', at: 2 });
  });
});

describe('TN06-24 — session replacement', () => {
  it('drops a preview that belongs to a replaced Session and invents no navigation in its place', () => {
    const first = temporalTestStore({ sessionId: 'session-1', liveHead: 6 });
    const preview = createTemporalPreviewController();
    preview.preview(fullyDisclosedTargeting(first), 3, 'DISCLOSED_TARGET');
    expect(preview.getSnapshot().status).toBe('PREVIEWING');

    const replacement = temporalTestStore({ sessionId: 'session-2', liveHead: 2 });
    expect(preview.reconcile(fullyDisclosedTargeting(replacement))).toEqual({ outcome: 'CLEARED' });
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    // Nothing was targeted, previewed or committed in the new Session on the preview's behalf.
    expect(replacement.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(replacement.getState().history).toHaveLength(0);
  });

  it('leaves a preview of the same Session alone when the Live Head advances', () => {
    const store = temporalTestStore({ liveHead: 4 });
    const preview = createTemporalPreviewController();
    preview.preview(fullyDisclosedTargeting(store), 2, 'DISCLOSED_TARGET');

    store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(9) });
    expect(preview.reconcile(fullyDisclosedTargeting(store))).toEqual({ outcome: 'UNCHANGED' });

    const snapshot = preview.getSnapshot();
    expect(snapshot.status).toBe('PREVIEWING');
    if (snapshot.status !== 'PREVIEWING') throw new Error('unreachable');
    // The preview target did NOT drift with the Live Head, and it did not become a commitment.
    expect(snapshot.ptc).toBe(2);
    expect(store.getState().history).toHaveLength(0);
  });
});
