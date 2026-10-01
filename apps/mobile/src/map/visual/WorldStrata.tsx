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
  BlurStyle,
  FractalNoise,
  Group,
  LinearGradient,
  Picture,
  PointMode,
  RadialGradient,
  Rect,
  Skia,
  StrokeCap,
  TileMode,
  createPicture,
  vec,
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
    createPicture((canvas) => drawBuckets(canvas, band.buckets as readonly Bucket[]), Skia.XYWHRect(0, 0, WORLD_STARS.tile, WORLD_STARS.tile)),
  );
  const cloudPass = (stops: readonly (readonly number[])[]) =>
    createPicture((canvas) => {
      const T = WORLD_NEBULA.tile;
      for (const cloud of WORLD_NEBULA.clouds) {
        // A cloud near a tile edge is drawn again across it, so the tile is seamless.
        for (const ox of [-T, 0, T]) {
          for (const oy of [-T, 0, T]) {
            const x = cloud.x + ox;
            const y = cloud.y + oy;
            if (x + cloud.r < 0 || y + cloud.r < 0 || x - cloud.r > T || y - cloud.r > T) continue;
            const paint = Skia.Paint();
            paint.setAntiAlias(true);
            paint.setShader(
              Skia.Shader.MakeRadialGradient(
                vec(x, y),
                cloud.r,
                stops.map(([, s, l, a]) => Skia.Color(hsla(cloud.hue, s, l, a * cloud.a))),
                stops.map(([offset]) => offset),
                TileMode.Clamp,
              ),
            );
            canvas.drawCircle(x, y, cloud.r, paint);
          }
        }
      }
    }, Skia.XYWHRect(0, 0, WORLD_NEBULA.tile, WORLD_NEBULA.tile));
  pictures = {
    dust,
    stars,
    nebulaBase: cloudPass(WORLD_NEBULA.base),
    nebulaFar: cloudPass(WORLD_NEBULA.far),
    nebulaMap: cloudPass(WORLD_NEBULA.map),
  };
  return pictures;
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

/** The ground and the floor: screen space, never moved by the camera. */
export function WorldGround({ envelope, response }: { readonly envelope: ViewportEnvelope; readonly response: WorldResponse }) {
  const [a, b, c] = WORLD_VISUAL.material.ground;
  const d = WORLD_VISUAL.groundDirection;
  return (
    <>
      <Rect x={0} y={0} width={envelope.width} height={envelope.height}>
        <LinearGradient start={vec(0, 0)} end={vec(envelope.width * d.x, envelope.height * d.y)} colors={[a, b, c]} positions={[0, 0.5, 1]} />
      </Rect>
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
