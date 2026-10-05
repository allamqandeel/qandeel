import { randomUUID } from 'node:crypto';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { classifyOperationalFailure } from '../observability/operational-failure';
import { TelemetryService } from '../observability/telemetry.service';
import { ReevaluationPass, decideDispatch, deferralOutlivesItem, orderForPass, type DispatchDecision } from './push-dispatch-decision';
import { ApnsTransport, FcmTransport, apnsCredentialsFrom, fcmCredentialsFrom, type PushTransport } from './push-transport';
import { PushRepository } from './push.repository';
import {
  PUSH_CLAIM_BATCH, PUSH_DEFAULT_POLL_MS, PUSH_LEASE_SECONDS, PUSH_MAX_TRANSPORT_ATTEMPTS, PUSH_PLAN_BATCH, PUSH_RETRY_BACKOFF_MS,
  type AttemptState, type ClaimedAttempt, type PushTransportName,
} from './push.types';

/** A transport with no credentials keeps its intents waiting this long (they still expire with their window). */
const NOT_CONFIGURED_WAIT_MS = 5 * 60_000;

export const PUSH_TRANSPORTS = Symbol('PUSH_TRANSPORTS');
export type PushTransports = Readonly<Record<PushTransportName, PushTransport>>;

export function transportsFromEnvironment(env: NodeJS.ProcessEnv = process.env): PushTransports {
  return { FCM: new FcmTransport(fcmCredentialsFrom(env)), APNS: new ApnsTransport(apnsCredentialsFrom(env)) };
}

/**
 * A3-02 — the server-only platform dispatcher (QAN-BL-NOTIF-01). One single-flight cycle on a timer, the same shape as
 * the Privacy & Data pass and the runtime-event publisher; not a job framework. Each cycle:
 *
 *   1. PLAN   — one delivery intent per (eligible A3-01 item, live granted device) (migration 0137; idempotent, D57);
 *   2. CLAIM  — due intents under a short lease, with the CURRENT item, preferences, mute, device and evidence;
 *   3. DECIDE — every intent revalidated from scratch through A3-01's `platformVerdict` (D54, D55): stale / not fresh →
 *               EXPIRED (D59); Quiet Hours / Snooze → DEFERRED and later re-evaluated, at most one per reader per pass;
 *               anything else that says no → SUPPRESSED; the ceilings count this pass's own acceptances too;
 *   4. SEND   — the bounded message, rendered NOW at the CURRENT disclosure level, to the device's own platform service;
 *   5. RECORD — the evidence the transport actually gives: ACCEPTED (never "delivered"), TOKEN_INVALID (the device is
 *               retired), REJECTED, or a bounded retry; unknown stays unknown (D56). No other channel is tried (D58).
 *
 * Nothing touches the user-level attention lifecycle (0136), nothing writes Product truth, and nothing logs: telemetry
 * is content-free finite labels only (APP-OPS-01) — never a user, item, device, token, sentence or provider body.
 * Delivery work never sits on the Conversation path: this is its own timer.
 *
 * Enabled only where the server channel and at least one platform credential exist, never under tests, and it can be
 * switched off by configuration (`PUSH_DISPATCH_DISABLED=true`).
 */
