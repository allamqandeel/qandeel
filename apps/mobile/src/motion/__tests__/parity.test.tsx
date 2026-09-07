/**
 * T-10 — reduced motion, accessibility, RTL and the Meaning Ignition disposition.
 *
 * Three of these are parity claims and one is an absence claim, and all four are the kind that a
 * screenshot cannot make. Parity here means Product capability, not visual similarity: the same
 * acts are offered, the same canonical state is reached, and nothing a reader needs is carried by
 * motion alone. The absence claim is stronger than a disabled feature — the cue does not exist.
 */
import { act, render } from '@testing-library/react-native';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../../map/__fixtures__/store';
import { MAP_ACCESSIBILITY_TEST_ID, MAP_SURFACE_PLANE_TEST_ID, MapSurface, decodeCameraIntent, hitTest, placeScene } from '../../map';
import { TEMPORAL_MOTION_DURATIONS, temporalMotionPlan } from '../../temporal-navigation';
import { MOTION_DURATIONS_MS, disclosureArrivalPlan, presentationTravelPlan } from '..';

const MOTION_DIR = join(__dirname, '..');

function sources(dir: string): { file: string; text: string }[] {
  const found: { file: string; text: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__fixtures__') continue;
      found.push(...sources(full));
      continue;
    }
    if (/\.tsx?$/u.test(entry)) found.push({ file: entry, text: readFileSync(full, 'utf8') });
  }
  return found;
}

/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
const MOTION_CODE = sources(MOTION_DIR).map((entry) => ({ ...entry, text: code(entry.text) }));
const MOTION_TEXT = MOTION_CODE.map((entry) => entry.text).join('\n');

const WORLD = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: [
      { id: 'thread-a', x: '0', y: '0' },
      { id: 'thread-b', x: '400000', y: '0' },
    ],
    appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
    readings: [{ id: 'reading-1' }],
  });

describe('T10-A56, A57, A58 — reduced motion changes the transition and nothing else', () => {
  afterEach(() => {
    (globalThis as Record<string, unknown>).__QANDEEL_TEST_REDUCED_MOTION__ = false;
  });

  it('every travel becomes a cut and an opacity resolve, and no x, y or z moves', () => {
    const reduced = presentationTravelPlan({
      residual: { tx: 1800, ty: -600, zoom: 8 },
      viewportDiagonalPoints: 928,
      representable: true,
      reducedMotion: true,
      depthChanged: true,
      cause: null,
    });
    expect(reduced.translationMs).toBe(0);
    expect(reduced.zoomMs).toBe(0);
    expect(reduced.resolveMs).toBe(MOTION_DURATIONS_MS.reducedResolve);
    const arrival = disclosureArrivalPlan({ newlyDisclosed: true, hostOffset: { x: -40, y: 40 }, reducedMotion: true });
    expect(arrival.fromX).toBe(0);
    expect(arrival.fromY).toBe(0);
    expect(arrival.fromScale).toBe(1);
  });

  it('the temporal layer keeps the same targets, preview, commit and cancellation', () => {
    const input = { committedSp: 4, previewSp: 7, mode: 'PINNED' as const, dragging: false };
    const standard = temporalMotionPlan({ ...input, reducedMotion: false });
    const reduced = temporalMotionPlan({ ...input, reducedMotion: true });
    expect(reduced.cursorSp).toBe(standard.cursorSp);
    expect(reduced.committedSp).toBe(standard.committedSp);
    expect(reduced.previewPresent).toBe(standard.previewPresent);
    expect(reduced.temporalStance).toBe(standard.temporalStance);
    // Only the transition changed. The presence bridge is opacity and survives; movement does not.
    expect(reduced.cursorMs).toBe(0);
    expect(reduced.cancelMs).toBe(0);
    expect(reduced.commitSettleMs).toBe(0);
    expect(reduced.presenceMs).toBe(standard.presenceMs);
  });

  it('the refined temporal numbers stay inside their frozen bands (A41, A42, A43)', () => {
    // T-10 §10: a cancellation is the system answering, and must not exceed ~200 ms.
    expect(TEMPORAL_MOTION_DURATIONS.cancelMs).toBeLessThanOrEqual(200);
    expect(TEMPORAL_MOTION_DURATIONS.commitSettleMs).toBeLessThanOrEqual(200);
    // Frequent local resolve stays frequent-local.
    expect(TEMPORAL_MOTION_DURATIONS.cursorMs).toBeLessThanOrEqual(200);
    expect(TEMPORAL_MOTION_DURATIONS.presenceMs).toBeLessThanOrEqual(200);
    // A finger owns the frame: no easing at all while it is down.
    expect(temporalMotionPlan({ committedSp: 4, previewSp: 7, mode: 'PINNED', dragging: true, reducedMotion: false }).cursorMs).toBe(0);
  });
});

