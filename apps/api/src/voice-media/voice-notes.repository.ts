import type { MemoryCommandVoiceBand, MemoryCommandVoiceSource } from '../memory/memory-control.types';
import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/**
 * S8B-03 (CP1, migration 0186) — the transcription, Voice Note turn and voice consent definers, on the server channel
 * only (service_role). The human passed in is ALWAYS the verified token's (owner-facing reads and acts) or the one a
 * claimed note belongs to (the worker). The database decides ownership, readability, consent, the gate, the attempt
 * bounds and every state transition; nothing here caches an answer, and nothing here is logged.
 */
export type ClaimedNoteState = 'PENDING' | 'IN_PROGRESS' | 'DELETION_PENDING';
export interface ClaimedNoteRow {
  readonly recording_id: string;
  readonly user_id: string;
  readonly session_id: string;
  readonly byte_size: number | string | null;
  readonly state: ClaimedNoteState;
  readonly duration_ms: number | string | null;
  readonly attempts_total: number;
  readonly attempt_id: string | null;
  readonly attempt_state: 'SUBMITTED' | 'OUTCOME_UNKNOWN' | null;
  readonly provider_job_id: string | null;
  readonly unknown_since: string | null;
  readonly submitted_at: string | null;
  readonly deletion_attempt_ids: string[] | null;
  readonly deletion_job_ids: string[] | null;
}
export type LeaseOutcome = 'LEASE_LOST' | 'CANCELLED' | 'RELEASED' | 'CONSENT_WITHDRAWN' | 'RENEWED';
export type BeginSubmissionOutcome = 'SUBMITTING' | 'ALREADY_BEGUN' | 'LEASE_LOST' | 'NOT_CLAIMABLE' | 'CANCELLED' | 'NOT_AVAILABLE_NOW'
  | 'HELD_CONSENT' | 'ATTEMPTS_EXHAUSTED' | 'UNAVAILABLE';
export type RecordSubmissionOutcome = 'RECORDED' | 'ALREADY_RECORDED' | 'RECORDED_FOR_DELETION' | 'NOT_SUBMITTING' | 'NOTE_MOVED_ON' | 'UNAVAILABLE';
export type ProviderDeletionReport = 'REQUESTED' | 'ABSENT' | 'LOCKED' | 'TRANSIENT' | 'STILL_PRESENT';
export interface DeletionDueRow {
  readonly attempt_id: string;
  readonly provider_job_id: string;
  readonly provider_deletion_state: string;
  readonly deletion_attempts: number;
}
export interface NoteStatusRow {
  readonly session_id: string;
  readonly state: string;
  readonly failure_class: string | null;
  readonly can_retry: boolean;
  readonly committed_turn_id: string | null;
  readonly accepted_at: string | null;
  readonly available_until: string | null;
  readonly recording_available: boolean;
  readonly duration_ms: number | string | null;
}
export interface PendingNoteRow {
  readonly recording_id: string;
  readonly state: string;
  readonly accepted_at: string | null;
  readonly available_until: string | null;
  readonly duration_ms: number | string | null;
}
export interface SessionVoiceTurnRow {
  readonly turn_id: string;
  readonly recording_id: string;
  readonly available: boolean;
  readonly available_until: string | null;
  readonly duration_ms: number | string | null;
}
export interface VoiceCapabilityRow {
  readonly voice_notes_available: boolean;
  readonly consent_state: string;
  readonly consent_version: string | null;
  readonly current_version: string | null;
}
export interface VoiceConsentTextRow {
  readonly consent_version: string;
  readonly text_ar: string;
  readonly text_en: string;
  readonly text_ar_sha256: string;
  readonly text_en_sha256: string;
}
export type CommitVoiceTurnOutcome = 'COMMITTED' | 'ALREADY_COMMITTED' | 'UNAVAILABLE' | 'SESSION_NOT_ACTIVE' | 'NOT_READY'
  | 'NOT_AVAILABLE_NOW' | 'CONSENT_REQUIRED' | 'COMMAND_CONFLICT' | 'ADMISSION_LIMITED';
