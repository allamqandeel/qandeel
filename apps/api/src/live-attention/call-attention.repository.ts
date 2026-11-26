// INTEL-LIVE-01 CP1 — the provisional attention lane's ONE seam over migration 0204's service_role commands.
//
// Identity, clock positions, short labels and closed outcomes cross it; never a transcript, never an INTERIM, never audio.
// Nothing is logged.

import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import {
  ATTENTION_CONFIDENCES, ATTENTION_KINDS, type AttentionThread, type AttentionTrack, type OpenSubject, type RecordedOutcome,
} from './provisional-attention.types';

/** One event as the writer stores it (0204 `p_events`): the producer's three instants on the call clock. */
export interface AttentionEventInput {
  readonly op: 'SET' | 'WITHDRAW';
  readonly subjectKey: string;
  readonly label: string;
  readonly kind: OpenSubject['kind'];
  readonly confidence: OpenSubject['confidence'];
  readonly threadRef: string | null;
  readonly anchorClockMs: number;
  readonly evidenceClockMs: number;
}

export interface AttentionRecordInput {
  readonly userId: string;
  readonly callId: string;
  readonly epoch: number;
  readonly track: AttentionTrack;
  readonly coversFromClockMs: number;
  readonly coversToClockMs: number;
  readonly outcome: RecordedOutcome;
  readonly admittedClockMs: number | null;
  readonly producedClockMs: number | null;
  readonly providerMs: number | null;
  readonly promptTokens: number | null;
  readonly cacheHitTokens: number | null;
  readonly completionTokens: number | null;
  readonly events: readonly AttentionEventInput[] | null;
}

export type AttentionWriteOutcome =
  | 'RECORDED' | 'ALREADY_COVERED' | 'STALE_RESULT' | 'STALE_AFTER_SETTLEMENT' | 'STALE_AFTER_END' | 'FENCED' | 'NOT_FOUND';

export interface AttentionRecordResult {
  readonly outcome: AttentionWriteOutcome;
  /** The track's accounted position after the write (null when nothing was written: FENCED / NOT_FOUND). */
  readonly accountedToClockMs: number | null;
  readonly firstEventSeq: number | null;
  readonly lastEventSeq: number | null;
}

export interface AttentionTrackState {
  readonly track: AttentionTrack;
  readonly accountedToClockMs: number;
  readonly settledThroughClockMs: number;
  readonly callEnded: boolean;
  readonly openSubjects: readonly OpenSubject[];
  /** INTEL-LIVE-01 CP2: each open subject's event_seq (its latest SET), in openSubjects' order. */
  readonly openEventSeqs: readonly number[];
  /** INTEL-LIVE-01 CP2: the call's highest event_seq in the same read (0 when none). */
  readonly lastEventSeq: number;
}

export interface CallAttentionStore {
  record(input: AttentionRecordInput): Promise<AttentionRecordResult>;
  /** Both tracks' positions and open subjects; empty when the call is not the person's. */
  readState(userId: string, callId: string): Promise<readonly AttentionTrackState[]>;
  readThreads(userId: string, callId: string, limit: number): Promise<readonly AttentionThread[]>;
}

export interface CallAttentionSettlementStore {
  settle(userId: string, callId: string, callTurnIndex: number, half: 'USER' | 'ASSISTANT'): Promise<{
    readonly outcome: 'SETTLED' | 'ALREADY_SETTLED' | 'NOT_READY' | 'NOT_FOUND'; readonly confirmed: number; readonly expired: number;
  }>;
  settleDue(limit: number): Promise<number>;
}

/** INTEL-LIVE-01 CP2: one half the sweep settled, by call (so the phones of that call hear of it). */
export interface SettledDueHalf {
  readonly callId: string;
  readonly outcome: string;
  readonly confirmed: number;
  readonly expired: number;
}

const WRITE_OUTCOMES: ReadonlySet<string> = new Set<AttentionWriteOutcome>([
  'RECORDED', 'ALREADY_COVERED', 'STALE_RESULT', 'STALE_AFTER_SETTLEMENT', 'STALE_AFTER_END', 'FENCED', 'NOT_FOUND',
]);
const first = <T>(rows: unknown): T | undefined => (Array.isArray(rows) ? (rows[0] as T | undefined) : undefined);
const num = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('The attention authority returned a malformed number.');
  return n;
};

export class CallAttentionRepository implements CallAttentionStore, CallAttentionSettlementStore {
  constructor(private readonly serviceApi: Pick<SupabaseServiceRoleApiService, 'rpc'>) {}

