/**
 * S5-03B Phase 2 — one Public Experience in the world's own material (D2).
 *
 * The material is the world's: `WorldMark` — the tier's cleared local ground, the medium's light, the NEAR limb and
 * luminous interior, and the frozen SELECTED ink with its attached marker — exactly as every object of the Living
 * Analysis World is made, with every value from the generated world tokens. Only the SHAPE is Public's: a neutral
 * circle, because a Public Experience is not a Personal object and borrows no Personal morphology. It is a temporary
 * shape, inside the shared material, with no token family of its own.
 *
 * The tier is disclosure (FAR mass, MID / NEAR place, the one focused place), never activity, popularity, recency or
 * anything else about an Experience: every light, size and alpha is constant per tier.
 */
import { Group } from '@shopify/react-native-skia';

import { MARK_RADIUS_POINTS, WorldMark, markerRadius, worldPalette, type WorldContrast, type WorldPlacement, type WorldResponse, type WorldSchedule, type WorldTier } from '../../map/visual';
import type { PublicPresenceKind } from './public-field-projection';

/** The tier each presence is drawn at, and the world placement whose tokens that tier is sized by. */
const TIER: Readonly<Record<PublicPresenceKind, WorldTier>> = Object.freeze({ FIELD: 'minor', PLACE: 'major', NEIGHBOURHOOD: 'minor', RECEDED: 'minor' });
const SIZED_AS: Readonly<Record<WorldTier, WorldPlacement>> = Object.freeze({ major: 'THREAD_HOME', minor: 'CONTEXTUAL_APPEARANCE' });
/** The share of its tier a receded body keeps: it is still there, but the reading is elsewhere. */
const RECEDED_SHARE = 0.45;

/** A neutral circle of radius `r` around (x, y), as the shape string the world's mark material draws. */
export function neutralCircle(x: number, y: number, r: number): string {
  return `M ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} Z`;
}

export interface PublicExperienceMarkProps {
  readonly x: number;
  readonly y: number;
  readonly presence: PublicPresenceKind;
  readonly selected: boolean;
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
  readonly contrast: WorldContrast;
}

export function PublicExperienceMark({ x, y, presence, selected, S, response, contrast }: PublicExperienceMarkProps) {
  const tier = TIER[presence];
  const placement = SIZED_AS[tier];
  const r = MARK_RADIUS_POINTS[placement];
  return (
    <Group opacity={presence === 'RECEDED' ? RECEDED_SHARE : 1}>
      <WorldMark
        x={x}
        y={y}
        r={r}
        tier={tier}
        markerRadius={markerRadius(placement, worldPalette(contrast).markerThickness)}
        // No orientation of its own: a circle faces nowhere, and its lit limb faces the world's rest angle.
        shape={{ path: neutralCircle(x, y, r), stroked: false, limbAngle: 0 }}
        S={S}
        response={response}
        contrast={contrast}
        selected={selected}
      />
    </Group>
  );
}
