/**
 * S8B-03 (CP2, contract §8.2) — the client for the CP1 Voice Note routes. A transport and nothing else: every request goes
 * through the AC-01 authorized seam its caller hands it (the bearer is decided at each request), it never chooses a
 * command id, never repeats a request, and reports what the server said as a typed outcome. No route takes a user, a key,
 * a job or a band; nothing here is logged.
 *
 *   POST   /voice/notes/:sessionId/:commandId           the note's raw `audio/mp4` bytes (Content-Length) → ACCEPTED | …
 *   GET    /voice/notes/:recordingId/status              the note's client state (never its text, band or attempts)
 *   GET    /voice/notes/pending?sessionId=                accepted notes of a Session not yet in the conversation
 *   POST   /voice/notes/:recordingId/transcription/retry  the owner's explicit retry
 *   POST   /voice/notes/:recordingId/turn                 commit a READY note as one turn → the turn and its reply
 *   GET    /voice/consent · POST /voice/consent/grant · POST /voice/consent/withdraw · GET /voice/capability
 *   GET    /voice/recordings/:recordingId                 the readable recording's objects
 *   GET    /voice/recordings/:recordingId/objects/:track/:segmentIndex   the bytes (Range, Authorization header)
 *   DELETE /voice/recordings/:recordingId                 the owner's early deletion
 *
 * The one ambiguity it refuses to hide: an upload with no readable answer MAY have been stored. That is UNKNOWN, never
 * "not sent"; the caller retries it with the SAME command id, which the server resolves to the same recording.
 */
import { EXPORT_VOICE_FILE_NAME } from '../runtime-entry/account/account-api';
import { decodeSubmitResponse, type ConversationExchangeView } from '../runtime-entry/conversation/conversation-turn-api';
import { VOICE_CONSENT_VERSION } from './voice-note-copy';
import { VOICE_NOTE_CONTENT_TYPE } from './voice-note-limits';

/** The seam's fetch, able to carry a note's raw bytes and to be aborted. */
export type VoiceNoteFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array; signal?: AbortSignal },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

export interface VoiceNoteApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  readonly fetch: VoiceNoteFetch;
}

