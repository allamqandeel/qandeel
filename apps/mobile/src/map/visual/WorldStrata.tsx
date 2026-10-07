/**
 * VPORT-01 — the world's non-semantic strata: the ground, the clouds, the stars, the dust and the veil.
 *
 * This is ATMOSPHERE in I-08B1's exact sense (truth rule 1): nothing here is an object, nothing
 * terminates on anything here, and every population is the same everywhere, which is the one thing
 * that makes it unable to encode anything. None of it reads a scene, a node, an inspection or a fact.
 *
 * The particulate and cloud strata are recorded ONCE per process into Skia pictures (one tile each)
 * and drawn as a small grid of translated copies, so a frame replays three short pictures instead of
 * reconciling thousands of elements. The grid's position is the world's own: it follows the plane's
 * residual translation at its D2R parallax rate, on the UI runtime, from the presentation camera's own
 * derived value — no second animation system and no per-frame JS.
 */
import {
  BlendMode,
  BlurStyle,
  FilterMode,
  FractalNoise,
  MipmapMode,
  Group,
  LinearGradient,
  Picture,
  PointMode,
  RadialGradient,
  Rect,
  RuntimeShader,
  Skia,
  StrokeCap,
  TileMode,
  createPicture,
  vec,
  type SkCanvas,
  type SkPicture,
} from '@shopify/react-native-skia';
import { usePresentationReading, type DerivedValue, type PresentationCameraBinding } from '../../motion';
import type { ViewportEnvelope } from '../camera';
import { WORLD_DUST, WORLD_NEBULA, WORLD_STARS } from './world-field.generated';
import { WORLD_VISUAL } from './world-visual.generated';
import { hsla, rgbaOf, type StratumDrift } from './world-resolver';
import type { WorldResponse } from './useWorldResponse';

// ------------------------------------------------------------------------------------- pictures

interface Bucket {
  readonly colour: string;
  readonly width: number;
  readonly soft: boolean;
  readonly points: readonly number[];
}

function drawBuckets(canvas: Parameters<Parameters<typeof createPicture>[0]>[0], buckets: readonly Bucket[]) {
  for (const bucket of buckets) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(bucket.colour));
    paint.setStrokeWidth(bucket.width);
    paint.setStrokeCap(StrokeCap.Round);
    // A soft speck is a defocused disc (the canonical `soft()` radial falloff): one blur per bucket.
    if (bucket.soft) paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, bucket.width / 4, true));
    const points = [];
    for (let index = 0; index < bucket.points.length; index += 2) points.push(vec(bucket.points[index], bucket.points[index + 1]));
    canvas.drawPoints(PointMode.Points, points, paint);
  }
}

interface StrataPictures {
  readonly dust: SkPicture;
  readonly stars: readonly SkPicture[];
  readonly nebulaBase: SkPicture;
  readonly nebulaFar: SkPicture;
  readonly nebulaMap: SkPicture;
}

let pictures: StrataPictures | null = null;

