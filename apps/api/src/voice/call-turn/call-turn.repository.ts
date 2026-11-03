import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import type {
  BargeInResult, CallTurnStore, CloseResult, CommitInput, CommitOutcome, CommitResult, DeliveryState, GenerationEnd, OpenExchange, PlayoutResult,
  ProviderSettleOutcome, SafetyDisposition, TextReplyState,
} from './call-turn.store';

const toNumber = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const toText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * S8B-05 CP2 (migration 0190) — the call turn authority on the server channel only. Every answer is the database's; a shape
 * it did not promise is an error, never a guess. The words of a turn or a reply segment travel to the database and
 * nowhere else; nothing here logs.
 */
@Injectable()
export class CallTurnRepository implements CallTurnStore {
  constructor(private readonly serverApi: SupabaseServiceRoleApiService) {}

  private async first<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const rows = await this.serverApi.rpc<T[]>(name, body);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('CALL_TURN_UNEXPECTED_SHAPE');
    return rows[0]!;
  }

  async commit(input: CommitInput): Promise<CommitResult> {
    const row = await this.first<{
      outcome: CommitOutcome; call_turn_index: unknown; turn_id: unknown; closed_call_turn_index: unknown; closed_assistant_turn_id: unknown;
      closed_delivery_state: unknown; closed_heard_mark_ms: unknown;
    }>('server_commit_live_call_turn_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_turn_id: input.turnId, p_commit_id: input.commitId,
      p_turn_channel: input.channel, p_content: input.content, p_asr_confidence_band: input.band, p_anchor_start_ms: input.anchorStartMs,
      p_anchor_end_ms: input.anchorEndMs, p_retrieval_terms: input.terms, p_close_assistant_turn_id: input.closeAssistantTurnId,
      p_close_event_id: input.closeEventId,
    });
    const closedIndex = toNumber(row.closed_call_turn_index);
    return {
      outcome: row.outcome, callTurnIndex: toNumber(row.call_turn_index), turnId: toText(row.turn_id),
      closed: closedIndex === null ? null : {
        callTurnIndex: closedIndex, assistantTurnId: String(row.closed_assistant_turn_id), deliveryState: row.closed_delivery_state as DeliveryState,
        heardMarkMs: Number(row.closed_heard_mark_ms ?? 0),
      },
    };
  }

  async storeSafety(input: { userId: string; callId: string; callTurnIndex: number; disposition: SafetyDisposition }) {
    const row = await this.first<{ outcome: 'STORED' | 'SAME' | 'NOT_FOUND' }>('server_store_call_turn_safety_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_call_turn_index: input.callTurnIndex, p_safety_disposition: input.disposition,
    });
    return row.outcome;
  }

  async registerSegment(input: {
    userId: string; callId: string; epoch: number; callTurnIndex: number; seq: number; text: string; startMs: number; endMs: number; terms: readonly string[];
  }) {
    const row = await this.first<{ outcome: 'REGISTERED' | 'CLOSED' | 'FENCED' | 'NOT_FOUND' }>('server_register_call_reply_segment_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_call_turn_index: input.callTurnIndex, p_segment_seq: input.seq,
      p_segment_text: input.text, p_start_offset_ms: input.startMs, p_end_offset_ms: input.endMs, p_retrieval_terms: input.terms,
    });
    return row.outcome;
  }

  async finishGeneration(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; state: GenerationEnd; producedMs: number }) {
    const row = await this.first<{ outcome: string }>('server_finish_call_reply_generation_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_call_turn_index: input.callTurnIndex,
      p_generation_state: input.state, p_produced_audio_ms: input.producedMs,
    });
    return row.outcome;
  }

  async confirmPlayout(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; playedMs: number; clockStartMs: number | null }): Promise<PlayoutResult> {
    const row = await this.first<{ outcome: PlayoutResult['outcome']; playout_mark_ms: unknown; reply_clock_start_ms: unknown }>('server_confirm_call_playout_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_call_turn_index: input.callTurnIndex, p_played_ms: input.playedMs,
      p_reply_clock_start_ms: input.clockStartMs,
    });
    return { outcome: row.outcome, markMs: toNumber(row.playout_mark_ms), clockStartMs: toNumber(row.reply_clock_start_ms) };
  }

  async close(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; reason: string; assistantTurnId: string; eventId: string }): Promise<CloseResult> {
    const row = await this.first<{ outcome: CloseResult['outcome']; assistant_turn_id: unknown; delivery_state: unknown; heard_mark_ms: unknown }>(
      'server_close_live_call_exchange_v1', {
        p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_call_turn_index: input.callTurnIndex, p_reason: input.reason,
        p_assistant_turn_id: input.assistantTurnId, p_event_id: input.eventId,
      });
    return {
      outcome: row.outcome, assistantTurnId: toText(row.assistant_turn_id), deliveryState: toText(row.delivery_state) as DeliveryState | null,
      heardMarkMs: toNumber(row.heard_mark_ms),
    };
  }

  async recordBargeIn(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; captureMs: number }): Promise<BargeInResult> {
    const row = await this.first<{ outcome: BargeInResult['outcome']; barge_in_capture_ms: unknown }>('server_record_call_barge_in_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_call_turn_index: input.callTurnIndex, p_capture_ms: input.captureMs,
    });
    return { outcome: row.outcome, captureMs: toNumber(row.barge_in_capture_ms) };
  }

  async closeText(input: {
    userId: string; callId: string; callTurnIndex: number; state: TextReplyState; text: string; terms: readonly string[]; assistantTurnId: string; eventId: string;
  }): Promise<CloseResult> {
    const row = await this.first<{ outcome: CloseResult['outcome']; assistant_turn_id: unknown; delivery_state: unknown }>('server_close_live_call_text_exchange_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_call_turn_index: input.callTurnIndex, p_reply_state: input.state, p_reply_text: input.text,
      p_retrieval_terms: input.terms, p_assistant_turn_id: input.assistantTurnId, p_event_id: input.eventId,
    });
    return { outcome: row.outcome, assistantTurnId: toText(row.assistant_turn_id), deliveryState: toText(row.delivery_state) as DeliveryState | null, heardMarkMs: 0 };
  }

  async readOpenExchange(input: { userId: string; callId: string; epoch: number }): Promise<OpenExchange> {
    const row = await this.first<{
      outcome: OpenExchange['outcome']; call_turn_index: unknown; user_turn_id: unknown; content: unknown; turn_channel: unknown; safety_disposition: unknown;
    }>('server_read_open_call_exchange_v1', { p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch });
    return {
      outcome: row.outcome, callTurnIndex: toNumber(row.call_turn_index), userTurnId: toText(row.user_turn_id), content: toText(row.content),
      channel: toText(row.turn_channel) as OpenExchange['channel'], safety: toText(row.safety_disposition) as SafetyDisposition | null,
    };
  }

  async beginSpeech(input: { userId: string; callId: string; epoch: number; callTurnIndex: number; providerCallId: string; model: string }) {
    const row = await this.first<{ outcome: string }>('server_begin_call_reply_speech_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_call_turn_index: input.callTurnIndex,
      p_provider_call_id: input.providerCallId, p_requested_model: input.model,
    });
    return row.outcome;
  }

  async beginTranscription(input: { userId: string; callId: string; epoch: number; providerCallId: string; model: string }) {
    const row = await this.first<{ outcome: string }>('server_begin_call_transcription_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_provider_call_id: input.providerCallId,
      p_requested_model: input.model,
    });
    return row.outcome;
  }

  async settle(input: { userId: string; providerCallId: string; outcome: ProviderSettleOutcome; completeness: 'COMPLETE' | 'INCOMPLETE' | 'ABSENT'; usage: Record<string, number> }) {
    const row = await this.first<{ outcome: string }>('server_settle_call_provider_call_v1', {
      p_user_id: input.userId, p_provider_call_id: input.providerCallId, p_outcome: input.outcome, p_usage_completeness: input.completeness,
      p_usage: input.usage,
    });
    return row.outcome;
  }
}
