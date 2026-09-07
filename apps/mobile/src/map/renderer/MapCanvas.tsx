/**
 * T-04 — the structural Skia renderer.
 * T-10 — the same paint, under one presentation camera, with legitimate arrivals resolving in.
 *
 * It exists to prove the world mechanics, not to finish a visual language. Everything it paints
 * is a neutral placeholder: a plain wash, plain circles for entitled objects, plain tethers from
 * a contextual appearance to the Home that hosts it, and a plain strip for identities that have
 * no place. There is no typography, no colour system, no material, no iconography, no lifecycle
 * styling and no inspection chrome here — those are Phase VI's and the later chrome tasks', and
 * adding them now would make an unfinished decision look decided.
 *
 * What it does guarantee is truth: it paints exactly the scene derived from `V`, positioned by
 * the same placement function that hit testing uses, and nothing else. It cannot draw an object
 * the projection did not disclose, because it never receives one — and it cannot keep drawing one
 * the projection has stopped disclosing, because there is no exit path here at all. An object that
 * leaves the current `V` leaves the element tree in the same commit.
 *
 * Motion enters in exactly two places, both presentation:
 *
 *   the world plane carries the presentation camera's residual, so an already-authorized canonical
 *   camera change is shown as continuous travel through the same world rather than as a teleport;
 *
 *   an object that is NEW in the current `V` resolves into legibility — locally, or out from the
 *   Home that hosts it along the very tether drawn beside it, and never from anywhere else.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, Circle, Group, Line, Rect, vec } from '@shopify/react-native-skia';

import { DisclosureArrival, createBox, disclosureArrivalPlan, type PresentationCameraBinding } from '../../motion';
import { cameraTransition, envelopeCenter, type MapCamera, type ViewportEnvelope } from '../camera';
import type { MapScene } from '../projection';
import { placeScene, type PlacedNode, type PlacedScene } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';

export const MAP_CANVAS_TEST_ID = 'qandeel-map-canvas';

/** Neutral placeholder palette: grey values only, so nothing here reads as a Product decision. */
const GROUND = 'rgb(246,246,244)';
const AMBIENT = 'rgb(226,226,222)';
const EMPTY_SPACE = 'rgb(208,208,204)';
const HOME_FILL = 'rgb(64,64,62)';
const APPEARANCE_FILL = 'rgb(126,126,122)';
const TETHER = 'rgb(178,178,174)';
const REGISTER_FILL = 'rgb(150,150,146)';

export interface MapCanvasProps {
  readonly scene: MapScene;
  readonly camera: MapCamera;
  readonly envelope: ViewportEnvelope;
  /** The presentation camera. Class D: never canonical, and never a route to one. */
  readonly motion: PresentationCameraBinding;
  readonly style?: RenderStyle;
  /** Supplied by a caller that already placed the scene, so paint and hit testing share one placement. */
  readonly placed?: PlacedScene;
}

/** The Home that hosts a contextual appearance, in THIS placement, or `undefined`. */
function hostOf(node: PlacedNode, placement: PlacedScene): PlacedNode | undefined {
  if (node.locus?.kind !== 'CONTEXTUAL_APPEARANCE') return undefined;
  const threadId = node.locus.threadId;
  return placement.nodes.find(
    (candidate) => candidate.region === 'WORLD_PLANE' && candidate.locus?.kind === 'THREAD_HOME' && candidate.locus.threadId === threadId,
  );
}

/**
 * Re-bases the presentation camera from INSIDE the Skia root, as the LAST child of the plane.
 *
 * This position is load-bearing and was found the expensive way. The Skia canvas reconciles its
 * children in its own React root, which commits after the surrounding surface's own commit. A
 * rebase issued from the surface therefore reaches the renderer one paint BEFORE the nodes' new
 * positions do, and that paint draws the old positions under the new residual — a one-frame lie
 * about where the world is, of exactly the class §13 forbids. Issued here, in a layout effect of
 * the same inner commit that writes those positions, and after them because siblings run in order,
 * the residual and the positions land together.
 *
 * It renders nothing and it decides nothing: the canonical camera has already moved before this
 * runs, and this only relates the two projections of the same world.
 */
function PresentationCameraRebase({
  motion,
  camera,
  envelope,
}: {
  readonly motion: PresentationCameraBinding;
  readonly camera: MapCamera;
  readonly envelope: ViewportEnvelope;
}) {
  const previous = useRef<MapCamera | null>(null);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = camera;
    // Nothing to relate on the first commit: there is no earlier frame to preserve.
    if (before === null) return;
    const transition = cameraTransition(before, camera, envelope);
    // `null` is a camera that did not move. A depth-only change is exactly that: the rung is
    // disclosure, and disclosure is not a camera move.
    if (transition === null) return;
    motion.applyCanonicalChange(transition);
  }, [camera, envelope, motion]);

  // A surface that stops painting this world leaves no residual behind for the next one to inherit.
  useLayoutEffect(() => () => motion.reset(), [motion]);

  return null;
}

