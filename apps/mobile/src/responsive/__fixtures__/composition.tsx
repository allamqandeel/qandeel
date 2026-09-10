/**
 * T-11 — the proof composition: the REAL Map, the REAL temporal surface and the REAL chrome, inside
 * the responsive owner.
 *
 * Nothing here is a stand-in. The store is the production kernel with the production authorities,
 * the disclosures are wire-legal, the Map is `MapSurface` over its own measured envelope, the
 * Timeline is `TemporalTargetLayer` over T-05's own presentation controller, and the chrome is
 * `OrientationChrome` with its own words. What the responsive layer contributes is the ROOM they
 * are composed in, which is exactly what is under test.
 *
 * It is a TEST composition and it is deliberately not the app shell. Where these three surfaces
 * finally sit together in the Product, which locale is spoken, and where insets and Dynamic Type
 * come from are the integration task's decisions; mounting this to "prove integration" would steal
 * them.
 *
 * ## What a simulated layout does and does not prove
 *
 * There is no Yoga in the test renderer, so `onLayout` never fires by itself. `resize` fires it —
 * on the outer surface with the window under test, and on the Map's frame with the room a column of
 * [world, Timeline row, chrome band] would leave it. That proves everything the responsive owner
 * does GIVEN a measurement: the plan, the envelope, the parity, the ownership, the continuity. It
 * does not prove that the platform produces that measurement, and it is never cited as if it did —
 * real layout is proven by the browser proof and by the exact-head native gates.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { act, fireEvent, type RenderResult } from '@testing-library/react-native';

import { MapSurface, viewportEnvelope, type MapInspectionContext } from '../../map';
import type { MapActionOutcome } from '../../map';
import { OrientationChrome, type ChromeLanguage } from '../../orientation-chrome';
import type { CanonicalStore } from '../../state';
import { createPresentationController, type PresentationController } from '../../timeline';
import { createTemporalPreviewController, TemporalTargetLayer, type TemporalOutcome, type TemporalPreviewController } from '../../temporal-navigation';
import { chromeSurface } from '../../orientation-chrome/__fixtures__/chrome';
import { MAP_MIN_HEIGHT_POINTS, WORLD_SHARE_DENOMINATOR, type RecompositionPlan } from '../plan';
import { RESPONSIVE_CHROME_BAND_TEST_ID, ResponsiveChromeBand } from '../ResponsiveChromeBand';
import { ResponsiveSupportBand } from '../ResponsiveSupportBand';
import { RESPONSIVE_MAP_FRAME_TEST_ID, ResponsiveMapFrame } from '../ResponsiveMapFrame';
import { RESPONSIVE_SURFACE_TEST_ID, ResponsiveSurface } from '../ResponsiveSurface';
import { RESPONSIVE_TIMELINE_ROW_TEST_ID, ResponsiveTimelineRow } from '../ResponsiveTimelineRow';
import type { ResponsiveInsets } from '../useResponsiveSurface';

export const RESPONSIVE_PLAN_PROBE_TEST_ID = 'qandeel-responsive-plan-probe';

export interface ResponsiveWorldProps {
  readonly store: CanonicalStore;
  readonly context: MapInspectionContext;
  readonly language?: ChromeLanguage;
  readonly preview: TemporalPreviewController;
  readonly presentation: PresentationController;
  readonly insets?: ResponsiveInsets;
  readonly fontScale?: number;
  readonly onMap?: (outcome: MapActionOutcome | { readonly outcome: string }) => void;
  readonly onTemporal?: (outcome: TemporalOutcome) => void;
  readonly onReturn?: (id: string) => void;
  /** Observes every plan the surface composes, so a test can read the composition it is asserting on. */
  readonly onPlan?: (plan: RecompositionPlan) => void;
}

/**
 * The world, the disclosed temporal track and the support around them — one column, at every width.
 *
 * There is no arrangement to switch into: no sidebar, no inspector, no dashboard column and no
 * second Product for a larger window. What a larger window changes is how much of the same world is
 * visible and how much air the same words are given.
 */
