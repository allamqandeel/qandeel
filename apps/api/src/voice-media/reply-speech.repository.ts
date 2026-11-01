import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { SpeechExpression } from '../speech-rendering/speech-styles';

/**
 * S8B-04 (CP1, migration 0187) — a voice-note reply's speech channel and Listen, on the server channel only
 * (service_role). The human passed in is ALWAYS the verified token's (the owner's commands) or the turn's owner (the
 * orchestrator, right after the reply is committed). The database decides ownership, the gate, consent, eligibility,
 * the listen's shape and expiry, the in-flight bound, the attempt bound and every state and ledger transition; nothing
 * here caches an answer, and nothing here is logged. No text column is ever written: the reply is read from its turn.
 */
export type ReplySpeechExpression = SpeechExpression;
export interface StoredReplyHint { readonly offset: number; readonly word: string }
export type ReplyEligibilityRefusal = 'NOT_FOUND' | 'NOT_VOICE_REPLY' | 'NOT_AVAILABLE_NOW' | 'CONSENT_REQUIRED';
export type RecordChannelOutcome = 'RECORDED' | 'ALREADY_RECORDED' | 'NOT_VOICE_REPLY';
export interface ReplyForListenRow {
  readonly outcome: ReplyEligibilityRefusal | 'ELIGIBLE';
  readonly content: string | null;
  readonly expression: ReplySpeechExpression | null;
  readonly hints: StoredReplyHint[] | null;
}
export interface StartListenRow {
  readonly outcome: ReplyEligibilityRefusal | 'STARTED' | 'ALREADY_STARTED' | 'LISTEN_CONFLICT' | 'EXPIRED';
  readonly segment_count: number | null;
  readonly expires_at: string | null;
}
export interface AdmitSynthesisRow {
  readonly outcome: ReplyEligibilityRefusal | 'ADMITTED' | 'READY' | 'IN_PROGRESS' | 'FAILED' | 'BUSY';
  readonly call_id: string | null;
  readonly assistant_turn_id: string | null;
  readonly segment_count: number | null;
  readonly renderer_version: string | null;
  readonly content: string | null;
  readonly expression: ReplySpeechExpression | null;
  readonly hints: StoredReplyHint[] | null;
}
export type UsageCompleteness = 'COMPLETE' | 'ABSENT';
/** The ledger's usage counts as the provider reported them; empty when ABSENT (unknown, never zero). */
export type SpeechUsageForLedger = { readonly INPUT_TOKEN: number; readonly AUDIO_OUTPUT_TOKEN: number } | Record<string, never>;
export type CompleteSynthesisOutcome = 'READY' | 'DROPPED';
export type FailSynthesisOutcome = 'FAILED' | 'RETRYABLE' | 'DROPPED' | 'READY' | 'FAILED_UNKNOWN';
export type ReadAudioOutcome = ReplyEligibilityRefusal | 'READY' | 'IN_PROGRESS' | 'NOT_STARTED' | 'FAILED';
export interface ReadAudioRow { readonly outcome: ReadAudioOutcome; readonly audio: Buffer | null }
export interface CancelListenRow { readonly outcome: 'CANCELLED'; readonly deleted: number; readonly discarded: number }
export interface SweepRow { readonly leases_expired: number; readonly calls_settled: number; readonly segments_deleted: number }

/** PostgREST carries bytea as `\x` + hex, both ways. */
export function toByteaLiteral(bytes: Buffer): string {
  return `\\x${bytes.toString('hex')}`;
}
export function fromByteaLiteral(value: string | null): Buffer | null {
  if (value === null) return null;
  if (!/^\\x(?:[0-9a-f]{2})*$/iu.test(value)) throw new Error('REPLY_SPEECH_AUDIO_ENCODING');
  return Buffer.from(value.slice(2), 'hex');
}

@Injectable()
export class ReplySpeechRepository {
  constructor(private readonly serverApi: SupabaseServiceRoleApiService) {}

