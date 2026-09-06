export function finite(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Presentation input must be finite');
  return value;
}
export function clamp(value: number, maximum = 1): number {
  return Math.max(0, Math.min(maximum, finite(value)));
}
/** P describes scrollable disclosed presentation extent, never session time. If all
 * disclosed items fit, the sole meaningful window position is zero. */
export function position(offset: number, maximum: number): number {
  return maximum > 0 ? clamp(offset / maximum) : 0;
}
export const INITIAL_FRACTION = 1 / 8;
export const MIN_FRACTION = 1 / 1024;
