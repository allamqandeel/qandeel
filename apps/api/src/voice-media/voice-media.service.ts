import {
  BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException,
} from '@nestjs/common';
import type { Readable } from 'node:stream';
import { TelemetryService } from '../observability/telemetry.service';
import {
  PRIVATE_AUDIO_OBJECT_STORE, VOICE_OBJECT_MAX_BYTES, VoiceByteCountError, type PrivateAudioObjectStore, type VoiceAudioContentType,
  type VoiceByteRange,
} from './private-audio-object.store';
import { VoiceMediaRepository, type RecordingObjectRow } from './voice-media.repository';

/**
 * S8B-02 (CP2, contract §3.11) — the voice media boundary: a Voice Note's streamed upload, the owner's Range reads of a
 * recording, the owner's early deletion, the per-file Export My Data download, and the call-segment write that S8B-05's
 * writer will call (no route: the live call and its writer are S8B-05's).
 *
 * Authority is the database's, re-read on EVERY request: ownership, the recording's state and expiry (cut at the instant,
 * with no worker), a due account erasure, consent and the gate. The human is always the verified token's. A client never
 * receives a storage key, URL or credential, and nothing a client sends is taken as a key. Creation (begin, accept, open,
 * add, store) is refused by the database while the gate is closed or consent is not current; reading, deleting and
 * exporting never consult the gate (PO-OPS-17).
 *
 * Nothing is logged. Each outcome is one content-free telemetry class (`VOICE_MEDIA`): never a person, recording, key,
 * size, file name, transcript or byte.
 */
export const VOICE_NOTE_CONTENT_TYPE = 'audio/mp4';
/** The writer lease a call segment renews, within 0183's 5 .. 120 s bound. S8B-05 sets its operating value. */
export const VOICE_SEGMENT_LEASE_SECONDS = 30;
/** A store read must begin answering within this budget; the stream after it is bounded by the idle timeout instead. */
export const VOICE_STORE_OPEN_MS = 15_000;
export const VOICE_EXPORT_MANIFEST_FORMAT = 'qandeel.personal-data-export.voice.v1';
/** The stable export file names 0185 derives from each recording's own anchor instant. */
export const VOICE_EXPORT_FILE_NAME = /^qandeel-voice-(?:note-\d{8}T\d{12}Z(?:-\d+)?\.m4a|call-\d{8}T\d{12}Z(?:-\d+)?-(?:user|qandeel)-\d{6,}\.ogg)$/u;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const TRACKS = ['NOTE', 'USER', 'QANDEEL'] as const;
type Track = (typeof TRACKS)[number];

export type NoteUploadAnswer =
  | { readonly outcome: 'ACCEPTED'; readonly recordingId: string; readonly acceptedAt: string | null; readonly availableUntil: string | null }
  | { readonly outcome: 'NOT_AVAILABLE_NOW' | 'CONSENT_REQUIRED' | 'TOO_LARGE' | 'UNSUPPORTED' | 'SIZE_MISMATCH' };

/** An object opened for one response: its status, headers and the store's own body stream. */
export interface OpenedAudio {
  readonly status: 200 | 206;
  readonly contentType: VoiceAudioContentType;
  readonly contentLength: number;
  readonly contentRange: string | null;
  readonly body: Readable;
}

export interface VoiceExportManifest {
  readonly format: typeof VOICE_EXPORT_MANIFEST_FORMAT;
  readonly files: ReadonlyArray<{
    fileName: string; mimeType: VoiceAudioContentType; recordingKind: 'VOICE_NOTE' | 'LIVE_CALL'; track: Track;
    segmentIndex: number; recordedAt: string | null; availableUntil: string | null; bytes: number;
    clockStartMs: number | null; clockEndMs: number | null; originalAudio: true;
  }>;
}

const unavailable = () => new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
const notFound = () => new NotFoundException({ outcome: 'NOT_FOUND' });
const noLongerAvailable = () => new NotFoundException({ outcome: 'NO_LONGER_AVAILABLE' });
const invalid = () => new BadRequestException({ outcome: 'INVALID_REQUEST' });
const instant = (value: unknown): string | null => {
  if (typeof value !== 'string' || value === '') return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
};
const numberOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

