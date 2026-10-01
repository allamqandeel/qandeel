/**
 * VPORT-01 — the world's response to distance, on the UI runtime, from the T-10 residual.
 *
 * The presentation camera already carries the one residual the plane is drawn with. This hook READS it
 * through the motion owner's reading seam — it adds no animation, no timer, no easing and no second
 * clock — and turns the presented approach into the handful of material weights the canonical schedule
 * assigns to it. During a semantic travel the world therefore resolves continuously from the old
 * distance's material to the new one, on the same frames and the same curve as the plane itself; at rest
 * every value is the canonical one; under reduced motion the residual cuts, so the material cuts with it
 * inside the plane's own resolve.
 *
 * Every value is a WEIGHT shared by a whole stratum or a whole tier. None is per object.
 */
import { usePresentationReading, useReadingOf, type DerivedValue, type PresentationCameraBinding } from '../../motion';
import { WORLD_VISUAL, worldSchedule, worldStars, type WorldSchedule } from './world-visual.generated';
import { presentedApproach } from './world-resolver';

export interface WorldResponse {
  /** The approach the glass is showing. */
  readonly approach: DerivedValue<number>;
  readonly floor: DerivedValue<number>;
  readonly vignette: DerivedValue<number>;
  readonly nebulaBase: DerivedValue<number>;
  readonly nebulaFar: DerivedValue<number>;
  readonly nebulaMap: DerivedValue<number>;
  readonly dust: DerivedValue<number>;
  /** One weight per star admission band (the canonical rank cut opening with approach). */
  readonly starBands: readonly DerivedValue<number>[];
  readonly groundMajor: DerivedValue<number>;
  readonly haloMajor: DerivedValue<number>;
  readonly haloMinor: DerivedValue<number>;
  readonly haloWideMajor: DerivedValue<number>;
  readonly haloWideMinor: DerivedValue<number>;
  readonly near: DerivedValue<number>;
  readonly relationGround: DerivedValue<number>;
  readonly relationBody: DerivedValue<number>;
}

const M = WORLD_VISUAL.material;
const FLOOR = WORLD_VISUAL.floor.alpha;
const RELIEF = WORLD_VISUAL.vignette.mapRelief;
const NEAR_GAIN = WORLD_VISUAL.mark.haloNearGain;
const WIDE_SHARE = WORLD_VISUAL.mark.haloWideShare;

/** A star band is admitted as the canonical rank cut passes through it. */
function starBand(A: number, S: WorldSchedule, lo: number, hi: number): number {
  'worklet';
  const stars = worldStars(A, S);
  const admitted = lo < 0 ? 1 : Math.max(0, Math.min(1, (stars.cut - lo) / (hi - lo)));
  return Math.min(1, admitted * stars.a);
}

export function useWorldResponse(motion: PresentationCameraBinding, canonicalApproach: number): WorldResponse {
  const approach = usePresentationReading(motion, (plane) => {
    'worklet';
    return presentedApproach(canonicalApproach, plane[2].scale);
  });
  const S = useReadingOf(approach, (A) => {
    'worklet';
    return { A, S: worldSchedule(A) };
  });

  const floor = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return FLOOR * s.mapA;
  });
  const vignette = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return 1 - s.map * RELIEF;
  });
  const nebulaBase = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return M.neb.a * s.cosmos;
  });
  const nebulaFar = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return Math.min(1, M.neb.a * s.cosmos * s.far * 2.75);
  });
  const nebulaMap = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return Math.min(1, M.neb.a * s.cosmos * s.mapA * 2.8);
  });
  const dust = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return Math.min(1, 0.95 * s.mapA);
  });
  // The three admission bands of the canonical cut (rank ≤ 0.24, ≤ 0.32, ≤ 0.40).
  const star0 = useReadingOf(S, ({ A, S: s }) => {
    'worklet';
    return starBand(A, s, -1, 0.24);
  });
  const star1 = useReadingOf(S, ({ A, S: s }) => {
    'worklet';
    return starBand(A, s, 0.24, 0.32);
  });
  const star2 = useReadingOf(S, ({ A, S: s }) => {
    'worklet';
    return starBand(A, s, 0.32, 0.4);
  });

  // §14: the cleared ground (major tier only), the medium's light around a body, and its NEAR atmosphere.
  const groundMajor = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return M.objGnd.a * s.objGnd * (1 - 0.5 * s.lod);
  });
  const haloMajor = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return Math.min(1, M.haloObj * s.objMaj * (1 + NEAR_GAIN * s.lod));
  });
  const haloMinor = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return Math.min(1, M.haloObjMinor * s.objMin * (1 + NEAR_GAIN * s.lod));
  });
  const haloWideMajor = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return Math.min(1, M.haloObj * s.objMaj * (1 + NEAR_GAIN * s.lod)) * WIDE_SHARE * s.lod;
  });
  const haloWideMinor = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return Math.min(1, M.haloObjMinor * s.objMin * (1 + NEAR_GAIN * s.lod)) * WIDE_SHARE * s.lod;
  });
  const near = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return s.lod;
  });
  // §13: the relation's local ground and its NEAR body.
  const relationGround = useReadingOf(S, ({ S: s }) => {
    'worklet';
    return s.relGnd;
  });

  return {
    approach,
    floor,
    vignette,
    nebulaBase,
    nebulaFar,
    nebulaMap,
    dust,
    starBands: [star0, star1, star2],
    groundMajor,
    haloMajor,
    haloMinor,
    haloWideMajor,
    haloWideMinor,
    near,
    relationGround,
    relationBody: near,
  };
}
