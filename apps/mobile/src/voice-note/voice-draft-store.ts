/**
 * S8B-03 (CP2, OD-6, decision D3) — the unsent Voice Note drafts of one account, on this device only.
 *
 *   Audio:     `Paths.document/qandeel-voice-drafts/<accountId>/<draftId>.m4a` — never `cache` as storage; the folder is
 *              excluded from device backup (Android backup rules, the iOS backup flag; §8.2).
 *   Metadata:  `expo-sqlite/kv-store`, its OWN database `qandeel-voice-drafts.db`, one value per account under
 *              `qandeel.voice.drafts.v1:<accountId>` that names its owner again. Three operations, like every app store.
 *
 * Sign-out deletes nothing (the T-13 convention): an account's drafts stay and are reachable only when that account is
 * signed in again. A draft is deleted only after its upload is CONFIRMED accepted, when its owner cancels or deletes it,
 * or when account deletion is confirmed. Nothing here sends anything: restoring a draft never uploads it.
 *
 * Every write goes through ONE promise chain, so two writes never interleave. No audio, transcript or key is logged.
 */
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { Directory, File, Paths } from 'expo-file-system';

import { excludeFromBackup } from './backup-exclusion';
import { checkDraftFile, type DraftFileCheck } from './m4a-draft-check';

export const VOICE_DRAFTS_DATABASE_NAME = 'qandeel-voice-drafts.db';
export const VOICE_DRAFTS_KEY_PREFIX = 'qandeel.voice.drafts.v1:';
export const VOICE_DRAFTS_FOLDER = 'qandeel-voice-drafts';

/** Why a capture stopped; each maps to its approved line (C-17 / C-18 / C-19), USER to none. */
export type VoiceDraftStop = 'USER' | 'LEFT_SCREEN' | 'INTERRUPTION' | 'LIMIT';

export interface VoiceDraftRecord {
  readonly draftId: string;
  readonly sessionId: string;
  /** The upload's command id: kept with the draft so every retry is the SAME upload (rotated only on UNAVAILABLE). */
  readonly commandId: string;
  /** RECORDING until the recorder has finished its file; then SAVED. A RECORDING draft found at start-up was cut off. */
  readonly state: 'RECORDING' | 'SAVED';
  /** Where the recorder writes while RECORDING (inside the app's documents); null once the file is the draft's own. */
  readonly recorderUri: string | null;
  readonly durationMs: number | null;
  readonly bytes: number | null;
  readonly stoppedBy: VoiceDraftStop | null;
  readonly createdAt: string;
}

/** A note the server ACCEPTED and that is not yet a turn: what the processing item shows until the commit. */
export interface VoiceAcceptedNote {
  readonly recordingId: string;
  readonly sessionId: string;
  readonly durationMs: number | null;
  readonly availableUntil: string | null;
}

interface StoredValue {
  readonly owner: string;
  readonly drafts: readonly VoiceDraftRecord[];
  readonly accepted: readonly VoiceAcceptedNote[];
}