/**
 * One `bytes=` range of an object of `size` bytes (RFC 9110 §14.1.2): `a-b`, `a-` or `-n`. No header, a malformed one, or
 * several ranges: null (the whole object, 200). A well-formed range that cannot be satisfied: 'UNSATISFIABLE' (416).
 */
export function parseByteRange(header: unknown, size: number): VoiceByteRange | null | 'UNSATISFIABLE' {
  if (typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix === 0) return 'UNSATISFIABLE';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return 'UNSATISFIABLE';
  return { start, end };
}

@Injectable()
export class VoiceMediaService {
  constructor(
    private readonly repository: VoiceMediaRepository,
    @Inject(PRIVATE_AUDIO_OBJECT_STORE) private readonly store: PrivateAudioObjectStore,
    @Optional() private readonly telemetry?: TelemetryService,
  ) {}

  /**
   * A Voice Note: begin (gate and consent, in the database) → one streamed PUT of exactly the declared bytes, cancelled by
   * a client disconnect or the upload deadline → accept (consent re-read). Whatever stops it after the begin - a failed or
   * aborted PUT, or an accept refusal such as a consent withdrawal (PRIV-W) - discards the pending note at once: never
   * STORED, never readable, its key queued for erasure after the upload can no longer land (0183).
   */
  async uploadNote(userId: string, sessionId: string, commandId: string, contentType: unknown, contentLength: unknown,
    body: Readable, clientSignal: AbortSignal): Promise<NoteUploadAnswer> {
    if (!UUID.test(sessionId) || !UUID.test(commandId)) throw invalid();
    if (String(contentType ?? '').split(';')[0].trim().toLowerCase() !== VOICE_NOTE_CONTENT_TYPE) return this.refused('UNSUPPORTED');
    const byteSize = Number(contentLength);
    if (!Number.isSafeInteger(byteSize) || byteSize <= 0) throw invalid();
    if (byteSize > VOICE_OBJECT_MAX_BYTES) return this.refused('TOO_LARGE');
    if (!this.store.isConfigured()) throw this.failed('upload', unavailable());
    const begun = await this.repository.beginNote(userId, sessionId, commandId, byteSize).catch(() => {
      throw this.failed('upload', unavailable());
    });
    if (begun === undefined) throw this.failed('upload', unavailable());
    if (begun.outcome === 'NOT_AVAILABLE_NOW' || begun.outcome === 'CONSENT_REQUIRED' || begun.outcome === 'TOO_LARGE') return this.refused(begun.outcome);
    if (begun.outcome === 'ALREADY_ACCEPTED' && begun.recording_id) return this.replayAcceptedNote(userId, begun.recording_id, byteSize, body);
    if (begun.outcome !== 'BEGUN' || !begun.recording_id || !begun.storage_key) {
      this.signal('upload', 'refused_expected');
      throw notFound();
    }
    const recordingId = begun.recording_id;
    const deadline = Date.parse(begun.upload_deadline ?? '') - Date.now();
    const signal = AbortSignal.any([clientSignal, AbortSignal.timeout(Number.isFinite(deadline) && deadline > 0 ? deadline : 1)]);
    try {
      await this.store.putStream(begun.storage_key, VOICE_NOTE_CONTENT_TYPE, body, byteSize, signal);
    } catch (error) {
      await this.discard(userId, recordingId);
      if (error instanceof VoiceByteCountError) {
        this.signal('upload', 'refused_expected');
        throw invalid();
      }
      throw this.failed('upload', unavailable());
    }
    const accepted = await this.repository.acceptNote(userId, recordingId, byteSize).catch(() => undefined);
    // No answer: the note may have been accepted; it is neither discarded nor claimed. The sweep settles a pending one.
    if (accepted === undefined) throw this.failed('upload', unavailable());
    if (accepted.outcome !== 'ACCEPTED') {
      await this.discard(userId, recordingId);
      if (accepted.outcome === 'CONSENT_REQUIRED' || accepted.outcome === 'SIZE_MISMATCH') return this.refused(accepted.outcome);
      this.signal('upload', 'refused_expected');
      throw notFound();
    }
    this.signal('upload', 'success');
    return { outcome: 'ACCEPTED', recordingId, acceptedAt: instant(accepted.accepted_at), availableUntil: instant(accepted.retention_expires_at) };
  }

