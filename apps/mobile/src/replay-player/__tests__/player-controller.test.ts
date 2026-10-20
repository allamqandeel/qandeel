/**
 * S7-04 — the player controller over the REAL-PATH lifecycle wire, through the production clients and the S7-03
 * composite controller. Every command id and body a test sends is the one the captured journey sent; anything else is
 * answered 404 and recorded as uncaptured, and every test ends with none.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import { createReplayPlayerController, readingPaceMs, REPLAY_READING_PACE, type ReplayPlayerController, type ReplayPlayerScheduler } from '..';
import { PLAYER_IDS, PLAYER_WIRE, capturedCommandId, capturedHandoff, capturedIds, playerClients, playerServer, type PlayerServer, type PlayerServerOptions } from '../__fixtures__/player-wire';

const settle = async () => {
  for (let i = 0; i < 12; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** An answer held until the test lets it through. */
function gate() {
  let letThrough: () => void = () => undefined;
  const passed = new Promise<void>((resolve) => {
    letThrough = resolve;
  });
  return { passed, release: () => letThrough() };
}

function manualScheduler() {
  const pending = new Map<number, { readonly run: () => void; readonly ms: number }>();
  let next = 0;
  const scheduler: ReplayPlayerScheduler = {
    set(run, ms) {
      next += 1;
      pending.set(next, { run, ms });
      return next;
    },
    clear(handle) {
      pending.delete(handle as number);
    },
  };
  return {
    scheduler,
    pending,
    /** Runs the one armed step and says how long it was armed for. */
    fire(): number {
      const entries = [...pending];
      expect(entries).toHaveLength(1);
      const [handle, step] = entries[0];
      pending.delete(handle);
      step.run();
      return step.ms;
    },
  };
}

interface Built {
  readonly player: ReplayPlayerController;
  readonly server: PlayerServer;
  readonly clock: ReturnType<typeof manualScheduler>;
  current: boolean;
}

function build(ids: () => string, options: PlayerServerOptions = {}): Built {
  const server = playerServer(options);
  const clock = manualScheduler();
  const built: Built = {
    server,
    clock,
    current: true,
    player: undefined as never,
  };
  (built as { player: ReplayPlayerController }).player = createReplayPlayerController({
    sessionId: PLAYER_IDS.session, ...playerClients(server), isCurrent: () => built.current, newCommandId: ids, scheduler: clock.scheduler,
  });
  return built;
}

const open = (player: ReplayPlayerController) => player.getState().open!;
/** What the composite does when it is drawn: read the shown moment's analysis at the camera's depth. */
async function drawn(player: ReplayPlayerController, depth: HistoricalSemanticDepth = 'WORLD') {
  const view = open(player);
  view.composite!.ensureAnalysis(view.ordinal, depth);
  await settle();
}
const texts = (player: ReplayPlayerController) => {
  const read = open(player).composite!.state();
  return read.status === 'READY' ? read.moments.map((moment) => moment.text) : null;
};

async function previewed(ids: string[] = [], options: PlayerServerOptions = {}): Promise<Built> {
  const built = build(capturedIds('preview', ...ids), options);
  built.player.openSaved(capturedHandoff('draft'));
  await settle();
  return built;
}