export interface VoiceDraftKeyValue {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** The files side, behind a port so the store's rules are tested without a device. */
export interface VoiceDraftFiles {
  /** Moves the recorder's finished file to the owner's draft path; its size. Throws when it cannot. */
  adopt(owner: string, draftId: string, recorderUri: string): Promise<number>;
  size(owner: string, draftId: string): number | null;
  check(owner: string, draftId: string): DraftFileCheck;
  checkUri(uri: string): DraftFileCheck;
  read(owner: string, draftId: string): Uint8Array;
  remove(owner: string, draftId: string): void;
  removeUri(uri: string): void;
  /** Every account's folder is removed (confirmed account deletion of the signed-in owner only). */
  removeOwner(owner: string): void;
}

/** The kv-store database's files (`expo-sqlite`'s default folder is `<documents>/SQLite` on both platforms). */
export function voiceDraftDatabaseFiles(databaseName: string = VOICE_DRAFTS_DATABASE_NAME): readonly File[] {
  return ['', '-wal', '-shm', '-journal'].map((suffix) => new File(Paths.document, 'SQLite', `${databaseName}${suffix}`));
}

export function createVoiceDraftKeyValue(databaseName: string = VOICE_DRAFTS_DATABASE_NAME): VoiceDraftKeyValue {
  // Opened on first use, so building a runtime opens nothing until a draft is read or written.
  let opened: SQLiteStorage | null = null;
  const db = () => (opened ??= new SQLiteStorage(databaseName));
  // iOS: the database's files carry the backup flag once they exist (Android: the backup rules name them).
  const excludeDatabase = () => {
    for (const file of voiceDraftDatabaseFiles(databaseName)) if (file.exists) excludeFromBackup(file.uri);
  };
  return {
    getItem: (key) => db().getItemAsync(key),
    setItem: async (key, value) => {
      await db().setItemAsync(key, value);
      excludeDatabase();
    },
    removeItem: async (key) => {
      await db().removeItemAsync(key);
    },
  };
}

export function createEphemeralVoiceDraftKeyValue(): VoiceDraftKeyValue {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}

const SAFE_SEGMENT = /^[0-9a-f-]{36}$/iu;
const segment = (value: string): string => {
  if (!SAFE_SEGMENT.test(value)) throw new RangeError('a draft path segment is an account or draft id');
  return value.toLowerCase();
};

/** The root of every account's drafts: `<documents>/qandeel-voice-drafts`, excluded from backup as one folder. */
export function voiceDraftsRoot(): Directory {
  return new Directory(Paths.document, VOICE_DRAFTS_FOLDER);
}

/** The device implementation over `expo-file-system` (the documents directory only). */
export function createDeviceVoiceDraftFiles(): VoiceDraftFiles {
  const ownerFolder = (owner: string) => new Directory(Paths.document, VOICE_DRAFTS_FOLDER, segment(owner));
  const draftFile = (owner: string, draftId: string) => new File(ownerFolder(owner), `${segment(draftId)}.m4a`);
  const checkFile = (file: File): DraftFileCheck => {
    if (!file.exists) return 'INCOMPLETE';
    const handle = file.open();
    try {
      return checkDraftFile((offset, length) => {
        handle.offset = offset;
        return handle.readBytes(length);
      }, file.size);
    } finally {
      handle.close();
    }
  };
  return {
    async adopt(owner, draftId, recorderUri) {
      const folder = ownerFolder(owner);
      if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
      excludeFromBackup(voiceDraftsRoot().uri);
      const target = draftFile(owner, draftId);
      const source = new File(recorderUri);
      if (!source.exists) throw new Error('recording missing');
      await source.move(target);
      return target.size;
    },
    size: (owner, draftId) => {
      const file = draftFile(owner, draftId);
      return file.exists ? file.size : null;
    },
    check: (owner, draftId) => checkFile(draftFile(owner, draftId)),
    checkUri: (uri) => checkFile(new File(uri)),
    read: (owner, draftId) => draftFile(owner, draftId).bytesSync(),
    remove: (owner, draftId) => {
      const file = draftFile(owner, draftId);
      if (file.exists) file.delete();
    },
    removeUri: (uri) => {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
    removeOwner: (owner) => {
      const folder = ownerFolder(owner);
      if (folder.exists) folder.delete();
    },
  };
}

export interface VoiceDraftStore {
  list(owner: string): Promise<{ readonly drafts: readonly VoiceDraftRecord[]; readonly accepted: readonly VoiceAcceptedNote[] }>;
  /** The capture began: its metadata exists BEFORE the first sample, so a crash leaves a findable draft. */
  begin(owner: string, draft: VoiceDraftRecord): Promise<void>;
  /** The recorder finished: the file becomes the draft's own and the draft is SAVED. */
  finish(owner: string, draftId: string, durationMs: number | null, stoppedBy: VoiceDraftStop): Promise<VoiceDraftRecord | null>;
  /** A new command id, only after an UNAVAILABLE answer (§8.2). */
  rotateCommand(owner: string, draftId: string, commandId: string): Promise<void>;
  /** The server CONFIRMED the upload: the note is remembered as accepted, THEN the draft and its file are removed. */
  accept(owner: string, draftId: string, note: VoiceAcceptedNote): Promise<void>;
  /** The owner cancelled or deleted it. */
  discard(owner: string, draftId: string): Promise<void>;
  /** An accepted note is now a turn (or terminal): it is no longer shown as processing. */
  forgetAccepted(owner: string, recordingId: string): Promise<void>;
  /**
   * Start-up recovery: a RECORDING draft whose recorder file is a finished M4A is adopted as SAVED (LEFT_SCREEN); one
   * that is not is removed and reported, so the reader is told C-23. Nothing is uploaded.
   */
  recover(owner: string): Promise<{ readonly unrecoverable: number }>;
  /** Confirmed account deletion of this owner: every draft, file and record of it. */
  removeOwner(owner: string): Promise<void>;
}

export function voiceDraftKeyFor(owner: string): string {
  if (typeof owner !== 'string' || owner.length === 0) throw new RangeError('drafts belong to an authenticated account');
  return `${VOICE_DRAFTS_KEY_PREFIX}${owner}`;
}

export function createVoiceDraftStore(storage: VoiceDraftKeyValue, files: VoiceDraftFiles): VoiceDraftStore {
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work);
    chain = next.catch(() => undefined);
    return next;
  };

