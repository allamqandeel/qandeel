/**
 * S5-03B R1 — the Public field painted in the frozen Living Analysis World language.
 *
 * This is a PORT of the Stage-2 visual grammar to Public semantics, not a second world style. Every stratum and every
 * value comes from the frozen VPORT-01 owner (`../../map/visual`), which is imported unchanged:
 *
 *   the ground and the floor         `WorldGround` — screen space, never moved by the camera;
 *   the atmosphere strata            `WorldAtmosphere` — clouds, stars and dust, world-anchored by the Public camera's
 *                                    own anchor and distance (`stratumDrift`), the same everywhere, so they encode nothing;
 *   the tone curve                   `WorldTone` — the canonical `(1 − a)·w + a·w²` over the whole world;
 *   the veil                         `WorldVeil` — the canonical vignette and grain, above the world;
 *   the field's mass                 `WorldPlaceAtmosphere` — the world's colour around each served place, one per
 *                                    Experience and identical for every Experience, so where places gather the colours
 *                                    overlap into one luminous body and where there are none the world is dark;
 *   a Public Experience's presence   its OWN mark (`PublicPresence` below), built only from the canonical mark material
 *                                    (`markMaterial`), the medium's light (`falloff`, `mediumHue`), the subtractive local
 *                                    ground (`SHADE_GRADIENT`) and the frozen SELECTED marker (`worldPalette`). It does not
 *                                    borrow a Personal family's morphology: a Public Experience is not a Thread or a Reading.
 *
 * What the field may say, and the rule behind it (I-08B1 truth rule 2): every light, size and alpha is CONSTANT PER TIER.
 * The tier is disclosure (FAR presence, MID / NEAR place, the one focused place), never activity, popularity, recency,
 * vitality or anything else about an Experience. The mass is derived from the served places alone: it invents no
 * category, draws no boundary and no line of any kind (explicit links between Experiences are S5-03C's, and none is drawn).
 *
 * Distance: the Map reads its world's approach `A` from its camera distance on a logarithmic footing where one ×8
 * Semantic Zoom step is exactly half the FAR → NEAR span. The Public camera steps by the same ×8, so its three rungs are
 * exactly `A` = 0, ½ and 1 — read here from the Public depth itself (the authority), never from a magnitude.
 *
 * Nothing here is a target, an accessibility node or an input to anything: what a reader can press and hear is the
 * field's own accessible layer above this canvas. Nothing animates; the presentation camera is held at rest, so reduced
 * motion and full motion paint the same field.
 */
import { Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';

import { useIncreasedContrast } from '../../conversation';
import { usePresentationCamera } from '../../motion';
import { WorldAtmosphere, WorldGround, WorldPlaceAtmosphere, WorldTone, WorldVeil, scheduleAt, stratumDrift, useWorldResponse } from '../../map/visual';
import type { WorldResponse } from '../../map/visual/useWorldResponse';
import { WORLD_DUST, WORLD_NEBULA, WORLD_STARS } from '../../map/visual/world-field.generated';
import { WORLD_VISUAL } from '../../map/visual/world-visual.generated';
import {
  MARK_RADIUS_POINTS, SHADE_GRADIENT, falloff, markMaterial, mediumHue, worldPalette,
  type WorldContrast, type WorldSchedule, type WorldTier,
} from '../../map/visual/world-resolver';
import type { PublicFieldCamera, PublicFieldDepth, PublicFieldPoint, PublicFieldSize } from './public-field-camera';

export const PUBLIC_FIELD_WORLD_TEST_ID = 'qandeel-public-field-world';

const V = WORLD_VISUAL;

/** The approach of each Public rung: one ×8 step is half of the canonical FAR → NEAR span (`ln 8 / ln 64`). */
export const PUBLIC_FIELD_APPROACH: Readonly<Record<PublicFieldDepth, number>> = Object.freeze({ FAR: 0, MID: 0.5, NEAR: 1 });

/**
 * How far the world's colour reaches around one served place, as a share of the glass at FAR. World-anchored: it grows
 * with the same ×8 per rung as the camera, so neighbours' colours that meet at FAR are the same overlap at MID, and at
 * NEAR the reader is inside the colour of the place they are looking at. A presentation calibration, not a Product
 * quantity, and the same for every Experience.
 */
export const PUBLIC_FIELD_MASS_SHARE = 0.17;
const RUNG_GROWTH: Readonly<Record<PublicFieldDepth, number>> = Object.freeze({ FAR: 1, MID: 8, NEAR: 64 });

export function fieldMassRadius(depth: PublicFieldDepth, size: PublicFieldSize): number {
  return Math.min(size.width, size.height) * PUBLIC_FIELD_MASS_SHARE * RUNG_GROWTH[depth];
}

/** How one served Experience is present at the current disclosure. Decided by the field, from disclosure alone. */
export type PublicPresenceKind =
  /** FAR: part of the field's mass — the medium's light only, no body, no label. */
  | 'FIELD'
  /** MID / NEAR: a place, at the major tier. */
  | 'PLACE'
  /** NEAR: sharing the focused Experience's semantic region — a quiet minor-tier body. */
  | 'NEIGHBOURHOOD'
  /** NEAR: elsewhere in the field — a minor-tier body that recedes. */
  | 'RECEDED';

export interface PublicFieldWorldPlace {
  readonly id: string;
  readonly at: PublicFieldPoint;
  readonly presence: PublicPresenceKind;
  readonly selected: boolean;
}

export interface PublicFieldWorldProps {
  readonly size: PublicFieldSize;
  readonly camera: PublicFieldCamera;
  /** Every served place near enough to the glass for its colour to reach it. */
  readonly mass: ReadonlyArray<PublicFieldPoint>;
  /** Every served place on the glass, with its presence. */
  readonly places: ReadonlyArray<PublicFieldWorldPlace>;
  /** The drag in flight, in points: the plane follows the hand; the ground, strata and veil do not. */
  readonly drag: PublicFieldPoint;
}

export function PublicFieldWorld({ size, camera, mass, places, drag }: PublicFieldWorldProps) {
  const center = { x: size.width / 2, y: size.height / 2 };
  // The Map's own presentation camera, held at rest: the Public field never applies a canonical change to it, so its
  // residual is the identity and every reading of it is the canonical material of the Public rung.
  const motion = usePresentationCamera({ center, diagonalPoints: Math.hypot(size.width, size.height) });
  const contrast: WorldContrast = useIncreasedContrast() ? 'increased' : 'standard';
  const approach = PUBLIC_FIELD_APPROACH[camera.depth];
  const S = scheduleAt(approach);
  const response = useWorldResponse(motion, approach);
  const p = V.parallax;
  const drift = {
    nebula: stratumDrift(camera.anchor, camera.scale, WORLD_NEBULA.tile, p.far, motion.reducedMotion),
    stars: stratumDrift(camera.anchor, camera.scale, WORLD_STARS.tile, p.mid, motion.reducedMotion),
    dust: stratumDrift(camera.anchor, camera.scale, WORLD_DUST.tile, p.near, motion.reducedMotion),
  };
  const envelope = { width: size.width, height: size.height, insetTop: 0, insetRight: 0, insetBottom: 0, insetLeft: 0 };
  const radius = fieldMassRadius(camera.depth, size);
  return (
    <Canvas testID={PUBLIC_FIELD_WORLD_TEST_ID} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: size.width, height: size.height }}>
      <WorldTone>
        <WorldGround envelope={envelope} response={response} />
        <WorldAtmosphere motion={motion} envelope={envelope} response={response} drift={drift} ambient={0.5} emptySpace={0.5} />
        <Group transform={[{ translateX: drag.x }, { translateY: drag.y }]}>
          {mass.map((at, index) => (
            <WorldPlaceAtmosphere key={`mass:${index}`} x={at.x} y={at.y} radius={radius} response={response} />
          ))}
          {places.map((place) => (
            <PublicPresence key={place.id} experienceId={place.id} x={place.at.x} y={place.at.y} presence={place.presence}
              selected={place.selected} S={S} response={response} contrast={contrast} />
          ))}
        </Group>
      </WorldTone>
      <WorldVeil envelope={envelope} response={response} />
    </Canvas>
  );
}

