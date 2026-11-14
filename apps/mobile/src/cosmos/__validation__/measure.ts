// COSMOS proof (experimental, isolated) — the proof's measurement helpers that need no React. VALIDATION ONLY.
//
// Deep links let `adb` drive the proof (scheme `qandeel-cosmos-proof://`, registered in the GENERATED manifest of the
// proof build only, never in `app.json`):
//
//   qandeel-cosmos-proof://world/personal | shared | public     switch world (a fresh entry)
//   qandeel-cosmos-proof://mode/full | no-bodies | plates        the measurement-only overdraw mode
//   qandeel-cosmos-proof://step/in | out                         ONE semantic step by the accessible route (the same
//                                                                act as the screen reader's zoom-in / zoom-out)
//   qandeel-cosmos-proof://cycle/20                              mount / unmount the world canvas N times (1–200)
//   qandeel-cosmos-proof://drift/on | off                        the atmosphere's drift at rest
//   qandeel-cosmos-proof://surface/texture | surface             TextureView (default) or SurfaceView
//   qandeel-cosmos-proof://lang/ar | en

import type { WorldKind } from '../core/stage';
import type { OverdrawMode } from '../skia/CosmosCanvas';
import type { CosmosLanguage } from './copy';

export const PROOF_SCHEME = 'qandeel-cosmos-proof';

export type ProofLink =
  | { readonly kind: 'world'; readonly world: WorldKind }
  | { readonly kind: 'mode'; readonly mode: OverdrawMode }
  | { readonly kind: 'step'; readonly direction: 'IN' | 'OUT' }
  | { readonly kind: 'cycle'; readonly count: number }
  | { readonly kind: 'drift'; readonly on: boolean }
  | { readonly kind: 'surface'; readonly opaque: boolean }
  | { readonly kind: 'lang'; readonly language: CosmosLanguage };

const WORLD_OF: Readonly<Record<string, WorldKind>> = { personal: 'PERSONAL', shared: 'SHARED', public: 'PUBLIC' };
const MODE_OF: Readonly<Record<string, OverdrawMode>> = { full: 'FULL', 'no-bodies': 'NO_BODIES', plates: 'PLATES_ONLY' };

/** A proof link, or null for anything else (another scheme, an unknown verb, a malformed value). */
export function parseProofLink(url: string): ProofLink | null {
  const match = /^qandeel-cosmos-proof:\/\/([a-z]+)\/([a-z0-9-]+)\/?$/u.exec(url.trim());
  if (match === null) return null;
  const [, verb, value] = match;
  if (verb === 'world') return Object.prototype.hasOwnProperty.call(WORLD_OF, value) ? { kind: 'world', world: WORLD_OF[value] } : null;
  if (verb === 'mode') return Object.prototype.hasOwnProperty.call(MODE_OF, value) ? { kind: 'mode', mode: MODE_OF[value] } : null;
  if (verb === 'step') return value === 'in' || value === 'out' ? { kind: 'step', direction: value === 'in' ? 'IN' : 'OUT' } : null;
  if (verb === 'cycle') { const count = Number(value); return /^\d{1,3}$/u.test(value) && count >= 1 && count <= 200 ? { kind: 'cycle', count } : null; }
  if (verb === 'drift') return value === 'on' || value === 'off' ? { kind: 'drift', on: value === 'on' } : null;
  if (verb === 'surface') return value === 'texture' || value === 'surface' ? { kind: 'surface', opaque: value === 'surface' } : null;
  if (verb === 'lang') return value === 'ar' || value === 'en' ? { kind: 'lang', language: value } : null;
  return null;
}

export interface JsHeapReading {
  /** Bytes of JS heap in use, or null where the runtime offers no reading. */
  readonly usedBytes: number | null;
  readonly source: 'performance.memory' | 'HermesInternal.getInstrumentedStats' | 'none';
  /** True when a collection could be requested first (`gc()` is exposed on this runtime). */
  readonly collected: boolean;
}

/**
 * The JS heap in use, from whatever this runtime offers: React Native's `performance.memory` (Hermes' allocated bytes)
 * or Hermes' instrumented stats. It says NOTHING about native or graphics memory, where Skia's images, paths and
 * textures live: read those with `adb shell dumpsys meminfo <package>`.
 */
export function readJsHeap(collect: boolean): JsHeapReading {
  const g = globalThis as {
    gc?: () => void;
    performance?: { memory?: { usedJSHeapSize?: number | null } };
    HermesInternal?: { getInstrumentedStats?: () => Record<string, unknown> };
  };
  let collected = false;
  if (collect && typeof g.gc === 'function') { try { g.gc(); g.gc(); collected = true; } catch { collected = false; } }
  try {
    const used = g.performance?.memory?.usedJSHeapSize;
    if (typeof used === 'number' && Number.isFinite(used) && used > 0) return { usedBytes: used, source: 'performance.memory', collected };
  } catch { /* fall through */ }
  try {
    const stats = g.HermesInternal?.getInstrumentedStats?.();
    const used = stats?.js_allocatedBytes ?? stats?.js_heapSize;
    if (typeof used === 'number' && Number.isFinite(used) && used > 0) return { usedBytes: used, source: 'HermesInternal.getInstrumentedStats', collected };
  } catch { /* fall through */ }
  return { usedBytes: null, source: 'none', collected };
}
