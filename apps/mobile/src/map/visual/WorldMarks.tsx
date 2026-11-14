/**
 * VPORT-01 — the world's analytical inhabitants, in the canonical I-08B1 object and connection grammar.
 *
 * Three things are drawn here, and each is the expression of a fact the Map already holds:
 *
 *   `WorldObject`   one placed locus on the world plane — a Thread's Home (major tier: a cleared local
 *                   ground, the medium's light around it, the THREAD morphology) or a contextual
 *                   appearance (minor tier: the READING morphology, a smaller light, no ground of its
 *                   own — it lives inside its Home's place);
 *   `WorldTether`   the hosting relation between a contextual appearance and its Home, in the
 *                   canonical connection grammar: a dark local ground under a luminous core whose
 *                   brightest light is along its span. It is the ONLY relation drawn, because it is the
 *                   only relation the production Map holds;
 *   `RegisterMark`  an ungeographic identity, in screen space: its morphology and nothing else. No
 *                   ground and no light — the world makes room for a place, and this has none.
 *
 * SELECTED (E1R): the inspected object carries the frozen selected ink and an ATTACHED marker — a ring
 * hugging its mark at the frozen marker thickness — so the state is a shape, never a colour alone.
 * The marker sits inside the T-04 hit radius of the same placement.
 *
 * Nothing here varies per object except what the object IS (family, placement) and whether it is the
 * one being inspected. Every light, size and alpha is constant per tier.
 *
 * MAP-CLOSE-01 V-3 (Product Owner, 2026-11-10: S3-R2 is the FINAL APPROVED VISUAL ART DIRECTION): when its owner hands a
 * mark or a tether the world's chroma at its place (`chroma`), and the reader keeps standard contrast, it is drawn in the
 * approved S3-R2 node grammar — a soft light in the place's own colour, fine rays, a thin ring and a clear centre in the
 * family's own morphology, with no white disc. The chroma is the place's address and nothing else (`./world-chroma`), so
 * the colour still says where, never what; every size and alpha is still constant per tier. Without a chroma, and at
 * increased contrast (F1), the frozen VPORT-01 / LA-VIS-01 grammar below is drawn unchanged.
 */
import { BlurMask, Circle, FilterMode, Group, Image, LinearGradient, MipmapMode, Path, Picture, RadialGradient, vec } from '@shopify/react-native-skia';
import { useReadingOf, type DerivedValue } from '../../motion';

import type { MapObjectFamily } from '../projection';
import { APPEARANCE_RADIUS_POINTS, HOME_RADIUS_POINTS, REGISTER_RADIUS_POINTS } from '../renderer/map-geometry';
import type { WorldResponse } from './useWorldResponse';
import { WORLD_VISUAL } from './world-visual.generated';
import { FadedLayer, WorldTone, ladderHue } from './WorldStrata';
import type { ChromaFamily } from './world-chroma';
import { MASS_EXTENT, MASS_UNIT, massPicture } from './world-mass';
import { rasterBehind } from './prepared-raster';
import {
  MARK_RADIUS_POINTS,
  SHADE_GRADIENT,
  falloff,
  hexRgba,
  hsla,
  markMaterial,
  mediumHue,
  morphologyPath,
  presentationRotation,
  tierOf,
  worldPalette,
  type WorldContrast,
  type WorldPlacement,
  type WorldTier,
  type WorldSchedule,
} from './world-resolver';

const V = WORLD_VISUAL;
const GROUND_WIDTH = WORLD_VISUAL.material.relGnd.w;
const BODY_WIDTH = WORLD_VISUAL.relation.body.width;

/** The T-04 hit radius of each placement: nothing painted for an object may reach beyond it. */
const HIT_RADIUS: Readonly<Record<WorldPlacement, number>> = {
  THREAD_HOME: HOME_RADIUS_POINTS,
  CONTEXTUAL_APPEARANCE: APPEARANCE_RADIUS_POINTS,
  UNGEOGRAPHIC: REGISTER_RADIUS_POINTS,
};

/**
 * The radius of the attached SELECTED marker: just outside the mark's widest extent (the canonical
 * morphologies reach 1.42 r), and never past the hit radius, so the state is drawn on the object a tap
 * selects and nowhere else.
 */
export function markerRadius(placement: WorldPlacement, thickness: number): number {
  return Math.min(MARK_RADIUS_POINTS[placement] * 1.42 + 2, HIT_RADIUS[placement] - thickness / 2);
}

function SelectedMarker({ x, y, r, contrast }: { x: number; y: number; r: number; contrast: WorldContrast }) {
  const palette = worldPalette(contrast);
  return <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={palette.markerThickness} color={palette.selectedMarker} />;
}

/** The body of a mark: its shape, filled, or stroked for the open slot. */
function MarkBody({ x, y, r, path, stroked, ink, scale = 1, opacity = 1 }: { x: number; y: number; r: number; path: string; stroked: boolean; ink: string; scale?: number; opacity?: number }) {
  // The mark's ANCHOR: a group carrying only its origin, so what a reader of the paint can locate is
  // the object's own placed point, never a centre reconstructed from a drawn outline. LA-VIS-01: the body may be
  // PAINTED smaller about that anchor, inside it; the anchor itself, its placement, mark radius and hit radius are unchanged.
  // MAP-CLOSE-01 V-3 Part B (found on the emulator): Skia 2.6.2 records a save and a restore for a group with an origin,
  // but its native recorder saves only for a transform, matrix, clip or layer, and restores anyway. An origin-only anchor
  // therefore popped a save that was not its own: the enclosing object, plane and frame groups. The unbounded clip
  // makes the save real. It cuts nothing, and the anchor is still the one group with an origin and no transform.
  const body = stroked ? (
    <Path path={path} style="stroke" strokeWidth={Math.max(1, r * 0.42)} strokeCap="round" color={ink} />
  ) : (
    <Path path={path} color={ink} />
  );
  return (
    <Group origin={vec(x, y)} clip={ANCHOR_SAVE}>
      {scale === 1 && opacity === 1 ? (
        body
      ) : (
        <Group transform={paintedAbout(x, y, scale)} opacity={opacity}>
          {body}
        </Group>
      )}
    </Group>
  );
}

