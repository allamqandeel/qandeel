/**
 * S8B-04 (CP2) — the controller's automatic voice reply: a note SENT here is committed with `?auto=1` (at once when its
 * live transcript stood, after the status reads otherwise) and its REPLYING answer is handed to `onReplying`; a note
 * found again by restoring is committed text only, so nothing old speaks; the upload names the live note it was given.
 */
import { createManualForegroundSignal, type ConversationExchangeView } from '../../runtime-entry';
import type { VoiceLiveNoteRef, VoiceNoteApiClient } from '../voice-note-api';
import { createVoiceNotesController, VOICE_NOTE_UPLOAD_TIMEOUT_MS } from '../voice-note-controller';
import { createEphemeralVoiceDraftKeyValue, createVoiceDraftStore, type VoiceDraftFiles } from '../voice-draft-store';

jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: jest.fn() }));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));

const OWNER = 'a0000000-0000-4000-8000-000000000001';
const SESSION = 'c0000000-0000-4000-8000-000000000003';
const REC = '0e000000-0000-4000-8000-000000000001';
const TURN = '7e000000-0000-4000-8000-000000000001';
const REPLY = 'fe000000-0000-4000-8000-000000000001';

function harness({ transcriptReady = false, pending = [] as { recordingId: string; status: 'READY' }[] } = {}) {
  const uploads: (VoiceLiveNoteRef | undefined)[] = [];
  const commits: { recordingId: string; automatic: boolean }[] = [];
  const api: Pick<VoiceNoteApiClient, 'upload' | 'status' | 'pending' | 'retry' | 'commitTurn' | 'deleteRecording'> = {
    upload: async (_s, _c, _b, _signal, live) => {
      uploads.push(live);
      return { kind: 'ACCEPTED', recordingId: REC, acceptedAt: null, availableUntil: '2026-12-01T10:00:00.000Z', transcriptReady };
    },
    status: async (recordingId) => ({
      kind: 'STATUS',
      view: { recordingId, sessionId: SESSION, status: 'READY', failure: null, canRetry: false, turnId: null, recordingAvailable: true, availableUntil: null, durationMs: 4000 },
    }),
    pending: async () => ({ kind: 'NOTES', notes: pending.map((n) => ({ ...n, availableUntil: null, durationMs: 4000 })) }),
    retry: async () => 'RETRY_SCHEDULED',
    commitTurn: async (recordingId, automatic = false) => {
      commits.push({ recordingId, automatic });
      return automatic
        ? { kind: 'REPLYING', turnId: TURN, replyId: REPLY }
        : { kind: 'COMMITTED', exchange: { userTurn: { id: TURN, content: 'نص', idempotencyKey: null, createdAt: '2026-11-02T10:00:00.000Z' }, replyState: 'COMPLETED', reply: null } as unknown as ConversationExchangeView };
    },
    deleteRecording: async () => 'DELETED',
  };
  const disk = new Map<string, number>();
  const files: VoiceDraftFiles = {
    adopt: async (_o, id) => {
      disk.set(id, 3000);
      return 3000;
    },
    size: (_o, id) => disk.get(id) ?? null,
    check: (_o, id) => (disk.has(id) ? 'COMPLETE' : 'INCOMPLETE'),
    checkUri: () => 'COMPLETE',
    read: (_o, id) => new Uint8Array(disk.get(id) ?? 3000),
    remove: (_o, id) => {
      disk.delete(id);
    },
    removeUri: () => undefined,
    removeOwner: () => undefined,
  };
  const store = createVoiceDraftStore(createEphemeralVoiceDraftKeyValue(), files);
  const timers: { callback: () => void; ms: number; live: boolean }[] = [];
  const replying: { recordingId: string; turnId: string; replyId: string }[] = [];
  const committed: ConversationExchangeView[] = [];
  const controller = createVoiceNotesController({
    owner: OWNER, sessionId: SESSION, api, store, files, foreground: createManualForegroundSignal('ACTIVE'), isCurrent: () => true,
    onCommitted: (e) => committed.push(e),
    onReplying: ({ recordingId, turnId, replyId }) => replying.push({ recordingId, turnId, replyId }),
    newId: () => 'cmd-new',
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
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
  };
  const tick = async () => {
    for (const t of timers.filter((x) => x.live && x.ms !== VOICE_NOTE_UPLOAD_TIMEOUT_MS)) {
      t.live = false;
      t.callback();
    }
    await flush();
  };
  const draft = async () => {
    await store.begin(OWNER, { draftId: 'd1', sessionId: SESSION, commandId: 'cmd-d1', state: 'RECORDING', recorderUri: 'file:///Audio/d1.m4a', durationMs: null, bytes: null, stoppedBy: null, createdAt: '2026-11-02T10:00:00.000Z' });
    const saved = (await store.finish(OWNER, 'd1', 4000, 'USER'))!;
    controller.addDraft(saved);
  };
  return { controller, uploads, commits, replying, committed, flush, tick, draft };
}

describe('S8B-04 CP2 — the automatic voice reply in the controller', () => {
  it('a live transcript that stood: committed at once with ?auto=1, no status read; REPLYING handed over', async () => {
    const h = harness({ transcriptReady: true });
    await h.draft();
    await h.controller.send('d1', { liveId: 'live-1', chunks: 12 });
    await h.flush();
    expect(h.uploads).toEqual([{ liveId: 'live-1', chunks: 12 }]);
    expect(h.commits).toEqual([{ recordingId: REC, automatic: true }]);
    expect(h.replying).toEqual([{ recordingId: REC, turnId: TURN, replyId: REPLY }]);
    expect(h.controller.getState().items).toEqual([]);
  });

  it('no live transcript: the status reads first, then the commit with ?auto=1', async () => {
    const h = harness();
    await h.draft();
    await h.controller.send('d1');
    expect(h.uploads).toEqual([undefined]);
    expect(h.commits).toEqual([]);
    await h.tick();
    expect(h.commits).toEqual([{ recordingId: REC, automatic: true }]);
    expect(h.replying).toHaveLength(1);
  });

  it('a note found again by restoring is committed text only: nothing old speaks by itself', async () => {
    const h = harness({ pending: [{ recordingId: REC, status: 'READY' }] });
    await h.controller.restore();
    await h.tick();
    expect(h.commits).toEqual([{ recordingId: REC, automatic: false }]);
    expect(h.replying).toEqual([]);
    expect(h.committed).toHaveLength(1);
  });
});
