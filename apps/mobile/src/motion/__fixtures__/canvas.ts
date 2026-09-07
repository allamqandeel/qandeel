/**
 * T-10 R1 — the renderer's prop bundle, for tests that drive `MapCanvas` directly.
 *
 * The surface now decides three things the renderer used to decide for itself — what may be on the
 * glass during a travel, which loci became part of `V`, and what to do about the canonical camera —
 * so a test that renders the canvas alone has to supply them. Defaulting them to "at rest, nothing
 * new, nothing to commit" keeps every existing paint assertion about paint.
 */
import type { ArrivalRegistry, PresentationCameraBinding } from '..';
import { createArrivalRegistry } from '..';
import type { CanonicalCameraTransition, ViewportEnvelope } from '../../map';
import type { MapCanvasProps, PlacedNode, PlacedScene, RenderStyle } from '../../map';

export interface CanvasPropsOptions {
  readonly placed: PlacedScene;
  readonly motion: PresentationCameraBinding;
  readonly envelope: ViewportEnvelope;
  readonly presented?: readonly PlacedNode[];
  readonly newlyDisclosed?: readonly string[];
  readonly arrivals?: ArrivalRegistry;
  readonly transition?: CanonicalCameraTransition | null;
  readonly reset?: boolean;
  readonly commit?: () => void;
  readonly style?: RenderStyle;
}

const NOOP = () => undefined;

export function canvasProps(options: CanvasPropsOptions): MapCanvasProps {
  const base: MapCanvasProps = {
    envelope: options.envelope,
    motion: options.motion,
    placed: options.placed,
    // At rest, the presented set IS the resting viewport set: a still world paints what it always
    // painted, and no test has to opt out of presentation culling to assert about paint.
    presented: options.presented ?? options.placed.visibleNodes,
    newlyDisclosed: new Set(options.newlyDisclosed ?? []),
    arrivals: options.arrivals ?? createArrivalRegistry(),
    cameraCommit: {
      transition: options.transition ?? null,
      reset: options.reset === true,
      commit: options.commit ?? NOOP,
    },
  };
  return options.style === undefined ? base : { ...base, style: options.style };
}
