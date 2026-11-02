/**
 * S8B-03 (CP2, decisions D3 / D4) — the journeys of a Voice Note in one Session, against a scripted server:
 *
 *   Record → Draft → Send → ACCEPTED → PROCESSING → READY → Commit → the conversation merges ONE exchange;
 *   a lost upload answer → the draft stays → Try again reuses the SAME command id → one recording;
 *   UNAVAILABLE → the command id is rotated; a restart restores drafts and pending notes WITHOUT uploading;
 *   a failed transcription → Try again → READY → one turn; consent withdrawn → held, the recording kept.
 */
import { createManualForegroundSignal, type ConversationExchangeView } from '../../runtime-entry';
import type { VoiceNoteApiClient, VoiceNoteServerStatus, VoiceNoteUploadResult } from '../voice-note-api';
import { createVoiceNotesController, VOICE_NOTE_POLL_DELAYS_MS, VOICE_NOTE_UPLOAD_TIMEOUT_MS } from '../voice-note-controller';
import { createEphemeralVoiceDraftKeyValue, createVoiceDraftStore, type VoiceDraftFiles, type VoiceDraftRecord } from '../voice-draft-store';

jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: jest.fn() }));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));

const OWNER = 'a0000000-0000-4000-8000-000000000001';
const SESSION = 'c0000000-0000-4000-8000-000000000003';
const OTHER_SESSION = 'c0000000-0000-4000-8000-000000000004';
const REC = '0e000000-0000-4000-8000-000000000001';

const exchange = (turnId: string): ConversationExchangeView => ({
  userTurn: { id: turnId, content: 'نص', idempotencyKey: `voice-note:${REC}`, createdAt: '2026-10-31T10:00:00.000Z' },
  replyState: 'COMPLETED',
} as unknown as ConversationExchangeView);

/** A scripted voice server: uploads by command id (a replay answers the same recording), statuses by script. */
function server() {
  const s = {
    uploads: [] as { commandId: string; bytes: number }[],
    recordings: new Map<string, string>(),
    uploadScript: [] as (VoiceNoteUploadResult['kind'] | 'LOST')[],
    statuses: [] as (VoiceNoteServerStatus | 'NOT_FOUND' | 'UNAVAILABLE')[],
    canRetry: false,
    commits: 0,
    commitScript: [] as ('COMMITTED' | 'CONFLICT' | 'CONSENT_REQUIRED')[],
    retries: 0,
    pending: [] as { recordingId: string; status: VoiceNoteServerStatus }[],
    lastSignal: null as AbortSignal | null,
  };
  const api: Pick<VoiceNoteApiClient, 'upload' | 'status' | 'pending' | 'retry' | 'commitTurn' | 'deleteRecording'> = {
    upload: async (_session, commandId, bytes, signal) => {
      s.lastSignal = signal;
      const next = s.uploadScript.shift() ?? 'ACCEPTED';
      if (next === 'ACCEPTED' || next === 'LOST') {
        s.uploads.push({ commandId, bytes: bytes.length });
        if (!s.recordings.has(commandId)) s.recordings.set(commandId, REC);
        // LOST: the server stored it, but the answer never arrived.
        return next === 'LOST' ? { kind: 'UNKNOWN' } : { kind: 'ACCEPTED', recordingId: s.recordings.get(commandId)!, acceptedAt: null, availableUntil: '2026-11-30T10:00:00.000Z', transcriptReady: false };
      }
      return { kind: next } as VoiceNoteUploadResult;
    },
    status: async (recordingId) => {
      const next = s.statuses.length > 1 ? s.statuses.shift()! : s.statuses[0] ?? 'PROCESSING';
      if (next === 'NOT_FOUND') return { kind: 'NOT_FOUND' };
      if (next === 'UNAVAILABLE') return { kind: 'UNAVAILABLE' };
      return { kind: 'STATUS', view: { recordingId, sessionId: SESSION, status: next, failure: null, canRetry: s.canRetry, turnId: null, recordingAvailable: true, availableUntil: null, durationMs: 4000 } };
    },
    pending: async () => ({ kind: 'NOTES', notes: s.pending.map((n) => ({ ...n, availableUntil: null, durationMs: 4000 })) }),
    retry: async () => {
      s.retries += 1;
      return 'RETRY_SCHEDULED';
    },
    commitTurn: async () => {
      s.commits += 1;
      const next = s.commitScript.shift() ?? 'COMMITTED';
      if (next === 'COMMITTED') return { kind: 'COMMITTED', exchange: exchange('turn-1') };
      return { kind: next };
    },
    deleteRecording: async () => 'DELETED',
  };
  return { s, api };
}

