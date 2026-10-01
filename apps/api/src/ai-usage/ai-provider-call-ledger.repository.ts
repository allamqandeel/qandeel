import type {
  AiProviderCallBeginRecord,
  AiProviderCallLedger,
  AiProviderCallSettleRecord,
} from './ai-provider-call-accounting';

/** The one RPC capability the ledger needs: the explicit service-role channel, never a caller token. */
export interface AiLedgerRpc {
  rpc<T>(name: string, body: Record<string, unknown>): Promise<T>;
}

/**
 * AI-COST-01 (migration 0135): the provider-call ledger through the server channel.
 *
 * It sends server-known identities and normalized numbers only, and reads a typed outcome. Anything but the outcomes
 * the commands define is an integrity failure - for `begin` that means no provider call starts.
 */
export class SupabaseAiProviderCallLedger implements AiProviderCallLedger {
  constructor(private readonly serviceApi: AiLedgerRpc) {}

  async begin(record: AiProviderCallBeginRecord): Promise<void> {
    const rows = await this.serviceApi.rpc<Array<{ begin_outcome: string }>>('begin_ai_provider_call_v1', {
      p_call_id: record.callId,
      p_user_id: record.userId,
      p_session_id: record.sessionId,
      p_source_turn_id: record.sourceTurnId,
      p_provider: record.provider,
      p_requested_model: record.requestedModel,
      p_operation: record.operation,
      p_feature_family: record.featureFamily,
      p_processing_path: record.processingPath,
    });
    const outcome = rows?.[0]?.begin_outcome;
    if (outcome !== 'BEGUN' && outcome !== 'ALREADY_BEGUN') throw new Error('AI_PROVIDER_CALL_BEGIN_INTEGRITY');
  }

  async settle(record: AiProviderCallSettleRecord): Promise<void> {
    const rows = await this.serviceApi.rpc<Array<{ settle_outcome: string }>>('settle_ai_provider_call_v1', {
      p_call_id: record.callId,
      p_user_id: record.userId,
      p_outcome: record.outcome,
      p_usage_completeness: record.usage.completeness,
      p_usage: record.usage.completeness === 'ABSENT' ? {} : { ...record.usage.quantities },
    });
    const outcome = rows?.[0]?.settle_outcome;
    if (outcome !== 'SETTLED' && outcome !== 'ALREADY_SETTLED') throw new Error('AI_PROVIDER_CALL_SETTLE_INTEGRITY');
  }
}
