// COSMOS proof (experimental, isolated) — the fixture network under the PRODUCTION clients. VALIDATION ONLY.
//
// Every byte served here is SYNTHETIC: the repository's own labelled fixtures (`s503b-visual-field`,
// `shared-vis-proof-field`, the VPORT-01 proof world).
// Nothing is real analysis and nothing is a real person. The UI says so, persistently.
//
// The bodies are wire-shaped and are decoded by the production clients (`PublicFieldApiClient`, `SharedWorldApiClient`,
// the historical-projection client inside the integration runtime), so the decoding the proof exercises is the real one.

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import type { ChromeLanguage } from '../../orientation-chrome/types';
import type { PublicFieldTransport } from '../../public-world/field/public-field-controller';
// The Public field client is reached the way the product reaches it: as the `field` member of the Public world client on
// the runtime entry's barrel (T-12P: no consumer deep-imports the runtime entry).
import { PublicWorldApiClient, SharedWorldApiClient, type RuntimeHttpFetch } from '../../runtime-entry';
import type { SharedFieldTransport } from '../../shared-world/field/shared-field-controller';
import { fixtureExperience, fixtureField, fixtureSearch } from '../../integration/__validation__/s503b-visual-field';
import { SHARED_VIS_WORLD_A } from '../../integration/__validation__/shared-vis-proof-field';
import { createVport01ProofWorld, type Vport01ProofWorld } from '../../integration/__validation__/vport01-proof-world';

/** What the fixture network does. */
export type CosmosFault = 'NONE' | 'SLOW' | 'FAIL' | 'REFUSED' | 'EMPTY_WORLD';
export const COSMOS_FAULTS: readonly CosmosFault[] = ['NONE', 'SLOW', 'FAIL', 'REFUSED', 'EMPTY_WORLD'];

export interface FixtureNetworkOptions {
  readonly fault: () => CosmosFault;
  /** Multiplies every simulated latency; 0 in tests. */
  readonly latency?: number;
}

const BASE = 'https://cosmos-proof.invalid';
const respond = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const wait = (ms: number) => (ms <= 0 ? Promise.resolve() : new Promise<void>((resolve) => { setTimeout(resolve, ms); }));

// ── Public ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Public field's transport: the production client over the S5-03B fixture. */
export function createPublicFixtureTransport({ fault, latency = 1 }: FixtureNetworkOptions): PublicFieldTransport {
  const fetch: RuntimeHttpFetch = async (input) => {
    const mode = fault();
    const url = input.slice(BASE.length);
    const [path, query = ''] = url.split('?');
    if (path === '/public/field') {
      await wait(90 * latency);
      if (mode === 'FAIL') return respond(503, {});
      if (mode === 'EMPTY_WORLD') return respond(200, { experiences: [] });
      const answer = fixtureField(query);
      return answer === null ? respond(400, {}) : respond(200, { experiences: answer.experiences.slice(0, 400) });
    }
    if (path === '/public/field/search') {
      await wait(90 * latency);
      if (mode === 'FAIL') return respond(503, {});
      const q = decodeURIComponent((/(?:^|&)q=([^&]*)/u.exec(query)?.[1] ?? '').replace(/\+/gu, ' '));
      return respond(200, fixtureSearch(q));
    }
    const panel = /^\/public\/field\/experiences\/([^/]+)$/u.exec(path);
    if (panel !== null) {
      await wait((mode === 'SLOW' ? 2200 : 320) * latency);
      if (mode === 'FAIL') return respond(503, {});
      const id = decodeURIComponent(panel[1]);
      return respond(200, fixtureExperience(id));
    }
    return respond(404, {});
  };
  return new PublicWorldApiClient({ baseUrl: BASE, fetch }).field;
}

// ── Shared ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const SHARED_FIXTURE_WORLD_ID = '5a7ed000-0000-4000-8000-0000000000a1';
const placeId = (index: number) => `5a7ed000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
const materialId = (index: number) => `5a7ed111-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

