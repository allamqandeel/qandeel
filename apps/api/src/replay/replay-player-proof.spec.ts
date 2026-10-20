import { ServiceUnavailableException } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HistoricalSemanticDepth } from '@qandeel/runtime';
import { ReplayRepository } from './replay.repository';
import { ReplayService } from './replay.service';

// S7-04 - the second link of the production player's truth chain: the rows the 0169 wrappers answered on a real
// PostgreSQL database for one Replay's whole lifecycle journey (`database/replay-composite-proof-world.mjs --player`,
// captured in `tests/fixtures/s7-04-replay-player/rows.json`) are passed through the REAL ReplayService, step by step,
// with the exact arguments each wrapper was called with. What it answers is exactly the HTTP the player's journey proofs
// serve to the production mobile clients (`apps/mobile/src/replay-player/__fixtures__/replay-player-wire.json`, inside
// the mobile build inputs). Nothing is drawn by hand on the way: a row the service would refuse is recorded as the 503
// the controller answers with.
//
// Regenerate the wire after a fresh capture with `S704_WRITE_WIRE=1 npx jest src/replay/replay-player-proof.spec.ts`.

const FIXTURE = join(__dirname, '..', '..', '..', '..', 'tests', 'fixtures', 's7-04-replay-player');
const WIRE = join(__dirname, '..', '..', '..', 'mobile', 'src', 'replay-player', '__fixtures__', 'replay-player-wire.json');
const DEPTHS: readonly HistoricalSemanticDepth[] = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'];
const TOKEN = 'the-human-s-own-verified-token';

type Row = Record<string, unknown>;
interface CapturedStep {
  readonly fn: string;
  readonly args: readonly unknown[];
  readonly rows: Row[];
}
interface CapturedScene {
  readonly replayId: string;
  readonly versionId: string;
  readonly version: Row[];
  readonly moments: Row[];
  readonly analysis: Record<string, Row[]>;
}
interface Capture {
  readonly steps: Record<string, CapturedStep>;
  readonly scenes: Record<string, CapturedScene>;
  readonly provenance: Record<string, string>;
}
interface WireStep {
  readonly request: { readonly method: 'GET' | 'POST'; readonly path: string; readonly body?: Record<string, unknown> };
  readonly status: number;
  readonly body: unknown;
}

const capture = JSON.parse(readFileSync(join(FIXTURE, 'rows.json'), 'utf8')) as Capture;
const text = (value: unknown) => String(value);

/** A repository whose ONE method answers exactly what the database answered, and only for exactly those arguments. */
function repositoryFor(step: CapturedStep): ReplayRepository {
  const answering = (method: string, expected: readonly unknown[]) => async (_token: string, ...args: unknown[]) => {
    expect({ method, args }).toEqual({ method, args: expected });
    return step.rows;
  };
  const refuse = (method: string) => async () => {
    throw new Error(`${method} was not part of this step (${step.fn})`);
  };
  const methods = ['capability', 'conversationReplays', 'createDraft', 'reviseDraft', 'preparePreview', 'finalize', 'reopen', 'replay', 'version', 'moments', 'momentAnalysis'];
  const repository = Object.fromEntries(methods.map((method) => [method, refuse(method)])) as Record<string, unknown>;
  const name = {
    'public.read_my_replay_capability_v1': 'capability',
    'public.list_my_conversation_replays_v1': 'conversationReplays',
    'public.create_my_replay_draft_v1': 'createDraft',
    'public.prepare_my_replay_preview_v1': 'preparePreview',
    'public.finalize_my_replay_version_v1': 'finalize',
    'public.reopen_my_replay_for_revision_v1': 'reopen',
    'public.read_my_replay_v1': 'replay',
    'public.read_my_replay_version_v1': 'version',
  }[step.fn];
  if (name === undefined) throw new Error(`an unmapped step: ${step.fn}`);
  repository[name] = answering(name, step.args);
  return repository as unknown as ReplayRepository;
}

