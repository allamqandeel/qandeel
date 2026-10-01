import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { correlation } from '../observability/shared-correlation';
import { TelemetryService } from '../observability/telemetry.service';
import { AiProviderCallAccounting } from './ai-provider-call-accounting';
import { SupabaseAiProviderCallLedger } from './ai-provider-call-ledger.repository';
import { accountedOpenAIResponsesClient } from './accounted-provider-clients';
import type { AiFeatureFamily } from './ai-usage.types';

// AI-COST-01 - the ONE production accounting boundary, shared by every production provider composition (the Model
// Router, the four semantic bindings and the three post-response adapters). It is created on first use, never at
// import, so starting the API and running unrelated tests read no credential and open no connection. It writes
// through the explicit service-role channel, reads the request correlation already in scope (session and user turn)
// and emits bounded telemetry.

let accounting: AiProviderCallAccounting | undefined;

/**
 * The client decorator a composition root hands to a semantic binding factory: it puts that adapter's OpenAI
 * Responses transport behind the production boundary under one feature family. Creating the decorator constructs
 * nothing; the boundary is created when the first client is decorated (inside the lazy binding).
 */
export function costLedgerDecorator(featureFamily: AiFeatureFamily): <C extends Parameters<typeof accountedOpenAIResponsesClient>[0]>(client: C) => C {
  return (client) => accountedOpenAIResponsesClient(client, featureFamily, productionAiProviderCallAccounting());
}

export function productionAiProviderCallAccounting(): AiProviderCallAccounting {
  accounting ??= new AiProviderCallAccounting(
    new SupabaseAiProviderCallLedger(new SupabaseServiceRoleApiService()),
    new TelemetryService(correlation),
    () => correlation.current(),
  );
  return accounting;
}
