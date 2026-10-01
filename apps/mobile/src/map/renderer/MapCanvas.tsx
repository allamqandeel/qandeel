/**
 * T-04 — the structural Skia renderer.
 * T-10 — the same paint, under one presentation camera, with legitimate arrivals resolving in.
 * VPORT-01 — the same scene, now painted as the canonical I-08B1 Living Analysis World.
 *
 * Until VPORT-01 everything this file painted was a neutral placeholder. It now paints the frozen world
 * (`../visual`): the cosmos ground and the world's floor, three world-anchored atmosphere strata, each
 * Thread's Home as a place the world makes room for, each contextual Reading in the canonical object
 * material, the hosting relation in the canonical connection grammar, and the ungeographic register
 * as marks with no place. Every colour, falloff, proportion and distance response is generated from
 * the closed I-08B1 source and the frozen token tree; nothing below is a literal of its own.
 *
 * What it still guarantees is truth, and that has not moved: it paints exactly the scene derived from
 * `V`, positioned by the same placement function that hit testing uses, and nothing else. It cannot
 * draw an object the projection did not disclose, because it never receives one — and it cannot keep
 * drawing one the projection has stopped disclosing, because there is no exit path here at all. An
 * object that leaves the current `V` leaves the element tree in the same commit. It draws no relation
 * but the hosting one the placement holds, no name, and no light that would say something about an
 * object beyond what it is: the canonical light is constant per tier and asserts no rank.
 *
 * Motion enters in exactly the two places it always did, both presentation:
 *
 *   the world plane carries the presentation camera's residual, so an already-authorized canonical
 *   camera change is shown as continuous travel through the same world rather than as a teleport —
 *   and the world's material reads that same residual, so FAR, MID and NEAR resolve into one another
 *   on the plane's own frames instead of switching when the camera lands;
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
import { Canvas, Group, vec } from '@shopify/react-native-skia';

import {
  DisclosureArrival,
  disclosureArrivalPlan,
  type ArrivalRegistry,
  type PresentationCameraBinding,
  type PresentationMotionCause,
} from '../../motion';
import { envelopeCenter, type CanonicalCameraTransition, type ViewportEnvelope } from '../camera';
import {
  DEFAULT_WORLD_PRESENTATION,
  RegisterMark,
  WorldAtmosphere,
  WorldGround,
  WorldObject,
  WorldPlaceAtmosphere,
  WorldTether,
  WorldTone,
  WorldVeil,
  isSelectedNode,
  scheduleAt,
  useWorldResponse,
  type WorldPresentation,
} from '../visual';
import type { PlacedNode, PlacedScene } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';

export const MAP_CANVAS_TEST_ID = 'qandeel-map-canvas';

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
  /**
   * VPORT-01: the presentation facts the world's EXPRESSION reads — the camera's optical distance, the
   * strata's world anchoring, the platform contrast setting and the current inspection. None of them is
   * an input to placement, hit testing, membership or accessibility.
   */
  readonly world?: WorldPresentation;
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
  world = DEFAULT_WORLD_PRESENTATION,
}: MapCanvasProps) {
  const center = envelopeCenter(envelope);
  // The canonical material of this distance, read once per render; the light around the world reads
  // the PRESENTED distance from the residual on the UI runtime.
  const S = scheduleAt(world.approach);
  const response = useWorldResponse(motion, world.approach);

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
      {/* The canonical tone curve over the whole world (I-08B1 renderComposite); the veil and the
          screen-space register sit above it, as the canonical vignette, grain and type do. */}
      <WorldTone>
      <WorldGround envelope={envelope} response={response} />
      {/* The world plane: it travels with the camera, and it is the ONLY thing camera opacity
          reaches. A cut-and-resolve is a statement about the camera's path, and the register has
          no path (R1-06). The atmosphere strata are world-anchored, so they sit inside the same cut. */}
      <Group opacity={motion.planeOpacity}>
        {/* OPEN-17: the two tunable channels paint, and only paint. */}
        <WorldAtmosphere
          motion={motion}
          envelope={envelope}
          response={response}
          drift={world.drift}
          ambient={style.ambient}
          emptySpace={style.emptySpace}
        />
        <Group transform={motion.planeTransform} origin={vec(center.x, center.y)}>
          {/* The world's colour around each disclosed place: one per presented Home, identical for every
              Home. It follows the surface's presentation culling like everything else on the plane — the
              renderer makes no culling decision of its own. */}
          {planeNodes
            .filter((node) => node.locus?.kind === 'THREAD_HOME')
            .map((node) => (
              <WorldPlaceAtmosphere key={`atmosphere:${node.key}`} x={node.x} y={node.y} radius={world.placeAtmosphere} response={response} />
            ))}
          {planeNodes
            .filter((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE')
            .map((node) => {
              const host = hostOf(node, placed);
              if (host === undefined) return null;
              // The stroke is a screen quantity at every rung, so it is counter-scaled with the
              // objects it connects rather than thinned and thickened by the plane's residual.
              return (
                <WorldTether
                  key={`tether:${node.key}`}
                  fromX={host.x}
                  fromY={host.y}
                  toX={node.x}
                  toY={node.y}
                  S={S}
                  response={response}
                  contrast={world.contrast}
                  strokeScale={motion.objectScale}
                />
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
                <WorldObject
                  family={node.family}
                  nodeKey={node.key}
                  x={node.x}
                  y={node.y}
                  placement={node.locus?.kind === 'THREAD_HOME' ? 'THREAD_HOME' : 'CONTEXTUAL_APPEARANCE'}
                  S={S}
                  response={response}
                  contrast={world.contrast}
                  selected={isSelectedNode(world.selection, node)}
                />
              </Group>
            </DisclosureArrival>
          ))}
          <PresentationCameraRebase motion={motion} cameraCommit={cameraCommit} />
        </Group>
      </Group>
      </WorldTone>
      <WorldVeil envelope={envelope} response={response} />
      {/* Screen space. It does not translate, scale or dim with the camera; it changes only when
          its own current-`V` membership does, and then by its own local arrival. */}
      {registerNodes.map((node) => (
        <DisclosureArrival key={node.key} nodeKey={node.key} plan={arrivalOf(node)} originX={node.x} originY={node.y} registry={arrivals}>
          <RegisterMark
            family={node.family}
            nodeKey={node.key}
            x={node.x}
            y={node.y}
            S={S}
            contrast={world.contrast}
            selected={isSelectedNode(world.selection, node)}
          />
        </DisclosureArrival>
      ))}
    </Canvas>
  );
}
