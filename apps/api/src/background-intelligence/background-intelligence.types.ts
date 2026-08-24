export const BACKGROUND_INTELLIGENCE_AUTHORITY = 'BACKGROUND_INTELLIGENCE_V1' as const;

export type BackgroundIntelligenceAuthorizationOutcome =
  | 'AUTHORIZED'
  | 'NOT_AUTHORIZED_INVALID_EVENT'
  | 'NOT_AUTHORIZED_NONCANONICAL_TURN'
  | 'NOT_AUTHORIZED_OWNER_MISMATCH';

export interface BackgroundIntelligenceAuthorizationResult {
  readonly outcome: BackgroundIntelligenceAuthorizationOutcome;
  readonly context?: import('./background-intelligence-context.factory').BackgroundIntelligenceExecutionContext;
}
