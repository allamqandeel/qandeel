import type { CallEndReason, CallState } from './live-call.protocol';

/**
 * S8B-05 CP1 — the call authority's commands as the API sees them (migration 0189). The database decides everything a
 * call is: existence, owner, session, state, epoch, started_at, the seat and the recording. The API holds only what a
 * connection needs to act, and never a second truth.
 */
export const LIVE_CALL_STORE = Symbol('LIVE_CALL_STORE');

export type BeginOutcome = 'BEGUN' | 'COMMAND_CONFLICT' | 'NOT_FOUND' | 'SESSION_NOT_ACTIVE' | 'NOT_AVAILABLE_NOW' | 'CONSENT_REQUIRED'
  | 'ALREADY_IN_CALL' | 'CAPACITY_FULL';
export type ActivateOutcome = 'ACTIVE' | 'NOT_FOUND' | 'ENDED' | 'FENCED' | 'NOT_CONNECTING' | 'NOT_AVAILABLE_NOW' | 'CONSENT_REQUIRED';
export type HeartbeatOutcome = 'ALIVE' | 'NOT_FOUND' | 'ENDED' | 'FENCED' | 'RECONNECTING';
export type SuspendOutcome = 'SUSPENDED' | 'NOT_FOUND' | 'ENDED' | 'FENCED';
export type ResumeOutcome = 'RESUMED' | 'NOT_FOUND' | 'ENDED' | 'OTHER_DEVICE';
export type EndOutcome = 'ENDED' | 'ALREADY_ENDED' | 'NOT_FOUND' | 'FENCED';
export type GapKind = 'RECONNECTION' | 'MUTED' | 'NOT_SPEAKING';

export interface TrackState {
  readonly recordingId: string;
  readonly recordingState: string;
  readonly userTrackEndMs: number;
  readonly userNextSegment: number;
}

export interface CallTruth {
  readonly callTruth: 'ACTIVE' | 'NO_CALL_KNOWN';
  readonly callId: string | null;
  readonly callState: CallState | null;
  readonly startedAt: string | null;
}

export interface LiveCallStore {
  begin(input: { userId: string; sessionId: string; callId: string; clientInstanceId: string }): Promise<{ outcome: BeginOutcome; epoch: number | null }>;
  activate(input: { userId: string; callId: string; epoch: number }): Promise<{ outcome: ActivateOutcome; startedAt: string | null; recordingId: string | null }>;
  heartbeat(input: { userId: string; callId: string; epoch: number }): Promise<{ outcome: HeartbeatOutcome; callState: string | null; endsAt: string | null }>;
  suspend(input: { userId: string; callId: string; epoch: number }): Promise<{ outcome: SuspendOutcome }>;
  resume(input: { userId: string; callId: string; clientInstanceId: string }): Promise<{
    outcome: ResumeOutcome; callState: string | null; epoch: number | null; startedAt: string | null; recordingId: string | null;
  }>;
  end(input: { userId: string; callId: string; epoch: number; reason: Extract<CallEndReason, 'USER_ENDED' | 'FAILED' | 'SERVER_ENDED'> }): Promise<{
    outcome: EndOutcome; endReason: string | null;
  }>;
  sweep(limit: number): Promise<number>;
  truth(userId: string): Promise<CallTruth>;
  readTracks(input: { userId: string; callId: string }): Promise<TrackState | null>;
  /** A gap where the track ends, for the connection holding `epoch` (0189's fenced entry: FENCED once it moved on). */
  recordGap(input: { userId: string; recordingId: string; epoch: number; track: 'USER' | 'QANDEEL'; startMs: number; endMs: number; kind: GapKind }): Promise<string>;
}
