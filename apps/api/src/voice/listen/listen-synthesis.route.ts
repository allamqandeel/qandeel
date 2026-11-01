import type { SpeechAdmissionGuard } from '../speech-admission.guard';
import type { SpeechSynthesisAdapter } from '../speech-synthesis.adapter';

/**
 * S8B-04 (CP1) — what Listen needs from the ONE synthesis route, bound by VoiceModule (the only composer of a provider
 * adapter). Absent (no project configured), Listen refuses before anything is written or sent. Listen itself names no
 * provider, reads no environment and holds no network code.
 */
export const LISTEN_SYNTHESIS_ROUTE = Symbol('LISTEN_SYNTHESIS_ROUTE');

export interface ListenSynthesisRoute {
  readonly adapter: SpeechSynthesisAdapter;
  readonly admission: SpeechAdmissionGuard;
  /** The ledger's requested model (the route's one model). */
  readonly model: string;
  readonly voiceId: string;
  /** The whole bound of one segment's attempt. */
  segmentTimeoutMs(spokenText: string): number;
  /** The jitter before the one allowed retry. */
  retryDelayMs(): number;
}