/** The anchor's clip: unbounded, so it cuts nothing and only makes the anchor's save a real one (see MarkBody). */
const ANCHOR_SAVE = Object.freeze({ x: -1e7, y: -1e7, width: 2e7, height: 2e7 });

/** The mark itself: the family's canonical morphology, filled, or stroked for the open slot. */
function Mark({
  family,
  nodeKey,
  x,
  y,
  placement,
  S,
  contrast,
  selected,
}: {
  family: MapObjectFamily;
  nodeKey: string;
  x: number;
  y: number;
  placement: WorldPlacement;
  S: WorldSchedule;
  contrast: WorldContrast;
  selected: boolean;
}) {
  const r = MARK_RADIUS_POINTS[placement];
  const tier = tierOf(placement);
  const material = markMaterial(tier, S, contrast === 'increased');
  const palette = worldPalette(contrast);
  const path = morphologyPath(family, x, y, r, presentationRotation(nodeKey));
  // SELECTED: the frozen selected ink. REST: the world's own material.
  const ink = selected ? palette.selectedInk : material.fill;
  return <MarkBody x={x} y={y} r={r} path={path} stroked={V.shapes[family].stroked} ink={ink} />;
}

export interface WorldObjectProps {
  readonly family: MapObjectFamily;
  readonly nodeKey: string;
  readonly x: number;
  readonly y: number;
  readonly placement: Exclude<WorldPlacement, 'UNGEOGRAPHIC'>;
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
  readonly contrast: WorldContrast;
  readonly selected: boolean;
  /** V-3: the world's chroma at this object's place (its Home), handed by the owner; omitted, the frozen grammar. */
  readonly chroma?: ChromaFamily;
}

/**
 * MAP-PERF-01 (candidate F): a draw bounded by a clip of its own extent. The world's tone is an image filter on each of a
 * mark's draws, and Skia sizes the filter's layer by the clip in force: unbounded, every soft light, ray and body opened
 * a layer the size of the glass on every frame. The clip contains the whole draw, so nothing of it is cut (measured on
 * the Product Owner's phone, 2026-11-11: pixel-identical); only the layer behind it is the draw's own size.
 */
function bound(x: number, y: number, reach: number, draw: React.ReactNode) {
  return <Group clip={{ x: x - reach, y: y - reach, width: 2 * reach, height: 2 * reach }}>{draw}</Group>;
}

/** A light around a body: one canonical falloff, one tier weight. */
function Light({ x, y, r, profile, hue, lightness, opacity, saturation }: { x: number; y: number; r: number; profile: 'wide' | 'soft' | 'core' | 'point'; hue: number; lightness: number; opacity: DerivedValue<number> | number; saturation?: number }) {
  const f = falloff(profile, hue, saturation ?? (profile === 'core' ? V.mark.haloSat * V.mark.coreSatShare : V.mark.haloSat), lightness);
  return bound(
    x,
    y,
    r + 2,
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x, y)} r={r} colors={f.colors} positions={f.positions} />
      </Circle>
    </Group>,
  );
}

/**
 * S5-03B Phase 1 — the SHAPE a mark is drawn in, kept apart from its MATERIAL. A family's morphology is one
 * shape; the material around it (the tier's ground, light, NEAR limb and core, and the attached SELECTED marker)
 * is the world's own and is the same for every shape. `path` is the body and the NEAR limb; `stroked` draws the
 * open slot; `limbAngle` is the presentation angle the lit limb faces.
 */
export interface WorldMarkShape {
  readonly path: string;
  readonly stroked: boolean;
  readonly limbAngle: number;
}

export interface WorldMarkProps {
  readonly x: number;
  readonly y: number;
  /** The mark radius, in points (constant per tier). */
  readonly r: number;
  readonly tier: WorldTier;
  /** The radius of the attached SELECTED marker, inside the hit radius of the same placement. */
  readonly markerRadius: number;
  readonly shape: WorldMarkShape;
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
  readonly contrast: WorldContrast;
  readonly selected: boolean;
  /** V-3: the world's chroma at the mark's place; omitted (or at increased contrast), the frozen grammar. */
  readonly chroma?: ChromaFamily;
}

/** One placed locus of the Personal world: its family's morphology, in the world's material. */
export function WorldObject({ family, nodeKey, x, y, placement, S, response, contrast, selected, chroma }: WorldObjectProps) {
  const r = MARK_RADIUS_POINTS[placement];
  const rotation = presentationRotation(nodeKey);
  const shape: WorldMarkShape = {
    path: morphologyPath(family, x, y, r, rotation),
    stroked: V.shapes[family].stroked,
    limbAngle: rotation * V.shapes[family].rotation,
  };
  return (
    <WorldMark
      x={x}
      y={y}
      r={r}
      tier={tierOf(placement)}
      markerRadius={markerRadius(placement, worldPalette(contrast).markerThickness)}
      shape={shape}
      S={S}
      response={response}
      contrast={contrast}
      selected={selected}
      chroma={chroma}
    />
  );
}

