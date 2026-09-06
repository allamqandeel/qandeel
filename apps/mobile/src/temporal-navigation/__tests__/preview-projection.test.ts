/**
 * T-06 — TN06-09 (the preview half) and R2-01.
 *
 * A preview may show a legitimate historical target, and only through the disclosure of THAT
 * position. Both gates — canonical Moment validity and current disclosed interaction availability —
 * run before the lookup, so an illegitimate position is never even asked about, whatever the cache
 * happens to be holding for it.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import { sessionPosition } from '../../state';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import type { HistoricalDisclosureEntry } from '../../projection';
import * as previewModule from '../preview';
import { previewProjection, previewProjectionRequest, type PreviewDisclosureLookup } from '../preview';
import { zoomSemanticStep } from '../../map';
import { temporalTargeting } from '../targeting';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

const world = (tc: number, threads: readonly { id: string; x: string; y: string }[]) =>
  disclosureFixture({ depth: 'SESSION', tc, liveHead: 6, threads });

const bigWorld = (tc: number, threads: readonly { id: string; x: string; y: string }[]) =>
  disclosureFixture({ depth: 'SESSION', tc, liveHead: 100, threads });

function recordingLookup(entries: Readonly<Record<number, HistoricalDisclosureEntry>>) {
  const asked: { sessionId: string; tc: number; depth: HistoricalSemanticDepth }[] = [];
  const lookup: PreviewDisclosureLookup = (sessionId, tc, depth) => {
    asked.push({ sessionId, tc, depth: depth as HistoricalSemanticDepth });
    return entries[tc] ?? { status: 'NOT_FETCHED' };
  };
  return { asked, lookup };
}

describe('the bounded preview projection', () => {
  it('asks for the disclosure of the previewed position, at the depth the camera already discloses', () => {
    const store = temporalTestStore({ liveHead: 6, depth: 'SESSION' });
    const { asked, lookup } = recordingLookup({
      2: { status: 'FETCHED', value: world(2, [{ id: 'thread-1', x: '10', y: '10' }]), sealed: true },
    });

    const resolved = previewProjection(store.getState(), fullyDisclosedTargeting(store), 2, lookup);
    expect(resolved.status).toBe('PROJECTION');
    if (resolved.status !== 'PROJECTION') throw new Error('unreachable');
    expect(resolved.target).toBe(2);
    expect(resolved.context.scene.tc).toBe(2);
    expect(asked).toEqual([{ sessionId: 'session-1', tc: 2, depth: 'SESSION' }]);
  });

  it('contains only what was known at the previewed position — nothing later is there to hide', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const targeting = fullyDisclosedTargeting(store);
    const { lookup } = recordingLookup({
      2: { status: 'FETCHED', value: world(2, [{ id: 'thread-1', x: '10', y: '10' }]), sealed: true },
      6: {
        status: 'FETCHED',
        value: world(6, [
          { id: 'thread-1', x: '10', y: '10' },
          { id: 'thread-2', x: '90', y: '90' },
        ]),
        sealed: false,
      },
    });

    const earlier = previewProjection(store.getState(), targeting, 2, lookup);
    const later = previewProjection(store.getState(), targeting, 6, lookup);
    if (earlier.status !== 'PROJECTION' || later.status !== 'PROJECTION') throw new Error('unreachable');

    expect([...earlier.context.scene.keys]).toEqual(['THREAD:thread-1']);
    expect([...later.context.scene.keys].sort()).toEqual(['THREAD:thread-1', 'THREAD:thread-2']);
  });

  it('performs no lookup at all for a position that may not be previewed', () => {
    const store = temporalTestStore({ liveHead: 4 });
    const targeting = fullyDisclosedTargeting(store);
    const { asked, lookup } = recordingLookup({});

    for (const candidate of [5, 99, 0, -1, 1.5, Number.NaN, 'x', null]) {
      expect(previewProjection(store.getState(), targeting, candidate, lookup).status).toBe('NOT_ADDRESSABLE');
    }
    // The decisive assertion: nothing beyond the Live Head was ever requested.
    expect(asked).toEqual([]);
    expect(previewProjectionRequest(store.getState(), targeting, 5)).toBeNull();
    expect(previewProjectionRequest(store.getState(), targeting, 4)).toEqual({ sessionId: 'session-1', tc: 4, depth: 'SESSION' });
  });

  it('keeps not-fetched, unavailable and disclosed-and-empty as three different answers', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const targeting = fullyDisclosedTargeting(store);
    const { lookup } = recordingLookup({
      1: { status: 'UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' },
      3: { status: 'FETCHED', value: world(3, []), sealed: true },
    });

    expect(previewProjection(store.getState(), targeting, 2, lookup)).toMatchObject({ status: 'NOT_FETCHED', target: 2 });
    expect(previewProjection(store.getState(), targeting, 1, lookup)).toMatchObject({
      status: 'UNAVAILABLE',
      code: 'HISTORICAL_COVERAGE_UNAVAILABLE',
    });

    const empty = previewProjection(store.getState(), targeting, 3, lookup);
    expect(empty.status).toBe('PROJECTION');
    if (empty.status !== 'PROJECTION') throw new Error('unreachable');
    // A sparse or empty historical view is a CORRECT view; nothing is borrowed to fill it.
    expect(empty.context.scene.objects).toEqual([]);
  });

  it('refuses a disclosure that does not describe the position it was asked for', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const { lookup } = recordingLookup({
      2: { status: 'FETCHED', value: world(5, [{ id: 'thread-1', x: '10', y: '10' }]), sealed: true },
    });
    expect(previewProjection(store.getState(), fullyDisclosedTargeting(store), sessionPosition(2), lookup)).toMatchObject({
      status: 'MALFORMED',
      reason: 'PROJECTION_TC_MISMATCH',
    });
  });
});

describe('R2-01 — the preview projection consumes the disclosed interaction authority', () => {
  const store = () => temporalTestStore({ liveHead: 100, depth: 'SESSION' });
  const disclosedThrough = (target: ReturnType<typeof store>, count: number) => temporalTargeting(target.getState(), trackOf('session-1', count));

  /** The reviewed shape: LH = 100, disclosed through SP(80), and the cache HOLDS SP(95). */
  const cacheWithNinetyFive = () =>
    recordingLookup({
      80: { status: 'FETCHED', value: bigWorld(80, [{ id: 'thread-1', x: '10', y: '10' }]), sealed: true },
      95: { status: 'FETCHED', value: bigWorld(95, [{ id: 'thread-1', x: '10', y: '10' }]), sealed: true },
    });

  it('cannot show a cached projection for a canonically valid but undisclosed Moment', () => {
    const canonical = store();
    const { asked, lookup } = cacheWithNinetyFive();

    const refused = previewProjection(canonical.getState(), disclosedThrough(canonical, 80), 95, lookup);
    expect(refused).toEqual({ status: 'NOT_ADDRESSABLE', code: 'NOT_DISCLOSED', detail: expect.any(String) });
    // The decisive assertion: the cache was never consulted, so its contents could not have decided.
    expect(asked).toHaveLength(0);
    expect(previewProjectionRequest(canonical.getState(), disclosedThrough(canonical, 80), 95)).toBeNull();
    expect(asked).toHaveLength(0);
  });

  it('proceeds for a disclosed position, asking exactly once for exactly that position', () => {
    const canonical = store();
    const { asked, lookup } = cacheWithNinetyFive();

    const resolved = previewProjection(canonical.getState(), disclosedThrough(canonical, 80), 80, lookup);
    expect(resolved.status).toBe('PROJECTION');
    if (resolved.status !== 'PROJECTION') throw new Error('unreachable');
    expect(resolved.context.scene.tc).toBe(80);
    expect(asked).toEqual([{ sessionId: 'session-1', tc: 80, depth: 'SESSION' }]);
  });

  it('keeps the two refusals distinct rather than collapsing them into one', () => {
    const canonical = store();
    const { asked, lookup } = cacheWithNinetyFive();
    const targeting = disclosedThrough(canonical, 80);

    expect(previewProjection(canonical.getState(), targeting, 101, lookup)).toMatchObject({ code: 'BEYOND_LIVE_HEAD' });
    expect(previewProjection(canonical.getState(), targeting, 95, lookup)).toMatchObject({ code: 'NOT_DISCLOSED' });
    expect(previewProjection(canonical.getState(), targeting, 0, lookup)).toMatchObject({ code: 'NOT_ADDRESSABLE' });
    expect(asked).toHaveLength(0);
  });

  it('fails a foreign Session before the lookup', () => {
    const canonical = store();
    const { asked, lookup } = cacheWithNinetyFive();
    const foreignTrack = temporalTargeting(canonical.getState(), trackOf('session-2', 100));

    expect(previewProjection(canonical.getState(), foreignTrack, 80, lookup)).toMatchObject({ code: 'SESSION_MISMATCH' });

    // And a targeting authority built for another store proves nothing about this one.
    const otherStore = temporalTestStore({ sessionId: 'session-2', liveHead: 100 });
    const otherTargeting = temporalTargeting(otherStore.getState(), trackOf('session-2', 100));
    expect(previewProjection(canonical.getState(), otherTargeting, 80, lookup)).toMatchObject({ code: 'SESSION_MISMATCH' });
    expect(asked).toHaveLength(0);
  });

  it('lets disclosure growth make the previously undisclosed position available', () => {
    const canonical = store();
    const { asked, lookup } = cacheWithNinetyFive();

    expect(previewProjection(canonical.getState(), disclosedThrough(canonical, 80), 95, lookup)).toMatchObject({ code: 'NOT_DISCLOSED' });
    expect(asked).toHaveLength(0);

    // The Track grows to include SP(95). The same deliberate request now reaches it.
    const grown = previewProjection(canonical.getState(), disclosedThrough(canonical, 95), 95, lookup);
    expect(grown.status).toBe('PROJECTION');
    expect(asked).toEqual([{ sessionId: 'session-1', tc: 95, depth: 'SESSION' }]);
  });

  it('never lets the camera depth come from the caller', () => {
    const canonical = temporalTestStore({ liveHead: 100, depth: 'WORLD' });
    const { asked, lookup } = recordingLookup({});
    previewProjection(canonical.getState(), disclosedThrough(canonical, 80), 80, lookup);
    expect(asked).toEqual([{ sessionId: 'session-1', tc: 80, depth: 'WORLD' }]);
  });
});

