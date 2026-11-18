/**
 * COSMOS-INT-01 Slice E, D-1 — DIAGNOSTIC ONLY (branch cosmos/slice-e-d1-diag; never merged).
 *
 * A counter board for one question: where does a touch on the Personal COSMOS stage stop on iOS? Each layer of the path
 * (UIKit hit test as React Native's touch handler sees it, the RNGH gestures, CosmosCanvas, CosmosWorldView, the Personal
 * owner) records what it saw here, and the proof entry publishes the board as ONE accessibility label that the harness
 * reads from the simulator. It holds counts and enums only: no content, no transcript, no identifiers of the reader.
 */
const board = new Map<string, string | number>();
const listeners = new Set<() => void>();
let version = 0;

/** Count `key` once, or record `value` under it. */
export function diag(key: string, value?: string | number): void {
  if (value === undefined) {
    const before = board.get(key);
    board.set(key, typeof before === 'number' ? before + 1 : 1);
  } else board.set(key, value);
  version += 1;
  for (const listener of listeners) listener();
}

export function diagText(): string {
  return [...board.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(' ');
}

export function diagVersion(): number {
  return version;
}

export function diagSubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