/** One mark in the world's material, in any shape: constant per tier, nothing about it varies per object. */
export function WorldMark({ x, y, r, tier, markerRadius: marker, shape, S, response, contrast, selected, chroma }: WorldMarkProps) {
  if (chroma !== undefined && contrast === 'standard') {
    return <ChromaticMark x={x} y={y} r={r} tier={tier} marker={marker} shape={shape} S={S} response={response} selected={selected} chroma={chroma} />;
  }
  const m = V.mark[tier];
  const material = markMaterial(tier, S, contrast === 'increased');
  const palette = worldPalette(contrast);
  const hue = mediumHue(S.lod);
  const lx = Math.cos(shape.limbAngle);
  const ly = Math.sin(shape.limbAngle);
  return (
    <>
      {/* The place the world makes for a place: a subtractive local ground, major tier only (§14). */}
      {tier === 'major' ? (
        <Group opacity={response.groundMajor}>
          <Group opacity={BLOOM.clearing}>
            {bound(
              x,
              y,
              r * V.material.objGnd.r + 2,
              <Circle cx={x} cy={y} r={r * V.material.objGnd.r}>
                <RadialGradient c={vec(x, y)} r={r * V.material.objGnd.r} colors={SHADE_GRADIENT.colors} positions={SHADE_GRADIENT.positions} />
              </Circle>,
            )}
          </Group>
        </Group>
      ) : null}
      {/* The medium's light around the body, and at NEAR its wider atmosphere. Constant per tier. */}
      <Light x={x} y={y} r={r * m.halo} profile="wide" hue={hue} lightness={V.mark.haloLight} opacity={tier === 'major' ? response.haloMajor : response.haloMinor} />
      <Light x={x} y={y} r={r * m.haloWide} profile="soft" hue={hue} lightness={V.mark.haloWideLight} opacity={tier === 'major' ? response.haloWideMajor : response.haloWideMinor} />
      {/* LA-VIS-01: the tier's own bloom and hot centre — a hub is a source of light, a minor body a smaller one. */}
      {BLOOM[tier].wide > 0 ? <Light x={x} y={y} r={r * BLOOM[tier].wide} profile="soft" hue={hue} lightness={BLOOM.wideLight} opacity={BLOOM[tier].wideAlpha} /> : null}
      <Light x={x} y={y} r={r * BLOOM[tier].r} profile="point" hue={hue} lightness={BLOOM.light} opacity={BLOOM[tier].alpha} />
      <Light x={x} y={y} r={r * BLOOM[tier].hot} profile="point" hue={hue} lightness={BLOOM.hotLight} opacity={BLOOM[tier].hotAlpha} />
      <MarkBody x={x} y={y} r={r} path={shape.path} stroked={shape.stroked} ink={selected ? palette.selectedInk : material.fill} scale={selected ? 1 : BLOOM[tier].body} opacity={selected ? 1 : BLOOM[tier].bodyAlpha} />
      {/* The hub's compact near-white core: a precise point of light on the place, not a glowing capsule. */}
      <Light x={x} y={y} r={r * BLOOM[tier].white} profile="point" hue={hue} lightness={BLOOM.whiteLight} saturation={BLOOM.whiteSat} opacity={BLOOM[tier].whiteAlpha} />
      {/* NEAR: a lit limb and a luminous interior, so the shape bounds a body (§14, WS7R-V §V4b). With no
          runtime focus to face, the limb faces the mark's own presentation angle, as the canonical
          painter does when there is no focus. */}
      <Group opacity={response.near} transform={selected ? undefined : paintedAbout(x, y, BLOOM[tier].body)}>
        <Path path={shape.path} style="stroke" strokeWidth={r * V.mark.limbWidth}>
          <LinearGradient
            start={vec(x + lx * r * 1.15, y + ly * r * 1.15)}
            end={vec(x - lx * r * 1.15, y - ly * r * 1.15)}
            colors={[
              hsla(V.worldHue, Math.min(100, material.saturation * 1.12), material.light + 4, material.alpha * V.mark.limbShare),
              hsla(V.worldHue, Math.min(100, material.saturation * 1.02), material.light - 2, material.alpha * V.mark.limbShare * 0.3),
              hsla(V.worldHue, material.saturation, material.light, 0),
            ]}
            positions={[0, 0.38, 1]}
          />
        </Path>
        <Light x={x} y={y} r={r * m.core} profile="core" hue={V.worldHue} lightness={Math.min(90, material.light + 2)} opacity={material.alpha * m.coreAlpha} />
      </Group>
      {selected ? <SelectedMarker x={x} y={y} r={marker} contrast={contrast} /> : null}
    </>
  );
}

/**
 * MAP-CLOSE-01 V-3 — the approved S3-R2 node grammar, in the colour of the mark's place:
 *
 *   light   the energy sits in a soft, wide glow of the place's own colour, not at the centre: the centre stays the
 *           brightest point without becoming a white disc (S3-R2 `core`, `bloom`);
 *   rays    a few fine rays (9 on a place, 4 on a minor body), fading outward; their angles and lengths come from the
 *           mark's meaning-free presentation angle, like its rotation, and say nothing;
 *   ring    a thin ring around the body, in a lighter tone of the same colour. The SELECTED marker replaces it, in the
 *           frozen selected ink and thickness, so selection is still a shape and never a colour alone;
 *   centre  the family's own morphology, small and near-white: the clear centre of the star still says what it is.
 *
 * Constant per tier, as the frozen grammar: nothing varies per object but its place's colour and its presentation angle.
 * No animation, no time, no measure. Its NEAR limb and luminous interior are the frozen ones, worn in the same colour.
 */
