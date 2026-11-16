/**
 * COSMOS-INT-01 Slice D (Contract v1.5 §19.3 / §19.7) — the Detail Sheet's geometry and its snap decision, as pure
 * functions: no React, no Reanimated, no gesture. The component only measures, asks and animates. The functions a
 * released drag needs are worklets, so the UI runtime decides with the very rule the tests read.
 *
 * Geometry. The sheet is one view as tall as the room beneath the host's top band (D-11), moved by `translateY` alone:
 *   EXPANDED → 0 (its top under the band), PEEK → room − peek, CLOSED → room (off-screen).
 * The PEEK is a compact preview of the content's TOP, at most the accepted card height (156 pt) plus the bottom inset;
 * when the content does not fit, EXPANDED is the way to the rest of it (the long-list amendment, §19.5).
 *
 * The snap (SD-8 and the PO's gesture amendment): DISTANCE leads; velocity only assists a drag that is already
 * deliberate; a brief accidental flick never changes the phase.
 */

export type SheetPhase = 'CLOSED' | 'PEEK' | 'EXPANDED';

/** The accepted COSMOS card's height (the proof's `CARD_PEEK`, including its rule): the most a PEEK shows above the inset. */
export const SHEET_PEEK_MAX = 156;
/** The handle's row: the grabber and its press target. */
export const SHEET_HANDLE_HEIGHT = 28;
/** A travel under this many points never changes the phase, whatever its velocity (no accidental flick). */
export const SHEET_DELIBERATE_MIN = 24;
/** The share of the gap a drag must travel to reach the adjacent phase; PEEK → CLOSED asks for more. */
export const SHEET_ADJACENT_SHARE = 0.4;
export const SHEET_CLOSE_SHARE = 0.5;
/** Velocity assistance: only at or above this speed (pt/s), credited for this long, and never more than this share of the gap. */
export const SHEET_ASSIST_VELOCITY = 600;
export const SHEET_ASSIST_SECONDS = 0.1;
export const SHEET_ASSIST_MAX_SHARE = 0.25;

export interface SheetGeometry {
  /** The sheet's full height: the room beneath the top band, down to the bottom of the glass. */
  readonly room: number;
  /** The PEEK's visible height (handle + the content's top, capped), never more than the room. */
  readonly peek: number;
  /** Whether EXPANDED shows anything the PEEK does not (the content overflows the PEEK). */
  readonly overflows: boolean;
}

/**
 * The geometry for a measured content height. `bottomInset` is the safe area (and the call box) under the sheet: the
 * content's own padding already holds it, so a content that fits is shown whole, inset included.
 */
export function sheetGeometry(room: number, contentHeight: number, bottomInset: number): SheetGeometry {
  const safeRoom = Math.max(0, room);
  const whole = SHEET_HANDLE_HEIGHT + Math.max(0, contentHeight);
  const cap = Math.min(safeRoom, SHEET_PEEK_MAX + Math.max(0, bottomInset));
  const peek = Math.min(whole, cap);
  return { room: safeRoom, peek, overflows: whole > peek + 0.5 };
}

/** Where a phase puts the sheet's top, as `translateY` from the EXPANDED position. */
export function sheetOffset(phase: SheetPhase, geometry: SheetGeometry): number {
  'worklet';
  if (phase === 'EXPANDED') return 0;
  if (phase === 'PEEK') return geometry.room - geometry.peek;
  return geometry.room;
}

/** The phases a world allows at this geometry, from the top of the screen down (EXPANDED only when it adds content). */
export function sheetStops(geometry: SheetGeometry, allowExpanded: boolean): readonly SheetPhase[] {
  'worklet';
  return allowExpanded && geometry.overflows ? ['EXPANDED', 'PEEK', 'CLOSED'] : ['PEEK', 'CLOSED'];
}