/** Recorded on first use and kept for the life of the process: the strata never change. */
function strataPictures(): StrataPictures {
  if (pictures !== null) return pictures;
  const dustTile = WORLD_DUST.tile;
  const dust = createPicture((canvas) => {
    drawBuckets(canvas, WORLD_DUST.buckets as readonly Bucket[]);
    drawBuckets(canvas, WORLD_DUST.soft as readonly Bucket[]);
  }, Skia.XYWHRect(0, 0, dustTile, dustTile));
  const stars = WORLD_STARS.bands.map((band) =>
    createPicture((canvas) => {
      // LA-VIS-01: the brighter stars of a band carry a soft bloom of their own colour, so the sky has luminous
      // depth rather than a flat sprinkle. Same stars, same places; only their light.
      drawBuckets(canvas, (band.buckets as readonly Bucket[]).filter(isBright).map(bloomOf));
      drawBuckets(canvas, band.buckets as readonly Bucket[]);
    }, Skia.XYWHRect(0, 0, WORLD_STARS.tile, WORLD_STARS.tile)),
  );
  const T = WORLD_NEBULA.tile;
  // The tile is painted with a margin of its own wrapped neighbourhood (the clouds are repeated across the edges and the
  // noises are stitched to the tile), so sampling it back never meets an edge: no seam where two tiles touch.
  const M = NEBULA.margin;
  const cloudPass = (stops: readonly (readonly number[])[], pass: number) =>
    rasterTile(T, M, NEBULA.raster, (canvas) => {
      // The canonical clouds, each broken into a few overlapping lobes so no cloud reads as a disc; then the whole
      // tile is carved by a STITCHED fractal noise, so the clouds become filaments and haze with dark lanes between
      // them. Every cloud, hue and weight is the generated one; the lobes and the carving only shape them.
      canvas.saveLayer();
      for (const cloud of WORLD_NEBULA.clouds) {
        for (const ox of [-T, 0, T]) {
          for (const oy of [-T, 0, T]) {
            const reach = cloud.r * NEBULA.reach;
            const x = cloud.x + ox;
            const y = cloud.y + oy;
            // A cloud near a tile edge is drawn again across it, so the tile is seamless.
            if (x + reach < -M || y + reach < -M || x - reach > T + M || y - reach > T + M) continue;
            for (const lobe of cloudLobes(cloud)) {
              const paint = Skia.Paint();
              paint.setAntiAlias(true);
              paint.setShader(
                Skia.Shader.MakeRadialGradient(
                  vec(x + lobe.dx, y + lobe.dy),
                  lobe.r,
                  stops.map(([, s, l, a]) => Skia.Color(hsla(cloud.hue + lobe.hueShift, s, l + lobe.light, a * cloud.a * lobe.weight * NEBULA.passGain[pass]))),
                  stops.map(([offset]) => offset),
                  TileMode.Clamp,
                ),
              );
              canvas.drawCircle(x + lobe.dx, y + lobe.dy, lobe.r, paint);
            }
          }
        }
      }
      const carve = Skia.Paint();
      carve.setShader(Skia.Shader.MakeFractalNoise(NEBULA.noise / T, NEBULA.noise / T, NEBULA.octaves, NEBULA.seed + pass, T, T));
      carve.setColorFilter(Skia.ColorFilter.MakeMatrix(noiseToAlpha(NEBULA.carveGain, NEBULA.carveFloor)));
      carve.setBlendMode(BlendMode.DstIn);
      canvas.drawRect(Skia.XYWHRect(-M, -M, T + 2 * M, T + 2 * M), carve);
      // Filaments: the creases of a stitched turbulence, lit only where the clouds already are (SrcATop), so the sky
      // gains fine luminous veins. They are texture of the atmosphere: they start and end nowhere, and join nothing.
      const [vr, vg, vb] = Skia.Color(hsla(WORLD_VISUAL.worldHue, WORLD_VISUAL.mark.haloSat, WORLD_VISUAL.mark.haloLight, 1));
      const veins = Skia.Paint();
      veins.setShader(Skia.Shader.MakeTurbulence(NEBULA.veins / T, NEBULA.veins / T, 2, NEBULA.seed + 7 + pass, T, T));
      veins.setColorFilter(Skia.ColorFilter.MakeMatrix([0, 0, 0, 0, vr, 0, 0, 0, 0, vg, 0, 0, 0, 0, vb, -NEBULA.veinSharpness, 0, 0, 0, NEBULA.veinAlpha]));
      veins.setBlendMode(BlendMode.SrcATop);
      canvas.drawRect(Skia.XYWHRect(-M, -M, T + 2 * M, T + 2 * M), veins);
      canvas.restore();
    });
  pictures = {
    dust,
    stars,
    nebulaBase: cloudPass(WORLD_NEBULA.base, 0),
    nebulaFar: cloudPass(WORLD_NEBULA.far, 1),
    nebulaMap: cloudPass(WORLD_NEBULA.map, 2),
  };
  return pictures;
}