function ChromaticMark({
  x,
  y,
  r,
  tier,
  marker,
  shape,
  S,
  response,
  selected,
  chroma,
}: {
  x: number;
  y: number;
  r: number;
  tier: WorldTier;
  marker: number;
  shape: WorldMarkShape;
  S: WorldSchedule;
  response: WorldResponse;
  selected: boolean;
  chroma: ChromaFamily;
}) {
  const m = V.mark[tier];
  const c = CHROMATIC[tier];
  const material = markMaterial(tier, S, false);
  const palette = worldPalette('standard');
  const hue = chroma.hue;
  const sat = chroma.saturation * CHROMATIC.glowSat;
  const tone = (lift: number) => Math.min(CHROMATIC.maxLight, chroma.lightness + lift);
  const lx = Math.cos(shape.limbAngle);
  const ly = Math.sin(shape.limbAngle);
  const reach = r * c.rayMax;
  return (
    <>
      {tier === 'major' ? (
        <Group opacity={response.groundMajor}>
          <Group opacity={BLOOM.clearing}>
            {bound(
              x,
              y,
              r * V.material.objGnd.r + 2,
              <Circle cx={x} cy={y} r={r * V.material.objGnd.r}>
                <RadialGradient c={vec(x, y)} r={r * V.material.objGnd.r} colors={SHADE_GRADIENT.colors} positions={SHADE_GRADIENT.positions} />
              </Circle>,
            )}
          </Group>
        </Group>
      ) : null}
      {/* The light, in the place's own colour: the medium's halo and wide atmosphere, then the tier's soft pool. */}
      <Light x={x} y={y} r={r * m.halo} profile="wide" hue={hue} saturation={sat} lightness={tone(CHROMATIC.lift.halo)} opacity={tier === 'major' ? response.haloMajor : response.haloMinor} />
      <Light x={x} y={y} r={r * m.haloWide} profile="soft" hue={hue} saturation={sat} lightness={tone(CHROMATIC.lift.halo)} opacity={tier === 'major' ? response.haloWideMajor : response.haloWideMinor} />
      <Light x={x} y={y} r={r * c.wide} profile="soft" hue={hue} saturation={sat} lightness={tone(CHROMATIC.lift.wide)} opacity={c.wideAlpha} />
      <Light x={x} y={y} r={r * c.bloom} profile="point" hue={hue} saturation={sat} lightness={tone(CHROMATIC.lift.bloom)} opacity={c.bloomAlpha} />
      <Light x={x} y={y} r={r * c.hot} profile="point" hue={hue} saturation={chroma.saturation * CHROMATIC.hotSat} lightness={tone(CHROMATIC.lift.hot)} opacity={c.hotAlpha} />
      {/* The rays: one path, fading outward from the centre. */}
      {bound(
        x,
        y,
        reach + CHROMATIC.rayWidth + 2,
        <Path path={rayPath(x, y, r, shape.limbAngle, c)} style="stroke" strokeWidth={CHROMATIC.rayWidth} strokeCap="round">
          <RadialGradient
            c={vec(x, y)}
            r={reach}
            colors={[hsla(hue, sat, tone(CHROMATIC.lift.ray), CHROMATIC.rayAlpha), hsla(hue, sat, tone(CHROMATIC.lift.bloom), CHROMATIC.rayAlpha * 0.35), hsla(hue, sat, tone(CHROMATIC.lift.bloom), 0)]}
            positions={[0, 0.45, 1]}
          />
        </Path>,
      )}
      {selected ? null : <LitRim x={x} y={y} radius={r * c.ring} width={c.ringWidth} colour={(a) => hsla(hue, sat, tone(CHROMATIC.lift.ring), a)} />}
      {bound(x, y, r * 3 + 4, <MarkBody x={x} y={y} r={r} path={shape.path} stroked={shape.stroked} ink={selected ? palette.selectedInk : hsla(hue, CHROMATIC.centreSat, CHROMATIC.centreLight, CHROMATIC.centreAlpha)} scale={selected ? 1 : c.body} />)}
      <Light x={x} y={y} r={r * c.white} profile="point" hue={hue} lightness={BLOOM.whiteLight} saturation={BLOOM.whiteSat} opacity={c.whiteAlpha} />
      {bound(
        x,
        y,
        r * 3 + 4,
        <Group opacity={response.near} transform={selected ? undefined : paintedAbout(x, y, c.body)}>
        <Path path={shape.path} style="stroke" strokeWidth={r * V.mark.limbWidth}>
          <LinearGradient
            start={vec(x + lx * r * 1.15, y + ly * r * 1.15)}
            end={vec(x - lx * r * 1.15, y - ly * r * 1.15)}
            colors={[
              hsla(hue, Math.min(100, sat * 1.12), tone(CHROMATIC.lift.ring), material.alpha * V.mark.limbShare),
              hsla(hue, sat, tone(CHROMATIC.lift.bloom), material.alpha * V.mark.limbShare * 0.3),
              hsla(hue, sat, tone(CHROMATIC.lift.bloom), 0),
            ]}
            positions={[0, 0.38, 1]}
          />
        </Path>
        <Light x={x} y={y} r={r * m.core} profile="core" hue={hue} lightness={tone(CHROMATIC.lift.ring)} opacity={material.alpha * m.coreAlpha} />
        </Group>,
      )}
      {selected ? <SelectedMarker x={x} y={y} r={marker} contrast="standard" /> : null}
    </>
  );
}

/**
 * The ring of S3-R2 as LIGHT, not as a drawn outline: a filled disc whose radial gradient is lit only in a thin band at
 * the ring's radius. The one stroked outline a mark may carry stays the SELECTED marker, so the selected state remains a
 * shape of its own and is never confused with a resting mark.
 */
function LitRim({ x, y, radius, width, colour }: { x: number; y: number; radius: number; width: number; colour: (alpha: number) => string }) {
  const outer = radius + width;
  const at = (d: number) => Math.min(1, Math.max(0, d / outer));
  return bound(
    x,
    y,
    outer + 2,
    <Circle cx={x} cy={y} r={outer}>
      <RadialGradient c={vec(x, y)} r={outer} colors={[colour(0), colour(0), colour(CHROMATIC.ringAlpha), colour(0)]} positions={[0, at(radius - width), at(radius), 1]} />
    </Circle>,
  );
}