/** The note states a client may see (CP1 `VoiceNoteStatus`). */
export type VoiceNoteServerStatus = 'PROCESSING' | 'READY' | 'NO_SPEECH' | 'HELD_CONSENT' | 'FAILED_RETRYABLE' | 'FAILED_FINAL' | 'CANCELLED' | 'COMMITTED';
const STATUSES: readonly VoiceNoteServerStatus[] = ['PROCESSING', 'READY', 'NO_SPEECH', 'HELD_CONSENT', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED', 'COMMITTED'];

export type VoiceNoteUploadResult =
  | { readonly kind: 'ACCEPTED'; readonly recordingId: string; readonly acceptedAt: string | null; readonly availableUntil: string | null }
  /** The voice gate is closed now (C-31). Nothing was stored. */
  | { readonly kind: 'NOT_AVAILABLE_NOW' }
  /** No current consent (C-32). Nothing was stored. */
  | { readonly kind: 'CONSENT_REQUIRED' }
  /** The note itself was refused (size, type, length mismatch, a Session not this person's). Nothing was stored. */
  | { readonly kind: 'REFUSED' }
  /** The server could not take it now (503). Nothing is known to be stored; the command id is rotated (§8.2). */
  | { readonly kind: 'UNAVAILABLE' }
  /** No readable answer: it MAY have been stored. Retry with the same command id. */
  | { readonly kind: 'UNKNOWN' };

export interface VoiceNoteStatusView {
  readonly recordingId: string;
  readonly sessionId: string | null;
  readonly status: VoiceNoteServerStatus;
  readonly failure: 'AUDIO' | 'PROCESSING' | null;
  readonly canRetry: boolean;
  readonly turnId: string | null;
  readonly recordingAvailable: boolean;
  readonly availableUntil: string | null;
  readonly durationMs: number | null;
}
export type VoiceNoteStatusRead = { readonly kind: 'STATUS'; readonly view: VoiceNoteStatusView } | { readonly kind: 'NOT_FOUND' } | { readonly kind: 'UNAVAILABLE' };

export interface VoiceNotePendingView {
  readonly recordingId: string;
  readonly status: VoiceNoteServerStatus;
  readonly availableUntil: string | null;
  readonly durationMs: number | null;
}
export type VoiceNotePendingRead = { readonly kind: 'NOTES'; readonly notes: readonly VoiceNotePendingView[] } | { readonly kind: 'UNAVAILABLE' };

export type VoiceNoteCommitResult =
  | { readonly kind: 'COMMITTED'; readonly exchange: ConversationExchangeView }
  /** Not READY yet, the Session no longer takes turns, or a racing command: nothing was committed by this call. */
  | { readonly kind: 'CONFLICT' }
  | { readonly kind: 'CONSENT_REQUIRED' }
  | { readonly kind: 'NOT_AVAILABLE_NOW' }
  /** The typed admission bound (PROD-SEC-02): nothing was committed. */
  | { readonly kind: 'ADMISSION_LIMITED' }
  | { readonly kind: 'NOT_FOUND' }
  /** No readable answer: the turn MAY be committed. A replay answers the same turn. */
  | { readonly kind: 'UNKNOWN' };

export type VoiceConsentState = 'NONE' | 'GRANTED' | 'WITHDRAWN';
export interface VoiceCapabilityView {
  readonly voiceNotesAvailable: boolean;
  readonly consentState: VoiceConsentState;
  /** True only when consent is GRANTED for the current version. */
  readonly consentCurrent: boolean;
}
export type VoiceCapabilityRead = { readonly kind: 'CAPABILITY'; readonly view: VoiceCapabilityView } | { readonly kind: 'UNAVAILABLE' };

export interface VoiceConsentRowView {
  readonly id: string;
  readonly ar: string;
  readonly en: string;
}
export type VoiceConsentRead =
  | { readonly kind: 'CONSENT'; readonly version: string; readonly state: VoiceConsentState; readonly rows: readonly VoiceConsentRowView[] }
  | { readonly kind: 'UNAVAILABLE' };

export type VoiceConsentChange = 'DONE' | 'VERSION_NOT_CURRENT' | 'FAILED' | 'OFFLINE';
export type VoiceRecordingDeletion = 'DELETED' | 'FAILED' | 'OFFLINE';

export interface VoiceRecordingObjectView {
  readonly track: string;
  readonly segmentIndex: number;
  readonly bytes: number;
}
export type VoiceRecordingRead = { readonly kind: 'OBJECTS'; readonly objects: readonly VoiceRecordingObjectView[] } | { readonly kind: 'NOT_FOUND' } | { readonly kind: 'UNAVAILABLE' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const instant = (value: unknown): string | null => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);
const status = (value: unknown): VoiceNoteServerStatus | null => (STATUSES as readonly unknown[]).includes(value) ? value as VoiceNoteServerStatus : null;
const consentState = (value: unknown): VoiceConsentState | null => (value === 'NONE' || value === 'GRANTED' || value === 'WITHDRAWN' ? value : null);

async function bodyOf(response: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export class VoiceNoteApiClient {
  constructor(private readonly config: VoiceNoteApiConfig) {}

  private url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  private async send(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<{ status: number; body: unknown } | null> {
    try {
      const response = await this.config.fetch(this.url(path), {
        method,
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal === undefined ? {} : { signal }),
      });
      return { status: response.status, body: await bodyOf(response) };
    } catch {
      return null;
    }
  }

  /** The note's bytes, exactly once per call, under the caller's command id. */
  async upload(sessionId: string, commandId: string, bytes: Uint8Array, signal: AbortSignal): Promise<VoiceNoteUploadResult> {
    let response: Awaited<ReturnType<VoiceNoteFetch>>;
    try {
      response = await this.config.fetch(this.url(`/voice/notes/${encodeURIComponent(sessionId)}/${encodeURIComponent(commandId)}`), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': VOICE_NOTE_CONTENT_TYPE, 'Content-Length': String(bytes.length) },
        body: bytes,
        signal,
      });
    } catch {
      return { kind: 'UNKNOWN' };
    }
    const body = await bodyOf(response);
    if (response.status === 503) return { kind: 'UNAVAILABLE' };
    if (response.status >= 500) return { kind: 'UNKNOWN' };
    if (!response.ok) return { kind: 'REFUSED' };
    if (!isRecord(body)) return { kind: 'UNKNOWN' };
    if (body.outcome === 'ACCEPTED' && isUuid(body.recordingId)) {
      return { kind: 'ACCEPTED', recordingId: body.recordingId.toLowerCase(), acceptedAt: instant(body.acceptedAt), availableUntil: instant(body.availableUntil) };
    }
    if (body.outcome === 'NOT_AVAILABLE_NOW') return { kind: 'NOT_AVAILABLE_NOW' };
    if (body.outcome === 'CONSENT_REQUIRED') return { kind: 'CONSENT_REQUIRED' };
    if (body.outcome === 'TOO_LARGE' || body.outcome === 'UNSUPPORTED' || body.outcome === 'SIZE_MISMATCH') return { kind: 'REFUSED' };
    return { kind: 'UNKNOWN' };
  }

  async status(recordingId: string): Promise<VoiceNoteStatusRead> {
    const answer = await this.send('GET', `/voice/notes/${encodeURIComponent(recordingId)}/status`);
    if (answer === null || answer.status >= 500) return { kind: 'UNAVAILABLE' };
    if (answer.status === 404) return { kind: 'NOT_FOUND' };
    const body = answer.body;
    const state = isRecord(body) ? status(body.status) : null;
    if (answer.status !== 200 || !isRecord(body) || state === null || body.recordingId !== recordingId) return { kind: 'UNAVAILABLE' };
    return {
      kind: 'STATUS',
      view: {
        recordingId,
        sessionId: isUuid(body.sessionId) ? body.sessionId : null,
        status: state,
        failure: body.failure === 'AUDIO' || body.failure === 'PROCESSING' ? body.failure : null,
        canRetry: body.canRetry === true,
        turnId: isUuid(body.turnId) ? body.turnId : null,
        recordingAvailable: body.recordingAvailable === true,
        availableUntil: instant(body.availableUntil),
        durationMs: count(body.durationMs),
      },
    };
  }

  async pending(sessionId: string): Promise<VoiceNotePendingRead> {
    const answer = await this.send('GET', `/voice/notes/pending?sessionId=${encodeURIComponent(sessionId)}`);
    if (answer === null || answer.status !== 200 || !isRecord(answer.body) || !Array.isArray(answer.body.notes)) return { kind: 'UNAVAILABLE' };
    const notes: VoiceNotePendingView[] = [];
    for (const entry of answer.body.notes) {
      const state = isRecord(entry) ? status(entry.status) : null;
      if (!isRecord(entry) || !isUuid(entry.recordingId) || state === null) return { kind: 'UNAVAILABLE' };
      notes.push({ recordingId: entry.recordingId.toLowerCase(), status: state, availableUntil: instant(entry.availableUntil), durationMs: count(entry.durationMs) });
    }
    return { kind: 'NOTES', notes };
  }

  /** The owner's explicit "Try again" after a retryable failure. */
  async retry(recordingId: string): Promise<'RETRY_SCHEDULED' | 'NOT_RETRYABLE' | 'NOT_AVAILABLE_NOW' | 'FAILED'> {
    const answer = await this.send('POST', `/voice/notes/${encodeURIComponent(recordingId)}/transcription/retry`);
    if (answer === null || answer.status >= 500) return 'FAILED';
    if (answer.status !== 200 || !isRecord(answer.body)) return 'NOT_RETRYABLE';
    const outcome = answer.body.outcome;
    return outcome === 'RETRY_SCHEDULED' || outcome === 'NOT_AVAILABLE_NOW' ? outcome : 'NOT_RETRYABLE';
  }

  /** Commit a READY note as ONE user turn; the answer is the same turn shape as a typed turn's. A replay answers the same. */
  async commitTurn(recordingId: string): Promise<VoiceNoteCommitResult> {
    const answer = await this.send('POST', `/voice/notes/${encodeURIComponent(recordingId)}/turn`);
    if (answer === null || answer.status >= 500 && answer.status !== 503) return { kind: 'UNKNOWN' };
    const outcome = isRecord(answer.body) ? answer.body.outcome : undefined;
    if (answer.status === 503) return outcome === 'NOT_AVAILABLE_NOW' ? { kind: 'NOT_AVAILABLE_NOW' } : { kind: 'UNKNOWN' };
    if (answer.status === 409) return { kind: 'CONFLICT' };
    if (answer.status === 403) return { kind: 'CONSENT_REQUIRED' };
    if (answer.status === 429) return { kind: 'ADMISSION_LIMITED' };
    if (answer.status === 404) return { kind: 'NOT_FOUND' };
    if (answer.status !== 200) return { kind: 'UNKNOWN' };
    const decoded = decodeSubmitResponse(answer.body);
    return decoded.ok ? { kind: 'COMMITTED', exchange: decoded.value } : { kind: 'UNKNOWN' };
  }

  async capability(): Promise<VoiceCapabilityRead> {
    const answer = await this.send('GET', '/voice/capability');
    if (answer === null || answer.status !== 200 || !isRecord(answer.body)) return { kind: 'UNAVAILABLE' };
    const state = consentState(answer.body.consentState);
    if (state === null) return { kind: 'UNAVAILABLE' };
    return {
      kind: 'CAPABILITY',
      view: {
        voiceNotesAvailable: answer.body.voiceNotesAvailable === true,
        consentState: state,
        consentCurrent: state === 'GRANTED' && answer.body.grantedVersion === answer.body.currentVersion && answer.body.currentVersion === VOICE_CONSENT_VERSION,
      },
    };
  }

  async consent(): Promise<VoiceConsentRead> {
    const answer = await this.send('GET', '/voice/consent');
    if (answer === null || answer.status !== 200 || !isRecord(answer.body) || !Array.isArray(answer.body.rows)) return { kind: 'UNAVAILABLE' };
    const state = consentState(answer.body.consentState);
    if (state === null || typeof answer.body.consentVersion !== 'string') return { kind: 'UNAVAILABLE' };
    const rows: VoiceConsentRowView[] = [];
    for (const row of answer.body.rows) {
      if (!isRecord(row) || typeof row.id !== 'string' || typeof row.ar !== 'string' || typeof row.en !== 'string') return { kind: 'UNAVAILABLE' };
      rows.push({ id: row.id, ar: row.ar, en: row.en });
    }
    return { kind: 'CONSENT', version: answer.body.consentVersion, state, rows };
  }

  async grant(commandId: string, version: string): Promise<VoiceConsentChange> {
    const answer = await this.send('POST', '/voice/consent/grant', { commandId, version });
    if (answer === null) return 'OFFLINE';
    if (answer.status !== 200 || !isRecord(answer.body)) return 'FAILED';
    if (answer.body.outcome === 'GRANTED') return 'DONE';
    return answer.body.outcome === 'VERSION_NOT_CURRENT' ? 'VERSION_NOT_CURRENT' : 'FAILED';
  }

  async withdraw(commandId: string): Promise<VoiceConsentChange> {
    const answer = await this.send('POST', '/voice/consent/withdraw', { commandId });
    if (answer === null) return 'OFFLINE';
    return answer.status === 200 && isRecord(answer.body) && answer.body.outcome === 'WITHDRAWN' ? 'DONE' : 'FAILED';
  }

  async readRecording(recordingId: string): Promise<VoiceRecordingRead> {
    const answer = await this.send('GET', `/voice/recordings/${encodeURIComponent(recordingId)}`);
    if (answer === null || answer.status >= 500) return { kind: 'UNAVAILABLE' };
    if (answer.status === 404) return { kind: 'NOT_FOUND' };
    if (answer.status !== 200 || !isRecord(answer.body) || !Array.isArray(answer.body.objects)) return { kind: 'UNAVAILABLE' };
    const objects: VoiceRecordingObjectView[] = [];
    for (const entry of answer.body.objects) {
      if (!isRecord(entry) || typeof entry.track !== 'string' || count(entry.segmentIndex) === null || count(entry.bytes) === null) return { kind: 'UNAVAILABLE' };
      objects.push({ track: entry.track, segmentIndex: entry.segmentIndex as number, bytes: entry.bytes as number });
    }
    return { kind: 'OBJECTS', objects };
  }

  /** The note's one object, read by the player with Range and the bearer in a header — never a URL that carries one. */
  playbackUrl(recordingId: string): string {
    return this.url(`/voice/recordings/${encodeURIComponent(recordingId)}/objects/NOTE/0`);
  }

  /**
   * One voice file a READY export lists (S8B-02 `…/export/download/bundle/voice/:fileName`), streamed by the platform with
   * the bearer in a header. Only a name of the listed form is ever put in the path.
   */
  exportVoiceUrl(fileName: string): string | null {
    return EXPORT_VOICE_FILE_NAME.test(fileName) ? this.url(`/account/privacy/export/download/bundle/voice/${fileName}`) : null;
  }

  async deleteRecording(recordingId: string): Promise<VoiceRecordingDeletion> {
    const answer = await this.send('DELETE', `/voice/recordings/${encodeURIComponent(recordingId)}`);
    if (answer === null) return 'OFFLINE';
    if (answer.status === 404) return 'DELETED';
    return answer.status === 200 && isRecord(answer.body) && (answer.body.outcome === 'DELETED' || answer.body.outcome === 'ALREADY_GONE') ? 'DELETED' : 'FAILED';
  }
}
