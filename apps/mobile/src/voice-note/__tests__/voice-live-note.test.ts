/**
 * S8B-04 (CP2, D-S1) — the live note beside a recording, against a scripted server and a scripted PCM stream:
 * chunks in order exactly once after the open; Send names it only when every chunk was taken; a refused open, a refused
 * chunk or another sample rate makes it unusable (and nothing more is sent); cancel discards it.
 */
import type { VoiceNoteApiClient } from '../voice-note-api';
import { createVoiceLiveNotes, LIVE_NOTE_CHUNK_BYTES, type VoicePcmStreamPort } from '../voice-live-note';

const SESSION = 'c0000000-0000-4000-8000-000000000003';

function harness({ open = 'OPENED' as 'OPENED' | 'NOT_OPENED', accept = (_seq: number): boolean => true } = {}) {
  const sent: { seq: number; bytes: number }[] = [];
  const cancelled: string[] = [];
  const opened: string[] = [];
  const api: Pick<VoiceNoteApiClient, 'openLiveNote' | 'appendLiveNote' | 'cancelLiveNote'> = {
    openLiveNote: async (_session, liveId) => {
      opened.push(liveId);
      return open;
    },
    appendLiveNote: async (_liveId, seq, chunk) => {
      sent.push({ seq, bytes: chunk.length });
      return accept(seq);
    },
    cancelLiveNote: async (liveId) => {
      cancelled.push(liveId);
    },
  };
  let emit: ((pcm: Uint8Array, rate: number) => void) | null = null;
  let stopped = 0;
  const stream: VoicePcmStreamPort = {
    async start(onBuffer) {
      emit = onBuffer;
      return () => {
        stopped += 1;
      };
    },
  };
  const notes = createVoiceLiveNotes({ api, stream, newId: () => 'live-1' });
  const flush = async () => {
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
  };
  const say = (bytes: number, rate = 16000) => emit?.(new Uint8Array(bytes), rate);
  return { notes, sent, cancelled, opened, flush, say, stopped: () => stopped };
}

describe('S8B-04 CP2 — the live note', () => {
  it('sends chunks in order, each once, after the open; Send names it with the chunk count', async () => {
    const h = harness();
    await h.notes.begin(SESSION);
    h.say(LIVE_NOTE_CHUNK_BYTES);
    h.say(LIVE_NOTE_CHUNK_BYTES);
    h.say(1000);
    await h.flush();
    const ref = await h.notes.finish();
    expect(h.opened).toEqual(['live-1']);
    expect(h.sent).toEqual([{ seq: 0, bytes: LIVE_NOTE_CHUNK_BYTES }, { seq: 1, bytes: LIVE_NOTE_CHUNK_BYTES }, { seq: 2, bytes: 1000 }]);
    expect(ref).toEqual({ liveId: 'live-1', chunks: 3 });
    expect(h.stopped()).toBe(1);
    expect(h.cancelled).toEqual([]);
  });

  it('a refused open (no current consent, the gate, no realtime route): nothing is ever sent and Send names nothing', async () => {
    const h = harness({ open: 'NOT_OPENED' });
    await h.notes.begin(SESSION);
    h.say(LIVE_NOTE_CHUNK_BYTES);
    await h.flush();
    expect(await h.notes.finish()).toBeUndefined();
    expect(h.sent).toEqual([]);
  });

  it('a refused chunk makes it unusable: nothing after it is sent, it is discarded, and Send names nothing', async () => {
    const h = harness({ accept: (seq) => seq !== 0 });
    await h.notes.begin(SESSION);
    h.say(LIVE_NOTE_CHUNK_BYTES);
    await h.flush();
    h.say(LIVE_NOTE_CHUNK_BYTES);
    await h.flush();
    expect(await h.notes.finish()).toBeUndefined();
    expect(h.sent.map((c) => c.seq)).toEqual([0]);
    await h.flush();
    expect(h.cancelled).toEqual(['live-1']);
  });

  it('another sample rate is never sent (no resampling): discarded', async () => {
    const h = harness();
    await h.notes.begin(SESSION);
    h.say(LIVE_NOTE_CHUNK_BYTES, 48000);
    await h.flush();
    expect(await h.notes.finish()).toBeUndefined();
    expect(h.sent).toEqual([]);
  });

  it('cancel discards it on the server and stops the stream', async () => {
    const h = harness();
    await h.notes.begin(SESSION);
    h.say(LIVE_NOTE_CHUNK_BYTES);
    await h.flush();
    h.notes.cancel();
    await h.flush();
    expect(h.cancelled).toEqual(['live-1']);
    expect(h.stopped()).toBe(1);
    expect(await h.notes.finish()).toBeUndefined();
  });

  it('no PCM stream on this device: nothing opens', async () => {
    const notes = createVoiceLiveNotes({
      api: { openLiveNote: jest.fn(), appendLiveNote: jest.fn(), cancelLiveNote: jest.fn() }, stream: null, newId: () => 'x',
    });
    await notes.begin(SESSION);
    expect(await notes.finish()).toBeUndefined();
  });
});
