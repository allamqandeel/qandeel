import { Injectable } from '@nestjs/common';

/**
 * S8B-05 CP3 (contract v1.2 Part A, A3.3 / A1 §3): the live call tells the call analysis worker that its session's
 * analysis order may have moved - a turn was committed, its reply's first audio went out, an exchange closed. It is a
 * KICK, nothing more: synchronous, in memory, no database call and no await on the voice path, and a lost kick costs only
 * latency (the worker's scan finds the work). What runs, and in what order, is decided by migration 0191's claim.
 *
 * The worker registers itself at start (the LiveCallConversationBinding pattern); a process with no worker drops kicks.
 */
export interface LiveCallAnalysisListener {
  kick(sessionId: string, reason: LiveCallAnalysisKick): void;
}

export type LiveCallAnalysisKick = 'TURN_COMMITTED' | 'FIRST_AUDIO' | 'EXCHANGE_CLOSED';

@Injectable()
export class LiveCallAnalysisSignal {
  private listener: LiveCallAnalysisListener | null = null;

  bind(listener: LiveCallAnalysisListener | null): void {
    this.listener = listener;
  }

  kick(sessionId: string, reason: LiveCallAnalysisKick): void {
    try {
      this.listener?.kick(sessionId, reason);
    } catch {
      // A kick never fails the call.
    }
  }
}