  /**
   * S8B-03 (§5.2, BLOCKER-1) — the same command replayed after its note was accepted (the answer was lost): the body is
   * drained without storing it (no PUT), and accept v1's read-only STORED branch, scoped to the owner, returns the stored
   * acceptance - the very values the first answer carried. A delete or expiry racing between the two calls answers 404,
   * and nothing is ever discarded: the recording is not this request's.
   */
  private async replayAcceptedNote(userId: string, recordingId: string, byteSize: number, body: Readable): Promise<NoteUploadAnswer> {
    await drain(body, byteSize);
    const accepted = await this.repository.acceptNote(userId, recordingId, byteSize).catch(() => undefined);
    if (accepted === undefined) throw this.failed('upload', unavailable());
    const availableUntil = instant(accepted.retention_expires_at);
    if (accepted.outcome !== 'ACCEPTED' || availableUntil === null || Date.parse(availableUntil) <= Date.now()) {
      this.signal('upload', 'refused_expected');
      throw notFound();
    }
    this.signal('upload', 'success');
    return { outcome: 'ACCEPTED', recordingId, acceptedAt: instant(accepted.accepted_at), availableUntil };
  }

  /**
   * S8B-03 (§4.10.3) — the transcription worker's ONLY way to a note's audio: the note's object re-read through the read
   * definer for its owner at this instant (never a key the worker holds), as an async stream of exactly its bytes. Not
   * readable now (deleted, expired, erased): null.
   */
  async openNoteForTranscription(userId: string, recordingId: string, signal: AbortSignal): Promise<{ readonly byteSize: number; readonly audio: AsyncIterable<Buffer> } | null> {
    const note = await this.noteObject(userId, recordingId);
    if (note === null) return null;
    const body = await this.store.getRange(note.storage_key, null, signal);
    if (body === null) throw this.failed('read', unavailable(), 'integrity_failure');
    return { byteSize: Number(note.byte_size), audio: body as AsyncIterable<Buffer> };
  }

