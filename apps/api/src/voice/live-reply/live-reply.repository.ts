import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import { fromByteaLiteral, toByteaLiteral } from '../../voice-media/reply-speech.repository';
import type { SpeechSynthesisUsage } from '../speech-synthesis.adapter';
import type { LiveReplyState, LiveReplyStore, LiveSegmentAttemptOutcome, LiveSegmentState, StoredLiveReply } from './live-reply.store';

/**
 * S8B-04 (CP2, migration 0188) — the automatic voice reply's durable side, on the server channel only (service_role). The
 * human passed in is always the turn's owner (the runner) or the verified token's (the owner's routes). The database
 * decides ownership, the gate, consent, the one-reply-per-turn rule, the synthesizing bound, the attempt bound, every
 * segment and ledger transition and the final length; nothing here caches an answer, and nothing here is logged. No text
 * column exists: only PCM, for 15 minutes.
 */
@Injectable()
export class LiveReplyRepository implements LiveReplyStore {
  constructor(private readonly serverApi: SupabaseServiceRoleApiService) {}

  private async first<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const rows = await this.serverApi.rpc<T[]>(name, body);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('LIVE_REPLY_UNEXPECTED_SHAPE');
    return rows[0]!;
  }

  async open(input: { userId: string; replyId: string; sessionId: string; sourceTurnId: string }) {
    const row = await this.first<{ outcome: 'OPENED' | 'REFUSED' }>('server_open_live_reply_v1', {
      p_user_id: input.userId, p_reply_id: input.replyId, p_session_id: input.sessionId, p_source_turn_id: input.sourceTurnId,
    });
    return row.outcome;
  }

  async admitSegment(input: { userId: string; replyId: string; index: number; callId: string; model: string; spokenChars: number; leaseSeconds: number }) {
    const row = await this.first<{ outcome: 'ADMITTED' | 'BUSY' | 'GONE' }>('server_admit_live_reply_segment_v1', {
      p_user_id: input.userId, p_reply_id: input.replyId, p_segment_index: input.index, p_call_id: input.callId,
      p_requested_model: input.model, p_spoken_chars: input.spokenChars, p_lease_seconds: input.leaseSeconds,
    });
    return row.outcome;
  }

  async retrySegment(input: { userId: string; replyId: string; index: number; previousCallId: string; callId: string; model: string; leaseSeconds: number }) {
    const row = await this.first<{ outcome: 'RETRY_BEGUN' | 'GONE' }>('server_retry_live_reply_segment_v1', {
      p_user_id: input.userId, p_reply_id: input.replyId, p_segment_index: input.index, p_previous_call_id: input.previousCallId,
      p_call_id: input.callId, p_requested_model: input.model, p_lease_seconds: input.leaseSeconds,
    });
    return row.outcome;
  }

  async completeSegment(input: { userId: string; callId: string; pcm: Buffer; usage: SpeechSynthesisUsage }) {
    const usage = input.usage.completeness === 'COMPLETE'
      ? { INPUT_TOKEN: input.usage.inputTokens, AUDIO_OUTPUT_TOKEN: input.usage.audioOutputTokens }
      : {};
    const row = await this.first<{ outcome: 'READY' | 'GONE' }>('server_complete_live_reply_segment_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_pcm: toByteaLiteral(input.pcm),
      p_usage_completeness: input.usage.completeness, p_usage: usage,
    });
    return row.outcome;
  }

  async failSegment(input: { userId: string; callId: string; outcome: LiveSegmentAttemptOutcome; final: boolean }) {
    const row = await this.first<{ outcome: 'RETRYABLE' | 'FAILED' }>('server_fail_live_reply_segment_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_outcome: input.outcome, p_final: input.final,
    });
    return row.outcome;
  }

  async finish(input: { userId: string; replyId: string; state: Exclude<LiveReplyState, 'STREAMING'>; segmentCount: number; audioMs: number; assistantTurnId: string | null }) {
    await this.first<{ outcome: string }>('server_finish_live_reply_v1', {
      p_user_id: input.userId, p_reply_id: input.replyId, p_state: input.state, p_segment_count: input.segmentCount,
      p_audio_ms: input.audioMs, p_assistant_turn_id: input.assistantTurnId,
    });
  }

  async read(userId: string, replyId: string): Promise<StoredLiveReply | null> {
    const rows = await this.serverApi.rpc<Array<{
      state: LiveReplyState; segment_count: number | null; audio_ms: number | string | null; assistant_turn_id: string | null;
      segments: { index: number; state: LiveSegmentState }[];
    }>>('server_read_live_reply_v1', { p_user_id: userId, p_reply_id: replyId });
    if (!Array.isArray(rows)) throw new Error('LIVE_REPLY_UNEXPECTED_SHAPE');
    const row = rows[0];
    if (!row) return null;
    return {
      state: row.state, segmentCount: row.segment_count, audioMs: row.audio_ms === null ? null : Number(row.audio_ms),
      assistantTurnId: row.assistant_turn_id, segments: row.segments,
    };
  }

  async readSegmentPcm(userId: string, replyId: string, index: number): Promise<Buffer | null> {
    const row = await this.first<{ outcome: string; pcm: string | null }>('server_read_live_reply_segment_v1', {
      p_user_id: userId, p_reply_id: replyId, p_segment_index: index,
    });
    return row.outcome === 'READY' ? fromByteaLiteral(row.pcm) : null;
  }
}
