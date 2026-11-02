import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import type { CallState } from './live-call.protocol';
import type {
  ActivateOutcome, BeginOutcome, CallTruth, EndOutcome, GapKind, HeartbeatOutcome, LiveCallStore, ResumeOutcome, SuspendOutcome, TrackState,
} from './live-call.store';

const toNumber = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const toText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * S8B-05 CP1 (migration 0189) — the call authority on the server channel only. Every answer is the database's; a shape it
 * did not promise is an error, never a guess. Nothing here carries audio, words or a token.
 */
@Injectable()
export class LiveCallRepository implements LiveCallStore {
  constructor(private readonly serverApi: SupabaseServiceRoleApiService) {}

  private async rows<T>(name: string, body: Record<string, unknown>): Promise<T[]> {
    const rows = await this.serverApi.rpc<T[]>(name, body);
    if (!Array.isArray(rows)) throw new Error('LIVE_CALL_UNEXPECTED_SHAPE');
    return rows;
  }

  private async first<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const rows = await this.rows<T>(name, body);
    if (rows.length !== 1) throw new Error('LIVE_CALL_UNEXPECTED_SHAPE');
    return rows[0]!;
  }

  async begin(input: { userId: string; sessionId: string; callId: string; clientInstanceId: string }) {
    const row = await this.first<{ outcome: BeginOutcome; connection_epoch: unknown }>('server_begin_call_v1', {
      p_user_id: input.userId, p_session_id: input.sessionId, p_call_id: input.callId, p_client_instance_id: input.clientInstanceId,
    });
    return { outcome: row.outcome, epoch: toNumber(row.connection_epoch) };
  }

  async activate(input: { userId: string; callId: string; epoch: number }) {
    const row = await this.first<{ outcome: ActivateOutcome; started_at: unknown; recording_id: unknown }>('server_activate_call_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch,
    });
    return { outcome: row.outcome, startedAt: toText(row.started_at), recordingId: toText(row.recording_id) };
  }

  async heartbeat(input: { userId: string; callId: string; epoch: number }) {
    const row = await this.first<{ outcome: HeartbeatOutcome; call_state: unknown; ends_at: unknown }>('server_heartbeat_call_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch,
    });
    return { outcome: row.outcome, callState: toText(row.call_state), endsAt: toText(row.ends_at) };
  }

  async suspend(input: { userId: string; callId: string; epoch: number }) {
    const row = await this.first<{ outcome: SuspendOutcome }>('server_suspend_call_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch,
    });
    return { outcome: row.outcome };
  }

  async resume(input: { userId: string; callId: string; clientInstanceId: string }) {
    const row = await this.first<{ outcome: ResumeOutcome; call_state: unknown; connection_epoch: unknown; started_at: unknown; recording_id: unknown }>(
      'server_resume_call_v1', { p_user_id: input.userId, p_call_id: input.callId, p_client_instance_id: input.clientInstanceId },
    );
    return {
      outcome: row.outcome, callState: toText(row.call_state), epoch: toNumber(row.connection_epoch), startedAt: toText(row.started_at),
      recordingId: toText(row.recording_id),
    };
  }

  async end(input: { userId: string; callId: string; epoch: number; reason: 'USER_ENDED' | 'FAILED' | 'SERVER_ENDED' }) {
    const row = await this.first<{ outcome: EndOutcome; end_reason: unknown }>('server_end_call_v1', {
      p_user_id: input.userId, p_call_id: input.callId, p_connection_epoch: input.epoch, p_end_reason: input.reason,
    });
    return { outcome: row.outcome, endReason: toText(row.end_reason) };
  }

  async sweep(limit: number): Promise<number> {
    const row = await this.first<{ ended: unknown }>('server_sweep_calls_v1', { p_limit: limit });
    return Number(row.ended);
  }

  async truth(userId: string): Promise<CallTruth> {
    const row = await this.first<{ call_truth: 'ACTIVE' | 'NO_CALL_KNOWN'; call_id: unknown; call_state: unknown; started_at: unknown }>(
      'server_read_call_truth_v1', { p_user_id: userId },
    );
    return {
      callTruth: row.call_truth === 'ACTIVE' ? 'ACTIVE' : 'NO_CALL_KNOWN', callId: toText(row.call_id),
      callState: toText(row.call_state) as CallState | null, startedAt: toText(row.started_at),
    };
  }

  async readTracks(input: { userId: string; callId: string }): Promise<TrackState | null> {
    const rows = await this.rows<{
      recording_id: unknown; recording_state: unknown; user_track_end_ms: unknown; user_next_segment: unknown; qandeel_track_end_ms: unknown;
      qandeel_next_segment: unknown;
    }>(
      'server_read_call_tracks_v1', { p_user_id: input.userId, p_call_id: input.callId },
    );
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error('LIVE_CALL_UNEXPECTED_SHAPE');
    const row = rows[0]!;
    return {
      recordingId: String(row.recording_id), recordingState: String(row.recording_state), userTrackEndMs: Number(row.user_track_end_ms),
      userNextSegment: Number(row.user_next_segment), qandeelTrackEndMs: Number(row.qandeel_track_end_ms),
      qandeelNextSegment: Number(row.qandeel_next_segment),
    };
  }

  async recordGap(input: { userId: string; recordingId: string; epoch: number; track: 'USER' | 'QANDEEL'; startMs: number; endMs: number; kind: GapKind }) {
    const row = await this.first<{ outcome: string }>('server_record_call_gap_v2', {
      p_user_id: input.userId, p_recording_id: input.recordingId, p_connection_epoch: input.epoch, p_track: input.track, p_clock_start_ms: input.startMs,
      p_clock_end_ms: input.endMs, p_gap_kind: input.kind,
    });
    return row.outcome;
  }
}