  async function read(owner: string): Promise<StoredValue> {
    const raw = await storage.getItem(voiceDraftKeyFor(owner));
    if (raw === null) return { owner, drafts: [], accepted: [] };
    try {
      const value = JSON.parse(raw) as StoredValue;
      // A value that does not name this owner is never shown to them.
      if (value?.owner !== owner || !Array.isArray(value.drafts) || !Array.isArray(value.accepted)) return { owner, drafts: [], accepted: [] };
      return value;
    } catch {
      return { owner, drafts: [], accepted: [] };
    }
  }
  const write = (owner: string, value: StoredValue) => storage.setItem(voiceDraftKeyFor(owner), JSON.stringify(value));

  return {
    list: (owner) => serial(async () => {
      const value = await read(owner);
      return { drafts: value.drafts, accepted: value.accepted };
    }),
    begin: (owner, draft) => serial(async () => {
      const value = await read(owner);
      await write(owner, { ...value, drafts: [...value.drafts.filter((d) => d.draftId !== draft.draftId), draft] });
    }),
    finish: (owner, draftId, durationMs, stoppedBy) => serial(async () => {
      const value = await read(owner);
      const draft = value.drafts.find((d) => d.draftId === draftId);
      if (draft === undefined || draft.state !== 'RECORDING' || draft.recorderUri === null) return null;
      const bytes = await files.adopt(owner, draftId, draft.recorderUri);
      const saved: VoiceDraftRecord = { ...draft, state: 'SAVED', recorderUri: null, durationMs, bytes, stoppedBy };
      await write(owner, { ...value, drafts: value.drafts.map((d) => (d.draftId === draftId ? saved : d)) });
      return saved;
    }),
    rotateCommand: (owner, draftId, commandId) => serial(async () => {
      const value = await read(owner);
      await write(owner, { ...value, drafts: value.drafts.map((d) => (d.draftId === draftId ? { ...d, commandId } : d)) });
    }),
    accept: (owner, draftId, note) => serial(async () => {
      const value = await read(owner);
      // The acceptance is recorded first: a crash between the two steps leaves a known note, never a lost one.
      await write(owner, {
        ...value,
        drafts: value.drafts.filter((d) => d.draftId !== draftId),
        accepted: [...value.accepted.filter((n) => n.recordingId !== note.recordingId), note],
      });
      files.remove(owner, draftId);
    }),
    discard: (owner, draftId) => serial(async () => {
      const value = await read(owner);
      const draft = value.drafts.find((d) => d.draftId === draftId);
      if (draft?.recorderUri) files.removeUri(draft.recorderUri);
      files.remove(owner, draftId);
      await write(owner, { ...value, drafts: value.drafts.filter((d) => d.draftId !== draftId) });
    }),
    forgetAccepted: (owner, recordingId) => serial(async () => {
      const value = await read(owner);
      await write(owner, { ...value, accepted: value.accepted.filter((n) => n.recordingId !== recordingId) });
    }),
    recover: (owner) => serial(async () => {
      const value = await read(owner);
      let unrecoverable = 0;
      const drafts: VoiceDraftRecord[] = [];
      for (const draft of value.drafts) {
        if (draft.state === 'SAVED') {
          // A SAVED draft whose file is gone or damaged cannot be offered as sendable.
          if (files.check(owner, draft.draftId) === 'COMPLETE') drafts.push(draft);
          else {
            files.remove(owner, draft.draftId);
            unrecoverable += 1;
          }
          continue;
        }
        if (draft.recorderUri !== null && files.checkUri(draft.recorderUri) === 'COMPLETE') {
          const bytes = await files.adopt(owner, draft.draftId, draft.recorderUri).catch(() => null);
          if (bytes !== null) {
            drafts.push({ ...draft, state: 'SAVED', recorderUri: null, bytes, stoppedBy: 'LEFT_SCREEN' });
            continue;
          }
        }
        if (draft.recorderUri !== null) files.removeUri(draft.recorderUri);
        unrecoverable += 1;
      }
      await write(owner, { ...value, drafts });
      return { unrecoverable };
    }),
    removeOwner: (owner) => serial(async () => {
      files.removeOwner(owner);
      await storage.removeItem(voiceDraftKeyFor(owner));
    }),
  };
}
