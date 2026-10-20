import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HistoricalSemanticDepth } from '@qandeel/runtime';
import { ReplayRepository } from './replay.repository';
import { ReplayService } from './replay.service';

// S7-03 - the second link of the composite proof's truth chain: the raw rows the 0169 wrappers answered on a real
// PostgreSQL database (`database/replay-composite-proof-world.mjs`, captured in `tests/fixtures/s7-03-replay-history/
// rows.json`) are passed through the REAL ReplayService, and what it answers is exactly the wire the composite proof
// renders (`apps/mobile/src/replay-composite/__fixtures__/replay-wire.json`, inside the mobile build inputs). Nothing is drawn by hand on the way: a row the service would refuse fails here.
//
// Regenerate the wire after a fresh capture with `S703_WRITE_WIRE=1 npx jest src/replay/replay-history-proof.spec.ts`.

const FIXTURE = join(__dirname, '..', '..', '..', '..', 'tests', 'fixtures', 's7-03-replay-history');
const WIRE = join(__dirname, '..', '..', '..', 'mobile', 'src', 'replay-composite', '__fixtures__', 'replay-wire.json');
const DEPTHS: readonly HistoricalSemanticDepth[] = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'];
const TOKEN = 'the-human-s-own-verified-token';

type Row = Record<string, unknown>;
interface CapturedScene {
  readonly replayId: string;
  readonly versionId: string;
  readonly version: Row[];
  readonly moments: Row[];
  readonly analysis: Record<string, Row[]>;
}
interface Capture {
  readonly scenes: Record<string, CapturedScene>;
  readonly commands: Record<string, Row>;
  readonly canonicalThreadsAtTc: Record<string, string[]>;
  readonly provenance: Record<string, string>;
}

const capture = JSON.parse(readFileSync(join(FIXTURE, 'rows.json'), 'utf8')) as Capture;

/** The repository, answering exactly what the database answered for each scene, and nothing else. */
function repositoryOf(scene: CapturedScene, preview: Row | null = null): ReplayRepository {
  const mine = (replayId: string, versionId: string) => replayId === scene.replayId && versionId === scene.versionId;
  return {
    version: async (_token: string, replayId: string, versionId: string) => (mine(replayId, versionId) ? scene.version : []),
    moments: async (_token: string, replayId: string, versionId: string) => (mine(replayId, versionId) ? scene.moments : []),
    momentAnalysis: async (_token: string, replayId: string, versionId: string, ordinal: number) =>
      (mine(replayId, versionId) ? scene.analysis[String(ordinal)] ?? [] : []),
    preparePreview: async () => (preview === null ? [] : [preview]),
  } as unknown as ReplayRepository;
}

async function wireOf(name: string, scene: CapturedScene) {
  const service = new ReplayService(repositoryOf(scene));
  const analysis: Record<string, Record<string, unknown>> = {};
  for (const ordinal of Object.keys(scene.analysis)) {
    analysis[ordinal] = {};
    for (const depth of DEPTHS) analysis[ordinal][depth] = await service.momentAnalysis(TOKEN, scene.replayId, scene.versionId, ordinal, depth);
  }
  return {
    scene: name,
    replayId: scene.replayId,
    versionId: scene.versionId,
    version: await service.version(TOKEN, scene.replayId, scene.versionId),
    moments: await service.moments(TOKEN, scene.replayId, scene.versionId),
    analysis,
  };
}

async function buildWire() {
  const scenes: Record<string, unknown> = {};
  for (const [name, scene] of Object.entries(capture.scenes)) scenes[name] = await wireOf(name, scene);
  const previewOf = (row: Row) => new ReplayService(repositoryOf(capture.scenes.main, row))
    .preparePreview(TOKEN, String(capture.commands.mainDraft.replay_id), { commandId: '11111111-1111-4111-8111-111111111111', expectedDraftRevision: 1 });
  return {
    provenance: { ...capture.provenance, mappedBy: 'apps/api/src/replay/replay.service.ts (ReplayService), unchanged' },
    scenes,
    preview: { openHead: await previewOf(capture.commands.openHeadPreview), legacy: await previewOf(capture.commands.legacyPreview) },
  };
}

