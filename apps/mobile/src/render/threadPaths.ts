import { Skia, type SkPath } from '@shopify/react-native-skia';

import type { Point } from './geometry';
import type { ThreadStyle } from '../schema/types';

/**
 * Threads are routed out of the text into a gutter, along it, and back in — never
 * straight across the words, because the user's own text stays the anchor of the screen
 * (Task 01 §6 principle 4).
 *
 * `gutterX` is a measured x in surface coordinates, so a mirrored layout produces a
 * mirrored route without any of the code below knowing which language is on screen. The
 * only thing `isRTL` is used for here is the arrowhead's facing.
 *
 * Task 01 §4 requires the four styles to differ in SHAPE, not only colour:
 *   SUPPORT     two parallel rules running together
 *   CONTRADICT  a sawtooth along the gutter run
 *   EVOLVE      a single bowed line ending in an arrowhead
 *   CONNECT     a dotted line (`dash`), plainest of the four
 */
export interface ThreadGeometry {
  path: SkPath;
  /** Second rule for SUPPORT. */
  companion?: SkPath;
  /** Filled arrowhead for EVOLVE. */
  head?: SkPath;
  /** Dash intervals for CONNECT. */
  dash?: number[];
}

const CORNER = 10;

function sign(value: number): number {
  return value < 0 ? -1 : 1;
}

/** Rounded right-angle route: out to the gutter, along it, back in. */
function routePath(from: Point, to: Point, gutterX: number, inset: number): SkPath {
  const outX = gutterX + inset;
  const sx = sign(outX - from.x);
  const sy = sign(to.y - from.y);
  const corner = Math.min(CORNER, Math.abs(to.y - from.y) / 2, Math.abs(outX - from.x) / 2);
  const backX = sign(to.x - outX);

  return Skia.PathBuilder.Make()
    .moveTo(from.x, from.y)
    .lineTo(outX - sx * corner, from.y)
    .quadTo(outX, from.y, outX, from.y + sy * corner)
    .lineTo(outX, to.y - sy * corner)
    .quadTo(outX, to.y, outX + backX * corner, to.y)
    .lineTo(to.x, to.y)
    .detach();
}

/** Same route, but the long gutter run is a sawtooth instead of a straight rule. */
function sawtoothRoute(from: Point, to: Point, gutterX: number): SkPath {
  const sy = sign(to.y - from.y);
  const span = Math.abs(to.y - from.y);
  const amplitude = 4.5;
  const wavelength = 13;
  const teeth = Math.max(2, Math.floor(span / wavelength));

  const builder = Skia.PathBuilder.Make().moveTo(from.x, from.y).lineTo(gutterX, from.y);
  for (let i = 1; i <= teeth; i += 1) {
    const y = from.y + sy * (span * (i / teeth));
    const x = gutterX + (i % 2 === 0 ? -amplitude : amplitude);
    builder.lineTo(x, y);
  }
  return builder.lineTo(gutterX, to.y).lineTo(to.x, to.y).detach();
}

/** Same route, but the gutter run bows away from the text. */
function bowedRoute(from: Point, to: Point, gutterX: number, bow: number): SkPath {
  const midY = (from.y + to.y) / 2;
  return Skia.PathBuilder.Make()
    .moveTo(from.x, from.y)
    .lineTo(gutterX, from.y)
    .cubicTo(gutterX + bow, from.y + (midY - from.y) / 2, gutterX + bow, midY, gutterX, to.y)
    .lineTo(to.x, to.y)
    .detach();
}

function arrowHead(tip: Point, facing: number): SkPath {
  const length = 9;
  const half = 4.5;
  return Skia.PathBuilder.Make()
    .moveTo(tip.x, tip.y)
    .lineTo(tip.x + facing * length, tip.y - half)
    .lineTo(tip.x + facing * length, tip.y + half)
    .close()
    .detach();
}

/** A hairline right-angle leader, used to tie a surface back to the anchor it belongs to. */
export function leaderPath(from: Point, to: Point): SkPath {
  const midY = (from.y + to.y) / 2;
  return Skia.PathBuilder.Make()
    .moveTo(from.x, from.y)
    .lineTo(from.x, midY)
    .lineTo(to.x, midY)
    .lineTo(to.x, to.y)
    .detach();
}

export function buildThreadGeometry(
  style: ThreadStyle,
  from: Point,
  to: Point,
  gutterX: number,
  isRTL: boolean
): ThreadGeometry {
  switch (style) {
    case 'SUPPORT':
      return {
        path: routePath(from, to, gutterX, 0),
        companion: routePath(from, to, gutterX, isRTL ? 4 : -4),
      };

    case 'CONTRADICT':
      return { path: sawtoothRoute(from, to, gutterX) };

    case 'EVOLVE': {
      // The bow leans away from the text column, i.e. further into the gutter.
      const bow = isRTL ? 16 : -16;
      return {
        path: bowedRoute(from, to, gutterX, bow),
        head: arrowHead(to, isRTL ? 1 : -1),
      };
    }

    case 'CONNECT':
    default:
      return { path: routePath(from, to, gutterX, 0), dash: [2, 5] };
  }
}
