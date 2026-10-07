/**
 * S5-03C — the Public field's EXPLICIT relation lines: what the Public World supplies to the shared renderer's optional
 * connection slot (`WorldCanvas.renderConnections`), and their accessible names.
 *
 * The truth is the server's and only the server's: a line is drawn for a relation the focused Experience's panel read
 * served — an ACTIVE `EXPLICIT_PUBLIC_RELATION` whose two bound endpoints are both served to this reader now. Nothing here
 * infers, suggests, weighs or keeps a relation: nearness in the field, a shared semantic region, a colour, a theme or
 * anything ranked never produces one, and when the latest read served none, nothing is drawn. The renderer draws; it never
 * decides.
 *
 * Presentation (the Product Owner's S5-03C decision): no line at FAR or MID; at NEAR only the SELECTED Experience's
 * relations, each straight from it to the other endpoint's served place, undirected, unlabelled and not pressable, in the
 * canonical connection style the Personal Map already draws (`WorldTether`, LA-VIS-01) — never the atmosphere's
 * filaments, which are paint with no endpoints and no identity. A relation never moves a place: the endpoints are where
 * the field already placed them.
 *
 * Accessibility: each drawn line has exactly one accessible element, named «علاقة مع {0}» / "Relation with {0}" by the
 * OTHER Experience's reviewed meaning (served to this reader, or there would be no line). It is not a button. The
 * atmosphere stays inaccessible decorative paint.
 */
import type { DerivedValue } from 'react-native-reanimated';
import { View } from 'react-native';

import { WorldTether, type WorldContrast, type WorldResponse, type WorldSchedule } from '../../map/visual';
import type { ChromeLanguage } from '../../orientation-chrome';
import { fill } from '../../public-authoring/relation-copy';
import type { PublicFieldRelation } from '../../runtime-entry';
import type { PublicFieldCamera } from './public-field-camera';
import type { PublicWorldNode } from './public-field-projection';

/** One explicit relation as it is drawn now: its identity, both endpoints' points on the plane, the other's meaning. */
export interface PublicRelationSegment {
  readonly relationId: string;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly otherMeaning: string;
}

/**
 * The segments to draw now. Empty unless the camera is at NEAR with a selected Experience whose served panel carries
 * relations; a relation whose other endpoint the projection cannot place finitely is not drawn (a fact about the
 * projection, never about the World).
 */
export function explicitRelationSegments(
  camera: PublicFieldCamera | null,
  nodes: readonly PublicWorldNode[],
  focusId: string | null,
  relations: readonly PublicFieldRelation[],
): PublicRelationSegment[] {
  if (camera === null || camera.depth !== 'NEAR' || focusId === null || relations.length === 0) return [];
  const byId = new Map(nodes.map((node) => [node.entry.id, node]));
  const from = byId.get(focusId);
  if (from === undefined) return [];
  const segments: PublicRelationSegment[] = [];
  for (const relation of relations) {
    const to = byId.get(relation.other.id);
    if (to === undefined || to.entry.id === focusId) continue;
    segments.push(Object.freeze({ relationId: relation.relationId, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, otherMeaning: relation.other.meaning }));
  }
  return segments;
}

/** The lines, painted on the plane in the canonical connection style. */
export function PublicRelationLines({ segments, S, response, contrast, strokeScale }: {
  readonly segments: readonly PublicRelationSegment[]; readonly S: WorldSchedule; readonly response: WorldResponse;
  readonly contrast: WorldContrast; readonly strokeScale: DerivedValue<number>;
}) {
  return (
    <>
      {segments.map((segment) => (
        <WorldTether key={`explicit:${segment.relationId}`} fromX={segment.fromX} fromY={segment.fromY} toX={segment.toX} toY={segment.toY}
          S={S} response={response} contrast={contrast} strokeScale={strokeScale} />
      ))}
    </>
  );
}

/** One accessible element per drawn line, at its middle, named by the other Experience. Not pressable. */
export function PublicRelationTargets({ segments, relationWith, language }: {
  readonly segments: readonly PublicRelationSegment[]; readonly relationWith: string; readonly language: ChromeLanguage;
}) {
  return (
    <>
      {segments.map((segment) => (
        <View key={`explicit:${segment.relationId}`} testID={`qandeel-public-explicit-relation-${segment.relationId}`} pointerEvents="none"
          accessible accessibilityLabel={fill(relationWith, segment.otherMeaning)} accessibilityLanguage={language}
          style={{ position: 'absolute', left: (segment.fromX + segment.toX) / 2 - 8, top: (segment.fromY + segment.toY) / 2 - 8, width: 16, height: 16 }} />
      ))}
    </>
  );
}