// ------------------------------------------------------------------------------------- LA-VIS-01 material

/**
 * LA-VIS-01 — the presentation shares of the upgraded strata. Pure paint: sizes, weights and texture scales. No hue,
 * saturation or lightness is set here — every colour is a generated one (the clouds' own hues, the ground, the veil).
 */
const NEBULA = Object.freeze({
  /** The tile is painted once into an image at this share of its size; nebula light has no fine detail to lose. */
  raster: 0.7,
  /** The wrapped margin painted around the tile, in tile units, so the image is sampled away from its edges. */
  margin: 16,
  /** How far a cloud's lobes reach, as a share of its radius. */
  reach: 1.35,
  /** Noise cycles across one tile, its octaves and its seed. */
  noise: 22,
  octaves: 4,
  seed: 11,
  /** Noise → alpha: the gain and floor of the carving (alpha = gain·n − floor), so lanes go dark and wisps stay lit. */
  carveGain: 2.6,
  carveFloor: 0.6,
  /** The weight of the clouds after carving: what the carving takes, the clouds give back in their lit parts. */
  gain: 1,
  /** Per pass (base, FAR, map): the deep clouds carry the sky; the map-distance pass stays a quiet ground under places. */
  passGain: [7, 7, 2.2],
  /** Filament cycles across one tile, how thin a crease must be to light, and its peak weight. */
  veins: 18,
  veinSharpness: 16,
  veinAlpha: 0.75,
});

/** The colour matrix that turns fractal noise into a mask: its red channel becomes alpha, with contrast. */
function noiseToAlpha(gain: number, floor: number): number[] {
  return [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, gain, 0, 0, 0, -floor];
}

