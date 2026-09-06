/**
 * T-04 — exact integer arithmetic shared by the world and camera layers.
 *
 * Every canonical quantity in the Map substrate is a `bigint` or a ratio of two `bigint`s, so
 * that a camera move, a scale change or a footprint never depends on binary floating point.
 * Nothing here rounds toward a preferred direction: `roundDiv` is round-half-away-from-zero, so
 * a pan of `+n` points and a pan of `-n` points are exact mirrors of each other.
 */

export function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = absBigInt(a);
  let y = absBigInt(b);
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/** Exact `numerator / denominator` rounded half away from zero. `denominator` must be non-zero. */
export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('roundDiv: denominator must be non-zero');
  const sign = (numerator < 0n) !== (denominator < 0n) ? -1n : 1n;
  const n = absBigInt(numerator);
  const d = absBigInt(denominator);
  return sign * ((2n * n + d) / (2n * d));
}

/** Clamps an exact value into `[low, high]`. */
export function clampBigInt(value: bigint, low: bigint, high: bigint): bigint {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

/**
 * Converts an exact ratio to the nearest finite `number`, or `null` when the magnitude exceeds
 * `limit` integral units. A `null` means "outside the finitely representable presentation
 * range"; it is never silently replaced by a clamped pixel.
 */
export function ratioToFinite(numerator: bigint, denominator: bigint, limit: bigint): number | null {
  if (denominator === 0n) return null;
  const whole = numerator / denominator;
  if (absBigInt(whole) > limit) return null;
  const remainder = numerator % denominator;
  return Number(whole) + Number(remainder) / Number(denominator);
}
