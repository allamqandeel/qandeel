/**
 * T-10.0 — the presented set obeys the no-hindsight rule whatever the direction, and the three
 * directions really diverge on their stated axes while reduced motion collapses every travel.
 */
import type { PlacedNode } from '../../map';
import { DIRECTIONS, DIRECTION_IDS, motionProfile, reducedMotionProfile } from '../motion/profiles';
import { classifyChange, presentNodes, removeExited } from '../motion/world-presence';

const home = (threadId: string, x: number, y: number): PlacedNode => ({
  key: `THREAD:${threadId}@THREAD_HOME:${threadId}`,
  objectKey: `THREAD:${threadId}`,
  family: 'THREAD',
  id: threadId,
  locus: { kind: 'THREAD_HOME', threadId, address: { x: 0n, y: 0n } as never },
  region: 'WORLD_PLANE',
  x,
  y,
  radius: 13,
  visible: true,
});

const appearance = (threadId: string, readingId: string, bindingId: string, x: number, y: number): PlacedNode => ({
  key: `READING:${readingId}@THREAD_READING:${bindingId}`,
  objectKey: `READING:${readingId}`,
  family: 'READING',
  id: readingId,
  locus: { kind: 'CONTEXTUAL_APPEARANCE', threadId, bindingId, hostAddress: { x: 0n, y: 0n } as never, boundSp: 3, current: true, ordinal: 0 },
  region: 'WORLD_PLANE',
  x,
  y,
  radius: 6,
  visible: true,
});

describe('presented set', () => {
  const north = home('thread-north', 200, 100);
  const east = home('thread-east', 320, 260);
  const r1 = appearance('thread-north', 'reading-north-1', 'binding-n1', 240, 100);

  test('a temporal change removes what the new position does not know on the next frame, in every direction', () => {
    for (const id of DIRECTION_IDS) {
      const profile = DIRECTIONS[id];
      const initial = presentNodes([], [north, east, r1], 'INITIAL', profile, 1);
      const next = presentNodes(initial, [north], 'TEMPORAL', profile, 2);
      expect(next.map((entry) => entry.key)).toEqual([north.key]);
      expect(next[0].phase).toBe('PRESENT');
    }
  });

  test('a depth change may fold a withheld appearance back into its host, but only where the direction says so', () => {
    const initial = presentNodes([], [north, r1], 'INITIAL', DIRECTIONS.B, 1);
    const folded = presentNodes(initial, [north], 'DEPTH', DIRECTIONS.B, 2);
    expect(folded.find((entry) => entry.key === r1.key)?.phase).toBe('EXITING');
    expect(removeExited(folded, r1.key).map((entry) => entry.key)).toEqual([north.key]);
    const reduced = presentNodes(initial, [north], 'DEPTH', reducedMotionProfile(DIRECTIONS.B), 2);
    expect(reduced.map((entry) => entry.key)).toEqual([north.key]);
  });

  test('an appearance unfolds from its host Home, and a live advance is the only Ignition candidate', () => {
    const initial = presentNodes([], [north], 'INITIAL', DIRECTIONS.C, 1);
    const advanced = presentNodes(initial, [north, r1], 'LIVE_ADVANCE', DIRECTIONS.C, 2);
    const entry = advanced.find((candidate) => candidate.key === r1.key);
    expect(entry?.phase).toBe('ENTERING');
    expect(entry?.host).toEqual({ x: north.x, y: north.y });
    expect(entry?.ignite).toBe(true);
    const scrubbed = presentNodes(initial, [north, r1], 'TEMPORAL', DIRECTIONS.C, 3);
    expect(scrubbed.find((candidate) => candidate.key === r1.key)?.ignite).toBe(false);
    const disclosed = presentNodes(initial, [north, r1], 'DEPTH', DIRECTIONS.C, 4);
    expect(disclosed.find((candidate) => candidate.key === r1.key)?.ignite).toBe(false);
  });

  test('the change classifier never treats a camera move as a temporal or disclosure change', () => {
    const at = { sessionId: 's', tc: 4, depth: 'WORLD', liveHead: 6 };
    expect(classifyChange(null, at, false)).toBe('INITIAL');
    expect(classifyChange(at, { ...at }, false)).toBe('CAMERA');
    expect(classifyChange(at, { ...at, tc: 5 }, false)).toBe('TEMPORAL');
    expect(classifyChange(at, { ...at, tc: 7, liveHead: 7 }, true)).toBe('LIVE_ADVANCE');
    expect(classifyChange(at, { ...at, depth: 'THREAD' }, false)).toBe('DEPTH');
    expect(classifyChange(at, { ...at, sessionId: 'other' }, false)).toBe('TEMPORAL');
  });
});

describe('direction profiles', () => {
  test('the three directions diverge on their axes and are not three presets of one system', () => {
    expect(DIRECTIONS.A.disclosure.enter).toBe('in-place');
    expect(DIRECTIONS.A.field.velocityBreath).toBe(0);
    expect(DIRECTIONS.A.travel.resolveBeyondDiagonals).toBeNull();
    expect(DIRECTIONS.B.disclosure.enter).toBe('from-host');
    expect(DIRECTIONS.B.disclosure.staggerMs).toBeGreaterThan(0);
    expect(DIRECTIONS.B.travel.resolveBeyondDiagonals).not.toBeNull();
    expect(DIRECTIONS.B.zoom.delayMs).toBeGreaterThan(0);
    expect(DIRECTIONS.C.field.velocityBreath).toBeGreaterThan(0);
    expect(DIRECTIONS.C.travel.settle).toMatchObject({ kind: 'spring', carriesVelocity: true });
    expect(DIRECTIONS.C.ignition.style).toBe('ripple');
    expect(new Set(DIRECTION_IDS.map((id) => DIRECTIONS[id].ignition.style)).size).toBe(3);
  });

  test('every direction keeps frequent motion calm: no settle over 300 ms for a temporal arrival, no spring below 0.7', () => {
    for (const id of DIRECTION_IDS) {
      const profile = DIRECTIONS[id];
      expect(profile.temporal.enterMs).toBeLessThanOrEqual(300);
      for (const spec of [profile.zoom.settle, profile.travel.settle, profile.disclosure.enterSettle, profile.temporal.enterSettle, profile.pan.cancelSettle]) {
        if (spec.kind === 'spring') expect(spec.dampingRatio).toBeGreaterThanOrEqual(0.7);
      }
    }
  });

  test('reduced motion is an alternate choreography: cuts and fades only, no stagger, no field, no depth simulation', () => {
    for (const id of DIRECTION_IDS) {
      const reduced = motionProfile(id, true);
      expect(reduced.travel.settle).toEqual({ kind: 'cut' });
      expect(reduced.zoom.settle).toEqual({ kind: 'cut' });
      expect(reduced.disclosure.enter).toBe('fade');
      expect(reduced.temporal.enter).toBe('fade');
      expect(reduced.disclosure.staggerMs).toBe(0);
      expect(reduced.field).toEqual({ velocityBreath: 0, arrivalBreath: 0 });
      expect(reduced.ignition.style).toBe('ring');
      expect(reduced.travel.resolveMs).toBeLessThanOrEqual(200);
      expect(motionProfile(id, false)).toBe(DIRECTIONS[id]);
    }
  });
});
