/**
 * S8B-03 (CP2, OD-6, decision D3) — the drafts of one account on this device: they survive a restart and a sign-out,
 * are invisible to another account, are deleted only after a CONFIRMED acceptance, a cancel or account deletion, and a
 * capture cut off by the process dying is recovered only when its file is a finished M4A (else C-23). Nothing here
 * uploads.
 */
import type { DraftFileCheck } from '../m4a-draft-check';
import {
  createEphemeralVoiceDraftKeyValue,
  createVoiceDraftStore,
  voiceDraftKeyFor,
  VOICE_DRAFTS_KEY_PREFIX,
  type VoiceDraftFiles,
  type VoiceDraftKeyValue,
  type VoiceDraftRecord,
} from '../voice-draft-store';

jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: jest.fn() }));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const SESSION = 'c0000000-0000-4000-8000-000000000003';

/** A fake disk: recorder files by URI, drafts by owner/draftId, each with a container verdict. */
function fakeFiles() {
  const recorder = new Map<string, DraftFileCheck>();
  const drafts = new Map<string, { bytes: number; check: DraftFileCheck }>();
  const key = (owner: string, draftId: string) => `${owner}/${draftId}`;
  const files: VoiceDraftFiles = {
    adopt: async (owner, draftId, uri) => {
      const verdict = recorder.get(uri);
      if (verdict === undefined) throw new Error('recording missing');
      recorder.delete(uri);
      drafts.set(key(owner, draftId), { bytes: 4096, check: verdict });
      return 4096;
    },
    size: (owner, draftId) => drafts.get(key(owner, draftId))?.bytes ?? null,
    check: (owner, draftId) => drafts.get(key(owner, draftId))?.check ?? 'INCOMPLETE',
    checkUri: (uri) => recorder.get(uri) ?? 'INCOMPLETE',
    read: () => new Uint8Array(4096),
    remove: (owner, draftId) => {
      drafts.delete(key(owner, draftId));
    },
    removeUri: (uri) => {
      recorder.delete(uri);
    },
    removeOwner: (owner) => {
      for (const k of Array.from(drafts.keys())) if (k.startsWith(`${owner}/`)) drafts.delete(k);
    },
  };
  return { files, recorder, drafts };
}

const recording = (draftId: string, uri = `file:///docs/Audio/${draftId}.m4a`): VoiceDraftRecord => ({
  draftId, sessionId: SESSION, commandId: `cmd-${draftId}`, state: 'RECORDING', recorderUri: uri,
  durationMs: null, bytes: null, stoppedBy: null, createdAt: '2026-10-31T10:00:00.000Z',
});

