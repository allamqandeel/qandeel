# Runtime Event Publisher Startup Recovery v1

Reliability Correction 2 of the bounded post-review Reliability Correction
Pass (Correction 1 — Foreground GENERATING Turn Recovery v1 — is closed). No
database migration: migrations `0001`–`0039` are byte-unchanged and no
migration `0040` exists. No event schema/version, outbox state, Redis stream
schema, provider, or consumer change.

## Original failure mode

If the API started while Redis was unavailable, `RuntimeEventPublisher.
onModuleInit()` recorded the failed connection and returned without creating
its polling timer. PostgreSQL outbox events remained durable (no data loss),
but that API instance never resumed publishing when Redis later became
available — only a process restart recovered delivery. Durability was
complete; **liveness** was not.

## The correction

The publisher now always retains its one supervision cycle:

```text
publisher enabled
→ one immediate bounded connection attempt (existing connect telemetry)
→ the single supervision timer is ALWAYS armed, success or failure

each scheduled cycle (single-flight):
    transport available   → normal claim/publish/ack batch path
    transport unavailable → at most ONE bounded reconnect attempt
        failure → cycle ends; repository.claim is NEVER called
        success → the SAME cycle resumes normal publishing
```

- API startup stays fail-soft: a failed Redis connection never throws out of
  `onModuleInit`, and the API remains available during a Redis outage.
- The existing `RUNTIME_EVENT_POLL_MS` (default 1000 ms) is the one
  supervision/reconnect cadence. No new environment variable, no separate
  reconnect timer, no configurable policy.
- **Transport outage alone cannot burn event attempts**: while Redis is
  unavailable no outbox row is claimed, so `attempt_count`, retry backoff, and
  quarantine state cannot change merely because infrastructure is down. The
  existing event-level exponential backoff applies only after a real claimed
  publish/ack failure, exactly as before.
- The SAME publisher instance resumes automatically when Redis returns — no
  restart, no new Nest instance. The same readiness-driven path also recovers
  from a later runtime disconnect (available → degraded → available).
- Shutdown stops future cycles first, prevents post-shutdown reconnects, and
  closes the transport idempotently with the existing bounded close telemetry.

## Transport retryability

`RedisStreamsTransport.connect()` is now safe to repeat on the same instance:

- already ready → no-op success;
- after a failed attempt → the failed client is disposed and a fresh bounded
  attempt runs; no stale failed client stays authoritative, nothing leaks;
- the redis client is created with `reconnectStrategy: false`, so every
  connection attempt is single-shot and bounded and the library never runs its
  own retry loop — the publisher supervision cadence is the one reconnect
  owner;
- `close()` is safe whether never connected, connected, previously failed, or
  already closed;
- `publish()` semantics after a successful connection are unchanged.

## Health / readiness

The Runtime Events health probe stays passive (no connect/publish/claim/
mutation) and reflects the same publisher readiness:

```text
missing configuration                  → not_configured
configured + Redis unavailable        → degraded
configured + recovered connection     → available
later transport degradation           → degraded
```

The degraded → available transition now happens automatically as supervision
recovers the transport.

## What does not change

Batch claim size 20, outbox lease 30 s, stable event IDs, structural envelope
validation, `XADD`, claim-token-fenced ack, `MAX_ATTEMPTS`, event-level
retry/backoff, quarantine, the privacy-minimized content-free envelope,
bounded telemetry, the single-flight `processOnce` guard, the Redis stream
name/default, and every consumer dedup/dispatch semantic. Foreground
conversation runtime and intelligence semantics are untouched.

## Verification

- `runtime-event.publisher.spec.ts`: deterministic fake-timer proofs that a
  failed startup keeps supervision alive, the same instance recovers and
  publishes, outages burn zero attempts (zero claim/retry/quarantine),
  recovery is single-flight, the available path never reconnects, later
  degradation re-enters recovery, and shutdown prevents all further
  connect/claim work.
- `redis-streams.transport.spec.ts`: transport lifecycle — bounded single-shot
  connect, ready-idempotent connect, retryable failure on the same object with
  the stale client disposed, runtime-error degradation, refusal to publish
  when not ready, and idempotent close across all states.
- `apps/api/scripts/verify-runtime-event-publisher-startup-recovery.ts`
  (`npm run verify:runtime-event-publisher-startup-recovery:integration`):
  real Redis 7 proof that the same transport object recovers after its own
  failed connect and that the same publisher instance goes
  onModuleInit-failure → zero claims → supervised reconnect → claim → real
  `XADD` → ack, in that causal order, with no retry/quarantine and no
  restart. CI runs it after the Runtime Event Outbox PostgreSQL verifier and
  before the background dispatch, A2, and Full Intelligence gates.

## Correction register

This closes the second of the two immediate post-review Reliability
Correction tasks.