/** A stable, meaning-free number in [0, 1) from a cloud's generated position and a lobe index. */
function lobeHash(x: number, y: number, index: number): number {
  let hash = 0x811c9dc5;
  for (const value of [Math.round(x * 10), Math.round(y * 10), index]) {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

interface CloudLobe {
  readonly dx: number;
  readonly dy: number;
  readonly r: number;
  readonly weight: number;
  readonly hueShift: number;
  readonly light: number;
}

/** One generated cloud as overlapping lobes: the body, and three offset swells around it. */
function cloudLobes(cloud: { readonly x: number; readonly y: number; readonly r: number }): readonly CloudLobe[] {
  const lobes: CloudLobe[] = [{ dx: 0, dy: 0, r: cloud.r, weight: NEBULA.gain * 0.6, hueShift: 0, light: 0 }];
  for (let index = 1; index <= 3; index += 1) {
    const angle = lobeHash(cloud.x, cloud.y, index) * Math.PI * 2;
    const distance = cloud.r * (0.25 + 0.3 * lobeHash(cloud.x, cloud.y, index + 10));
    lobes.push({
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      r: cloud.r * (0.42 + 0.3 * lobeHash(cloud.x, cloud.y, index + 20)),
      weight: NEBULA.gain * (0.45 + 0.4 * lobeHash(cloud.x, cloud.y, index + 30)),
      // A lobe leans a little toward its neighbours in the world's own hue ladder, never outside it.
      hueShift: (lobeHash(cloud.x, cloud.y, index + 40) - 0.5) * WORLD_VISUAL.mediumShift * 2,
      light: index === 1 ? 6 : 0,
    });
  }
  return lobes;
}

/**
 * Paints a square tile ONCE into a raster image and returns a picture that draws that image back at full size. A
 * fractal noise over a whole tile is too costly to evaluate again on every frame; an image is one textured quad.
 */
function rasterTile(size: number, margin: number, share: number, draw: (canvas: SkCanvas) => void): SkPicture {
  const bounds = Skia.XYWHRect(0, 0, size, size);
  // Everything happens while the picture records (once), so nothing here runs where no picture is recorded.
  return createPicture((target) => {
    const pixels = Math.round((size + 2 * margin) * share);
    const surface = Skia.Surface.Make(pixels, pixels) ?? Skia.Surface.MakeOffscreen(pixels, pixels);
    if (surface === null) {
      draw(target);
      return;
    }
    const canvas = surface.getCanvas();
    canvas.scale(share, share);
    canvas.translate(margin, margin);
    draw(canvas);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    const image = snapshot.makeNonTextureImage?.() ?? snapshot;
    target.drawImageRectOptions(image, Skia.XYWHRect(margin * share, margin * share, size * share, size * share), bounds, FilterMode.Linear, MipmapMode.None, Skia.Paint());
  }, bounds);
}

/** A star bright enough to carry its own bloom. */
const BLOOM = Object.freeze({ alpha: 0.4, width: 3, share: 0.18 });

function alphaOf(colour: string): number {
  const parts = colour.slice(colour.indexOf('(') + 1, colour.indexOf(')')).split(',');
  return parts.length === 4 ? Number(parts[3]) : 1;
}

function isBright(bucket: Bucket): boolean {
  return alphaOf(bucket.colour) >= BLOOM.alpha;
}

/** The same star, as a wide defocused disc of its own colour at a share of its alpha. */
function bloomOf(bucket: Bucket): Bucket {
  const alpha = alphaOf(bucket.colour);
  const colour = `${bucket.colour.slice(0, bucket.colour.lastIndexOf(','))},${Math.round(alpha * BLOOM.share * 1000) / 1000})`;
  return { colour, width: bucket.width * BLOOM.width, soft: true, points: bucket.points };
}

// ------------------------------------------------------------------------------------- one stratum

/**
 * One tiled stratum. The grid covers the envelope plus one tile, and its origin is the stratum's
 * world offset plus the plane's residual translation at the stratum's rate, wrapped to the tile.
 */
function Stratum({
  motion,
  drift,
  tile,
  envelope,
  opacity,
  children,
}: {
  readonly motion: PresentationCameraBinding;
  readonly drift: StratumDrift;
  readonly tile: number;
  readonly envelope: ViewportEnvelope;
  readonly opacity: DerivedValue<number> | number;
  readonly children: (key: string) => React.ReactNode;
}) {
  const { offsetX, offsetY, follow } = drift;
  const transform = usePresentationReading(motion, (plane) => {
    'worklet';
    const wrap = (value: number) => ((value % tile) + tile) % tile;
    return [{ translateX: wrap(offsetX + plane[0].translateX * follow) - tile }, { translateY: wrap(offsetY + plane[1].translateY * follow) - tile }];
  });
  const cols = Math.ceil(envelope.width / tile) + 1;
  const rows = Math.ceil(envelope.height / tile) + 1;
  const cells: React.ReactNode[] = [];
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      cells.push(
        <Group key={`${col}:${row}`} transform={[{ translateX: col * tile }, { translateY: row * tile }]}>
          {children(`${col}:${row}`)}
        </Group>,
      );
    }
  }
  return (
    <Group opacity={opacity}>
      <Group transform={transform}>{cells}</Group>
    </Group>
  );
}

// ------------------------------------------------------------------------------------- the layers

export interface WorldStrataDrift {
  readonly nebula: StratumDrift;
  readonly stars: StratumDrift;
  readonly dust: StratumDrift;
}

/**
 * LA-VIS-01 — the world's hue ladder: the distinct hues of the generated clouds, coolest first. The deep ground takes its
 * colour from this ladder, so the world below the clouds is the same world, only further away.
 */
export const WORLD_HUE_LADDER: readonly number[] = Object.freeze(
  [...new Set(WORLD_NEBULA.clouds.map((cloud) => cloud.hue))].filter((hue) => hue >= WORLD_VISUAL.worldHue).sort((p, q) => p - q),
);

