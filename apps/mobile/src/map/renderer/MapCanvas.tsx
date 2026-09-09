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
 *   an object that has just BECOME part of the current `V` resolves into legibility — locally, or
 *   out from the Home that hosts it along the very tether drawn beside it, and never from anywhere
 *   else. Which objects those are is decided by the surface, from a membership transition in the
 *   authoritative placement, and never by this renderer from what happens to have mounted.
 *
 * The screen-space register sits OUTSIDE the plane entirely. It does not translate with the camera,
 * does not scale with it, and does not dim when it moves: its position and its truth are unrelated
 * to where the camera is (R1-06).
 */
import { useLayoutEffect } from 'react';
import { Canvas, Circle, Group, Line, Rect, vec } from '@shopify/react-native-skia';

import {
  DisclosureArrival,
  disclosureArrivalPlan,
  type ArrivalRegistry,
  type PresentationCameraBinding,
  type PresentationMotionCause,
} from '../../motion';
import { envelopeCenter, type CanonicalCameraTransition, type ViewportEnvelope } from '../camera';
import type { PlacedNode, PlacedScene } from './map-geometry';
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

/**
 * What the surface decided about this commit's canonical camera.
 *
 * `reset` means there is no continuity to preserve at all — the authority itself was replaced, and
 * a residual carried across that boundary would present a travel between two unrelated worlds.
 */
export interface CanonicalCameraCommit {
  readonly transition: CanonicalCameraTransition | null;
  readonly reset: boolean;
  /** Records the commit once it has been applied, so the surface can keep its own history. */
  readonly commit: () => void;
  /**
   * The composite spatial cause of THIS transition, asked for at the instant it is applied.
   *
   * Invoked only in the branch that applies a transition, so it is asked once per canonical camera
   * change and never for a reset, a render that applies nothing, or a frame. This renderer neither
   * inspects the answer nor keeps it: it hands it to the presentation camera in the same call.
   */
  readonly cause: () => PresentationMotionCause | null;
}

export interface MapCanvasProps {
  readonly envelope: ViewportEnvelope;
  /** The presentation camera. Class D: never canonical, and never a route to one. */
  readonly motion: PresentationCameraBinding;
  /** The full `V`-derived placement. Hosts are looked up here, culled or not. */
  readonly placed: PlacedScene;
  /**
   * What may be on the glass during the current travel.
   *
   * Presentation culling, decided by the surface against the PRESENTED viewport rather than only
   * the final canonical one — an object still in current `V` must not vanish because a viewport it
   * has not reached yet does not contain it.
   */
  readonly presented: readonly PlacedNode[];
  /** The loci that became part of the current `V` in this commit. Never "what just mounted". */
  readonly newlyDisclosed: ReadonlySet<string>;
  /** Where paint and pointer read one arriving object's progress from one shared value. */
  readonly arrivals: ArrivalRegistry;
  readonly cameraCommit: CanonicalCameraCommit;
  readonly style?: RenderStyle;
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
 * Applies the surface's camera decision from INSIDE the Skia root, as the LAST child of the plane.
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
 * runs, and the surface has already read what changed.
 */
function PresentationCameraRebase({
  motion,
  cameraCommit,
}: {
  readonly motion: PresentationCameraBinding;
  readonly cameraCommit: CanonicalCameraCommit;
}) {
  const { transition, reset, commit, cause } = cameraCommit;

  useLayoutEffect(() => {
    if (reset) motion.reset();
    // The cause is asked for HERE and used in the same expression: there is one call per applied
    // transition, so the binding is consumed by the travel it belongs to and by nothing else.
    else if (transition !== null) motion.applyCanonicalChange(transition, cause());
    commit();
  }, [cause, commit, motion, reset, transition]);

  // A surface that stops painting this world leaves no residual behind for the next one to inherit.
  useLayoutEffect(() => () => motion.reset(), [motion]);

  return null;
}

export function MapCanvas({
  envelope,
  motion,
  placed,
  presented,
  newlyDisclosed,
  arrivals,
  cameraCommit,
  style = DEFAULT_RENDER_STYLE,
}: MapCanvasProps) {
  const center = envelopeCenter(envelope);
  const emptySpaceInset = 24;

  const arrivalOf = (node: PlacedNode) => {
    const host = hostOf(node, placed);
    return disclosureArrivalPlan({
      // A membership transition in the authoritative placement — never a mount, never a viewport
      // entry, never a remount, and never the camera having moved (R1-03).
      newlyDisclosed: newlyDisclosed.has(node.key),
      // The from-host origin is read from the SAME placement the tether is drawn from, so an
      // arrival can never travel along a relationship the renderer is not showing.
      hostOffset: host === undefined ? null : { x: host.x - node.x, y: host.y - node.y },
      reducedMotion: motion.reducedMotion,
    });
  };

  const planeNodes = presented.filter((node) => node.region === 'WORLD_PLANE');
  const registerNodes = presented.filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER');

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
      {/* The world plane: it travels with the camera, and it is the ONLY thing camera opacity
          reaches. A cut-and-resolve is a statement about the camera's path, and the register has
          no path (R1-06). */}
      <Group opacity={motion.planeOpacity}>
        <Group transform={motion.planeTransform} origin={vec(center.x, center.y)}>
          {planeNodes
            .filter((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE')
            .map((node) => {
              const host = hostOf(node, placed);
              if (host === undefined) return null;
              // The stroke is one point on the glass at every rung, so it is counter-scaled with
              // the objects it connects rather than thinned and thickened by the plane's residual.
              return (
                <Line key={`tether:${node.key}`} p1={vec(host.x, host.y)} p2={vec(node.x, node.y)} color={TETHER} strokeWidth={motion.objectScale} />
              );
            })}
          {planeNodes.map((node) => (
            // Two nested corrections, and the order matters. The arrival is OUTSIDE, so its
            // from-host travel is measured in the placement's own space and starts exactly at the
            // host as drawn. The counter-scale is INSIDE, so it corrects only the object's SIZE:
            // a radius is a screen quantity, the same number of points at every rung, and a plane
            // carrying a residual zoom would otherwise shrink every object to an eighth and grow
            // it back — an optical zoom wearing Semantic Zoom's clothes.
            <DisclosureArrival key={node.key} nodeKey={node.key} plan={arrivalOf(node)} originX={node.x} originY={node.y} registry={arrivals}>
              <Group transform={motion.objectTransform} origin={vec(node.x, node.y)}>
                <Circle cx={node.x} cy={node.y} r={node.radius} color={node.locus?.kind === 'THREAD_HOME' ? HOME_FILL : APPEARANCE_FILL} />
              </Group>
            </DisclosureArrival>
          ))}
          <PresentationCameraRebase motion={motion} cameraCommit={cameraCommit} />
        </Group>
      </Group>
      {/* Screen space. It does not translate, scale or dim with the camera; it changes only when
          its own current-`V` membership does, and then by its own local arrival. */}
      {registerNodes.map((node) => (
        <DisclosureArrival key={node.key} nodeKey={node.key} plan={arrivalOf(node)} originX={node.x} originY={node.y} registry={arrivals}>
          <Circle cx={node.x} cy={node.y} r={node.radius} color={REGISTER_FILL} />
        </DisclosureArrival>
      ))}
    </Canvas>
  );
}