describe('S7-04 — Select → Saved Draft → Real Preview', () => {
  it('reads the saved draft, then previews it under ONE command id with the draft revision it names', async () => {
    const { player, server } = await previewed();
    expect(server.requests.slice(0, 2)).toEqual([
      { method: 'GET', path: `/replay/${PLAYER_IDS.replay}` },
      PLAYER_WIRE.steps.preview.request,
    ]);
    expect(server.requests[1].body).toEqual({ commandId: capturedCommandId('preview'), expectedDraftRevision: 1 });
    const view = open(player);
    expect(view).toMatchObject({ origin: 'CONVERSATION', replayId: PLAYER_IDS.replay, lifecycle: 'PREVIEW_READY', command: null, problem: null, ordinal: 1, playing: false });
    expect(view.version).toEqual({ versionId: PLAYER_IDS.v1, revision: 1, finalized: false });
    // The version's own moments, from the S7-01 reads: the historical text, in ordinal and TC order.
    const read = view.composite!.state();
    expect(read.status).toBe('READY');
    if (read.status !== 'READY') return;
    expect(read.moments.map((moment) => [moment.ordinal, moment.tc])).toEqual([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
    expect(read.moments.map((moment) => moment.text)).toEqual((PLAYER_WIRE.scenes.preview.moments as { moments: { text: string }[] }).moments.map((moment) => moment.text));
    expect(server.uncaptured).toEqual([]);
  });

  it('a draft from another Session is not opened', async () => {
    const built = build(capturedIds());
    built.player.openSaved({ ...capturedHandoff('draft'), sessionId: '00000000-0000-4000-8000-000000000000' });
    await settle();
    expect(built.player.getState().open).toBeNull();
    expect(built.server.requests).toEqual([]);
  });
});

describe('S7-04 — moments: manual navigation and the declared pace', () => {
  it('previous and next walk the version in ordinal order, and stop at both ends', async () => {
    const { player, server } = await previewed();
    expect(player.transport()).toEqual({ available: true, count: 6, index: 0, atFirst: true, atLast: false });
    player.previous();
    expect(open(player).ordinal).toBe(1);
    for (let i = 0; i < 7; i += 1) player.next();
    expect(open(player).ordinal).toBe(6);
    expect(player.transport()).toMatchObject({ index: 5, atLast: true });
    player.previous();
    expect(open(player).ordinal).toBe(5);
    // Navigation reads nothing: the composite reads one moment's analysis when it draws it, never ahead.
    expect(server.requests.filter((r) => r.path.includes('/analysis'))).toEqual([]);
  });

  it('seek (the Spine\'s commit) goes to a moment of THIS version only; anything else changes nothing', async () => {
    const { player } = await previewed();
    player.seek(4);
    expect(open(player).ordinal).toBe(4);
    for (const refused of [0, 7, 2.5, Number.NaN, -1]) {
      player.seek(refused);
      expect(open(player).ordinal).toBe(4);
    }
    player.seek(6);
    expect(player.transport()).toMatchObject({ index: 5, atLast: true });
    player.seek(1);
    expect(player.transport()).toMatchObject({ index: 0, atFirst: true });
  });

  it('play arms one step only once the moment is settled, at its reading pace, and stops at the end', async () => {
    const { player, clock } = await previewed();
    player.play();
    expect(open(player).playing).toBe(true);
    // Not settled: the moment's analysis has not answered yet.
    expect(clock.pending.size).toBe(0);
    await drawn(player);
    const first = texts(player)![0]!;
    expect(clock.fire()).toBe(readingPaceMs(first));
    expect(open(player).ordinal).toBe(2);
    for (let ordinal = 2; ordinal <= 5; ordinal += 1) {
      await drawn(player);
      clock.fire();
    }
    expect(open(player)).toMatchObject({ ordinal: 6, playing: true });
    await drawn(player);
    clock.fire();
    // The last moment stays on screen; nothing is armed.
    expect(open(player)).toMatchObject({ ordinal: 6, playing: false });
    expect(clock.pending.size).toBe(0);
    // Play at the last moment starts again from the first.
    player.play();
    expect(open(player)).toMatchObject({ ordinal: 1, playing: true });
  });

  it('the pace is declared and bounded — never the original timing', () => {
    expect(readingPaceMs('')).toBe(REPLAY_READING_PACE.minMs);
    expect(readingPaceMs('x'.repeat(10_000))).toBe(REPLAY_READING_PACE.maxMs);
    // Counted in characters, so an Arabic message is not paced by its UTF-16 length.
    expect(readingPaceMs('أنا')).toBe(readingPaceMs('abc'));
  });

  it('pause and manual navigation cancel the armed step', async () => {
    const { player, clock } = await previewed();
    player.play();
    await drawn(player);
    expect(clock.pending.size).toBe(1);
    player.pause();
    expect(clock.pending.size).toBe(0);
    player.play();
    await drawn(player);
    player.next();
    // The next moment is not settled until it is drawn.
    expect(clock.pending.size).toBe(0);
    await drawn(player);
    expect(clock.pending.size).toBe(1);
  });

  it('closing stops everything: no timer, and nothing that lands later is shown', async () => {
    const held = gate();
    let asked = false;
    const { player, clock, server } = await previewed([], {
      intercept: (request) => {
        if (!(request.path.endsWith('/analysis?depth=WORLD') && request.path.includes('/moments/2/'))) return undefined;
        asked = true;
        return held.passed.then(() => ({ status: 200, body: PLAYER_WIRE.scenes.preview.analysis['2'].WORLD }));
      },
    });
    player.play();
    await drawn(player);
    clock.fire();
    open(player).composite!.ensureAnalysis(2, 'WORLD');
    await settle();
    expect(asked).toBe(true);
    player.close();
    expect(player.getState().open).toBeNull();
    expect(clock.pending.size).toBe(0);
    const before = server.requests.length;
    held.release();
    await settle();
    expect(player.getState().open).toBeNull();
    expect(clock.pending.size).toBe(0);
    expect(server.requests.length).toBe(before);
  });
});

describe('S7-04 — Private Finalize and Reopen', () => {
  it('finalize names the version shown; the moment on screen stays; the copy is private', async () => {
    const { player, server } = await previewed(['finalize']);
    player.next();
    player.finalize();
    await settle();
    expect(server.requests.at(-1)).toEqual(PLAYER_WIRE.steps.finalize.request);
    expect(open(player)).toMatchObject({ lifecycle: 'FINALIZED', notice: 'FINALIZED', ordinal: 2, version: { versionId: PLAYER_IDS.v1, finalized: true } });
    // No second finalize is offered on a finalized version.
    player.finalize();
    await settle();
    expect(server.requests.filter((r) => r.path.endsWith('/finalize'))).toHaveLength(1);
    expect(server.uncaptured).toEqual([]);
  });

  it('reopen keeps the finalized version on screen, reads the draft revision, and a new preview shows a NEW version', async () => {
    const { player, server } = await previewed(['finalize', 'reopen', 'previewSecond']);
    player.finalize();
    await settle();
    player.reopen();
    await settle();
    expect(server.requests.slice(-2)).toEqual([PLAYER_WIRE.steps.reopen.request, { method: 'GET', path: `/replay/${PLAYER_IDS.replay}` }]);
    expect(open(player)).toMatchObject({ lifecycle: 'DRAFT', draftRevision: 1, notice: 'DRAFT_AGAIN', version: { versionId: PLAYER_IDS.v1, finalized: true } });
    expect(player.transport().available).toBe(true);
    const firstComposite = open(player).composite;
    player.preview();
    await settle();
    expect(server.requests.find((r) => r.path.endsWith('/preview') && r.body?.commandId === capturedCommandId('previewSecond'))).toEqual(PLAYER_WIRE.steps.previewSecond.request);
    expect(open(player)).toMatchObject({ lifecycle: 'PREVIEW_READY', version: { versionId: PLAYER_IDS.v2, revision: 2, finalized: false }, ordinal: 1 });
    expect(open(player).composite).not.toBe(firstComposite);
    expect(server.uncaptured).toEqual([]);
  });
});

describe('S7-04 — an uncertain answer is never success or failure', () => {
  it('a dropped preview answer is UNCONFIRMED; Try again re-issues the SAME id and body; closing keeps it, reopening resumes it', async () => {
    let drops = 1;
    const built = build(capturedIds('preview'), {
      intercept: (request) => (request.path.endsWith('/preview') && drops-- > 0 ? 'NETWORK' : undefined),
    });
    built.player.openSaved(capturedHandoff('draft'));
    await settle();
    expect(open(built.player)).toMatchObject({ problem: 'UNCONFIRMED', command: { act: 'PREVIEW', phase: 'UNCONFIRMED' }, version: null, lifecycle: 'DRAFT' });
    // No other command while it is unresolved.
    built.player.preview();
    built.player.close();
    built.player.openSaved(capturedHandoff('draft'));
    await settle();
    expect(open(built.player)).toMatchObject({ problem: 'UNCONFIRMED', command: { id: capturedCommandId('preview'), phase: 'UNCONFIRMED' } });
    built.player.retry();
    await settle();
    const previews = built.server.requests.filter((r) => r.path.endsWith('/preview'));
    expect(previews).toEqual([PLAYER_WIRE.steps.preview.request, PLAYER_WIRE.steps.previewRetry.request]);
    expect(PLAYER_WIRE.steps.previewRetry.request).toEqual(PLAYER_WIRE.steps.preview.request);
    expect(open(built.player)).toMatchObject({ problem: null, command: null, lifecycle: 'PREVIEW_READY', version: { versionId: PLAYER_IDS.v1 } });
    expect(built.server.uncaptured).toEqual([]);
  });

  it('a 5xx finalize is UNCONFIRMED (the finalize words); Try again is the captured idempotent retry', async () => {
    let drops = 1;
    const { player, server } = await previewed(['finalize'], {
      intercept: (request) => (request.path.endsWith('/finalize') && drops-- > 0 ? { status: 503, body: { outcome: 'UNAVAILABLE' } } : undefined),
    });
    player.finalize();
    await settle();
    expect(open(player)).toMatchObject({ problem: 'UNCONFIRMED', command: { act: 'FINALIZE', phase: 'UNCONFIRMED' }, lifecycle: 'PREVIEW_READY' });
    player.retry();
    await settle();
    expect(server.requests.filter((r) => r.path.endsWith('/finalize'))).toEqual([PLAYER_WIRE.steps.finalize.request, PLAYER_WIRE.steps.finalizeRetry.request]);
    expect(open(player)).toMatchObject({ lifecycle: 'FINALIZED', notice: 'FINALIZED', problem: null });
  });

  it('a command in flight offers nothing else, and playback stops while it runs', async () => {
    const held = gate();
    const { player, server, clock } = await previewed(['finalize'], {
      intercept: (request) => (request.path.endsWith('/finalize') ? held.passed.then(() => ({ status: 200, body: PLAYER_WIRE.steps.finalize.body })) : undefined),
    });
    player.play();
    await drawn(player);
    player.finalize();
    expect(open(player)).toMatchObject({ playing: false, command: { phase: 'SENDING' } });
    expect(clock.pending.size).toBe(0);
    player.reopen();
    player.play();
    expect(open(player).playing).toBe(false);
    held.release();
    await settle();
    expect(server.requests.filter((r) => r.method === 'POST')).toHaveLength(2);
    expect(open(player).lifecycle).toBe('FINALIZED');
  });
});

describe('S7-04 — every bounded refusal is said as what it is', () => {
  it('MOMENT_NOT_SEALED: the open head is refused without a version', async () => {
    const built = build(capturedIds('openHeadPreview'));
    built.player.openSaved(capturedHandoff('openHeadDraft'));
    await settle();
    expect(open(built.player)).toMatchObject({ problem: 'MOMENT_NOT_SEALED', version: null, composite: null, command: null, lifecycle: 'DRAFT' });
    expect(built.server.uncaptured).toEqual([]);
  });

  it('SOURCE_CHANGED: the finalize is refused, the version is read afresh, and its text never stays on screen', async () => {
    const built = build(capturedIds('sourceChangedFinalize'));
    built.player.openSaved(capturedHandoff('sourceDraft'));
    await settle();
    // Already previewed: shown, not previewed twice.
    expect(built.server.requests.filter((r) => r.path.endsWith('/preview'))).toEqual([]);
    expect(open(built.player)).toMatchObject({ lifecycle: 'PREVIEW_READY', version: { versionId: PLAYER_IDS.sourceVersion } });
    expect(texts(built.player)!.every((text) => text !== null)).toBe(true);
    const shown = open(built.player).composite;
    built.server.withdrawSource();
    built.player.finalize();
    await settle();
    const view = open(built.player);
    expect(view).toMatchObject({ problem: 'CHANGED', lifecycle: 'PREVIEW_READY', command: null });
    expect(view.composite).not.toBe(shown);
    const read = view.composite!.state();
    expect(read.status === 'READY' && read.version.viewing.state).toBe('NOT_VIEWABLE');
    expect(texts(built.player)).toEqual([null, null, null]);
    // Nothing is playable: no NOT_VIEWABLE playback.
    expect(built.player.transport().available).toBe(false);
    built.player.play();
    expect(open(built.player).playing).toBe(false);
    expect(built.server.uncaptured).toEqual([]);
  });

  it('ANALYSIS_CHANGED: refused; the way on is reopen, then a new preview with analysis again', async () => {
    const built = build(capturedIds('analysisChangedFinalize', 'analysisReopen', 'analysisPreviewAgain'));
    built.player.openSaved(capturedHandoff('analysisDraft'));
    await settle();
    built.player.finalize();
    await settle();
    expect(open(built.player)).toMatchObject({ problem: 'ANALYSIS_CHANGED', lifecycle: 'PREVIEW_READY' });
    built.player.reopen();
    await settle();
    expect(open(built.player)).toMatchObject({ lifecycle: 'DRAFT', draftRevision: 1, notice: 'DRAFT_AGAIN', problem: null });
    built.player.preview();
    await settle();
    expect(open(built.player)).toMatchObject({ lifecycle: 'PREVIEW_READY', version: { versionId: PLAYER_IDS.movedSecond, revision: 2 } });
    await drawn(built.player);
    expect(open(built.player).composite!.analysis(1, 'WORLD')?.status).toBe('AVAILABLE');
    expect(built.server.uncaptured).toEqual([]);
  });

  it('LIFECYCLE_NOT_ELIGIBLE and COMMAND_CONFLICT claim nothing (decoded words, served once)', async () => {
    const { player } = await previewed(['finalize'], {
      intercept: (request) => (request.path.endsWith('/finalize') ? { status: 200, body: PLAYER_WIRE.steps.finalizeAgain.body } : undefined),
    });
    player.finalize();
    await settle();
    // Not in that state any more: the server's own record decides what is shown (here: still the preview).
    expect(open(player)).toMatchObject({ lifecycle: 'PREVIEW_READY', command: null, notice: null });
    const conflicted = await previewed(['finalize'], {
      intercept: (request) => (request.path.endsWith('/finalize') ? { status: 200, body: PLAYER_WIRE.steps.previewConflict.body } : undefined),
    });
    conflicted.player.finalize();
    await settle();
    expect(open(conflicted.player)).toMatchObject({ problem: 'FAILED', lifecycle: 'PREVIEW_READY', command: null });
  });
});

describe('S7-04 — revocation, identity and generation', () => {
  it('a viewing permission withdrawn while playing stops the player and shows nothing of the earlier reads', async () => {
    const built = build(capturedIds());
    built.player.openSaved(capturedHandoff('sourceDraft'));
    await settle();
    built.player.play();
    await drawn(built.player);
    built.clock.fire();
    // The message changes before the next moment's analysis is read: that read answers NOT_VIEWABLE.
    built.server.withdrawSource();
    await drawn(built.player);
    expect(open(built.player).composite!.state().status).toBe('REVOKED');
    expect(open(built.player).playing).toBe(false);
    expect(built.clock.pending.size).toBe(0);
    expect(built.player.transport().available).toBe(false);
  });

  it('an identity or Session change mid-request drops every late answer, and retirement leaves nothing', async () => {
    const held = gate();
    const built = build(capturedIds('preview'), {
      intercept: (request) => (request.path.endsWith('/preview') ? held.passed.then(() => ({ status: 200, body: PLAYER_WIRE.steps.preview.body })) : undefined),
    });
    built.player.openSaved(capturedHandoff('draft'));
    await settle();
    const listener = jest.fn();
    built.player.subscribe(listener);
    built.current = false;
    held.release();
    await settle();
    expect(open(built.player)).toMatchObject({ version: null, composite: null, command: { phase: 'SENDING' } });
    expect(listener).not.toHaveBeenCalled();
    built.player.retire();
    expect(built.player.getState().open).toBeNull();
    built.player.openSaved(capturedHandoff('draft'));
    built.player.openLatest(null);
    expect(built.player.getState().open).toBeNull();
    expect(built.clock.pending.size).toBe(0);
  });
});

describe('S7-04 — the Analysis entry', () => {
  it('opens the Replay saved in this generation without reading the list', async () => {
    const built = build(capturedIds());
    built.player.openLatest(capturedHandoff('draft'));
    await settle();
    expect(built.server.requests).toEqual([{ method: 'GET', path: `/replay/${PLAYER_IDS.replay}` }]);
    expect(open(built.player)).toMatchObject({ origin: 'ANALYSIS', lifecycle: 'DRAFT', draftRevision: 1, version: null });
  });

  it('otherwise opens the newest Replay of this conversation from the list; a finalized one offers reopen', async () => {
    const { player, server } = await previewed(['finalize']);
    player.finalize();
    await settle();
    player.close();
    const before = server.requests.length;
    player.openLatest(null);
    await settle();
    expect(server.requests.slice(before, before + 2)).toEqual([PLAYER_WIRE.steps.listFinalized.request, { method: 'GET', path: `/replay/${PLAYER_IDS.replay}` }]);
    expect(open(player)).toMatchObject({ origin: 'ANALYSIS', lifecycle: 'FINALIZED', version: { versionId: PLAYER_IDS.v1, finalized: true }, notice: null });
    expect(server.uncaptured).toEqual([]);
  });

  it('G-1: while a fresh draft exists the list fails closed, and that is said as a failure, never as "nothing here"', async () => {
    const built = build(capturedIds());
    built.player.openLatest(null);
    await settle();
    expect(PLAYER_WIRE.steps.listDraft.status).toBe(503);
    expect(open(built.player)).toMatchObject({ problem: 'READ_FAILED', replayId: null });
    built.server.listIs('listBefore');
    built.player.retry();
    await settle();
    expect(open(built.player)).toMatchObject({ problem: 'NONE', replayId: null });
  });
});