export interface SnapInput {
  /** The phase the drag started in. */
  readonly from: SheetPhase;
  /** The finger's travel in points (positive = down). */
  readonly travel: number;
  /** The release velocity in points per second (positive = down). */
  readonly velocity: number;
  readonly geometry: SheetGeometry;
  readonly stops: readonly SheetPhase[];
}

/**
 * The phase a released drag settles in.
 *   1. A travel under SHEET_DELIBERATE_MIN keeps the starting phase, whatever the velocity.
 *   2. Distance leads: the adjacent phase needs SHEET_ADJACENT_SHARE of the gap (SHEET_CLOSE_SHARE into CLOSED); a drag
 *      that passes it continues from there with the travel left (so one long deliberate drag may go EXPANDED → CLOSED).
 *   3. Velocity assists a deliberate drag only: in the drag's direction, at or above SHEET_ASSIST_VELOCITY, it credits
 *      min(v × SHEET_ASSIST_SECONDS, SHEET_ASSIST_MAX_SHARE × gap) to the FIRST gap; against the drag, it keeps the start.
 */
export function snapPhase({ from, travel, velocity, geometry, stops }: SnapInput): SheetPhase {
  'worklet';
  const start = stops.indexOf(from);
  // A phase the geometry no longer allows (EXPANDED after the content shrank) settles at the highest phase that remains.
  if (start < 0) return stops[0] ?? 'CLOSED';
  if (!Number.isFinite(travel) || Math.abs(travel) < SHEET_DELIBERATE_MIN) return from;
  const down = travel > 0;
  const v = Number.isFinite(velocity) ? velocity : 0;
  if ((down ? -v : v) >= SHEET_ASSIST_VELOCITY) return from;
  const step = down ? 1 : -1;
  let at = start;
  let left = Math.abs(travel);
  let first = true;
  for (;;) {
    const next = at + step;
    if (next < 0 || next >= stops.length) return stops[at]!;
    const gap = Math.abs(sheetOffset(stops[next]!, geometry) - sheetOffset(stops[at]!, geometry));
    if (gap <= 0) { at = next; continue; }
    const assist = first && Math.abs(v) >= SHEET_ASSIST_VELOCITY ? Math.min(Math.abs(v) * SHEET_ASSIST_SECONDS, SHEET_ASSIST_MAX_SHARE * gap) : 0;
    const share = stops[next] === 'CLOSED' ? SHEET_CLOSE_SHARE : SHEET_ADJACENT_SHARE;
    if (left + assist < share * gap) return stops[at]!;
    if (left < gap) return stops[next]!;
    left -= gap;
    at = next;
    first = false;
  }
}

/** Clamp a dragged offset to the allowed stops (the sheet never leaves the room or rises above its highest stop). */
export function clampOffset(offset: number, geometry: SheetGeometry, stops: readonly SheetPhase[]): number {
  'worklet';
  const top = sheetOffset(stops[0] ?? 'CLOSED', geometry);
  return Math.min(geometry.room, Math.max(top, offset));
}

/** How far the keyboard covers the sheet's visible bottom (0 when the window already resized above it). */
export function keyboardOverlap(sheetBottom: number, keyboardTop: number | null): number {
  if (keyboardTop === null || !Number.isFinite(keyboardTop) || !Number.isFinite(sheetBottom)) return 0;
  return Math.max(0, Math.round(sheetBottom - keyboardTop));
}

/**
 * Resistance past an edge (the expo-animation skill's rubber band): the further the finger goes beyond the highest stop,
 * the less the sheet follows, so a boundary gives instead of stopping dead. `overshoot` ≥ 0 in points.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  if (!(overshoot > 0) || !(dimension > 0)) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * overshoot);
}

/** Where a dragged sheet is drawn: free between its stops, resisting above the highest, never below the room. */
export function dragOffset(raw: number, geometry: SheetGeometry, stops: readonly SheetPhase[]): number {
  'worklet';
  const top = sheetOffset(stops[0] ?? 'CLOSED', geometry);
  if (raw < top) return top - rubberband(top - raw, geometry.room);
  return Math.min(geometry.room, raw);
}