export interface CommitVoiceTurnRow { readonly outcome: CommitVoiceTurnOutcome; readonly turn_id: string | null; readonly session_id: string | null }
/** A terminal attempt whose ledger row is still PENDING after the grace: durable facts only (no job id, text or band). */
export interface UnsettledAttemptRow {
  readonly attempt_id: string;
  readonly user_id: string;
  readonly attempt_state: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  readonly failure_class: string | null;
  readonly duration_ms: number | string | null;
}
export type LedgerSettlement =
  | { readonly outcome: 'SUCCEEDED'; readonly audioInputMs: number; readonly source: 'PROVIDER_REPORTED' | 'GATEWAY_MEASURED' }
  | { readonly outcome: 'FAILED' | 'CANCELLED_BEFORE_PROVIDER' };

@Injectable()
export class VoiceNotesRepository {
  constructor(private readonly serverApi: SupabaseServiceRoleApiService) {}

  private first<T>(name: string, body: Record<string, unknown>): Promise<T | undefined> {
    return this.serverApi.rpc<T[]>(name, body).then((rows) => (Array.isArray(rows) ? rows[0] : undefined));
  }

  private all<T>(name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.serverApi.rpc<T[]>(name, body).then((rows) => (Array.isArray(rows) ? rows : []));
  }

  // ---------------------------------------------------------------- the worker
  claim(worker: string, leaseSeconds: number, limit: number) {
    return this.all<ClaimedNoteRow>('server_claim_voice_note_transcription_v1', { p_worker: worker, p_lease_seconds: leaseSeconds, p_limit: limit });
  }

  renewLease(recordingId: string, worker: string, leaseSeconds: number) {
    return this.first<{ outcome: LeaseOutcome }>('server_renew_voice_note_transcription_lease_v1', { p_recording_id: recordingId, p_worker: worker, p_lease_seconds: leaseSeconds });
  }

  beginSubmission(recordingId: string, worker: string, attemptId: string, durationMs: number) {
    return this.first<{ outcome: BeginSubmissionOutcome; ordinal: number | null }>('server_begin_voice_note_submission_v1', {
      p_recording_id: recordingId, p_worker: worker, p_attempt_id: attemptId, p_duration_ms: durationMs,
    });
  }

  recordSubmission(attemptId: string, outcome: 'CREATED' | 'UNKNOWN', providerJobId: string | null) {
    return this.first<{ outcome: RecordSubmissionOutcome }>('server_record_voice_note_submission_v1', { p_attempt_id: attemptId, p_outcome: outcome, p_provider_job_id: providerJobId });
  }

  recordTranscript(attemptId: string, outcome: 'TRANSCRIBED' | 'NO_SPEECH', transcript: string | null, band: string | null,
    uncertainTokens: readonly string[] | null, providerDurationMs: number | null) {
    return this.first<{ outcome: string; state: string | null }>('server_record_voice_note_transcript_v1', {
      p_attempt_id: attemptId, p_outcome: outcome, p_transcript: transcript, p_band: band,
      p_uncertain_tokens: uncertainTokens, p_provider_duration_ms: providerDurationMs,
    });
  }

  recordProviderDeletion(attemptId: string, outcome: ProviderDeletionReport) {
    return this.first<{ outcome: string; provider_deletion_state: string | null; note_state: string | null }>('server_record_voice_note_provider_deletion_v1', {
      p_attempt_id: attemptId, p_outcome: outcome,
    });
  }

  recordFailure(recordingId: string, worker: string, attemptId: string | null, failureClass: string) {
    return this.first<{ outcome: string; state: string | null }>('server_record_voice_note_transcription_failure_v1', {
      p_recording_id: recordingId, p_worker: worker, p_attempt_id: attemptId, p_failure_class: failureClass,
    });
  }

  holdForConsent(recordingId: string) {
    return this.first<{ outcome: string; state: string | null }>('server_hold_voice_note_for_consent_v1', { p_recording_id: recordingId });
  }

  deletionsDue(limit: number) {
    return this.all<DeletionDueRow>('server_list_voice_note_deletions_due_v1', { p_limit: limit });
  }

