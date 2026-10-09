/**
 * S5-03B Phase 1 — the generic Living Analysis World canvas: the ONE composition of the frozen world, extracted
 * from `MapCanvas` without changing a single element, prop or order of what it paints.
 *
 * It paints the canonical I-08B1 world (`../visual`) — the tone curve, the cosmos ground and the world's floor,
 * the three world-anchored atmosphere strata, the world's colour around each PLACE, the objects on the plane
 * and the screen-space register — under one presentation camera, with legitimate arrivals resolving in. It knows
 * nothing about what a node IS. Which nodes are places, what joins two of them, where an arrival may travel from
 * and how one object is drawn are the projection's facts, supplied by its owner: the Personal Map (`MapCanvas`)
 * today. It reads no canonical store, no Personal state, no disclosure and no inspection, and it decides nothing
 * about what exists, where it is, what a tap hits or what the accessible tree says.
 *
 * Motion enters in exactly the two places it always did, both presentation:
 *
 *   the world plane carries the presentation camera's residual, so an already-authorized camera change is shown
 *   as continuous travel through the same world rather than as a teleport — and the world's material reads that
 *   same residual, so FAR, MID and NEAR resolve into one another on the plane's own frames;
 *
 *   an object that has just BECOME part of the projection resolves into legibility — locally, or out from the
 *   node its owner names as its host, and never from anywhere else. Which objects those are is decided by the
 *   surface, from a membership transition, and never by this renderer from what happens to have mounted.
 *
 * The screen-space register sits OUTSIDE the plane entirely. It does not translate with the camera, does not
 * scale with it, and does not dim when it moves (R1-06).
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Canvas, Group, vec } from '@shopify/react-native-skia';

import {
  DisclosureArrival,
  disclosureArrivalPlan,
  type ArrivalRegistry,
  type PresentationCameraBinding,
  type PresentationMotionCause,
} from '../../motion';
import { envelopeCenter, type CanonicalCameraTransition, type ViewportEnvelope } from '../camera';
import { useWorldResponse, type WorldResponse } from '../visual/useWorldResponse';
import { WorldPlaceAtmosphere } from '../visual/WorldMarks';
import { WorldAtmosphere, WorldGround, WorldTone, WorldVeil, type WorldStrataDrift } from '../visual/WorldStrata';
import type { WorldSchedule } from '../visual/world-visual.generated';
import { scheduleAt } from '../visual/world-resolver';
import { worldChroma } from '../visual/world-chroma';
import type { CanonicalWorldAddress } from '../world';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';

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

export type WorldNodeRegion = 'WORLD_PLANE' | 'UNGEOGRAPHIC_REGISTER';

/** What the canvas needs of one placed node: its identity, where it is drawn and which space it lives in. */
export interface WorldCanvasNode {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly region: WorldNodeRegion;
}

/** The presentation facts the world's EXPRESSION reads. None of them is an input to placement or hit testing. */
export interface WorldCanvasPresentation {
  readonly approach: number;
  /** The radius, in points, of the world's colour around each place. */
  readonly placeAtmosphere: number;
  readonly drift: WorldStrataDrift;
}

/** The canonical material of this distance, and the light around the world on the UI runtime. */
export interface WorldPaintFrame {
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
}

export interface WorldCanvasProps<N extends WorldCanvasNode> {
  readonly testID: string;
  readonly envelope: ViewportEnvelope;
  /** The presentation camera. Class D: never canonical, and never a route to one. */
  readonly motion: PresentationCameraBinding;
  /** What may be on the glass during the current travel (presentation culling, decided by the surface). */
  readonly presented: readonly N[];
  /** The nodes that became part of the projection in this commit. Never "what just mounted". */
  readonly newlyDisclosed: ReadonlySet<string>;
  /** Where paint and pointer read one arriving object's progress from one shared value. */
  readonly arrivals: ArrivalRegistry;
  readonly cameraCommit: CanonicalCameraCommit;
  readonly style?: RenderStyle;
  readonly world: WorldCanvasPresentation;
  /** Whether the world makes its colour around this node: a place. */
  readonly isPlace: (node: N) => boolean;
  /**
   * LA-VIS-01: a place's canonical world address, read ONLY to colour the world around it by the world-space chroma
   * field (`../visual/world-chroma`). Where it is, never what it is; omitted, the world keeps its canonical hue.
   */
  readonly worldAddressOf?: (node: N) => CanonicalWorldAddress | undefined;
  /** The node this one resolves out from when it arrives, in the same placement, or `undefined`. */
  readonly hostOf: (node: N) => { readonly x: number; readonly y: number } | undefined;
  /** The projection's own relations on the plane, drawn between the places and the objects; none by default. */
  readonly renderConnections?: (planeNodes: readonly N[], frame: WorldPaintFrame) => ReactNode;
  /** One object on the plane, already inside its arrival and its counter-scale. */
  readonly renderObject: (node: N, frame: WorldPaintFrame) => ReactNode;
  /** One screen-space register entry, already inside its arrival. */
  readonly renderRegister?: (node: N, frame: WorldPaintFrame) => ReactNode;
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
  //
  // SHARED-VIS-01 (controlled amendment, Product Owner authorized) — on UNMOUNT only. This was keyed on the binding,
  // whose identity also changes whenever the frame is resized (its centre and diagonal are inputs), so a resize
  // mid-travel reset the plane by fiat: the travel jumped to its end, and because the reset is a write POSTED to the
  // UI runtime, the commit above it read the residual it was about to discard and opened a corridor that no rest
  // could retire whenever the UI runtime drew no frame in between (no labels, no targets, until the next drag). The
  // binding's shared values live as long as the surface, so the running travel simply continues in the new frame.
  const latestMotion = useRef(motion);
  useLayoutEffect(() => {
    latestMotion.current = motion;
  }, [motion]);
  useLayoutEffect(() => () => latestMotion.current.reset(), []);

