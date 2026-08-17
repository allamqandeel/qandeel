export const BEHAVIORAL_RESPONSE_POLICY = Symbol('BEHAVIORAL_RESPONSE_POLICY');

export interface BehavioralResponsePolicy {
  buildTextGuidance(): string;
}