describe('voice draft store', () => {
  let storage: VoiceDraftKeyValue;
  let disk: ReturnType<typeof fakeFiles>;
  beforeEach(() => {
    storage = createEphemeralVoiceDraftKeyValue();
    disk = fakeFiles();
  });

  it('a finished capture becomes the owner\'s SAVED draft, and survives a new store over the same storage (restart)', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    await store.begin(A, recording('d1'));
    disk.recorder.set('file:///docs/Audio/d1.m4a', 'COMPLETE');
    const saved = await store.finish(A, 'd1', 4200, 'USER');
    expect(saved).toMatchObject({ state: 'SAVED', recorderUri: null, bytes: 4096, durationMs: 4200, stoppedBy: 'USER', commandId: 'cmd-d1' });
    const restarted = createVoiceDraftStore(storage, disk.files);
    expect((await restarted.list(A)).drafts).toEqual([saved]);
  });

  it('is invisible to another account, and a value that does not name its owner is never shown', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    await store.begin(A, recording('d1'));
    expect((await store.list(B)).drafts).toEqual([]);
    // A value planted under B's key naming A is not B's.
    await storage.setItem(voiceDraftKeyFor(B), JSON.stringify({ owner: A, drafts: [recording('x')], accepted: [] }));
    expect((await store.list(B)).drafts).toEqual([]);
    await storage.setItem(voiceDraftKeyFor(B), '{not json');
    expect((await store.list(B)).drafts).toEqual([]);
    expect(voiceDraftKeyFor(A)).toBe(`${VOICE_DRAFTS_KEY_PREFIX}${A}`);
    expect(() => voiceDraftKeyFor('')).toThrow(RangeError);
  });

  it('records the acceptance BEFORE the file is removed, and keeps the accepted note until it is forgotten', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    await store.begin(A, recording('d1'));
    disk.recorder.set('file:///docs/Audio/d1.m4a', 'COMPLETE');
    await store.finish(A, 'd1', 1000, 'USER');
    const removeSpy = jest.spyOn(disk.files, 'remove').mockImplementationOnce(() => {
      throw new Error('crash after the write');
    });
    await expect(store.accept(A, 'd1', { recordingId: 'r1', sessionId: SESSION, durationMs: 1000, availableUntil: null })).rejects.toThrow();
    // The process "died" after the write: the note is known, the draft is no longer offered as sendable.
    const after = await store.list(A);
    expect(after.drafts).toEqual([]);
    expect(after.accepted.map((n) => n.recordingId)).toEqual(['r1']);
    removeSpy.mockRestore();
    await store.forgetAccepted(A, 'r1');
    expect((await store.list(A)).accepted).toEqual([]);
  });

  it('accept and discard remove the draft file; discard of a RECORDING draft removes the recorder file too', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    await store.begin(A, recording('d1'));
    disk.recorder.set('file:///docs/Audio/d1.m4a', 'COMPLETE');
    await store.finish(A, 'd1', 1000, 'USER');
    await store.accept(A, 'd1', { recordingId: 'r1', sessionId: SESSION, durationMs: 1000, availableUntil: null });
    expect(disk.files.size(A, 'd1')).toBeNull();

    await store.begin(A, recording('d2'));
    disk.recorder.set('file:///docs/Audio/d2.m4a', 'COMPLETE');
    await store.discard(A, 'd2');
    expect(disk.recorder.has('file:///docs/Audio/d2.m4a')).toBe(false);
    expect((await store.list(A)).drafts).toEqual([]);
  });

  it('rotates the command id of one draft only', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    await store.begin(A, recording('d1'));
    await store.begin(A, recording('d2'));
    await store.rotateCommand(A, 'd1', 'cmd-new');
    expect((await store.list(A)).drafts.map((d) => d.commandId)).toEqual(['cmd-new', 'cmd-d2']);
  });

  it('recovers a capture cut off with a FINISHED file as SAVED (LEFT_SCREEN), and reports one without its index', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    await store.begin(A, recording('ok'));
    await store.begin(A, recording('cut'));
    await store.begin(A, recording('gone'));
    disk.recorder.set('file:///docs/Audio/ok.m4a', 'COMPLETE');
    disk.recorder.set('file:///docs/Audio/cut.m4a', 'INCOMPLETE');
    const result = await store.recover(A);
    expect(result).toEqual({ unrecoverable: 2 });
    const { drafts } = await store.list(A);
    expect(drafts).toEqual([expect.objectContaining({ draftId: 'ok', state: 'SAVED', stoppedBy: 'LEFT_SCREEN', bytes: 4096 })]);
    // The broken recorder file is removed, never offered.
    expect(disk.recorder.has('file:///docs/Audio/cut.m4a')).toBe(false);
  });

  it('drops a SAVED draft whose file is gone or damaged, counting it as unrecoverable', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    await store.begin(A, recording('d1'));
    disk.recorder.set('file:///docs/Audio/d1.m4a', 'COMPLETE');
    await store.finish(A, 'd1', 1000, 'USER');
    disk.drafts.get(`${A}/d1`)!.check = 'INCOMPLETE';
    expect(await store.recover(A)).toEqual({ unrecoverable: 1 });
    expect((await store.list(A)).drafts).toEqual([]);
  });

  it('a finish for an unknown or already SAVED draft does nothing', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    expect(await store.finish(A, 'missing', 1, 'USER')).toBeNull();
    await store.begin(A, recording('d1'));
    disk.recorder.set('file:///docs/Audio/d1.m4a', 'COMPLETE');
    await store.finish(A, 'd1', 1, 'USER');
    expect(await store.finish(A, 'd1', 1, 'USER')).toBeNull();
  });

  it('removing an owner (confirmed account deletion) removes that owner only', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    for (const owner of [A, B]) {
      await store.begin(owner, recording(`d-${owner.slice(0, 1)}`));
      disk.recorder.set(`file:///docs/Audio/d-${owner.slice(0, 1)}.m4a`, 'COMPLETE');
      await store.finish(owner, `d-${owner.slice(0, 1)}`, 1, 'USER');
    }
    await store.removeOwner(A);
    expect((await store.list(A)).drafts).toEqual([]);
    expect((await store.list(B)).drafts).toHaveLength(1);
    expect(disk.files.size(B, 'd-b')).toBe(4096);
  });

  it('serializes writes: concurrent begins never lose one another', async () => {
    const store = createVoiceDraftStore(storage, disk.files);
    await Promise.all(['1', '2', '3', '4'].map((n) => store.begin(A, recording(`d${n}`))));
    expect((await store.list(A)).drafts.map((d) => d.draftId).sort()).toEqual(['d1', 'd2', 'd3', 'd4']);
  });
});