/** The Shared field's transport: the production client over the SHARED-VIS-01 fixture's World A. */
export function createSharedFixtureTransport({ fault, latency = 1 }: FixtureNetworkOptions, language: ChromeLanguage): SharedFieldTransport {
  const world = SHARED_VIS_WORLD_A;
  // A place is served only while EVERY line it was read from is one the reader may see (the fixture's own rule, D3).
  const served = () => world.places.map((place, index) => ({ place, index })).filter(({ place }) => place.sources.every((i) => world.lines[i].speaker !== 'PEER_HIDDEN'));
  const entryOf = ({ place, index }: { place: (typeof world.places)[number]; index: number }) =>
    ({ placeId: placeId(index), x: String(place.x), y: String(place.y), meaning: place.meaning[language], region: place.region });
  const fetch: RuntimeHttpFetch = async (input) => {
    const mode = fault();
    const path = input.slice(BASE.length).split('?')[0];
    const all = /^\/shared\/worlds\/([0-9a-f-]+)\/field$/u.exec(path);
    if (all !== null) {
      await wait(90 * latency);
      if (mode === 'FAIL') return respond(503, {});
      if (mode === 'REFUSED' || all[1] !== SHARED_FIXTURE_WORLD_ID) return respond(200, { outcome: 'UNAVAILABLE' });
      return respond(200, { outcome: 'ALLOW', places: mode === 'EMPTY_WORLD' ? [] : served().map(entryOf) });
    }
    const one = /^\/shared\/worlds\/([0-9a-f-]+)\/field\/places\/([0-9a-f-]+)$/u.exec(path);
    if (one !== null) {
      await wait((mode === 'SLOW' ? 2200 : 320) * latency);
      if (mode === 'FAIL') return respond(503, {});
      if (mode === 'REFUSED' || one[1] !== SHARED_FIXTURE_WORLD_ID) return respond(200, { outcome: 'UNAVAILABLE' });
      const found = mode === 'EMPTY_WORLD' ? undefined : served().find(({ index }) => placeId(index) === one[2]);
      if (found === undefined) return respond(200, { outcome: 'ABSENT' });
      return respond(200, { outcome: 'ALLOW', place: {
        ...entryOf(found), primaryThemes: [found.place.themes[0][language]], secondaryThemes: [found.place.themes[1][language]],
        establishedAt: '2026-10-01T12:00:00.000Z',
        sources: found.place.sources.map((i) => {
          const line = world.lines[i];
          // The attribution the conversation gives: the reader's own words, or the other person's under a fixture name.
          return { materialId: materialId(i), producer: line.speaker === 'SELF' ? 'SELF' : 'HUMAN', authorName: line.speaker === 'SELF' ? null : 'fixture-peer',
            text: line.text[language], establishedAt: '2026-10-01T12:00:00.000Z' };
        }),
      } });
    }
    return respond(404, {});
  };
  return new SharedWorldApiClient({ baseUrl: BASE, fetch });
}

// ── Personal ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The Personal world: the VPORT-01 proof world (the production integration runtime's scripted network), with the fault
 * selector applied to the ONE read the cloth is drawn from, the historical projection:
 *
 *   FAIL         the read fails (HTTP 503): nothing is held, and the cloth says it could not be read;
 *   REFUSED      the server answers 404, which the production client decodes as SESSION_NOT_VISIBLE;
 *   EMPTY_WORLD  a wire-legal disclosure of a Session that holds nothing yet.
 */
export function createPersonalFixtureWorld({ fault, latency = 1 }: FixtureNetworkOptions, language: ChromeLanguage): Vport01ProofWorld {
  const world = createVport01ProofWorld(language);
  const fetch: RuntimeHttpFetch = async (input, init) => {
    const [path, query = ''] = input.split('?');
    if (!path.endsWith('/historical-projection')) return world.fetch(input, init);
    const mode = fault();
    await wait(90 * latency);
    if (mode === 'FAIL') return respond(503, {});
    if (mode === 'REFUSED') return respond(404, {});
    if (mode === 'EMPTY_WORLD') {
      const params = new Map(query.split('&').filter(Boolean).map((pair) => pair.split('=') as [string, string]));
      const sessionId = /\/sessions\/([^/]+)\/historical-projection$/u.exec(path)?.[1] ?? '';
      const answer = await world.fetch(input, init);
      const served = (await answer.json()) as { liveHead?: number };
      return respond(200, disclosureFixture({
        depth: (params.get('depth') ?? 'WORLD') as never, sessionId: decodeURIComponent(sessionId), tc: Number(params.get('tc') ?? served.liveHead ?? 1),
        liveHead: served.liveHead ?? 1, threads: [], appearances: [], readings: [], focuses: [],
      }));
    }
    return world.fetch(input, init);
  };
  return { config: world.config, auth: world.auth, fetch };
}