/** One step, through the real service, as the HTTP exchange the controller would answer it with. */
async function wireStep(step: CapturedStep): Promise<WireStep> {
  const service = new ReplayService(repositoryFor(step));
  const [a, b, c, d] = step.args;
  let request: WireStep['request'];
  let call: () => Promise<unknown>;
  switch (step.fn) {
    case 'public.read_my_replay_capability_v1':
      request = { method: 'GET', path: '/replay/capability' };
      call = () => service.capability(TOKEN);
      break;
    case 'public.list_my_conversation_replays_v1':
      request = { method: 'GET', path: `/replay/conversations/${text(a)}` };
      call = () => service.conversationReplays(TOKEN, text(a));
      break;
    case 'public.create_my_replay_draft_v1':
      request = { method: 'POST', path: '/replay/drafts', body: { commandId: a, sessionId: b, firstTc: c, lastTc: d } };
      call = () => service.createDraft(TOKEN, request.body);
      break;
    case 'public.prepare_my_replay_preview_v1':
      request = { method: 'POST', path: `/replay/${text(b)}/preview`, body: { commandId: a, expectedDraftRevision: c } };
      call = () => service.preparePreview(TOKEN, text(b), request.body);
      break;
    case 'public.finalize_my_replay_version_v1':
      request = { method: 'POST', path: `/replay/${text(b)}/finalize`, body: { commandId: a, expectedVersionId: c } };
      call = () => service.finalize(TOKEN, text(b), request.body);
      break;
    case 'public.reopen_my_replay_for_revision_v1':
      request = { method: 'POST', path: `/replay/${text(b)}/reopen`, body: { commandId: a, expectedVersionId: c } };
      call = () => service.reopen(TOKEN, text(b), request.body);
      break;
    case 'public.read_my_replay_v1':
      request = { method: 'GET', path: `/replay/${text(a)}` };
      call = () => service.replay(TOKEN, text(a));
      break;
    case 'public.read_my_replay_version_v1':
      request = { method: 'GET', path: `/replay/${text(a)}/versions/${text(b)}` };
      call = () => service.version(TOKEN, text(a), text(b));
      break;
    default:
      throw new Error(`an unmapped step: ${step.fn}`);
  }
  try {
    return { request, status: 200, body: await call() };
  } catch (error) {
    // The controller answers a refused row as a 503 with nothing of the database's answer in it.
    if (error instanceof ServiceUnavailableException) return { request, status: 503, body: { outcome: 'UNAVAILABLE' } };
    throw error;
  }
}

function sceneRepository(scene: CapturedScene): ReplayRepository {
  const mine = (replayId: string, versionId: string) => replayId === scene.replayId && versionId === scene.versionId;
  return {
    version: async (_token: string, replayId: string, versionId: string) => (mine(replayId, versionId) ? scene.version : []),
    moments: async (_token: string, replayId: string, versionId: string) => (mine(replayId, versionId) ? scene.moments : []),
    momentAnalysis: async (_token: string, replayId: string, versionId: string, ordinal: number) =>
      (mine(replayId, versionId) ? scene.analysis[String(ordinal)] ?? [] : []),
  } as unknown as ReplayRepository;
}

async function wireScene(scene: CapturedScene) {
  const service = new ReplayService(sceneRepository(scene));
  const analysis: Record<string, Record<string, unknown>> = {};
  for (const ordinal of Object.keys(scene.analysis)) {
    analysis[ordinal] = {};
    for (const depth of DEPTHS) analysis[ordinal][depth] = await service.momentAnalysis(TOKEN, scene.replayId, scene.versionId, ordinal, depth);
  }
  return {
    replayId: scene.replayId,
    versionId: scene.versionId,
    version: await service.version(TOKEN, scene.replayId, scene.versionId),
    moments: await service.moments(TOKEN, scene.replayId, scene.versionId),
    analysis,
  };
}