  /** The attempts whose own settlement did not land (record §5 decision 5): read-only, bounded by `limit`. */
  unsettledAttempts(graceSeconds: number, limit: number) {
    return this.all<UnsettledAttemptRow>('server_list_voice_note_unsettled_attempts_v1', { p_grace_seconds: graceSeconds, p_limit: limit });
  }

  /** The ledger row of one attempt (its id is the call id), settled once; a replay with the same facts is ALREADY_SETTLED. */
  settleAttempt(attemptId: string, userId: string, settlement: LedgerSettlement) {
    const usage = settlement.outcome === 'SUCCEEDED' ? { AUDIO_INPUT_MS: Math.max(0, Math.round(settlement.audioInputMs)) } : {};
    return this.first<{ settle_outcome: string; call_state: string }>('settle_ai_provider_call_v2', {
      p_call_id: attemptId, p_user_id: userId, p_outcome: settlement.outcome,
      p_usage_completeness: settlement.outcome === 'SUCCEEDED' ? 'COMPLETE' : 'ABSENT', p_usage: usage,
      p_usage_source: settlement.outcome === 'SUCCEEDED' ? settlement.source : 'PROVIDER_REPORTED',
    });
  }

  /** E13: the database's band constants, read once at startup. */
  readMachineAsrConfidence() {
    return this.first<{ high: number; medium: number }>('server_read_machine_asr_memory_confidence_v1', {});
  }

  /**
   * E8: the voice source of a Memory command - the band of this turn and of the turn whose words are kept (the turn that
   * asked `commandId`, else this one). A malformed answer throws: a Memory command never guesses its source.
   */
  async memoryCommandVoice(userId: string, sessionId: string, turnId: string, commandId: string | undefined): Promise<MemoryCommandVoiceSource> {
    const row = await this.first<{ turn_voice: unknown; turn_band: unknown; origin_voice: unknown; origin_band: unknown }>(
      'server_read_memory_command_voice_v1', { p_user_id: userId, p_session_id: sessionId, p_turn_id: turnId, p_command_id: commandId ?? null });
    if (!row) throw new Error('VOICE_MEMORY_COMMAND_SOURCE_UNAVAILABLE');
    const band = (voice: unknown, value: unknown): MemoryCommandVoiceBand | null => {
      if (voice === false && value === null) return null;
      if (voice === true && (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW')) return value;
      throw new Error('VOICE_MEMORY_COMMAND_SOURCE_INTEGRITY');
    };
    return { turnBand: band(row.turn_voice, row.turn_band), originBand: band(row.origin_voice, row.origin_band) };
  }

  // ---------------------------------------------------------------- the owner
  retry(userId: string, recordingId: string) {
    return this.first<{ outcome: 'RETRY_SCHEDULED' | 'NOT_RETRYABLE' | 'UNAVAILABLE' | 'NOT_AVAILABLE_NOW' }>('server_retry_voice_note_transcription_v1', {
      p_user_id: userId, p_recording_id: recordingId,
    });
  }

  status(userId: string, recordingId: string) {
    return this.first<NoteStatusRow>('server_read_voice_note_status_v1', { p_user_id: userId, p_recording_id: recordingId });
  }

  pending(userId: string, sessionId: string) {
    return this.all<PendingNoteRow>('server_list_session_pending_voice_notes_v1', { p_user_id: userId, p_session_id: sessionId });
  }

  sessionVoiceTurns(userId: string, sessionId: string, turnIds: readonly string[]) {
    return this.all<SessionVoiceTurnRow>('server_read_session_voice_turns_v1', { p_user_id: userId, p_session_id: sessionId, p_turn_ids: turnIds });
  }

  capability(userId: string) {
    return this.first<VoiceCapabilityRow>('server_read_my_voice_note_capability_v1', { p_user_id: userId });
  }

  consentText() {
    return this.first<VoiceConsentTextRow>('server_read_voice_consent_text_v1', {});
  }

  commitTurn(userId: string, recordingId: string) {
    return this.first<CommitVoiceTurnRow>('server_commit_voice_note_turn_v1', { p_user_id: userId, p_recording_id: recordingId });
  }
}
