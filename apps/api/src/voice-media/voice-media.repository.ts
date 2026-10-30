import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

export interface BeginNoteRow { readonly outcome: string; readonly recording_id: string | null; readonly storage_key: string | null; readonly upload_deadline: string | null }
export interface AcceptNoteRow { readonly outcome: string; readonly accepted_at: string | null; readonly retention_expires_at: string | null }
export interface AddSegmentRow { readonly outcome: string; readonly storage_key: string | null; readonly upload_deadline: string | null }
export interface OutcomeRow { readonly outcome: string }
export interface RecordingObjectRow {
  readonly track: string;
  readonly segment_index: number;
  readonly storage_key: string;
  readonly content_type: string;
  readonly byte_size: number | string;
  readonly clock_start_ms: number | string | null;
  readonly clock_end_ms: number | string | null;
}
export interface ListedRecordingRow {
  readonly recording_id: string;
  readonly recording_kind: string;
  readonly recorded_at: string;
  readonly retention_expires_at: string;
  readonly track: string;
  readonly segment_index: number;
  readonly content_type: string;
  readonly byte_size: number | string;
  readonly clock_start_ms: number | string | null;
  readonly clock_end_ms: number | string | null;
  readonly file_name: string;
}

/**
 * S8B-02 (CP2) — the voice media definers of migrations 0183 / 0185, on the server channel only (service_role). The
 * human is ALWAYS the verified token's: the service passes the authenticated user id, never anything a client sent as
 * authority. The database decides ownership, readability (state, expiry, account erasure), consent and the gate on every
 * call; nothing here caches an answer.
 */
@Injectable()
export class VoiceMediaRepository {
  constructor(private readonly serverApi: SupabaseServiceRoleApiService) {}

  private first<T>(name: string, body: Record<string, unknown>): Promise<T | undefined> {
    return this.serverApi.rpc<T[]>(name, body).then((rows) => (Array.isArray(rows) ? rows[0] : undefined));
  }

  beginNote(userId: string, sessionId: string, commandId: string, byteSize: number) {
    return this.first<BeginNoteRow>('server_begin_voice_note_upload_v1', { p_user_id: userId, p_session_id: sessionId, p_command_id: commandId, p_byte_size: byteSize });
  }

  acceptNote(userId: string, recordingId: string, byteSize: number) {
    return this.first<AcceptNoteRow>('server_accept_voice_note_v1', { p_user_id: userId, p_recording_id: recordingId, p_byte_size: byteSize });
  }

  addSegment(userId: string, recordingId: string, track: string, segmentIndex: number, clockStartMs: number, clockEndMs: number, byteSize: number, leaseSeconds: number) {
    return this.first<AddSegmentRow>('server_add_call_segment_v1', {
      p_user_id: userId, p_recording_id: recordingId, p_track: track, p_segment_index: segmentIndex, p_clock_start_ms: clockStartMs,
      p_clock_end_ms: clockEndMs, p_byte_size: byteSize, p_lease_seconds: leaseSeconds,
    });
  }

  storeSegment(userId: string, recordingId: string, track: string, segmentIndex: number, byteSize: number) {
    return this.first<OutcomeRow>('server_store_call_segment_v1', { p_user_id: userId, p_recording_id: recordingId, p_track: track, p_segment_index: segmentIndex, p_byte_size: byteSize });
  }

  readObjects(userId: string, recordingId: string): Promise<RecordingObjectRow[]> {
    return this.serverApi.rpc<RecordingObjectRow[]>('server_read_voice_recording_objects_v1', { p_user_id: userId, p_recording_id: recordingId });
  }

  listRecordings(userId: string): Promise<ListedRecordingRow[]> {
    return this.serverApi.rpc<ListedRecordingRow[]>('server_list_voice_recordings_v1', { p_user_id: userId });
  }

  deleteRecording(userId: string, recordingId: string) {
    return this.first<OutcomeRow>('server_delete_voice_recording_v1', { p_user_id: userId, p_recording_id: recordingId });
  }

  sweep(limit: number) {
    return this.first<{ expired: number; discarded: number }>('server_sweep_voice_recordings_v1', { p_limit: limit });
  }

  recoverStale(limit: number, graceSeconds: number) {
    return this.first<{ recovered: number }>('server_recover_stale_call_recordings_v1', { p_limit: limit, p_grace_seconds: graceSeconds });
  }

  enqueueUnknown(keys: string[]) {
    return this.first<{ enqueued: number }>('server_enqueue_unknown_voice_media_v1', { p_storage_keys: keys });
  }
}