async function buildWire() {
  const steps: Record<string, WireStep> = {};
  for (const [label, step] of Object.entries(capture.steps)) steps[label] = await wireStep(step);
  const scenes: Record<string, unknown> = {};
  for (const [name, scene] of Object.entries(capture.scenes)) scenes[name] = await wireScene(scene);
  return { provenance: { ...capture.provenance, mappedBy: 'apps/api/src/replay/replay.service.ts (ReplayService; S7-01, with the S7-04 G-1 list decoding)' }, steps, scenes };
}

describe('S7-04 - the captured lifecycle journey through the real ReplayService', () => {
  let wire: Awaited<ReturnType<typeof buildWire>>;
  beforeAll(async () => {
    wire = await buildWire();
    if (process.env.S704_WRITE_WIRE === '1') writeFileSync(WIRE, `${JSON.stringify(wire, null, 2)}\n`);
  });
  const body = (label: string) => wire.steps[label].body as Record<string, unknown>;

  it('answers exactly the wire the player journey proofs serve', () => {
    expect(JSON.parse(readFileSync(WIRE, 'utf8'))).toEqual(JSON.parse(JSON.stringify(wire)));
  });

  it('a real preview binds a real version, and a retry under the same id is answered from committed history', () => {
    expect(body('preview')).toMatchObject({ outcome: 'PREVIEW_READY', momentCount: 6, versionRevision: 1 });
    expect(body('previewRetry')).toEqual(body('preview'));
    expect(body('previewConflict')).toEqual({ outcome: 'COMMAND_CONFLICT' });
    expect(body('previewAgain')).toEqual({ outcome: 'LIFECYCLE_NOT_ELIGIBLE' });
    expect(body('readPreview')).toMatchObject({ lifecycle: 'PREVIEW_READY', currentVersion: { versionId: body('preview').versionId, revision: 1, finalized: false } });
  });

  it('finalizing writes one private version, and every other answer is bounded', () => {
    expect(body('finalizeStale')).toEqual({ outcome: 'CHANGED' });
    expect(body('finalize')).toEqual({ outcome: 'FINALIZED', replayId: body('preview').replayId, versionId: body('preview').versionId, versionRevision: 1 });
    expect(body('finalizeRetry')).toEqual(body('finalize'));
    expect(body('finalizeAgain')).toEqual({ outcome: 'LIFECYCLE_NOT_ELIGIBLE' });
    expect(body('readFinalized')).toMatchObject({ lifecycle: 'FINALIZED', currentVersion: { finalized: true } });
    expect(body('sourceChangedFinalize')).toEqual({ outcome: 'SOURCE_CHANGED' });
    expect(body('analysisChangedFinalize')).toEqual({ outcome: 'ANALYSIS_CHANGED' });
    expect(body('openHeadPreview')).toEqual({ outcome: 'MOMENT_NOT_SEALED' });
  });

  it('reopening returns the Replay to a draft; the finalized version stays viewable and a later preview is a new version', () => {
    expect(body('reopen')).toEqual({ outcome: 'REOPENED', replayId: body('preview').replayId, lifecycle: 'DRAFT', reopenedFromVersionId: body('preview').versionId });
    expect(body('reopenRetry')).toEqual(body('reopen'));
    expect(body('readAfterReopen')).toMatchObject({ lifecycle: 'DRAFT', currentVersion: { versionId: body('preview').versionId, finalized: true } });
    expect(body('versionAfterReopen')).toMatchObject({ isCurrent: true, finalized: true, viewing: { state: 'VIEWABLE' } });
    expect(body('previewSecond')).toMatchObject({ outcome: 'PREVIEW_READY', versionRevision: 2 });
    expect(body('versionFirstAfterSecond')).toMatchObject({ isCurrent: false, finalized: true, viewing: { state: 'VIEWABLE' } });
  });

  it('a source changed while a version is viewed withdraws it: no text, and every moment analysis NOT_VIEWABLE', () => {
    const withdrawn = wire.scenes.sourceWithdrawn as { version: { viewing: unknown }; moments: { moments: { text: string | null }[] }; analysis: Record<string, Record<string, { outcome: string }>> };
    expect(withdrawn.version.viewing).toMatchObject({ state: 'NOT_VIEWABLE', sourceLayer: 'NOT_DEREFERENCEABLE' });
    expect(withdrawn.moments.moments.every((moment) => moment.text === null)).toBe(true);
    expect(withdrawn.analysis['2'].WORLD.outcome).toBe('NOT_VIEWABLE');
  });

  // S7-04 G-1 (record §5, corrected): the 0169 list wrapper answers `current_version_finalized = false` beside a null
  // version (an EXISTS is never null). The summary decoder reads exactly that as "no version yet", so a fresh draft is
  // listed with the wire's own null; before the correction the whole list failed closed (503).
  it('G-1: the conversation list lists a fresh draft with no version, in each lifecycle after it as well', () => {
    expect(capture.steps.listDraft.rows).toEqual([expect.objectContaining({ current_replay_version_id: null, current_version_finalized: false })]);
    expect(wire.steps.listDraft).toMatchObject({ status: 200, body: { replays: [
      { replayId: capture.steps.listDraft.rows[0].replay_id, lifecycle: 'DRAFT', currentVersionId: null, currentVersionFinalized: null }] } });
    expect(wire.steps.listBefore).toMatchObject({ status: 200, body: { replays: [] } });
    expect(wire.steps.listAfterReopen).toMatchObject({ status: 200, body: { replays: [{ lifecycle: 'DRAFT', currentVersionFinalized: true }] } });
    // The Replay read itself carries null there, and is read.
    expect(wire.steps.readDraft).toMatchObject({ status: 200, body: { outcome: 'FOUND', currentVersion: null } });
    expect(wire.steps.listPreview).toMatchObject({ status: 200, body: { replays: [{ lifecycle: 'PREVIEW_READY', currentVersionFinalized: false }] } });
    expect(wire.steps.listFinalized).toMatchObject({ status: 200, body: { replays: [{ lifecycle: 'FINALIZED', currentVersionFinalized: true }] } });
  });

  it('the way on after a refused finalize is the existing reopen: a PREVIEW_READY Replay reopens, and previews a new version', () => {
    expect(wire.steps.analysisChangedFinalize.body).toEqual({ outcome: 'ANALYSIS_CHANGED' });
    expect(wire.steps.readAnalysisAfterRefusal.body).toMatchObject({ lifecycle: 'PREVIEW_READY', currentVersion: { finalized: false } });
    expect(wire.steps.analysisReopen.body).toMatchObject({ outcome: 'REOPENED', lifecycle: 'DRAFT' });
    expect(wire.steps.readAnalysisAfterReopen.body).toMatchObject({ lifecycle: 'DRAFT', currentVersion: { finalized: false } });
    expect(wire.steps.analysisPreviewAgain.body).toMatchObject({ outcome: 'PREVIEW_READY', versionRevision: 2 });
    // A source change refuses the finalize and leaves the Replay PREVIEW_READY, so the same way on applies.
    expect(wire.steps.sourceChangedFinalize.body).toEqual({ outcome: 'SOURCE_CHANGED' });
    expect(wire.steps.readSourceAfterRefusal.body).toMatchObject({ lifecycle: 'PREVIEW_READY' });
    // The open head: the draft is kept, and the preview is refused without a version.
    expect(wire.steps.openHeadPreview.body).toEqual({ outcome: 'MOMENT_NOT_SEALED' });
    expect(wire.steps.readOpenHead.body).toMatchObject({ lifecycle: 'DRAFT', currentVersion: null });
  });
});