/** The rays of one mark as one path: count and lengths per tier, angles from its meaning-free presentation angle. */
function rayPath(x: number, y: number, r: number, angle: number, c: (typeof CHROMATIC)['major' | 'minor']): string {
  const parts: string[] = [];
  for (let i = 0; i < c.rays; i += 1) {
    // A fixed, irregular spread: the golden angle, nudged by a hash of the mark's angle — stable, and meaning-free.
    const u = fract(Math.sin((angle + 1.37) * (i + 1) * 12.9898) * 43758.5453);
    const a = angle + i * 2.39996 + (u - 0.5) * 0.9;
    const length = r * (c.rayMin + (c.rayMax - c.rayMin) * fract(u * 7.31 + i * 0.618));
    parts.push(`M ${x} ${y} L ${x + Math.cos(a) * length} ${y + Math.sin(a) * length}`);
  }
  return parts.join(' ');
}

const fract = (value: number) => value - Math.floor(value);

/**
 * V-3 — the S3-R2 node grammar's shares per tier (multiples of the mark radius, and weights) and its tone lifts above the
 * place's own lightness (percent). Sizes, weights and lifts only: every hue and saturation is the place's chroma.
 */
const CHROMATIC = Object.freeze({
  // R1 (device comparison with S3-R2, 2026-11-10): a smaller centre, a whiter hot point, a closer and more saturated
  // ring, and a stronger, more concentrated bloom — the node reads as a light, not as a body inside a ring.
  major: { wide: 8.5, wideAlpha: 0.32, bloom: 3.0, bloomAlpha: 0.85, hot: 1.25, hotAlpha: 0.9, rays: 9, rayMin: 1.25, rayMax: 3.6, ring: 1.12, ringWidth: 1.6, body: 0.45, white: 0.5, whiteAlpha: 0.95 },
  minor: { wide: 4.2, wideAlpha: 0.16, bloom: 1.8, bloomAlpha: 0.55, hot: 0.8, hotAlpha: 0.6, rays: 4, rayMin: 1.2, rayMax: 2.2, ring: 1.15, ringWidth: 1.1, body: 0.42, white: 0.36, whiteAlpha: 0.8 },
  lift: { halo: 0, wide: 6, bloom: 14, hot: 26, ray: 30, ring: 20 },
  maxLight: 90,
  glowSat: 0.95,
  hotSat: 0.85,
  rayWidth: 0.55,
  rayAlpha: 0.6,
  ringAlpha: 1,
  centreSat: 35,
  centreLight: 95,
  centreAlpha: 0.97,
  /** The relation's glow: its weight, and the share of its span over which it rises from and falls to nothing. */
  tetherGlowAlpha: 0.7,
  tetherGlowRise: 0.22,
  tetherCoreLift: 30,
  /** The relation's gentle bow, as a share of its span. Presentation only: its two ends are exactly the placement's. */
  tetherBow: 0.1,
  /** The least weight the relation's core is drawn with: it is the clearest line, never fainter than the world. */
  tetherCoreFloor: 0.75,
});

/**
 * One relation as a quadratic bow between its two ends: the control point sits off the span's midpoint by `share` of its
 * length, on a side fixed by the two ends alone. A presentation curve only — it carries no direction, rank or meaning.
 */