  private async first<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const rows = await this.serverApi.rpc<T[]>(name, body);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('REPLY_SPEECH_UNEXPECTED_SHAPE');
    return rows[0]!;
  }

  recordChannel(userId: string, assistantTurnId: string, expression: ReplySpeechExpression, hints: readonly StoredReplyHint[]) {
    return this.first<{ outcome: RecordChannelOutcome }>('server_record_reply_speech_channel_v1', {
      p_user_id: userId, p_assistant_turn_id: assistantTurnId, p_expression: expression, p_hints: hints,
    });
  }

  readForListen(userId: string, assistantTurnId: string) {
    return this.first<ReplyForListenRow>('server_read_reply_for_listen_v1', { p_user_id: userId, p_assistant_turn_id: assistantTurnId });
  }

  startListen(userId: string, assistantTurnId: string, listenId: string, segmentCount: number, rendererVersion: string) {
    return this.first<StartListenRow>('server_start_reply_listen_v1', {
      p_user_id: userId, p_assistant_turn_id: assistantTurnId, p_listen_id: listenId,
      p_segment_count: segmentCount, p_renderer_version: rendererVersion,
    });
  }

  admitSynthesis(userId: string, listenId: string, segmentIndex: number, callId: string, model: string, leaseSeconds: number) {
    return this.first<AdmitSynthesisRow>('server_admit_reply_speech_synthesis_v1', {
      p_user_id: userId, p_listen_id: listenId, p_segment_index: segmentIndex, p_call_id: callId,
      p_requested_model: model, p_lease_seconds: leaseSeconds,
    });
  }

  retrySynthesis(userId: string, listenId: string, segmentIndex: number, failedCallId: string, callId: string, model: string, leaseSeconds: number) {
    return this.first<{ outcome: 'RETRY_BEGUN' | 'NOT_ALLOWED' }>('server_retry_reply_speech_synthesis_v1', {
      p_user_id: userId, p_listen_id: listenId, p_segment_index: segmentIndex, p_failed_call_id: failedCallId,
      p_call_id: callId, p_requested_model: model, p_lease_seconds: leaseSeconds,
    });
  }

  completeSynthesis(userId: string, callId: string, audio: Buffer, completeness: UsageCompleteness, usage: SpeechUsageForLedger) {
    return this.first<{ outcome: CompleteSynthesisOutcome }>('server_complete_reply_speech_synthesis_v1', {
      p_user_id: userId, p_call_id: callId, p_audio: toByteaLiteral(audio), p_usage_completeness: completeness, p_usage: usage,
    });
  }

  failSynthesis(userId: string, callId: string, outcome: 'FAILED' | 'CANCELLED_BEFORE_PROVIDER', completeness: UsageCompleteness,
    usage: SpeechUsageForLedger, final: boolean) {
    return this.first<{ outcome: FailSynthesisOutcome }>('server_fail_reply_speech_synthesis_v1', {
      p_user_id: userId, p_call_id: callId, p_outcome: outcome, p_usage_completeness: completeness, p_usage: usage, p_final: final,
    });
  }

  async readAudio(userId: string, listenId: string, segmentIndex: number): Promise<ReadAudioRow> {
    const row = await this.first<{ outcome: ReadAudioOutcome; audio: string | null }>('server_read_reply_speech_audio_v1', {
      p_user_id: userId, p_listen_id: listenId, p_segment_index: segmentIndex,
    });
    return { outcome: row.outcome, audio: fromByteaLiteral(row.audio) };
  }

  cancelListen(userId: string, listenId: string) {
    return this.first<CancelListenRow>('server_cancel_reply_listen_v1', { p_user_id: userId, p_listen_id: listenId });
  }

  sweep(limit: number) {
    return this.first<SweepRow>('server_sweep_reply_speech_v1', { p_limit: limit });
  }
}