/**
 * The deep ground's three screen-space glows: where each sits (a share of the glass), how wide (a share of its
 * diagonal), which rung of the hue ladder (a share of the ladder) and how lit. Fixed for every world and every frame:
 * screen-space light that never moves with the camera and so can say nothing about where anything is.
 */
const DEEP_GROUND = Object.freeze([
  { x: 0.28, y: 0.3, r: 0.62, rung: 1, light: 12, alpha: 0.4 },
  { x: 0.78, y: 0.62, r: 0.58, rung: 0.55, light: 10, alpha: 0.32 },
  { x: 0.46, y: 0.92, r: 0.5, rung: 0, light: 9, alpha: 0.26 },
] as const);

/** The ladder at a share: 0 is the world's own hue, 1 its deepest cloud hue. */
export function ladderHue(rung: number): number {
  const ladder = WORLD_HUE_LADDER.length === 0 ? [WORLD_VISUAL.worldHue] : WORLD_HUE_LADDER;
  return ladder[Math.min(ladder.length - 1, Math.max(0, Math.round(rung * (ladder.length - 1))))];
}

/** The ground and the floor: screen space, never moved by the camera. */
export function WorldGround({ envelope, response }: { readonly envelope: ViewportEnvelope; readonly response: WorldResponse }) {
  const [a, b, c] = WORLD_VISUAL.material.ground;
  const d = WORLD_VISUAL.groundDirection;
  const diagonal = Math.hypot(envelope.width, envelope.height);
  const sat = WORLD_VISUAL.material.neb.sat;
  return (
    <>
      <Rect x={0} y={0} width={envelope.width} height={envelope.height}>
        <LinearGradient start={vec(0, 0)} end={vec(envelope.width * d.x, envelope.height * d.y)} colors={[a, b, c]} positions={[0, 0.5, 1]} />
      </Rect>
      {/* LA-VIS-01: the deep ground — blue-black depth below the clouds, never an empty black. */}
      {DEEP_GROUND.map((glow, index) => {
        const cx = envelope.width * glow.x;
        const cy = envelope.height * glow.y;
        const r = diagonal * glow.r;
        const hue = ladderHue(glow.rung);
        return (
          <Rect key={`deep:${index}`} x={0} y={0} width={envelope.width} height={envelope.height} blendMode="screen">
            <RadialGradient
              c={vec(cx, cy)}
              r={r}
              colors={[hsla(hue, sat, glow.light, glow.alpha), hsla(hue, sat, glow.light * 0.8, glow.alpha * 0.45), hsla(hue, sat, glow.light * 0.6, 0)]}
              positions={[0, 0.45, 1]}
            />
          </Rect>
        );
      })}
      <Rect x={0} y={0} width={envelope.width} height={envelope.height} color={rgbaOf(WORLD_VISUAL.floor.rgb, 1)} opacity={response.floor} />
    </>
  );
}

/**
 * The world-anchored atmosphere. `ambient` and `emptySpace` are the two OPEN-17 paint channels, and
 * they reach these strata as plain numeric group opacities — at the default 0.5 each stratum is
 * exactly its canonical weight — so a different tuning changes nonsemantic pixels and nothing else.
 */