export function ResponsiveWorld({
  store,
  context,
  language = 'en',
  preview,
  presentation,
  insets,
  fontScale,
  onMap,
  onTemporal,
  onReturn,
  onPlan,
}: ResponsiveWorldProps) {
  return (
    <ResponsiveSurface insets={insets} fontScale={fontScale}>
      {(plan) => {
        onPlan?.(plan);
        return (
          <>
            <View testID={RESPONSIVE_PLAN_PROBE_TEST_ID} accessibilityRole="none" pointerEvents="none" />
            <ResponsiveMapFrame frame={plan.mapFrame}>
              {(rect) => {
                const envelope = viewportEnvelope(rect.width, rect.height, {
                  top: rect.insetTop,
                  right: rect.insetRight,
                  bottom: rect.insetBottom,
                  left: rect.insetLeft,
                });
                // The responsive owner refuses the same rects T-04's own validator refuses, so this
                // is never null for a rect the frame produced. It is checked rather than asserted
                // because a surface that cannot be composed renders nothing, and never a guess.
                return envelope === null ? null : <MapSurface store={store} context={context} envelope={envelope} onOutcome={onMap} />;
              }}
            </ResponsiveMapFrame>

            {/* The proof composition holds the SAME band as the Product one, so what a reviewer looks
                at and what the contract checks are the same arrangement. */}
            <ResponsiveSupportBand support={plan.support}>
            <ResponsiveTimelineRow widthPoints={plan.timelineWidthPoints} paddingHorizontal={plan.chrome.paddingHorizontal} support={plan.support}>
              <TemporalTargetLayer store={store} preview={preview} presentation={presentation} onOutcome={onTemporal} />
            </ResponsiveTimelineRow>

            <ResponsiveChromeBand chrome={plan.chrome} support={plan.support}>
              <OrientationChrome
                surface={chromeSurface(store, preview)}
                language={language}
                projection={{ held: true, context }}
                liveContext={() => ({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'none' })}
                onMapOutcome={onMap}
                onReturnOutcome={(id) => onReturn?.(id)}
                bottomInset={plan.chrome.bottomInset}
                returnArrangement={plan.chrome.arrangement}
              />
            </ResponsiveChromeBand>
            </ResponsiveSupportBand>
          </>
        );
      }}
    </ResponsiveSurface>
  );
}

export interface ResizeOptions {
  readonly insetTop?: number;
  readonly insetBottom?: number;
  readonly insetLeft?: number;
  readonly insetRight?: number;
  /** The room the chrome band is assumed to take, for the simulated column. */
  readonly chromeHeight?: number;
  /** An explicit Map frame height, when a test needs one the column would not produce. */
  readonly mapHeight?: number;
}

/**
 * The Map frame's height, as the layout engine would resolve it.
 *
 * The world is sized first — `flexGrow: 1, flexShrink: 0` over the plan's basis — so its height is
 * the basis whenever the support around it wants more than the remainder, which is every case in
 * this envelope: T-05's and T-06's accessible non-drag routes alone are several hundred points
 * tall. This is the platform's arithmetic, written out because the test renderer has no layout
 * engine, and it is the ONLY place a simulated measurement is produced.
 */
export function simulatedMapHeight(height: number, options: ResizeOptions = {}): number {
  const usable = height - (options.insetTop ?? 0) - (options.insetBottom ?? 0);
  return Math.max(MAP_MIN_HEIGHT_POINTS, Math.round(usable / WORLD_SHARE_DENOMINATOR));
}

/** Fires the layout the platform would report, on the outer surface and on the Map's own frame. */
export async function resize(view: RenderResult, width: number, height: number, options: ResizeOptions = {}): Promise<void> {
  const mapHeight = options.mapHeight ?? simulatedMapHeight(height, options);
  await act(async () => {
    fireEvent(view.getByTestId(RESPONSIVE_SURFACE_TEST_ID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
  });
  const frames = view.queryAllByTestId(RESPONSIVE_MAP_FRAME_TEST_ID);
  if (frames.length === 0) return;
  await act(async () => {
    fireEvent(frames[0], 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: mapHeight } } });
  });
}

/** Every node of a subtree, flattened — the same walk T-08's own composition proof uses. */
export function nodes(root: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (root === null || root === undefined || typeof root !== 'object') return out;
  if (Array.isArray(root)) {
    for (const child of root) nodes(child, out);
    return out;
  }
  const element = root as { type?: string; props?: Record<string, unknown>; children?: unknown };
  if (typeof element.type === 'string') out.push(element as Record<string, unknown>);
  nodes(element.children, out);
  return out;
}

/** A node that can take a press: React Native gives every real target the responder handlers. */
export const isPressTarget = (node: Record<string, unknown>): boolean =>
  typeof ((node.props ?? {}) as Record<string, unknown>).onStartShouldSetResponder === 'function';

export const subtree = (view: RenderResult, testID: string): Record<string, unknown>[] => nodes(view.getByTestId(testID));

/** The two controllers a composed temporal surface needs, over one disclosed prefix. */
export function temporalControllers(track: Parameters<typeof createPresentationController>[0], viewport = 0) {
  return { preview: createTemporalPreviewController(), presentation: createPresentationController(track, viewport) };
}

export { RESPONSIVE_CHROME_BAND_TEST_ID, RESPONSIVE_MAP_FRAME_TEST_ID, RESPONSIVE_SURFACE_TEST_ID, RESPONSIVE_TIMELINE_ROW_TEST_ID };
export type { ReactNode };
