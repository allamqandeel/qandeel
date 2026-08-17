import type { ModelRouterContextMessage } from '../model-router/model-router.types';

export type SafetyCategory =
  | 'NONE'
  | 'SELF_HARM_OR_SUICIDE'
  | 'VIOLENCE_OR_HARM_TO_OTHERS'
  | 'SEXUAL_CONTENT_MINOR'
  | 'SEVERE_ILLEGAL_ACTIONABLE_HARM'
  | 'HIGH_STAKES_MEDICAL_CRISIS';

export type SafetyDisposition = 'ALLOW' | 'GUIDED' | 'BLOCK';

export interface SafetyResponseGateResult {
  category: SafetyCategory;
  disposition: SafetyDisposition;
  safetyGuidance?: string;
  deterministicResponse?: string;
}

export const SAFETY_RESPONSE_GATE = Symbol('SAFETY_RESPONSE_GATE');

export interface SafetyResponseGate {
  evaluate(currentTurn: string, context: ReadonlyArray<ModelRouterContextMessage>): SafetyResponseGateResult;
}