function bowedPath(x1: number, y1: number, x2: number, y2: number, share: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const side = fract(Math.sin(x1 * 12.9898 + y1 * 78.233 + x2 * 37.719 + y2 * 4.581) * 43758.5453) < 0.5 ? -1 : 1;
  const cx = (x1 + x2) / 2 - dy * share * side;
  const cy = (y1 + y2) / 2 + dx * share * side;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

/**
 * The world's colour around ONE disclosed place: the canonical territory-atmosphere material (its interior
 * stops, in the world's colour) without its rim — there is no territory, so there is no boundary to draw.
 * One per Home, identical for every Home: where the reader's places are, the world is; nothing else is said.
 * A world-space quantity, so it is NOT counter-scaled: it travels and scales with the plane like the world.
 */
export function WorldPlaceAtmosphere({
  x,
  y,
  radius,
  response,
  seed = '',
  chroma,
}: {
  x: number;
  y: number;
  radius: number;
  response: WorldResponse;
  /** LA-VIS-01: the place's scene key, read only for a stable, meaning-free shape of its light (like its rotation). */
  seed?: string;
  /** LA-VIS-01: the world's chroma at this place's address (`./world-chroma`): where it is, never what it is. */
  chroma?: ChromaFamily;
}) {
  // LA-VIS-01: close in, a place's light is the air the reader is inside, not a glare over everything. The mass is drawn
  // at three WORLD sizes — its body, and sub-masses at one and two rungs finer — each weighted by the PRESENTED approach
  // (on the plane's own frames, so a travel resolves it continuously). At every distance the glass therefore holds the
  // material at the size it has at FAR: entering a place is entering its atmosphere, never a blur of one big body.
  const weights = MASS.levels.map((level) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a fixed count of levels, the same on every render
    useReadingOf(response.approach, (A) => {
      'worklet';
      const [a0, a1, a2] = level.at;
      const [w0, w1, w2] = level.weight;
      if (A <= a1) {
        const t = Math.min(1, Math.max(0, (A - a0) / (a1 - a0)));
        return w0 + (w1 - w0) * t * t * (3 - 2 * t);
      }
      const t = Math.min(1, Math.max(0, (A - a1) / (a2 - a1)));
      return w1 + (w2 - w1) * t * t * (3 - 2 * t);
    }),
  );
  // A size whose weight is exactly zero contributes nothing, so it is not drawn: an empty clip lets the canvas skip its
  // layer and its copies (pixel-identical — a zero-weight layer is wholly masked away). Any non-zero weight opens an
  // unbounded clip, so a drawn size is never cut. Read on the UI runtime on the plane's own frames: no crossing.
  const clips = weights.map((weight) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a fixed count of levels, the same on every render
    useReadingOf(weight, (w) => {
      'worklet';
      return w > 0 ? MASS_OPEN : MASS_CLOSED;
    }),
  );
  // MAP-PERF-01 (candidate F): the wash is closed (an empty clip) where its weight is zero, like a mass size.
  const washClip = useReadingOf(response.approach, (A) => {
    'worklet';
    return A > MASS.washFrom ? MASS_OPEN : MASS_CLOSED;
  });
  const washShare = useReadingOf(response.approach, (A) => {
    'worklet';
    const t = Math.min(1, Math.max(0, (A - MASS.washFrom) / (MASS.washTo - MASS.washFrom)));
    return t * t * (3 - 2 * t);
  });
  if (!(radius > 0)) return null;
  const stops = V.worldAtmosphere.stops;
  const [, s0, l0] = stops[0];
  const [, s1, l1] = stops[1];
  const tone = massTone(chroma, s0, l0, s1, l1);
  const family: ChromaFamily = chroma ?? { hue: V.worldHue, saturation: s0, lightness: l0 + MASS.canonicalLift };
  const picture = massPicture(seed, family);
  const raster = rasterBehind(picture);
  const half = MASS_EXTENT * MASS_UNIT;
  return (
    <Group opacity={response.placeAtmosphere}>
      {/* LA-VIS-01 — a semantic MASS rather than a disc: an irregular, volumetric body with its own internal material
          (./world-mass). Every place carries the same material in the same amounts; its shape variant alone is chosen by
          its key, and its colour by the world at its address, so nothing about it is said by it. Light accumulates where
          places are many: the territories the eye reads are the real density of real places, and nothing else. */}
      <Group opacity={washShare} clip={washClip}>
        {/* Close in, a calm wash of the place's colour: the world never falls back to bare space. MAP-PERF-01: the wash is
            the one vector draw of the material, and it keeps the world's tone, on itself, in its own bounds. */}
        <WorldTone>
          {bound(
            x,
            y,
            radius * MASS.wash + 2,
            <Circle cx={x} cy={y} r={radius * MASS.wash} blendMode="screen">
              <RadialGradient
                c={vec(x, y)}
                r={radius * MASS.wash}
                colors={[hsla(tone.heartHue, tone.sat, tone.light, MASS.washAlpha), hsla(tone.hazeHue ?? tone.heartHue, tone.sat, tone.light - 4, MASS.washAlpha * 0.5), hsla(tone.hazeHue ?? tone.heartHue, tone.sat, tone.light - 8, 0)]}
                positions={[0, 0.55, 1]}
              />
            </Circle>,
          )}
        </WorldTone>
      </Group>
      {MASS.levels.map((level, depth) => {
        // The bounds every copy of this level can reach: the mask covers them, and nothing else.
        const cover = radius * (level.reach[1] + level.size * 1.3 * MASS_EXTENT);
        // MAP-PERF-01 (candidate F): a size of ONE copy is that copy's raster at the size's weight, with no layer (the
        // same pixels at the same weight; a layer is needed only where copies overlap).
        if (level.copies === 1 && raster !== undefined) {
          const copy = massCopies(seed, depth, level)[0];
          return (
            <Group key={depth} clip={clips[depth]}>
              <Group transform={[{ translateX: x + copy.dx * radius }, { translateY: y + copy.dy * radius }, { rotate: copy.rotate }, { scale: (radius * copy.size) / MASS_UNIT }]}>
                <Image image={raster.image} x={-half} y={-half} width={half * 2} height={half * 2} fit="fill" opacity={weights[depth]} sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }} />
              </Group>
            </Group>
          );
        }
        return (
          <Group key={depth} clip={clips[depth]}>
            <FadedLayer opacity={weights[depth]} x={x - cover} y={y - cover} width={cover * 2} height={cover * 2}>
              {massCopies(seed, depth, level).map((copy, index) => (
                <Group key={index} transform={[{ translateX: x + copy.dx * radius }, { translateY: y + copy.dy * radius }, { rotate: copy.rotate }, { scale: (radius * copy.size) / MASS_UNIT }]}>
                  <Picture picture={picture} />
                </Group>
              ))}
            </FadedLayer>
          </Group>
        );
      })}
    </Group>
  );
}

/**
 * A paint scale about a mark's own point, as a plain transform (no origin), so the only groups that carry an origin
 * remain a mark's anchor and an arrival — the signatures a reader of the paint locates them by.
 */
function paintedAbout(x: number, y: number, scale: number) {
  return [{ translateX: x }, { translateY: y }, { scale }, { translateX: -x }, { translateY: -y }];
}

/** The clip of a mass size that is drawn (unbounded) and of one at zero weight (empty: nothing of it is drawn). */
const MASS_OPEN = Object.freeze({ x: -1e7, y: -1e7, width: 2e7, height: 2e7 });
const MASS_CLOSED = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

/** Where a mass's copies sit at one level, in radii of the place: the body itself, or sub-masses around the place. */
function massCopies(seed: string, depth: number, level: (typeof MASS.levels)[number]) {
  if (level.copies === 1) return [{ dx: 0, dy: 0, size: level.size, rotate: presentationRotation(seed) }];
  return Array.from({ length: level.copies }, (_, index) => {
    const angle = presentationRotation(`${index}:sa${depth}:${seed}`);
    const share = presentationRotation(`${index}:sd${depth}:${seed}`) / (Math.PI * 2);
    // The first copy sits on the place itself: close in, the reader is inside the place's own mass.
    const distance = index === 0 ? 0 : level.reach[0] + (level.reach[1] - level.reach[0]) * Math.sqrt(share);
    return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: level.size * (0.7 + 0.6 * share), rotate: presentationRotation(`${index}:sr${depth}:${seed}`) };
  });
}

/**
 * The colours of one mass. Without a chroma it is the canonical world (the world hue at its heart, the cloud ladder in
 * its lobes). With one, the whole mass is that colour, its lobes leaning a few degrees either side so the body is alive
 * rather than flat, and its heart a lighter, hotter version of it.
 */
