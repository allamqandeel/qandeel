/**
 * COSMOS-INT-01 Slice E, D-3 CP1 — DIAGNOSTIC ONLY (branch cosmos/slice-e-d3-diag; never merged).
 *
 * A board for two questions, published by the proof entry as ONE accessibility label that the native harness reads:
 *   - SE-FU-1: where is a cold-launch tap on the Analysis door lost (native touch, press, handler, depth, stage ready)?
 *   - SE-FU-2: which view does a touch on each non-interactive overlay of a COSMOS stage reach, and does the stage's
 *     gesture handler see it?
 * plus layout facts for the enlarged-text measurements. It holds counts, times, enums and frames only: no content, no
 * transcript, no identifiers of the reader. Times are the device clock in epoch milliseconds (the simulator shares the
 * host clock with the test runner, so the harness can compare them with its own).
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { LayoutChangeEvent, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';

const board = new Map<string, string | number>();
const listeners = new Set<() => void>();
let version = 0;
const seq: string[] = [];

function changed(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/** Count `key` once, or record `value` under it. */
export function diag(key: string, value?: string | number): void {
  if (value === undefined) {
    const before = board.get(key);
    board.set(key, typeof before === 'number' ? before + 1 : 1);
  } else board.set(key, value);
  changed();
}

/** The FIRST time `key` happened (epoch ms) as `t.<key>`, and how often as `n.<key>`. */
export function diagAt(key: string): void {
  if (!board.has(`t.${key}`)) board.set(`t.${key}`, Date.now());
  const n = board.get(`n.${key}`);
  board.set(`n.${key}`, typeof n === 'number' ? n + 1 : 1);
  changed();
}

/** One timestamped event in the ordered timeline (bounded). */
export function diagSeq(event: string): void {
  if (seq.length < 1500) seq.push(`${Date.now()}:${event}`);
  changed();
}

/** Clears the board between measured actions (the harness asks for it through a proof link). */
export function diagReset(): void {
  board.clear();
  seq.length = 0;
  changed();
}

export function diagText(): string {
  const entries = [...board.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(' ');
  return `${entries} SEQ ${seq.join('|')}`;
}

export function diagVersion(): number {
  return version;
}

export function diagSubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `onLayout` handler that records the view's window frame (x,y,w,h, points) under `lay.<name>`. */
export function diagFrame(name: string) {
  return (event: LayoutChangeEvent) => {
    const target = event.currentTarget as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | undefined;
    target?.measureInWindow?.((x, y, w, h) => diag(`lay.${name}`, `${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)}`));
  };
}

/** `onTextLayout` handler: line count and whether the drawn lines hold the whole string, under `txt.<name>`. */
export function diagTextLayout(name: string, full: string) {
  return (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lines = event.nativeEvent.lines;
    const drawn = lines.map((l) => l.text).join('').replace(/\s+/g, '');
    const whole = full.replace(/\s+/g, '');
    diag(`txt.${name}`, `lines${lines.length}/${drawn.length >= whole.length ? 'whole' : `cut${drawn.length}of${whole.length}`}/w${Math.round(Math.max(0, ...lines.map((l) => l.width)))}`);
  };
}

// ── COSMOS-FINAL-01 SE-FU-1-LT — DIAGNOSTIC ONLY (branch cosmos/validate/final-sefu1-lt; never merged) ─────────────
// Where does the ~2.9 s first-launch JS long task (between the conversation's typeface and the door's first layout) go?

/** A timeline mark that does not notify (safe inside a render). */
export function diagMark(event: string): void {
  if (seq.length < 1500) seq.push(`${Date.now()}:${event}`);
}

/**
 * A JS-thread heartbeat: a 16 ms timer chain; every time the JS thread could not run it for more than 100 ms, the gap is
 * recorded as `gap<ms>@<start>` (the start is the last tick before the gap). Runs for the first `forMs` after start.
 */
export function startHeartbeat(forMs = 45000): void {
  const t0 = Date.now();
  let last = t0;
  const tick = () => {
    const now = Date.now();
    if (now - last > 100) diagSeq(`gap${now - last}@${last}`);
    last = now;
    if (now - t0 < forMs) setTimeout(tick, 16);
  };
  setTimeout(tick, 16);
}

/** Render (r), commit (c, a layout effect) and passive-effect (e) marks of one component, its first 40 renders. */
export function useDiagPhase(name: string): void {
  const n = useRef(0);
  n.current += 1;
  const k = n.current;
  if (k <= 40) diagMark(`r.${name}#${k}`);
  useLayoutEffect(() => { if (k <= 40) diagMark(`c.${name}#${k}`); });
  useEffect(() => { if (k <= 40) diagMark(`e.${name}#${k}`); });
}
