/**
 * T-06 — TN06-09, the preview half.
 *
 * A preview may show a legitimate historical target, and only through the disclosure of THAT
 * position. The gate runs before the lookup, so an illegitimate position is never even asked about —
 * which is how "no future-history fetch path is introduced" is proven rather than asserted.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import { sessionPosition } from '../../state';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import type { HistoricalDisclosureEntry } from '../../projection';
import { previewProjection, previewProjectionRequest, type PreviewDisclosureLookup } from '../preview';
import { temporalTestStore } from '../__fixtures__/temporal';

const world = (tc: number, threads: readonly { id: string; x: string; y: string }[]) =>
  disclosureFixture({ depth: 'SESSION', tc, liveHead: 6, threads });

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

    const resolved = previewProjection(store.getState(), 2, lookup);
    expect(resolved.status).toBe('PROJECTION');
    if (resolved.status !== 'PROJECTION') throw new Error('unreachable');
    expect(resolved.target).toBe(2);
    expect(resolved.context.scene.tc).toBe(2);
    expect(asked).toEqual([{ sessionId: 'session-1', tc: 2, depth: 'SESSION' }]);
  });

  it('contains only what was known at the previewed position — nothing later is there to hide', () => {
    const store = temporalTestStore({ liveHead: 6 });
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

    const earlier = previewProjection(store.getState(), 2, lookup);
    const later = previewProjection(store.getState(), 6, lookup);
    if (earlier.status !== 'PROJECTION' || later.status !== 'PROJECTION') throw new Error('unreachable');

    expect([...earlier.context.scene.keys]).toEqual(['THREAD:thread-1']);
    expect([...later.context.scene.keys].sort()).toEqual(['THREAD:thread-1', 'THREAD:thread-2']);
  });

  it('performs no lookup at all for a position that may not be previewed', () => {
    const store = temporalTestStore({ liveHead: 4 });
    const { asked, lookup } = recordingLookup({});

    for (const candidate of [5, 99, 0, -1, 1.5, Number.NaN, 'x', null]) {
      const resolved = previewProjection(store.getState(), candidate, lookup);
      expect(resolved.status).toBe('NOT_ADDRESSABLE');
    }
    // The decisive assertion: nothing beyond the Live Head was ever requested.
    expect(asked).toEqual([]);
    expect(previewProjectionRequest(store.getState(), 5)).toBeNull();
    expect(previewProjectionRequest(store.getState(), 4)).toEqual({ sessionId: 'session-1', tc: 4, depth: 'SESSION' });
  });

  it('keeps not-fetched, unavailable and disclosed-and-empty as three different answers', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const { lookup } = recordingLookup({
      1: { status: 'UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' },
      3: { status: 'FETCHED', value: world(3, []), sealed: true },
    });

    expect(previewProjection(store.getState(), 2, lookup)).toMatchObject({ status: 'NOT_FETCHED', target: 2 });
    expect(previewProjection(store.getState(), 1, lookup)).toMatchObject({ status: 'UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' });

    const empty = previewProjection(store.getState(), 3, lookup);
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
    expect(previewProjection(store.getState(), sessionPosition(2), lookup)).toMatchObject({
      status: 'MALFORMED',
      reason: 'PROJECTION_TC_MISMATCH',
    });
  });
});