function massTone(chroma: ChromaFamily | undefined, s0: number, l0: number, s1: number, l1: number) {
  if (chroma === undefined) {
    return { lobeHue: ladderHue, sat: s1, light: l1, heartHue: V.worldHue, heartSat: s0, heartLight: l0, hazeHue: undefined as number | undefined };
  }
  return {
    lobeHue: (rung: number) => chroma.hue + (rung - 0.45) * CHROMA.lobeSpread,
    sat: chroma.saturation * CHROMA.saturation,
    light: chroma.lightness + CHROMA.lift,
    heartHue: chroma.hue,
    heartSat: chroma.saturation * CHROMA.heartSat,
    heartLight: chroma.lightness + CHROMA.heartLift,
    hazeHue: chroma.hue + CHROMA.hazeShift as number | undefined,
  };
}

/** How a chroma is worn by a mass: lobe spread and haze lean (degrees), and lightness lifts (percent). */
const CHROMA = Object.freeze({ lobeSpread: 26, hazeShift: 14, lift: -24, saturation: 0.86, heartSat: 0.55, heartLift: -6 });

/**
 * LA-VIS-01 — the presentation shares of a place's mass, of a mark's light and of the tether's glow. Sizes, weights and
 * offsets only: every hue, saturation and lightness is generated (the world hue, the cloud ladder, the atmosphere stops).
 */
const MASS = Object.freeze({
  /** The calm wash of the mass's colour close in, as a share of its radius, its weight, and the approach it fades in over. */
  wash: 0.55,
  washAlpha: 0.07,
  washFrom: 0.2,
  washTo: 0.6,
  /** Without a chroma, the canonical world's mass is lifted this much so its material reads after the tone curve. */
  canonicalLift: 18,
  /**
   * The mass at three world sizes (a share of its radius; one rung of the ladder is ×8): how many copies, how far from the
   * place they sit (radii), and the weight at approach [from, peak, to].
   */
  levels: [
    { size: 1, copies: 1, reach: [0, 0], at: [0, 0.4, 1], weight: [1, 0, 0] },
    { size: 1 / 6, copies: 5, reach: [0.12, 0.85], at: [0.12, 0.5, 0.85], weight: [0, 0.85, 0] },
    { size: 1 / 36, copies: 5, reach: [0.015, 0.11], at: [0.55, 1, 1.01], weight: [0, 0.9, 0.9] },
  ],
});

/** Each tier's own luminous bloom (radius as a multiple of the mark radius, and weight): the hub reads as the hub. */
const BLOOM = Object.freeze({
  /**
   * `body` is the PAINTED share of the mark's body (the mark radius, the selected marker and the hit radius are
   * untouched; a selected mark is painted whole), `white` the compact near-white core, `r`/`hot` the coloured bloom.
   */
  major: { r: 3.6, alpha: 0.62, hot: 0.95, hotAlpha: 0.85, wide: 8.5, wideAlpha: 0.2, body: 0.5, bodyAlpha: 0.85, white: 0.62, whiteAlpha: 1 },
  minor: { r: 1.6, alpha: 0.2, hot: 0.6, hotAlpha: 0.32, wide: 0, wideAlpha: 0, body: 0.42, bodyAlpha: 0.55, white: 0.34, whiteAlpha: 0.55 },
  light: 70,
  hotLight: 92,
  wideLight: 56,
  whiteLight: 99,
  whiteSat: 12,
  /** How much of the canonical cleared ground stays: the world clears a place, but no longer swallows its light. */
  clearing: 0.45,
});

/** The tether's glow: a soft wide light under a finer core. */
const TETHER = Object.freeze({ core: 0.62, glow: 5.2, glowAlpha: 0.34, blur: 2.4 });

export interface WorldTetherProps {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly S: WorldSchedule;
  readonly response: WorldResponse;
  readonly contrast: WorldContrast;
  /** The counter-scale, so the stroke stays the same number of points on the glass at every rung. */
  readonly strokeScale: DerivedValue<number>;
  /** V-3: the world's chroma at the hosting place; omitted (or at increased contrast), the frozen grammar. */
  readonly chroma?: ChromaFamily;
}

/**
 * The hosting relation in the canonical connection grammar (§13): its local ground, its NEAR body and
 * its core, whose light is along the span at NEAR and at the ends at FAR and MID. It is drawn straight
 * because the T-10 arrival travels along the straight line between the same two points, and the
 * renderer may not show a path the arrival does not take.
 */
export function WorldTether(props: WorldTetherProps) {
  // MAP-PERF-01 (candidate F): the tether's draws bounded by a clip of their own extent (see `bound`): the span, its bow,
  // its widest stroke at the present counter-scale and its blur. Nothing of it is cut; only the tone's layer is its size.
  const { fromX, fromY, toX, toY, S, strokeScale } = props;
  const widest = V.material.rel.w * S.relBead * S.relW * V.relation.widthScale * Math.max(GROUND_WIDTH, BODY_WIDTH, 1, TETHER.glow);
  const bow = CHROMATIC.tetherBow * Math.hypot(toX - fromX, toY - fromY);
  const clip = useReadingOf(strokeScale, (k) => {
    'worklet';
    const pad = (widest * k) / 2 + TETHER.blur * 3 + bow + 2;
    return { x: Math.min(fromX, toX) - pad, y: Math.min(fromY, toY) - pad, width: Math.abs(toX - fromX) + 2 * pad, height: Math.abs(toY - fromY) + 2 * pad };
  });
  return (
    <Group clip={clip}>
      <TetherDraws {...props} />
    </Group>
  );
}