  async record(input: AttentionRecordInput): Promise<AttentionRecordResult> {
    const row = first<{ outcome: string; accounted_to_clock_ms: unknown; first_event_seq: unknown; last_event_seq: unknown }>(
      await this.serviceApi.rpc('server_record_call_attention_evaluation_v1', {
        p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_track: input.track,
        p_covers_from_clock_ms: input.coversFromClockMs, p_covers_to_clock_ms: input.coversToClockMs, p_outcome: input.outcome,
        p_admitted_clock_ms: input.admittedClockMs, p_produced_clock_ms: input.producedClockMs, p_provider_ms: input.providerMs,
        p_prompt_tokens: input.promptTokens, p_cache_hit_tokens: input.cacheHitTokens, p_completion_tokens: input.completionTokens,
        p_events: input.events,
      }),
    );
    if (!row || !WRITE_OUTCOMES.has(row.outcome)) throw new Error('The attention writer returned an unknown outcome.');
    return {
      outcome: row.outcome as AttentionWriteOutcome, accountedToClockMs: num(row.accounted_to_clock_ms),
      firstEventSeq: num(row.first_event_seq), lastEventSeq: num(row.last_event_seq),
    };
  }

  async readState(userId: string, callId: string): Promise<readonly AttentionTrackState[]> {
    const rows = await this.serviceApi.rpc<{
      track: string; accounted_to_clock_ms: unknown; settled_through_clock_ms: unknown; last_event_seq: unknown; call_ended: boolean;
      open_subjects: unknown;
    }[]>('server_read_call_attention_state_v1', { p_user_id: userId, p_call_id: callId });
    return (Array.isArray(rows) ? rows : []).map((row) => {
      if (row.track !== 'USER' && row.track !== 'QANDEEL') throw new Error('The attention state named an unknown track.');
      const open = Array.isArray(row.open_subjects) ? row.open_subjects : [];
      return {
        track: row.track, accountedToClockMs: num(row.accounted_to_clock_ms) ?? 0,
        settledThroughClockMs: num(row.settled_through_clock_ms) ?? -1, callEnded: row.call_ended === true,
        openSubjects: open.map(openSubject),
        openEventSeqs: open.map((o) => {
          const seq = num((o as { eventSeq?: unknown } | null)?.eventSeq);
          if (seq === null || seq < 1) throw new Error('The attention state returned a subject without its event number.');
          return seq;
        }),
        lastEventSeq: num(row.last_event_seq) ?? 0,
      };
    });
  }

  async readThreads(userId: string, callId: string, limit: number): Promise<readonly AttentionThread[]> {
    const rows = await this.serviceApi.rpc<{ thread_id: string; name: string }[]>('server_read_call_attention_threads_v1', {
      p_user_id: userId, p_call_id: callId, p_limit: limit,
    });
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => typeof row.thread_id === 'string' && typeof row.name === 'string')
      .map((row) => ({ id: row.thread_id, name: row.name }));
  }

  async settle(userId: string, callId: string, callTurnIndex: number, half: 'USER' | 'ASSISTANT') {
    const row = first<{ outcome: string; confirmed: number; expired: number }>(await this.serviceApi.rpc('server_settle_call_attention_v1', {
      p_user_id: userId, p_call_id: callId, p_call_turn_index: callTurnIndex, p_half: half,
    }));
    if (!row || !['SETTLED', 'ALREADY_SETTLED', 'NOT_READY', 'NOT_FOUND'].includes(row.outcome)) {
      throw new Error('The attention settlement returned an unknown outcome.');
    }
    return { outcome: row.outcome as 'SETTLED' | 'ALREADY_SETTLED' | 'NOT_READY' | 'NOT_FOUND', confirmed: row.confirmed, expired: row.expired };
  }

  async settleDue(limit: number): Promise<number> {
    return (await this.settleDueHalves(limit)).length;
  }

  /** INTEL-LIVE-01 CP2: the sweep, with each half it settled named by its call. */
  async settleDueHalves(limit: number): Promise<readonly SettledDueHalf[]> {
    const rows = await this.serviceApi.rpc<{ call_id: string; outcome: string; confirmed: number; expired: number }[]>(
      'server_settle_due_call_attention_v1', { p_limit: limit },
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      callId: row.call_id, outcome: row.outcome, confirmed: Number(row.confirmed) || 0, expired: Number(row.expired) || 0,
    }));
  }
}

function openSubject(raw: unknown): OpenSubject {
  const o = raw as Record<string, unknown>;
  if (!o || typeof o.subjectKey !== 'string' || typeof o.label !== 'string'
    || !(ATTENTION_KINDS as readonly unknown[]).includes(o.kind) || !(ATTENTION_CONFIDENCES as readonly unknown[]).includes(o.confidence)
    || (o.threadRef !== null && typeof o.threadRef !== 'string')) {
    throw new Error('The attention state returned a malformed subject.');
  }
  return {
    subjectKey: o.subjectKey, label: o.label, kind: o.kind as OpenSubject['kind'], confidence: o.confidence as OpenSubject['confidence'],
    threadRef: (o.threadRef as string | null) ?? null,
  };
}
