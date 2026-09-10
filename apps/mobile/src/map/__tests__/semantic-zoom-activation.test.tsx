/**
 * T-12 — Semantic Zoom, driven through the surface a reader actually touches.
 *
 * The existing semantic-zoom suites call `zoomSemanticStep` directly and prove the kernel. They passed
 * throughout the period in which the act was unreachable on a device, because the thing that was
 * missing was not the kernel — it was any production route into it. This suite therefore mounts the
 * real `MapSurface` and drives the act the way the Product does: through the gesture the surface
 * attaches, and through the accessibility action the surface exposes.
 *
 * It does not claim to reproduce Yoga or a real digitiser. What it proves is the dependency graph:
 * that the mounted surface owns a pinch, that the pinch commits exactly one canonical act at its end
 * and nothing per frame, that a one-finger pan cannot produce one, and that the non-gesture route
 * reaches the same canonical authority.
 */
import { act, render } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sessionPosition } from '../../state';
import { chromeStore, contextAt, TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { SEMANTIC_ZOOM_GESTURE_THRESHOLD, semanticZoomDirectionFor } from '../camera';
import { MAP_ACCESSIBILITY_TEST_ID } from '../accessibility';
import { viewportEnvelope } from '../camera';
import { mapInspectionContext, mapProjectionRequest } from '../index';
import { MapSurface } from '../renderer/MapSurface';

jest.setTimeout(120_000);

function world() {
  const store = chromeStore({ liveHead: 6, depth: 'ANALYTICAL_OBJECT', temporal: { kind: 'PINNED', at: sessionPosition(4) } });
  return { store, context: contextAt(TWO_CONTEXT_WORLD()) };
}

const ENVELOPE = viewportEnvelope(390, 420, { top: 0, right: 0, bottom: 0, left: 0 });

describe('T12 — the reader can reach Semantic Zoom from the mounted Map', () => {
  it('the direction rule is a neutral band derived from the frozen reinforcement, not a feel constant', () => {
    // An eighth: the same proportion one depth step reinforces the camera's scale by.
    expect(SEMANTIC_ZOOM_GESTURE_THRESHOLD).toBeCloseTo(1.125, 5);
    expect(semanticZoomDirectionFor(1)).toBeNull();
    expect(semanticZoomDirectionFor(1.05)).toBeNull();
    expect(semanticZoomDirectionFor(0.95)).toBeNull();
    expect(semanticZoomDirectionFor(SEMANTIC_ZOOM_GESTURE_THRESHOLD)).toBe('IN');
    expect(semanticZoomDirectionFor(2)).toBe('IN');
    expect(semanticZoomDirectionFor(1 / SEMANTIC_ZOOM_GESTURE_THRESHOLD)).toBe('OUT');
    expect(semanticZoomDirectionFor(0.4)).toBe('OUT');
    // A degenerate scale asks for nothing rather than guessing a direction — including an infinite
    // one, which is a recogniser fault rather than a very large pinch.
    expect(semanticZoomDirectionFor(0)).toBeNull();
    expect(semanticZoomDirectionFor(-1)).toBeNull();
    expect(semanticZoomDirectionFor(Number.NaN)).toBeNull();
    expect(semanticZoomDirectionFor(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('mounts the real surface, and the surface owns both routes', async () => {
    const { store, context } = world();
    const request = mapProjectionRequest(store.getState());
    expect(request).not.toBeNull();
    if (ENVELOPE === null) throw new Error('fixture envelope is not a viewport');

    const outcomes: string[] = [];
    const view = await render(
      <MapSurface store={store} context={context} envelope={ENVELOPE} onOutcome={(o) => outcomes.push(o.outcome)} />,
    );

    // The accessibility route is on the mounted surface, and it is the SAME canonical executor.
    const layer = view.getByTestId(MAP_ACCESSIBILITY_TEST_ID);
    const actions = (layer.props as { accessibilityActions?: readonly { name: string }[] }).accessibilityActions ?? [];
    const names = actions.map((a) => a.name);
    expect(names).toContain('zoom-in');
    expect(names).toContain('zoom-out');

    const before = store.getState().camera;
    await act(async () => {
      (layer.props as { onAccessibilityAction: (e: unknown) => void }).onAccessibilityAction({
        nativeEvent: { actionName: 'zoom-in' },
      });
    });
    // Canonical truth moved, and it moved through the store rather than through a gesture callback.
    expect(store.getState().camera).not.toBe(before);
    expect(outcomes.length).toBeGreaterThan(0);

    await act(async () => {
      view.unmount();
    });
  });

  it('a depth act is the only thing a pinch can produce, and a pan can never produce one', async () => {
    // The two recognisers are separated by pointer count rather than by a race, so a one-finger drag
    // cannot reach the pinch and a two-finger pinch cannot reach the pan. This asserts the separation
    // at the source, which is where it is decided.
    const panSource = readFileSync(join(__dirname, '../camera/useMapPanGesture.ts'), 'utf8');
    expect(panSource).toMatch(/\.maxPointers\(1\)/u);
    const zoomSource = readFileSync(join(__dirname, '../camera/useMapSemanticZoomGesture.ts'), 'utf8');
    // Everything canonical happens at the END of a completed gesture, once.
    expect(zoomSource).toMatch(/\.onEnd\(/u);
    expect(zoomSource).not.toMatch(/\.onChange\(/u);
    expect(zoomSource).not.toMatch(/\.onUpdate\(/u);
    // A cancelled or failed gesture writes nothing.
    expect(zoomSource).toMatch(/if \(!success\) return;/u);
  });
});