function TetherDraws({ fromX, fromY, toX, toY, S, response, contrast, strokeScale, chroma }: WorldTetherProps) {
  const rel = V.relation;
  const width = V.material.rel.w * S.relBead * S.relW * rel.widthScale;
  const alpha = V.material.rel.a * S.rel;
  const hue = mediumHue(S.lod);
  const p1 = vec(fromX, fromY);
  const p2 = vec(toX, toY);
  const path = `M ${fromX} ${fromY} L ${toX} ${toY}`;
  const groundAlpha = Math.min(V.material.relGnd.max, alpha * V.material.relGnd.a * V.material.relGnd.k);
  const eA = 1 + (rel.endAlpha[1] - rel.endAlpha[0]) * S.lod;
  const mA = rel.middleAlpha[0] + (rel.middleAlpha[1] - rel.middleAlpha[0]) * S.lod;
  // Screen quantities: counter-scaled with the plane's residual zoom, exactly as the objects are.
  const groundWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * GROUND_WIDTH * k;
  });
  const bodyWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * BODY_WIDTH * k;
  });
  const increased = contrast === 'increased';
  // LA-VIS-01: a finer core over a soft glow. Increased contrast keeps its full-width core (F1).
  const coreShare = increased ? 1 : TETHER.core;
  const coreWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * coreShare * k;
  });
  const glowWidth = useReadingOf(strokeScale, (k) => {
    'worklet';
    return width * TETHER.glow * k;
  });
  const palette = worldPalette(contrast);
  if (chroma !== undefined && !increased) {
    // V-3 (S3-R2 `edgeglow`): the same straight span, its glow and core in the hosting place's own colour. The glow rises
    // from nothing at both ends, so relations converging on a place never whiten it; the core stays the clearest line.
    const g = CHROMATIC.tetherGlowRise;
    const glowColour = (a: number) => hsla(chroma.hue, chroma.saturation * CHROMATIC.glowSat, Math.min(CHROMATIC.maxLight, chroma.lightness + CHROMATIC.lift.wide), a);
    const coreColour = (a: number) => hsla(chroma.hue, chroma.saturation * CHROMATIC.hotSat, Math.min(CHROMATIC.maxLight, chroma.lightness + CHROMATIC.tetherCoreLift), a);
    const glowAlpha = Math.min(1, alpha * CHROMATIC.tetherGlowAlpha);
    // R1: a line of light, as in S3-R2 — no dark ground and no wide body under it (together they read as a rail), and a
    // gentle bow whose side is a fixed function of the two ends. The ends are exactly the placement's; nothing is moved.
    const bowed = bowedPath(fromX, fromY, toX, toY, CHROMATIC.tetherBow);
    const coreAlpha = (a: number) => Math.min(1, Math.max(CHROMATIC.tetherCoreFloor, a));
    return (
      <>
        <Path path={bowed} style="stroke" strokeWidth={glowWidth} strokeCap="round" blendMode="screen">
          <LinearGradient start={p1} end={p2} colors={[glowColour(0), glowColour(glowAlpha), glowColour(glowAlpha), glowColour(0)]} positions={[0, g, 1 - g, 1]} />
          <BlurMask blur={TETHER.blur} style="normal" />
        </Path>
        <Path path={bowed} style="stroke" strokeWidth={coreWidth} strokeCap="round">
          <LinearGradient start={p1} end={p2} colors={[coreColour(coreAlpha(alpha * eA)), coreColour(coreAlpha(alpha * mA)), coreColour(coreAlpha(alpha * eA))]} positions={[0, 0.5, 1]} />
        </Path>
      </>
    );
  }
  // F1, increased contrast: the analytical relation moves up one rung and draws at full opacity. The
  // atmosphere does not move, so the ratio between them widens — "high contrast is not high importance".
  const core = increased
    ? { colors: [hexRgba(palette.analysisRelation, 1), hexRgba(palette.analysisRelation, 1), hexRgba(palette.analysisRelation, 1)] }
    : {
        colors: [
          hsla(hue, rel.end.sat, rel.end.light, alpha * eA),
          hsla(hue, rel.middle.sat + rel.middle.satNear * S.lod, rel.middle.light + rel.middle.lightNear * S.lod, Math.min(1, alpha * mA)),
          hsla(hue, rel.end.sat, rel.end.light, alpha * eA),
        ],
      };
  return (
    <>
      <Group opacity={response.relationGround}>
        <Path path={path} style="stroke" strokeWidth={groundWidth} strokeCap="round" color={`rgba(${rel.ground.rgb.join(',')},${groundAlpha})`} />
      </Group>
      <Group opacity={response.relationBody}>
        <Path path={path} style="stroke" strokeWidth={bodyWidth} strokeCap="round" color={hsla(hue, rel.body.sat, rel.body.light, Math.min(rel.body.max, alpha * rel.body.share))} />
      </Group>
      {/* LA-VIS-01: the relation's own glow, along the same straight span and nowhere else. */}
      <Path path={path} style="stroke" strokeWidth={glowWidth} strokeCap="round" blendMode="screen" color={hsla(hue, rel.end.sat, rel.end.light, Math.min(1, alpha * TETHER.glowAlpha))}>
        <BlurMask blur={TETHER.blur} style="normal" />
      </Path>
      <Path path={path} style="stroke" strokeWidth={coreWidth} strokeCap="round">
        <LinearGradient start={p1} end={p2} colors={core.colors} positions={[0, 0.5, 1]} />
      </Path>
    </>
  );
}

export interface RegisterMarkProps {
  readonly family: MapObjectFamily;
  readonly nodeKey: string;
  readonly x: number;
  readonly y: number;
  readonly S: WorldSchedule;
  readonly contrast: WorldContrast;
  readonly selected: boolean;
}

/** An ungeographic identity: its morphology in screen space, with no ground and no light of a place. */
export function RegisterMark({ family, nodeKey, x, y, S, contrast, selected }: RegisterMarkProps) {
  return (
    <>
      <Mark family={family} nodeKey={nodeKey} x={x} y={y} placement="UNGEOGRAPHIC" S={S} contrast={contrast} selected={selected} />
      {selected ? <SelectedMarker x={x} y={y} r={markerRadius('UNGEOGRAPHIC', worldPalette(contrast).markerThickness)} contrast={contrast} /> : null}
    </>
  );
}
