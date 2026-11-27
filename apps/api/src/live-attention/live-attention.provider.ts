// INTEL-LIVE-01 CP1 — the provisional attention lane's ONE composition, and its registration into the call turn engine.
//
// OFF unless LIVE_CALL_PROVISIONAL_ATTENTION is exactly ON (the ON / OFF switch the A4 gate measures). ON, the evaluator is
// DeepSeek Flash behind the SYNTHETIC_ONLY qualification gate, through ONE accounted client
// (AI-COST-01 `costLedgerDecorator('LIVE_ATTENTION_EVALUATION')`), the writer is 0204's, and the permits are 0191's shared
// background permits (PROVISIONAL_ATTENTION, no wait, L2 respected). EMERGENCY_CALL_SPEND_USD (A2 §1) is unset by default:
// the guard is then disabled.
//
// CALL-ATTR-01 (2026-11-27): each provisional evaluation runs inside ONE AI-COST-01 attribution scope made of the call
// connection's verified payer and session. Provisional speech has no committed turn, so no source turn is given (none is
// invented). The scope opens at each evaluation, never at the connection: a reconnect's tracker carries its own channel's
// identity. Without it the accounting boundary refuses every evaluation before it starts.

import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { costLedgerDecorator } from '../ai-usage/production-ai-provider-call-accounting';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { BackgroundPermitGate } from '../live-analysis/background-permits';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import {
  LiveCallAttentionBinding, type LiveCallAttention, type LiveCallAttentionChannel, type LiveCallAttentionSession,
} from '../voice/call-turn/live-call-attention.port';
import { CallAttentionRepository, type CallAttentionStore, type SettledDueHalf } from './call-attention.repository';
import { CallAttentionTracker } from './call-attention.tracker';
import { DeepSeekAttentionEvaluator, loadAttentionDeepSeekConfig } from './deepseek-attention-evaluator';
import type { AttentionEvaluator, AttentionObservation, ProvisionalAttentionConfig } from './provisional-attention.types';

export const LIVE_CALL_PROVISIONAL_ATTENTION_ENV = 'LIVE_CALL_PROVISIONAL_ATTENTION';
export const EMERGENCY_CALL_SPEND_USD_ENV = 'EMERGENCY_CALL_SPEND_USD';
export const LIVE_CALL_ATTENTION = Symbol('LIVE_CALL_ATTENTION');

/** A2 §1: null (disabled) unless set to a positive amount. */
export function readEmergencyCallSpendUsd(environment: NodeJS.ProcessEnv): number | null {
  const raw = environment[EMERGENCY_CALL_SPEND_USD_ENV]?.trim();
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 100) throw new Error(`${EMERGENCY_CALL_SPEND_USD_ENV} must be a positive amount of at most 100.`);
  return value;
}

export interface LiveAttentionParts {
  readonly evaluator: AttentionEvaluator;
  readonly store: CallAttentionStore;
  readonly permits: BackgroundPermitGate;
  readonly config?: Partial<ProvisionalAttentionConfig>;
  readonly observe?: (callId: string, observation: AttentionObservation) => void;
  readonly signal?: (op: string, outcome: string) => void;
}

/**
 * The lane over its parts: one tracker per call connection, adapted to the engine's port. CP2: each tracker discloses to
 * its own connection (protocol v3), and the trackers of a call on this instance are told when a half of it was settled here.
 */
