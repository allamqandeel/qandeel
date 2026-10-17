/**
 * S6-06 (CP2) — the reader's own Introductions status line in «التعارف مع قنديل» (P13 / P14b): why Introductions are
 * paused, and the one explicit act that resumes (RESUME) or turns them on again (ACTIVATE), as the frozen `0117` engine
 * allows. Only the reader's own participation is ever read; nothing about anyone else. Nothing comes back by itself: no
 * earlier suggestion returns, and the server checks the reader's current setup first.
 *
 * The line exists only for the states the Introduction lifecycle produces — paused during or after an Introduction, after
 * SUCCESS, or OFF after having taken part. A reader who never took part, a user pause and a system pause have their own
 * frozen commands and show nothing here. In production every resume answers NOT_AVAILABLE_NOW (CW2-08).
 */
import type { ForegroundSignal, IntroductionParticipation, IntroductionParticipationRead, IntroductionResumeResult } from '../runtime-entry';
import { mintIntroductionsCommandId } from './introductions-controller';

export interface IntroductionParticipationTransport {
  participation(): Promise<IntroductionParticipationRead>;
  resume(commandId: string, expectedEventId: string, entryChannel: 'MANUAL_MY_WORLD_ENTRY' | null): Promise<IntroductionResumeResult>;
}

/** What the line says: the lifecycle's own pause, or nothing. */
export type ParticipationLine = 'ACTIVE_INTRODUCTION' | 'POST_INTRODUCTION' | 'POST_SUCCESS' | 'OFF' | null;

export interface ParticipationState {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'FAILED';
  readonly line: ParticipationLine;
  readonly busy: boolean;
  /** RESUMED — PD-60; NOT_ELIGIBLE — PD-58; NOT_AVAILABLE_NOW — PD-59; FAILED — the neutral failure (retry: same id). */
  readonly notice: 'RESUMED' | 'NOT_ELIGIBLE' | 'NOT_AVAILABLE_NOW' | 'FAILED' | null;
}

export interface ParticipationController {
  getState(): ParticipationState;
  subscribe(listener: () => void): () => void;
  /** Read the reader's participation (opening «التعارف مع قنديل», returning to the foreground). */
  refresh(): void;
  /** The one explicit act the line offers. */
  resume(): Promise<IntroductionResumeResult['kind'] | null>;
  retire(): void;
}

export interface ParticipationControllerOptions {
  readonly transport: IntroductionParticipationTransport;
  readonly isCurrent: () => boolean;
  readonly foreground?: ForegroundSignal;
  readonly newCommandId?: () => string;
}

/** The line for one participation, or null: only the states the Introduction lifecycle produces. */
export function participationLine(participation: IntroductionParticipation): ParticipationLine {
  if (participation.state === 'PAUSED') {
    return participation.pauseReason === 'ACTIVE_INTRODUCTION' || participation.pauseReason === 'POST_INTRODUCTION' || participation.pauseReason === 'POST_SUCCESS'
      ? participation.pauseReason : null;
  }
  // OFF with an act behind it: the reader took part and turned Introductions off. Absence (no act) is never "paused".
  return participation.state === 'OFF' && participation.expectedEventId !== null ? 'OFF' : null;
}

const INITIAL: ParticipationState = Object.freeze({ status: 'IDLE', line: null, busy: false, notice: null });

export function createParticipationController({ transport, isCurrent, foreground, newCommandId = mintIntroductionsCommandId }: ParticipationControllerOptions): ParticipationController {
  let state = INITIAL;
  let retired = false;
  let reads = 0;
  let participation: IntroductionParticipation | null = null;
  /** The resume whose answer was lost, bound to the act it was asked against. */
  let lost: { readonly event: string; readonly id: string } | null = null;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();
  const publish = (next: Partial<ParticipationState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of listeners) listener();
  };
  const read = () => {
    const mine = ++reads;
    publish({ status: state.status === 'READY' ? 'READY' : 'LOADING' });
    void transport.participation().then((answer) => {
      if (mine !== reads) return;
      if (answer.kind !== 'READY') {
        // A failed read shows no line it cannot vouch for.
        participation = null;
        publish({ status: 'FAILED', line: null });
        return;
      }
      participation = answer.participation;
      publish({ status: 'READY', line: participationLine(answer.participation) });
    });
  };
  const unsubscribe = foreground?.subscribe((next) => {
    if (next === 'ACTIVE' && state.status !== 'IDLE') read();
  });
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: read,
    async resume() {
      const now = participation;
      if (!live() || state.busy || now === null || now.expectedEventId === null) return null;
      const line = participationLine(now);
      if (line === null || line === 'ACTIVE_INTRODUCTION') return null;
      const event = now.expectedEventId;
      const id = lost !== null && lost.event === event ? lost.id : newCommandId();
      lost = { event, id };
      publish({ busy: true, notice: null });
      // RESUME carries no channel; an ACTIVATE from OFF is the reader's own manual entry here.
      const answer = await transport.resume(id, event, line === 'OFF' ? 'MANUAL_MY_WORLD_ENTRY' : null);
      if (answer.kind !== 'FAILED' && answer.kind !== 'OFFLINE') lost = null;
      publish({
        busy: false,
        notice: answer.kind === 'REACTIVATED' ? 'RESUMED' : answer.kind === 'NOT_ELIGIBLE' ? 'NOT_ELIGIBLE' : answer.kind === 'NOT_AVAILABLE_NOW' ? 'NOT_AVAILABLE_NOW' : 'FAILED',
      });
      if (answer.kind !== 'FAILED' && answer.kind !== 'OFFLINE') read();
      return answer.kind;
    },
    retire() {
      retired = true;
      unsubscribe?.();
      listeners.clear();
    },
  };
}
