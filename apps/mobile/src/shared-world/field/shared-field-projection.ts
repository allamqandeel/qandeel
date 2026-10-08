/**
 * SHARED-VIS-01 — the Shared projection: the places the server served for the reader in ONE Shared World → nodes of the ONE
 * Living Analysis World.
 *
 * A node is exactly one served place, at the place the World's placer committed for it; nothing is invented to stand
 * beside it: no region body, no member, no QANDEEL figure, no weight, no line of any kind, and an empty World projects to
 * no node at all. Its presence is the World's disclosure alone — the semantic-field policy S5-03B froze for a non-Personal
 * World, reused here unchanged (`../../public-world/field/public-field-projection`):
 *
 *   FAR   every served place is part of the World's mass;
 *   MID   each place is a legible spatial object at the major tier (its meaning is labelled by the Shared chrome);
 *   NEAR  the focused place is selected; places that share its semantic region keep a quiet presence, the rest recede.
 *
 * Never activity, recency, author, member, count or turn order: nothing about a place but where its meaning put it.
 */
import type { ViewportEnvelope } from '../../map/camera';
import { placePublicField, type PublicWorldNode } from '../../public-world/field/public-field-projection';
import type { SharedFieldEntry } from '../../runtime-entry';
import type { SharedFieldCamera } from './shared-field-camera';

/** One served Shared place on the world plane. (Its shape is the semantic field's; its entry is a Shared place.) */
export type SharedWorldNode = PublicWorldNode;

export interface SharedFieldProjectionInput {
  readonly camera: SharedFieldCamera;
  readonly envelope: ViewportEnvelope;
  /** Every place the latest read served for this World. */
  readonly entries: readonly SharedFieldEntry[];
  readonly focusId: string | null;
}

/** The Shared field's placement over the current camera. Culling against the glass is the generic surface's. */
export function placeSharedField({ camera, envelope, entries, focusId }: SharedFieldProjectionInput): { readonly nodes: readonly SharedWorldNode[] } {
  return placePublicField({ camera, envelope, entries, results: [], focusId });
}