export function liveCallAttentionOf(parts: LiveAttentionParts): LiveCallAttention {
  const byCall = new Map<string, Set<CallAttentionTracker>>();
  return {
    open(channel: LiveCallAttentionChannel): LiveCallAttentionSession {
      const tracker = new CallAttentionTracker({
        userId: channel.userId, callId: channel.callId, epoch: channel.epoch, evaluator: attributedEvaluator(parts.evaluator, channel), store: parts.store,
        permits: parts.permits, captureClock: () => channel.latestCaptureMs(), config: parts.config,
        observe: parts.observe ? (o) => parts.observe!(channel.callId, o) : undefined, signal: parts.signal,
        disclose: channel.discloseAttention ? (d) => channel.discloseAttention!(d) : undefined,
      });
      const here = byCall.get(channel.callId) ?? new Set<CallAttentionTracker>();
      here.add(tracker);
      byCall.set(channel.callId, here);
      const forget = (): void => {
        here.delete(tracker);
        if (here.size === 0 && byCall.get(channel.callId) === here) byCall.delete(channel.callId);
      };
      void tracker.start();
      return {
        evidence: (track, text, clockStartMs, clockEndMs) => {
          try { tracker.evidence(track, text, clockStartMs, clockEndMs); } catch { parts.signal?.('attention', 'integrity_failure'); }
        },
        turnCommitted: () => {
          try { tracker.turnCommitted(); } catch { parts.signal?.('attention', 'integrity_failure'); }
        },
        handover: () => {
          forget();
          return tracker.handover().catch(() => undefined);
        },
        close: () => {
          forget();
          void tracker.close().catch(() => undefined);
        },
      };
    },
    settled(callId: string): void {
      for (const tracker of byCall.get(callId) ?? []) {
        try { tracker.settled(); } catch { parts.signal?.('attention', 'integrity_failure'); }
      }
    },
  };
}

/** CALL-ATTR-01: the lane's evaluator, each evaluation attributed to the call connection's payer and session (no turn). */
function attributedEvaluator(evaluator: AttentionEvaluator, channel: Pick<LiveCallAttentionChannel, 'userId' | 'sessionId'>): AttentionEvaluator {
  const attribution = { userId: channel.userId, sessionId: channel.sessionId };
  return { evaluate: (input, signal) => runWithAiUsageAttribution(attribution, () => evaluator.evaluate(input, signal)) };
}

/**
 * INTEL-LIVE-01 CP2: 0204's settlement commands as the analysis worker uses them, telling this instance's lane which call a
 * settlement changed (so its phones are told the database's attention again). The settlement itself is unchanged.
 */
export function signallingAttentionSettlement(
  store: {
    settle: CallAttentionRepository['settle'];
    settleDueHalves(limit: number): Promise<readonly SettledDueHalf[]>;
  },
  attention: Pick<LiveCallAttention, 'settled'>,
): { settle: CallAttentionRepository['settle']; settleDue(limit: number): Promise<number> } {
  const tell = (callId: string, confirmed: number, expired: number): void => {
    if (confirmed + expired > 0) attention.settled?.(callId);
  };
  return {
    async settle(userId, callId, callTurnIndex, half) {
      const result = await store.settle(userId, callId, callTurnIndex, half);
      if (result.outcome === 'SETTLED') tell(callId, result.confirmed, result.expired);
      return result;
    },
    async settleDue(limit) {
      const halves = await store.settleDueHalves(limit);
      for (const h of halves) tell(h.callId, h.confirmed, h.expired);
      return halves.length;
    },
  };
}

/** The production lane, or null when it is OFF. */
export function productionLiveCallAttention(
  environment: NodeJS.ProcessEnv,
  serviceApi: Pick<SupabaseServiceRoleApiService, 'rpc'>,
  permits: BackgroundPermitGate,
): LiveCallAttention | null {
  if (environment[LIVE_CALL_PROVISIONAL_ATTENTION_ENV]?.trim() !== 'ON') return null;
  const config = loadAttentionDeepSeekConfig(environment);
  const evaluator = new DeepSeekAttentionEvaluator(config, costLedgerDecorator('LIVE_ATTENTION_EVALUATION')(createDeepSeekClient(config)));
  return liveCallAttentionOf({
    evaluator, store: new CallAttentionRepository(serviceApi), permits,
    config: { emergencyCallSpendUsd: readEmergencyCallSpendUsd(environment) },
  });
}

/** Registers the lane into VoiceModule's binding at start (voice/ cannot import it: it stays provider-free). */
@Injectable()
export class LiveAttentionHost implements OnModuleInit {
  constructor(
    private readonly binding: LiveCallAttentionBinding,
    @Optional() @Inject(LIVE_CALL_ATTENTION) private readonly attention?: LiveCallAttention | null,
  ) {}

  onModuleInit(): void {
    if (this.attention) this.binding.bind(this.attention);
  }
}
