/**
 * S8B-04 (CP2) — QANDEEL's spoken reply to a note sent here, against a scripted server and a scripted player:
 *
 *   it speaks by itself only while the reader looks at it; the released text and the finished answer arrive by the
 *   status long-poll; the player stops itself at the announced length; pause / resume / replay; a failure keeps the
 *   text; an expired voice is GONE; quieting pauses and stops synthesis of a reply still produced (never after its end).
 */
import { createManualForegroundSignal, type ConversationExchangeView } from '../../runtime-entry';
import type { VoiceLiveReplyRead, VoiceNoteApiClient } from '../voice-note-api';
import type { VoiceNotePlayer, VoiceNotePlayerPort, VoiceNotePlayerStatus } from '../voice-note-playback';
import { createVoiceReplies, VOICE_REPLY_LOAD_TIMEOUT_MS } from '../voice-reply';

const TURN = 't0000000-0000-4000-8000-000000000001';
const REPLY = 'r0000000-0000-4000-8000-000000000001';
const ANSWER = { userTurn: { id: TURN, content: 'نص', idempotencyKey: null, createdAt: '2026-11-02T10:00:00.000Z' }, replyState: 'COMPLETED', reply: null } as unknown as ConversationExchangeView;

const status = (view: Partial<Extract<VoiceLiveReplyRead, { kind: 'STATUS' }>['view']>): VoiceLiveReplyRead =>
  ({ kind: 'STATUS', view: { state: 'STREAMING', finalDurationMs: null, text: null, ...view } });