  /** S8B-03 (§4.6.2) — one bounded Range read of a readable note, for the duration proof. Not readable now: null. */
  async readNoteRange(userId: string, recordingId: string, offset: number, length: number, signal: AbortSignal): Promise<Buffer | null> {
    const note = await this.noteObject(userId, recordingId);
    if (note === null) return null;
    const size = Number(note.byte_size);
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0 || offset >= size) return Buffer.alloc(0);
    const body = await this.store.getRange(note.storage_key, { start: offset, end: Math.min(size, offset + length) - 1 }, signal);
    if (body === null) throw this.failed('read', unavailable(), 'integrity_failure');
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Buffer>) {
      total += chunk.length;
      if (total > length) {
        body.destroy();
        throw this.failed('read', unavailable(), 'integrity_failure');
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, total);
  }

  private async noteObject(userId: string, recordingId: string): Promise<RecordingObjectRow | null> {
    if (!UUID.test(recordingId)) return null;
    if (!this.store.isConfigured()) throw this.failed('read', unavailable());
    const rows = await this.repository.readObjects(userId, recordingId).catch(() => {
      throw this.failed('read', unavailable());
    });
    const notes = (Array.isArray(rows) ? rows : []).filter((o) => o.track === 'NOTE');
    return notes.length === 1 ? notes[0] : null;
  }

  /** The objects of one readable recording, in track and segment order - no key. Not readable now: 404. */
  async readRecording(userId: string, recordingId: string) {
    if (!UUID.test(recordingId)) throw notFound();
    const objects = await this.objects(userId, recordingId, 'read');
    if (objects.length === 0) {
      this.signal('read', 'refused_expected');
      throw notFound();
    }
    this.signal('read', 'success');
    return {
      objects: objects.map((o) => ({
        track: o.track, segmentIndex: Number(o.segment_index), contentType: o.content_type, bytes: Number(o.byte_size),
        clockStartMs: numberOrNull(o.clock_start_ms), clockEndMs: numberOrNull(o.clock_end_ms),
      })),
    };
  }

  /** One object of one readable recording, whole (200) or one byte range (206). Not readable now: 404. */
  async openObject(userId: string, recordingId: string, track: string, segmentIndex: string, range: unknown, signal: AbortSignal): Promise<OpenedAudio> {
    const index = Number(segmentIndex);
    if (!UUID.test(recordingId) || !(TRACKS as readonly string[]).includes(track) || !/^\d{1,9}$/u.test(segmentIndex)) throw notFound();
    const object = (await this.objects(userId, recordingId, 'read')).find((o) => o.track === track && Number(o.segment_index) === index);
    if (object === undefined) {
      this.signal('read', 'refused_expected');
      throw notFound();
    }
    return this.open(object, range, signal, 'read');
  }

  /** The owner's early deletion: refused for reading at once, its objects queued for physical erasure. Not theirs: 404. */
  async deleteRecording(userId: string, recordingId: string) {
    if (!UUID.test(recordingId)) throw notFound();
    const row = await this.repository.deleteRecording(userId, recordingId).catch(() => {
      throw this.failed('delete', unavailable());
    });
    if (row?.outcome === 'DELETED' || row?.outcome === 'ALREADY_GONE') {
      this.signal('delete', 'success');
      return { outcome: row.outcome };
    }
    if (row?.outcome === 'UNAVAILABLE') {
      this.signal('delete', 'refused_expected');
      throw notFound();
    }
    throw this.failed('delete', unavailable());
  }

  /**
   * One call segment, for S8B-05's writer (no route): add (consent, expiry, order, contiguity) → one streamed PUT of
   * exactly its bytes → store. Only `STORED` is the acknowledgement that lets the writer release the audio (§3.5 rule 3);
   * a failed PUT leaves the segment pending, and the seal or recovery turns it into a WRITER_LOSS gap.
   */
  async writeCallSegment(userId: string, recordingId: string, track: 'USER' | 'QANDEEL', segmentIndex: number, clockStartMs: number,
    clockEndMs: number, body: Readable, byteSize: number, signal: AbortSignal): Promise<{ outcome: string }> {
    const added = await this.repository.addSegment(userId, recordingId, track, segmentIndex, clockStartMs, clockEndMs, byteSize,
      VOICE_SEGMENT_LEASE_SECONDS).catch(() => undefined);
    if (added === undefined) return { outcome: 'UNAVAILABLE' };
    if (added.outcome !== 'ADDED' || !added.storage_key) return { outcome: added.outcome };
    const deadline = Date.parse(added.upload_deadline ?? '') - Date.now();
    try {
      await this.store.putStream(added.storage_key, 'audio/ogg', body, byteSize,
        AbortSignal.any([signal, AbortSignal.timeout(Number.isFinite(deadline) && deadline > 0 ? deadline : 1)]));
    } catch {
      return { outcome: 'UNAVAILABLE' };
    }
    const stored = await this.repository.storeSegment(userId, recordingId, track, segmentIndex, byteSize).catch(() => undefined);
    return { outcome: stored?.outcome ?? 'UNAVAILABLE' };
  }

  /** Export My Data: every retained voice object, by its file name only. Nothing inline, no key, no recording id. */
  async exportManifest(userId: string): Promise<VoiceExportManifest> {
    const rows = await this.repository.listRecordings(userId);
    return {
      format: VOICE_EXPORT_MANIFEST_FORMAT,
      files: rows.map((r) => ({
        fileName: r.file_name, mimeType: r.content_type as VoiceAudioContentType,
        recordingKind: r.recording_kind as 'VOICE_NOTE' | 'LIVE_CALL', track: r.track as Track, segmentIndex: Number(r.segment_index),
        recordedAt: instant(r.recorded_at), availableUntil: instant(r.retention_expires_at), bytes: Number(r.byte_size),
        clockStartMs: numberOrNull(r.clock_start_ms), clockEndMs: numberOrNull(r.clock_end_ms), originalAudio: true,
      })),
    };
  }

  /**
   * One exported voice file, streamed. Its name is resolved again against the owner's readable recordings, and the object
   * re-read through the read definer at this instant: an expired, deleted or erased recording answers NO_LONGER_AVAILABLE.
   */
  async openExportFile(userId: string, fileName: string, signal: AbortSignal): Promise<OpenedAudio> {
    if (!VOICE_EXPORT_FILE_NAME.test(fileName)) throw invalid();
    const listed = await this.repository.listRecordings(userId).catch(() => {
      throw this.failed('export_file', unavailable());
    });
    const entry = listed.find((r) => r.file_name === fileName);
    const object = entry === undefined ? undefined
      : (await this.objects(userId, entry.recording_id, 'export_file'))
        .find((o) => o.track === entry.track && Number(o.segment_index) === Number(entry.segment_index));
    if (object === undefined) {
      this.signal('export_file', 'refused_expected');
      throw noLongerAvailable();
    }
    return this.open(object, null, signal, 'export_file');
  }

  private async objects(userId: string, recordingId: string, operation: VoiceMediaOperation): Promise<RecordingObjectRow[]> {
    if (!this.store.isConfigured()) throw this.failed(operation, unavailable());
    const rows = await this.repository.readObjects(userId, recordingId).catch(() => {
      throw this.failed(operation, unavailable());
    });
    return Array.isArray(rows) ? rows : [];
  }

  private async open(object: RecordingObjectRow, header: unknown, signal: AbortSignal, operation: VoiceMediaOperation): Promise<OpenedAudio> {
    const size = Number(object.byte_size);
    const range = parseByteRange(header, size);
    if (range === 'UNSATISFIABLE') {
      this.signal(operation, 'refused_expected');
      throw new HttpException({ outcome: 'RANGE_NOT_SATISFIABLE' }, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
    }
    let body: Readable | null;
    // The open budget aborts only a store that never begins to answer; once the body flows it is never fired.
    const opening = new AbortController();
    const budget = setTimeout(() => opening.abort(), VOICE_STORE_OPEN_MS);
    try {
      body = await this.store.getRange(object.storage_key, range, AbortSignal.any([signal, opening.signal]));
    } catch {
      throw this.failed(operation, unavailable());
    } finally {
      clearTimeout(budget);
    }
    // A live key with no object is an integrity failure, never an empty answer.
    if (body === null) throw this.failed(operation, unavailable(), 'integrity_failure');
    this.signal(operation, 'success');
    return {
      status: range ? 206 : 200,
      contentType: object.content_type as VoiceAudioContentType,
      contentLength: range ? range.end - range.start + 1 : size,
      contentRange: range ? `bytes ${range.start}-${range.end}/${size}` : null,
      body,
    };
  }

  /** Best effort: a pending note the upload could not finish is DISCARDED now (its key queued by 0183). */
  private async discard(userId: string, recordingId: string): Promise<void> {
    await this.repository.deleteRecording(userId, recordingId).catch(() => undefined);
  }

  private refused<T extends Exclude<NoteUploadAnswer['outcome'], 'ACCEPTED'>>(outcome: T): { outcome: T } {
    this.signal('upload', 'refused_expected');
    return { outcome };
  }

  private failed<E extends Error>(operation: VoiceMediaOperation, error: E, outcome: 'transport_failure' | 'integrity_failure' = 'transport_failure'): E {
    this.signal(operation, outcome);
    return error;
  }

  /** One content-free outcome; a telemetry failure never reaches a request. */
  private signal(operation: VoiceMediaOperation, outcome: 'success' | 'refused_expected' | 'transport_failure' | 'integrity_failure'): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_MEDIA', operation, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}

type VoiceMediaOperation = 'upload' | 'read' | 'delete' | 'export_file';

/** Reads a request body to its end without keeping it, bounded by its declared length (§5.2: no second upload). */
async function drain(body: Readable, byteSize: number): Promise<void> {
  let seen = 0;
  try {
    for await (const chunk of body as AsyncIterable<Buffer>) {
      seen += chunk.length;
      if (seen > byteSize) break;
    }
  } catch {
    // A client that goes away mid-drain changes nothing: the note is already accepted.
  }
}
