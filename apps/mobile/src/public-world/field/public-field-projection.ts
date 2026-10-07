/**
 * S5-03B Phase 2 — the Public projection: served Public Experiences → nodes of the ONE Living Analysis World.
 *
 * This adapter is the only place the Public field says what its world holds. Everything else — the projection of an
 * exact address onto the glass, culling, the presentation camera, the world's material — is the Map's own generic
 * machinery (`../../map/camera`, `../../map/renderer`), unchanged. A node here is exactly one Experience the server
 * served for this viewer now, at the place the placer gave it; nothing is invented to stand beside it: no region body,
 * no category, no weight, no line of any kind, and an empty World projects to no node at all.
 *
 * How each node is present is the Public field's disclosure policy and nothing else — never activity, popularity,
 * recency or anything else about an Experience:
 *
 *   FAR   every served place is part of the field's mass: the world's colour around it and a quiet minor-tier body;
 *   MID   each place is a legible spatial object at the major tier (its meaning is labelled by the Public chrome);
 *   NEAR  the focused place is selected; places that share its semantic region keep a quiet presence, the rest recede.
 *
 * A search result or the focused Experience is a place at every rung, so a reader can find what they asked for.
 */
import { projectAddress, type ViewportEnvelope } from '../../map/camera';
import { HOME_RADIUS_POINTS, type WorldSurfaceNode } from '../../map/renderer';
import type { PublicFieldEntry } from '../../runtime-entry';
import type { PublicFieldCamera } from './public-field-camera';

/** How one served Experience is present at the current disclosure. Decided by the field, from disclosure alone. */
export type PublicPresenceKind =
  /** FAR: part of the field's mass. */
  | 'FIELD'
  /** MID / NEAR: a place, at the major tier. */
  | 'PLACE'
  /** NEAR: sharing the focused Experience's semantic region — a quiet minor-tier body. */
  | 'NEIGHBOURHOOD'
  /** NEAR: elsewhere in the field — a minor-tier body that recedes. */
  | 'RECEDED';

export interface PublicWorldNode extends WorldSurfaceNode {
  readonly region: 'WORLD_PLANE';
  readonly entry: PublicFieldEntry;
  readonly presence: PublicPresenceKind;
  readonly selected: boolean;
}

export interface PublicFieldProjectionInput {
  readonly camera: PublicFieldCamera;
  readonly envelope: ViewportEnvelope;
  /** Every Experience the latest field read served. */
  readonly entries: readonly PublicFieldEntry[];
  /** The open search's results (places in the same field), or none. */
  readonly results: readonly PublicFieldEntry[];
  readonly focusId: string | null;
}

/**
 * The Public field's placement over the current camera. Every node is on the world plane; one whose address is not
 * finitely representable from this camera is omitted (a fact about the projection, never about the World). Culling
 * against the glass is the generic surface's, not this adapter's.
 */
export function placePublicField({ camera, envelope, entries, results, focusId }: PublicFieldProjectionInput): { readonly nodes: readonly PublicWorldNode[] } {
  const byId = new Map<string, PublicFieldEntry>();
  for (const entry of [...entries, ...results]) byId.set(entry.id, entry);
  const highlighted = new Set(results.map((entry) => entry.id));
  const focusedRegion = focusId === null ? null : byId.get(focusId)?.region ?? null;
  const presenceOf = (entry: PublicFieldEntry): PublicPresenceKind => {
    if (highlighted.has(entry.id) || entry.id === focusId) return 'PLACE';
    if (camera.depth === 'FAR') return 'FIELD';
    if (camera.depth === 'MID') return 'PLACE';
    return focusedRegion !== null && entry.region === focusedRegion ? 'NEIGHBOURHOOD' : 'RECEDED';
  };
  const nodes: PublicWorldNode[] = [];
  for (const entry of byId.values()) {
    const at = projectAddress(camera, envelope, entry.address);
    if (at === null) continue;
    nodes.push(Object.freeze({
      key: `public:${entry.id}`,
      x: at.x,
      y: at.y,
      // The Map's own Home hit radius: what is painted is what is pressed, at every rung.
      radius: HOME_RADIUS_POINTS,
      region: 'WORLD_PLANE' as const,
      entry,
      presence: presenceOf(entry),
      selected: entry.id === focusId,
    }));
  }
  return Object.freeze({ nodes });
}
