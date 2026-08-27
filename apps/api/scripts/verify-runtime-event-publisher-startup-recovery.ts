// Runtime Event Publisher Startup Recovery v1 — real Redis integration
// verifier.
//
// Proves two independent liveness facts against the real CI Redis 7 instance:
//
//   1. The SAME RedisStreamsTransport instance is retryable after its own
//      failed connection attempt: a bounded failure against a
//      guaranteed-unavailable endpoint leaves readiness degraded, and a later
//      connect() on the same object against the real Redis becomes available
//      and can XADD a canonical privacy-safe envelope.
//
//   2. The SAME RuntimeEventPublisher instance recovers automatically after a
//      failed startup connection: onModuleInit stays fail-soft, zero outbox
//      claims happen while the transport is unavailable, a scheduled
//      supervision cycle reconnects, and the SAME cycle claims/publishes/acks
//      the one pending event — no restart, no new publisher instance.
//
// Zero paid provider/model calls, zero external HTTP, zero PostgreSQL
// requirement (the outbox repository is a deterministic in-memory double).
// Only verifier-owned Redis streams are created and they are deleted at the
// end. Output is bounded: no URL, credential, payload, ID, or raw error is
// printed.
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { RedisStreamsTransport } from '../src/runtime-events/redis-streams.transport';
import { RuntimeEventPublisher } from '../src/runtime-events/runtime-event.publisher';
import type { RuntimeEventTransport } from '../src/runtime-events/runtime-event-transport';
import type { RuntimeEventAdminRepository } from '../src/runtime-events/runtime-event-admin.repository';
import type { ClaimedRuntimeEvent, OutboxErrorCode, RuntimeEventEnvelope } from '../src/runtime-events/runtime-event.types';
import { CorrelationService } from '../src/observability/correlation.service';
import { TelemetryService } from '../src/observability/telemetry.service';

const realRedisUrl = process.env.REDIS_URL;
if (!realRedisUrl) throw new Error('REDIS_URL is required for the startup-recovery verifier.');
// Guaranteed-unavailable loopback endpoint (reserved port 1, no listener):
// the transport's single-shot bounded connect rejects promptly.
const UNAVAILABLE_REDIS_URL = 'redis://127.0.0.1:1';

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const envelopeOf = (eventId: string): RuntimeEventEnvelope => {
  const user = randomUUID(), session = randomUUID(), turn = randomUUID();
  return {
    event_id: eventId, event_type: 'ConversationTurnCompleted', event_version: '1.0',
    occurred_at: new Date().toISOString(), producer: 'conversation-service',
    subject_user_id: user, subject_session_id: session, subject_turn_id: turn,
    correlation_id: null, causation_id: null, classification: 'SENSITIVE',
    schema_ref: 'qandeel.runtime.conversation-turn-completed.v1',
    payload: { user_id: user, session_id: session, source_turn_id: turn, terminal_status: 'COMPLETED', processing_path: 'FAST', routing_reason: 'FAST_DEFAULT', orchestration_id: null },
    contains_content: false, retention_class: 'OPERATIONAL_EVENT_V1',
  };
};
const claimedOf = (envelope: RuntimeEventEnvelope, claimToken: string): ClaimedRuntimeEvent => ({
  ...envelope, status: 'IN_FLIGHT', attempt_count: 1, claim_token: claimToken,
  claimed_at: new Date().toISOString(), lease_expires_at: new Date(Date.now() + 30_000).toISOString(),
});