export function WorldAtmosphere({
  motion,
  envelope,
  response,
  drift,
  ambient,
  emptySpace,
}: {
  readonly motion: PresentationCameraBinding;
  readonly envelope: ViewportEnvelope;
  readonly response: WorldResponse;
  readonly drift: WorldStrataDrift;
  readonly ambient: number;
  readonly emptySpace: number;
}) {
  const p = strataPictures();
  return (
    <>
      <Group opacity={Math.min(1, ambient * 2)}>
        <Stratum motion={motion} drift={drift.nebula} tile={WORLD_NEBULA.tile} envelope={envelope} opacity={1}>
          {() => (
            <>
              <Group opacity={response.nebulaBase}>
                <Picture picture={p.nebulaBase} />
              </Group>
              <Group opacity={response.nebulaFar}>
                <Picture picture={p.nebulaFar} />
              </Group>
              <Group opacity={response.nebulaMap}>
                <Picture picture={p.nebulaMap} />
              </Group>
            </>
          )}
        </Stratum>
      </Group>
      <Group opacity={Math.min(1, emptySpace * 2)}>
        <Stratum motion={motion} drift={drift.stars} tile={WORLD_STARS.tile} envelope={envelope} opacity={1}>
          {() =>
            p.stars.map((picture, index) => (
              <Group key={index} opacity={response.starBands[index]}>
                <Picture picture={picture} />
              </Group>
            ))
          }
        </Stratum>
        <Stratum motion={motion} drift={drift.dust} tile={WORLD_DUST.tile} envelope={envelope} opacity={response.dust}>
          {() => <Picture picture={p.dust} />}
        </Stratum>
      </Group>
    </>
  );
}

// ------------------------------------------------------------------------------------- the tone curve

/**
 * The canonical tone curve, exactly: `out = (1 − a)·w + a·w²` per channel (renderComposite draws the light
 * buffer over itself with `multiply` at `P.toneA`). It crushes the lows and leaves 1.0 at 1.0 — it is why the
 * I-08B1 sky is near-black rather than grey, and why its colour is mass rather than haze.
 */
const TONE_SKSL = `
uniform shader image;
uniform float a;
half4 main(float2 xy) {
  half4 c = image.eval(xy);
  return half4(c.rgb * (1.0 - a) + c.rgb * c.rgb * a, c.a);
}`;

let toneEffect: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined;

function worldTone() {
  if (toneEffect === undefined) toneEffect = Skia.RuntimeEffect.Make(TONE_SKSL);
  return toneEffect;
}

/**
 * Applies the tone curve to the world it wraps, as an image filter on one layer. The curve is pointwise,
 * so it needs no neighbourhood and no display fact: the Map reads no pixel ratio (T-11 — a reusable
 * surface does not take the display as its authority).
 */
export function WorldTone({ children }: { readonly children: React.ReactNode }) {
  const effect = worldTone();
  if (effect === null) return <>{children}</>;
  return (
    <Group>
      <RuntimeShader source={effect} uniforms={{ a: WORLD_VISUAL.tone.a }} />
      {children}
    </Group>
  );
}

/** The veil over the world: the canonical vignette and grain. Screen space; it encodes nothing. */
export function WorldVeil({ envelope, response }: { readonly envelope: ViewportEnvelope; readonly response: WorldResponse }) {
  const v = WORLD_VISUAL.vignette;
  const strength = WORLD_VISUAL.material.vignette;
  const cx = envelope.width / 2;
  const cy = envelope.height / 2;
  const outer = Math.hypot(envelope.width, envelope.height) * v.outer;
  const inner = Math.min(envelope.width, envelope.height) * v.inner;
  const start = Math.min(0.99, inner / outer);
  const mid = start + (1 - start) * v.midStop;
  return (
    <>
      <Rect x={0} y={0} width={envelope.width} height={envelope.height} opacity={response.vignette}>
        <RadialGradient
          c={vec(cx, cy)}
          r={outer}
          colors={[rgbaOf(v.rgb, 0), rgbaOf(v.rgb, 0), rgbaOf(v.rgb, strength * v.midShare), rgbaOf(v.rgb, strength)]}
          positions={[0, start, mid, 1]}
        />
      </Rect>
      <Rect x={0} y={0} width={envelope.width} height={envelope.height} opacity={WORLD_VISUAL.material.grain} blendMode="softLight">
        <FractalNoise freqX={0.9} freqY={0.9} octaves={1} />
      </Rect>
    </>
  );
}