describe('S7-03 - the captured real-path history through the real ReplayService', () => {
  let wire: Awaited<ReturnType<typeof buildWire>>;
  beforeAll(async () => {
    wire = await buildWire();
    if (process.env.S703_WRITE_WIRE === '1') writeFileSync(WIRE, `${JSON.stringify(wire, null, 2)}\n`);
  });

  it('answers exactly the wire the composite proof renders', () => {
    expect(JSON.parse(readFileSync(WIRE, 'utf8'))).toEqual(JSON.parse(JSON.stringify(wire)));
  });

  it('every moment analysis is at its own moment: the same ordinal and the same Session Position', () => {
    for (const scene of Object.values(wire.scenes) as { moments: { outcome: string; moments?: { ordinal: number; tc: number }[] }; analysis: Record<string, Record<string, { ordinal?: number; tc?: number }>> }[]) {
      const moments = scene.moments.moments ?? [];
      for (const [ordinal, byDepth] of Object.entries(scene.analysis)) {
        const moment = moments.find((entry) => entry.ordinal === Number(ordinal));
        for (const answer of Object.values(byDepth)) {
          expect(answer.ordinal).toBe(Number(ordinal));
          if (moment !== undefined) expect(answer.tc).toBe(moment.tc);
        }
      }
    }
  });

  it('the Threads of every main moment are exactly the canonical K(TC) Threads at that moment (no hindsight)', () => {
    const main = wire.scenes.main as { moments: { moments: { ordinal: number; tc: number }[] }; analysis: Record<string, Record<string, { world: { threads: { id: string }[] } }>> };
    for (const moment of main.moments.moments) {
      const known = main.analysis[String(moment.ordinal)].WORLD.world.threads.map((thread) => thread.id).sort();
      expect(known).toEqual(capture.canonicalThreadsAtTc[String(moment.tc)]);
    }
  });

  it('S7-05 F-2: every Reading the real database answered has the canonical scope, and the wire carries its class and no Session', () => {
    // What PostgreSQL answered: each Reading's scope is exactly `CONVERSATION_SESSION:<uuid>` (0029 / 0033's one form).
    const captured = JSON.stringify(capture.scenes).match(/"scope":"[^"]*"/gu) ?? [];
    expect(captured.length).toBeGreaterThan(0);
    for (const scope of captured) expect(scope).toMatch(/^"scope":"CONVERSATION_SESSION:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"$/u);
    // What the API served: the class, once per Reading, and no Session id anywhere in an answer.
    const served = JSON.stringify(wire);
    // Each Reading is served at every depth that discloses it (ANALYTICAL_OBJECT and below), always as the class.
    const scopes = served.match(/"scope":"[^"]*"/gu) ?? [];
    expect(scopes.length).toBeGreaterThanOrEqual(captured.length);
    expect(new Set(scopes)).toEqual(new Set(['"scope":"CONVERSATION_SESSION"']));
    for (const session of new Set(captured.map((scope) => scope.slice('"scope":"CONVERSATION_SESSION:'.length, -1)))) expect(served).not.toContain(session);
  });

  it('the bounded states are the real path\'s own answers', () => {
    const scenes = wire.scenes as Record<string, { version: { outcome: string; viewing?: unknown }; moments: { moments: { text: string | null }[] }; analysis: Record<string, Record<string, { outcome: string }>> }>;
    expect(scenes.notViewable.version.viewing).toEqual({ state: 'NOT_VIEWABLE', notViewableClass: 'SOURCE_NOT_CURRENTLY_AVAILABLE',
      sourceLayer: 'NOT_DEREFERENCEABLE', analyticalLayer: 'SEALED_HISTORICAL_EVIDENCE' });
    expect(scenes.notViewable.moments.moments.every((moment) => moment.text === null)).toBe(true);
    expect(scenes.notViewable.analysis['1'].WORLD.outcome).toBe('NOT_VIEWABLE');
    expect(scenes.analysisMoved.analysis['1'].WORLD.outcome).toBe('AVAILABLE');
    expect(scenes.analysisMoved.analysis['2'].WORLD.outcome).toBe('ANALYSIS_NOT_CURRENTLY_AVAILABLE');
    expect(wire.preview).toEqual({ openHead: { outcome: 'MOMENT_NOT_SEALED' }, legacy: { outcome: 'ANALYSIS_UNAVAILABLE' } });
  });
});
