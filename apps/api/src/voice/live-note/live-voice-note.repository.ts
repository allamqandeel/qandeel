import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import type { LiveVoiceNoteOpenOutcome, LiveVoiceNoteStore } from './live-voice-note.service';

/** The realtime model the ledger names (Speechmatics' enhanced operating point, S8B-01). */
export const LIVE_VOICE_NOTE_MODEL = 'speechmatics-rt-enhanced';

/**
 * S8B-04 (CP2, migration 0188) — a live voice note's admission and its realtime ledger row, on the server channel only.
 * The database decides consent (the CURRENT version), the gate, the session, the work budget and one open per person; the
 * ledger row is begun in the same transaction and settled when the note closes, with the audio the gateway sent. No text
 * is ever written here.
 */
@Injectable()
export class LiveVoiceNoteRepository implements LiveVoiceNoteStore {
  constructor(private readonly serverApi: SupabaseServiceRoleApiService) {}

  private async first<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const rows = await this.serverApi.rpc<T[]>(name, body);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('LIVE_VOICE_NOTE_UNEXPECTED_SHAPE');
    return rows[0]!;
  }

  async open(input: { userId: string; sessionId: string; liveId: string; callId: string }): Promise<LiveVoiceNoteOpenOutcome> {
    const row = await this.first<{ outcome: LiveVoiceNoteOpenOutcome }>('server_open_live_voice_note_v1', {
      p_user_id: input.userId, p_session_id: input.sessionId, p_live_id: input.liveId, p_call_id: input.callId,
      p_requested_model: LIVE_VOICE_NOTE_MODEL,
    });
    return row.outcome;
  }

  async close(input: { userId: string; liveId: string; state: 'FINISHED' | 'CANCELLED' | 'FAILED'; audioMs: number | null }): Promise<void> {
    await this.first<{ outcome: string }>('server_close_live_voice_note_v1', {
      p_user_id: input.userId, p_live_id: input.liveId, p_state: input.state, p_audio_ms: input.audioMs,
    });
  }
}