function harness() {
  const srv = server();
  const disk = new Map<string, number>();
  const files: VoiceDraftFiles = {
    adopt: async (_o, draftId) => {
      disk.set(draftId, 3000);
      return 3000;
    },
    size: (_o, draftId) => disk.get(draftId) ?? null,
    check: (_o, draftId) => (disk.has(draftId) ? 'COMPLETE' : 'INCOMPLETE'),
    checkUri: () => 'COMPLETE',
    read: (_o, draftId) => {
      if (!disk.has(draftId)) throw new Error('gone');
      return new Uint8Array(disk.get(draftId)!);
    },
    remove: (_o, draftId) => {
      disk.delete(draftId);
    },
    removeUri: () => undefined,
    removeOwner: () => undefined,
  };
  const storage = createEphemeralVoiceDraftKeyValue();
  const store = createVoiceDraftStore(storage, files);
  const foreground = createManualForegroundSignal('ACTIVE');
  const timers: { callback: () => void; ms: number; live: boolean }[] = [];
  const committed: { exchange: ConversationExchangeView; sessionId: string }[] = [];
  let ids = 100;
  const make = () => createVoiceNotesController({
    owner: OWNER, sessionId: SESSION, api: srv.api, store, files, foreground, isCurrent: () => true,
    onCommitted: (e, sessionId) => committed.push({ exchange: e, sessionId }),
    newId: () => `cmd-rotated-${(ids += 1)}`,
    setTimer: (callback, ms) => {
      const t = { callback, ms, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (handle) => {
      (handle as { live: boolean }).live = false;
    },
  });
  /** Fire every live poll timer once (not the upload timeout). */
  const flush = async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  };
  const tick = async () => {
    const due = timers.filter((t) => t.live && t.ms !== VOICE_NOTE_UPLOAD_TIMEOUT_MS);
    for (const t of due) {
      t.live = false;
      t.callback();
    }
    await flush();
  };
  const saved = async (draftId: string): Promise<VoiceDraftRecord> => {
    await store.begin(OWNER, { draftId, sessionId: SESSION, commandId: `cmd-${draftId}`, state: 'RECORDING', recorderUri: `file:///Audio/${draftId}.m4a`, durationMs: null, bytes: null, stoppedBy: null, createdAt: '2026-10-31T10:00:00.000Z' });
    return (await store.finish(OWNER, draftId, 4000, 'USER'))!;
  };
  return { srv, store, disk, foreground, timers, committed, make, tick, flush, saved, storage };
}

describe('voice notes controller', () => {
  it('Record → Draft → Send → ACCEPTED → PROCESSING → READY → Commit → ONE exchange in the conversation', async () => {
    const h = harness();
    const c = h.make();
    const draft = await h.saved('d1');
    c.addDraft(draft);
    expect(c.getState().items).toEqual([{ kind: 'DRAFT', draft, phase: 'READY_TO_SEND' }]);
    h.srv.s.statuses = ['PROCESSING', 'PROCESSING', 'READY'];
    await c.send('d1');
    expect(h.srv.s.uploads).toEqual([{ commandId: 'cmd-d1', bytes: 3000 }]);
    // ACCEPTED means stored: the draft and its file are gone, the note is processing.
    expect(h.disk.has('d1')).toBe(false);
    expect(c.getState().items).toEqual([expect.objectContaining({ kind: 'NOTE', recordingId: REC, phase: 'PROCESSING' })]);
    expect(h.timers.find((t) => t.live)?.ms).toBe(VOICE_NOTE_POLL_DELAYS_MS[0]);
    await h.tick();
    await h.tick();
    expect(h.committed).toHaveLength(0);
    await h.tick();
    expect(h.committed).toEqual([{ exchange: { ...exchange('turn-1'), voiceNote: expect.objectContaining({ recordingId: REC, available: true }) }, sessionId: SESSION }]);
    expect(c.getState().items).toEqual([]);
    expect((await h.store.list(OWNER)).accepted).toEqual([]);
    // Nothing keeps polling once the note is a turn.
    await h.tick();
    expect(h.srv.s.commits).toBe(1);
  });

  it('a lost upload answer keeps the draft; Try again is the SAME upload, and the server answers ONE recording', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.uploadScript = ['LOST', 'ACCEPTED'];
    h.srv.s.statuses = ['READY'];
    await c.send('d1');
    expect(c.getState().items).toEqual([expect.objectContaining({ kind: 'DRAFT', phase: 'NOT_SENT' })]);
    expect(h.disk.has('d1')).toBe(true);
    await c.send('d1');
    expect(h.srv.s.uploads.map((u) => u.commandId)).toEqual(['cmd-d1', 'cmd-d1']);
    expect(new Set(h.srv.s.recordings.values())).toEqual(new Set([REC]));
    await h.tick();
    expect(h.committed).toHaveLength(1);
  });

  it('UNAVAILABLE rotates the command id (kept with the draft); the next Send is a new upload', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.uploadScript = ['UNAVAILABLE', 'ACCEPTED'];
    await c.send('d1');
    expect(c.getState().items).toEqual([expect.objectContaining({ kind: 'DRAFT', phase: 'NOT_SENT' })]);
    const kept = (await h.store.list(OWNER)).drafts[0];
    expect(kept.commandId).toBe('cmd-rotated-101');
    await c.send('d1');
    expect(h.srv.s.uploads.map((u) => u.commandId)).toEqual(['cmd-rotated-101']);
  });

  it('a closed gate, a missing consent and a refused file each keep the draft with their own phase', async () => {
    for (const [kind, phase] of [['NOT_AVAILABLE_NOW', 'GATE_CLOSED'], ['CONSENT_REQUIRED', 'CONSENT_REQUIRED'], ['REFUSED', 'REFUSED']] as const) {
      const h = harness();
      const c = h.make();
      c.addDraft(await h.saved('d1'));
      h.srv.s.uploadScript = [kind];
      await c.send('d1');
      expect(c.getState().items).toEqual([expect.objectContaining({ kind: 'DRAFT', phase })]);
      expect(h.disk.has('d1')).toBe(true);
    }
  });

  it('a refused draft is not sent again', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.uploadScript = ['REFUSED'];
    await c.send('d1');
    await c.send('d1');
    expect(h.srv.s.uploads).toHaveLength(0);
  });

  it('the upload is bounded by an abort signal', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    await c.send('d1');
    expect(h.srv.s.lastSignal).not.toBeNull();
    expect(h.timers.some((t) => t.ms === VOICE_NOTE_UPLOAD_TIMEOUT_MS)).toBe(true);
  });

  it('a restart restores the draft and the accepted note WITHOUT uploading, and commits the note once', async () => {
    const h = harness();
    const first = h.make();
    first.addDraft(await h.saved('d1'));
    first.addDraft(await h.saved('d2'));
    h.srv.s.statuses = ['PROCESSING'];
    await first.send('d1');
    first.retire();

    const uploadsBefore = h.srv.s.uploads.length;
    h.srv.s.statuses = ['READY'];
    h.srv.s.pending = [{ recordingId: REC, status: 'READY' }];
    const second = h.make();
    await second.restore();
    expect(h.srv.s.uploads.length).toBe(uploadsBefore);
    expect(second.getState().items).toEqual([
      expect.objectContaining({ kind: 'DRAFT', phase: 'READY_TO_SEND', draft: expect.objectContaining({ draftId: 'd2' }) }),
      expect.objectContaining({ kind: 'NOTE', recordingId: REC, phase: 'PROCESSING' }),
    ]);
    await h.tick();
    expect(h.committed).toHaveLength(1);
    expect(h.srv.s.commits).toBe(1);
  });

  it('restores a note known only to the server (pending), and ignores drafts of another Session', async () => {
    const h = harness();
    await h.store.begin(OWNER, { draftId: 'x', sessionId: OTHER_SESSION, commandId: 'cmd-x', state: 'RECORDING', recorderUri: 'file:///Audio/x.m4a', durationMs: null, bytes: null, stoppedBy: null, createdAt: '2026-10-31T10:00:00.000Z' });
    await h.store.finish(OWNER, 'x', 1000, 'USER');
    h.srv.s.pending = [{ recordingId: REC, status: 'FAILED_RETRYABLE' }];
    h.srv.s.statuses = ['FAILED_RETRYABLE'];
    h.srv.s.canRetry = true;
    const c = h.make();
    await c.restore();
    await h.tick();
    expect(c.getState().items).toEqual([expect.objectContaining({ kind: 'NOTE', phase: 'RETRYABLE', canRetry: true })]);
  });

  it('a failed transcription → Try again → READY → one turn', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.statuses = ['FAILED_RETRYABLE'];
    h.srv.s.canRetry = true;
    await c.send('d1');
    await h.tick();
    expect(c.getState().items).toEqual([expect.objectContaining({ phase: 'RETRYABLE', canRetry: true })]);
    // Terminal for now: no more reads until the reader asks.
    expect(h.timers.filter((t) => t.live && t.ms !== VOICE_NOTE_UPLOAD_TIMEOUT_MS)).toHaveLength(0);
    h.srv.s.statuses = ['PROCESSING', 'READY'];
    await c.retryNote(REC);
    expect(h.srv.s.retries).toBe(1);
    expect(c.getState().items).toEqual([expect.objectContaining({ phase: 'PROCESSING' })]);
    await h.tick();
    await h.tick();
    expect(h.committed).toHaveLength(1);
  });

  it('a note that cannot be retried is not retried', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.statuses = ['FAILED_FINAL'];
    await c.send('d1');
    await h.tick();
    expect(c.getState().items).toEqual([expect.objectContaining({ phase: 'FINAL', canRetry: false })]);
    await c.retryNote(REC);
    expect(h.srv.s.retries).toBe(0);
  });

  it('consent withdrawn: the note is held (C-33), no turn, the recording stays listed', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.statuses = ['HELD_CONSENT'];
    await c.send('d1');
    await h.tick();
    expect(c.getState().items).toEqual([expect.objectContaining({ kind: 'NOTE', phase: 'HELD_CONSENT' })]);
    expect(h.committed).toHaveLength(0);
    // A commit racing the withdrawal is answered CONSENT_REQUIRED: nothing committed, the note held.
    const h2 = harness();
    const c2 = h2.make();
    c2.addDraft(await h2.saved('d1'));
    h2.srv.s.statuses = ['READY'];
    h2.srv.s.commitScript = ['CONSENT_REQUIRED'];
    await c2.send('d1');
    await h2.tick();
    expect(h2.committed).toHaveLength(0);
    expect(c2.getState().items).toEqual([expect.objectContaining({ kind: 'NOTE', phase: 'HELD_CONSENT' })]);
  });

  it('NO_SPEECH is shown (C-30); a note gone from the server (NOT_FOUND / CANCELLED) leaves the list', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.statuses = ['NO_SPEECH'];
    await c.send('d1');
    await h.tick();
    expect(c.getState().items).toEqual([expect.objectContaining({ phase: 'NO_SPEECH' })]);
    await c.forgetNote(REC);
    expect(c.getState().items).toEqual([]);

    const g = harness();
    const d = g.make();
    d.addDraft(await g.saved('d1'));
    g.srv.s.statuses = ['NOT_FOUND'];
    await d.send('d1');
    await g.tick();
    expect(d.getState().items).toEqual([]);
  });

  it('a racing commit (CONFLICT) is read again, never committed twice', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.statuses = ['READY'];
    h.srv.s.commitScript = ['CONFLICT', 'COMMITTED'];
    await c.send('d1');
    await h.tick();
    expect(h.committed).toHaveLength(0);
    await h.tick();
    expect(h.committed).toHaveLength(1);
  });

  it('polling pauses while the app is not in front of the reader and resumes on return', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.statuses = ['PROCESSING'];
    await c.send('d1');
    // The first timer was armed while active; it fires, reads, and cannot re-arm in the background.
    h.foreground.set('INACTIVE');
    await h.tick();
    expect(h.timers.filter((t) => t.live && t.ms !== VOICE_NOTE_UPLOAD_TIMEOUT_MS)).toHaveLength(0);
    h.foreground.set('ACTIVE');
    expect(h.timers.filter((t) => t.live && t.ms !== VOICE_NOTE_UPLOAD_TIMEOUT_MS)).toHaveLength(1);
  });

  it('a draft is deleted only by the reader, never while sending', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    await c.deleteDraft('d1');
    expect(h.disk.has('d1')).toBe(false);
    expect(c.getState().items).toEqual([]);
    expect((await h.store.list(OWNER)).drafts).toEqual([]);
  });

  it('a restart reports a draft that could not be restored (C-23) until dismissed', async () => {
    const h = harness();
    await h.store.begin(OWNER, { draftId: 'cut', sessionId: SESSION, commandId: 'cmd-cut', state: 'RECORDING', recorderUri: 'file:///Audio/cut.m4a', durationMs: null, bytes: null, stoppedBy: null, createdAt: '2026-10-31T10:00:00.000Z' });
    // The recorder file is "complete" in this fake, so damage the adopted file instead: a SAVED draft with no file.
    await h.store.finish(OWNER, 'cut', 1000, 'USER');
    h.disk.delete('cut');
    const c = h.make();
    await c.restore();
    expect(c.getState().unrecoverable).toBe(true);
    c.dismissNotice();
    expect(c.getState().unrecoverable).toBe(false);
  });

  it('after retire nothing is polled or committed', async () => {
    const h = harness();
    const c = h.make();
    c.addDraft(await h.saved('d1'));
    h.srv.s.statuses = ['READY'];
    await c.send('d1');
    c.retire();
    await h.tick();
    expect(h.committed).toHaveLength(0);
  });
});
