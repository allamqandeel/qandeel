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
 *
 * S5-03B Phase 1 — the composition of the world itself (strata, plane, places, arrivals, the camera rebase and
 * the register) now lives in the generic `WorldCanvas`, moved without changing an element, a prop or an order.
 * This file remains the Personal owner of the Map's paint: it alone knows that a Thread's Home is a place, that
 * a contextual Reading is hosted by that Home and tethered to it, and how each family is drawn. The golden
 * equivalence suite (`__tests__/golden-equivalence.test.tsx`) proves the Personal Map paints exactly what it did.
 */
import {
  DEFAULT_WORLD_PRESENTATION,
  RegisterMark,
  WorldObject,
  WorldTether,
  isSelectedNode,
  type WorldPresentation,
} from '../visual';
import type { ArrivalRegistry, PresentationCameraBinding } from '../../motion';
import type { ViewportEnvelope } from '../camera';
import type { PlacedNode, PlacedScene } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';
import { WorldCanvas, type CanonicalCameraCommit } from './WorldCanvas';

export type { CanonicalCameraCommit } from './WorldCanvas';

export const MAP_CANVAS_TEST_ID = 'qandeel-map-canvas';

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
  return (
    <WorldCanvas<PlacedNode>
      testID={MAP_CANVAS_TEST_ID}
      envelope={envelope}
      motion={motion}
      presented={presented}
      newlyDisclosed={newlyDisclosed}
      arrivals={arrivals}
      cameraCommit={cameraCommit}
      style={style}
      world={world}
      // A Thread's Home is the Personal world's place: the world makes its colour around each one.
      isPlace={(node) => node.locus?.kind === 'THREAD_HOME'}
      // LA-VIS-01: a Home's own canonical address, read only to colour the world around it (presentation).
      worldAddressOf={(node) => (node.locus?.kind === 'THREAD_HOME' ? node.locus.address : undefined)}
      // A contextual appearance arrives out from the Home that hosts it — the very tether drawn beside it.
      hostOf={(node) => hostOf(node, placed)}
      renderConnections={(planeNodes, { S, response }) =>
        planeNodes
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
          })
      }
      renderObject={(node, { S, response }) => (
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
      )}
      renderRegister={(node, { S }) => (
        <RegisterMark
          family={node.family}
          nodeKey={node.key}
          x={node.x}
          y={node.y}
          S={S}
          contrast={world.contrast}
          selected={isSelectedNode(world.selection, node)}
        />
      )}
    />
  );
}
