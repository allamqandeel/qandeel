/**
 * T-04 — presentation placement and hit testing over the disclosed scene.
 *
 * Two kinds of position exist here and they are never confused:
 *
 *   - a Thread's Home is CANONICAL. It is projected from its exact `bigint` address through the
 *     camera transform, and nothing on this side ever writes back to it;
 *   - a contextual appearance and an ungeographic entry have NO canonical position. They are
 *     given a deterministic presentation slot — a fixed offset from their host Home, or a slot
 *     in a screen-space register — and that slot is not geography. It is derived only from the
 *     scene's own disclosure order, it is identical for the same `V` on every device, and it
 *     states nothing about importance, confidence, truth, causality, ownership, Reading
 *     strength, emotional intensity or future emergence.
 *
 * Placement never consults `RenderStyle`: this module does not accept one. That is why the
 * OPEN-17 channels cannot move a node, change what a tap hits, or change what exists.
 *
 * A node outside the viewport stays in the scene and is marked `visible: false`. Culling is a
 * paint and hit-testing decision, never a claim about existence — the accessible tree covers the
 * whole entitled set regardless.
 */
import {
  isWithinFootprint,
  projectAddress,
  safeAreaHeight,
  safeAreaWidth,
  visibleFootprint,
  type MapCamera,
  type ScreenPoint,
  type ViewportEnvelope,
  type WorldFootprint,
} from '../camera';
import type { MapObjectFamily, MapScene, MapSceneLocus } from '../projection';

/** Neutral placeholder geometry. Final visual language, sizing and material are Phase VI's. */
export const HOME_RADIUS_POINTS = 13;
export const APPEARANCE_RADIUS_POINTS = 6;
export const APPEARANCE_RING_RADIUS_POINTS = 40;
export const APPEARANCE_RING_STEP_POINTS = 22;
export const APPEARANCE_RING_SLOTS = 8;
export const REGISTER_RADIUS_POINTS = 6;
export const REGISTER_SLOT_POINTS = 26;
export const REGISTER_INSET_POINTS = 18;
export const CULL_MARGIN_POINTS = 48;

export type MapNodeRegion = 'WORLD_PLANE' | 'UNGEOGRAPHIC_REGISTER';

export interface PlacedNode {
  /** Unique within a placed scene: one node per locus, or one per ungeographic identity. */
  readonly key: string;
  readonly objectKey: string;
  readonly family: MapObjectFamily;
  readonly id: string;
  readonly locus: MapSceneLocus | null;
  readonly region: MapNodeRegion;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly visible: boolean;
}

export interface PlacedScene {
  readonly nodes: readonly PlacedNode[];
  readonly visibleNodes: readonly PlacedNode[];
  readonly footprint: WorldFootprint;
  readonly center: ScreenPoint;
}

function ringOffset(ordinal: number): ScreenPoint {
  const turn = Math.floor(ordinal / APPEARANCE_RING_SLOTS);
  const slot = ordinal % APPEARANCE_RING_SLOTS;
  const radius = APPEARANCE_RING_RADIUS_POINTS + turn * APPEARANCE_RING_STEP_POINTS;
  const angle = (slot * 2 * Math.PI) / APPEARANCE_RING_SLOTS;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function withinViewport(envelope: ViewportEnvelope, x: number, y: number, radius: number): boolean {
  const margin = radius + CULL_MARGIN_POINTS;
  return x >= -margin && y >= -margin && x <= envelope.width + margin && y <= envelope.height + margin;
}

/**
 * Places the disclosed scene into the current viewport. The result is derived presentation
 * input: it is recomputed on every camera or envelope change and stored nowhere.
 */
export function placeScene(scene: MapScene, camera: MapCamera, envelope: ViewportEnvelope): PlacedScene {
  const footprint = visibleFootprint(camera, envelope);
  const nodes: PlacedNode[] = [];

  for (const object of scene.objects) {
    for (const locus of object.loci) {
      const hostAddress = locus.kind === 'THREAD_HOME' ? locus.address : locus.hostAddress;
      const projected = projectAddress(camera, envelope, hostAddress);
      if (projected === null) continue; // not finitely representable from this camera; never clamped to an edge
      const offset = locus.kind === 'THREAD_HOME' ? { x: 0, y: 0 } : ringOffset(locus.ordinal);
      const radius = locus.kind === 'THREAD_HOME' ? HOME_RADIUS_POINTS : APPEARANCE_RADIUS_POINTS;
      const x = projected.x + offset.x;
      const y = projected.y + offset.y;
      nodes.push({
        key: locus.kind === 'THREAD_HOME' ? `${object.key}@THREAD_HOME:${locus.threadId}` : `${object.key}@THREAD_READING:${locus.bindingId}`,
        objectKey: object.key,
        family: object.family,
        id: object.id,
        locus,
        region: 'WORLD_PLANE',
        x,
        y,
        radius,
        visible: withinViewport(envelope, x, y, radius),
      });
    }
  }

  // The ungeographic register is screen space, not world space. It exists so that an entitled
  // identity with no canonical place is still visible and hit-testable without being given a
  // position on the world plane it does not have.
  const registerY = envelope.insetTop + safeAreaHeight(envelope) - REGISTER_INSET_POINTS;
  const registerWidth = safeAreaWidth(envelope);
  const perRow = Math.max(1, Math.floor(registerWidth / REGISTER_SLOT_POINTS));
  scene.ungeographic.forEach((object, index) => {
    const column = index % perRow;
    const row = Math.floor(index / perRow);
    const x = envelope.insetLeft + REGISTER_INSET_POINTS + column * REGISTER_SLOT_POINTS;
    const y = registerY - row * REGISTER_SLOT_POINTS;
    nodes.push({
      key: `${object.key}@UNGEOGRAPHIC`,
      objectKey: object.key,
      family: object.family,
      id: object.id,
      locus: null,
      region: 'UNGEOGRAPHIC_REGISTER',
      x,
      y,
      radius: REGISTER_RADIUS_POINTS,
      visible: withinViewport(envelope, x, y, REGISTER_RADIUS_POINTS),
    });
  });

  return Object.freeze({
    nodes: Object.freeze(nodes),
    visibleNodes: Object.freeze(nodes.filter((node) => node.visible)),
    footprint,
    center: { x: envelope.insetLeft + safeAreaWidth(envelope) / 2, y: envelope.insetTop + safeAreaHeight(envelope) / 2 },
  });
}

/**
 * The topmost disclosed target under a point, or `null`. Only disclosed, currently visible nodes
 * can be hit: a future, off-depth or unavailable identity is not in the scene at all, so it is
 * unreachable by a tap exactly as it is unreachable by the eye.
 */
export function hitTest(placed: PlacedScene, point: ScreenPoint): PlacedNode | null {
  let best: PlacedNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of placed.visibleNodes) {
    const dx = point.x - node.x;
    const dy = point.y - node.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= node.radius && distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

/** Whether a Thread's canonical Home currently lies inside the visible world footprint. */
export function isHomeWithinFootprint(placed: PlacedScene, locus: MapSceneLocus): boolean {
  return isWithinFootprint(placed.footprint, locus.kind === 'THREAD_HOME' ? locus.address : locus.hostAddress);
}
