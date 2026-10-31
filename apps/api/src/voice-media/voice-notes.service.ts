import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { VOICE_NOTE_TURN_RUNNER, type VoiceNoteTurnRunner } from './voice-note-turn.port';
import { consentText, VOICE_CONSENT_ROWS, VOICE_CONSENT_VERSION } from './voice-consent-text';
import { VoiceNotesRepository } from './voice-notes.repository';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/**
 * S8B-03 (CP1, §8.1 API) — the owner's voice consent and Voice Note reads and acts, through the 0183 consent definers and
 * the 0186 note definers (service_role, the human always the verified token's). The database decides consent, the gate,
 * ownership and readability on every call; nothing is cached and nothing is logged.
 *
 * The consent text is the Product Owner's APPROVED wording (C-01 … C-11, version VOICE_RECORDING_V1): the server answers
 * the text the database installed only when it equals `consentText()` exactly, so the words a person agrees to are the
 * approved ones or no text at all (503), never a drifted copy.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const notFound = () => new NotFoundException({ outcome: 'NOT_FOUND' });
const invalid = () => new BadRequestException({ outcome: 'INVALID_REQUEST' });
const unavailable = () => new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
const instant = (value: unknown): string | null => {
  if (typeof value !== 'string' || value === '') return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
};
const numberOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

/** The note states a client may see; the transcript, band, uncertain words and every attempt detail never leave. */
export type VoiceNoteStatus = 'PROCESSING' | 'READY' | 'NO_SPEECH' | 'HELD_CONSENT' | 'FAILED_RETRYABLE' | 'FAILED_FINAL' | 'CANCELLED' | 'COMMITTED';
const CLIENT_STATE: Record<string, VoiceNoteStatus> = {
  PENDING: 'PROCESSING', IN_PROGRESS: 'PROCESSING', DELETION_PENDING: 'PROCESSING', READY: 'READY', NO_SPEECH: 'NO_SPEECH',
  HELD_CONSENT: 'HELD_CONSENT', FAILED_RETRYABLE: 'FAILED_RETRYABLE', FAILED_FINAL: 'FAILED_FINAL', CANCELLED: 'CANCELLED', COMMITTED: 'COMMITTED',
};

@Injectable()
export class VoiceNotesService {
  constructor(private readonly notes: VoiceNotesRepository, private readonly serverApi: SupabaseServiceRoleApiService, private readonly moduleRef: ModuleRef) {}