describe('R3-01 — canonical validity is judged from the state being projected, never from the caller', () => {
  it('refuses a target that a foreign LATER Live Head would allow but this state does not', () => {
    // The state being presented knows about 80 Moments.
    const current = temporalTestStore({ liveHead: 80, depth: 'SESSION' });
    // A targeting authority built from ANOTHER store for the SAME Session, further ahead: LH = 100
    // and a Track that genuinely reaches SP(95) there.
    const ahead = temporalTestStore({ liveHead: 100, depth: 'SESSION' });
    const foreign = temporalTargeting(ahead.getState(), trackOf('session-1', 95));
    expect(foreign.bounds.liveHead).toBe(100);
    expect(foreign.disclosed.horizon).toBe(95);

    const { asked, lookup } = recordingLookup({
      95: { status: 'FETCHED', value: bigWorld(95, [{ id: 'thread-1', x: '10', y: '10' }]), sealed: true },
    });

    // The Session ids match, so only re-deriving canonical bounds from THIS state can refuse it.
    const refused = previewProjection(current.getState(), foreign, 95, lookup);
    expect(refused).toEqual({ status: 'NOT_ADDRESSABLE', code: 'BEYOND_LIVE_HEAD', detail: expect.any(String) });
    expect(asked).toHaveLength(0);
    expect(previewProjectionRequest(current.getState(), foreign, 95)).toBeNull();
    expect(asked).toHaveLength(0);
  });

  it('still admits what the current state genuinely allows through that same foreign authority', () => {
    const current = temporalTestStore({ liveHead: 80, depth: 'SESSION' });
    const ahead = temporalTestStore({ liveHead: 100, depth: 'SESSION' });
    const foreign = temporalTargeting(ahead.getState(), trackOf('session-1', 95));
    const { asked, lookup } = recordingLookup({
      80: { status: 'FETCHED', value: disclosureFixture({ depth: 'SESSION', tc: 80, liveHead: 80, threads: [] }), sealed: false },
    });

    // SP(80) is within this state's Live Head and is disclosed, so it proceeds — the fix narrows
    // authority, it does not simply refuse anything carrying a foreign bounds snapshot.
    expect(previewProjection(current.getState(), foreign, 80, lookup).status).toBe('PROJECTION');
    expect(asked).toEqual([{ sessionId: 'session-1', tc: 80, depth: 'SESSION' }]);
  });

  it('is not widened by a stale EARLIER authority either: disclosure can only narrow', () => {
    // Current state has advanced to 100; the targeting was built earlier, at LH = 80 with a Track
    // through 80.
    const current = temporalTestStore({ liveHead: 100, depth: 'SESSION' });
    const earlier = temporalTestStore({ liveHead: 80, depth: 'SESSION' });
    const stale = temporalTargeting(earlier.getState(), trackOf('session-1', 80));
    const { asked, lookup } = recordingLookup({
      80: { status: 'FETCHED', value: bigWorld(80, [{ id: 'thread-1', x: '10', y: '10' }]), sealed: true },
      95: { status: 'FETCHED', value: bigWorld(95, [{ id: 'thread-1', x: '10', y: '10' }]), sealed: true },
    });

    // SP(80) remains valid.
    expect(previewProjection(current.getState(), stale, 80, lookup).status).toBe('PROJECTION');
    // The current, larger Live Head does NOT widen disclosed membership: SP(95) is still not in that
    // Track, so it is refused as undisclosed rather than admitted because LH now reaches it.
    expect(previewProjection(current.getState(), stale, 95, lookup)).toMatchObject({ code: 'NOT_DISCLOSED' });
    expect(asked).toEqual([{ sessionId: 'session-1', tc: 80, depth: 'SESSION' }]);
  });

  it('keeps a different Session failing closed before the lookup', () => {
    const current = temporalTestStore({ liveHead: 100 });
    const other = temporalTestStore({ sessionId: 'session-2', liveHead: 100 });
    const otherTargeting = temporalTargeting(other.getState(), trackOf('session-2', 100));
    const { asked, lookup } = recordingLookup({});

    expect(previewProjection(current.getState(), otherTargeting, 80, lookup)).toMatchObject({ code: 'SESSION_MISMATCH' });
    expect(asked).toHaveLength(0);
  });

  it('refuses a malformed targeting authority outright', () => {
    const current = temporalTestStore({ liveHead: 100 });
    const { asked, lookup } = recordingLookup({});
    for (const malformed of [null, undefined, {}, 'targeting']) {
      expect(previewProjection(current.getState(), malformed as never, 80, lookup)).toMatchObject({
        status: 'NOT_ADDRESSABLE',
        code: 'INVALID_INPUT',
      });
    }
    expect(asked).toHaveLength(0);
  });
});