function harness({ inFront = true } = {}) {
  const reads: VoiceLiveReplyRead[] = [];
  const waiting: ((read: VoiceLiveReplyRead) => void)[] = [];
  const cancels: string[] = [];
  const api: Pick<VoiceNoteApiClient, 'liveReplyStatus' | 'liveReplyAudioUrl' | 'cancelLiveReply'> = {
    // Each read answers with the next scripted status, or waits for one (a long-poll).
    liveReplyStatus: () => (reads.length > 0 ? Promise.resolve(reads.shift()!) : new Promise((resolve) => waiting.push(resolve))),
    liveReplyAudioUrl: (replyId) => `https://api.test/voice/live-replies/${replyId}/audio`,
    cancelLiveReply: async (replyId) => {
      cancels.push(replyId);
    },
  };
  const players: { url: string; headers: Record<string, string>; report: (s: Partial<VoiceNotePlayerStatus>) => void; calls: string[]; released: boolean }[] = [];
  const port: VoiceNotePlayerPort = {
    async create(url, headers, onStatus) {
      const entry = {
        url, headers, calls: [] as string[], released: false,
        report: (s: Partial<VoiceNotePlayerStatus>) => onStatus({ loaded: true, playing: false, positionMs: 0, durationMs: 0, finished: false, failed: false, ...s }),
      };
      players.push(entry);
      const player: VoiceNotePlayer = {
        play: () => entry.calls.push('play'),
        pause: () => entry.calls.push('pause'),
        seekTo: async () => undefined,
        release: () => {
          entry.released = true;
        },
      };
      return player;
    },
  };
  const foreground = createManualForegroundSignal(inFront ? 'ACTIVE' : 'INACTIVE');
  const exchanges: (ConversationExchangeView | null)[] = [];
  const timers: { callback: () => void; ms: number; live: boolean }[] = [];
  const replies = createVoiceReplies({
    api, player: port, authorization: () => ({ Authorization: 'Bearer test' }), foreground, isCurrent: () => true,
    onExchange: (_turn, exchange) => exchanges.push(exchange),
    setTimer: (callback, ms) => {
      const t = { callback, ms, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (handle) => {
      (handle as { live: boolean }).live = false;
    },
  });
  const flush = async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  };
  /** Answers the waiting long-poll (or queues the answer for the next read). */
  const answer = async (read: VoiceLiveReplyRead) => {
    const next = waiting.shift();
    if (next) next(read);
    else reads.push(read);
    await flush();
  };
  const item = () => replies.getState().replies[TURN];
  return { replies, players, foreground, exchanges, cancels, timers, flush, answer, item };
}

describe('S8B-04 CP2 — the automatic voice reply', () => {
  it('speaks by itself on start, with the bearer in a header; text arrives by the long-poll; the answer is handed over once', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    await h.flush();
    expect(h.players).toHaveLength(1);
    expect(h.players[0]!.url).toBe(`https://api.test/voice/live-replies/${REPLY}/audio`);
    expect(h.players[0]!.headers).toEqual({ Authorization: 'Bearer test' });
    expect(h.players[0]!.calls).toEqual(['play']);
    expect(h.item()!.phase).toBe('PREPARING');
    h.players[0]!.report({ playing: true, positionMs: 100 });
    expect(h.item()!.phase).toBe('PLAYING');
    await h.answer(status({ text: 'طبخت الأرز.' }));
    expect(h.item()!.text).toBe('طبخت الأرز.');
    await h.answer(status({ state: 'COMPLETE', text: 'طبخت الأرز. وبعدين أكلنا.', finalDurationMs: 2400, exchange: ANSWER }));
    expect(h.item()!.text).toBe('طبخت الأرز. وبعدين أكلنا.');
    expect(h.item()!.final).toBe(true);
    expect(h.exchanges).toEqual([ANSWER]);
  });

  it('stops itself at the announced length (a stream of unknown length never ends by itself), then offers replay from the store', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    await h.flush();
    h.players[0]!.report({ playing: true, positionMs: 500 });
    await h.answer(status({ state: 'COMPLETE', finalDurationMs: 2400, exchange: ANSWER }));
    h.players[0]!.report({ playing: true, positionMs: 2100 });
    expect(h.item()!.phase).toBe('PLAYING');
    h.players[0]!.report({ playing: true, positionMs: 2380 });
    expect(h.item()!.phase).toBe('ENDED');
    expect(h.players[0]!.released).toBe(true);
    await h.replies.toggle(TURN);
    expect(h.players).toHaveLength(2); // replay: the same route again (the stored audio, no provider work)
    expect(h.item()!.phase).toBe('PREPARING');
  });

  it('pause and resume act on the one player', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    await h.flush();
    h.players[0]!.report({ playing: true, positionMs: 300 });
    await h.replies.toggle(TURN);
    expect(h.item()!.phase).toBe('PAUSED');
    await h.replies.toggle(TURN);
    expect(h.item()!.phase).toBe('PLAYING');
    expect(h.players).toHaveLength(1);
    expect(h.players[0]!.calls).toEqual(['play', 'pause', 'play']);
  });

  it('not in front of the reader: nothing plays by itself (and nothing old ever does: only replies started here are held)', async () => {
    const h = harness({ inFront: false });
    h.replies.start(TURN, REPLY);
    await h.flush();
    expect(h.players).toHaveLength(0);
    expect(h.item()!.phase).toBe('PAUSED');
    expect(h.replies.getState().replies['another-turn']).toBeUndefined();
  });

  it('quiet pauses and stops synthesis of a reply still produced, once; never after its end', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    await h.flush();
    h.players[0]!.report({ playing: true, positionMs: 300 });
    h.replies.quiet();
    h.replies.quiet();
    await h.flush();
    expect(h.item()!.phase).toBe('PAUSED');
    expect(h.cancels).toEqual([REPLY]);
    const done = harness();
    done.replies.start(TURN, REPLY);
    await done.flush();
    await done.answer(status({ state: 'COMPLETE', finalDurationMs: 900, exchange: ANSWER }));
    done.replies.quiet();
    await done.flush();
    expect(done.cancels).toEqual([]);
  });

  it('the app leaving the foreground quiets it', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    await h.flush();
    h.players[0]!.report({ playing: true, positionMs: 300 });
    h.foreground.set('INACTIVE');
    await h.flush();
    expect(h.item()!.phase).toBe('PAUSED');
    expect(h.cancels).toEqual([REPLY]);
  });

  it('a player failure, a load timeout or a reply with no audio says FAILED; the text is untouched and replay is offered', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    await h.flush();
    await h.answer(status({ text: 'نص الرد' }));
    h.players[0]!.report({ failed: true });
    expect(h.item()).toMatchObject({ phase: 'FAILED', text: 'نص الرد' });
    await h.replies.toggle(TURN);
    expect(h.players).toHaveLength(2);
    // The load timeout.
    h.timers.filter((t) => t.live && t.ms === VOICE_REPLY_LOAD_TIMEOUT_MS).forEach((t) => t.callback());
    expect(h.item()!.phase).toBe('FAILED');
    const silent = harness();
    silent.replies.start(TURN, REPLY);
    await silent.flush();
    await silent.answer(status({ state: 'FAILED', finalDurationMs: 0, exchange: null }));
    expect(silent.item()!.phase).toBe('FAILED');
    expect(silent.exchanges).toEqual([null]);
  });

  it('an expired or unknown reply is GONE: no control acts, and no answer is invented', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    await h.flush();
    await h.answer({ kind: 'NOT_FOUND' });
    expect(h.item()!.phase).toBe('GONE');
    expect(h.exchanges).toEqual([]);
    await h.replies.toggle(TURN);
    expect(h.players).toHaveLength(1);
  });

  it('a replay that fails after the store period says GONE (one status read); a passing failure stays FAILED', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    await h.flush();
    await h.answer(status({ state: 'COMPLETE', text: 'نص الرد', finalDurationMs: 2400, exchange: ANSWER }));
    h.players[0]!.report({ playing: true, positionMs: 2380 });
    expect(h.item()!.phase).toBe('ENDED');
    // Replay; the store answers no more.
    await h.replies.toggle(TURN);
    h.players[1]!.report({ failed: true });
    expect(h.item()!.phase).toBe('FAILED');
    await h.answer({ kind: 'NOT_FOUND' });
    expect(h.item()).toMatchObject({ phase: 'GONE', text: 'نص الرد' });
    await h.replies.toggle(TURN);
    expect(h.players).toHaveLength(2);
    // A failure while the reply is still stored stays FAILED (try again later).
    const passing = harness();
    passing.replies.start(TURN, REPLY);
    await passing.flush();
    await passing.answer(status({ state: 'COMPLETE', finalDurationMs: 2400, exchange: ANSWER }));
    passing.players[0]!.report({ failed: true });
    await passing.answer(status({ state: 'COMPLETE', finalDurationMs: 2400 }));
    expect(passing.item()!.phase).toBe('FAILED');
  });

  it('a second start of the same turn starts nothing (one reply, one stream)', async () => {
    const h = harness();
    h.replies.start(TURN, REPLY);
    h.replies.start(TURN, REPLY);
    await h.flush();
    expect(h.players).toHaveLength(1);
  });
});