@Injectable()
export class PushDispatcherWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;
  private readonly transports: PushTransports;
  /** The pass's clock. Replaced only by tests. */
  clock: () => number = Date.now;

  constructor(
    private readonly repository: PushRepository,
    private readonly telemetry: TelemetryService,
    @Optional() @Inject(PUSH_TRANSPORTS) transports?: PushTransports,
  ) {
    this.transports = transports ?? transportsFromEnvironment();
  }

  get enabled(): boolean {
    return Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && process.env.NODE_ENV !== 'test'
      && process.env.PUSH_DISPATCH_DISABLED !== 'true' && (this.transports.FCM.configured || this.transports.APNS.configured);
  }

  onModuleInit(): void {
    if (!this.enabled || this.stopped) return;
    const poll = Number(process.env.PUSH_DISPATCH_POLL_MS ?? PUSH_DEFAULT_POLL_MS);
    this.timer = setInterval(() => void this.runOnce(), Number.isFinite(poll) && poll >= 1000 ? poll : PUSH_DEFAULT_POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One cycle. A cycle already in flight is not doubled. */
  async runOnce(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      await this.repository.plan(PUSH_PLAN_BATCH).then(
        () => this.signal('plan', 'success'),
        (error: unknown) => this.signal('plan', failureOutcome(error)),
      );
      const claimToken = randomUUID();
      const claimed = await this.repository.claim(PUSH_CLAIM_BATCH, PUSH_LEASE_SECONDS, claimToken).then(
        (rows) => { this.signal('claim', 'success'); return rows; },
        (error: unknown): ClaimedAttempt[] => { this.signal('claim', failureOutcome(error)); return []; },
      );
      const byUser = new Map<string, ClaimedAttempt[]>();
      for (const claim of claimed) byUser.set(claim.userId, [...(byUser.get(claim.userId) ?? []), claim]);
      for (const claims of byUser.values()) await this.passFor(claims, claimToken);
    } finally {
      this.running = false;
    }
  }

  /** One reader's intents in this pass. The P3 §14 ceilings see this pass's own acceptances (one per item). */
  private async passFor(claims: readonly ClaimedAttempt[], claimToken: string): Promise<void> {
    const reevaluation = new ReevaluationPass();
    const acceptedNow = new Map<string, ClaimedAttempt['evidence'][number]>();
    for (const claim of orderForPass(claims)) {
      const now = this.clock();
      const current: ClaimedAttempt = { ...claim, evidence: [...claim.evidence, ...[...acceptedNow.entries()].filter(([id]) => id !== claim.item.id).map(([, e]) => e)] };
      let decision: DispatchDecision;
      try {
        decision = reevaluation.admit(claim, decideDispatch(current, now));
      } catch {
        // A malformed claim (e.g. a preference row the decision refuses) is never guessed: it is suppressed.
        decision = { kind: 'SUPPRESS', reason: 'claim_malformed' };
      }
      const accepted = await this.apply(claim, decision, claimToken, now);
      if (accepted && !acceptedNow.has(claim.item.id)) {
        acceptedNow.set(claim.item.id, { at: new Date(now).toISOString(), kind: claim.item.kind, critical: claim.item.critical, requested: claim.item.requested });
      }
    }
  }

  private async apply(claim: ClaimedAttempt, decision: DispatchDecision, claimToken: string, now: number): Promise<boolean> {
    switch (decision.kind) {
      case 'SUPPRESS':
        await this.record(claim, claimToken, 'SUPPRESSED', decision.reason, null, null, false, 'suppressed');
        return false;
      case 'EXPIRE':
        await this.record(claim, claimToken, 'EXPIRED', decision.reason, null, null, false, 'expired');
        return false;
      case 'DEFER':
        if (deferralOutlivesItem(claim, decision.until, now)) {
          await this.record(claim, claimToken, 'EXPIRED', 'window_closed', null, null, false, 'expired');
        } else {
          await this.record(claim, claimToken, 'DEFERRED', decision.reason, new Date(decision.until).toISOString(), null, false, 'deferred');
        }
        return false;
      case 'SEND':
        break;
    }
    const transport = this.transports[claim.device.transport];
    const operation = claim.device.transport === 'FCM' ? 'dispatch_fcm' : 'dispatch_apns';
    let outcome;
    try {
      outcome = await transport.send(claim.device.token as string, decision.message, { apnsEnvironment: claim.device.apnsEnvironment });
    } catch {
      outcome = { kind: 'RETRYABLE' as const, reason: 'transport' };
    }
    switch (outcome.kind) {
      case 'ACCEPTED':
        return this.record(claim, claimToken, 'ACCEPTED', 'accepted', null, decision.level, true, 'accepted', operation);
      case 'TOKEN_INVALID':
        await this.record(claim, claimToken, 'TOKEN_INVALID', outcome.reason, null, null, true, 'token_invalid', operation);
        return false;
      case 'REJECTED':
        await this.record(claim, claimToken, 'REJECTED', outcome.reason, null, null, true, 'rejected', operation);
        return false;
      case 'NOT_CONFIGURED':
        await this.record(claim, claimToken, 'PENDING', 'provider_not_configured', new Date(now + NOT_CONFIGURED_WAIT_MS).toISOString(), null, false, 'provider_not_configured', operation);
        return false;
      case 'RETRYABLE': {
        const used = claim.attemptCount + 1;
        if (used >= PUSH_MAX_TRANSPORT_ATTEMPTS) {
          await this.record(claim, claimToken, 'EXHAUSTED', outcome.reason, null, null, true, 'exhausted', operation);
        } else {
          const wait = PUSH_RETRY_BACKOFF_MS[Math.min(used - 1, PUSH_RETRY_BACKOFF_MS.length - 1)];
          await this.record(claim, claimToken, 'PENDING', outcome.reason, new Date(now + wait).toISOString(), null, true, 'retry_scheduled', operation);
        }
        return false;
      }
    }
  }

  private async record(claim: ClaimedAttempt, claimToken: string, state: AttemptState, reason: string, next: string | null,
    level: string | null, counted: boolean, outcome: string, operation = 'decide'): Promise<boolean> {
    try {
      const rows = await this.repository.record(claim.attemptId, claimToken, state, reason, next, level, counted);
      const recorded = Array.isArray(rows) && rows.length === 1 && rows[0].outcome === 'RECORDED';
      this.signal(operation, recorded ? outcome : 'lease_lost');
      return recorded && state === 'ACCEPTED';
    } catch (error) {
      // The lease expires and a later cycle revalidates the intent from scratch.
      this.signal(operation, failureOutcome(error));
      return false;
    }
  }

  private signal(operation: string, outcome: string): void {
    try {
      this.telemetry.recordOperationalOutcome('PUSH_DELIVERY', operation, outcome);
    } catch {
      // Losing a signal is acceptable; changing a delivery decision is not.
    }
  }
}

function failureOutcome(error: unknown): 'transport_failure' | 'integrity_failure' {
  return classifyOperationalFailure(error) === 'TRANSPORT' ? 'transport_failure' : 'integrity_failure';
}
