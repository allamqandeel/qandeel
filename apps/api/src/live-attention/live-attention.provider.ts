// INTEL-LIVE-01 CP1 — the provisional attention lane's ONE composition, and its registration into the call turn engine.
//
// OFF unless LIVE_CALL_PROVISIONAL_ATTENTION is exactly ON (the ON / OFF switch the A4 gate measures). ON, the evaluator is
// DeepSeek Flash behind the SYNTHETIC_ONLY qualification gate, through ONE accounted client
// (AI-COST-01 `costLedgerDecorator('LIVE_ATTENTION_EVALUATION')`), the writer is 0204's, and the permits are 0191's shared
// background permits (PROVISIONAL_ATTENTION, no wait, L2 respected). EMERGENCY_CALL_SPEND_USD (A2 §1) is unset by default:
// the guard is then disabled.

import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { costLedgerDecorator } from '../ai-usage/production-ai-provider-call-accounting';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { BackgroundPermitGate } from '../live-analysis/background-permits';
import { createDeepSeekClient } from '../model-router/providers/deepseek/deepseek-client';
import {
  LiveCallAttentionBinding, type LiveCallAttention, type LiveCallAttentionChannel, type LiveCallAttentionSession,
} from '../voice/call-turn/live-call-attention.port';
import { CallAttentionRepository, type CallAttentionStore } from './call-attention.repository';
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

/** The lane over its parts: one tracker per call connection, adapted to the engine's port. */
export function liveCallAttentionOf(parts: LiveAttentionParts): LiveCallAttention {
  return {
    open(channel: LiveCallAttentionChannel): LiveCallAttentionSession {
      const tracker = new CallAttentionTracker({
        userId: channel.userId, callId: channel.callId, epoch: channel.epoch, evaluator: parts.evaluator, store: parts.store,
        permits: parts.permits, captureClock: () => channel.latestCaptureMs(), config: parts.config,
        observe: parts.observe ? (o) => parts.observe!(channel.callId, o) : undefined, signal: parts.signal,
      });
      void tracker.start();
      return {
        evidence: (track, text, clockStartMs, clockEndMs) => {
          try { tracker.evidence(track, text, clockStartMs, clockEndMs); } catch { parts.signal?.('attention', 'integrity_failure'); }
        },
        turnCommitted: () => {
          try { tracker.turnCommitted(); } catch { parts.signal?.('attention', 'integrity_failure'); }
        },
        handover: () => tracker.handover().catch(() => undefined),
        close: () => { void tracker.close().catch(() => undefined); },
      };
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
