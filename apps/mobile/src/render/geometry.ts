import { useCallback, useEffect, useRef, useState } from 'react';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

const EPSILON = 0.5;

export function rectsEqual(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.width - b.width) < EPSILON &&
    Math.abs(a.height - b.height) < EPSILON
  );
}

export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    left = Math.min(left, r.x);
    top = Math.min(top, r.y);
    right = Math.max(right, r.x + r.width);
    bottom = Math.max(bottom, r.y + r.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * A transcript span is measured as one rect per word, so a span that wraps produces
 * rects on several lines. Drawing to the bounding box of all of them would put the
 * endpoint in the middle of unrelated text, so tokens are folded back into per-line
 * rects and the caller picks the line it actually wants to touch.
 */
export function lineRects(rects: readonly Rect[]): Rect[] {
  if (rects.length === 0) return [];
  const bands = new Map<number, Rect[]>();
  for (const r of rects) {
    const band = Math.round((r.y + r.height / 2) / 6);
    const bucket = bands.get(band);
    if (bucket) bucket.push(r);
    else bands.set(band, [r]);
  }
  return [...bands.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => unionRect(group))
    .filter((r): r is Rect => r !== null);
}

export function nearestLine(lines: readonly Rect[], targetY: number): Rect | null {
  let best: Rect | null = null;
  let bestDistance = Infinity;
  for (const line of lines) {
    const distance = Math.abs(line.y + line.height / 2 - targetY);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = line;
    }
  }
  return best;
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** The edge where reading begins: right in RTL, left in LTR. */
export function readingStartEdge(rect: Rect, isRTL: boolean): Point {
  return { x: isRTL ? rect.x + rect.width : rect.x, y: rect.y + rect.height / 2 };
}

/**
 * The same edge, but at the foot of the line rather than its middle.
 *
 * Threads attach here so their horizontal runs sit under the words instead of through
 * them: a stroke across the transcript reads as a strikethrough, and the user's own text
 * is the one thing on screen the analysis is never allowed to deface.
 */
export function readingStartFoot(rect: Rect, isRTL: boolean): Point {
  return { x: isRTL ? rect.x + rect.width : rect.x, y: rect.y + rect.height - 3 };
}

export type RectMap = Readonly<Record<string, Rect>>;

/**
 * Collects layout rects reported by many children into one map. Reports are batched to
 * the end of the tick so a transcript of ~30 word views settles in a single re-render
 * rather than thirty.
 */
export function useRectRegistry(): {
  rects: RectMap;
  report: (id: string, rect: Rect) => void;
} {
  const [rects, setRects] = useState<RectMap>({});
  const pending = useRef<Record<string, Rect>>({});
  const scheduled = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (scheduled.current !== null) clearTimeout(scheduled.current);
    };
  }, []);

  const flush = useCallback(() => {
    scheduled.current = null;
    if (!alive.current) return;
    const batch = pending.current;
    pending.current = {};
    setRects((prev) => {
      let changed = false;
      const next: Record<string, Rect> = { ...prev };
      for (const [id, rect] of Object.entries(batch)) {
        const current = next[id];
        if (!current || !rectsEqual(current, rect)) {
          next[id] = rect;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const report = useCallback(
    (id: string, rect: Rect) => {
      pending.current[id] = rect;
      if (scheduled.current === null) {
        scheduled.current = setTimeout(flush, 0);
      }
    },
    [flush]
  );

  return { rects, report };
}