// Deterministic in-memory outbox double holding exactly one valid content-free
// event. It records the shared causal timeline; it never touches PostgreSQL.
class InMemoryOutboxRepository {
  readonly enabled = true;
  claimCount = 0; ackCount = 0; retryCount = 0; quarantineCount = 0;
  private delivered = false;
  private ackSignal!: (messageId: string) => void;
  readonly acked = new Promise<string>((resolve) => { this.ackSignal = resolve; });
  constructor(private readonly pending: RuntimeEventEnvelope, private readonly timeline: string[]) {}
  async claim(_batchSize: number, _leaseSeconds: number, claimToken: string): Promise<ClaimedRuntimeEvent[]> {
    this.claimCount += 1; this.timeline.push('claim');
    if (this.delivered) return [];
    this.delivered = true;
    return [claimedOf(this.pending, claimToken)];
  }
  async ack(_eventId: string, _claimToken: string, messageId: string): Promise<boolean> {
    this.ackCount += 1; this.timeline.push('ack'); this.ackSignal(messageId); return true;
  }
  async retry(_eventId: string, _claimToken: string, _code: OutboxErrorCode, _nextAttemptAt: Date): Promise<boolean> {
    this.retryCount += 1; this.timeline.push('retry'); return true;
  }
  async quarantine(_eventId: string, _claimToken: string, _code: 'INVALID_EVENT' | 'MAX_ATTEMPTS_EXCEEDED'): Promise<boolean> {
    this.quarantineCount += 1; this.timeline.push('quarantine'); return true;
  }
}

// Verifier-only wrapper that makes the initial startup failure deterministic:
// the first connect() fails; every later connect() delegates to the REAL
// transport. Readiness always reflects the real transport.
class FailFirstStartupTransport implements RuntimeEventTransport {
  connectAttempts = 0;
  constructor(private readonly inner: RedisStreamsTransport, private readonly timeline: string[]) {}
  get readinessStatus(): 'not_configured' | 'available' | 'degraded' { return this.inner.readinessStatus; }
  async connect(): Promise<void> {
    this.connectAttempts += 1;
    if (this.connectAttempts === 1) { this.timeline.push('connect:failure'); throw new Error('VERIFIER_DETERMINISTIC_STARTUP_FAILURE'); }
    await this.inner.connect();
    this.timeline.push('connect:success');
  }
  async publish(event: RuntimeEventEnvelope): Promise<string> { const id = await this.inner.publish(event); this.timeline.push('publish'); return id; }
  close(): Promise<void> { return this.inner.close(); }
}

async function cleanupStream(stream: string): Promise<void> {
  const janitor = createClient({ url: realRedisUrl, socket: { reconnectStrategy: false } });
  janitor.on('error', () => undefined);
  await janitor.connect();
  try { await janitor.del(stream); } finally { await janitor.quit(); }
}

async function verifyTransportRetryability(): Promise<void> {
  const stream = `qandeel:verify:startup-recovery:transport:${randomUUID()}`;
  process.env.RUNTIME_EVENT_STREAM = stream;
  process.env.REDIS_URL = UNAVAILABLE_REDIS_URL;
  const transport = new RedisStreamsTransport();
  const readiness = (): string => transport.readinessStatus;
  try {
    assert(readiness() === 'degraded', 'transport must start degraded when configured');
    let failed = false;
    try { await transport.connect(); } catch { failed = true; }
    assert(failed, 'connect against the unavailable endpoint must fail in a bounded manner');
    assert(readiness() === 'degraded', 'failed connect must leave readiness degraded');
    let refused = false;
    try { await transport.publish(envelopeOf(randomUUID())); } catch { refused = true; }
    assert(refused, 'publish must refuse while the transport is not ready');
    // Same transport object, real Redis restored: recovery must succeed.
    process.env.REDIS_URL = realRedisUrl;
    await transport.connect();
    assert(readiness() === 'available', 'recovered connect must set readiness available');
    const messageId = await transport.publish(envelopeOf(randomUUID()));
    assert(typeof messageId === 'string' && messageId.length > 0, 'recovered transport must XADD the canonical envelope');
    await transport.connect();
    assert(readiness() === 'available', 'ready connect must stay an idempotent no-op success');
  } finally {
    process.env.REDIS_URL = realRedisUrl;
    await transport.close().catch(() => undefined);
    await cleanupStream(stream).catch(() => undefined);
  }
}

