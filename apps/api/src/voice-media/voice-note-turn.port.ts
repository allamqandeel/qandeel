import type { LiveReplySink } from '../voice/live-reply/live-reply.service';

/**
 * S8B-03 (CP1, §4.4) — the one seam between a committed Voice Note turn and the UNCHANGED conversation path. The voice
 * media module holds no AI runtime: it commits the turn in the database (`server_commit_voice_note_turn_v1`, one
 * transaction with its voice source) and hands the turn id to this runner, which the Conversation module provides. The
 * runner orchestrates that exact turn like a typed one (admission work lease, attribution, Orchestrator, semantic
 * establishment); a replay of an already-committed note runs the same turn again, which returns the stored reply.
 */
export const VOICE_NOTE_TURN_RUNNER = Symbol('VOICE_NOTE_TURN_RUNNER');

/** S8B-04 (CP2): the automatic voice reply the turn's reply is released into while it is generated (D-S2 / D-S3). */
export interface VoiceNoteTurnRunOptions {
  readonly liveReply?: LiveReplySink;
}

export interface VoiceNoteTurnRunner {
  run(userId: string, accessToken: string, sessionId: string, turnId: string, options?: VoiceNoteTurnRunOptions): Promise<unknown>;
}
