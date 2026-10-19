/**
 * S7-03 — the composite's proof input: the REAL-PATH Replay wire, served to the REAL client.
 *
 * `replay-wire.json` (beside this file, so it is a mobile build input) is what the real `ReplayService` answered over rows the 0169 wrappers
 * returned on a real PostgreSQL database (`database/replay-composite-proof-world.mjs` → `rows.json` →
 * `apps/api/src/replay/replay-history-proof.spec.ts`). This module serves it, byte for byte, as HTTP bodies to the
 * production `ReplayHistoryApiClient`, so every proof — Jest and the device build alike — passes through the real decoder,
 * the governed adapter and the real Living Analysis components. Nothing here draws, decides or repairs anything.
 *
 * ONE scene is not the real path and says so: `derivedGap`. The real Personal path selects one contiguous range of
 * whole messages, so `omittedBefore` is always 0 there (record §5, finding F-1). To show what a perceptible
 * discontinuity looks like on the real components, `derivedGap` is the main scene with ONE declared edit — two messages
 * omitted before ordinal 4 — and is labelled DERIVED SPECIMEN everywhere it appears.
 */
import { ReplayHistoryApiClient, type ReplayHistoryApiConfig } from '../../runtime-entry';

const WIRE = require('./replay-wire.json') as ReplayWireFixture;

export interface ReplayWireScene {
  readonly scene: string;
  readonly replayId: string;
  readonly versionId: string;
  readonly version: Record<string, unknown>;
  readonly moments: { readonly outcome: string; readonly moments: readonly Record<string, unknown>[] };
  readonly analysis: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}
interface ReplayWireFixture {
  readonly provenance: Readonly<Record<string, string>>;
  readonly scenes: Readonly<Record<'main' | 'part' | 'notViewable' | 'analysisMoved', ReplayWireScene>>;
  readonly preview: { readonly openHead: { readonly outcome: string }; readonly legacy: { readonly outcome: string } };
}

export type ReplayProofSceneName = keyof ReplayWireFixture['scenes'] | 'derivedGap';

export const REPLAY_WIRE: ReplayWireFixture = WIRE;
export const DERIVED_GAP = Object.freeze({ beforeOrdinal: 4, omitted: 2 });

/** The derived gap specimen: the main scene, with exactly the one declared edit. */
function derivedGapScene(): ReplayWireScene {
  const main = WIRE.scenes.main;
  return {
    ...main,
    scene: 'derivedGap (DERIVED SPECIMEN — not the real path)',
    version: { ...main.version, temporalDiscontinuityCount: 1 },
    moments: {
      ...main.moments,
      moments: main.moments.moments.map((moment) => (moment.ordinal === DERIVED_GAP.beforeOrdinal ? { ...moment, omittedBefore: DERIVED_GAP.omitted } : moment)),
    },
  };
}

export function replayScene(name: ReplayProofSceneName): ReplayWireScene {
  return name === 'derivedGap' ? derivedGapScene() : WIRE.scenes[name];
}

const BASE = 'https://replay-proof.invalid';
const ROUTE = /^\/replay\/([^/]+)\/versions\/([^/?]+)(\/moments(?:\/(\d+)\/analysis\?depth=([A-Z_]+))?)?$/u;

/** The scene's wire as HTTP: only the three reads of THIS version answer; everything else is a 404. */
export function replayWireFetch(scene: ReplayWireScene, options: { readonly failAnalysis?: (ordinal: number, depth: string) => boolean } = {}): ReplayHistoryApiConfig['fetch'] {
  const answer = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  return (async (url: string, init?: { method?: string }) => {
    if (init?.method !== 'GET' || !url.startsWith(BASE)) return answer(405, {});
    const route = ROUTE.exec(url.slice(BASE.length));
    if (route === null || route[1] !== scene.replayId || route[2] !== scene.versionId) return answer(404, {});
    if (route[3] === undefined) return answer(200, scene.version);
    if (route[4] === undefined) return answer(200, scene.moments);
    if (options.failAnalysis?.(Number(route[4]), route[5]) === true) return answer(503, {});
    const body = scene.analysis[route[4]]?.[route[5]];
    return body === undefined ? answer(404, {}) : answer(200, body);
  }) as unknown as ReplayHistoryApiConfig['fetch'];
}

export function replayWireClient(scene: ReplayWireScene, options?: Parameters<typeof replayWireFetch>[1]): ReplayHistoryApiClient {
  return new ReplayHistoryApiClient({ baseUrl: BASE, fetch: replayWireFetch(scene, options) });
}
