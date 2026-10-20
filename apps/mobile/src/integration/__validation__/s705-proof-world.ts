/**
 * S7-05 — the real-device proof world. VALIDATION ONLY, FIXTURE ONLY.
 *
 * The S7-05 device proof (Product Owner decision D3) runs the PRODUCTION phase surface over the S7-04 proof world
 * (`s704-proof-world.ts`): the same in-memory identity, the same fixture conversation and the same REAL-PATH captured
 * Replay wire. It adds nothing to the Replay's truth. It only chooses, per launch, how the network behaves, so that the
 * device can show the failure, Retry and revocation states the Product already has:
 *
 *   - `journey`  — the S7-04 world exactly (entry, selection, Draft → Preview → Finalize → Reopen, the Spine, the
 *                  real-path refusals: the open head, SOURCE_CHANGED and ANALYSIS_CHANGED);
 *   - `faults`   — the FIRST save, the FIRST preview, finalize and reopen command, and the FIRST moment-analysis read
 *                  are each dropped by the network (as the S7-04 proofs drop them), so the unconfirmed sentence, Try
 *                  again / Retry and the failed-analysis sentence appear; the retry is then answered from the captured
 *                  wire, with the same command id (the captured journey's own retries answer exactly so);
 *   - `revoked`  — the original messages of the captured source Replay (its part 1 … 3) are withdrawn, as the captured
 *                  journey withdrew them: its version reads answer the captured `sourceWithdrawn` scene (NOT_VIEWABLE,
 *                  both layers reported, no text and no analysis).
 *
 * Every answer is either the captured one or a dropped connection; no Replay state is invented. Nothing here is
 * reachable from the Product route: this directory is outside the production import closure, and the proof build
 * selects it through one recorded change of the manifest's `main`.
 */
import { PLAYER_IDS, PLAYER_WIRE } from '../../replay-player/__fixtures__/player-wire';
import type { RuntimeHttpFetch } from '../../runtime-entry';
import { S704_PROOF_CONFIG, createS704ProofWorld, type S704ProofWorld } from './s704-proof-world';

export type S705ProofScenario = 'journey' | 'faults' | 'revoked';
export const S705_PROOF_SCENARIOS: readonly S705ProofScenario[] = ['journey', 'faults', 'revoked'];

const LINK = /^qandeel:\/\/s705-proof\/(journey|faults|revoked)\/?$/u;

/** The scenario a launch link names; anything else is the plain journey. */
export function s705ProofScenario(url: string | null): S705ProofScenario {
  const match = url === null ? null : LINK.exec(url);
  return match === null ? 'journey' : (match[1] as S705ProofScenario);
}

/** The requests `faults` drops once each: the save, the three lifecycle commands, one moment's analysis. */
const FAULTS: readonly { readonly name: string; readonly matches: (method: string, path: string) => boolean }[] = [
  { name: 'save', matches: (method, path) => method === 'POST' && /^\/replay\/drafts$/u.test(path) },
  { name: 'preview', matches: (method, path) => method === 'POST' && /^\/replay\/[^/]+\/preview$/u.test(path) },
  { name: 'finalize', matches: (method, path) => method === 'POST' && /^\/replay\/[^/]+\/finalize$/u.test(path) },
  { name: 'reopen', matches: (method, path) => method === 'POST' && /^\/replay\/[^/]+\/reopen$/u.test(path) },
  { name: 'analysis', matches: (method, path) => method === 'GET' && /^\/replay\/[^/]+\/versions\/[^/]+\/moments\/\d+\/analysis\?depth=/u.test(path) },
];

const answer = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

export interface S705ProofWorld extends S704ProofWorld {
  readonly scenario: S705ProofScenario;
}

export function createS705ProofWorld(scenario: S705ProofScenario): S705ProofWorld {
  const base = createS704ProofWorld();
  const dropped = new Set<string>();
  const withdrawn = PLAYER_WIRE.scenes.sourceWithdrawn;
  // The captured source Replay's version route, by its segments (the proof world names no Replay route of its own).
  const sourceVersion = ['', 'replay', PLAYER_IDS.source, 'versions', PLAYER_IDS.sourceVersion].join('/');

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const path = input.startsWith(S704_PROOF_CONFIG.apiBaseUrl) ? input.slice(S704_PROOF_CONFIG.apiBaseUrl.length) : null;
    if (path !== null && scenario === 'faults') {
      const fault = FAULTS.find((candidate) => !dropped.has(candidate.name) && candidate.matches(method, path));
      if (fault !== undefined) {
        dropped.add(fault.name);
        throw new Error('the network dropped');
      }
    }
    if (path !== null && scenario === 'revoked' && method === 'GET') {
      if (path === sourceVersion) return answer(200, withdrawn.version);
      if (path === `${sourceVersion}/moments`) return answer(200, withdrawn.moments);
      const read = /\/moments\/(\d+)\/analysis\?depth=([A-Z_]+)$/u.exec(path);
      if (path.startsWith(`${sourceVersion}/moments/`) && read !== null) {
        const body = withdrawn.analysis[read[1]]?.[read[2]];
        return body === undefined ? answer(404, {}) : answer(200, body);
      }
    }
    return base.fetch(input, init);
  };

  return { ...base, fetch, scenario };
}
