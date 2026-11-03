import { Injectable } from '@nestjs/common';
import type { SpeechExpression, SpeechHintCandidate } from '../../speech-rendering';

/**
 * S8B-05 CP2 (contract §5, "Voice owns audio; the Orchestrator owns generation") — what the call turn engine asks of the
 * conversation for ONE committed spoken turn: Safety (S1 – S3, stored through `storeSafety` before anything is generated),
 * the call's context (D-05-08), and the REALTIME generation, released piece by piece into `release`.
 *
 * ConversationModule composes VoiceModule, so voice cannot inject the orchestrator. VoiceModule provides this binding;
 * ConversationModule registers its implementation into it at start. Unbound (a process without the conversation), a
 * committed turn is not answered and its exchange is left to the call's own close.
 */
export interface LiveCallReleasedSpeech {
  readonly expression: SpeechExpression;
  readonly hints: readonly SpeechHintCandidate[];
}

export interface LiveCallReplyRequest {
  readonly userId: string;
  readonly sessionId: string;
  readonly callId: string;
  readonly callTurnIndex: number;
  readonly userTurnId: string;
  /** The committed turn's words (finals only; never a partial), or the message typed during the call. */
  readonly content: string;
  /**
   * S8B-05 CP4 (D-05-07): SPEECH (the default) is answered aloud; TEXT, a message typed during the call, is answered in
   * text: the same Safety, context and REALTIME generation, without the spoken-reply guidance.
   */
  readonly channel?: 'SPEECH' | 'TEXT';
  readonly accessToken: string;
  /** Aborts the generation (a newer turn closed this exchange, the call ended). */
  readonly signal: AbortSignal;
  /** S2: the turn's Safety disposition, stored once before generation. Rejects when it cannot be stored. */
  storeSafety(disposition: 'ALLOW' | 'GUIDED' | 'BLOCK'): Promise<void>;
  /** One released piece of the reply, in order, while the rest is generated. */
  release(piece: string, speech: LiveCallReleasedSpeech): void;
}

/** How the generation ended. `stages` are monotonic milliseconds from the request (latency evidence; no words). */
export interface LiveCallReplyOutcome {
  readonly kind: 'COMPLETE' | 'WITHHELD_TAIL' | 'FAILED';
  readonly stages: Readonly<Record<string, number>>;
  /** The history pairs and the estimated tokens the model received (context-window evidence, D-05-08; no words). */
  readonly context?: {
    readonly windowExchanges: number;
    readonly retrievedExchanges: number;
    /** In-call retrieval (A1 §4): HIT / NONE / NOT_ASKED, or TIMEOUT / FAILED (skipped without error, counted). */
    readonly retrieval?: 'HIT' | 'NONE' | 'NOT_ASKED' | 'TIMEOUT' | 'FAILED';
    readonly estimatedTokens: number;
  };
}

/** S3: what the Safety recovery of one committed turn needs: the turn, its reader's scope and the one store. */
export type LiveCallSafetyRequest = Pick<LiveCallReplyRequest, 'userId' | 'sessionId' | 'callId' | 'callTurnIndex' | 'userTurnId' | 'content' | 'accessToken' | 'storeSafety'>;

export interface LiveCallConversation {
  reply(request: LiveCallReplyRequest): Promise<LiveCallReplyOutcome>;
  /**
   * S3 (the turn's Safety was never stored: the generation failed or stopped before it): recompute it with the SAME gate
   * over the SAME context reader (the closed exchanges before the turn are immutable under N1, so the input is the one
   * the reply had) and store it once. Rejects, storing nothing, when the context cannot be read now; never a default.
   */
  settleSafety(request: LiveCallSafetyRequest): Promise<void>;
}

@Injectable()
export class LiveCallConversationBinding {
  private bound: LiveCallConversation | null = null;

  bind(conversation: LiveCallConversation): void {
    this.bound = conversation;
  }

  get conversation(): LiveCallConversation | null {
    return this.bound;
  }
}
