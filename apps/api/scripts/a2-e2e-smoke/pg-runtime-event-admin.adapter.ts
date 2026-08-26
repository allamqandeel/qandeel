// Smoke-only PostgreSQL transport substitute for RuntimeEventAdminRepository.
// The production repository reaches the SAME canonical SQL commands
// (claim_runtime_events / ack_runtime_event / retry_runtime_event /
// quarantine_runtime_event, migration 0019) through PostgREST with the
// service_role transport; CI provides PostgreSQL without PostgREST, so this
// adapter issues the identical RPCs directly through the shared pg client as
// service_role. It contains NO business logic: claiming, leasing, ack, retry
// and quarantine rules all live in the canonical SECURITY DEFINER functions.
import type { ClaimedRuntimeEvent, OutboxErrorCode } from '../../src/runtime-events/runtime-event.types';
import type { SmokeDbSession } from './smoke-db';

export class PgRuntimeEventAdminRepositoryAdapter {
  readonly enabled = true;

  constructor(private readonly db: SmokeDbSession) {}

  async claim(batchSize: number, leaseSeconds: number, claimToken: string): Promise<ClaimedRuntimeEvent[]> {
    return this.db.asRole<ClaimedRuntimeEvent>(
      'service_role',
      'SELECT * FROM public.claim_runtime_events($1, $2, $3)',
      [batchSize, leaseSeconds, claimToken],
    );
  }

  async ack(eventId: string, claimToken: string, messageId: string): Promise<boolean> {
    return this.booleanRpc('SELECT public.ack_runtime_event($1, $2, $3) AS value', [eventId, claimToken, messageId]);
  }

  async retry(eventId: string, claimToken: string, code: OutboxErrorCode, nextAttemptAt: Date): Promise<boolean> {
    return this.booleanRpc(
      'SELECT public.retry_runtime_event($1, $2, $3, $4) AS value',
      [eventId, claimToken, code, nextAttemptAt.toISOString()],
    );
  }

  async quarantine(eventId: string, claimToken: string, code: 'INVALID_EVENT' | 'MAX_ATTEMPTS_EXCEEDED'): Promise<boolean> {
    return this.booleanRpc('SELECT public.quarantine_runtime_event($1, $2, $3) AS value', [eventId, claimToken, code]);
  }

  private async booleanRpc(text: string, values: readonly unknown[]): Promise<boolean> {
    const rows = await this.db.asRole<{ value: boolean }>('service_role', text, values);
    return rows[0]?.value === true;
  }
}