describe('T10-A59, A60, A61 — the accessible route never waits for, and is never blocked by, motion', () => {
  it('A60 — the semantic layer lets a pointer miss through to the world underneath', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, WORLD());
    const rendered = await render(<MapSurface store={store} context={context} envelope={envelope()} />);
    const layer = rendered.getByTestId(MAP_ACCESSIBILITY_TEST_ID);
    // `box-none`: the container itself can never become the touch target, so a drag and a miss
    // both reach the plane below it. Its own nodes stay reachable — accessibility does not route
    // through pointer events at all.
    expect(layer.props.pointerEvents).toBe('box-none');
    expect(rendered.getByTestId(MAP_SURFACE_PLANE_TEST_ID)).toBeTruthy();
  });

  it('A59, A61 — an accessible act runs immediately, with no settle to wait for', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, WORLD());
    const rendered = await render(<MapSurface store={store} context={context} envelope={envelope()} />);
    // Two acts back to back, with no animation between them and nothing to complete first.
    await act(async () => {
      rendered.getByTestId(MAP_ACCESSIBILITY_TEST_ID).props.onAccessibilityAction({ nativeEvent: { actionName: 'explore-right' } });
    });
    await act(async () => {
      rendered.getByTestId(MAP_ACCESSIBILITY_TEST_ID).props.onAccessibilityAction({ nativeEvent: { actionName: 'explore-up' } });
    });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['PAN', 'PAN']);
    // Each node is still its own accessible element after the camera moved twice.
    for (const key of context.scene.keys) {
      expect(rendered.getByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:${key}`).props.accessible).toBe(true);
    }
  });
});

describe('T10-A62, A63 — the world is a world, not reading-order content', () => {
  it('no motion module knows about writing direction, mirroring or a side of the screen', () => {
    for (const forbidden of ['I18nManager', 'isRTL', 'rtl', 'direction', 'writingDirection', 'marginStart', 'marginEnd', 'flexDirection']) {
      expect(MOTION_TEXT.includes(forbidden)).toBe(false);
    }
  });

  it('the drag is physical: the plane follows the finger, not a logical axis', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, WORLD());
    const decoded = decodeCameraIntent(store.getState().camera);
    if (!decoded.ok) throw new Error(decoded.detail);
    const placed = placeScene(context.scene, decoded.camera, envelope());
    const home = placed.visibleNodes.find((node) => node.locus?.kind === 'THREAD_HOME');
    if (home === undefined) throw new Error('expected a placed Home');
    // Placement is derived from canonical addresses through one transform. There is no branch on
    // language or direction anywhere between a world address and a screen point.
    expect(hitTest(placed, { x: home.x, y: home.y })?.key).toBe(home.key);
  });
});

describe('T10-A64…A72 — Meaning Ignition: MEANING_IGNITION_TRIGGER_DEFERRED_TO_T12', () => {
  it('A64 — no production cue surface exists at all', () => {
    // Word-bounded: `withSpring` and `string` legitimately contain "ring", and a needle that
    // matched them would be a guard that cannot ever be satisfied rather than one that means
    // anything.
    for (const forbidden of [/\bignition\b/iu, /\bbrass\b/iu, /\bring\b/iu, /\bbloom\b/iu, /\bripple\b/iu, /\bglow\b/iu, /\bhalo\b/iu]) {
      expect(MOTION_TEXT).not.toMatch(forbidden);
    }
  });

  it('A65…A69 — there is no trigger to fire from a fetch, a remount, a preview, a return or a zoom', () => {
    // The absence is structural rather than conditional: no module in this owner can even OBSERVE
    // a live advancement, a fetch completion or a Live Focus transition, so no cue can be wired to
    // one later by accident.
    for (const forbidden of ['LIVE_HEAD_ADVANCED', 'LIVE_FOCUS_TRANSITION', 'ingest(', 'FOLLOW_LIVE', 'liveHead', 'LH', 'fetch(']) {
      expect(MOTION_TEXT.includes(forbidden)).toBe(false);
    }
  });

  it('A70, A71 — nothing in this owner can move or mark a neighbour, or any object it was not given', () => {
    // Every presentation primitive here is scoped to ONE object or to the whole plane. There is no
    // neighbour query, no distance-to-other-node arithmetic and no per-object broadcast.
    for (const forbidden of ['neighbour', 'neighbor', 'rippleRadius', 'nearest', 'within(']) {
      expect(MOTION_TEXT.includes(forbidden)).toBe(false);
    }
  });

  it('A72 — and there is no cue whose reduced form could grow', () => {
    for (const forbidden of ['withRepeat', 'Infinity', 'repeat(', 'loop']) {
      expect(MOTION_TEXT.includes(forbidden)).toBe(false);
    }
  });
});

describe('T10 §16 — the hard creative rejections are absent by construction', () => {
  it('no field response, breath, veil, stagger, ghost or lock frame exists in the motion owner', () => {
    for (const forbidden of [
      'breath',
      'Breath',
      'veil',
      'Veil',
      'stagger',
      'Stagger',
      'ghost',
      'Ghost',
      'trail',
      'Trail',
      'shimmer',
      'blur',
      'Blur',
      'particle',
      'skeleton',
      'overshoot',
      'velocity',
      'Velocity',
      'useFrameCallback',
      'withDecay',
      'setInterval',
      'setTimeout',
      'requestAnimationFrame',
    ]) {
      expect(MOTION_TEXT.includes(forbidden)).toBe(false);
    }
    for (const forbidden of [/\block\b/iu, /\bloop\b/iu, /\bpulse\b/iu, /\bparallax\b/iu]) {
      expect(MOTION_TEXT).not.toMatch(forbidden);
    }
  });

  it('A39 — the plane is never dimmed because a Preview exists', () => {
    // The motion owner cannot see a Preview at all: no import, no snapshot, no PTC, no controller.
    for (const forbidden of ['Preview', 'preview', 'PTC', 'temporal-navigation', 'commitPreviewed']) {
      expect(MOTION_TEXT.includes(forbidden)).toBe(false);
    }
  });

  it('no module in this owner can reach a store, an executor or a dispatch (PM-01)', () => {
    for (const forbidden of ['CanonicalStore', 'CanonicalState', 'dispatch', 'store.', 'getState', '../state', '../../state', '../map', '../../map']) {
      expect(MOTION_TEXT.includes(forbidden)).toBe(false);
    }
  });
});
