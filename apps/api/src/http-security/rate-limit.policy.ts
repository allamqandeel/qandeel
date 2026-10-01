import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, type ExecutionContext } from '@nestjs/common';
import { normalizeIp, ThrottlerGuard, type ThrottlerLimitDetail, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { clientAddressOf } from './client-address';
import { censusClassOf } from './route-rate-limit.census';

/**
 * PROD-SEC-01 (SEC-A) — QANDEEL's application-layer request rate limit.
 *
 * ## What it is, and what it is not
 *
 * One global guard bounds EVERY routed HTTP request before any controller, auth guard, database or provider work runs.
 * Its counters live in this process's memory (Nest's own storage): it bounds each API instance by itself and is
 * ORIGIN DEFENCE-IN-DEPTH. It is not a distributed or global limit — N instances admit N times the budget — and it is
 * not DoS protection. The global, distributed, per-IP limit and the guarantee that nobody reaches an origin around it
 * belong to the edge, owned by `LAUNCH-EDGE-SECURITY-GATE`. No external store is used, so there is no storage failure
 * that could turn into "unlimited", and Redis stays optional.
 *
 * It does not replace PROD-SEC-02. The per-account AI admission and work-start budget are decided atomically by the
 * database (migration 0131) and remain the only cost authority; this layer bounds request volume per client address.
 *
 * ## The key
 *
 * The client address resolved by Express under the startup proxy topology (`client-address.ts`), IPv6 grouped by its
 * /64 — never a Login ID, Email, Public ID, token, body or user text, and never hashed together with any of them. Keys
 * are SHA-256 digests held only while their window lasts: nothing about an address is stored beyond that or logged.
 *
 * ## The windows
 *
 *   client        every route together, per client address, per minute — the aggregate baseline;
 *   route_minute  each route, per client address, per minute — set by the route's class;
 *   route_hour    each route, per client address, per hour — only for the classes that carry one (pre-auth, mail,
 *                 security-sensitive), so a slow sustained attempt is bounded as well as a burst.
 *
 * The numbers are engineering safety defaults, not Product law. They are code, not configuration: nothing in the
 * environment can lower them to zero, raise them to infinity or switch the guard off. A change is a reviewed change.
 */
export type RateLimitClass =
  | 'HEALTH'
  | 'PRE_AUTH_LOOKUP'
  | 'PRE_AUTH_CREDENTIAL'
  | 'PRE_AUTH_MAIL'
  | 'AUTHENTICATED'
  | 'AUTHENTICATED_MAIL'
  | 'SECURITY_SENSITIVE'
  | 'CONVERSATION'
  | 'UNCLASSIFIED';

export interface RateLimitPolicy {
  readonly perMinute: number;
  /** `null`: the class has no hour window. */
  readonly perHour: number | null;
}

/**
 * The policy table. Ordinary authenticated use — the 5-second foreground poll fans into a handful of reads, and many
 * readers can share one carrier-grade NAT address — stays far below its class. Pre-authentication sign-in and code
 * verification are sized next to the provider's own per-address default (30 token / verify requests per 5 minutes, 360
 * an hour): this layer stops a burst before it reaches the database lookup and the provider, without becoming a
 * stricter hourly lock-out than the provider already applies. Mail-producing routes get the tightest.
 */
export const RATE_LIMIT_POLICIES: Readonly<Record<RateLimitClass, RateLimitPolicy>> = Object.freeze({
  /** Load-balancer and orchestrator probes: several per second per probe address stays admitted. */
  HEALTH: { perMinute: 240, perHour: null },
  /** `/account/login-id-availability` — a boolean asked while a reader chooses a Login ID. */
  PRE_AUTH_LOOKUP: { perMinute: 30, perHour: 300 },
  /** Login ID sign-in and the Login-ID-origin Email code check: a password or a code is tried. */
  PRE_AUTH_CREDENTIAL: { perMinute: 20, perHour: 300 },
  /** The Login-ID-origin verification resend: every admitted request can send mail. */
  PRE_AUTH_MAIL: { perMinute: 3, perHour: 20 },
  /** Ordinary guarded reads and writes of the reader's own state, including the foreground poll. */
  AUTHENTICATED: { perMinute: 600, perHour: null },
  /** The owner's Email change: every admitted request can send mail to two addresses. */
  AUTHENTICATED_MAIL: { perMinute: 3, perHour: 20 },
  /** Password, Login ID, Email confirmation, sign-out of other devices, export and deletion requests. */
  SECURITY_SENSITIVE: { perMinute: 20, perHour: 120 },
  /** Conversation sessions, turns and their projections. AI cost stays bounded by the database (PROD-SEC-02). */
  CONVERSATION: { perMinute: 300, perHour: null },
  /** A route nobody classified: bounded like a credential route until it is. The route census fails CI for it. */
  UNCLASSIFIED: { perMinute: 10, perHour: 60 },
});

/** Every route together, per client address, per minute. */
export const CLIENT_LIMIT_PER_MINUTE = 1200;

export const CLIENT_THROTTLER = 'client';
export const ROUTE_MINUTE_THROTTLER = 'route_minute';
export const ROUTE_HOUR_THROTTLER = 'route_hour';
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** The route's class, from the one route census. A route the census does not name is UNCLASSIFIED. */
export function rateLimitClassOf(context: ExecutionContext): RateLimitClass {
  return censusClassOf(context.getClass(), context.getHandler().name);
}

const policyOf = (context: ExecutionContext): RateLimitPolicy => RATE_LIMIT_POLICIES[rateLimitClassOf(context)];

/** Fail at startup, not at the first request, if the table ever stops being a set of positive whole numbers. */
export function assertRateLimitPolicies(): void {
  const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
  if (!positive(CLIENT_LIMIT_PER_MINUTE)) throw new Error('RATE_LIMIT_POLICY_INVALID: client');
  for (const [name, policy] of Object.entries(RATE_LIMIT_POLICIES)) {
    if (!positive(policy.perMinute) || (policy.perHour !== null && (!positive(policy.perHour) || policy.perHour < policy.perMinute))) {
      throw new Error(`RATE_LIMIT_POLICY_INVALID: ${name}`);
    }
  }
}

export function rateLimitModuleOptions(): ThrottlerModuleOptions {
  assertRateLimitPolicies();
  return {
    // No X-RateLimit-* counters on the wire: a refusal says only that it was refused and when to retry.
    setHeaders: false,
    throttlers: [
      { name: CLIENT_THROTTLER, ttl: MINUTE_MS, limit: CLIENT_LIMIT_PER_MINUTE },
      { name: ROUTE_MINUTE_THROTTLER, ttl: MINUTE_MS, limit: (context) => policyOf(context).perMinute },
      {
        name: ROUTE_HOUR_THROTTLER,
        ttl: HOUR_MS,
        limit: (context) => policyOf(context).perHour ?? 1,
        skipIf: (context) => policyOf(context).perHour === null,
      },
    ],
  };
}

/** The one tracker: the trusted client address, IPv6 grouped by /64. A request with no address shares one bucket. */
export function rateLimitTrackerOf(request: { readonly ip?: unknown }): string {
  const address = clientAddressOf(request);
  return address === undefined ? 'unresolved-client-address' : normalizeIp(address, 64);
}

/** The answer to a refused request: generic, the same for every route and every identifier. */
export const RATE_LIMITED_BODY = Object.freeze({ outcome: 'RATE_LIMITED' });

@Injectable()
export class QandeelThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: Record<string, unknown>): Promise<string> {
    return rateLimitTrackerOf(request);
  }

  /** The aggregate window is per address across all routes; the route windows are per address per route. */
  protected override generateKey(context: ExecutionContext, tracker: string, throttlerName: string): string {
    if (throttlerName === CLIENT_THROTTLER) return createHash('sha256').update(JSON.stringify([CLIENT_THROTTLER, tracker])).digest('hex');
    return super.generateKey(context, tracker, throttlerName);
  }

  protected override async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const response = context.switchToHttp().getResponse<{ header?: (name: string, value: string) => unknown }>();
    response.header?.('Retry-After', String(Math.max(1, Math.ceil(detail.timeToBlockExpire))));
    throw new HttpException(RATE_LIMITED_BODY, HttpStatus.TOO_MANY_REQUESTS);
  }
}