const TIER: Readonly<Record<PublicPresenceKind, WorldTier>> = Object.freeze({ FIELD: 'minor', PLACE: 'major', NEIGHBOURHOOD: 'minor', RECEDED: 'minor' });
/** The share of its tier a receded body keeps: it is still there, but the reading is elsewhere. */
const RECEDED_SHARE = 0.45;
const radiusOf = (tier: WorldTier): number => (tier === 'major' ? MARK_RADIUS_POINTS.THREAD_HOME : MARK_RADIUS_POINTS.CONTEXTUAL_APPEARANCE);

function Light({ x, y, r, profile, hue, lightness, opacity }: {
  readonly x: number; readonly y: number; readonly r: number; readonly profile: 'wide' | 'soft' | 'core'; readonly hue: number;
  readonly lightness: number; readonly opacity: WorldResponse['haloMajor'] | number;
}) {
  const f = falloff(profile, hue, profile === 'core' ? V.mark.haloSat * V.mark.coreSatShare : V.mark.haloSat, lightness);
  return (
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x, y)} r={r} colors={f.colors} positions={f.positions} />
      </Circle>
    </Group>
  );
}

export interface PublicPresenceProps {
  readonly experienceId: string;
  readonly x: number;
  readonly y: number;
  readonly presence: PublicPresenceKind;
  readonly selected: boolean;
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
  readonly contrast: WorldContrast;
}

/**
 * One served Public Experience in the canonical object material. FAR: the medium's light alone — presence in the field's
 * mass, not an object. MID / NEAR: a body of its tier with the medium's light around it; a place (major tier) also has
 * the world's cleared local ground, and at NEAR its luminous core. SELECTED: the frozen selected ink and an attached
 * marker, so focus is a shape, never a colour alone.
 */
export function PublicPresence({ x, y, presence, selected, S, response, contrast }: PublicPresenceProps) {
  const tier = TIER[presence];
  const r = radiusOf(tier);
  const m = V.mark[tier];
  const hue = mediumHue(S.lod);
  const halo = tier === 'major' ? response.haloMajor : response.haloMinor;
  if (presence === 'FIELD') {
    return <Light x={x} y={y} r={r * m.halo} profile="soft" hue={hue} lightness={V.mark.haloWideLight} opacity={halo} />;
  }
  const material = markMaterial(tier, S, contrast === 'increased');
  const palette = worldPalette(contrast);
  return (
    <Group opacity={presence === 'RECEDED' ? RECEDED_SHARE : 1}>
      {tier === 'major' ? (
        <Group opacity={response.groundMajor}>
          <Circle cx={x} cy={y} r={r * V.material.objGnd.r}>
            <RadialGradient c={vec(x, y)} r={r * V.material.objGnd.r} colors={SHADE_GRADIENT.colors} positions={SHADE_GRADIENT.positions} />
          </Circle>
        </Group>
      ) : null}
      <Light x={x} y={y} r={r * m.halo} profile="wide" hue={hue} lightness={V.mark.haloLight} opacity={halo} />
      <Light x={x} y={y} r={r * m.haloWide} profile="soft" hue={hue} lightness={V.mark.haloWideLight}
        opacity={tier === 'major' ? response.haloWideMajor : response.haloWideMinor} />
      <Circle cx={x} cy={y} r={r} color={selected ? palette.selectedInk : material.fill} />
      <Group opacity={response.near}>
        <Light x={x} y={y} r={r * m.core} profile="core" hue={V.worldHue} lightness={Math.min(90, material.light + 2)} opacity={material.alpha * m.coreAlpha} />
      </Group>
      {selected ? (
        <Circle cx={x} cy={y} r={r * 1.42 + 2} style="stroke" strokeWidth={palette.markerThickness} color={palette.selectedMarker} />
      ) : null}
    </Group>
  );
}