describe('R3-02 — no reusable preview-projection capability exists', () => {
  it('exports no authorization token, projector or capability check at all', () => {
    for (const forbidden of ['authorizePreviewTarget', 'isAuthorizedPreviewTarget', 'projectAuthorizedPreviewTarget', 'AuthorizedPreviewTarget']) {
      expect(Object.keys(previewModule)).not.toContain(forbidden);
    }
    // Exactly the two atomic entry points, each of which authorizes against current state and
    // projects in the same call.
    expect(typeof previewModule.previewProjection).toBe('function');
    expect(typeof previewModule.previewProjectionRequest).toBe('function');
  });

  it('uses the CURRENT camera depth on every call, so a depth change cannot be outrun', () => {
    const canonical = temporalTestStore({ liveHead: 100, depth: 'SESSION' });
    const targeting = temporalTargeting(canonical.getState(), trackOf('session-1', 100));
    const { asked, lookup } = recordingLookup({});

    expect(previewProjectionRequest(canonical.getState(), targeting, 80)).toEqual({ sessionId: 'session-1', tc: 80, depth: 'SESSION' });
    previewProjection(canonical.getState(), targeting, 80, lookup);
    expect(asked).toEqual([{ sessionId: 'session-1', tc: 80, depth: 'SESSION' }]);

    // The camera moves to another rung through T-04's own executor.
    expect(zoomSemanticStep(canonical, 'IN').outcome).toBe('APPLIED');
    expect(canonical.getState().camera.depth).toBe('ANALYTICAL_OBJECT');

    // There is no earlier authorization to replay, and the next call reads the new depth. Nothing a
    // caller held from before can still ask for SESSION.
    expect(previewProjectionRequest(canonical.getState(), targeting, 80)).toEqual({
      sessionId: 'session-1',
      tc: 80,
      depth: 'ANALYTICAL_OBJECT',
    });
    previewProjection(canonical.getState(), targeting, 80, lookup);
    expect(asked[1]).toEqual({ sessionId: 'session-1', tc: 80, depth: 'ANALYTICAL_OBJECT' });
    expect(asked).toHaveLength(2);
  });

  it('cannot project for a Session the current state has left', () => {
    const first = temporalTestStore({ liveHead: 100 });
    const targeting = temporalTargeting(first.getState(), trackOf('session-1', 100));
    const { asked, lookup } = recordingLookup({});

    // The same targeting that worked a moment ago is powerless once the state is another Session.
    expect(previewProjection(first.getState(), targeting, 80, lookup).status).not.toBe('NOT_ADDRESSABLE');
    const replacement = temporalTestStore({ sessionId: 'session-2', liveHead: 100 });
    expect(previewProjection(replacement.getState(), targeting, 80, lookup)).toMatchObject({ code: 'SESSION_MISMATCH' });
    expect(asked).toHaveLength(1);
  });
});