  /**
   * POST /voice/notes/:recordingId/turn — commit a READY note as ONE user turn (the database: gate, consent FOR SHARE, the
   * admission bounds, one turn + its voice source in one transaction), then run that turn through the unchanged
   * Orchestrator. The commit never calls the transcription provider (A6). A replay answers the same turn and reply.
   */
  async commitTurn(userId: string, accessToken: string, recordingId: string) {
    if (!UUID.test(recordingId)) throw notFound();
    const row = await this.notes.commitTurn(userId, recordingId);
    switch (row?.outcome) {
      case 'COMMITTED':
      case 'ALREADY_COMMITTED':
        if (!row.turn_id || !row.session_id) throw unavailable();
        return this.moduleRef.get<VoiceNoteTurnRunner>(VOICE_NOTE_TURN_RUNNER, { strict: false })
          .run(userId, accessToken, row.session_id, row.turn_id);
      case 'ADMISSION_LIMITED':
        // The same machine-readable refusal as a typed turn (PROD-SEC-02): nothing was committed.
        throw new HttpException({ code: 'TURN_ADMISSION_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
      case 'CONSENT_REQUIRED':
        throw new ForbiddenException({ outcome: 'CONSENT_REQUIRED' });
      case 'NOT_AVAILABLE_NOW':
        throw new ServiceUnavailableException({ outcome: 'NOT_AVAILABLE_NOW' });
      case 'NOT_READY':
      case 'SESSION_NOT_ACTIVE':
      case 'COMMAND_CONFLICT':
        throw new ConflictException({ outcome: row.outcome });
      default:
        throw notFound();
    }
  }

  /** GET /voice/consent — the approved text of the current version, and this person's consent state. */
  async consent(userId: string) {
    const [text, state] = await Promise.all([
      this.notes.consentText().catch(() => undefined),
      this.serverApi.rpc<{ consent_state: string; consent_version: string | null }[]>('server_voice_consent_state_v1', { p_user_id: userId })
        .then((rows) => (Array.isArray(rows) ? rows[0] : undefined)).catch(() => undefined),
    ]);
    if (!text || !state || text.consent_version !== VOICE_CONSENT_VERSION
      || text.text_ar !== consentText('ar') || text.text_en !== consentText('en')) throw unavailable();
    return {
      consentVersion: VOICE_CONSENT_VERSION,
      consentState: state.consent_state,
      grantedVersion: state.consent_version,
      rows: VOICE_CONSENT_ROWS.map((row) => ({ id: row.id, ar: row.ar, en: row.en })),
    };
  }

  /** POST /voice/consent/grant {commandId, version} — idempotent per command; a stale version is refused. */
  async grant(userId: string, body: unknown) {
    const { commandId, version } = this.command(body, true);
    const row = await this.first<{ outcome: string }>('server_grant_voice_recording_consent_v1', { p_user_id: userId, p_command_id: commandId, p_consent_version: version });
    if (row?.outcome === 'GRANTED') return { outcome: 'GRANTED' as const };
    if (row?.outcome === 'VERSION_NOT_CURRENT') return { outcome: 'VERSION_NOT_CURRENT' as const };
    throw unavailable();
  }

  /**
   * POST /voice/consent/withdraw {commandId} — stops new voice messages; deletes nothing (C-09). A note still being
   * transcribed is held by the worker at its next round (no text is kept); a commit racing it is serialized by the
   * database (FOR SHARE), so either the turn exists with valid consent or the answer is CONSENT_REQUIRED.
   */
  async withdraw(userId: string, body: unknown) {
    const { commandId } = this.command(body, false);
    const row = await this.first<{ outcome: string }>('server_revoke_voice_recording_consent_v1', { p_user_id: userId, p_command_id: commandId });
    if (row?.outcome === 'WITHDRAWN') return { outcome: 'WITHDRAWN' as const };
    throw unavailable();
  }

  /** GET /voice/capability — whether Voice Notes are available now, and the consent state. No other detail. */
  async capability(userId: string) {
    const row = await this.notes.capability(userId).catch(() => undefined);
    if (!row) throw unavailable();
    return {
      voiceNotesAvailable: row.voice_notes_available === true,
      consentState: row.consent_state,
      grantedVersion: row.consent_version,
      currentVersion: row.current_version,
    };
  }

  /** GET /voice/notes/:recordingId/status — another human's note, or one never accepted, is 404 like one that does not exist. */
  async status(userId: string, recordingId: string) {
    if (!UUID.test(recordingId)) throw notFound();
    const row = await this.notes.status(userId, recordingId);
    if (!row) throw notFound();
    return {
      recordingId,
      sessionId: row.session_id,
      status: CLIENT_STATE[row.state] ?? 'PROCESSING',
      failure: row.failure_class === null ? null : row.failure_class.startsWith('AUDIO_') ? 'AUDIO' : 'PROCESSING',
      canRetry: row.can_retry === true,
      turnId: row.committed_turn_id,
      recordingAvailable: row.recording_available === true,
      acceptedAt: instant(row.accepted_at),
      availableUntil: instant(row.available_until),
      durationMs: numberOrNull(row.duration_ms),
    };
  }

  /** POST /voice/notes/:recordingId/transcription/retry — the owner's explicit retry, within the database's total bound. */
  async retry(userId: string, recordingId: string) {
    if (!UUID.test(recordingId)) throw notFound();
    const row = await this.notes.retry(userId, recordingId);
    if (!row || row.outcome === 'UNAVAILABLE') throw notFound();
    return { outcome: row.outcome };
  }

  /** GET /voice/notes/pending?sessionId — the accepted notes of one Session not yet in the conversation (recovery). */
  async pending(userId: string, sessionId: unknown) {
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw invalid();
    const rows = await this.notes.pending(userId, sessionId);
    return {
      notes: rows.map((row) => ({
        recordingId: row.recording_id,
        status: CLIENT_STATE[row.state] ?? 'PROCESSING',
        acceptedAt: instant(row.accepted_at),
        availableUntil: instant(row.available_until),
        durationMs: numberOrNull(row.duration_ms),
      })),
    };
  }

  private command(body: unknown, withVersion: boolean): { commandId: string; version: string } {
    const value = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const allowed = withVersion ? ['commandId', 'version'] : ['commandId'];
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw invalid();
    if (typeof value.commandId !== 'string' || !UUID.test(value.commandId)) throw invalid();
    if (withVersion && (typeof value.version !== 'string' || value.version.length === 0 || value.version.length > 64)) throw invalid();
    return { commandId: value.commandId, version: withVersion ? (value.version as string) : '' };
  }

  private first<T>(name: string, body: Record<string, unknown>): Promise<T | undefined> {
    return this.serverApi.rpc<T[]>(name, body).then((rows) => (Array.isArray(rows) ? rows[0] : undefined));
  }
}