async function verifyPublisherStartupRecovery(): Promise<void> {
  const stream = `qandeel:verify:startup-recovery:publisher:${randomUUID()}`;
  process.env.RUNTIME_EVENT_STREAM = stream;
  process.env.REDIS_URL = realRedisUrl;
  process.env.RUNTIME_EVENT_POLL_MS = '100';
  const savedNodeEnv = process.env.NODE_ENV;
  if (process.env.NODE_ENV === 'test') delete process.env.NODE_ENV;
  const timeline: string[] = [];
  const pendingEvent = envelopeOf(randomUUID());
  const inner = new RedisStreamsTransport();
  const transport = new FailFirstStartupTransport(inner, timeline);
  const repository = new InMemoryOutboxRepository(pendingEvent, timeline);
  const publisher = new RuntimeEventPublisher(
    repository as unknown as RuntimeEventAdminRepository, transport, new TelemetryService(new CorrelationService()));
  try {
    assert(publisher.enabled, 'publisher must be enabled for the recovery proof');
    await publisher.onModuleInit();
    assert(transport.connectAttempts === 1, 'startup performs exactly one immediate connection attempt');
    assert(repository.claimCount === 0, 'no outbox claim may happen while the transport is unavailable');
    const readinessAfterFailedStartup: string = publisher.readinessStatus;
    assert(readinessAfterFailedStartup === 'degraded', 'readiness must be degraded after the failed startup connect');
    // Bounded safety guard only — recovery itself is signaled by the ack.
    const timeout = new Promise<never>((_resolve, reject) => {
      const guard = setTimeout(() => reject(new Error('RECOVERY_TIMEOUT')), 15_000); guard.unref();
    });
    const messageId = await Promise.race([repository.acked, timeout]);
    const readinessAfterRecovery: string = publisher.readinessStatus;
    assert(readinessAfterRecovery === 'available', 'readiness must be available after recovery');
    assert(transport.connectAttempts >= 2, 'a scheduled supervision cycle must have retried the connection');
    // Causal ordering on the ONE shared timeline: startup failure, then the
    // supervised reconnect, and only then claim -> publish -> ack.
    const ordered = ['connect:failure', 'connect:success', 'claim', 'publish', 'ack'];
    const indexes = ordered.map((entry) => timeline.indexOf(entry));
    assert(indexes.every((index) => index >= 0), 'every causal stage must have occurred');
    assert([...indexes].every((index, position) => position === 0 || index > indexes[position - 1]), 'claim/publish/ack happen only after successful transport recovery');
    assert(timeline.indexOf('claim') === timeline.indexOf('connect:success') + 1, 'no repository operation precedes the recovery connect');
    assert(repository.claimCount >= 1, 'the pending event must be claimed after recovery');
    assert(repository.ackCount === 1, 'exactly one ack must occur');
    assert(repository.retryCount === 0, 'no retry may occur');
    assert(repository.quarantineCount === 0, 'no quarantine may occur');
    assert(timeline.filter((entry) => entry === 'publish').length === 1, 'exactly one publish must occur');
    // The XADDed entry is real and content-free.
    const reader = createClient({ url: realRedisUrl, socket: { reconnectStrategy: false } });
    reader.on('error', () => undefined);
    await reader.connect();
    try {
      const entries = await reader.xRange(stream, '-', '+');
      assert(entries.length === 1, 'exactly one real Redis stream entry exists');
      assert(entries[0].id === messageId, 'the acked message id is the real XADD id');
      assert(entries[0].message.event_id === pendingEvent.event_id, 'the entry carries the stable event id');
      const published = JSON.parse(entries[0].message.envelope) as Record<string, unknown>;
      assert(published.contains_content === false, 'the published envelope stays content-free');
      assert(!('claim_token' in published) && !('attempt_count' in published) && !('status' in published), 'claim metadata never leaves the outbox');
    } finally { await reader.quit(); }
  } finally {
    if (savedNodeEnv !== undefined) process.env.NODE_ENV = savedNodeEnv;
    await publisher.onModuleDestroy().catch(() => undefined);
    await cleanupStream(stream).catch(() => undefined);
  }
}

async function main(): Promise<void> {
  await verifyTransportRetryability();
  await verifyPublisherStartupRecovery();
  console.log('Runtime Event Publisher Startup Recovery: PASS');
}

main().catch((error) => {
  const label = error instanceof Error && /^[A-Za-z :_-]{1,120}$/u.test(error.message) ? error.message : 'verification failure';
  console.error(`Runtime Event Publisher Startup Recovery: FAIL (${label})`);
  process.exitCode = 1;
});