export function MapCanvas({ scene, camera, envelope, motion, style = DEFAULT_RENDER_STYLE, placed }: MapCanvasProps) {
  const placement = placed ?? placeScene(scene, camera, envelope);
  const center = useMemo(() => envelopeCenter(envelope), [envelope]);
  const emptySpaceInset = 24;

  // The first painted frame is not an arrival: objects are simply where they belong. Only what
  // becomes legitimate AFTER the world is on screen has somewhere to resolve from. A box, set
  // once after the first commit — not state, because flipping state from an effect would cost a
  // cascading render on every mount to say something that changes nothing about what is drawn.
  const [painted] = useState(() => createBox(false));
  const established = painted.get();
  useLayoutEffect(() => {
    painted.set(true);
  }, [painted]);

  const arrivalOf = (node: PlacedNode) => {
    const host = hostOf(node, placement);
    return disclosureArrivalPlan({
      established,
      // The from-host origin is read from the SAME placement the tether is drawn from, so an
      // arrival can never travel along a relationship the renderer is not showing.
      hostOffset: host === undefined ? null : { x: host.x - node.x, y: host.y - node.y },
      reducedMotion: motion.reducedMotion,
    });
  };

  return (
    <Canvas testID={MAP_CANVAS_TEST_ID} style={{ width: envelope.width, height: envelope.height }}>
      <Rect x={0} y={0} width={envelope.width} height={envelope.height} color={GROUND} />
      {/* OPEN-17: the two tunable channels paint, and only paint. */}
      <Rect x={0} y={0} width={envelope.width} height={envelope.height} color={AMBIENT} opacity={style.ambient} />
      <Rect
        x={emptySpaceInset}
        y={emptySpaceInset}
        width={Math.max(0, envelope.width - 2 * emptySpaceInset)}
        height={Math.max(0, envelope.height - 2 * emptySpaceInset)}
        color={EMPTY_SPACE}
        opacity={style.emptySpace * 0.35}
      />
      <Group opacity={motion.planeOpacity}>
        {/* The world plane carries the residual; the register does not, because it is screen space. */}
        <Group transform={motion.planeTransform} origin={vec(center.x, center.y)}>
          {placement.visibleNodes
            .filter((node) => node.region === 'WORLD_PLANE' && node.locus?.kind === 'CONTEXTUAL_APPEARANCE')
            .map((node) => {
              const host = hostOf(node, placement);
              if (host === undefined) return null;
              // The stroke is one point on the glass at every rung, so it is counter-scaled with
              // the objects it connects rather than thinned and thickened by the plane's residual.
              return (
                <Line key={`tether:${node.key}`} p1={vec(host.x, host.y)} p2={vec(node.x, node.y)} color={TETHER} strokeWidth={motion.objectScale} />
              );
            })}
          {placement.visibleNodes
            .filter((node) => node.region === 'WORLD_PLANE')
            .map((node) => (
              // Two nested corrections, and the order matters. The arrival is OUTSIDE, so its
              // from-host travel is measured in the placement's own space and starts exactly at the
              // host as drawn. The counter-scale is INSIDE, so it corrects only the object's SIZE:
              // a radius is a screen quantity, the same number of points at every rung, and a plane
              // carrying a residual zoom would otherwise shrink every object to an eighth and grow
              // it back — an optical zoom wearing Semantic Zoom's clothes.
              <DisclosureArrival key={node.key} plan={arrivalOf(node)} originX={node.x} originY={node.y}>
                <Group transform={motion.objectTransform} origin={vec(node.x, node.y)}>
                  <Circle cx={node.x} cy={node.y} r={node.radius} color={node.locus?.kind === 'THREAD_HOME' ? HOME_FILL : APPEARANCE_FILL} />
                </Group>
              </DisclosureArrival>
            ))}
          <PresentationCameraRebase motion={motion} camera={camera} envelope={envelope} />
        </Group>
        {placement.visibleNodes
          .filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER')
          .map((node) => (
            <DisclosureArrival key={node.key} plan={arrivalOf(node)} originX={node.x} originY={node.y}>
              <Circle cx={node.x} cy={node.y} r={node.radius} color={REGISTER_FILL} />
            </DisclosureArrival>
          ))}
      </Group>
    </Canvas>
  );
}