  return null;
}

/** The world-space chroma at an address, or none (the canonical hue). */
const chromaAt = (address: CanonicalWorldAddress | undefined) => (address === undefined ? undefined : worldChroma(address));

export function WorldCanvas<N extends WorldCanvasNode>({
  testID,
  envelope,
  motion,
  presented,
  newlyDisclosed,
  arrivals,
  cameraCommit,
  style = DEFAULT_RENDER_STYLE,
  world,
  isPlace,
  hostOf,
  worldAddressOf,
  renderConnections,
  renderObject,
  renderRegister,
}: WorldCanvasProps<N>) {
  const center = envelopeCenter(envelope);
  // The canonical material of this distance, read once per render; the light around the world reads
  // the PRESENTED distance from the residual on the UI runtime.
  const S = scheduleAt(world.approach);
  const response = useWorldResponse(motion, world.approach);
  const frame: WorldPaintFrame = { S, response };

  const arrivalOf = (node: N) => {
    const host = hostOf(node);
    return disclosureArrivalPlan({
      // A membership transition in the authoritative placement — never a mount, never a viewport
      // entry, never a remount, and never the camera having moved (R1-03).
      newlyDisclosed: newlyDisclosed.has(node.key),
      // The from-host origin is read from the SAME placement any connection is drawn from, so an
      // arrival can never travel along a relationship the renderer is not showing.
      hostOffset: host === undefined ? null : { x: host.x - node.x, y: host.y - node.y },
      reducedMotion: motion.reducedMotion,
    });
  };

  const planeNodes = presented.filter((node) => node.region === 'WORLD_PLANE');
  const registerNodes = presented.filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER');

  return (
    <Canvas testID={testID} style={{ width: envelope.width, height: envelope.height }}>
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
          {/* The world's colour around each place: one per presented place, identical for every place. It
              follows the surface's presentation culling like everything else on the plane — the renderer
              makes no culling decision of its own. */}
          {planeNodes
            .filter((node) => isPlace(node))
            .map((node) => (
              <WorldPlaceAtmosphere key={`atmosphere:${node.key}`} x={node.x} y={node.y} radius={world.placeAtmosphere} response={response} seed={node.key} chroma={chromaAt(worldAddressOf?.(node))} />
            ))}
          {renderConnections?.(planeNodes, frame)}
          {planeNodes.map((node) => (
            // Two nested corrections, and the order matters. The arrival is OUTSIDE, so its
            // from-host travel is measured in the placement's own space and starts exactly at the
            // host as drawn. The counter-scale is INSIDE, so it corrects only the object's SIZE:
            // a radius is a screen quantity, the same number of points at every rung, and a plane
            // carrying a residual zoom would otherwise shrink every object to an eighth and grow
            // it back — an optical zoom wearing Semantic Zoom's clothes.
            <DisclosureArrival key={node.key} nodeKey={node.key} plan={arrivalOf(node)} originX={node.x} originY={node.y} registry={arrivals}>
              <Group transform={motion.objectTransform} origin={vec(node.x, node.y)}>
                {renderObject(node, frame)}
              </Group>
            </DisclosureArrival>
          ))}
          <PresentationCameraRebase motion={motion} cameraCommit={cameraCommit} />
        </Group>
      </Group>
      </WorldTone>
      <WorldVeil envelope={envelope} response={response} />
      {/* Screen space. It does not translate, scale or dim with the camera; it changes only when
          its own membership does, and then by its own local arrival. */}
      {registerNodes.map((node) => (
        <DisclosureArrival key={node.key} nodeKey={node.key} plan={arrivalOf(node)} originX={node.x} originY={node.y} registry={arrivals}>
          {renderRegister?.(node, frame)}
        </DisclosureArrival>
      ))}
    </Canvas>
  );
}
